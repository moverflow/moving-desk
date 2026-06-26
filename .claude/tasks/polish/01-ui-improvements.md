# Task: UI Polish — 4 improvements

**Sprint:** polish
**Scope:** frontend
**ID:** polish/01-ui-improvements

## User story

As a dispatcher and owner, I want visual cues that highlight urgency,
brand presence, and client value, so the app communicates more
without adding complexity to the layout.

## Context

Current UI is intentionally minimal — this is a strength, not a bug.
These 4 improvements add information density through color/badges,
NOT new screens, new nav items, or new fields. Keep the existing
simplicity; only enhance what's already there.

## What to build

### 1. Kanban urgency indicators (OrdersPage / order card)

Add to each order card:

- Left border strip (3px) colored by urgency tier
- Badge in top-right of card showing urgency label

Urgency tiers based on move_date vs today:

```typescript
function getUrgency(moveDate: string, status: string): UrgencyTier {
  if (status === "completed" || status === "closed") return "future"; // gray, "DONE"
  const days = daysBetween(today, moveDate);
  if (days <= 0) return "today"; // red, "TODAY"
  if (days <= 2) return "soon"; // amber, "IN X DAYS"
  if (days <= 14) return "normal"; // green, "Jun 16" (formatted date)
  return "future"; // gray, formatted date
}
```

Colors:

```
today   → strip #E24B4A, badge bg #FCEBEB text #A32D2D
soon    → strip #EF9F27, badge bg #FFF4E0 text #8A5A0F
normal  → strip #1D9E75, badge bg #E1F5EE text #0F6E56
future  → strip #B4B2A9, badge bg #F1EFE8 text #888
```

Completed/closed cards also get reduced opacity (0.6) on the whole card.

### 2. Invoice logo display (InvoiceDetail page + PDF)

Currently invoice shows only text company name. Add:

- If tenant.settings.logoUrl exists → show actual logo image (44x44px, rounded 10px)
- If no logo uploaded → show a generated initial badge: first letters of
  company name, gradient background (brand green), white bold text

```typescript
function getCompanyInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
```

This applies to BOTH the in-app invoice detail view AND the PDF export
(@react-pdf/renderer) — keep them visually consistent.

Also add a subtle top/bottom border (1px solid #1a1a18) around the
header and total row for a more premium invoice look — not just thin
gray dividers everywhere.

### 3. Live price empty/active states (NewOrderPage)

Currently price shows a default value ($480) before any size is selected,
which looks like a real calculated answer. Fix:

**Empty state** (no home_size selected yet):

```
- Dashed border box, white background
- Label: "Estimated price"
- Hint text below label: "Select home size to calculate"
- Value: em-dash "—" in gray (#B4B2A9)
```

**Active state** (home_size selected):

```
- Solid background #F1EFE8, no border
- Label: "Estimated price"
- Hint text: "Base rate for {size}" e.g. "Base rate for 2 BR"
- Value: actual price in green (#1D9E75), font-weight 600, font-size 20px
- Smooth transition (background-color 0.3s) when switching states
```

### 4. Client tier badges (ClientsPage)

Add a badge next to client name based on order_count:

```typescript
function getClientTier(orderCount: number): "vip" | "repeat" | "new" {
  if (orderCount >= 5) return "vip";
  if (orderCount >= 2) return "repeat";
  return "new";
}
```

Badge styles:

```
vip    → background #1a1a18, text white, label "VIP"
repeat → background #E1F5EE, text #0F6E56, label "REPEAT"
new    → background #E6F1FB, text #185FA5, label "NEW"
```

Also replace the plain order count number with a small horizontal bar
showing relative volume (visual, not exact scale — cap bar width at
5+ orders = 100% width):

```
bar track: 50px wide, 4px tall, background #F1EFE8, rounded
bar fill: green (#1D9E75), width = min(orderCount/5, 1) * 100%
number shown to the right of the bar
```

## Files to modify

```
frontend/src/components/shared/OrderCard.tsx (or wherever card is defined)
frontend/src/lib/utils.ts — add getUrgency(), getCompanyInitials(), getClientTier()
frontend/src/routes/InvoicesPage.tsx (or InvoiceDetail component)
frontend/src/routes/NewOrderPage.tsx
frontend/src/routes/ClientsPage.tsx
```

## Acceptance criteria

- AC1: Order due today shows red strip + "TODAY" badge
- AC2: Order due in 1-2 days shows amber strip + "IN X DAYS" badge
- AC3: Completed/closed orders show reduced opacity + gray "DONE" badge
- AC4: Invoice shows logo image if uploaded, else colored initials badge
- AC5: Price box shows dashed empty state before home_size is selected
- AC6: Price box transitions smoothly to green active state on selection
- AC7: Client with 1 order shows "NEW" badge
- AC8: Client with 2-4 orders shows "REPEAT" badge
- AC9: Client with 5+ orders shows "VIP" badge
- AC10: Order count shown as both number and proportional bar
- AC11: Every text input/textarea shows double ring (gray + black) on focus, no layout shift

### 5. Form input focus ring (global — all text inputs across the app)

Apply to every `<input>` and `<textarea>` used in forms (Register, Login,
QuickSetup, New order, Settings, Join).

Default state: existing thin gray border (#ccc, 0.5px) — unchanged.

Focus state: keep the gray border visible AND add a black ring outside it,
using a double box-shadow (NOT changing border-width, to avoid layout shift):

```css
.field-input:focus {
  outline: none;
  border-color: #ccc;
  box-shadow:
    0 0 0 1px #ccc,
    0 0 0 3px #1a1a18;
}
```

This should be a shared base style (Tailwind utility class or shared
component), applied once, not repeated per-page. If shadcn/ui Input
component is used, override its focus-visible ring to match this pattern
instead of the default shadcn focus ring.

## Out of scope

- New navigation items or pages
- Changing the 4-column Kanban structure
- Adding filters, sorting, or search beyond what exists
- Dashboard/analytics screens
- Any backend changes — this is pure frontend presentation logic
  using data already available from existing API responses
