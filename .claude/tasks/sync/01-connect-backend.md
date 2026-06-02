# Task: Sync Frontend with Backend
**Sprint:** sync
**Scope:** frontend
**ID:** sync/01-connect-backend

## User story
As a developer, I want to replace all mock data with real API calls
so the app works with live data from the backend.

## Prerequisites
All backend tasks must be complete and deployed:
- sprint-0/02-backend-init ✅
- sprint-1/01 through 05 ✅
- sprint-2/01-orders-api ✅
- sprint-3/01-invoices (BE) ✅
- sprint-3/02-clients (BE) ✅
- sprint-4/01-billing ✅
- sprint-4/02-settings (BE) ✅

Backend URL available at: VITE_API_URL in .env

## Process

### Step 1 — Update api.ts base config
```typescript
// lib/api.ts
export const api = {
  baseUrl: import.meta.env.VITE_API_URL,
  async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      credentials: 'include', // send httpOnly cookie
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    if (!res.ok) {
      const error = await res.json()
      throw new ApiError(res.status, error.error)
    }
    return res.json()
  }
}
```

### Step 2 — Replace hooks one by one

Go through each sync checklist in task files:
- sprint-1/05-auth-pages.md → Sync checklist
- sprint-2/02-orders-board.md → Sync checklist
- sprint-3/01-invoices.md → Sync checklist
- sprint-3/02-clients.md → Sync checklist
- sprint-4/02-settings.md → Sync checklist

Replace mock mutationFn/queryFn with real API calls.
Remove MOCK_* constants after replacing.

### Step 3 — E2E flow test (manual)
After all hooks replaced, verify full user flow:

```
1. Register new company
   → POST /auth/register
   → Redirects to /setup

2. Complete setup
   → PATCH /settings
   → Redirects to /orders

3. Create an order
   → POST /orders
   → Card appears on board

4. Update status to completed
   → PATCH /orders/:id
   → Card moves to Done column

5. Generate invoice
   → POST /invoices
   → Invoice appears in list

6. Download PDF
   → PDF generates with real company logo and data

7. Send invoice to client
   → POST /invoices/:id/send
   → Email sent via Resend
```

### Step 4 — Remove all mock code
Search codebase for:
```
MOCK_
// TODO: replace with real API
await new Promise(r => setTimeout(r, // fake delay
```
All must be gone before this task is complete.

## Acceptance criteria
- AC1: Register → real tenant + user created in DB
- AC2: Create order → persists after page refresh
- AC3: Invoice PDF shows real company logo (from settings)
- AC4: Status change persists after page refresh
- AC5: Client search returns real DB results
- AC6: No MOCK_ constants remain in codebase
- AC7: `npm run typecheck` passes with zero errors

## Notes
Do this sync in ONE session — partial sync (some hooks real, some mock)
causes confusing behavior where some data persists and some doesn't.
