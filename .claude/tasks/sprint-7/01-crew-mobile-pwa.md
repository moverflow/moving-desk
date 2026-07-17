# Task: Crew Mobile View — PWA

**Sprint:** 7
**Scope:** both
**ID:** sprint-7/01-crew-mobile-pwa

## User story

As a crew member, I want a mobile app on my phone showing my assigned
jobs for today and tomorrow, so I know exactly where to go and what
to expect without calling the dispatcher.

As an owner, I want crew members to update job status from the field
so the dispatcher sees real-time progress without manual check-ins.

---

## DB changes

### Add 'crew' role to users

```sql
-- users.role already varchar(20)
-- Just allow 'crew' as a valid value alongside 'owner' and 'dispatcher'
-- Add crew_id FK to users table to link user to their crew record
ALTER TABLE users ADD COLUMN crew_id uuid REFERENCES crews(id);
```

Add `crewId` field to users schema in `schema.ts`.
Update role type: `.$type<'owner' | 'dispatcher' | 'crew'>()`

Run migration.

---

## Backend

### Role middleware — add crew restrictions

```typescript
// middleware/auth.ts — add new middleware
export const requireCrew = async (c, next) => {
  const role = c.get("role");
  if (role !== "crew" && role !== "owner") {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
};
```

### GET /crew/jobs — crew's assigned orders

Auth: required, crew role only.
Returns orders assigned to this crew member's crew_id.

```typescript
// Get crewId from JWT payload (add to JWT when crew logs in)
const crewId = c.get("crewId"); // from JWT

const today = new Date().toISOString().split("T")[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

const jobs = await db
  .select({
    id: orders.id,
    status: orders.status,
    moveDate: orders.moveDate,
    fromAddress: orders.fromAddress,
    toAddress: orders.toAddress,
    fromFloor: orders.fromFloor,
    toFloor: orders.toFloor,
    fromElevator: orders.fromElevator,
    toElevator: orders.toElevator,
    homeSize: orders.homeSize,
    packing: orders.packing,
    notes: orders.notes,
    totalPrice: orders.totalPrice,
    clientName: clients.name,
    clientPhone: clients.phone,
  })
  .from(orders)
  .leftJoin(clients, eq(orders.clientId, clients.id))
  .where(
    and(
      eq(orders.tenantId, tenantId),
      eq(orders.crewId, crewId),
      inArray(orders.moveDate, [today, tomorrow]),
      notInArray(orders.status, ["cancelled", "closed"]),
    ),
  )
  .orderBy(asc(orders.moveDate));

return c.json({ jobs });
```

### PATCH /crew/jobs/:id/status — update job status

Auth: required, crew role only.
Crew can only set: `in_progress` or `completed`.

```typescript
const { status } = await c.req.json();

if (!["in_progress", "completed"].includes(status)) {
  return c.json({ error: "Crew can only set in_progress or completed" }, 422);
}

// Verify order belongs to this crew
const order = await db
  .select()
  .from(orders)
  .where(
    and(
      eq(orders.id, orderId),
      eq(orders.crewId, crewId),
      eq(orders.tenantId, tenantId),
    ),
  )
  .limit(1);

if (!order[0]) return c.json({ error: "Not found" }, 404);

await db
  .update(orders)
  .set({ status, updatedAt: new Date() })
  .where(eq(orders.id, orderId));

// If completed — trigger same logic as dispatcher completing
// (invoice generation prompt, completed email to client)
if (status === "completed") {
  await handleOrderCompleted(orderId, tenantId);
}

return c.json({ success: true });
```

### JWT — add crewId to payload for crew users

In `auth.service.ts`, when signing JWT for crew role:

```typescript
const jwt = await signToken({
  sub: user.id,
  tenantId: tenant.id,
  role: "crew",
  plan: tenant.plan,
  crewId: user.crewId ?? undefined, // ADD THIS
});
```

Update `JwtPayload` type in `types/index.ts`:

```typescript
interface JwtPayload {
  sub: string;
  tenantId: string;
  role: "owner" | "dispatcher" | "crew";
  plan: string;
  crewId?: string; // ADD THIS
}
```

Update auth middleware to inject crewId into context:

```typescript
ctx.set("crewId", payload.crewId ?? null);
```

### GET /crew/jobs/:id/files — files for a job

