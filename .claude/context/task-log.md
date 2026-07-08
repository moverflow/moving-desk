# Task Log

## Format
Each completed feature appended here by orchestrator.

---
<!-- entries added by orchestrator during development -->

---

## sprint-1/05-auth-pages — DONE (2026-06-02) — PR #1

- Branch: feat/sprint-1-auth-pages
- Tests: 30/30
- Review cycles: 2 (extracted AuthCard, PasswordField, LogoUpload)
- PR: https://github.com/yuriy-puris/moving-desk/pull/1

## sprint-1/05-auth-pages — Analysis (2026-06-02)

### What is being built
Four public/semi-public auth pages + auth infrastructure for the MovingDesk frontend.
No backend work — mock mode throughout.

### Files to create / modify
**Create:**
- `frontend/src/routes/RegisterPage.tsx`
- `frontend/src/routes/LoginPage.tsx`
- `frontend/src/routes/QuickSetupPage.tsx`
- `frontend/src/routes/JoinPage.tsx`
- `frontend/src/components/shared/ProtectedRoute.tsx`
- `frontend/src/hooks/useAuth.ts`

**Modify:**
- `frontend/src/store/auth.store.ts` — implement full AuthState (was empty stub)
- `frontend/src/App.tsx` — add 4 new routes, wrap protected routes

### Who uses it
| Page | User | Auth required |
|------|------|---------------|
| /register | New company owner | No |
| /login | Any user | No |
| /setup | Owner (post-register) | Yes (owner role) |
| /join | Dispatcher (via invite) | No (token-based) |

### DB tables touched
None directly (frontend only). Backend endpoints consumed (mocked):
- POST /auth/register → mock: returns MOCK_USER + MOCK_TENANT
- POST /auth/login → mock: validates email, throws on mismatch
- GET /auth/me → mock: always returns MOCK_USER (simulates cookie restore)
- PATCH /settings → mock: simulated for logo/timezone
- POST /users/join → mock: token from URL param

### Tenant isolation
- tenantId lives in Zustand `AuthState.tenant.id`
- ProtectedRoute gates all `/orders`, `/new-order`, `/invoices`, `/clients` routes
- No DB queries in frontend — isolation enforced backend-side

### Key risks / assumptions
1. **No shadcn/ui components installed yet** — need to install Button, Input, Label, Select, Card before implementing pages
2. **AppShell must NOT wrap auth pages** — /register, /login, /setup, /join must render outside AppShell (no top nav)
3. **File preview for logo** — uses FileReader API + local object URL; no actual upload in mock mode
4. **Mock useMe** — always returns MOCK_USER, so "auth state persistence" in mock = always authenticated after any login action. ProtectedRoute must check store state (setAuth called), not just query result.
5. **QuickSetupPage** — shown once after register, no backend guard in mock mode; just route flow
6. **Token for JoinPage** — `useSearchParams()` to read `?token=<uuid>` from URL

### Acceptance criteria mapping
- AC1: RegisterPage → onSuccess setAuth + navigate('/setup')
- AC2: LoginPage → onSuccess setAuth + navigate('/orders')
- AC3: LoginPage → mutation onError → set local error state, render below form
- AC4: ProtectedRoute → `if (!isAuthenticated) return <Navigate to="/login" />`
- AC5: QuickSetupPage → `<input type="file">` + FileReader → preview `<img>`
- AC6: QuickSetupPage → "Skip setup" link → navigate('/orders')
- AC7: JoinPage → reads token via useSearchParams, passes to mutation
- AC8: ProtectedRoute uses useMe query; on success → setAuth; while loading → spinner

---

## sprint-5/06-crew-cards — Analysis (2026-07-08)

### What is being built
Adds a `phone` column to `crews`, extends the existing crew create/update backend to accept it (plus an `active` toggle — see gap below), and replaces the plain-list crew management currently missing from the frontend entirely with a dedicated "Crews" tab in Settings, rendering crews as cards (name, truck, phone, active/inactive badge, inline edit, add-crew form).

### DB tables touched
`crews` only — `ALTER TABLE crews ADD COLUMN phone varchar(20)`. New migration, no data backfill needed (nullable column).

### Tenant isolation
`crews.service.ts` already scopes every query by `tenant_id` (`listCrews`, `updateCrew`, `deactivateCrew` all `eq(crews.tenant_id, tenantId)`); `createCrew` inserts `tenant_id` from the route's `ctx.tenantId`. No new isolation surface — just confirm the extended `updateCrew` (adding phone/active) keeps the same `and(eq(id), eq(tenant_id))` where clause.

