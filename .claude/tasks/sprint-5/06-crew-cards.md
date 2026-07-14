# Task: Crew cards — add phone and detail view
**Sprint:** 5
**Scope:** both
**ID:** sprint-5/06-crew-cards

## User story
As an owner, I want to see crew member details (phone, status) so I
can quickly contact the right team when something comes up on move day.

## DB schema change

Add `phone` field to `crews` table:
```sql
ALTER TABLE crews ADD COLUMN phone varchar(20);
```

Add to `schema.ts` and run migration.

## Backend

### PATCH /crews/:id — already exists, add phone field
Ensure `phone` is accepted in the update body.

### GET /crews — already exists
Ensure `phone` is returned in the response.

## Frontend

### Crews page — new dedicated page
Currently crews are only managed inside Settings as a plain list.
Create a dedicated Crews page accessible from Settings tab or as a
subsection.

Route: stays inside Settings → Team tab or Settings → Crews tab
(add "Crews" as a third tab inside Settings alongside Company and Billing)

### Crew card layout
Replace plain text list with card grid:

```
┌─────────────────────────┐
│  🚛  Team A             │
│      Truck #3           │
│      (714) 555-0199     │
│                         │
│  ● Active               │
│                    [Edit]│
└─────────────────────────┘
```

Fields per card:
- Crew name (bold)
- Truck label
- Phone (if set) — formatted (949) 555-0100
- Active status badge (green dot "Active" / gray "Inactive")
- Edit button → inline edit form (name, truck, phone, active toggle)

### Add crew form
"+ Add crew" button → inline form or slide-over:
```
Crew name *    text input
Truck label    text input  (e.g. "Truck #3")
Phone          text input  (optional)
Active         toggle (default: true)
[Save] [Cancel]
```

### Files to create/modify
```
backend/src/db/schema.ts                    ← add phone to crews
backend/src/services/crews.service.ts       ← include phone in queries
frontend/src/routes/SettingsPage.tsx        ← add Crews tab
frontend/src/components/shared/CrewCard.tsx ← new component
frontend/src/hooks/useCrews.ts             ← add useCreateCrew, useUpdateCrew
```

## Acceptance criteria
- AC1: Crews tab visible in Settings
- AC2: Crews displayed as cards with name, truck, phone, status
- AC3: Phone field formatted as (949) 555-0100 if set
- AC4: Active/Inactive badge shown correctly
- AC5: Edit crew updates name, truck, phone, active status
- AC6: Add crew creates new crew card
- AC7: Phone persists after save (DB migration applied)
- AC8: `npm run typecheck` passes
