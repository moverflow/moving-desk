import 'dotenv/config'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { and, eq, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import pg from 'pg'
import {
  clients,
  crews,
  invoices,
  leads,
  orders,
  subscriptions,
  tenants,
  users,
} from '../src/db/schema.js'

const TARGET_ORDERS = 42
const CANCEL_RATE = 0.15
const PACKING_RATE = 0.25
const PACKING_FEE = 120
const WINDOW_DAYS = 90
const INVOICE_EXPIRY_DAYS = 7
const BCRYPT_ROUNDS = 12

const BASE_RATES: Record<HomeSize, number> = {
  studio: 280,
  '1br': 380,
  '2br': 480,
  '3br': 620,
  house: 850,
}

type HomeSize = 'studio' | '1br' | '2br' | '3br' | 'house'

const HOME_SIZE_POOL: HomeSize[] = ['studio', '1br', '2br', '2br', '3br', '3br', 'house']

const CLIENT_DATA = [
  { name: 'Rick Adams', phone: '(949) 632-9557', email: 'radams@email.com' },
  { name: 'Maria Chen', phone: '(714) 555-0142', email: 'mchen@email.com' },
  { name: 'Tom Wilson', phone: '(310) 555-0177', email: 'twilson@email.com' },
  { name: 'Sarah Park', phone: '(657) 555-0201', email: 'spark@email.com' },
  { name: 'James Lee', phone: '(949) 555-0188', email: 'jlee@email.com' },
  { name: 'Anna Brooks', phone: '(562) 555-0234', email: 'abrooks@email.com' },
  { name: 'David Martinez', phone: '(213) 555-0156', email: 'dmartinez@email.com' },
  { name: 'Emily Johnson', phone: '(818) 555-0189', email: 'ejohnson@email.com' },
  { name: 'Michael Brown', phone: '(626) 555-0145', email: 'mbrown@email.com' },
  { name: 'Jessica Taylor', phone: '(323) 555-0167', email: 'jtaylor@email.com' },
  { name: 'Robert Davis', phone: '(714) 555-0198', email: 'rdavis@email.com' },
  { name: 'Linda Wilson', phone: '(949) 555-0211', email: 'lwilson@email.com' },
]

const REPEAT_CLIENTS = ['Rick Adams', 'Maria Chen', 'James Lee']

const ADDRESSES = [
  { from: '123 Oak St, Irvine, CA 92602', to: '456 Pine Ave, Anaheim, CA 92801' },
  { from: '789 Elm St, Newport Beach, CA 92660', to: '321 Oak Ave, Los Angeles, CA 90001' },
  { from: '555 Main St, Fullerton, CA 92831', to: '777 Park Rd, Brea, CA 92821' },
  { from: '100 First St, Tustin, CA 92780', to: '200 Second St, Yorba Linda, CA 92886' },
  { from: '300 Lake Dr, Irvine, CA 92612', to: '400 Ocean Blvd, Huntington Beach, CA 92648' },
  { from: '500 Hill Rd, Costa Mesa, CA 92626', to: '600 Valley St, Santa Ana, CA 92701' },
  { from: '700 Beach Blvd, Huntington Beach, CA 92647', to: '800 Surf Ave, Newport Beach, CA 92663' },
  { from: '900 Park St, Anaheim, CA 92805', to: '100 Garden Rd, Orange, CA 92868' },
  { from: '200 River Rd, Irvine, CA 92618', to: '300 Lake St, Mission Viejo, CA 92692' },
  { from: '400 Forest Ave, Laguna Hills, CA 92653', to: '500 Canyon Rd, Aliso Viejo, CA 92656' },
]

type LeadStatus = 'new' | 'contacted' | 'quoted' | 'booked' | 'lost'
type LeadSource = 'manual' | 'booking_page' | 'zapier' | 'phone'

const LEAD_DATA: Array<{
  name: string
  phone: string
  email: string
  homeSize: HomeSize
  status: LeadStatus
  source: LeadSource
}> = [
  { name: 'Karen Foster', phone: '(949) 555-0301', email: 'kfoster@email.com', homeSize: '2br', status: 'new', source: 'booking_page' },
  { name: 'Brian Nguyen', phone: '(714) 555-0312', email: 'bnguyen@email.com', homeSize: '1br', status: 'new', source: 'manual' },
  { name: 'Patricia Reyes', phone: '(310) 555-0323', email: 'preyes@email.com', homeSize: '3br', status: 'contacted', source: 'phone' },
  { name: 'Kevin Ortiz', phone: '(657) 555-0334', email: 'kortiz@email.com', homeSize: 'studio', status: 'contacted', source: 'booking_page' },
  { name: 'Nancy Scott', phone: '(213) 555-0345', email: 'nscott@email.com', homeSize: 'house', status: 'quoted', source: 'zapier' },
  { name: 'George Turner', phone: '(818) 555-0356', email: 'gturner@email.com', homeSize: '2br', status: 'quoted', source: 'manual' },
  { name: 'Betty Collins', phone: '(626) 555-0367', email: 'bcollins@email.com', homeSize: '1br', status: 'booked', source: 'booking_page' },
  { name: 'Raymond Diaz', phone: '(323) 555-0378', email: 'rdiaz@email.com', homeSize: '3br', status: 'lost', source: 'phone' },
  { name: 'Sandra Kim', phone: '(714) 555-0389', email: 'skim@email.com', homeSize: '2br', status: 'lost', source: 'manual' },
]

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)]
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 86_400_000)
}