Auth: required, crew role.
Returns files attached to the order (photos, docs).
Read-only — crew cannot upload files.

### Update invite flow — support crew role

In `users.service.ts`, `inviteUser()`:

- Add `role` parameter: `'dispatcher' | 'crew'`
- If role is `'crew'`, also require `crewId` parameter
- Save `crewId` to invite record

Add `role` and `crewId` to `invites` table:

```sql
ALTER TABLE invites ADD COLUMN role varchar(20) DEFAULT 'dispatcher';
ALTER TABLE invites ADD COLUMN crew_id uuid REFERENCES crews(id);
```

When crew member accepts invite (`joinUser()`):

- Set `user.role = 'crew'`
- Set `user.crewId = invite.crewId`

### New route file

```
backend/src/routes/crew.ts  ← GET /crew/jobs, PATCH /crew/jobs/:id/status
```

Register in `app.ts`: `app.route('/crew', crewRoutes)`

### Files to create/modify

```
backend/src/db/schema.ts              ← add crewId to users, role/crewId to invites
backend/src/routes/crew.ts            ← new crew routes
backend/src/routes/users.ts           ← update invite to support crew role
backend/src/services/users.service.ts ← inviteUser() with role + crewId
backend/src/services/auth.service.ts  ← add crewId to JWT
backend/src/middleware/auth.ts        ← inject crewId, add requireCrew
backend/src/lib/jwt.ts                ← update JwtPayload type
backend/src/types/index.ts            ← update role type
backend/src/app.ts                    ← register /crew route
```

---

## Frontend — PWA

### PWA setup

Add to `frontend/public/manifest.json`:

```json
{
  "name": "MovingDesk Crew",
  "short_name": "Crew",
  "description": "Your moving jobs for today",
  "start_url": "/crew",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1D9E75",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

Add to `index.html`:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#1D9E75" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Crew" />
```

Add simple green square icons (192x192 and 512x512 PNG) to `public/`.

### Service Worker — offline caching

Create `frontend/public/sw.js`:

```javascript
const CACHE_NAME = "crew-v1";
const CACHE_URLS = ["/crew", "/crew/login"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_URLS)),
  );
});

self.addEventListener("fetch", (e) => {
  // Cache-first for static assets
  // Network-first for API calls (jobs data)
  if (e.request.url.includes("/crew/jobs")) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request)),
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request)),
    );
  }
});
```

Register SW in `main.tsx`:

```typescript
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}
```

### Crew login page — /crew/login

Standalone page, mobile-first, no AppShell.
Same design as main login but simplified:

```
[MovingDesk logo — green]

Welcome, crew member

Email
[input]

Password
[input]

[Log in]
```

On success → redirect to `/crew`
On error → inline error message

### Crew home page — /crew

Mobile-first, no main AppShell navigation.
Custom minimal header:

```
MovingDesk Crew          [Log out]
John Smith — Team A
```

Two sections:

```
TODAY — Jul 18
──────────────────────────────
[Job card]
[Job card]

TOMORROW — Jul 19
──────────────────────────────
[Job card]
```

Empty state:

```
✅ No jobs scheduled
   Check back later or
   contact your dispatcher.
```

### Job card component

```
┌─────────────────────────────────────┐
│  🏠 2 BR  •  Packing included       │
│                                     │
│  📍 From                            │
│  123 Oak St, Irvine, CA 92602      │
│  Floor 3 — No elevator             │
│                                     │
│  📍 To                              │
│  456 Pine Ave, Anaheim, CA 92801   │
│  Floor 1 — Elevator available      │
│                                     │
│  👤 Rick Adams                      │
│  📞 (949) 632-9557  [Call]         │
│                                     │
│  📝 Piano on 2nd floor, handle     │
│     with care                       │
│                                     │
│  ─────────────────────────────────  │
│  Status: Confirmed                  │
│                                     │
│  [▶ Start move]  [✓ Complete move] │
└─────────────────────────────────────┘
```

Status-based button visibility:

```
confirmed   → show [▶ Start move] only
in_progress → show [✓ Complete move] only
completed   → show "✅ Completed" badge, no buttons
```

Phone number [Call] button: `<a href="tel:{phone}">Call</a>`

Files section (if files attached):

```
📎 Files (2)
  contract-signed.pdf  [View]
  inventory-list.pdf   [View]
```

### Offline indicator

