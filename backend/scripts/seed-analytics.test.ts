import { beforeEach, describe, expect, it } from 'vitest'
import bcrypt from 'bcryptjs'
import { eq, sql } from 'drizzle-orm'

// resolveTenant/seedLeads/seedOrdersAndInvoices do real inserts and count(*) queries
// against tenants/users/leads/invoices — too DB-shaped to fake without re-implementing
// the logic under test, so this runs against a real local Postgres instance (same
// pattern as dashboard.service.test.ts). Skips instead of failing CI when one isn't
// reachable.
const TEST_DATABASE_URL =
  process.env.SEED_TEST_DATABASE_URL ?? 'postgresql://localhost:5432/movingdesk_test'

const { Pool } = await import('pg')
const { drizzle } = await import('drizzle-orm/node-postgres')
const schemaModule = await import('../src/db/schema.js')
const pool = new Pool({ connectionString: TEST_DATABASE_URL })
const db = drizzle(pool, { schema: schemaModule })
const { tenants, users, subscriptions, crews, clients, leads, invoices, orders } = schemaModule

const {
  slugify,
  titleCaseFromSlug,
  resolveTenant,
  createTenantWithOwner,
  seedLeads,
  seedCrews,
  seedClients,
  seedOrdersAndInvoices,
  planOrders,
} = await import('./seed-analytics.js')

let dbAvailable = true
try {
  await db.execute(sql`select 1`)
} catch {
  dbAvailable = false
  // eslint-disable-next-line no-console
  console.warn(
    `[seed-analytics.test.ts] skipping — no Postgres reachable at ${TEST_DATABASE_URL}. ` +
      'Run migrations against a local test DB to enable these tests.'
  )
}

describe('slugify / titleCaseFromSlug (pure)', () => {
  it('normalises spaces, punctuation and casing into a URL-safe slug', () => {
    expect(slugify('Acme Movers & Storage!')).toBe('acme-movers-storage')
    expect(slugify('  leading and trailing  ')).toBe('leading-and-trailing')
  })

  it('reconstructs a readable company name from a slug', () => {
    expect(titleCaseFromSlug('acme-movers')).toBe('Acme Movers')
    expect(titleCaseFromSlug('bay-area-moving-co')).toBe('Bay Area Moving Co')
  })
})