function formatDay(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

type OrderStatus = 'new' | 'confirmed' | 'in_progress' | 'completed' | 'closed' | 'cancelled'

function resolveStatus(daysAgo: number, isCancelled: boolean): OrderStatus {
  if (isCancelled) return 'cancelled'
  if (daysAgo > 7) return Math.random() < 0.9 ? 'completed' : 'closed'
  if (daysAgo > 0) return Math.random() < 0.7 ? 'completed' : 'in_progress'
  return Math.random() < 0.5 ? 'confirmed' : 'new'
}

// Mirrors auth.service.ts's slug derivation. Duplicated rather than imported — this
// script runs standalone under tsx and pulling in the service layer for one string
// helper isn't worth the coupling.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function titleCaseFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

function generatePassword(): string {
  return crypto.randomBytes(9).toString('base64url')
}

export type Db = ReturnType<
  typeof drizzle<{
    clients: typeof clients
    crews: typeof crews
    invoices: typeof invoices
    leads: typeof leads
    orders: typeof orders
    subscriptions: typeof subscriptions
    tenants: typeof tenants
    users: typeof users
  }>
>

export interface ResolvedTenant {
  tenantId: string
  ownerId: string
  tenantName: string
  created: boolean
  generatedCredentials?: { email: string; password: string }
}

async function ensureUniqueSlug(db: Db, baseSlug: string): Promise<string> {
  const [taken] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, baseSlug)).limit(1)
  return taken ? `${baseSlug}-${crypto.randomBytes(2).toString('hex')}` : baseSlug
}

async function insertTenantOwnerAndSubscription(
  db: Db,
  companyName: string,
  slug: string,
  ownerEmail: string,
  passwordHash: string
): Promise<{ tenantId: string; tenantName: string; ownerId: string }> {
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 14)

  const [tenant] = await db
    .insert(tenants)
    .values({ name: companyName, slug, plan: 'trial', trial_ends_at: trialEndsAt })
    .returning()

  const [owner] = await db
    .insert(users)
    .values({
      tenant_id: tenant.id,
      email: ownerEmail,
      password_hash: passwordHash,
      role: 'owner',
      name: 'Demo Owner',
    })
    .returning()

  await db.insert(subscriptions).values({ tenant_id: tenant.id, plan: 'trial', status: 'trialing' })

  return { tenantId: tenant.id, tenantName: tenant.name, ownerId: owner.id }
}

