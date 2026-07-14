# Task: Schedule Calendar — read-only
**Sprint:** 5
**Scope:** frontend
**ID:** sprint-5/04-schedule-calendar

## User story
As a dispatcher or owner, I want to see all orders on a calendar view
so I can quickly understand crew availability and move schedule for
the week or month.

## What to build

### New nav item "Schedule"
Add between Orders and New order:
```
Owner:      Dashboard | Orders | Schedule | New order | Invoices | Clients | Settings
Dispatcher:            Orders | Schedule | New order | Invoices | Clients
```
Route: `/schedule`

### Calendar library
Use `@fullcalendar/react` with these packages:
```bash
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

### Calendar views
- Default view: `timeGridWeek` (Google Calendar weekly view with time slots)
- Toggle buttons: Week | Month
- Month view: `dayGridMonth`

### Events — orders as calendar entries
Each order becomes a calendar event:

```typescript
interface CalendarEvent {
  id: string
  title: string          // "{clientName} — {homeSize}"  e.g. "Rick Adams — 2 BR"
  date: string           // move_date (all-day event)
  backgroundColor: string // by status:
                          //   new:          #378ADD
                          //   confirmed:    #EF9F27
                          //   in_progress:  #1D9E75
                          //   completed:    #B4B2A9
                          //   cancelled:    #E24B4A
  extendedProps: {
    fromAddress: string
    toAddress: string
    crewName: string
    status: string
  }
}
```

All orders are all-day events (no specific time — mover doesn't know
exact start time usually). Display on the date of `move_date`.

### Event popup on click
When user clicks an event, show a small popup (FullCalendar's built-in
popover or custom tooltip) with:
```
Rick Adams — 2 BR
Lake Forest → Anaheim
Team A — Truck #3
Status: Confirmed
[View order →]  ← link to orders page
```

### Read-only
No drag-and-drop, no creating events from calendar. This is view-only.
Set `editable: false` and `selectable: false` on FullCalendar.

### Data source
Reuse existing `useOrders` hook — no new API endpoint needed.
Transform orders to FullCalendar event format client-side.

## Files to create/modify
```
frontend/src/routes/SchedulePage.tsx        ← new
frontend/src/components/shared/AppShell.tsx ← add Schedule nav item
frontend/src/App.tsx                        ← add /schedule route
package.json                                ← add @fullcalendar packages
```

## Acceptance criteria
- AC1: /schedule shows FullCalendar weekly view by default
- AC2: Orders appear as colored events on correct dates
- AC3: Event color matches order status
- AC4: Click on event shows popup with order details
- AC5: "View order →" link navigates to orders page
- AC6: Week/Month toggle works
- AC7: Calendar is read-only — no drag, no create
- AC8: `npm run typecheck` passes
