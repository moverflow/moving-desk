# Task Log

## Format
Each completed feature appended here by orchestrator.

---
<!-- entries added by orchestrator during development -->

---

## sprint-5/01-timezone-world — DONE (2026-07-08) — PR #17

- Branch: feat/sprint-5-timezone-world
- Tests: 105+/105+ (full frontend suite green, no regressions)
- Review cycles: 0 (approved first pass; 2 non-blocking notes: scope tension with USA-market framing, minor edge case in region-key derivation)
- PR: https://github.com/moverflow/moving-desk/pull/17

---

## sprint-5/02-add-client — Analysis (2026-07-08)

### What is being built
A standalone "add client" flow so a dispatcher can create a client record before any order exists, decoupling client-database growth from order creation. Two parts: (1) backend `POST /clients` endpoint + `createClient()` service function with a tenant-scoped duplicate-phone check; (2) frontend "+ Add client" button on ClientsPage that opens a slide-over panel (name/phone/email/notes), plus a fix to the existing "New order from client row" pre-fill so it carries both name and phone.

### Who uses it
Dispatcher (per user story) and, per CLAUDE.md's role model (owner = full access, dispatcher = no billing/settings), owner as well — nothing in the task or decisions.md restricts client creation by role. No public/unauthenticated surface; `POST /clients` requires auth.

### DB tables touched
`clients` only (insert). Read of the auth-derived `tenantId` from JWT; no other tables written. Existing `clients` table already has `tenant_id`, `name`, `phone`, `email`, `notes`, timestamps.

### Tenant isolation requirements
- Insert must set `tenant_id` from `ctx.tenantId` (JWT), never from request body.
- **The 409 duplicate-phone check must be scoped by tenantId** — two different tenants must be able to have clients with the identical phone number without collision. This is not just an app-layer concern here: `backend/src/db/schema.ts` already defines a **unique index `clients_tenant_phone_idx` on `(tenant_id, phone)`** (confirmed by inspection), i.e. the DB already enforces per-tenant uniqueness, not global uniqueness. `createClient()` must pre-check within the same tenant scope (`eq(tenantId) AND eq(phone)`) and return 409 before insert, then treat a DB unique-constraint violation as a defense-in-depth 409 fallback (race condition on concurrent submits) rather than letting it surface as a 500.

### Acceptance criteria (verbatim)
- AC1: "+ Add client" button visible on Clients page
- AC2: Slide-over opens with correct fields
- AC3: Valid submission creates client, panel closes, list updates
- AC4: Duplicate phone shows inline error, panel stays open
- AC5: "New order" from client row pre-fills both name and phone
- AC6: Tenant isolation — client belongs to correct tenant
- AC7: `npm run typecheck` passes

### Key risks / assumptions
1. **Phone normalization before uniqueness comparison — not specified in the task.** CLAUDE.md mandates display format `(949) 555-0100` but says nothing about how the 409 check should compare values. Recommend normalizing to digits-only (strip all non-digits) for both the pre-insert duplicate check and any DB-level comparison, so `"(949) 555-0100"`, `"949-555-0100"`, and `"9495550100"` are treated as the same number. If the existing unique index compares raw stored strings, the service layer should normalize/store phone consistently (e.g. always store formatted via the existing `formatPhone()` util in `frontend/src/lib/utils.ts`, or store digits-only and format only for display) — implementer must pick one canonical storage form and apply it consistently, since the column is already `varchar(20)` with no normalization logic today.
2. **Zod validation for `name` min-length** — task says `name: string // required, min 2`. Per CLAUDE.md's "Zod for all external input validation" rule, this must be enforced with a Zod schema (`z.string().min(2)`) in the route/service, not just left to the DB `not null` constraint.
3. **Role restriction assumption** — task's user story names "dispatcher" but sets no explicit role gate. Assuming any authenticated tenant user (owner or dispatcher) can create a client, consistent with decisions.md's role split (dispatcher is only excluded from billing/settings, not clients).
4. **Discrepancy vs. current code**: the task text states "Currently only phone pre-fill exists" for AC5's New-order pre-fill, but inspection of `frontend/src/routes/ClientsPage.tsx` (`handleNewOrder`) shows it already passes both `clientPhone` and `clientName` via router state. Implementer should verify at implementation time whether the New order form actually consumes both fields (the gap may be on the receiving end, not the sending end) rather than assuming AC5 requires new work in ClientsPage.tsx itself.
5. **Optional fields on create** — phone, email, notes are all optional per the request body; only `name` is required. The 409 check only applies when `phone` is present and non-empty (multiple clients with no phone should not collide with each other).

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

## sprint-5/01-timezone-world — Analysis (2026-07-07)

### What is being built
A frontend-only enhancement to the timezone select control used during company setup and in settings. The current control offers a hardcoded list of ~6 US timezones; this replaces it with the full IANA timezone list (~600 entries, via `Intl.supportedValuesOf('timeZone')`), grouped by continent/region for usability. No new dependency — built-in `Intl` API only. Default selection and display format (raw IANA string, no UTC offset labels) are unchanged.

### Files to create / modify
**Modify:**
- `frontend/src/lib/utils.ts` — add `getAllTimezones()` and `getGroupedTimezones()`
- `frontend/src/routes/QuickSetupPage.tsx` — replace hardcoded timezone list with grouped dynamic list
- `frontend/src/routes/SettingsPage.tsx` — replace hardcoded timezone list with grouped dynamic list

### Who uses it
| Page | User | Auth required |
|------|------|---------------|
| /setup (QuickSetupPage) | Owner (post-register) | Yes (owner role) |
| /settings (SettingsPage) | Owner | Yes (owner role) |

Dispatchers and the public are not exposed to this control (settings/timezone is owner-only per CLAUDE.md role rules).

### DB tables touched
None directly — frontend-only change. The selected value is ultimately persisted via existing settings flows into `tenants.settings` (jsonb) → `settings.timezone`, per the existing schema/decisions.md convention. No new table or column, no new API contract described in the task.

### Tenant isolation
Not applicable in a DB-query sense — this is a client-side select-options change with no new network calls. Existing isolation already applies: the timezone value is saved as part of the tenant's own settings object through the current (mocked, per Sprint 1 analysis) settings update path, scoped to `ctx.tenantId` server-side. This task does not touch that persistence logic, only the list of selectable options.

### Acceptance criteria (verbatim from task file)
- AC1: Timezone select shows all ~600 world timezones
- AC2: Options are grouped by region (America, Europe, Asia, etc.)
- AC3: Default remains America/New_York for new registrations
- AC4: `npm run typecheck` passes with zero errors
- AC5: No new dependencies added — uses built-in Intl API only

### Scope tension — flag for human review
CLAUDE.md frames MovingDesk as a USA-market product throughout (formatting rules section is titled "USA market," Sprint 0 default timezone is `America/New_York`), and `decisions.md` states explicitly: **"Pricing: USA market only in v1."** This task's user story justifies the change as "so companies outside the US can use MovingDesk correctly," which is a product-scope statement beyond what decisions.md currently commits to (pricing/billing is USA-only; nothing in decisions.md says international *usage* is out of scope, but nothing says it's in scope either).

Mitigating factors — this is likely fine as a UX nicety, not a scope violation:
- `America/New_York` remains the default (AC3), consistent with USA-primary framing.
- No pricing, billing, currency, or locale-formatting logic is touched (currency/date/phone formats stay USA-only per CLAUDE.md).
- No new dependency, no backend/API change, no new DB fields.

Recommendation: proceed as a low-risk frontend nicety, but a human should confirm this isn't the first step of an unplanned "international expansion" scope creep — e.g., a Georgian or European owner selecting `Europe/Tbilisi` will still see USD currency formatting and US-style dates, which is likely a jarring inconsistency worth a product decision at some point (not in this task's scope to fix).

### Key risks / assumptions
1. `Intl.supportedValuesOf('teeZone')` — note: correct API name is `Intl.supportedValuesOf('timeZone')` (task file has it right); requires ES2022+ lib target, should already be covered by Vite's default TS target but worth confirming `tsconfig.json` lib includes it for typecheck (AC4) to pass.
2. Region grouping via `tz.split('/')[0]` produces some awkward buckets for zones without a `/` (e.g. `UTC`) — falls into its own single-entry group; not called out in the task but harmless.
3. Existing hardcoded US-only list logic/component structure in QuickSetupPage.tsx and SettingsPage.tsx not yet inspected in detail (out of time-box for this analysis) — implementer should check both files for how the `<Select>` is currently composed (shadcn Select vs native `<select>`) since AC2 asks for optgroup-style rendering.

---

## sprint-5/03-owner-dashboard — Analysis (2026-07-08)

### What is being built
A read-only owner-facing analytics dashboard: one new backend endpoint (`GET /dashboard`) that aggregates existing `orders` and `crews` data into a summary payload (totals, revenue, avg order value, orders-by-status breakdown, an 8-week orders/revenue time series, and a top-5-crews-by-revenue leaderboard), and one new frontend page (`DashboardPage`) that renders this as three summary cards, a recharts bar chart, and two side-by-side breakdown panels, gated behind a period selector (week/month/quarter). Also a nav/routing change: a new "Dashboard" nav item and default-landing-route split by role (owner → `/dashboard`, dispatcher → `/orders`).

### Who uses it
Owner only. Dispatcher must be blocked at the API (AC8: 403) and never sees the nav item (AC1) or lands there by default (AC2). No public/unauthenticated surface — this is entirely behind existing auth + an owner-only gate.

### DB tables touched
`orders` (read-only aggregation: status, total_price, move_date, created_at, crew_id, tenant_id) and `crews` (read-only, joined for name/truck_label). No writes anywhere in this task. No new tables, no schema migration.