export async function createTenantWithOwner(
  db: Db,
  companyName: string,
  ownerEmail: string,
  preferredSlug?: string
): Promise<ResolvedTenant> {
  const slug = await ensureUniqueSlug(db, preferredSlug ?? slugify(companyName))
  const password = generatePassword()
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  const { tenantId, tenantName, ownerId } = await insertTenantOwnerAndSubscription(
    db,
    companyName,
    slug,
    ownerEmail,
    passwordHash
  )

  return {
    tenantId,
    ownerId,
    tenantName,
    created: true,
    generatedCredentials: { email: ownerEmail, password },
  }
}

async function resolveTenantByEmail(db: Db, email: string): Promise<ResolvedTenant> {
  const [existing] = await db
    .select({ userId: users.id, tenantId: users.tenant_id, tenantName: tenants.name })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenant_id))
    .where(eq(users.email, email))
    .limit(1)
  if (existing) {
    return {
      tenantId: existing.tenantId,
      ownerId: existing.userId,
      tenantName: existing.tenantName,
      created: false,
    }
  }

  const localPart = email.split('@')[0]
  const companyName = titleCaseFromSlug(slugify(localPart)) || 'Demo Company'
  return createTenantWithOwner(db, companyName, email)
}

async function resolveTenantBySlug(db: Db, identifier: string): Promise<ResolvedTenant> {
  const slug = slugify(identifier)
  const [existingTenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1)

  if (!existingTenant) {
    const companyName = titleCaseFromSlug(slug) || slug
    return createTenantWithOwner(db, companyName, `owner@${slug}.demo.local`, slug)
  }

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.tenant_id, existingTenant.id))
    .limit(1)
  if (!owner) {
    throw new Error(`Tenant "${slug}" exists but has no user — cannot set created_by. Aborting.`)
  }
  return {
    tenantId: existingTenant.id,
    ownerId: owner.id,
    tenantName: existingTenant.name,
    created: false,
  }
}

// Accepts either a tenant slug or an owner email as the seed target. Resolves to an
// existing tenant if one matches (using one of its existing users as `created_by`), or
// creates a brand-new trial tenant + owner so a pilot company's demo data can be seeded
// before that company has ever registered.
export async function resolveTenant(db: Db, identifier: string): Promise<ResolvedTenant> {
  return identifier.includes('@') ? resolveTenantByEmail(db, identifier) : resolveTenantBySlug(db, identifier)
}

// Skips entirely if the tenant already has any leads — re-running the script (with or
// without --force) must never pile up duplicate leads on top of a prior seed run.
export async function seedLeads(db: Db, tenantId: string): Promise<number> {
  const [{ value: existingLeadCount }] = await db
    .select({ value: sql<number>`cast(count(*) as int)` })
    .from(leads)
    .where(eq(leads.tenant_id, tenantId))

  if (existingLeadCount > 0) {
    console.log(`📇 ${existingLeadCount} leads already exist — skipping lead seeding`)
    return 0
  }

  for (const lead of LEAD_DATA) {
    const address = pick(ADDRESSES)
    await db.insert(leads).values({
      tenant_id: tenantId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      from_address: address.from,
      to_address: lead.status === 'lost' ? null : address.to,
      home_size: lead.homeSize,
      status: lead.status,
      source: lead.source,
    })
  }
  console.log(`📇 Seeded ${LEAD_DATA.length} leads across pipeline stages`)
  return LEAD_DATA.length
}

