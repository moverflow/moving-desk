import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, saveToken, ApiError } from './api'

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

interface FetchInit {
  headers: Record<string, string>
  credentials?: string
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch — iOS Safari token fallback', () => {
  it('AC5 — sends the stored token as a Bearer Authorization header', async () => {
    saveToken('jwt-123')
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, { ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/auth/me')

    const init = fetchMock.mock.calls[0][1] as FetchInit
    expect(init.headers.Authorization).toBe('Bearer jwt-123')
    // AC3 — cookie is still sent so desktop/Chrome auth keeps working.
    expect(init.credentials).toBe('include')
  })

  it('omits the Authorization header when no token is stored', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/auth/me')

    const init = fetchMock.mock.calls[0][1] as FetchInit
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('AC6 — clears the stored token on a 401 response', async () => {
    saveToken('jwt-123')
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(401, { error: 'Unauthorized' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/auth/me')).rejects.toBeInstanceOf(ApiError)
    expect(localStorage.getItem('md_auth_token')).toBeNull()
  })
})
