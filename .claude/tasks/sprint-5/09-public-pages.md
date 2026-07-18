# Task: Public pages — How it works + Test guide

**Sprint:** 5
**Scope:** frontend
**ID:** sprint-5/09-public-pages

## What to build

Two new public pages — no auth, no AppShell, standalone.

---

### Page 1: /how-it-works

File: `frontend/src/routes/HowItWorksPage.tsx`

Content — interactive pipeline diagram:

- Title: "How MovingDesk works"
- Subtitle: "From first call to payment received — click any step to see details"
- 6 clickable step cards horizontally: Lead captured, Order created, Contract signed, Move day, Invoice sent, Payment received
- When step clicked → detail panel appears showing Owner/Dispatcher/Crew actions at that step
- 3 role columns at bottom: Owner (green), Dispatcher (blue), Crew (purple)

Step details:

Step 1 — Lead captured:
Owner: Monitor lead pipeline, Set up booking page in Settings, Configure Zapier webhook URL
Dispatcher: Manually add lead from phone call, Review online booking requests, Move lead New→Contacted→Quoted, Convert lead to order when ready
Crew: Not involved at this stage

Step 2 — Order created:
Owner: See all orders on dashboard, Review revenue per order
Dispatcher: Fill order form in 90 seconds, Phone lookup auto-fills client data, Select home size → price calculated, Assign crew to the order, Order appears on Kanban board
Crew: Not involved yet

Step 3 — Contract signed:
Owner: Set custom contract terms in Settings, Get notified when client signs
Dispatcher: Contract auto-sent when order confirmed, See contract status on order card, Resend contract if needed, View signed PDF in order files
Crew: Receive job details after contract signed, See order in their mobile app

Step 4 — Move day:
Owner: See real-time status on dashboard, Monitor crew utilization
Dispatcher: Track status changes on Kanban board, See urgency colors (Today = red), Contact crew via phone if needed, Update notes if situation changes
Crew: Open PWA on phone — see today's job, Tap "Start move" when arriving, See client phone call directly, Read dispatcher notes and files, Tap "Complete" when done

Step 5 — Invoice sent:
Owner: See invoice revenue in dashboard, Track paid vs unpaid invoices
Dispatcher: Generate invoice from completed order, Send PDF to client via email, Share payment link with client, Track Draft→Sent→Paid status
Crew: Not involved at this stage

Step 6 — Payment received:
Owner: Revenue appears in dashboard, See monthly totals and trends, Ask AI "Why did revenue grow?"
Dispatcher: Invoice status auto-updates to Paid, Client receives payment confirmation, Order marked as closed
Crew: Not involved at this stage

Colors:

- Step 1: #378ADD (blue)
- Step 2: #EF9F27 (amber)
- Step 3: #1D9E75 (green)
- Step 4: #534AB7 (purple)
- Step 5: #D85A30 (orange)
- Step 6: #639922 (olive)
- Owner column: #1D9E75
- Dispatcher column: #378ADD
- Crew column: #534AB7

---

### Page 2: /test-guide

File: `frontend/src/routes/TestGuidePage.tsx`

Content — tester guide with these sections:

#### Test accounts

Owner:
Email: bestpro3@gmail.com
Password: 12345678
Access: Dashboard, all features, billing

Crew:
Email: crew@test.com
Password: Crew1234!
Login at: /crew/login

Note: "Works on all browsers including iOS Safari."

#### Key URLs

App: https://moving-desk.vercel.app
Booking page: https://moving-desk.vercel.app/book/best-pro-3
Crew mobile: https://moving-desk.vercel.app/crew/login
How it works: https://moving-desk.vercel.app/how-it-works

#### Stripe test payment card

Card: 4242 4242 4242 4242
Expiry: 12/28
CVC: 123
ZIP: 12345
Note: "No real charges — test mode only"

#### Email notifications

All emails go to: bestmover.flow@gmail.com
Sender: onboarding@resend.dev
Check spam: Yes

#### Test checklist (10 items, clickable checkboxes)

1. Orders Kanban board — login as owner → go to Orders, see Kanban columns, click card to see details
2. Lead pipeline — Orders → Leads tab → New lead → move through stages → Convert to order
3. Self-booking page — open /book/best-pro-3 in private tab, fill form, check Leads tab for new lead with "Online" badge
4. Digital contract — create order with email bestmover.flow@gmail.com → confirm → check email → sign → verify "Signed" status
5. Invoice & payment — complete order → generate invoice → Sent → share link → Pay now → test card → auto-updates to Paid
6. Crew mobile — open /crew/login on phone (Chrome) → login crew@test.com/Crew1234! → Start move → check desktop board updates
7. AI analytics — Dashboard → AI Insights tab → read insights → ask question in chat
8. Schedule calendar — click Schedule in nav → see orders on calendar → switch Week/Month
9. File upload — open any order → Upload → attach PDF or image → verify in files list
10. Settings — update company name and base rates → create order → verify new price

#### Known issues

Email delivery: Test mode — only to bestmover.flow@gmail.com [Pending domain]
Stripe: Test mode — no real charges [Safe]
AI questions: 5 per day per account

---

## Routing — add both to App.tsx

```tsx
import HowItWorksPage from './routes/HowItWorksPage'
import TestGuidePage from './routes/TestGuidePage'

// OUTSIDE any auth wrapper:
<Route path="/how-it-works" element={<HowItWorksPage />} />
<Route path="/test-guide" element={<TestGuidePage />} />
```

## Files to create

```
frontend/src/routes/HowItWorksPage.tsx
frontend/src/routes/TestGuidePage.tsx
frontend/src/App.tsx  ← add two routes
```

## Acceptance criteria

- AC1: /how-it-works loads without auth, shows 6 clickable steps
- AC2: Clicking step shows detail panel with Owner/Dispatcher/Crew actions
- AC3: 3 role columns visible below steps
- AC4: /test-guide loads without auth, shows all sections
- AC5: Checklist items are clickable (toggle done state)
- AC6: Both pages have no AppShell navigation
- AC7: Both pages work on mobile (390px width)
- AC8: `npm run typecheck` passes with zero errors
