import crypto from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, orderFiles, orders, tenants, users } from '../db/schema.js'
import { env } from '../lib/env.js'
import { sendContractEmail, sendContractSignedNotification } from '../lib/email.js'
import { uploadBinary } from '../lib/r2.js'
import type { TenantSettings } from '../types/index.js'

const HOME_SIZE_LABELS: Record<string, string> = {
  studio: 'Studio',
  '1br': '1 BR',
  '2br': '2 BR',
  '3br': '3 BR',
  house: 'House',
}

function formatMoveDate(moveDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${moveDate}T00:00:00Z`))
}

async function getTenantOwnerId(tenantId: string): Promise<string | null> {
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenant_id, tenantId), eq(users.role, 'owner'), isNull(users.deleted_at)))
    .limit(1)
  return owner?.id ?? null
}

export interface SendContractResult {
  found: boolean
  token: string | null
  emailSent: boolean
}

// Generates a contract token (if missing) and marks the contract as sent,
// emailing the signing link to the client when we have their address.
// Used both by the auto-trigger on status → confirmed and the manual resend.
export async function sendContractForOrder(
  tenantId: string,
  orderId: string,
): Promise<SendContractResult> {
  const [row] = await db
    .select({
      id: orders.id,
      contract_token: orders.contract_token,
      contract_status: orders.contract_status,
      move_date: orders.move_date,
      clientEmail: clients.email,
      clientName: clients.name,
      companyName: tenants.name,
    })
    .from(orders)
    .leftJoin(clients, eq(clients.id, orders.client_id))
    .innerJoin(tenants, eq(tenants.id, orders.tenant_id))
    .where(and(eq(orders.id, orderId), eq(orders.tenant_id, tenantId)))
    .limit(1)

  if (!row) return { found: false, token: null, emailSent: false }
  if (row.contract_status === 'signed') {
    return { found: true, token: row.contract_token, emailSent: false }
  }

  const token = row.contract_token ?? crypto.randomUUID()
  await db
    .update(orders)
    .set({ contract_token: token, contract_status: 'sent', updated_at: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.tenant_id, tenantId)))

  let emailSent = false
  if (row.clientEmail) {
    sendContractEmail({
      to: row.clientEmail,
      clientName: row.clientName ?? 'there',
      companyName: row.companyName,
      moveDate: formatMoveDate(row.move_date),
      contractUrl: `${env.FRONTEND_URL}/contract/${token}`,
    })
    emailSent = true
  }

  return { found: true, token, emailSent }
}

export interface PublicContract {
  order: {
    moveDate: string
    fromAddress: string
    toAddress: string
    homeSize: string
    packing: boolean
    totalPrice: number
    fromFloor: number
    toFloor: number
    fromElevator: boolean
    toElevator: boolean
  }
  client: { name: string; phone: string }
  company: {
    name: string
    logoUrl: string | null
    phone: string | null
    contractTerms: string | null
  }
  contractStatus: 'sent' | 'signed'
  alreadySigned: boolean
  signedName: string | null
  signedAt: string | null
}

export async function getPublicContract(token: string): Promise<PublicContract | null> {
  const [row] = await db
    .select({
      moveDate: orders.move_date,
      fromAddress: orders.from_address,
      toAddress: orders.to_address,
      homeSize: orders.home_size,
      packing: orders.packing,
      totalPrice: orders.total_price,
      fromFloor: orders.from_floor,
      toFloor: orders.to_floor,
      fromElevator: orders.from_elevator,
      toElevator: orders.to_elevator,
      contractStatus: orders.contract_status,
      signedName: orders.contract_signed_name,
      signedAt: orders.contract_signed_at,
      clientName: clients.name,
      clientPhone: clients.phone,
      companyName: tenants.name,
      companyLogoUrl: tenants.logo_url,
      companySettings: tenants.settings,
    })
    .from(orders)
    .leftJoin(clients, eq(clients.id, orders.client_id))
    .innerJoin(tenants, eq(tenants.id, orders.tenant_id))
    .where(eq(orders.contract_token, token))
    .limit(1)

  if (!row) return null

  const settings = (row.companySettings ?? {}) as Partial<TenantSettings>
  const signed = row.contractStatus === 'signed'

  return {
    order: {
      moveDate: formatMoveDate(row.moveDate),
      fromAddress: row.fromAddress,
      toAddress: row.toAddress,
      homeSize: HOME_SIZE_LABELS[row.homeSize] ?? row.homeSize,
      packing: row.packing ?? false,
      totalPrice: row.totalPrice,
      fromFloor: row.fromFloor ?? 1,
      toFloor: row.toFloor ?? 1,
      fromElevator: row.fromElevator ?? false,
      toElevator: row.toElevator ?? false,
    },
    client: { name: row.clientName ?? '', phone: row.clientPhone ?? '' },
    company: {
      name: row.companyName,
      logoUrl: row.companyLogoUrl,
      phone: settings.phone ?? null,
      contractTerms: settings.contractTerms ?? null,
    },
    contractStatus: signed ? 'signed' : 'sent',
    alreadySigned: signed,
    signedName: row.signedName ?? null,
    signedAt: row.signedAt ? row.signedAt.toISOString() : null,
  }
}

interface DecodedImage {
  buffer: Buffer
  contentType: string
}

// Parses a base64 data URL (e.g. "data:image/png;base64,iVBOR...") into raw
// bytes. Returns null for anything that isn't a base64-encoded PNG.
function decodePngDataUrl(dataUrl: string): DecodedImage | null {
  const match = /^data:(image\/png);base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  try {
    return { buffer: Buffer.from(match[2], 'base64'), contentType: match[1] }
  } catch {
    return null
  }
}

export type SignContractResult =
  | { status: 'not_found' }
  | { status: 'already_signed' }
  | { status: 'invalid_signature' }
  | { status: 'signed'; orderId: string; tenantId: string }

export async function signContract(
  token: string,
  input: { signedName: string; signatureDataUrl: string },
): Promise<SignContractResult> {
  const [order] = await db
    .select({
      id: orders.id,
      tenant_id: orders.tenant_id,
      contract_status: orders.contract_status,
      move_date: orders.move_date,
      clientName: clients.name,
    })
    .from(orders)
    .leftJoin(clients, eq(clients.id, orders.client_id))
    .where(eq(orders.contract_token, token))
    .limit(1)

  if (!order) return { status: 'not_found' }
  if (order.contract_status === 'signed') return { status: 'already_signed' }

  const decoded = decodePngDataUrl(input.signatureDataUrl)
  if (!decoded) return { status: 'invalid_signature' }

  const key = `signatures/${order.tenant_id}/${order.id}/signature.png`
  const { url } = await uploadBinary(key, decoded.buffer, decoded.contentType)

  await db
    .update(orders)
    .set({
      contract_status: 'signed',
      contract_signed_at: new Date(),
      contract_signed_name: input.signedName,
      contract_signature_url: url,
      updated_at: new Date(),
    })
    .where(and(eq(orders.id, order.id), eq(orders.tenant_id, order.tenant_id)))

  const owners = await db
    .select({ email: users.email })
    .from(users)
    .where(
      and(eq(users.tenant_id, order.tenant_id), eq(users.role, 'owner'), isNull(users.deleted_at)),
    )
  for (const owner of owners) {
    sendContractSignedNotification({
      to: owner.email,
      clientName: order.clientName ?? 'A client',
      moveDate: formatMoveDate(order.move_date),
      orderUrl: `${env.FRONTEND_URL}/orders?order=${order.id}`,
    })
  }

  return { status: 'signed', orderId: order.id, tenantId: order.tenant_id }
}

export type StorePdfResult = 'not_found' | 'not_signed' | 'stored' | 'exists' | 'no_owner'

// Persists the signed-contract PDF (rendered client-side, uploaded here) to
// storage + order_files. Idempotent: the object is overwritten on repeat
// calls but the order_files row is only inserted once.
export async function storeSignedContractPdf(token: string, pdf: Buffer): Promise<StorePdfResult> {
  const [order] = await db
    .select({
      id: orders.id,
      tenant_id: orders.tenant_id,
      contract_status: orders.contract_status,
    })
    .from(orders)
    .where(eq(orders.contract_token, token))
    .limit(1)

  if (!order) return 'not_found'
  if (order.contract_status !== 'signed') return 'not_signed'

  const uploadedBy = await getTenantOwnerId(order.tenant_id)
  if (!uploadedBy) return 'no_owner'

  const key = `contracts/${order.tenant_id}/${order.id}/signed-contract.pdf`
  const { url } = await uploadBinary(key, pdf, 'application/pdf')

  const [existing] = await db
    .select({ id: orderFiles.id })
    .from(orderFiles)
    .where(and(eq(orderFiles.tenant_id, order.tenant_id), eq(orderFiles.key, key)))
    .limit(1)
  if (existing) return 'exists'

  await db.insert(orderFiles).values({
    tenant_id: order.tenant_id,
    order_id: order.id,
    name: 'contract-signed.pdf',
    url,
    key,
    size: pdf.length,
    mime_type: 'application/pdf',
    uploaded_by: uploadedBy,
  })

  return 'stored'
}