export async function seedCrews(db: Db, tenantId: string): Promise<{ id: string }[]> {
  const existing = await db.select({ id: crews.id }).from(crews).where(eq(crews.tenant_id, tenantId))
  if (existing.length > 0) {
    console.log(`📋 Found ${existing.length} existing crews`)
    return existing
  }

  const created = await db
    .insert(crews)
    .values([
      { tenant_id: tenantId, name: 'Team A', truck_label: 'Truck #3', active: true },
      { tenant_id: tenantId, name: 'Team B', truck_label: 'Truck #7', active: true },
    ])
    .returning({ id: crews.id })
  console.log(`📋 Created 2 crews`)
  return created
}

export async function seedClients(db: Db, tenantId: string): Promise<Map<string, string>> {
  const clientIdByName = new Map<string, string>()
  let clientsCreated = 0
  let clientsExisted = 0
  for (const c of CLIENT_DATA) {
    const [existing] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.tenant_id, tenantId), eq(clients.phone, c.phone)))
      .limit(1)
    if (existing) {
      clientIdByName.set(c.name, existing.id)
      clientsExisted++
      continue
    }
    const [created] = await db
      .insert(clients)
      .values({ tenant_id: tenantId, name: c.name, phone: c.phone, email: c.email })
      .returning({ id: clients.id })
    clientIdByName.set(c.name, created.id)
    clientsCreated++
  }
  console.log(
    `👥 ${CLIENT_DATA.length} clients ready (${clientsCreated} created, ${clientsExisted} already existed)`
  )
  return clientIdByName
}

// Picks TARGET_ORDERS move dates spread across the trailing WINDOW_DAYS window, capped
// at `capacityPerDay` per day, then assigns each a client name (repeat clients weighted
// in, then shuffled).
export function planOrders(capacityPerDay: number): { moveDates: Date[]; clientNamePlan: string[] } {
  const today = startOfUtcDay(new Date())
  const windowStart = addDays(today, -WINDOW_DAYS)

  const usedPerDay = new Map<string, number>()
  const moveDates: Date[] = []
  let guard = 0
  while (moveDates.length < TARGET_ORDERS && guard < 100_000) {
    guard++
    const day = addDays(windowStart, randomInt(0, WINDOW_DAYS))
    const key = toIsoDate(day)
    const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6
    if (Math.random() > (isWeekend ? 0.4 : 0.7)) continue
    if ((usedPerDay.get(key) ?? 0) >= capacityPerDay) continue
    usedPerDay.set(key, (usedPerDay.get(key) ?? 0) + 1)
    moveDates.push(day)
  }
  moveDates.sort((a, b) => a.getTime() - b.getTime())

  const clientNamePlan: string[] = []
  for (const name of REPEAT_CLIENTS) {
    const n = randomInt(2, 3)
    for (let i = 0; i < n; i++) clientNamePlan.push(name)
  }
  const allNames = CLIENT_DATA.map((c) => c.name)
  while (clientNamePlan.length < moveDates.length) clientNamePlan.push(pick(allNames))
  clientNamePlan.length = moveDates.length
  shuffle(clientNamePlan)

  return { moveDates, clientNamePlan }
}

interface SeedOrdersResult {
  ordersCreated: number
  cancelledCount: number
  invoicesCreated: number
}

// expires_at is always computed from *now* (seed time), not the historical move/sent
// date, so every seeded invoice's share link is live right after the script finishes,
// regardless of how far in the past its order was backdated.
async function seedInvoiceForOrder(
  db: Db,
  tenantId: string,
  orderId: string,
  moveDate: Date,
  invoiceNumber: string
): Promise<void> {
  const inSentGroup = Math.random() < 0.8
  let invStatus: 'draft' | 'sent' | 'paid' = 'draft'
  let sentAt: Date | null = null
  let paidAt: Date | null = null
  if (inSentGroup) {
    const paid = Math.random() < 0.75
    invStatus = paid ? 'paid' : 'sent'
    sentAt = addDays(moveDate, 1)
    if (paid) paidAt = addDays(moveDate, randomInt(2, 10))
  }
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVOICE_EXPIRY_DAYS)

  await db.insert(invoices).values({
    tenant_id: tenantId,
    order_id: orderId,
    number: invoiceNumber,
    status: invStatus,
    sent_at: sentAt,
    paid_at: paidAt,
    expires_at: expiresAt,
  })
}

