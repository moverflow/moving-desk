# MovingDesk — CLAUDE.md

## Project overview

Multi-tenant B2B SaaS CRM for small moving companies (2–15 trucks) in the USA market.
Simple, fast, mobile-first. Four screens: Orders board, New order, Invoices, Clients.

## Monorepo structure

```
/
├── CLAUDE.md          ← you are here
├── backend/           ← Node.js + Hono + TypeScript
└── frontend/          ← React 18 + Vite + TypeScript
```

## URLs (update when domain is purchased)

```
Frontend:  https://movingdesk.tbd        (Vercel)
Backend:   https://api.movingdesk.tbd    (Railway)
```

---

## Backend

### Stack

- Runtime: Node.js 20
- Framework: Hono (lightweight, TypeScript-first)
- ORM: Drizzle ORM
- Database: PostgreSQL on Neon (serverless)
- Auth: JWT in httpOnly cookie
- Email: Resend
- Payments: Stripe (Sprint 4 only — do NOT touch now)
- Storage: Cloudflare R2 (Sprint 4 only — do NOT touch now)
- Logging: pino (structured JSON logs)
- Testing: Vitest + supertest
- Error tracking: Sentry (add from Sprint 1)

### Folder structure

```
backend/
├── src/
│   ├── index.ts           ← Hono app entry point
│   ├── routes/            ← one file per resource (auth.ts, orders.ts, etc.)
│   ├── services/          ← business logic (auth.service.ts, orders.service.ts)
│   ├── db/
│   │   ├── schema.ts      ← Drizzle schema — all tables
│   │   └── index.ts       ← db client instance
│   ├── middleware/
│   │   ├── auth.ts        ← JWT verify, inject tenantId + role into ctx
│   │   └── rateLimit.ts   ← rate limiting for /auth/* routes
│   ├── lib/
│   │   ├── jwt.ts         ← sign / verify JWT
│   │   └── email.ts       ← Resend wrapper
│   └── types/
│       └── index.ts       ← shared TypeScript types
├── .env.example
├── package.json
└── tsconfig.json
```

### Environment variables (backend)

```
DATABASE_URL=             # Neon Postgres connection string
JWT_SECRET=               # min 32 chars random string
JWT_EXPIRES_IN=7d
RESEND_API_KEY=           # from resend.com
FRONTEND_URL=https://movingdesk.tbd
PORT=3000
NODE_ENV=development
SENTRY_DSN=               # Sprint 1+
```

---

## Frontend

### Stack

- Framework: React 18
- Build tool: Vite
- Language: TypeScript (strict mode)
- UI components: shadcn/ui
- Styling: Tailwind CSS
- Server state: TanStack Query v5
- Client state: Zustand
- Routing: React Router v6
- PDF: @react-pdf/renderer
- Error tracking: Sentry (Sprint 1+)
- Analytics: PostHog (Sprint 1+)

### Folder structure FSD

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/            ← page components (OrdersPage, NewOrderPage, etc.)
│   ├── features/
│   ├── modules/
│   ├── components/
│   │   ├── ui/            ← shadcn components (do not edit manually)
│   │   └── shared/        ← app-specific shared components
│   ├── hooks/             ← TanStack Query hooks (useOrders, useClients, etc.)
│   ├── store/             ← Zustand stores (auth.store.ts)
│   ├── lib/
│   │   ├── api.ts         ← axios/fetch wrapper with base URL + credentials
│   │   └── utils.ts       ← cn(), formatDate(), formatPhone(), formatCurrency()
│   └── types/
│       └── index.ts       ← shared TypeScript types
├── .env.example
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### Environment variables (frontend)

```
VITE_API_URL=https://api.movingdesk.tbd
VITE_POSTHOG_KEY=         # Sprint 1+
VITE_SENTRY_DSN=          # Sprint 1+
```

---

## Database schema — all tables (Sprint 0: create migrations, no data yet)

### Multi-tenancy rule

**EVERY table except `tenants` and `subscriptions` has `tenant_id UUID NOT NULL`.**
**EVERY query MUST filter by `tenant_id`. No exceptions.**

### Tables

```
tenants        id, name, slug, logo_url, settings(jsonb), plan, trial_ends_at, created_at
users          id, tenant_id, email, password_hash, role, name, created_at
clients        id, tenant_id, name, phone, email, notes, created_at
crews          id, tenant_id, name, truck_label, active, created_at
orders         id, tenant_id, client_id, crew_id, created_by,
               status, move_date, from_address, to_address,
               from_floor, to_floor, from_elevator, to_elevator,
               home_size, packing, notes, base_price, total_price,
               created_at, updated_at
invoices       id, tenant_id, order_id, number, status, pdf_url,
               share_token, sent_at, paid_at, expires_at, created_at
subscriptions  id, tenant_id, stripe_customer_id, stripe_sub_id,
               plan, status, current_period_end
invites        id, tenant_id, email, token, expires_at, created_at
```

