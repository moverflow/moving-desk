import { fieldErrorsFromIssues, type ValidationIssue } from './validation-errors'

const BASE_URL = import.meta.env.VITE_API_URL as string

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
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  })

  if (!res.ok) {
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
  })

  if (!res.ok) {
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
