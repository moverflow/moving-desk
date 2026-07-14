# Task: Owner Dashboard
**Sprint:** 5
**Scope:** both
**ID:** sprint-5/03-owner-dashboard

## User story
As an owner, I want a dedicated dashboard showing business metrics
so I can understand my company's performance at a glance every morning.

## Navigation change
Add "Dashboard" as first nav item — visible to owner only:
```
Owner:      Dashboard | Orders | New order | Invoices | Clients | Settings
Dispatcher:            Orders | New order | Invoices | Clients
```

Route: `/dashboard` — redirect `/` to `/dashboard` for owners,
to `/orders` for dispatchers.

## Backend

### GET /dashboard
Auth: required, owner only (use requireOwner middleware).
Query params: `period=week|month|quarter` (default: month)

Response:
```typescript
{
  period: 'week' | 'month' | 'quarter',
  summary: {
    totalOrders: number
    completedOrders: number
    cancelledOrders: number
    totalRevenue: number        // sum of total_price for completed orders
    avgOrderValue: number       // totalRevenue / completedOrders
  },
  ordersByStatus: {
    status: string
    count: number
    revenue: number
  }[],
  ordersByWeek: {              // last 8 weeks for bar chart
    week: string               // "Jun 30"
    orders: number
    revenue: number
  }[],
  topCrews: {
    crewName: string
    truckLabel: string
    ordersCount: number
    revenue: number
  }[]                          // top 5 by revenue
}
```

All queries MUST filter by tenantId.

### SQL queries to use (write as Drizzle ORM)

Orders by status:
```sql
SELECT status, COUNT(*) as count, SUM(total_price) as revenue
FROM orders
WHERE tenant_id = $1
  AND created_at >= $period_start
GROUP BY status
```

Orders by week (last 8 weeks):
```sql
SELECT
  DATE_TRUNC('week', move_date) as week,
  COUNT(*) as orders,
  SUM(total_price) as revenue
FROM orders
WHERE tenant_id = $1
  AND move_date >= NOW() - INTERVAL '8 weeks'
GROUP BY week
ORDER BY week ASC
```

Top crews:
```sql
SELECT
  cr.name as crew_name,
  cr.truck_label,
  COUNT(o.id) as orders_count,
  SUM(o.total_price) as revenue
FROM orders o
JOIN crews cr ON cr.id = o.crew_id
WHERE o.tenant_id = $1
  AND o.status = 'completed'
  AND o.created_at >= $period_start
GROUP BY cr.id, cr.name, cr.truck_label
ORDER BY revenue DESC
LIMIT 5
```

### Files to create
```
backend/src/routes/dashboard.ts
backend/src/services/dashboard.service.ts
backend/src/index.ts  ← register /dashboard route
```

## Frontend

### DashboardPage layout

```
[Period selector: Week | Month | Quarter]  (top right)

Row 1 — summary cards (3 cards):
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Total orders │  │ Revenue      │  │ Avg order    │
│ 24           │  │ $11,520      │  │ $480         │
│ ↑ vs prev    │  │ ↑ vs prev    │  │              │
└──────────────┘  └──────────────┘  └──────────────┘

Row 2 — bar chart (full width):
Orders & Revenue by week — last 8 weeks
Use recharts BarChart (already in dependencies)

Row 3 — two columns:
Left: Orders by status (horizontal bar or simple list with counts)
Right: Top crews table (name, truck, orders, revenue)
```

### Libraries
- recharts — already installed, use BarChart + Bar + XAxis + YAxis + Tooltip
- No new chart libraries

### Period selector
Three buttons: "Week" | "Month" | "Quarter"
Active button highlighted. On click — refetch dashboard data with new period.

### Files to create
```
frontend/src/routes/DashboardPage.tsx
frontend/src/hooks/useDashboard.ts
frontend/src/components/shared/AppShell.tsx  ← add Dashboard nav item for owner
frontend/src/App.tsx  ← add /dashboard route, update default redirect
```

## Acceptance criteria
- AC1: Dashboard nav item visible only to owner
- AC2: Dispatcher navigates to /orders, owner to /dashboard by default
- AC3: Summary cards show correct totals for selected period
- AC4: Bar chart renders with recharts, shows last 8 weeks
- AC5: Period selector switches data correctly
- AC6: Top crews table shows top 5 by revenue
- AC7: All backend queries filter by tenantId
- AC8: GET /dashboard returns 403 for dispatcher role
- AC9: `npm run typecheck` passes
