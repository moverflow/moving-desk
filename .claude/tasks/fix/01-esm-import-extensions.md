# Task: Fix ESM import extensions

**Sprint:** fix
**Scope:** backend
**ID:** fix/01-esm-import-extensions

## Problem

tsconfig.json now uses moduleResolution: "NodeNext" (correct for Node.js ESM backend).
This requires ALL relative imports to have explicit .js extension, even for type-only imports.

Currently ~25 files have imports missing the .js extension, causing build failures:
TS2307 Cannot find module
TS2834/TS2835 Relative import paths need explicit file extensions

## What to fix

Go through EVERY .ts file in src/ (including test files) and fix ALL relative imports:

### Rule

```typescript
// Any import starting with './' or '../' MUST end in '.js'
// This applies to:
//   - regular imports:        import { x } from './foo.js'
//   - type-only imports:      import type { X } from '../types.js'
//   - default imports:        import app from './app.js'
//   - dynamic imports:        await import('./app.js')
//   - re-exports:             export * from './foo.js'

// NEVER add .js to:
//   - npm package imports:    import { Hono } from 'hono'
//   - node built-ins:         import path from 'node:path'
```

### Known affected files (verify each, fix all relative imports found)

```
src/middleware/auth.ts
src/types/index.ts
src/app.ts
src/app.test.ts
src/lib/jwt.ts
src/lib/r2.ts
src/lib/stripe.ts
src/lib/email.ts
src/lib/logger.ts
src/lib/env.ts
src/db/index.ts
src/db/schema.ts
src/index.ts
src/routes/invoices.ts
src/routes/settings.ts
src/routes/clients.ts
src/routes/orders.ts
src/routes/crews.ts
src/routes/users.ts
src/routes/billing.ts
src/routes/auth.ts
src/services/auth.service.ts
src/services/crews.service.ts
src/services/clients.service.ts
src/services/users.service.ts
src/services/settings.service.ts
src/services/billing.service.ts
src/services/orders.service.ts
src/services/invoices.service.ts
```

Also check ALL \*.test.ts files for dynamic imports like:

```typescript
const { default: app } = await import("./app"); // ❌ missing .js
const { default: app } = await import("./app.js"); // ✅ correct
```

## Process

1. Run this to find every remaining violation:

   ```bash
   grep -rEn "from '\.[^']*[^s]'" src/ --include="*.ts"
   grep -rEn "import\('\.[^']*[^s]'\)" src/ --include="*.ts"
   ```

2. Fix each one found — add `.js` before the closing quote

3. Re-run the grep commands — must return ZERO results when done

4. Run `npm run typecheck` — must pass with zero errors

5. Run `npm run build` — must succeed, dist/ folder populated correctly

6. Run `npm run test` if a test DB is available; otherwise just confirm
   typecheck and build pass (no DB connection required for this fix)

## Acceptance criteria

- AC1: grep for imports without .js returns zero results
- AC2: `npm run typecheck` passes with zero errors
- AC3: `npm run build` succeeds
- AC4: dist/index.js runs without ERR_MODULE_NOT_FOUND when DATABASE_URL is set
- AC5: No file outside src/ was modified
- AC6: tsconfig.json module/moduleResolution remain "NodeNext" (already fixed, don't revert)

## Also update CLAUDE.md

Add this rule permanently so future code generation doesn't repeat this mistake:

```markdown
## ESM imports — critical rule

This project uses Node.js ESM (NodeNext module resolution).
ALL relative imports MUST end with .js, even though source files are .ts:

✅ import { db } from '../db.js'
✅ import type { User } from '../types.js'
✅ const mod = await import('./app.js')

❌ import { db } from '../db'
❌ import type { User } from '../types'

This applies to every relative import without exception, including
dynamic imports in test files. npm package imports and Node built-ins
(e.g. 'hono', 'node:path') do NOT need .js.
```

Insert this section into CLAUDE.md under the Backend stack section.