### Verified gap vs. task spec — resolved
The task's "Backend" section only says to add `phone` to PATCH/GET, but the frontend spec explicitly requires an "Active" toggle in the edit form (AC5: "Edit crew updates name, truck, phone, active status"). The existing `DELETE /crews/:id` only deactivates (one-directional, sets `active: false`) — there's no way to reactivate a crew today. Resolution: extend `patchCrewSchema`/`updateCrew()` to also accept an optional `active: boolean`, so the edit form's toggle round-trips through `PATCH` in both directions. Leave `DELETE /crews/:id` untouched (unused by this feature, not asked to remove).

### Files to create/modify (adjusted from task doc — task's list was incomplete, verified against actual code)
- `backend/src/db/schema.ts` — add `phone` to `crews`
- `backend/drizzle/000X_*.sql` + meta — new migration (not listed in task doc but required — "Add to schema.ts and run migration")
- `backend/src/services/crews.service.ts` — `createCrew`/`updateCrew` accept `phone` + `active`
- `backend/src/routes/crews.ts` — **not in task's file list but must change**: `createCrewSchema`/`patchCrewSchema` need `phone`/`active` fields, otherwise Zod strips them silently
- `frontend/src/types/index.ts` — extend `Crew` type: `phone?: string`, `active: boolean` (not in task's list, but required for typecheck)
- `frontend/src/hooks/useCrews.ts` — new file. **Deviation**: `useCrews()` query currently lives in `useOrders.ts` (verified) — moving it here for one-responsibility-per-file, alongside new `useCreateCrew`/`useUpdateCrew`. Requires updating 3 existing importers (`NewOrderPage.tsx`, `NewOrderPage.test.tsx`, `OrdersPage.test.tsx`) to import from the new path instead of `@/hooks/useOrders`.
- `frontend/src/components/shared/CrewsTab.tsx` — new. **Deviation, justified**: task's file list only names `CrewCard.tsx`, but `SettingsPage.tsx`'s existing tabs (`CompanyTab.tsx`, `TeamTab.tsx`, `BillingTab.tsx`) are each a dedicated component — a bare card grid inlined into `SettingsPage.tsx` would break that established pattern. `CrewsTab.tsx` owns the card grid + inline "+ Add crew" form (following `TeamTab.tsx`'s precedent of an inlined add-form, not a separate slide-over panel, since the task says "inline form **or** slide-over" — inline matches the sibling tab's convention).
- `frontend/src/components/shared/CrewCard.tsx` — new, single crew card with inline edit-mode toggle (name/truck/phone inputs + active `Switch`, matching `components/ui/switch.tsx` which is installed but currently unused anywhere)
- `frontend/src/routes/SettingsPage.tsx` — add third `TabsTrigger`/`TabsContent` for "Crews"

### Acceptance criteria (verbatim)
- AC1: Crews tab visible in Settings
- AC2: Crews displayed as cards with name, truck, phone, status
- AC3: Phone field formatted as (949) 555-0100 if set — use existing `formatPhone()` from `frontend/src/lib/utils.ts`, not a new formatter
- AC4: Active/Inactive badge shown correctly
- AC5: Edit crew updates name, truck, phone, active status
- AC6: Add crew creates new crew card
- AC7: Phone persists after save (DB migration applied)
- AC8: `npm run typecheck` passes

### Key risks / assumptions
1. No existing tests for `crews.ts`/`crews.service.ts` at all (verified) — test step should add focused coverage for the new phone/active fields, not full retroactive CRUD coverage of pre-existing behavior.
2. `formatPhone()` assumes a 10-digit US number; an empty/undefined phone must skip formatting entirely (render nothing), not call `formatPhone('')` which would produce `"() -"`.
3. No popover/toast primitive in this codebase (confirmed in sprint-5/05 review) — inline error text and native `window.confirm`-style patterns remain the convention if needed here too, though this feature has no destructive delete action exposed in the UI (only add/edit).

---

## sprint-5/06-crew-cards — DONE (2026-07-08) — PR #22

- Branch: feat/sprint-5-crew-cards
- Tests: 38/38 backend (7 pre-existing Postgres-gated skips, unrelated), 120/120 frontend
- Review cycles: 0 (approved first pass; 2 non-blocking notes: a restates-the-code comment, phone field has no length constraint unlike clients.ts)
- Validation: 1 gap found and fixed — `listCrews` hard-filtered `active=true`, which would've made a deactivated crew silently disappear instead of showing the Inactive badge (AC4). Fixed by adding `includeInactive` param: Crews tab passes `true`, New Order's crew-assignment dropdown stays active-only (unchanged behavior). Re-validated, passed.
- PR: https://github.com/moverflow/moving-desk/pull/22

---
