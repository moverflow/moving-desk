# Task: Fix iOS Safari Authentication

**Sprint:** fix
**Scope:** both
**ID:** fix/02-ios-safari-auth

## Problem

iOS Safari has strict cross-domain cookie policies. When frontend
(moving-desk.vercel.app) makes requests to backend
(moving-desk-production.up.railway.app), Safari blocks or doesn't
send httpOnly cookies, causing:

1. User gets logged out on every page refresh
2. /crew page shows "No jobs" because API calls return 401

## Root cause

Two issues combined:

1. `sameSite: 'None'` cookies work in Chrome but Safari has additional
   restrictions for cross-domain cookies in third-party context
2. Safari's ITP (Intelligent Tracking Prevention) blocks cross-domain
   cookies from being sent even with correct SameSite settings

## Solution — dual auth strategy

Keep httpOnly cookie as primary auth method (secure, works everywhere
except iOS Safari cross-domain).

Add fallback: when cookie auth fails, check Authorization header with
Bearer token stored in localStorage.

This is a pragmatic solution — localStorage token is less secure than
httpOnly cookie but acceptable for this use case since:

- Token is short-lived (7 days)
- HTTPS only
- No sensitive financial data in the app

## Backend changes

### Update auth middleware to check both cookie AND header

```typescript
// middleware/auth.ts
export const authMiddleware = async (c, next) => {
  // 1. Try cookie first (primary, most secure)
  let token = getCookie(c, "token");

  // 2. Fallback to Authorization header (for iOS Safari)
  if (!token) {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const payload = verifyToken(token);
  if (!payload) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("userId", payload.sub);
  c.set("tenantId", payload.tenantId);
  c.set("role", payload.role);
  c.set("plan", payload.plan);
  if (payload.crewId) c.set("crewId", payload.crewId);

  await next();
};
```

### Update login and register responses — return token in body too

```typescript
// In auth routes, after setting cookie:
setCookie(c, 'token', jwt, {
  httpOnly: true,
  sameSite: 'None',
  secure: true,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
})

// Also return token in response body for iOS Safari fallback
return c.json({
  user: { ... },
  tenant: { ... },
  token: jwt,  // ADD THIS — frontend stores in localStorage if needed
}, 201)
```

Apply to: POST /auth/login, POST /auth/register, POST /users/join

### GET /auth/me — also return token

```typescript
return c.json({
  user: { ... },
  tenant: { ... },
  token: currentToken,  // re-return current valid token
})
```

Extract current token from cookie or header in /auth/me handler.

## Frontend changes

### Update api.ts — send both cookie and Authorization header

```typescript
// lib/api.ts
const TOKEN_KEY = "md_auth_token";

export function saveToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const storedToken = getStoredToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  // Always send Authorization header as fallback for iOS Safari
  if (storedToken) {
    headers["Authorization"] = `Bearer ${storedToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include", // keep sending cookie
    ...init,
    headers,
  });

  if (!res.ok) {
    // If 401 — clear stored token
    if (res.status === 401) {
      clearToken();
    }
    const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
    throw new ApiError(
      res.status,
      body.message ?? body.error ?? `API error ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
}
```

### Update auth store — save token on login/register

```typescript
// store/auth.store.ts
import { saveToken, clearToken } from "../lib/api";

// In setAuth action:
setAuth: (user, tenant, token?: string) => {
  if (token) saveToken(token);
  set({ user, tenant, isAuthenticated: true });
};

// In clearAuth action:
clearAuth: () => {
  clearToken();
  set({ user: null, tenant: null, isAuthenticated: false });
};
```

### Update useAuth hooks — pass token from response

```typescript
// hooks/useAuth.ts
export const useLogin = () =>
  useMutation({
    mutationFn: (data) =>
      apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      // data.token returned from backend
      useAuthStore.getState().setAuth(data.user, data.tenant, data.token);
    },
  });

export const useRegister = () =>
  useMutation({
    mutationFn: (data) =>
      apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      useAuthStore.getState().setAuth(data.user, data.tenant, data.token);
    },
  });

export const useMe = () =>
  useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch("/auth/me"),
    onSuccess: (data) => {
      if (data.token) {
        // Refresh stored token
        saveToken(data.token);
      }
    },
    retry: false,
  });
```

### Update logout — clear stored token

```typescript
export const useLogout = () =>
  useMutation({
    mutationFn: () => apiFetch("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      useAuthStore.getState().clearAuth(); // clearAuth calls clearToken()
      navigate("/login");
    },
  });
```

### Crew login page — same pattern

CrewLoginPage uses same useLogin hook — no changes needed if hook
is updated correctly.

## Files to modify

```
backend/src/middleware/auth.ts        ← check cookie + Authorization header
backend/src/routes/auth.ts            ← return token in login/register response
frontend/src/lib/api.ts               ← add token storage + Authorization header
frontend/src/store/auth.store.ts      ← save/clear token on auth actions
frontend/src/hooks/useAuth.ts         ← pass token from response to store
```

## Acceptance criteria

- AC1: Login on iOS Safari → stays logged in after page refresh
- AC2: /crew page shows jobs on iOS Safari
- AC3: Login on Chrome/desktop still works (cookie still sent)
- AC4: Logout clears both cookie and localStorage token
- AC5: Token automatically included in all API requests via header
- AC6: 401 response clears stored token
- AC7: `npm run typecheck` passes with zero errors

## Security notes

- localStorage token is acceptable here: HTTPS only, no PII in token,
  short-lived (7 days), standard practice for mobile PWAs
- httpOnly cookie remains primary auth — localStorage is fallback only
- Both methods send the same JWT — no security downgrade in token content
