import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { orderFiles } from '../db/schema.js'

export const MAX_FILES_PER_ORDER = 20

export async function countOrderFiles(tenantId: string, orderId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(orderFiles)
    .where(and(eq(orderFiles.order_id, orderId), eq(orderFiles.tenant_id, tenantId)))
  return row?.value ?? 0
}

export async function listOrderFiles(tenantId: string, orderId: string) {
  return db
    .select()
    .from(orderFiles)
    .where(and(eq(orderFiles.order_id, orderId), eq(orderFiles.tenant_id, tenantId)))
    .orderBy(desc(orderFiles.created_at))
}

export async function createOrderFileRecord(params: {
  tenantId: string
  orderId: string
  name: string
  url: string
  key: string
  size: number
  mimeType: string
  uploadedBy: string
}) {
  const [file] = await db
    .insert(orderFiles)
    .values({
      tenant_id: params.tenantId,
      order_id: params.orderId,
      name: params.name,
      url: params.url,
      key: params.key,
      size: params.size,
      mime_type: params.mimeType,
      uploaded_by: params.uploadedBy,
    })
    .returning()
  return file
}

export async function getOrderFileById(tenantId: string, orderId: string, fileId: string) {
  const rows = await db
    .select()
    .from(orderFiles)
    .where(
      and(
        eq(orderFiles.id, fileId),
        eq(orderFiles.order_id, orderId),
        eq(orderFiles.tenant_id, tenantId),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

export async function deleteOrderFileRecord(
  tenantId: string,
  orderId: string,
  fileId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(orderFiles)
    .where(
      and(
        eq(orderFiles.id, fileId),
        eq(orderFiles.order_id, orderId),
        eq(orderFiles.tenant_id, tenantId),
      ),
    )
    .returning({ id: orderFiles.id })
  return deleted.length > 0
}
