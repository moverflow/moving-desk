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