When offline, show banner at top:

```
⚠️ You're offline — showing cached jobs
```

When back online: banner disappears.

```typescript
// hooks/useOnlineStatus.ts
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  return isOnline;
}
```

### Settings → Team tab — invite crew member

Update existing invite UI in Settings → Team:

```
Invite team member

Email:  [____________]
Role:   [Dispatcher ▼]  ← add Crew option
        [Dispatcher]
        [Crew member]

Crew:   [Select crew ▼]  ← shown only when role = Crew
        [Team A — Truck #3]
        [Team B — Truck #7]

[Send invite]
```

### Routing

```
/crew/login  → CrewLoginPage (no auth)
/crew        → CrewHomePage  (crew auth required)
```

Crew users accessing `/orders`, `/invoices` etc → redirect to `/crew`
Main app users accessing `/crew` → redirect to `/orders`

### Files to create/modify

```
frontend/public/manifest.json           ← new PWA manifest
frontend/public/sw.js                   ← new service worker
frontend/public/icon-192.png            ← green square icon (generate simple one)
frontend/public/icon-512.png            ← green square icon
frontend/index.html                     ← add PWA meta tags
frontend/src/main.tsx                   ← register service worker
frontend/src/routes/CrewLoginPage.tsx   ← new
frontend/src/routes/CrewHomePage.tsx    ← new
frontend/src/components/crew/JobCard.tsx ← new
frontend/src/hooks/useCrewJobs.ts       ← new
frontend/src/hooks/useOnlineStatus.ts   ← new
frontend/src/routes/SettingsPage.tsx    ← update invite UI
frontend/src/App.tsx                    ← add /crew routes
frontend/src/store/auth.store.ts        ← handle crew role redirects
```

---

## How to test

### Setup

```
1. Settings → Team → Invite team member
   Email: bestmover.flow@gmail.com
   Role: Crew member
   Crew: Team A

2. Accept invite → set password

3. Open moving-desk.vercel.app/crew on mobile
4. Log in with crew credentials
5. See today's + tomorrow's jobs for Team A
```

### Status update test

```
1. Find a confirmed job
2. Tap "Start move" → status changes to In progress
3. Check Orders board on desktop → card moved to In progress column
4. Tap "Complete move" → status changes to Completed
5. Check Orders board → card in Done column
```

### Offline test

```
1. Open /crew on mobile, jobs load
2. Turn off WiFi/data
3. Refresh page → jobs still visible (cached)
4. See offline banner "You're offline"
5. Turn WiFi back on → banner disappears
```

### PWA install test

```
1. Open /crew in Chrome mobile
2. Browser shows "Add to Home Screen" prompt
3. Add it → icon appears on home screen
4. Open from home screen → full screen, no browser UI
```

---

## Acceptance criteria

### Backend

- AC1: GET /crew/jobs returns only today + tomorrow orders for this crew
- AC2: PATCH /crew/jobs/:id/status accepts only in_progress and completed
- AC3: Crew cannot update other crew's orders (tenant + crewId isolation)
- AC4: crewId included in JWT for crew users
- AC5: Invite with crew role saves crewId to user record
- AC6: Owner/dispatcher cannot access /crew/jobs (403)

### PWA

- AC7: manifest.json present, app installable on mobile
- AC8: App opens in standalone mode (no browser UI) when installed
- AC9: Service worker caches job data for offline use
- AC10: Offline banner shown when no internet connection

### Crew UI

- AC11: Today's and tomorrow's jobs shown in separate sections
- AC12: Job card shows all details (addresses, floors, elevator, notes, client phone)
- AC13: [Call] button opens phone dialer
- AC14: "Start move" button visible for confirmed jobs only
- AC15: "Complete move" button visible for in_progress jobs only
- AC16: Completed jobs show badge, no action buttons
- AC17: Status update reflects on dispatcher's Orders board

### Auth & routing

- AC18: Crew users redirected to /crew (not /orders)
- AC19: Non-crew users cannot access /crew routes
- AC20: Settings → Team invite supports Crew role + crew selection

### Offline

- AC21: Jobs visible when offline (cached data)
- AC22: Status updates queue when offline, sync when online
  (simplified: show error toast if offline, don't silently fail)

### Design

- AC23: All crew screens mobile-first, comfortable at 390px
- AC24: `npm run typecheck` passes with zero errors