describe.skipIf(!dbAvailable)('seed-analytics (real Postgres)', () => {
  beforeEach(async () => {
    await db.delete(invoices)
    await db.delete(orders)
    await db.delete(leads)
    await db.delete(clients)
    await db.delete(crews)
    await db.delete(subscriptions)
    await db.delete(users)
    await db.delete(tenants)
  })

  describe('resolveTenant', () => {
    it('creates a brand-new trial tenant + hashed-password owner when the slug does not exist', async () => {
      const resolved = await resolveTenant(db, 'brand-new-movers')
      expect(resolved.created).toBe(true)
      expect(resolved.generatedCredentials).toBeDefined()

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, resolved.tenantId))
      expect(tenant.slug).toBe('brand-new-movers')
      expect(tenant.plan).toBe('trial')

      const [owner] = await db.select().from(users).where(eq(users.id, resolved.ownerId))
      expect(owner.role).toBe('owner')
      expect(owner.tenant_id).toBe(resolved.tenantId)
      const matches = await bcrypt.compare(resolved.generatedCredentials!.password, owner.password_hash)
      expect(matches).toBe(true)

      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenant_id, resolved.tenantId))
      expect(sub.status).toBe('trialing')
    })

    it('seeds into the existing tenant (created: false) when the slug already exists', async () => {
      const first = await resolveTenant(db, 'existing-movers')
      const second = await resolveTenant(db, 'existing-movers')

      expect(second.created).toBe(false)
      expect(second.tenantId).toBe(first.tenantId)
      expect(second.ownerId).toBe(first.ownerId)

      const allTenants = await db.select().from(tenants).where(eq(tenants.slug, 'existing-movers'))
      expect(allTenants).toHaveLength(1)
    })

    it('resolves an existing tenant by owner email instead of slug', async () => {
      const created = await createTenantWithOwner(db, 'Owner Email Co', 'owner@owneremailco.com')
      const resolved = await resolveTenant(db, 'owner@owneremailco.com')
      expect(resolved.created).toBe(false)
      expect(resolved.tenantId).toBe(created.tenantId)
      expect(resolved.ownerId).toBe(created.ownerId)
    })

    it('creates a new tenant from an email identifier that matches no existing user', async () => {
      const resolved = await resolveTenant(db, 'newpilot@somecompany.com')
      expect(resolved.created).toBe(true)
      const [owner] = await db.select().from(users).where(eq(users.id, resolved.ownerId))
      expect(owner.email).toBe('newpilot@somecompany.com')
    })

    it('throws instead of silently mis-assigning created_by when a tenant exists with no users', async () => {
      await db.insert(tenants).values({ name: 'Orphan Co', slug: 'orphan-co', plan: 'trial' })
      await expect(resolveTenant(db, 'orphan-co')).rejects.toThrow(/no user/i)
    })
  })

  describe('seedLeads', () => {
    it('seeds leads across every pipeline status for a tenant with none yet', async () => {
      const resolved = await resolveTenant(db, 'lead-demo-co')
      const count = await seedLeads(db, resolved.tenantId)
      expect(count).toBeGreaterThan(0)

      const rows = await db.select().from(leads).where(eq(leads.tenant_id, resolved.tenantId))
      expect(rows).toHaveLength(count)
      const statuses = new Set(rows.map((r) => r.status))
      expect(statuses).toEqual(new Set(['new', 'contacted', 'quoted', 'booked', 'lost']))
    })

    it('is a no-op on a second call so re-running the script never duplicates leads', async () => {
      const resolved = await resolveTenant(db, 'lead-demo-co-2')
      const first = await seedLeads(db, resolved.tenantId)
      const second = await seedLeads(db, resolved.tenantId)
      expect(second).toBe(0)

      const rows = await db.select().from(leads).where(eq(leads.tenant_id, resolved.tenantId))
      expect(rows).toHaveLength(first)
    })

    it('never leaks leads into another tenant', async () => {
      const a = await resolveTenant(db, 'tenant-a-leads')
      const b = await resolveTenant(db, 'tenant-b-leads')
      await seedLeads(db, a.tenantId)

      const bLeads = await db.select().from(leads).where(eq(leads.tenant_id, b.tenantId))
      expect(bLeads).toHaveLength(0)
    })
  })

  describe('seedOrdersAndInvoices', () => {
    it('sets expires_at in the future on every seeded invoice, even for far-backdated moves', async () => {
      const resolved = await resolveTenant(db, 'invoice-expiry-co')
      const tenantCrews = await seedCrews(db, resolved.tenantId)
      const clientIdByName = await seedClients(db, resolved.tenantId)

      // 20 moves 60 days in the past — comfortably enough for at least one
      // completed/closed order (and therefore invoice) despite the randomness in
      // resolveStatus/CANCEL_RATE.
      const moveDates = Array.from({ length: 20 }, (_, i) => {
        const d = new Date()
        d.setUTCDate(d.getUTCDate() - 60 - i)
        return d
      })
      const clientNamePlan = Array.from({ length: 20 }, () => 'Rick Adams')

      await seedOrdersAndInvoices(
        db,
        resolved.tenantId,
        resolved.ownerId,
        tenantCrews,
        clientIdByName,
        moveDates,
        clientNamePlan
      )

      const createdInvoices = await db.select().from(invoices).where(eq(invoices.tenant_id, resolved.tenantId))
      expect(createdInvoices.length).toBeGreaterThan(0)
      const now = new Date()
      for (const invoice of createdInvoices) {
        expect(invoice.expires_at).not.toBeNull()
        expect(invoice.expires_at!.getTime()).toBeGreaterThan(now.getTime())
      }
    })

    it('numbers new invoices starting after any that already exist, avoiding collisions on re-run', async () => {
      const resolved = await resolveTenant(db, 'invoice-numbering-co')
      const tenantCrews = await seedCrews(db, resolved.tenantId)
      const clientIdByName = await seedClients(db, resolved.tenantId)

      const moveDates = Array.from({ length: 15 }, (_, i) => {
        const d = new Date()
        d.setUTCDate(d.getUTCDate() - 90 - i)
        return d
      })
      const clientNamePlan = Array.from({ length: 15 }, () => 'Rick Adams')

      await seedOrdersAndInvoices(
        db,
        resolved.tenantId,
        resolved.ownerId,
        tenantCrews,
        clientIdByName,
        moveDates,
        clientNamePlan
      )
      const afterFirstRun = await db
        .select()
        .from(invoices)
        .where(eq(invoices.tenant_id, resolved.tenantId))
      expect(afterFirstRun.length).toBeGreaterThan(0)

      // Simulate re-running the script against the same tenant.
      const moveDatesRound2 = Array.from({ length: 15 }, (_, i) => {
        const d = new Date()
        d.setUTCDate(d.getUTCDate() - 45 - i)
        return d
      })
      await seedOrdersAndInvoices(
        db,
        resolved.tenantId,
        resolved.ownerId,
        tenantCrews,
        clientIdByName,
        moveDatesRound2,
        clientNamePlan
      )

      const afterSecondRun = await db
        .select()
        .from(invoices)
        .where(eq(invoices.tenant_id, resolved.tenantId))
      const numbers = afterSecondRun.map((i) => i.number)
      expect(new Set(numbers).size).toBe(numbers.length)
    })
  })

  describe('planOrders', () => {
    it('produces one client-name entry per generated move date', () => {
      const { moveDates, clientNamePlan } = planOrders(2)
      expect(clientNamePlan).toHaveLength(moveDates.length)
    })
  })
})
