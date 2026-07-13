import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { and, eq } from 'drizzle-orm'
import pg from 'pg'
import { clients, crews, invoices, orders, users } from '../src/db/schema.js'

const TENANT_ID = '33b29222-392a-408b-a0c3-115336acd98f'
const TARGET_ORDERS = 42
const CANCEL_RATE = 0.15
const PACKING_RATE = 0.25
const PACKING_FEE = 120
const WINDOW_DAYS = 90

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

async function main(): Promise<void> {
  const force = process.argv.includes('--force')
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString })
  const db = drizzle(pool, { schema: { clients, crews, invoices, orders, users } })

  console.log(`🌱 Starting seed for tenant: ${TENANT_ID.slice(0, 8)}...`)

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.tenant_id, TENANT_ID))
    .limit(1)
  if (!owner) {
    console.error('No user found for this tenant — cannot set created_by. Aborting.')
    await pool.end()
    process.exit(1)
  }

  let tenantCrews = await db
    .select({ id: crews.id })
    .from(crews)
    .where(eq(crews.tenant_id, TENANT_ID))
  if (tenantCrews.length === 0) {
    tenantCrews = await db
      .insert(crews)
      .values([
        { tenant_id: TENANT_ID, name: 'Team A', truck_label: 'Truck #3', active: true },
        { tenant_id: TENANT_ID, name: 'Team B', truck_label: 'Truck #7', active: true },
      ])
      .returning({ id: crews.id })
    console.log(`📋 Created 2 crews`)
  } else {
    console.log(`📋 Found ${tenantCrews.length} existing crews`)
  }

  const clientIdByName = new Map<string, string>()
  let clientsCreated = 0
  let clientsExisted = 0
  for (const c of CLIENT_DATA) {
    const [existing] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.tenant_id, TENANT_ID), eq(clients.phone, c.phone)))
      .limit(1)
    if (existing) {
      clientIdByName.set(c.name, existing.id)
      clientsExisted++
      continue
    }
    const [created] = await db
      .insert(clients)
      .values({ tenant_id: TENANT_ID, name: c.name, phone: c.phone, email: c.email })
      .returning({ id: clients.id })
    clientIdByName.set(c.name, created.id)
    clientsCreated++
  }
  console.log(
    `👥 ${CLIENT_DATA.length} clients ready (${clientsCreated} created, ${clientsExisted} already existed)`
  )

  const existingOrderCount = (
    await db.select({ id: orders.id }).from(orders).where(eq(orders.tenant_id, TENANT_ID))
  ).length
  if (existingOrderCount > 20 && !force) {
    console.error(
      `⚠️  ${existingOrderCount} orders already exist for this tenant. ` +
        `Re-run with --force to add ${TARGET_ORDERS} more.`
    )
    await pool.end()
    process.exit(1)
  }

  const today = startOfUtcDay(new Date())
  const windowStart = addDays(today, -WINDOW_DAYS)
  const capacityPerDay = Math.min(2, tenantCrews.length)

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

  console.log(`📦 Generating ${moveDates.length} orders across ${WINDOW_DAYS} days...`)

  let ordersCreated = 0
  let cancelledCount = 0
  let invoicesCreated = 0
  let invoiceSeq = existingOrderCount + 1000 + 1

  for (let i = 0; i < moveDates.length; i++) {
    const moveDate = moveDates[i]
    const daysAgo = daysBetween(today, moveDate)
    const isCancelled = Math.random() < CANCEL_RATE
    const status = resolveStatus(daysAgo, isCancelled)
    if (status === 'cancelled') cancelledCount++

    const homeSize = pick(HOME_SIZE_POOL)
    const basePrice = BASE_RATES[homeSize]
    const packing = Math.random() < PACKING_RATE
    const totalPrice = basePrice + (packing ? PACKING_FEE : 0)
    const address = pick(ADDRESSES)
    const createdAt = addDays(moveDate, -randomInt(1, 14))

    const [order] = await db
      .insert(orders)
      .values({
        tenant_id: TENANT_ID,
        client_id: clientIdByName.get(clientNamePlan[i]) ?? null,
        crew_id: pick(tenantCrews).id,
        created_by: owner.id,
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
        total_price: totalPrice,
        created_at: createdAt,
      })
      .returning({ id: orders.id })
    ordersCreated++

    if (status === 'completed' || status === 'closed') {
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
      await db.insert(invoices).values({
        tenant_id: TENANT_ID,
        order_id: order.id,
        number: `INV-${invoiceSeq}`,
        status: invStatus,
        sent_at: sentAt,
        paid_at: paidAt,
      })
      invoiceSeq++
      invoicesCreated++
    }

    if ((i + 1) % 10 === 0 || i + 1 === moveDates.length) {
      console.log(`  Progress: ${i + 1}/${moveDates.length}...`)
    }
  }

  const cancelPct = Math.round((cancelledCount / ordersCreated) * 100)
  const rangeStart = formatDay(moveDates[0])
  const rangeEnd = formatDay(moveDates[moveDates.length - 1])

  console.log('✅ Seed complete!')
  console.log(`   Orders created: ${ordersCreated}`)
  console.log(`   Cancelled: ${cancelledCount} (${cancelPct}%)`)
  console.log(`   Invoices created: ${invoicesCreated}`)
  console.log(`   Clients: ${CLIENT_DATA.length} (${REPEAT_CLIENTS.length} with repeat orders)`)
  console.log(`   Date range: ${rangeStart} — ${rangeEnd}`)
  console.log('🎉 Ready to test AI analytics!')

  await pool.end()
}

main().catch((err: unknown) => {
  console.error('seed failed:', err)
  process.exit(1)
})
