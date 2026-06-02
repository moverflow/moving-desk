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
