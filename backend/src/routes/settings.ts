import { Hono } from 'hono'
import { z } from 'zod'
import { uploadLogo } from '../lib/r2.js'
import { authMiddleware, requireOwner } from '../middleware/auth.js'
import { getSettings, updateSettings } from '../services/settings.service.js'
import type { AppVariables, TenantSettings } from '../types/index.js'

const patchSettingsSchema = z.object({
  companyName: z.string().min(2).max(255).optional(),
  logoUrl: z.string().url().nullable().optional(),
  timezone: z.string().optional(),
  baseRates: z.record(z.string(), z.number().nonnegative()).optional(),
})

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const settingsRouter = new Hono<{ Variables: AppVariables }>()

settingsRouter.get('/', authMiddleware, requireOwner, async (c) => {
  const tenant = await getSettings(c.get('tenantId'))
  if (!tenant) return c.json({ error: 'Settings not found' }, 404)
  const settings = (tenant.settings ?? {}) as Partial<TenantSettings>
  return c.json({
    companyName: tenant.name,
    logoUrl: tenant.logo_url,
    timezone: settings.timezone ?? 'America/New_York',
    baseRates: settings.baseRates ?? {},
  })
})

settingsRouter.patch('/', authMiddleware, requireOwner, async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Validation failed' }, 400)
  }
  const result = patchSettingsSchema.safeParse(body)
  if (!result.success) return c.json({ error: 'Validation failed' }, 400)

  const d = result.data
  const updated = await updateSettings(c.get('tenantId'), {
    name: d.companyName,
    logo_url: d.logoUrl,
    timezone: d.timezone,
    baseRates: d.baseRates,
  })
  if (!updated) return c.json({ error: 'Settings not found' }, 404)

  const settings = (updated.settings ?? {}) as Partial<TenantSettings>
  return c.json({
    companyName: updated.name,
    logoUrl: updated.logo_url,
    timezone: settings.timezone ?? 'America/New_York',
    baseRates: settings.baseRates ?? {},
  })
})

settingsRouter.post('/logo', authMiddleware, requireOwner, async (c) => {
  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'Invalid form data' }, 400)
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return c.json({ error: 'File required' }, 400)
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return c.json({ error: 'Invalid file type. Allowed: jpeg, png, webp, gif' }, 400)
  }

  const url = await uploadLogo(file, c.get('tenantId'))
  return c.json({ url }, 201)
})

export default settingsRouter