function buildOrderValues(
  tenantId: string,
  ownerId: string,
  tenantCrews: { id: string }[],
  clientId: string | null,
  moveDate: Date,
  status: OrderStatus
): typeof orders.$inferInsert {
  const homeSize = pick(HOME_SIZE_POOL)
  const basePrice = BASE_RATES[homeSize]
  const packing = Math.random() < PACKING_RATE
  const address = pick(ADDRESSES)

  return {
    tenant_id: tenantId,
    client_id: clientId,
    crew_id: pick(tenantCrews).id,
    created_by: ownerId,
    status,
    move_date: toIsoDate(moveDate),
    from_address: address.from,
    to_address: address.to,
    from_floor: randomInt(1, 4),
    to_floor: randomInt(1, 4),
    from_elevator: Math.random() < 0.5,
    to_elevator: Math.random() < 0.5,
    home_size: homeSize,
    packing,
    base_price: basePrice,
    total_price: basePrice + (packing ? PACKING_FEE : 0),
    created_at: addDays(moveDate, -randomInt(1, 14)),
  }
}

interface SeedOneOrderResult {
  cancelled: boolean
  invoiceCreated: boolean
}

async function seedOneOrder(
  db: Db,
  tenantId: string,
  ownerId: string,
  tenantCrews: { id: string }[],
  clientId: string | null,
  moveDate: Date,
  today: Date,
  invoiceNumber: string
): Promise<SeedOneOrderResult> {
  const isCancelled = Math.random() < CANCEL_RATE
  const status = resolveStatus(daysBetween(today, moveDate), isCancelled)

  const [order] = await db
    .insert(orders)
    .values(buildOrderValues(tenantId, ownerId, tenantCrews, clientId, moveDate, status))
    .returning({ id: orders.id })

  if (status !== 'completed' && status !== 'closed') {
    return { cancelled: status === 'cancelled', invoiceCreated: false }
  }

  await seedInvoiceForOrder(db, tenantId, order.id, moveDate, invoiceNumber)
  return { cancelled: false, invoiceCreated: true }
}

async function countInvoices(db: Db, tenantId: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: sql<number>`cast(count(*) as int)` })
    .from(invoices)
    .where(eq(invoices.tenant_id, tenantId))
  return value
}

// Invoice numbering starts from count(*) over invoices for this tenant — the same
// formula the app itself uses (services/invoices.service.ts) — so seeded and
// app-created invoice numbers can't collide.
function logProgress(current: number, total: number): void {
  if (current % 10 === 0 || current === total) {
    console.log(`  Progress: ${current}/${total}...`)
  }
}

export async function seedOrdersAndInvoices(
  db: Db,
  tenantId: string,
  ownerId: string,
  tenantCrews: { id: string }[],
  clientIdByName: Map<string, string>,
  moveDates: Date[],
  clientNamePlan: string[]
): Promise<SeedOrdersResult> {
  const today = startOfUtcDay(new Date())
  let invoiceSeq = (await countInvoices(db, tenantId)) + 1000 + 1

  let ordersCreated = 0
  let cancelledCount = 0
  let invoicesCreated = 0

  for (let i = 0; i < moveDates.length; i++) {
    const clientId = clientIdByName.get(clientNamePlan[i]) ?? null
    const result = await seedOneOrder(db, tenantId, ownerId, tenantCrews, clientId, moveDates[i], today, `INV-${invoiceSeq}`)
    ordersCreated++
    if (result.cancelled) cancelledCount++
    if (result.invoiceCreated) {
      invoicesCreated++
      invoiceSeq++
    }
    logProgress(i + 1, moveDates.length)
  }

  return { ordersCreated, cancelledCount, invoicesCreated }
}

