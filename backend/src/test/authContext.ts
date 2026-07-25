import type { AuthContext } from '../services/auth.service.js'

// Test double for the live account lookup authMiddleware performs on every
// request. Route tests sign a token and register the matching account here, so
// the middleware sees exactly what the database would return for that user.
// Registering nothing — or a different user id — models a removed account and
// makes the middleware reject the request, which is the behaviour under test.
let current: AuthContext | null = null

export function setAuthContext(context: AuthContext | null): void {
  current = context
}

export function clearAuthContext(): void {
  current = null
}

export async function getAuthContextMock(userId: string): Promise<AuthContext | null> {
  if (!current || current.userId !== userId) return null
  return current
}