### Order statuses

`new` → `confirmed` → `in_progress` → `completed` → `closed`
Any status → `cancelled` (soft, never delete)

### Invoice statuses

`draft` → `sent` → `paid`

---

## USA market — formatting rules

```
Phone:     (949) 555-0100
Date:      Jun 15, 2026
Currency:  $480 ($ prefix, no decimals for whole numbers)
Timezone:  store UTC in DB, display in tenant.settings.timezone
           Default: America/New_York
```

Always use these formats in UI. Never European formats (DD/MM/YYYY, 1.234,00).

---

## Strict rules — apply to every file, every sprint

### TypeScript

- Strict mode ON — no `any`, ever
- All function params and return types explicitly typed
- Use `unknown` instead of `any` when type is truly unknown
- Zod for all external input validation (API request bodies, env vars)

### Security

- JWT payload contains: `{ sub: userId, tenantId, role, plan, iat, exp }`
- JWT stored in httpOnly, sameSite: 'lax' cookie — never localStorage
- Every protected route goes through auth middleware
- Rate limit: 5 requests / 15 min on all /auth/\* endpoints
- bcrypt rounds: 12
- Share tokens (invoices): UUID v4, expires 7 days, single-use concept

### Multi-tenancy (CRITICAL)

```typescript
// ALWAYS — every DB query
db.select().from(orders).where(eq(orders.tenantId, ctx.tenantId));

// NEVER — missing tenant filter
db.select().from(orders);
```

### Git

- Branch naming: `feat/sprint-N-feature-name`, `fix/description`, `chore/description`
- Conventional commits only:
  `feat(auth): add POST /auth/register`
  `fix(orders): enforce tenantId filter`
  `chore(deps): add drizzle-orm`
- Never commit: .env files, node_modules, secrets

## Git — critical rule

ALWAYS before creating a branch:

- git checkout main
- git pull origin main
- git checkout -b feat/sprint-N-feature-name

NEVER branch from another feature branch.
NEVER merge PR into a feature branch — always into main.

### Code style

- No comments explaining what code does — code should be self-explanatory
- Comments only for WHY (non-obvious business logic)
- Max function length: 40 lines — extract if longer
- One responsibility per file

---

## What to build in Sprint 0

### Backend tasks

1. Init Hono app with TypeScript — `src/index.ts` with health check route `GET /health`
2. Setup Drizzle ORM + Neon connection
3. Write all migrations (schema.ts) for all 8 tables listed above
4. Setup pino logger
5. Setup CORS — allow VITE_FRONTEND_URL origin, credentials: true
6. Setup env validation with zod
7. `package.json` scripts: `dev`, `build`, `start`, `typecheck`, `lint`, `test`

### Frontend tasks

1. Init React 18 + Vite + TypeScript
2. Install and configure shadcn/ui + Tailwind
3. Setup React Router v6 — route structure (placeholder pages ok)
4. Setup TanStack Query provider
5. Setup Zustand auth store (empty for now)
6. App shell: topbar with logo + 4 nav tabs (Orders, New order, Invoices, Clients)
7. `package.json` scripts: `dev`, `build`, `preview`, `typecheck`, `lint`

### Definition of done — Sprint 0

- [ ] `GET /health` returns `{ status: 'ok', timestamp: '...' }`
- [ ] All DB migrations run without errors
- [ ] Frontend loads in browser with app shell visible
- [ ] Both `typecheck` and `lint` pass with zero errors
- [ ] Both services deployed (Railway + Vercel) and reachable via URL
- [ ] GitHub Actions CI runs on PR and goes green

---

## Out of scope — do NOT build until specified

- Stripe / payments
- Cloudflare R2 / file upload
- PDF generation
- Email sending (Resend — backend setup only, no actual sending)
- Sentry / PostHog (install only in Sprint 1)
- GPS tracking
- Payroll
- Multi-branch
- AI features
- Mobile app

---

## Agent instructions

When acting as **implementer**:

- Read this file first, every time
- Only touch files listed in the task prompt
- Create the branch before writing any code
- Run typecheck before committing
- Commit with conventional commit message

When acting as **reviewer**:

- Check every changed file against rules in this CLAUDE.md
- Specifically verify: tenantId filter on all queries, no `any`, error handling, security rules
- Return numbered list of issues, or single line "approved"
- Do NOT rewrite code — only report

When acting as **tester**:

- Write Vitest tests for the feature described in the task
- Cover: happy path, validation errors, auth errors, tenant isolation
- Do NOT test trivial code (getters, constants)
- Run tests before committing