function parseArgs(): { identifier: string; force: boolean } {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const identifier = args.find((a) => !a.startsWith('--'))
  if (!identifier) {
    console.error(
      'Usage: npm run seed -- <tenant-slug-or-owner-email> [--force]\n' +
        '  Seeds demo data into an existing tenant, or creates a new trial tenant + owner if none matches.'
    )
    process.exit(1)
  }
  return { identifier, force }
}

function logResolvedTenant(resolved: ResolvedTenant): void {
  const label = `${resolved.tenantName}" (${resolved.tenantId.slice(0, 8)}...)`
  if (!resolved.created) {
    console.log(`🏢 Seeding into existing tenant "${label}`)
    return
  }
  console.log(`🏢 Created new tenant "${label}`)
  if (resolved.generatedCredentials) {
    console.log(
      `   Owner login: ${resolved.generatedCredentials.email} / ${resolved.generatedCredentials.password}`
    )
  }
}

// Throws rather than exiting directly so the caller's try/finally still closes the pool.
async function assertOrderCapacity(db: Db, tenantId: string, force: boolean): Promise<void> {
  const existingOrderCount = (
    await db.select({ id: orders.id }).from(orders).where(eq(orders.tenant_id, tenantId))
  ).length
  if (existingOrderCount > 20 && !force) {
    throw new Error(
      `${existingOrderCount} orders already exist for this tenant. ` +
        `Re-run with --force to add ${TARGET_ORDERS} more.`
    )
  }
}

function printSummary(result: SeedOrdersResult, moveDates: Date[]): void {
  const cancelPct =
    result.ordersCreated > 0 ? Math.round((result.cancelledCount / result.ordersCreated) * 100) : 0
  console.log('✅ Seed complete!')
  console.log(`   Orders created: ${result.ordersCreated}`)
  console.log(`   Cancelled: ${result.cancelledCount} (${cancelPct}%)`)
  console.log(`   Invoices created: ${result.invoicesCreated}`)
  console.log(`   Clients: ${CLIENT_DATA.length} (${REPEAT_CLIENTS.length} with repeat orders)`)
  console.log(`   Date range: ${formatDay(moveDates[0])} — ${formatDay(moveDates[moveDates.length - 1])}`)
  console.log('🎉 Ready to test AI analytics!')
}

function connectDb(): { pool: pg.Pool; db: Db } {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }
  const pool = new pg.Pool({ connectionString })
  const db = drizzle(pool, {
    schema: { clients, crews, invoices, leads, orders, subscriptions, tenants, users },
  })
  return { pool, db }
}

async function main(): Promise<void> {
  const { identifier, force } = parseArgs()
  const { pool, db } = connectDb()

  try {
    const resolved = await resolveTenant(db, identifier)
    logResolvedTenant(resolved)

    const tenantCrews = await seedCrews(db, resolved.tenantId)
    const clientIdByName = await seedClients(db, resolved.tenantId)
    await seedLeads(db, resolved.tenantId)
    await assertOrderCapacity(db, resolved.tenantId, force)

    const capacityPerDay = Math.min(2, tenantCrews.length)
    const { moveDates, clientNamePlan } = planOrders(capacityPerDay)
    console.log(`📦 Generating ${moveDates.length} orders across ${WINDOW_DAYS} days...`)

    const result = await seedOrdersAndInvoices(
      db,
      resolved.tenantId,
      resolved.ownerId,
      tenantCrews,
      clientIdByName,
      moveDates,
      clientNamePlan
    )
    printSummary(result, moveDates)
  } finally {
    await pool.end()
  }
}

// Only auto-run when executed directly (`npm run seed` / `tsx scripts/seed-analytics.ts`),
// not when imported by tests for its exported helpers.
const isMainModule = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]
if (isMainModule) {
  main().catch((err: unknown) => {
    console.error('seed failed:', err)
    process.exit(1)
  })
}