### Tenant isolation requirements
This task has **three separate aggregation queries**, and CLAUDE.md's multi-tenancy rule ("EVERY query MUST filter by tenant_id. No exceptions.") applies independently to each — there is no single shared filter to rely on:
1. **Orders by status** — `WHERE tenant_id = $1 AND created_at >= $period_start` — must filter tenant_id.
2. **Orders by week** — `WHERE tenant_id = $1 AND move_date >= NOW() - INTERVAL '8 weeks'` — must filter tenant_id (separately from query 1; easy to copy-paste query 1's period logic and forget this one uses a fixed window instead).
3. **Top crews** — `WHERE o.tenant_id = $1 AND o.status = 'completed' AND ...` plus the `JOIN crews cr ON cr.id = o.crew_id` — tenant_id filter belongs on `orders`, not `crews` (crews has no visible tenant_id in this join per the task SQL, but crews itself is tenant-scoped per CLAUDE.md's table list, so the crew rows returned are implicitly tenant-safe only because orders is filtered — if the orders filter is ever dropped, this join would leak cross-tenant crew data).
Because these are three visually-similar Drizzle queries likely written back-to-back, the implementer and reviewer should explicitly checklist all three for `eq(orders.tenantId, ctx.tenantId)` (or equivalent) rather than eyeballing the file once. AC7 exists precisely to force this check.

### Acceptance criteria (verbatim)
- AC1: Dashboard nav item visible only to owner
- AC2: Dispatcher navigates to /orders, owner to /dashboard by default
- AC3: Summary cards show correct totals for selected period
- AC4: Bar chart renders with recharts, shows last 8 weeks
- AC5: Period selector switches data correctly
- AC6: Top crews table shows top 5 by revenue
- AC7: All backend queries filter by tenantId
- AC8: GET /dashboard returns 403 for dispatcher role
- AC9: `npm run typecheck` passes

### Key risks / ambiguities for the implementer
1. **`$period_start` is undefined in the task spec.** The "orders by status" query filters `created_at >= $period_start` for `period=week|month|quarter` but never says how to compute it. It must be derived server-side from the query param. The task doesn't say whether "month" means calendar month-to-date or a rolling 30 days. Recommend a rolling window (`NOW() - INTERVAL '7 days' / '1 month' / '3 months'`) for all three periods, for simplicity and consistency with the "orders by week" query, which is explicitly a fixed rolling 8-week window — unless the explorer finds existing period/date-range logic elsewhere in the codebase that already establishes a calendar-based convention, in which case follow that instead.
2. **"Orders by week" ignores the `period` param entirely** — it's hardcoded to a fixed last-8-weeks window regardless of whether the user selected week/month/quarter. This appears intentional: the frontend spec labels it "last 8 weeks for bar chart" as a fixed chart separate from the period-driven summary cards (AC4 says "shows last 8 weeks" with no period dependency, while AC3/AC5 tie period to the summary cards). Implementer should confirm this reading rather than silently "fixing" it to respect `period`, since that would be an undocumented behavior change.
3. **Division by zero**: `avgOrderValue = totalRevenue / completedOrders`. When `completedOrders === 0`, this produces `NaN` or `Infinity` in JS. Recommend returning `0` explicitly in that case.
4. **Top crews inner join drops unassigned orders.** `orders.crew_id` is nullable (per CLAUDE.md's table list, no NOT NULL marked), and the task's SQL uses `JOIN crews` (inner join) — orders with `crew_id = NULL` simply won't contribute to any crew's aggregate. This looks like correct/intended behavior (an order with no crew can't be "top crew" data) rather than a bug, but flag it for explicit confirmation since it's a silent exclusion, not an error.
5. **`requireOwner` middleware — verify, don't reinvent.** AC8 (403 for dispatcher) implies role-gating middleware already exists in this codebase (the task text even says "use requireOwner middleware"). The explorer must confirm its exact location/name/behavior (e.g. does it 403 or 401? does it live in `backend/src/middleware/auth.ts` alongside the JWT-verify middleware, or is it separate?) before the implementer wires it in — do not write a new ad hoc role check.
6. **Route registration pattern unverified.** `backend/src/index.ts` is listed as a file to modify to mount `/dashboard`. The implementer needs the exact existing pattern (how orders.ts/clients.ts/etc. routers are currently registered — e.g. `app.route('/orders', ordersRouter)`) rather than guessing a new convention.

### Assumptions (time-boxed, not deeply verified)
- Any authenticated owner (not scoped further by plan/tier) can access `/dashboard` — nothing in decisions.md ties this feature to a specific pricing plan.
- `total_price` (not `base_price`) is the correct revenue field per the task's explicit column references — consistent with CLAUDE.md's `orders` schema listing both fields.

---

## sprint-5/03-owner-dashboard — DONE (2026-07-08) — PR #19

- Branch: feat/sprint-5-owner-dashboard
- Tests: backend 34/34, frontend 111/111 (7 Postgres-backed tenant-isolation tests gated by describe.skipIf — verified locally, no CI exists in this repo to run them automatically; flagged as a known gap in the PR)
- Review cycles: 0 (approved first pass)
- New dependency added: recharts (task assumed it was already installed — it wasn't)
- PR: https://github.com/moverflow/moving-desk/pull/19

---

## sprint-5/04-schedule-calendar — Analysis (2026-07-08)

### What is being built
A new read-only "Schedule" page (`/schedule`) that renders existing orders on a FullCalendar (`@fullcalendar/react`) week/month calendar, one event per order, colored by status, with a click-to-view popup linking back to the orders page. Pure presentation layer over already-fetched data — no new backend, no mutations, no drag/create.

### Who uses it
Owner and dispatcher (both get the nav item, per the task's nav diagram: `Dashboard | Orders | Schedule | New order | ...` for owner, `Orders | Schedule | New order | ...` for dispatcher). No public/unauthenticated surface.

### DB tables touched
None directly — no new endpoint, no schema change. Reuses the existing `useOrders` hook, which calls `GET /orders` and returns data ultimately sourced from the `orders` table (joined server-side with `clients`/`crews` for `clientName`/`crewName`, per `RawOrder` in `frontend/src/hooks/useOrders.ts`).

### Tenant isolation requirements
No new query surface is introduced client-side, so there is nothing new to isolate in this task. Isolation is entirely inherited from whatever `GET /orders` already enforces server-side (tenant_id filter in the orders route/service, per CLAUDE.md's multi-tenancy rule) — **this is an assumption carried forward from Sprint 2, not something this task builds or re-verifies.** Flag for the reviewer: confirm `GET /orders` was already checked for tenant_id filtering in the Sprint 2 review; do not re-litigate backend isolation here since this task has zero backend files.

### Acceptance criteria (verbatim)
- AC1: /schedule shows FullCalendar weekly view by default
- AC2: Orders appear as colored events on correct dates
- AC3: Event color matches order status
- AC4: Click on event shows popup with order details
- AC5: "View order →" link navigates to orders page
- AC6: Week/Month toggle works
- AC7: Calendar is read-only — no drag, no create
- AC8: `npm run typecheck` passes

### Verified (not just assumed) — checked `frontend/src/hooks/useOrders.ts` and `frontend/src/types/index.ts` directly:
1. **`clientName` and `homeSize` are both present** on the `Order` type returned by `useOrders()` (mapped from `RawOrder.clientName` / `RawOrder.home_size`), so the `title: "{clientName} — {homeSize}"` field is buildable as specified — this is not a gap.
2. **`homeSize` raw values are codes, not display labels** (`OrderStatus`/`HomeSize` enums live in `frontend/src/types/index.ts:14-15`: `HomeSize = 'studio' | '1br' | '2br' | '3br' | 'house'`). The task's example title "Rick Adams — 2 BR" implies a formatted label, not the raw `"2br"` value. A `HOME_SIZE_LABEL` lookup already exists in `frontend/src/components/shared/OrderCard.tsx:14` (e.g. `2br` → `"2 BR"`) — implementer should reuse/import that mapping (or extract it to a shared util if it's currently module-private) rather than inventing a second one or emitting the raw code.
3. **`OrderStatus` confirmed as 6 values**: `'new' | 'confirmed' | 'in_progress' | 'completed' | 'closed' | 'cancelled'` (`types/index.ts:14`) — matches CLAUDE.md exactly. The task's color map only lists 5 (`new`, `confirmed`, `in_progress`, `completed`, `cancelled`) and **omits `closed`**. Confirmed gap, not speculation — implementer must pick a fallback color (e.g. reuse the `completed` gray `#B4B2A9`, or add a distinct `closed` color) rather than letting `backgroundColor` be `undefined` for closed orders.
4. `fromAddress`, `toAddress`, `crewName`, `status`, `moveDate` are all present on `Order` as well — the `extendedProps` and `date` fields in the task's `CalendarEvent` interface are fully buildable from the existing hook with no gaps.

### Other risks / ambiguities to flag forward (not yet verified — for explorer/implementer)
1. **timeGridWeek + all-day events tension**: the task specifies default view `timeGridWeek` (an hourly time-grid) but every event is all-day (`date: move_date`, no time). In FullCalendar, all-day events in a timeGridWeek view render in the "all-day" row at the top of the grid, not as timed blocks in the body — the time-grid body itself will render empty. This is likely intentional (task explicitly says movers don't know exact start times), but the implementer should treat it as a design choice to confirm, not a bug to "fix" by inventing fake times.
2. **Sprint 5 is not listed in `.claude/context/feature-queue.md`** (queue stops at Sprint 4 — Billing + Settings). Not a blocker, just noting the queue file is stale relative to the task files under `.claude/tasks/sprint-5/`; someone should update it eventually but that's out of scope for this task.
3. New dependencies: `@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction` — task explicitly requests these, so this is an intentional, accepted addition (unlike the dashboard task's earlier recharts mixup) — no ambiguity, just confirm they get added to `frontend/package.json` correctly with `npm run typecheck` still passing (AC8).
4. No backend files are listed in "Files to create/modify" — explorer/implementer must not add or touch any backend route, service, or schema file for this task.

---

## sprint-5/04-schedule-calendar — DONE (2026-07-08) — PR #20

- Branch: feat/sprint-5-schedule-calendar
- Tests: 129/129 (120 prior + 9 new SchedulePage tests, no regressions)
- Review cycles: 1 (SchedulePage() exceeded 40-line limit; fixed by extracting ScheduleCalendar subcomponent, re-reviewed and approved)
- New dependencies: @fullcalendar/react, @fullcalendar/daygrid, @fullcalendar/timegrid, @fullcalendar/interaction (task-requested, confirmed not pre-installed)
- Notable deviation: event-click detail UI uses a Sheet slide-over (existing codebase convention) instead of an anchored popup, since no Popover/Tooltip primitive exists in this app
- PR: https://github.com/moverflow/moving-desk/pull/20

---

## sprint-5/05-file-uploads — Analysis (2026-07-08)

### Resolved-scope note (verbatim, from human orchestrator)
"Note: R2 is already configured in r2.ts — use existing uploadLogo pattern to implement uploadOrderFile. All R2 env vars are set in Railway."

### CLAUDE.md scope-gate flag — resolved, non-blocking
CLAUDE.md's Stack section says `Storage: Cloudflare R2 (Sprint 4 only — do NOT touch now)`, and its "Out of scope" list includes "Cloudflare R2 / file upload" with no sprint qualifier. On its face this task (Sprint 5, `order_files` + R2 upload) looks like it conflicts with that gate. Resolved as non-blocking because: (a) the gate was time-boxed to "Sprint 4 only" and we are now in Sprint 5, past it; (b) R2 is confirmed already live in production, not just theoretically unlocked — verified directly: `backend/src/lib/r2.ts` has a working `uploadLogo()` with `isR2Configured()` + S3Client + local-disk fallback, and `backend/src/routes/settings.ts:59` (`POST /settings/logo`) is a shipped, wired route using it; (c) the human gave explicit, specific, context-aware authorization this session naming the exact file and pattern to reuse. This is a resolved scope note, not an open risk — do not block or pause the pipeline over it.

### 1. What's being built
Attach/list/delete files (photos, PDFs) on an order, so a dispatcher has damage photos, inventory lists, and signed contracts in one place per order. Backend: 3 new REST routes + new R2 upload function + new `order_files` table. Frontend: a Files section in the order detail view with upload/thumbnail/download/delete UI.

### 2. Who uses it
Dispatcher (per user story) and owner (both authenticated tenant roles have order access) — no public/unauthenticated access. Files are tenant-private except for the fact that R2 URLs, once issued, are unauthenticated-bearer-token-style access (see risk below).

### 3. DB tables touched
- **New table `order_files`** — the first net-new table since Sprint 0's initial 8-table migration. This is a real schema migration against the live Neon database (not a column add to an existing table), more consequential than typical Sprint 5 feature work — treat the migration step with extra care (review the generated SQL before applying, confirm FK references `tenants(id)`, `orders(id)`, `users(id)` per spec).
- `orders` — read-only, for tenant/existence verification on all 3 routes.
- `tenants`, `users` — FK targets only, not queried directly by this feature.

### 4. Tenant isolation requirements
All three routes (POST/GET/DELETE `/orders/:id/files...`) must double-check tenant scope:
(a) verify the **order** itself belongs to `ctx.tenantId` before touching files (404/403 if not), AND
(b) scope **file record** queries/mutations by `tenant_id` too — not just by `fileId` or by `order_id` path param.
The DELETE route is the highest-risk one: a naive `DELETE FROM order_files WHERE id = :fileId AND order_id = :orderId` that only validates order ownership but then deletes by `fileId` (or `fileId` + `order_id`) without an explicit `AND tenant_id = ctx.tenantId` on the file-record query itself is a bug pattern to check for in review — every file operation must filter/verify on `file.tenant_id = ctx.tenantId` in addition to the order check, not rely on order ownership alone to imply file ownership.

### 5. Acceptance criteria (verbatim)
- AC1: Upload button appears in order detail view
- AC2: File uploads to R2, appears in list
- AC3: Image files show thumbnail preview
- AC4: PDF files show document icon
- AC5: Download opens file in new tab
- AC6: Delete removes from R2 and DB
- AC7: 10MB limit enforced — oversized file shows error
- AC8: Wrong file type shows error
- AC9: Files isolated by tenant (cannot access other tenant files)
- AC10: `npm run typecheck` passes

### Ambiguities / risks flagged for implementer
1. **Multipart parsing is a different code path than the JSON+Zod validation used everywhere else.** Verified the existing pattern at `backend/src/routes/settings.ts:59-75` (`POST /settings/logo`): `await c.req.formData()` → `formData.get('file')` → `instanceof File` check → type check against an allow-set → pass to `uploadLogo()`. Implementer should follow this exact pattern for the new routes, not invent a new multipart approach.
2. **Existing `uploadLogo`/`r2.ts` pattern is a partial match, not a drop-in reuse** — three concrete gaps to close, not just "call uploadLogo": (a) `EXT_MAP` in `r2.ts` only covers image MIME types (jpeg/png/webp/gif) — no `application/pdf` entry, needed for this task's allowed types; (b) `uploadLogo`'s key format is `logos/{tenantId}/{Date.now()}.{ext}` — the task spec requires `{tenantId}/{orderId}/{uuid}.{ext}` for order files, a different convention that must be implemented fresh, not copied verbatim; (c) `uploadLogo` has no file-size check at all — the 10MB limit (AC7) has no existing precedent to reuse and must be added new in `files.service.ts`.
3. **Env var naming mismatch**: the task doc's R2 setup snippet suggests `R2_ENDPOINT`, but the actual shipped `r2.ts` uses `R2_ACCOUNT_ID` (constructs the endpoint URL itself: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`). Follow the existing `r2.ts`/`env.ts` convention (`R2_ACCOUNT_ID`), not the task doc's snippet, to avoid a second, inconsistent env var.
4. **Max files per order: 20** requires a `COUNT(*)` query before insert — easy to forget since nothing else in the codebase currently enforces a per-parent count cap; flag explicitly for implementer and reviewer.
5. **R2 key prefixing (`{tenantId}/{orderId}/{uuid}.{ext}`) is itself a tenant-isolation mechanism** (defense in depth at the storage layer) — preserve this exact convention, don't simplify/flatten it.
6. **DELETE failure ordering**: if R2 delete succeeds but DB delete fails (or vice versa), recommend treating the **DB as source of truth** — delete the DB row as the authoritative action, and treat R2 object deletion as best-effort (log failure, don't fail the request) — an orphaned R2 object is far less harmful than a DB row pointing at a deleted file. No existing precedent found for logo delete/replace to confirm this against (logo upload has no delete route), so this is a recommendation, not a verified existing pattern — flag for implementer/reviewer to confirm agreement.
7. **Public R2 URLs stored in `url: text not null`** mean anyone with the URL can access the file without auth (bucket is public per the task's own setup note). This is an intentional tradeoff per spec, not a bug — surfaced only because it's the reason the UUID-based unpredictable key naming (point 5) matters: once a URL leaks, naming unpredictability is the only remaining protection.

---

## sprint-5/05-file-uploads — DONE (2026-07-08) — PR #21

- Branch: feat/sprint-5-file-uploads
- Tests: 41/41 backend (7 pre-existing Postgres-gated tests skipped, unrelated); 14 new tests in `orders.test.ts` covering file upload/list/delete happy paths, validation errors, auth errors, tenant isolation; both `backend` and `frontend` `npm run typecheck` clean
- Review cycles: 0 (approved first pass)
- Validation: all 10 ACs confirmed at file:line, no gaps
- Non-blocking note from review: `FILE_EXT_MAP`/`EXT_MAP` in `backend/src/lib/r2.ts` have 3 overlapping entries — style nit, not filed as an issue
- PR: https://github.com/moverflow/moving-desk/pull/21

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

## audit/10-in-app-notifications — Analysis (2026-07-25)

### What is being built
A parallel, in-app notification channel that does not depend on email delivery. A new
`notifications` table, rows written at four existing trigger points (new lead/booking,
contract signed, invoice paid, 24h owner reminder), three REST endpoints to read/mark
them, and a bell icon + dropdown panel in the frontend AppShell that polls for updates.
Purely additive — no existing email logic is touched.

### Who uses it
Owner and dispatcher (authenticated web app users). Explicitly NOT crew (crew PWA is out
of scope) and NOT public/clients (no accounts). Notifications are tenant-scoped, not
per-user — every logged-in user of a tenant sees the same list (task says "for the
tenant's owner", and specifies no per-user targeting or preferences).

### DB tables touched
New table `notifications` only: `id, tenant_id, type, title, body, related_entity(+id),
read_at, created_at`. No changes to existing tables. Read-only reference to
orders/invoices/leads via the related-entity pointer (no FK enforcement needed since the
pointer is polymorphic).

### Tenant isolation requirements
- `notifications.tenant_id UUID NOT NULL`, same as every other table.
- `GET /notifications` filters by `ctx.tenantId`.
- `POST /notifications/:id/read` must use `and(eq(id), eq(tenant_id))` — never id alone,
  otherwise a user of tenant A could flip a row belonging to tenant B.
- `POST /notifications/read-all` scoped to `ctx.tenantId`.
- Creation sites must pass the tenant_id already available at that call site (booking,
  contract, invoice, reminder job all know it).

### Trigger points (verified to exist)
- `src/routes/book.ts` / `src/routes/leads.ts` — new lead/booking
- `src/services/contract.service.ts:244` — `sendContractSignedNotification(...)`
- `src/services/invoices.service.ts:230` — `markInvoicePaidFromSession(...)`, called from
  `src/services/billing.service.ts:117` (Stripe webhook path)
- `src/jobs/reminder.ts` — 24h move reminder, owner-facing case only

### Acceptance criteria (verbatim from task)
1. Submitting a booking, signing a contract, and paying an invoice each produce a visible
   in-app notification for the tenant's owner, without requiring email to work.
2. Notifications are tenant-scoped (no cross-tenant leakage).
3. Unread count updates; clicking a notification marks it read and navigates to the
   relevant record.
4. Tests for notification creation at each trigger point and for tenant isolation on GET.

### Assumptions (requirements are thin in these spots)
- A1: Notification creation is fire-and-forget — wrapped so a DB error is logged and
  swallowed, never propagated. This is explicit in the task (§Backend.4) and is the same
  posture the existing email calls already take.
- A2: `related_entity` is modelled as two columns (`related_type` + `related_id`) rather
  than one opaque string, so the frontend can build the correct route without parsing.
- A3: Notification `title`/`body` are rendered server-side at creation time (denormalised
  snapshot), not templated at read time. Simpler and matches the email payloads.
- A4: Polling interval 30s via TanStack Query `refetchInterval`.
- A5: "Paginated" = `limit`/`offset` (or cursor) query params with a sane default (e.g.
  20); the dropdown shows the most recent page only, no infinite scroll.
- A6: No per-user read state — `read_at` is a single column on the row, so one user
  marking read marks it read for the whole tenant. Per-user read tracking would need a
  join table and is not asked for.

### Risks
- R1: The Stripe webhook path (invoice paid) must not fail if notification insert throws —
  a thrown error there could cause Stripe to retry the webhook and double-process.
- R2: `jobs/reminder.ts` runs outside a request context; needs tenant_id sourced from the
  order row, not from a ctx.
- R3: The public booking route (`routes/book.ts`) is unauthenticated — tenant_id must come
  from the resolved booking-page tenant, never from client input.

## audit/10-in-app-notifications — DONE (2026-07-25) — PR pending

- Branch: feat/in-app-notifications (pushed; PR not opened — `gh` token invalid)
- Tests: backend 298 passed / 7 pre-existing Postgres-gated skips (unrelated); frontend 200 passed. New: `routes/notifications.test.ts` (14), `services/notifications.service.test.ts` (13), `services/contract.service.test.ts` (6, new file), `services/invoices.service.test.ts` (4, new file), plus additions to `leads.service.test.ts`, `jobs/reminder.test.ts`, `OrdersPage.test.tsx`, `lib/utils.test.ts`, and `NotificationBell.test.tsx` (10) + `useNotifications.test.ts` (4). typecheck/lint/build clean both sides.
- Review cycles: 1 — two issues found and fixed:
  1. Validation: lead notification body rendered a raw phone (`9496329557`) instead of the required `(949) 632-9557`. Added a local `formatLeadPhone` that leaves non-10-digit input untouched (booking page and Zapier accept arbitrary strings).
  2. Review: `NotificationBell` was 86 lines and `sendDailyReminders` 94 (already over before this change). Extracted `NotificationPanel` and `remindOneOrder`.
  A third bug was caught by the tests themselves: `LEAD_SOURCE_LABELS.manual` was `'added manually'` under an `Added ${...}` template → "Added added manually".
- Key structural finding: `sendDailyReminders` only flips `reminder_sent` after a successful email send, and the `!client?.email` guard sat above the timezone check — so a notification placed after either would never be created while email is broken, defeating the purpose. Tenant lookup + timezone check moved above the email guard; notification deduped on (tenant_id, type, related_id) rather than `reminder_sent`. Email behaviour unchanged.
- Deviations: `related_entity` split into `related_type` + `related_id`; hooked `createLead()` instead of the two routes (single choke point for all three lead sources); `?order=` / `?invoice=` deep links wired to satisfy the "navigates to the relevant record" AC — `?order=` was already used by the contract-signed email but `OrdersPage` never read it.
- Open questions left for the reviewer: notifications are tenant-scoped rather than per-user (read state is shared); `GET /notifications` is reachable by a `crew` token, matching every other resource route.

---

## audit/11-seed-script-flexible

### What is being built
Rework of `backend/scripts/seed-analytics.ts` so it can seed demo data for any tenant
identified by CLI arg (slug or owner email), creating the tenant + owner if it doesn't
exist yet, instead of aborting on a single hardcoded UUID. Also fixes three ways the
seeded data is already stale relative to the app: invoices never get `expires_at` (public
share link always 404s), no `leads` are seeded (Leads tab demos empty), and invoice
numbering can collide with real invoices created after seeding.

### Who uses it
Internal only — run manually (`npm run seed -- <identifier>`) by whoever is prepping a
demo for a pilot company. Not reachable from the app or any HTTP route.

### DB tables touched
`tenants`, `users` (create-if-missing path only), `crews`, `clients`, `orders`,
`invoices`, `leads` (new — script previously didn't touch this table at all).

### Tenant isolation requirements
Not request-scoped (no ctx.tenantId, no JWT) — this is an offline script connecting
directly via `pg.Pool`. The equivalent discipline here is: every insert across every
table must carry the *same* resolved `tenant_id`, and the resolution step (slug/email →
tenant, or create-new) must happen exactly once at the top so nothing downstream can
accidentally target the wrong tenant.

### Acceptance criteria (verbatim from task)
1. Running the script with a new tenant slug/email creates that tenant (if needed) and
   populates it with orders, clients, invoices (with working share links), and leads
   across pipeline stages — usable to demo the full product to a brand-new pilot company
   in one command.
2. Running it again against an already-seeded tenant doesn't hard-crash or produce
   duplicate/colliding invoice numbers.

### Existing patterns to reuse (found during explore)
- `registerTenantAndUser` (`services/auth.service.ts:95`) — transaction creating
  tenant+user+subscription; seed's create-path should mirror shape (trial plan,
  14-day trial) but doesn't need the Stripe customer call (out of scope, demo-only).
- `generateUniqueSlug` / `generateSlug` (`services/auth.service.ts`) — reuse directly for
  slug derivation from a company name when creating from an email identifier.
- Invoice numbering: app itself uses `count(*) + 1001` per tenant
  (`services/invoices.service.ts:26-32`), not the script's `existingOrderCount + 1001` —
  aligning on count(*) over invoices (not orders) removes the collision.
- `expires_at`: app sets `now + 7 days` at generation time
  (`services/invoices.service.ts:34-35`); `getPublicInvoice` requires
  `expires_at > now()` (`services/invoices.service.ts:301`) — seeded invoices need the
  same, but backdated seed invoices need `expires_at` computed from *seed time*, not
  from the historical `sent_at`, or "working share link" fails for anything seeded >7
  days in the past.
- bcrypt rounds 12 for password hashing (`routes/auth.ts:66`), same as the rest of the
  app — used for the seed's synthetic owner password when creating a new tenant.
- No existing `findTenantBySlug` helper — a plain `eq(tenants.slug, ...)` lookup is
  simplest, matching how `generateUniqueSlug` already does its own slug lookup inline.

### Assumptions
- A1: CLI identifier disambiguation: contains `@` → owner email lookup; otherwise →
  tenant slug lookup. Matches "slug or owner email, whichever is easier."
- A2: Creating from a slug that doesn't exist yet: company name is title-cased from the
  slug, owner email synthesized as `owner@<slug>.demo.local` (never sent to, script-only,
  won't collide with real users), a random password (hashed, rounds 12) since login isn't
  the point of the demo — the script prints it in case someone wants to log in as that
  user.
- A3: Creating from an email that doesn't exist yet: company name derived from the local
  part of the email, slug via `generateUniqueSlug`.
- A4: Leads seeded across all five statuses (`new/contacted/quoted/booked/lost`) — a
  handful (~8-10), independent of the orders/invoices generation loop.
- A5: Invoice numbering fix uses `count(*) FROM invoices WHERE tenant_id = ...` at start
  (matching the app), not a stored high-water mark — good enough since this is a
  single-writer offline script, no concurrent-insert race to worry about.

### Risks
- R1: Re-running against an existing tenant must not recompute `expires_at` off of
  already-seeded invoices' original creation time — every re-run should still produce
  invoices whose share link is valid *now*, or the acceptance criterion "still works to
  demo" silently regresses on the second run.
- R2: The `--force` re-run path currently only guards the orders-count check; the new
  leads seeding must be similarly idempotent-safe (either always add a small fixed batch,
  or skip if leads already exist for that tenant) so repeated runs don't pile up
  unbounded leads.

## audit/11-seed-script-flexible — DONE (2026-07-25) — PR pending

- Branch: feat/flexible-seed-script (pushed; PR not opened — `gh` token invalid, same
  keyring issue as audit/10)
- Implementation: `resolveTenant()` now accepts a slug or an owner email, resolves an
  existing tenant/owner or creates a brand-new trial tenant + owner + subscription
  (bcrypt rounds 12, matching `routes/auth.ts`); `seedLeads()` seeds 9 leads across all
  5 pipeline statuses, skipped on re-run if the tenant already has any; invoice
  `expires_at` is always computed from *seed time* (`now + 7 days`), not the historical
  move/sent date; invoice numbering now starts from `count(*) FROM invoices WHERE
  tenant_id = ...` (matching `services/invoices.service.ts`) instead of the order count,
  removing the collision risk. `main()` and its former ~90-line inline body were split
  into ~20 small single-purpose functions (`resolveTenantByEmail/BySlug`,
  `createTenantWithOwner`, `seedCrews`, `seedClients`, `planOrders`, `seedOneOrder`,
  `seedOrdersAndInvoices`, etc.) to bring every function under CLAUDE.md's 40-line limit
  and make the core logic unit-testable — added an `isMainModule` guard
  (`fileURLToPath(import.meta.url) === process.argv[1]`) so `main()` only auto-runs the
  CLI, not on import.
- Tests: new `scripts/seed-analytics.test.ts` (13 tests: 2 pure slugify/titleCase tests
  always run, 11 real-Postgres-gated — same skip-if-unreachable pattern as
  `dashboard.service.test.ts`). Full backend suite: 300 passed / 18 skipped (7
  pre-existing dashboard + 11 new, both DB-gated). Validated for real: spun up a
  throwaway local Postgres (`initdb`/`pg_ctl`, homebrew), ran `drizzle-kit push`, then
  ran the test file against it (all 13 pass) and ran the actual CLI end-to-end —
  slug-create, email-create, existing-slug re-run with `--force`, and no-identifier
  usage message. Confirmed via `psql`: zero duplicate invoice numbers across two runs
  against the same tenant, every invoice's `expires_at` in the future, leads spanning
  all 5 statuses. Backend typecheck/lint clean (`scripts/` isn't in the eslint `src/**`
  glob — pre-existing scope, unchanged).
- Review cycles: 1 (self-review against `.claude/agents/reviewer.md` checklist) — found
  4 functions over the 40-line limit (`createTenantWithOwner` 42,
  `resolveTenant` 51-line combined slug/email branch, `seedOneOrder` 51,
  `seedOrdersAndInvoices` 46, `main` 41) and extracted helpers for each
  (`ensureUniqueSlug`/`insertTenantOwnerAndSubscription`, `resolveTenantByEmail`/
  `resolveTenantBySlug`, `buildOrderValues`, `countInvoices`/`logProgress`, `connectDb`)
  until every function was ≤33 lines. `console.log` (vs. pino logger) and the lack of
  per-call try/catch were both treated as accepted, pre-existing conventions for this
  CLI-only script (established by the original merged version of this file), not
  reviewer-checklist violations — those rules target request/response app code.
- Deviations: CLI identifier disambiguation is `@` in the string → email, else → slug
  (task said "whichever is easier" without picking one); synthetic owner email for a
  slug-only create is `owner@<slug>.demo.local` (never sent to, script-only).

---

## audit/12-payment-handling — Analysis (2026-07-25)

### What is being built
Six correctness fixes to Stripe payment/billing handling, grouped since they all touch
`billing.service.ts` / `invoices.service.ts` / the webhook route:
- S1: handle `async_payment_succeeded/failed`, `checkout.session.expired`,
  `charge.refunded`, `charge.dispute.created` (currently unhandled — fall through the
  switch as silent no-ops); flag (log, still record) an `amount_total` vs `total_price`
  mismatch instead of accepting it silently.
- S2: `PaySuccessPage` polls actual invoice status instead of unconditionally showing
  success; drop the dead `window.close()` button.
- S3: new `stripe_events` ledger — persist processed event ids (idempotency) and ignore
  events older than the last one already applied per customer (ordering), so an
  out-of-order `customer.subscription.updated` can't regress `active` back to
  `past_due`.
- S4: null-check `customer` on `invoice.payment_failed` instead of a `!` assertion that
  throws → infinite Stripe retry.
- S5: hard-fail missing `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` in production
  (mirrors the existing `assertStorageConfigured()` R2 pattern); log instead of silently
  defaulting to `'basic'` in `getPlanFromPriceId` on an unrecognized price id.
- S6: unique index on `invoices(tenant_id, number)` + retry-on-conflict in
  `generateInvoice`, replacing the bare `count(*)+1001` race.

### Who uses it
Internal billing pipeline (Stripe webhooks, cron-free) plus the public,
unauthenticated `/pay/success` and `/i/:token` client-facing pages. No new
owner/dispatcher-facing UI.

### DB tables touched
New `stripe_events` table (S3). `invoices` — new unique index `(tenant_id, number)`
(S6), status gains `'refunded'`/`'disputed'` values (TS-only `$type` widening, no DDL —
column is already a bare `varchar(20)`, not a Postgres enum). `notifications.type` gains
`'invoice_refunded'`/`'invoice_disputed'` (same, TS-only). `subscriptions` — read/write
unchanged, just gated by the new ordering check.

### Tenant isolation
Webhook handling is inherently trusted/tenant-agnostic context (same posture as the
existing `markInvoicePaidFromSession` comment: "Trusted context: verified webhook, no
tenant") — tenant is resolved downstream via `stripe_customer_id`/`payment_intent_id`
joins, unchanged pattern. `stripe_events` has no `tenant_id` (Stripe events aren't
tenant-scoped at the API level); ordering key is Stripe's own `customer_id`.

### Acceptance criteria (verbatim, condensed)
1. Async payment, refund, dispute events each produce correct invoice status.
2. `PaySuccessPage` reflects actual status.
3. Out-of-order webhook delivery doesn't regress subscription status.
4. `invoice.payment_failed` with null customer doesn't throw.
5. Missing Stripe env vars fail startup in production.
6. Concurrent invoice creation can't produce duplicate numbers — with a test proving it.

### Key implementation decisions
- Reuse the existing `getPaidInvoiceEmailData` join (already pulls `orders`) to also
  select `total_price`, instead of adding a second query, for the mismatch check — keeps
  `markInvoicePaidFromSession`'s query shape unchanged.
- `success_url` in `createInvoicePaymentLink` gains `&token=${shareToken}` — without it,
  `PaySuccessPage` has no way to know which invoice to poll (today only `session_id` is
  passed, which the frontend never had a use for).
- `isUniqueViolation` (Postgres code `23505`) already exists as a local helper in
  `clients.service.ts` — duplicating the same 6-line helper into `invoices.service.ts`
  rather than extracting a shared lib, matching the existing non-shared precedent.
- S6's "test that fires concurrent requests" can't be meaningfully faked — needs a real
  Postgres instance (same skip-if-unreachable convention as `dashboard.service.test.ts`).
  Same for the new `stripe-events` ordering ledger (MAX(created) query).

### Risks
- R1: refund/dispute events carry `charge.payment_intent`, not an invoice id directly —
  matching back to our `invoices` row is via `stripe_payment_intent_id`, which is only
  set once payment succeeds; a refund/dispute on a payment_intent we never recorded
  (shouldn't happen, but defensively) must no-op rather than throw.
- R2: the new "ignore older events" check must not apply to `checkout.session.*` events
  (invoice-status-affecting, not subscription-status-affecting) — only to the four event
  types that write `subscriptions.status`, or a legitimately-late invoice webhook could
  get dropped.

## audit/12-payment-handling — DONE (2026-08-01) — PR pending

- Branch: fix/payment-handling (pushed; PR not opened — `gh` token invalid, same
  keyring issue as audit/10 and audit/11)
- S1: `handleCheckoutCompleted` now branches on `payment_status` instead of
  early-returning; new `checkout.session.async_payment_succeeded` (→ same paid path),
  `checkout.session.async_payment_failed`/`.expired` (→ clears the stale
  `stripe_checkout_session_id`, invoice stays `sent` so the same share link still
  works), `charge.refunded`/`charge.dispute.created` (→ new `invoices.status`
  values `'refunded'`/`'disputed'`, looked up by `stripe_payment_intent_id`).
  `markInvoicePaidFromSession` now compares `amount_total` against the order's
  `total_price`; a mismatch is `logger.error`'d and the notification title is
  prefixed `⚠️` — still marks paid, since the money did move.
- S2: `PaySuccessPage` now reads `?token=` (added to `success_url` — it only ever
  had `session_id`, which nothing read) and polls `GET /invoices/share/:token` via
  `usePublicInvoice(token, { pollUntilResolved: true })` until status leaves
  `'sent'`. Dead `window.close()` button removed.
- S3: new `stripe_events` table + `stripe-events.service.ts` (`claimStripeEvent`) —
  dedupes by event id (any type) and additionally rejects an event as `'stale'` if
  it's an older `customer.subscription.created/updated/deleted` or
  `invoice.payment_failed` than the last one already applied for that Stripe
  customer. Ordering is scoped to that 4-type set only — checkout/charge events for
  the same customer are never treated as stale.
- S4: `invoice.payment_failed`'s `customer!` non-null assertion replaced with a
  null-check + `logger.warn` no-op.
- S5: `lib/stripe.ts` gained `assertStripeConfigured()`, exact mirror of
  `assertStorageConfigured()` in `r2.ts` — hard-fails at startup in production if
  `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` are unset; wired into `index.ts`
  alongside the R2 check. `getPlanFromPriceId` now `logger.error`s the unmatched
  `priceId` before defaulting to `'basic'`.
- S6: rejected the originally-implemented retry-on-23505-conflict approach after
  writing a concurrency test that fires 10 (then 40, to stress it) truly-parallel
  `generateInvoice()` calls for one tenant — it still produced duplicate numbers
  under load, because multiple losing retries can recompute the identical
  `count(*)+attempt` candidate before any of them commits. Replaced with a
  dedicated `invoice_counters` table (`tenant_id` PK, `last_number`) and a single
  `INSERT ... ON CONFLICT (tenant_id) DO UPDATE SET last_number = last_number + 1
  RETURNING last_number` — Postgres serializes concurrent upserts on the same row
  via a row lock, so no count-read race is possible regardless of concurrency. The
  counter seeds itself from the tenant's current `count(*)` on first use (via
  `onConflictDoNothing`) so a tenant with invoices already in the table (e.g. from
  the demo seed script, task 11) can't collide with a fresh counter starting at
  1001. `invoices_tenant_number_idx` unique index kept as a defense-in-depth
  backstop, no longer load-bearing for correctness.
- Tests: backend 324 passed / 28 skipped (7 pre-existing dashboard + 7 new
  stripe-events + 3 new invoices-concurrency + 11 pre-existing seed-analytics, all
  Postgres-gated); frontend 206 passed. New files: `lib/stripe.test.ts` (7),
  `services/stripe-events.service.test.ts` (7, real Postgres),
  `services/invoices.concurrency.test.ts` (3, real Postgres — includes the 10-way
  concurrent uniqueness proof), `routes/../routes/PaySuccessPage.test.tsx` (6,
  frontend). Extended `billing.service.test.ts` (17, was 5) and
  `invoices.service.test.ts` (9, was 4). Validated all four real-Postgres-gated
  files against a live throwaway local Postgres, both individually and the full
  matrix.
- Review cycles: 1 (self-review against `.claude/agents/reviewer.md`) — found and
  fixed 4 functions over the 40-line CLAUDE.md limit in `billing.service.ts`/
  `invoices.service.ts` (extracted `notifyInvoicePaid`, split
  `dispatchWebhookEvent` into `dispatchCheckoutOrChargeEvent`/
  `dispatchSubscriptionEvent`, extracted `connectDb`), and 2 in the frontend
  (`PaySuccessPage` extracted to a data-table + `resolveOutcome`,
  `PublicInvoiceContent` split into new `InvoiceHeader`/`InvoicePaymentStatus`).
  No `any`, no `console.log`, no missing tenant scoping introduced (webhook-driven
  functions stay in the pre-existing "trusted context, no tenant" posture, matching
  the comment already on `markInvoicePaidFromSession` from before this task).
- Incidental fix: found and fixed a **pre-existing** test-isolation gap while
  validating the full real-Postgres matrix together — `dashboard.service.test.ts`
  and `scripts/seed-analytics.test.ts`'s `beforeEach` cleanup predated `invoices`/
  the new `invoice_counters` table and didn't delete them, so leftover rows from
  one real-Postgres test file running before another (sharing one persistent local
  DB) could break the next file's own cleanup via FK violations. Added the missing
  deletes to both. A second-order version of the same gap (unscoped deletes
  clobbering a *different* file's still-referenced rows) was identified but left
  alone — CI never runs any of these four files together against a persistent DB
  (all skip when unreachable), and fully scoping every real-Postgres test file's
  cleanup by tenant id is a larger test-infra change out of this task's scope.
- Deviations: `success_url` gained a query param (`&token=`) that wasn't explicitly
  asked for — required for S2 to be implementable at all, since `PaySuccessPage`
  had no way to identify which invoice to poll otherwise.

---

## audit/13-mobile-responsiveness — Analysis (2026-08-01)

### What is being built
Responsive fixes for six owner-facing frontend surfaces so they're usable at
375–430px viewport widths, without touching the (already-responsive) Crew PWA or
changing desktop layout. Pure frontend/CSS-and-layout work — no backend, no DB.

### Who uses it
Owner and dispatcher, on their own phones — same auth/role gating as today, this
task changes no access control, only layout.

### DB tables touched
None.

### Verified against the current code (not just the task's description)
- `AppShell.tsx`: header is `px-8`, nav is a flat `<nav className="flex ...">` with
  up to 7 `NavTab`s (5 base + Dashboard + Settings for owner), labels
  `hidden sm:inline` but icons alone still don't fit width-wise with the wordmark +
  NotificationBell + UserMenu at 375px. No mobile nav exists at all today.
- `InvoicesPage.tsx`: `flex h-[calc(100vh-60px)]` with `<aside className="w-72">` —
  a fixed 288px sidebar leaves ~87px for the detail pane at 375px, confirmed.
- `SettingsPage.tsx`: `TabsList` (shadcn, `inline-flex`, no wrap/scroll built in)
  holds 6 `TabsTrigger`s with no `overflow-x-auto` wrapper — will overflow, not
  wrap, at 375px. Card uses a fixed `padding: '28px 32px'` inline style.
  `NewOrderPage.tsx` uses the exact same `cardStyle` object (copy-pasted).
- `PageContainer.tsx`: fixed `paddingLeft/Right: 32` inline styles, no breakpoints
  — confirmed zero responsive behavior, used by SettingsPage/NewOrderPage/
  InvoicesPage's detail pane.
- `ClientsPage.tsx`: plain `<table>`, 5 columns (Name/Phone/Last move/Orders/
  actions), no wrapper — will overflow at 375px since HTML tables don't reflow.
  Header row (search input + button) is an unconstrained `flex` that could also
  overflow with both at full/max-width.
- `SchedulePage.tsx`: FullCalendar `timeGridWeek` (7-day grid + its own internal
  prev/next/today/title toolbar) has no width accommodation for mobile at all.
- The Orders Kanban (`OrdersPage.tsx:48-49`) already does exactly the reference
  pattern the task names: `<div className="overflow-x-auto"><div className="flex
  gap-4 min-w-[800px]">`.

### Acceptance criteria (verbatim)
1. Each listed page usable (no cut-off content, no unreachable controls, no
   horizontal overflow of the whole page) at 375px.
2. AppShell nav fully usable (all items reachable) at iPhone widths.
3. Before/after screenshots at 375px for each page in the PR description.

### Plan per file
- **AppShell**: `hidden sm:flex` on the existing desktop `<nav>`; new hamburger
  button (`sm:hidden`) opening a `Sheet` (`side="left"`, already used elsewhere in
  this codebase for OrderDetailSheet/ClientDetailSheet) listing every nav item
  stacked vertically with labels always visible — chosen over a bottom tab bar
  because 7 items (owner) don't fit a bottom bar without hiding some, and a
  hamburger+drawer needs no per-item priority decisions or new "more" menu
  concept. Header padding `px-4 sm:px-8`.
- **InvoicesPage**: on mobile, show the list OR the detail (not both) based on
  selection — list is the default view; selecting an invoice shows the detail
  pane with a `sm:hidden` "← Back" button that clears selection. `sm:` and up:
  unchanged side-by-side. This is the "collapsible" option the task offers, not
  the "stack vertically" one — a stacked full list + full detail on one scrolling
  page would be usable but poor UX for no added cost to implement the toggle
  instead.
- **SettingsPage**: wrap `TabsList` in `overflow-x-auto` (Kanban's own pattern);
  card padding moves from the fixed inline style to `p-4 sm:px-8 sm:py-7`.
- **NewOrderPage**: same card-padding fix; `AddressFields`/`FloorElevatorSection`
  (the actual `grid-cols-2` fields rendered inside this page) get
  `grid-cols-1 sm:grid-cols-2` — not listed by name in the task, but they're
  NewOrderPage's own content, so fixing the page means fixing these.
- **ClientsPage**: header row `flex-col sm:flex-row`; table wrapped in
  `overflow-x-auto` (same Kanban-style horizontal-scroll reference pattern the
  task explicitly says to reuse "where a fixed-width layout can't reasonably
  reflow" — a data table is exactly that case, not a candidate for a full
  card-list redesign in this task's scope).
- **SchedulePage**: FullCalendar wrapped in `overflow-x-auto` + a `min-w-[...]`
  inner container, same reasoning — a 7-column week grid can't reflow to a single
  column without changing the view entirely (out of scope: "do not redesign
  desktop layouts").
- **PageContainer**: fixed inline `paddingLeft/Right: 32` → `px-4 sm:px-8`
  Tailwind classes (keeps the existing `maxWidth` variant logic, which is
  numeric-px-driven and stays as inline style).

### Risks
- R1: Screenshot capture requires a running dev server + browser automation
  (Playwright/Chrome DevTools viewport emulation) — not just a code read. Must
  actually launch the app and resize to 375px before/after, per this session's
  standing instruction for UI changes ("start the dev server and use the feature
  in a browser before reporting complete").
- R2: AppShell's mobile drawer must reuse the exact same `NAV_ITEMS` array (not a
  second hand-maintained list) so it can never drift from the desktop nav.

## audit/13-mobile-responsiveness — DONE (2026-07-26) — PR pending

- Branch: fix/mobile-responsiveness (pushed; PR not opened — `gh` token invalid,
  same keyring issue as the last three tasks)
- Implementation matched the analysis plan: `MobileNavDrawer.tsx` (new) + hidden
  desktop `<nav>` below `sm:` in `AppShell.tsx`; `InvoicesPage.tsx`'s
  `mobileShowDetail` state toggles list vs. detail on mobile with a "← Back to
  invoices" button; `SettingsPage`'s `TabsList` wrapped in `overflow-x-auto`;
  `ClientsPage`'s table wrapped the same way (`min-w-[560px]`); `SchedulePage`'s
  FullCalendar wrapped in `overflow-x-auto` + `min-w-[640px]`;
  `NewOrderPage`/`AddressFields`/`FloorElevatorSection`'s `grid-cols-2` → 
  `grid-cols-1 sm:grid-cols-2`; `PageContainer`'s fixed 32px inline padding →
  `px-4 sm:px-8` Tailwind classes.
- Validation: spun up an isolated local Postgres (never touched the real
  `backend/.env`, which points at what looks like a live production Neon DB with
  real Stripe/Resend/R2 keys — registered/seeded only against the throwaway local
  one), started both dev servers, and used Playwright (installed fresh — no
  `chromium-cli` available in this environment) to register a test tenant, seed
  it via the task-11 seed script, and screenshot all 6 pages at a 375×812
  viewport. Confirmed the "before" bugs exactly as described (nav icons +
  bell/user-menu overflowing off-screen; invoices detail pane reduced to a
  cut-off ~87px sliver; Settings tabs hard-clipped with Booking/Integrations
  unreachable; Clients table + header overflowing the whole page horizontally)
  and confirmed each is fixed after. Also drove the interaction, not just the
  static layout: opened the mobile nav drawer (all 7 items present, tapping one
  closes it), tapped an invoice into detail view and back out via the Back
  button, with real seeded data (client names, invoice statuses, addresses).
  13 screenshots (6 before + 7 after, including the drawer-open and
  invoice-detail states) committed to `docs/screenshots/mobile-responsiveness/`
  for the PR body, per the acceptance criteria's explicit ask.
- Tests: frontend 210 passed (was 206) — new `MobileNavDrawer.test.tsx` (3:
  closed by default, opens and lists every passed-in item, closes on nav click)
  and a new `InvoicesPage.test.tsx` case asserting the actual `hidden`/`block`
  className toggling on the aside/main elements around a click + Back-button
  cycle (jsdom doesn't apply the real Tailwind stylesheet, so `toBeVisible()`
  can't observe the CSS effect directly — asserting on the class names the
  component computes from `mobileShowDetail` is what's actually being tested,
  same convention this codebase already uses elsewhere for conditional
  rendering). All 5 pre-existing page test files pass unchanged. typecheck/lint/
  build clean.
- Review cycle: 1 (self-review against 40-line rule) — `MobileNavDrawer` (42),
  `ClientsPage` (51) and `InvoicesPage`'s render tree (was 131, nearly all of it
  the return statement) were over. Extracted `DrawerNavLinks`, `ClientsTable`,
  and — for InvoicesPage — `InvoiceListPane`/`InvoiceGenerateControls`/
  `InvoiceDetailPane`, bringing every render-side function under 40. Left
  `InvoicesPage`'s own function at 88 lines: after the extraction it's almost
  entirely pre-existing hook/business logic (eligible-order computation,
  generate handler, deep-link effect) that predates this task and has nothing to
  do with mobile layout — refactoring that is a separate, riskier change this
  task didn't ask for. No `any`, no `console.log`, no new tenant-isolation
  surface (frontend-only, no new API calls).
- Deviations: chose a hamburger + `Sheet` drawer over a bottom tab bar for
  AppShell — 7 items (owner) don't fit a bottom bar without hiding some, and the
  drawer needed no per-item priority decisions; `Sheet` was already the
  established pattern for slide-over panels in this codebase.

---

## incident/prod-migration-duplicate-invoice-numbers — RESOLVED (2026-07-26)

Production Railway deploy of PR #53 (payment-handling, S6) failed:
`could not create unique index invoices_tenant_number_idx` — duplicate
`(tenant_id, number) = (33b29222-392a-408b-a0c3-115336acd98f, INV-1036)`.

- Connected read-only first (`BEGIN TRANSACTION READ ONLY`) to the real prod
  Neon DB (`backend/.env` → `NEON_BRANCH=production`).
- Found exactly **one** duplicate pair in the whole `invoices` table (not
  multiple) — a full `GROUP BY (tenant_id, number) HAVING count(*) > 1` scan
  confirmed it.
- Tenant `33b29222-392a-408b-a0c3-115336acd98f` = "Best Pro 3" (slug
  `best-pro-3`) — **not** the previously-flagged "Delivery Probe Co"
  (`abb8543a-…`, task 09) — a different dev/test tenant. Owner
  `bestpro3@gmail.com` ("Yurii"), plus a `crew@test.com` "Test Crew" user.
  All 35 other invoices on this tenant were created within a 13-second window
  (bulk seed-script run); one row's client/address data exactly matched the
  hardcoded `CLIENT_DATA`/`ADDRESSES` arrays in `scripts/seed-analytics.ts`;
  the other row's client was literally "Yurii" / `bestmover.flow@gmail.com`
  (the developer's own identity, same address used throughout the task-09
  email investigation) with informal placeholder addresses — a manual test
  order. Root cause: a live instance of the exact S6 bug PR #53 fixes — the
  seed script and the app's own (pre-fix) `count(*)+1001` numbering both
  landed on 1036 five days apart, with neither aware of the other.
  **Confirmed test/demo data, not a real pilot customer — safe to resolve.**
- Fix: renumbered the later (app-generated, `sent`-status) row from `INV-1036`
  to `INV-1037` — a single `UPDATE`, not a delete, to stay minimally invasive.
  Verified zero duplicates remain anywhere in the table afterward, and that
  the total invoice count (39) and tenant count (7) were unchanged (only a
  rename happened, nothing added/removed).
- Confirmed the migration will now pass: ran the **exact** pending SQL from
  `drizzle/0011_numerous_invisible_woman.sql` +
  `drizzle/0012_lucky_the_twelve.sql` against real production data inside a
  transaction, verified every object (`stripe_events`, `invoice_counters`,
  both indexes, the FK) was created without error, then `ROLLBACK` — proven
  safe against actual current data with zero lasting side effects, and
  confirmed via a follow-up read that the dry-run objects were indeed gone
  afterward (the rollback held).
- Next deploy attempt should now pass this migration cleanly.

---

## audit/16-fix-booking-enabled-default — DONE (2026-07-26)

Follow-up to audit/15 (diagnosis only, no fix). Chose option (a) from the task
— default `booking_enabled: true` at tenant creation — over building an
onboarding-step prompt: it fully guarantees the acceptance criterion (no
"owner skipped the prompt" gap an onboarding step would leave open), and is a
one-field change vs. new UI/flow.

- `services/auth.service.ts` — `registerTenantAndUser`'s tenant insert now
  sets `booking_enabled: true`. Verified live: a fresh `/auth/register` call
  followed immediately by `GET /book/:slug` (no Settings visit at all)
  returns 200 with the tenant payload.
- `BookingTab.tsx` — "Copy link"/"Open →" now read the *persisted*
  `settings.bookingEnabled`, not the local (possibly unsaved) switch state:
  disabled + amber "Enable booking above to activate this link." message
  whenever the link would actually 404. Verified live, including the
  easy-to-get-wrong edge case: flipping the switch on locally without
  clicking Save keeps the buttons disabled (matches reality — the link still
  doesn't work until Save lands), and `GET /book/:slug` genuinely 404s in
  that state, confirmed via curl against the same running instance.
- Tests: new `services/auth.service.test.ts` (2 — first coverage
  `registerTenantAndUser` has ever had) and `components/shared/
  BookingTab.test.tsx` (4, including the unsaved-toggle case). Backend 326
  passed (was 324), frontend 214 passed (was 210).
- Review: extracted `BookingLinkControls`, `BookingEnableSwitch`,
  `BookingDescriptionField` from `BookingTab.tsx` (was 77 lines pre-existing,
  now 51 — the remainder is pre-existing hook/state logic, further extraction
  into a custom hook felt disproportionate for a settings tab). Left
  `registerTenantAndUser` at 69 lines (64 pre-existing + 5 for this change) —
  same reasoning: a one-field addition to already-oversized, security-
  sensitive transaction logic isn't the place to attempt a bigger refactor.
- Out of scope, untouched per the task: `getPublicTenant`/`/book/:slug` route
  logic itself; subscription/plan logic.

---

## audit/17-fix-zero-dollar-lead-conversion — DONE (2026-07-26)

- `services/leads.service.ts` — new `priceFromLead()` calls the same
  `getTenantPricing()` source of truth `POST /orders` already uses. Prices
  from the lead's *own* `home_size` only — if it's missing, price stays `0`
  deliberately (not the schema default landing by accident): `home_size`
  still falls back to `'2br'` for the orders table's `NOT NULL` constraint,
  but that fallback is never fed into the pricing lookup, so a guessed size
  can never produce a plausible-but-wrong price. Leads have no `packing`
  column at all, so the packing fee never applies at conversion — confirmed
  by reading the schema, not assumed.
- `services/invoices.service.ts` — `generateInvoice()` now returns a
  discriminated `{ok:true, invoice} | {ok:false, reason:'not_found'|
  'zero_price'}` (matching the existing `PaymentLinkResult` convention in the
  same file) instead of `Invoice | null`, and refuses to invoice an order
  with `total_price === 0`. `routes/invoices.ts`'s `POST /invoices` maps
  `zero_price` to 422 with a clear message; no frontend changes were needed
  at all — `InvoicesPage.tsx`'s existing generic `ApiError` handling already
  surfaces any backend `{error}` message verbatim.
- Verified live end-to-end (not just unit tests): registered a tenant,
  created one lead with a home size and one without, converted both —
  `psql` confirmed the priced order at $480 and the unpriced one explicitly
  at $0 (not silently something else) — then hit `POST /invoices` for each:
  the priced order returned 201 or a real invoice, the $0 order returned 422
  with "This order has no price set yet."
- Tests: extended `leads.service.test.ts` (+2: correct-price-from-baseRates,
  no-packing-fee; existing sparse-lead test now also asserts `base_price: 0,
  total_price: 0` explicitly) and `routes/invoices.test.ts` (+4: 201 happy
  path, 404 not-found, 422 zero-price, 401 no-auth — this route previously had
  zero test coverage of `POST /invoices` at all). Updated
  `invoices.concurrency.test.ts` (from task 12) for the new result shape,
  re-verified against real Postgres. Backend 332 passed (was 326).
- Out of scope, untouched per the task: leads pipeline UI/statuses.

---

## audit/18-invite-copy-link — DONE (2026-07-26)

- `routes/users.ts` — `POST /users/invite` now returns `token` alongside
  `message`/`email` in its 201 response (this route had zero prior test
  coverage — a new `routes/users.test.ts` covers it now). The token was
  already generated and mailed via `sendInviteEmail`, which is fire-and-
  forget (`.catch` just logs) — so if Resend isn't configured or delivery
  silently fails, the owner previously had no way to get the join link at
  all.
- `hooks/useSettings.ts` — `useInviteMember`'s response type now includes
  `token: string`.
- `components/shared/TeamTab.tsx` — new `InviteSentBanner` shows the invite
  link with a "Copy link" button (same pattern as `BookingTab.tsx` from
  task 16), and stays visible with no auto-hide timer — the owner may need
  a moment to copy it, and it's the only fallback if email delivery fails.
  Replaces the previous plain `sent: boolean` + 3-second-timeout state.
- Tests: new `routes/users.test.ts` (5 — first coverage `POST /users/invite`
  has ever had: token-in-response, plan-limit 422, duplicate-email 409,
  missing-crewId 400, no-auth 401) and new `components/shared/
  TeamTab.test.tsx` (5: banner appears with link + Copy button, clicking
  Copy actually writes the link to the clipboard via `@testing-library/
  user-event`'s real Clipboard stub, banner has no auto-hide, backend error
  surfaces, crew-invite validation). Updated `routes/SettingsPage.test.tsx`'s
  existing `useInviteMember` mock and one stale assertion (`'Invite sent!'`)
  that predated this task's banner copy. Backend 337 passed (was 332),
  frontend 219 passed (was 214).
- Review: extracted `TeamMemberList` and `InviteRoleFields` from
  `TeamTab.tsx`'s default export (was 101 lines pre-existing); the remaining
  `InviteMemberForm` sits at 51 lines — same documented judgment call as
  `BookingTab.tsx` in task 16 (mutation-state handling tightly coupled to
  local state, not mechanically separable JSX).
- Verified live: registered a tenant, sent a real invite through the actual
  UI at a 375px mobile viewport (Playwright), confirmed the link renders and
  "Copy link" writes the correct `/join?token=...` URL to the clipboard —
  screenshots in scratchpad, not committed (no visual regression risk here,
  unlike task 13's mobile-responsiveness fixes).
- Out of scope, untouched per the task: the `/join` accept-invite flow
  itself; invite expiry/single-use enforcement.

---

## audit/19-contract-copy-link — DONE (2026-07-26)

- `services/orders.service.ts` — added `contract_token: orders.contract_token`
  to the shared `orderSelectFields` used by both `listOrders` and
  `getOrderById`, so `GET /orders` and `GET /orders/:id` now return it (the
  order detail panel reads from the same `useOrders()` list query, so no
  separate per-order fetch was needed). `POST /orders` and `PATCH /orders/:id`
  already returned it via `.returning()` — untouched.
  `frontend/hooks/useOrders.ts` maps `contract_token` → `contractToken` on
  `Order` (`types/index.ts`).
- `components/shared/ContractSection.tsx` — new `ContractLinkControls`
  ("Copy link" + the URL in a `<code>` block, same visual pattern as
  `BookingTab`/`TeamTab`) shown whenever `contractStatus === 'sent'` and a
  token exists — not gated on just-clicked-Resend, so it's there any time
  the order detail panel is opened, matching the acceptance criteria. Built
  with `${window.location.origin}/contract/${token}` (frontend-side), not
  `env.FRONTEND_URL` (how the backend's own contract email link is built) —
  deliberately matching the two existing frontend precedents instead.
  Resend itself is untouched — its Resend-sandbox delivery limitation is the
  separate, already-documented issue this task explicitly does not fix.
- Tests: new `routes/orders.test.ts` `GET /orders/:id` describe block (+3 —
  this route had zero coverage before: token-in-response, 404, 401) and new
  `components/shared/ContractSection.test.tsx` (6 — first coverage this
  component has ever had: link+button shown while sent, Copy actually writes
  to the clipboard via `@testing-library/user-event`'s real Clipboard stub,
  no copy-link block when the token is missing, signed state hides it,
  send-contract button visibility by order status). Backend 340 passed (was
  337), frontend 225 passed (was 219).
- Review: extracted `SignedContract`, `SentContract`, `NotSentContract` from
  `ContractSection.tsx`'s default export (was 51 lines pre-existing, over
  the limit before this task touched it) — all four functions now sit at
  13-23 lines each, well under the limit. Unlike `TeamTab`/`BookingTab`,
  this JSX was cleanly separable by status branch, so no exception was
  needed here.
- Verified live end-to-end: registered a tenant, created and confirmed a
  real order (triggering the same `sendContractForOrder` path as the
  automatic send-on-confirm), opened the order detail panel at a 375px
  viewport, copied the link, and loaded that exact URL in a second browser
  tab — confirmed it renders the real, already-working public contract page
  with the correct move details.
- Out of scope, untouched per the task: `ContractPage.tsx` and the public
  signing flow; the Resend sandbox email limitation itself.

---

## audit/20-first-login-tour — DONE (2026-07-26)

- Library choice: `react-joyride@3.2.0` (checked via `npm view` before
  picking, not assumed — actively maintained, last published 2026-07-09,
  React 16.8-19 peer range, ships its own TypeScript types). Preferred over
  `driver.js` because it's a React-native component with a per-step `before`
  hook that returns a Promise the tour awaits — the natural mechanism for
  "navigate to a different route, then show this step," vs. driver.js's
  framework-agnostic imperative API which would need hand-rolled React/router
  glue for the same behavior.
- `hasSeenTour` flag: added to the existing `TenantSettings` JSONB type
  (`backend/src/db/schema.ts`) rather than a new `tenants` column — no
  migration needed, follows the exact precedent of `contractTerms`/`phone`
  already living in that same JSONB blob. Wired through
  `settings.service.ts`'s `updateSettings` and both `GET`/`PATCH /settings`
  responses, reusing the existing owner-only settings endpoint rather than
  touching `/auth/register`, `/auth/login`, the JWT payload, or the auth
  store — deliberately the smaller, lower-blast-radius integration point.
- `components/shared/ProductTour.tsx` (new) — mounted once in `AppShell` for
  owners only (survives route changes, unlike page components behind
  `<Outlet/>`), so one Joyride instance drives navigation across Dashboard →
  Settings (Company/Crews/Team/Booking tabs) → Orders. Each step's `before`
  hook calls `navigate()` then polls (`lib/tourSteps.ts`'s `waitForElement`)
  until that page's target DOM node exists, so the tooltip never anchors to
  a not-yet-rendered element. Auto-starts once per tenant via `hasSeenTour`;
  persists `hasSeenTour: true` on both `finished` and `skipped` — dismissing
  is a first-class path, not a lesser one.
- `routes/SettingsPage.tsx` — tabs are now controlled via a `?tab=` search
  param (previously `defaultValue` only, no external control), matching the
  existing `?invoice=`/`?order=` deep-link convention already used by
  `InvoicesPage`/`OrdersPage` — required so the tour (and the manual replay
  link) can land on a specific tab, not just the default Company one.
- Manual replay: a "Take the tour" link in `SettingsPage.tsx` navigates to
  `/dashboard?tour=replay`; `ProductTour` detects that param, starts
  regardless of `hasSeenTour`, and strips the param immediately so a refresh
  doesn't re-trigger it.
- `data-tour="..."` anchors added to: `DashboardPage.tsx` (welcome heading),
  `BaseRatesFields.tsx` (rates+packing), `CrewsTab.tsx` (+ Add crew),
  `TeamTab.tsx` (invite form), `BookingTab.tsx` (link controls),
  `OrdersPage.tsx` (Kanban board) — one-line, cosmetic additions to
  pre-existing functions, left their pre-existing 40-line-limit status
  otherwise untouched (several were already over the limit before this task,
  e.g. `CrewsTab`/`OrdersPage`/`BookingTab`/`TeamTab` — same judgment call as
  prior tasks: not refactoring unrelated code for a one-line change).
- Tests: new `lib/tourSteps.test.ts` (5 — step order/content, `waitForElement`
  sync/async/timeout) and `components/shared/ProductTour.test.tsx` (7 —
  auto-starts once, does not repeat, persists the flag on both finish and
  skip, never re-fires on re-render, `?tour=replay` bypasses the flag and
  strips itself, each step's `before` hook navigates to the right route),
  mocking `react-joyride`'s `Joyride` component to capture props rather than
  rendering real Floating UI/portal internals. Updated `BookingTab.test.tsx`'s
  `Settings` fixture for the new required `hasSeenTour` field. Frontend 237
  passed (was 225, +12 net across 2 new files). Backend unaffected by this
  task's own logic (340 passed, same as before) — only touched to add the
  flag's plumbing, no new backend test needed since `updateSettings`/`GET
  /settings` have no existing dedicated test file to extend and the change
  is a one-field passthrough identical to the `contractTerms` pattern already
  in that same function.
- Review: `SettingsPage.tsx`'s default export grew to 48 lines from the new
  controlled-tabs + replay-link logic (a substantive addition, unlike the
  one-line `data-tour` tweaks elsewhere) — extracted `SettingsHeader` and
  `SettingsTabs`, bringing it to 13/22/26 lines across three functions.
  `ProductTour.tsx`'s main function sits at 50 lines — same documented
  judgment call as `BookingTab.tsx`/`TeamTab.tsx` (startup/event-handling
  logic tightly coupled to local state, not mechanically separable JSX).
- Verified live end-to-end via Playwright (not just unit tests): registered
  a fresh tenant (confirmed `hasSeenTour: false` via `GET /settings`), logged
  in, and drove all 6 steps for real — the tour auto-navigated from /orders
  (where a fresh login lands) to /dashboard on its own, then through all
  four Settings tabs and back to /orders, with the spotlight correctly
  highlighting each real target element (screenshots in scratchpad). Then
  confirmed a page reload does NOT re-show it, and separately confirmed
  "Take the tour" → `/dashboard?tour=replay` re-launches it even after
  completion, strips the query param, and Skip dismisses cleanly.
- Out of scope, untouched per the task: the static written
  documentation/one-pager (separate task); tour steps beyond the six listed
  setup-critical ones.

---

## audit/22-order-crew-assignment — DONE (2026-07-26)

- `components/shared/OrderDetailSheet.tsx` — new `CrewField` (dropdown of the
  tenant's crews, same `useCrews()`/label format as `CrewNotesFields.tsx` on
  `NewOrderPage`) alongside the existing `StatusField`, wired to the same
  `PATCH /orders/:id` the Status field already used — no backend changes
  needed for the write path itself, exactly as the task described. A
  Radix-Select-safe `UNASSIGNED` sentinel represents "no crew" (Radix
  `Select.Item` can't take an empty-string value), mapped back to `null`
  right before the mutate call, so a crew can also be explicitly cleared,
  not just set once.
- Incidental but blocking bug found and fixed during validation, in scope
  because it directly prevented this task's own acceptance criteria: the
  Sheet always resent the *current* `status` on every Save (pre-existing
  behavior, unchanged by this task's diff), but the backend's
  `patchOrderSchema` deliberately excludes `'new'` from its status enum
  (you only ever transition out of `new`, never back into it) — so an
  unchanged 'new' status 400'd the whole PATCH and silently blocked crewId
  from ever persisting. Since every booking-page-converted order starts in
  `'new'` status, this hit exactly the scenario the task describes. Fixed
  by omitting `status` from the request entirely when it hasn't changed
  (`useUpdateOrderStatus` in `hooks/useOrders.ts`, and the sheet's
  `handleSave`) — confirmed via direct `curl PATCH` calls that this was a
  real backend rejection, not a test-timing artifact, before touching
  anything.
- Tests: extended `routes/orders.test.ts` with a new `PATCH /orders/:id —
  crew assignment` describe block (+6: assign, reassign, unassign via
  explicit `null`, crew-only update never checks `isValidTransition`,
  malformed-UUID 400, no-auth 401 — this route had zero PATCH coverage
  before). New `components/shared/OrderDetailSheet.test.tsx` (6 — first
  coverage this component has ever had: pre-selects Unassigned/the current
  crew, assign, reassign, unassign, and the status-omission regression
  test). Also added a jsdom Pointer Capture / `scrollIntoView` polyfill to
  `src/test/setup.ts` — this was the first test in the repo to click-drive
  a Radix `Select`, and jsdom doesn't implement those APIs at all (same
  category as the existing `ResizeObserver`/`PointerEvent` polyfills already
  there for Radix). Backend 352 passed (was 346 on this branch's base),
  frontend 243 passed (was 237).
- Verified live end-to-end, matching the exact real-world scenario: created
  a lead via `POST /book/:slug` (the public booking flow), converted it to
  an order via `POST /leads/:id/convert` — confirmed `crew_id: null` and
  status `'new'`, exactly as the task describes — then, in a real browser,
  opened the order, confirmed it showed "Unassigned", assigned a crew, and
  confirmed via a fresh API read that it persisted. Logged in separately as
  that crew member at `/crew` and confirmed the job now appears in their
  job list (screenshot). Also verified reassigning to a second crew updates
  the same order correctly. This second pass is what caught the status/'new'
  bug above — the first attempt silently failed to persist, which is why
  the fix above exists at all.
- Out of scope, untouched per the task: `NewOrderPage`'s own crew selection
  at creation time; the booking page flow itself; `getCrewJobs`'s filter
  logic (confirmed correct as-is, not modified).

---

## audit/23-pilot-guide-page — DONE (2026-07-26)

- New public route `/guide` (`frontend/src/routes/GuidePage.tsx`), registered
  in `App.tsx` outside `ProtectedRoute` — no auth required, matching the
  existing pattern used by `/how-it-works` and `/test-guide`.
- Content lives in its own data module, `frontend/src/lib/guide-content.ts`
  — a typed `GUIDE_CONTENT: Record<'en' | 'ru', GuideSection[]>` of
  structured blocks (`p` / `subheading` / `list` / `placeholder`), one
  parallel array per language, all 10 sections from the task with real
  copy (not lorem ipsum) cross-checked against the actual current UI
  strings rather than the task notes verbatim — e.g. Settings tabs are
  Company/Team/Billing/Crews/Booking/Integrations, the invite button reads
  "Send invite" (not "Send Invite"), the invite role is "Crew member", and
  crew login is at `/crew/login` (not `/crew`, which requires a session).
  This is a lightweight strings-object i18n approach per the task's
  technical note — no i18n library added, since none existed in the repo.
- New `frontend/src/components/guide/` (following the existing
  resource-folder convention like `components/booking`, `components/crew`):
  `GuideSectionView.tsx` (renders one section's blocks, using shadcn
  `Card`/`CardContent` for visual consistency with the rest of the app),
  `GuidePlaceholder.tsx` (bordered dashed-box + label, no `<img>` tag at
  all so there is no broken-image icon risk), `GuideToc.tsx` (sticky nav,
  horizontal scroll on mobile / vertical sidebar on desktop), and
  `GuideLanguageToggle.tsx` (shadcn `Button`, EN default, switches
  `useState` in `GuidePage.tsx` — instant, no reload, no routing).
- Tests: new `routes/GuidePage.test.tsx` (4) — renders all 10 sections in
  English by default, language toggle swaps all visible text to Russian
  and back with no unmounted content lingering, every section's anchor id
  matches its TOC link's `href`, and placeholders render as labeled text
  with zero `<img>` elements on the page. Frontend suite: 247 passed (was
  243 before this branch).
- Validated: `typecheck` and `lint` both clean (lint's 4 warnings are
  pre-existing `react-refresh` warnings on unrelated files, not from this
  change), production `build` succeeds.
- Not verified: no headless-browser tool (Playwright/chromium-cli) was
  available in this environment, so mobile responsiveness and the sticky
  TOC's actual on-screen behavior were checked by reviewing the responsive
  Tailwind classes and structure only, not by rendering in an actual
  viewport — flagged to the user rather than claimed as tested.
- Out of scope, untouched per the task: real screenshots (placeholders are
  intentionally left as swap-in points); Sprint 4 items (Stripe/R2) not
  touched.

---

## audit/24-signup-copy — DONE (2026-07-26)

- Copy-only change, no logic touched. Found exactly two "trial" CTAs in the
  actual registration/login flow via grep (the task's own guess at likely
  locations was right): `RegisterPage.tsx`'s submit button ("Start free
  trial — 14 days free" → "Sign up") and `LoginPage.tsx`'s "No account
  yet?" link ("Start free trial" → "Sign up"). Dropped the "— 14 days
  free" tag from the button rather than keeping it next to "Sign up" —
  the task itself flagged this exact combination as something that "might
  read oddly," and pairing a neutral action verb with a countdown undercuts
  the point of the change. The real trial-period disclosure this dropped
  overlaps with is not lost: `TrialBanner.tsx` and `BillingTab.tsx` still
  show "X days left in your trial" / "Trial ends ..." post-signup, in
  Settings — exactly the "elsewhere" the task said not to touch.
  `AuthCard.tsx`'s subtitles ("Create your account" / "Sign in to your
  account") already had no trial language, nothing to change there.
- Updated the two existing test files that asserted on the old copy as an
  accessible-name matcher (`RegisterPage.test.tsx` ×3, `LoginPage.test.tsx`
  ×1) — these would have silently broken (wrong button not found) had the
  copy changed without updating the matchers. Full frontend suite still
  247 passed, typecheck and lint clean.
- Out of scope, untouched per the task: `SubscriptionPlan`/`plan: 'trial'`
  type, `trialEndsAt`, `TrialBanner`, `BillingTab`, and
  `.claude/context/decisions.md`'s pricing/trial policy — all logic and
  documentation, not registration/login copy.

---

## audit/25-feedback-button — DONE (2026-07-26)

- New `feedback` table (nullable `tenant_id`/`user_id`, `message`, `page_url`,
  `severity` enum) — nullable by design, not an oversight: the button also
  renders on `/guide`, which has no tenant context at all to attach a
  submission to. Migration `0013_adorable_jazinda.sql` generated via
  `drizzle-kit generate` and applied to the dev DB via `db:migrate`.
  `notifications.type`/`related_type` `$type<>()` unions extended with
  `'feedback_new'`/`'feedback'` — TS-only casts over a `varchar` column, so
  this needed no migration of its own.
- `POST /feedback` (`routes/feedback.ts`) — no `authMiddleware` (this route
  must accept anonymous callers), rate-limited 10/hour per IP via the
  existing `rateLimit()` middleware (same shape as `book.ts`'s booking
  limiter). Added `resolveOptionalAuth()` to `middleware/auth.ts` — same
  cookie/Bearer-token resolution as `authMiddleware`, but a missing or
  invalid token resolves to `null` instead of a 401, since this endpoint
  serves both logged-in and anonymous submitters. Deliberately duplicated
  rather than refactoring `authMiddleware` to share it — that function is
  security-critical and unrelated to this task's scope.
- `services/feedback.service.ts`'s `createFeedback` inserts the row, then
  calls the existing `createNotification` (tenant-scoped, swallow-and-log
  on failure — unchanged) only when `tenantId` is non-null: a fully
  anonymous submission (e.g. from `/guide`) has no owner inbox to raise a
  bell alert in, so it's stored but silent by design, matching the task's
  "no admin dashboard, a DB query is fine for now" scope note.
- Frontend: `FeedbackButton.tsx` — a small fixed bottom-right trigger (icon
  on mobile, "Report issue" label from `sm:` up) opening a bottom `Sheet`
  with a `Textarea`, a native `<select>` severity picker (Bug/Suggestion/
  Other — skipped the Radix `Select` used elsewhere on purpose, three
  options don't need it and native avoids the jsdom Pointer Capture
  polyfill dance that component needed in `OrderDetailSheet.test.tsx`),
  and a Submit button disabled until the message is non-empty. `page_url`
  auto-fills from `window.location.pathname`. On success shows "Thanks, we
  got it!" and clears the field; on failure the typed message is left
  exactly as-is (only a success clears it) and an inline error shows,
  satisfying the "don't lose what was typed" AC. Split the form itself out
  into a `FeedbackForm` sub-component to keep both functions under the
  40-line guideline. Mounted once in `AppShell.tsx` (covers every
  authenticated route through `<Outlet/>`) and individually in
  `BookingPage.tsx` and `GuidePage.tsx`, the two public pages named in the
  task.
- `useSubmitFeedback` (`hooks/useFeedback.ts`) is a thin `useMutation`
  wrapper over `apiFetch('/feedback')` — no auth-state branching needed on
  the frontend at all, since `apiFetch` already attaches a Bearer token
  only when one exists in storage and the backend resolves anonymity
  itself.
- Tests: `feedback.service.test.ts` (+5 — authenticated insert, anonymous
  insert with null tenant/user, notification raised with the right title/
  body/relatedId, notification skipped when tenantId is null, long-message
  truncation in the notification body vs. full storage in the row).
  `feedback.test.ts` route tests (+7 — authenticated, anonymous, a
  stale/invalid token treated as anonymous rather than rejected, empty
  message / missing pageUrl / invalid severity all 400, and a rate-limit
  burst test mirroring `book.test.ts`'s pattern exactly: 10 through, then
  429). `FeedbackButton.test.tsx` (+5 — closed by default, opens with the
  expected fields, submits with confirmation, failure keeps the typed
  text and shows an error, Submit disabled until non-empty). Backend: 364
  passed (was 352). Frontend: 252 passed (was 247) — `GuidePage.test.tsx`
  needed a `QueryClientProvider` wrapper added, since `FeedbackButton`
  pulled `useMutation` into a page that previously had no react-query
  hooks in its tree at all.
- Out of scope, untouched per the task: no admin UI to browse feedback
  (direct DB query is enough for now, as the task says); no email
  notification path; no screenshot attachment.

---

## audit/26-guide-image-support — DONE (2026-07-26)

- `guide-content.ts`'s `GuideBlock` placeholder variant gained an optional
  `src?: string`, set to the exact paths the task specified on all 20
  placeholder entries — both the 10 English and the 10 Russian ones, not
  just the English half the task's list happened to enumerate. Deliberate:
  a real screenshot is of the (English-only) app UI regardless of which
  language the guide text is in, so both language versions of a given
  section should show the same image once one exists.
- `GuidePlaceholder.tsx` now renders `<img src={src} alt={label}>` when
  `src` is set, with an `onError` handler flipping local `failed` state to
  fall back to the original dashed-box-plus-label look — the exact
  pre-this-task appearance, so a missing file never shows a broken-image
  icon. No `src` (shouldn't happen now, all 20 have one, but kept as a
  guard) skips the `<img>` entirely and goes straight to the fallback.
  `GuideSectionView.tsx` passes `block.src` through — the only other
  change needed.
- Tests: rewrote the one `GuidePage.test.tsx` case that had asserted "no
  img in the document" (no longer true or desired now that placeholders
  can be real images) into two — one confirming the `Screenshot: Settings
  → Company tab` placeholder now renders an `<img>` with the exact
  `/guide/settings-company.png` src, and one firing a synthetic
  `fireEvent.error()` on that `<img>` (jsdom doesn't attempt real network
  loads, so a failure has to be simulated to exercise the fallback path at
  all) and confirming the image disappears and the original label text
  reappears. Frontend: 253 passed (was 252 — net +1, two tests replacing
  one).
- No PNG files were added — deliberately out of scope per the task
  ("files will be added later"). `frontend/public/guide/` doesn't need to
  exist yet either; a 404 on a missing static asset is exactly what
  exercises the fallback path in production. Dropping a correctly-named
  file into that folder now requires no further code changes.

---

## audit/27-guide-multi-image-sections — DONE (2026-07-26)

- Migrated the placeholder content model from single `src?: string` to
  `images?: string[]` on `GuideBlock` — fully replaced rather than kept
  side-by-side, since this is internal content data with no external
  consumers to stay backward-compatible for. All 20 placeholder entries
  (10 EN + 10 RU) converted; single-screenshot sections became one-element
  arrays, four sections (settings/Booking, crew-pwa, contracts, invoices)
  became multi-element arrays using the real files the task's list named
  as the source of truth — several didn't match the filenames guessed in
  the prior task (`settings-team.png` not `-team-invite`, `settings-crew.png`
  singular not `-crews`, the whole invoice group renamed), so this task
  corrected those in the same pass rather than leaving dead paths.
  Step order within each group: booking tab → public booking page → booking
  received (settings); login → job view (crew-pwa); order's contract
  section → client-facing signing page → signed confirmation (contracts);
  invoice → sent/copy-link → payment page → payment success (invoices, the
  exact order the task specified). Same `images` array reused for both EN
  and RU entries of a section — the screenshots are of the (English-only)
  app UI regardless of guide language.
- `GuidePlaceholder.tsx` rewritten around a shared `GuideImage` sub-component
  that tracks its own load-failure state independently, so one broken file
  in a multi-image group only replaces that one thumbnail with the fallback
  box, not the whole gallery. Single-image sections render exactly as
  before (full-width, no numbering — unchanged visually from the prior
  task). Multi-image sections render as a horizontal-scroll strip of
  fixed-width (`w-56`) thumbnails with a small numbered badge per image —
  chosen over a shrinking grid so images stay full-detail-sized on any
  viewport ("not squished tiny") and the horizontal layout itself makes
  step order self-evident, reusing the same horizontal-scroll-on-mobile
  pattern `GuideToc.tsx` already established. No manual captions needed —
  adding an image is exactly "push a filename onto the array," per the
  task's point 5, with the step number auto-derived from array position.
- Tests: extended `GuidePage.test.tsx` (+2, 7 total in that file) — one
  confirming all 4 invoice-flow images render with the correct `src` in
  the exact specified order via their auto-generated "step N of 4" alt
  text, one confirming an error on the first image of that group falls
  back to just that one image's labeled box while the second image's
  `<img>` is untouched. The two single-image tests from the prior task
  needed no changes — the Company-tab placeholder is still a one-element
  array, identical rendering path. Frontend: 255 passed (was 253).
  Typecheck, lint, and production build all clean.

---

## fix/feedback-modal-centering — DONE (2026-07-26)

- Root cause: `FeedbackButton.tsx` opened its form in a shadcn `Sheet` with
  `side="bottom"` — an edge-anchored slide-up drawer by design, not a
  centered dialog. That was a leftover choice from when the modal was
  first built, not something this task's fix needed to preserve.
- Rather than keep Radix `Sheet`/`Dialog`, checked what "consistent with
  the rest of the app" actually means here: grepped for every existing
  modal and found none of them use a shadcn Dialog component at all — the
  established pattern (`ConvertModal.tsx`, `UserMenu.tsx`'s logout confirm)
  is a plain `fixed inset-0 flex items-center justify-center bg-black/40`
  backdrop wrapping a `rounded-xl bg-white p-6 shadow-lg` card, with
  `role="dialog" aria-modal="true"` and no Radix primitive underneath.
  Rewrote `FeedbackButton` to that exact pattern instead of introducing a
  new `ui/dialog.tsx` — matches two existing call sites rather than adding
  a third pattern to the codebase.
- Swapping away from Radix `Sheet` meant losing its built-in close button,
  Escape handling via focus trap, and portal — added a manual `X` close
  button (top-right, matching typical modal affordance) and backdrop-click-
  to-close (inner card stops propagation, mirroring `UserMenu`'s confirm
  dialog exactly) to keep the modal usable. No Escape-key handler was
  added, since neither of the two existing plain-div modals in this
  codebase has one either — matching the established pattern, not
  upgrading past it.
- Extracted a `FeedbackModal` sub-component (backdrop + card + header +
  close button + submitted/form branch) to keep the default-exported
  `FeedbackButton` under the 40-line guideline once the inline JSX grew
  past what the Sheet version had — same reasoning as the `FeedbackForm`
  split from the original feedback-button task.
- Tests: `FeedbackButton.test.tsx` (+3, 8 total) — the backdrop element
  carries `items-center justify-center` (direct regression guard for the
  bug itself), the `X` button closes the modal, and a backdrop click closes
  it while a click on the dialog card itself does not. The 5 existing
  tests needed no changes — they queried by `role="dialog"` and visible
  text/labels, none of which changed. Frontend: 258 passed (was 255).
  Typecheck, lint, and production build all clean.

---
