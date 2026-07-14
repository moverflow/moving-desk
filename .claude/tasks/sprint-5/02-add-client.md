# Task: Add client — standalone form
**Sprint:** 5
**Scope:** both
**ID:** sprint-5/02-add-client

## User story
As a dispatcher, I want to add a client manually without creating an
order first, so I can build up the client database before move day,
and pre-fill orders faster when they call.

## Backend

### POST /clients
Auth: required.
Body:
```typescript
{
  name: string      // required, min 2
  phone?: string    // optional but recommended
  email?: string    // optional
  notes?: string    // optional
}
```
Response 201: created client object.
Error 409: phone already exists for this tenant.

Tenant isolation: always filter/insert with tenantId from JWT.

### Files to create/modify
```
backend/src/routes/clients.ts    ← add POST /clients handler
backend/src/services/clients.service.ts ← add createClient()
```

## Frontend

### Add client button on ClientsPage
Add a "+ Add client" button in the top-right of the Clients page header
(same pattern as "+ New order" on Orders page).

### Add client slide-over panel
On click, open a slide-over panel (not a new page — keeps context):

```
Panel title: "Add client"

Fields:
  Name *        text input, required
  Phone         text input, optional
  Email         text input, optional
  Notes         textarea, optional

Actions:
  [Save client]   → POST /clients → close panel → refresh list
  [Cancel]        → close panel, no changes
```

On success: show toast "Client added", panel closes, client appears
in list immediately (optimistic update or query invalidation).

On error 409 (duplicate phone): show inline error under phone field
"A client with this phone number already exists".

### Client detail — "New order" pre-fill
Existing behavior: clicking "New order" on a client row navigates to
New order form. Enhance this: pre-fill Phone AND Name fields from
the client record so dispatcher doesn't retype.

Currently only phone pre-fill exists — add name pre-fill as well.

## Files to create/modify
```
frontend/src/routes/ClientsPage.tsx      ← add button + slide-over
frontend/src/components/shared/AddClientPanel.tsx  ← new component
frontend/src/hooks/useClients.ts         ← add useCreateClient() mutation
```

## Acceptance criteria
- AC1: "+ Add client" button visible on Clients page
- AC2: Slide-over opens with correct fields
- AC3: Valid submission creates client, panel closes, list updates
- AC4: Duplicate phone shows inline error, panel stays open
- AC5: "New order" from client row pre-fills both name and phone
- AC6: Tenant isolation — client belongs to correct tenant
- AC7: `npm run typecheck` passes
