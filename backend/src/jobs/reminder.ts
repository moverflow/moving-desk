import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, orders, tenants } from '../db/schema.js'
import { sendMoveReminderEmail } from '../lib/email.js'
import { logger } from '../lib/logger.js'
import type { TenantSettings } from '../types/index.js'

function formatMoveDate(moveDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${moveDate}T00:00:00Z`))
}

function tomorrowDate(): string {
  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  return tomorrow.toISOString().split('T')[0]
}

export async function sendDailyReminders(): Promise<void> {
  logger.info('Running daily reminder job...')

  const target = tomorrowDate()

  const ordersToRemind = await db
    .select({
      orderId: orders.id,
      tenantId: orders.tenant_id,
      moveDate: orders.move_date,
      fromAddress: orders.from_address,
      toAddress: orders.to_address,
      clientId: orders.client_id,
    })
    .from(orders)
    .where(
      and(
        eq(orders.move_date, target),
        eq(orders.status, 'confirmed'),
        eq(orders.reminder_sent, false),
      ),
    )

  logger.info(`Found ${ordersToRemind.length} orders to remind`)

  for (const order of ordersToRemind) {
    try {
      if (!order.clientId) continue

      const [client] = await db
        .select({ name: clients.name, email: clients.email })
        .from(clients)
        .where(and(eq(clients.id, order.clientId), eq(clients.tenant_id, order.tenantId)))
        .limit(1)

      if (!client?.email) continue

      const [tenant] = await db
        .select({ name: tenants.name, settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.id, order.tenantId))
        .limit(1)

      if (!tenant) continue

      const settings = (tenant.settings ?? {}) as Partial<TenantSettings>

      await sendMoveReminderEmail({
        to: client.email,
        clientName: client.name,
        companyName: tenant.name,
        companyPhone: settings.phone ?? null,
        moveDate: formatMoveDate(order.moveDate),
        fromAddress: order.fromAddress,
        toAddress: order.toAddress,
      })

      // Mark as reminded only after a successful send to prevent duplicates.
      await db
        .update(orders)
        .set({ reminder_sent: true })
        .where(and(eq(orders.id, order.orderId), eq(orders.tenant_id, order.tenantId)))

      logger.info({ orderId: order.orderId, clientEmail: client.email }, 'Reminder sent successfully')
    } catch (err) {
      logger.error({ err, orderId: order.orderId }, 'Failed to send reminder for order')
      // Continue with next order — don't stop the whole job.
    }
  }

  logger.info('Daily reminder job complete')
}
