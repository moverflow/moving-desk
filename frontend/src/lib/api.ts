import { fieldErrorsFromIssues, type ValidationIssue } from './validation-errors'

const BASE_URL = import.meta.env.VITE_API_URL as string

// iOS Safari drops cross-domain httpOnly cookies (ITP), so we also keep the JWT
// in localStorage and send it as a Bearer token. The cookie stays primary.
const TOKEN_KEY = 'md_auth_token'

export function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch { /* storage unavailable (private mode) — cookie auth still works */ }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch { /* ignore */ }
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function withAuthHeaders(initHeaders?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = { ...(initHeaders as Record<string, string>) }
  const token = getStoredToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

interface ApiErrorBody {
  error?: string
  message?: string
  details?: ValidationIssue[]
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: withAuthHeaders({ 'Content-Type': 'application/json', ...(init?.headers as Record<string, string>) }),
  })

  if (!res.ok) {
    if (res.status === 401) clearToken()
    let message = `API error: ${res.status}`
    let fieldErrors: Record<string, string> | undefined
    try {
      const body = (await res.json()) as ApiErrorBody
      if (typeof body.message === 'string') message = body.message
      else if (typeof body.error === 'string') message = body.error
      if (body.details?.length) fieldErrors = fieldErrorsFromIssues(body.details)
    } catch { /* ignore parse failure */ }
    throw new ApiError(res.status, message, fieldErrors)
  }

  return res.json() as Promise<T>
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
    headers: withAuthHeaders(),
  })

  if (!res.ok) {
    if (res.status === 401) clearToken()
    let message = `Upload failed: ${res.status}`
    let fieldErrors: Record<string, string> | undefined
    try {
      const body = (await res.json()) as ApiErrorBody
      if (typeof body.message === 'string') message = body.message
      else if (typeof body.error === 'string') message = body.error
      if (body.details?.length) fieldErrors = fieldErrorsFromIssues(body.details)
    } catch { /* ignore */ }
    throw new ApiError(res.status, message, fieldErrors)
  }

  return res.json() as Promise<T>
}
