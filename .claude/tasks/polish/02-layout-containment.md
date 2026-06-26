# Task: Layout containment, header sizing, logo bug fix

**Sprint:** polish
**Scope:** frontend
**ID:** polish/02-layout-containment

## User story

As any user, I want the app to feel intentional and full on wide screens,
not like content floating in empty space, so the product feels finished
and trustworthy.

## Problem

On screens wider than ~1280px, page content (forms, invoice detail) has
no max-width constraint and sits flush-left with large empty space to
the right. The header also feels visually thin relative to its
importance as the primary navigation element.

## What to build

### 1. Global content container

Create a shared layout wrapper component used by every page:

```typescript
// components/shared/PageContainer.tsx
interface PageContainerProps {
  children: React.ReactNode;
  variant?: "default" | "narrow" | "wide";
}
```

Max-width rules:

```
narrow  (Settings, New order, auth pages) → max-width: 680px
default (Invoice detail, Client detail)   → max-width: 1040px
wide    (Orders Kanban board)             → max-width: none (full width is correct here — it's a data table view, not a form)
```

All variants: `margin: 0 auto`, horizontal padding `32px` on the container itself.

Apply this wrapper to: SettingsPage, NewOrderPage, InvoicesPage (detail panel),
RegisterPage, LoginPage, QuickSetupPage. Do NOT apply to OrdersPage (Kanban
stays full-width — it's the one screen that benefits from more horizontal space).

### 2. Card framing for forms

Wrap form content (not the whole page, just the form itself) in a card:

```css
.page-card {
  background: white;
  border: 0.5px solid #e0e0dc;
  border-radius: 12px;
  padding: 28px 32px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}
```

Apply to: Settings form, New order form. Page title ("Settings", "New order")
stays OUTSIDE the card, above it — only the actual form fields go inside.

### 3. Header sizing

Update the topbar/AppShell component:

```
height:        44px → 60px
padding:       0 16px → 0 32px
logo font-size: 14px → 16px
logo font-weight: 500 → 600
logo letter-spacing: add -0.01em
nav-btn padding: 6px 12px → 8px 14px
nav-btn font-size: 12px → 13px
nav-btn font-weight: add 500
avatar size:    28px → 32px
avatar font-size: 11px → 12px
```

### 4. Company logo in topbar

Add the tenant's company logo as a small badge in the topbar, next to
the "MovingDesk" product name — NOT replacing it.

```
[logo] MovingDesk          Orders  New order  Invoices  ...    [avatar]
 ^ company logo, 24-28px    ^ product name stays as-is
```

Behavior:

- If `settings.logoUrl` exists → show it as a small circular/rounded
  image (28px, border-radius matching the rest of the UI ~8px or
  fully round — pick whichever matches the avatar style already used)
- If no logo uploaded → show NOTHING in that spot (no fallback initials
  here — this is the most-seen element in the app and should stay
  clean when not configured, unlike the invoice header where a
  fallback badge makes sense)
- Position: immediately to the left of "MovingDesk" text, with a small
  gap (~8px)

This reinforces "this is configured for my company" every time the
dispatcher opens the app, without replacing the MovingDesk product
brand itself.

## Files to modify

```
frontend/src/components/shared/PageContainer.tsx (new)
frontend/src/components/shared/AppShell.tsx (header sizing + company logo badge)
frontend/src/routes/SettingsPage.tsx (wrap in PageContainer + card)
frontend/src/routes/NewOrderPage.tsx (wrap in PageContainer + card)
frontend/src/routes/InvoicesPage.tsx (wrap detail panel in PageContainer)
frontend/src/routes/RegisterPage.tsx, LoginPage.tsx, QuickSetupPage.tsx (wrap in PageContainer narrow)
```

## Acceptance criteria

- AC1: On a 1920px wide viewport, Settings page content is visibly
  constrained to ~680px and centered, not flush-left with empty space
- AC2: Settings form fields are inside a bordered card with subtle shadow
- AC3: New order form fields are inside a bordered card with subtle shadow
- AC4: Header height is 60px, logo reads visibly larger/bolder than before
- AC5: OrdersPage (Kanban) remains full-width — unaffected by this change
- AC6: If a company logo is uploaded in Settings, it appears as a small
  badge in the topbar next to "MovingDesk" on every page
- AC7: `npm run typecheck` passes with zero errors

## Out of scope

- Changing the Kanban board layout or column widths
- Adding a sidebar or different navigation pattern
- Dark mode
- Changing brand colors
