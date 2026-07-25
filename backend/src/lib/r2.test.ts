import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const R2_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
] as const

const FULL_R2 = {
  R2_ACCOUNT_ID: 'test-account',
  R2_ACCESS_KEY_ID: 'test-key-id',
  R2_SECRET_ACCESS_KEY: 'test-secret',
  R2_BUCKET_NAME: 'test-bucket',
  R2_PUBLIC_URL: 'https://pub.example.com',
}

// r2.ts reads env at call time but builds its S3 client at module scope, so each
// case re-imports the module against a freshly mocked env.
async function loadR2(overrides: Record<string, string>) {
  vi.doMock('./env.js', () => ({
    env: {
      NODE_ENV: 'development',
      BACKEND_URL: 'http://localhost:3000',
      ...FULL_R2,
      ...overrides,
    },
  }))
  vi.doMock('./logger.js', () => ({
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  }))
  return import('./r2.js')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('./env.js')
  vi.doUnmock('./logger.js')
})

describe('missingR2Vars', () => {
  it('returns an empty list when every R2 var is set', async () => {
    const { missingR2Vars } = await loadR2({})
    expect(missingR2Vars()).toEqual([])
  })

  it('names the single var that is empty', async () => {
    const { missingR2Vars } = await loadR2({ R2_BUCKET_NAME: '' })
    expect(missingR2Vars()).toEqual(['R2_BUCKET_NAME'])
  })

  it('names every missing var, not just the first', async () => {
    const { missingR2Vars } = await loadR2({ R2_ACCOUNT_ID: '', R2_PUBLIC_URL: '' })
    expect(missingR2Vars()).toEqual(['R2_ACCOUNT_ID', 'R2_PUBLIC_URL'])
  })
})

describe('isR2Configured', () => {
  it('is true when every R2 var is set', async () => {
    const { isR2Configured } = await loadR2({})
    expect(isR2Configured()).toBe(true)
  })

  it.each(R2_VARS)('is false when %s is empty', async (name) => {
    const { isR2Configured } = await loadR2({ [name]: '' })
    expect(isR2Configured()).toBe(false)
  })
})

describe('assertStorageConfigured', () => {
  it('throws in production when an R2 var is missing', async () => {
    const { assertStorageConfigured } = await loadR2({
      NODE_ENV: 'production',
      R2_BUCKET_NAME: '',
    })
    expect(() => assertStorageConfigured()).toThrow(/R2 storage is not configured/)
  })

  it.each(R2_VARS)('throws in production when %s alone is missing', async (name) => {
    const { assertStorageConfigured } = await loadR2({ NODE_ENV: 'production', [name]: '' })
    expect(() => assertStorageConfigured()).toThrow(new RegExp(`Missing env vars: ${name}`))
  })

  it('lists every missing var in the error message', async () => {
    const { assertStorageConfigured } = await loadR2({
      NODE_ENV: 'production',
      R2_ACCOUNT_ID: '',
      R2_SECRET_ACCESS_KEY: '',
    })
    expect(() => assertStorageConfigured()).toThrow(
      /Missing env vars: R2_ACCOUNT_ID, R2_SECRET_ACCESS_KEY/,
    )
  })

  it('explains why the process refuses to start', async () => {
    const { assertStorageConfigured } = await loadR2({ NODE_ENV: 'production', R2_PUBLIC_URL: '' })
    expect(() => assertStorageConfigured()).toThrow(/lost on the next deploy/)
  })

  it('does not throw in production when R2 is fully configured', async () => {
    const { assertStorageConfigured } = await loadR2({ NODE_ENV: 'production' })
    expect(() => assertStorageConfigured()).not.toThrow()
  })

  it('does not throw in development with no R2 vars set', async () => {
    const { assertStorageConfigured } = await loadR2({
      NODE_ENV: 'development',
      R2_ACCOUNT_ID: '',
      R2_ACCESS_KEY_ID: '',
      R2_SECRET_ACCESS_KEY: '',
      R2_BUCKET_NAME: '',
      R2_PUBLIC_URL: '',
    })
    expect(() => assertStorageConfigured()).not.toThrow()
  })

  it('does not throw in test with no R2 vars set', async () => {
    const { assertStorageConfigured } = await loadR2({
      NODE_ENV: 'test',
      R2_ACCOUNT_ID: '',
      R2_BUCKET_NAME: '',
    })
    expect(() => assertStorageConfigured()).not.toThrow()
  })

  it('leaves the local-disk fallback reachable outside production', async () => {
    const { isR2Configured, assertStorageConfigured } = await loadR2({
      NODE_ENV: 'development',
      R2_BUCKET_NAME: '',
    })
    expect(() => assertStorageConfigured()).not.toThrow()
    expect(isR2Configured()).toBe(false)
  })
})
