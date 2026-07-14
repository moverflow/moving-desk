# Task: AI Analytics — Dashboard tab

**Sprint:** 5
**Scope:** both
**ID:** sprint-5/08-ai-analytics

## User story

As an owner, I want an AI tab on my Dashboard where I can ask
questions about my business and get intelligent answers with
recommendations, so I can make better decisions without being
a data analyst.

## Context — current Dashboard

Dashboard already exists with:

- 3 summary cards (Total Orders, Revenue, Avg Order Value)
- Bar chart (Orders & Revenue by week)
- Orders by status list
- Top crews table

All styled with clean white cards, green (#1D9E75) accents,
subtle borders (#e0e0dc). AI tab must match this exact visual language.

## UI — tab navigation

Add two tabs at the top of Dashboard content area (below page title,
above summary cards):

```
[📊 Metrics]  [✨ AI Insights]
```

- "Metrics" tab → current dashboard content (unchanged)
- "AI Insights" tab → new AI analytics content
- Default active tab: "Metrics"
- Tab style: match existing Settings tabs pattern (border-bottom indicator)

---

## AI Insights tab — layout

```
┌─────────────────────────────────────────────────────┐
│  Auto insights                                      │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ 📈 Revenue trend                             │   │
│  │ Your revenue grew 23% vs previous period.   │   │
│  │ Best week: Jun 8 ($3,580). Slowest: Jul 13. │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ 👥 Crew utilization                          │   │
│  │ Best crew handled 73% of all orders.        │   │
│  │ Consider adding a second crew for peak weeks│   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ 🔄 Client retention                          │   │
│  │ 2 of 12 clients (17%) returned for a second │   │
│  │ move. Industry avg is ~25%. Consider a       │   │
│  │ follow-up email after each completed move.  │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ ⚠️  Cancellations                            │   │
│  │ 14% cancellation rate (6 orders). This is   │   │
│  │ within normal range (10-20%). No action     │   │
│  │ needed yet.                                 │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  Ask AI about your business                         │
│  ┌──────────────────────────────────────────────┐   │
│  │ [chat history area - scrollable]            │   │
│  │                                              │   │
│  │  You: Why did revenue drop in Jun 22 week?  │   │
│  │                                              │   │
│  │  AI: That week had only 2 orders vs your    │   │
│  │  average of 4-5 per week. Both were smaller │   │
│  │  1BR moves ($380 each). No cancellations    │   │
│  │  that week — it was simply a slow period.  │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  [Ask about your business...]  [5 left today] [→]  │
└─────────────────────────────────────────────────────┘
```

---

## Backend

### GET /dashboard/ai-insights (NEW endpoint)

Auth: required, owner only.

Fetches aggregated metrics and generates 4 automatic insights
using Claude API.

**Step 1 — fetch metrics from DB:**

```typescript
const metrics = {
  // Revenue
  totalRevenue: number,
  revenueByWeek: { week: string, revenue: number, orders: number }[],
  prevPeriodRevenue: number,  // same period last month for comparison

  // Crew utilization
  crewStats: { name: string, ordersCount: number, revenue: number }[],
  totalOrders: number,

  // Retention
  totalClients: number,
  repeatClients: number,  // clients with 2+ orders

  // Cancellations
  cancelledOrders: number,
  cancellationRate: number,  // percentage
}
```

**Step 2 — call Claude API with metrics:**

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const response = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1000,
  system: `You are a business analyst for a moving company.
Analyze the provided metrics and generate exactly 4 insights.
Be specific, use the actual numbers from the data.
Each insight must include: a finding AND a recommendation.
Keep each insight to 2-3 sentences maximum.
Format as JSON array with objects: { type, emoji, title, text }
Types: revenue_trend | crew_utilization | client_retention | cancellations
Be direct and actionable. Owner is a small business operator, not a data analyst.`,

  messages: [
    {
      role: "user",
      content: `Analyze my moving company metrics for the last 3 months:
${JSON.stringify(metrics, null, 2)}

Generate 4 business insights covering:
1. Revenue trend (compare to previous period)
2. Crew utilization (who is working most, any imbalance?)
3. Client retention (repeat customers rate vs ~25% industry avg)
4. Cancellations (rate vs 10-20% normal range)

Return ONLY valid JSON array, no other text.`,
    },
  ],
});
```

**Step 3 — return parsed insights:**

```typescript
// Response format:
{
  insights: [
    {
      type: 'revenue_trend',
      emoji: '📈',
      title: 'Revenue trend',
      text: 'Your revenue grew 23% vs previous period...'
    },
    // ... 3 more
  ],
  metrics: {
    // raw metrics for frontend to use in chat context
  },
  generatedAt: ISO timestamp
}
```

Cache response for 1 hour (simple in-memory cache keyed by tenantId).
Do NOT call Claude API on every request — expensive and slow.

### POST /dashboard/ai-chat (NEW endpoint)

Auth: required, owner only.

Rate limit: 5 requests per user per day (reset at midnight UTC).
Store count in simple in-memory Map (or add `ai_questions_used` to
subscriptions table if persistence needed — simpler: in-memory is fine for now).

Request:

```typescript
{
  message: string;
} // max 500 chars
```

Response:

```typescript
{
  reply: string,
  questionsRemaining: number  // 5 - used today
}
```

Error 429: { error: 'Daily limit reached', questionsRemaining: 0 }

**Claude API call for chat:**

```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 500,
  system: `You are a business analyst for a moving company called "${tenantName}".
You have access to their business data for the last 3 months.
Answer questions about their business using the data provided.
Be specific — use actual numbers from the data.
Give actionable recommendations, not just observations.
Keep answers concise — 3-5 sentences maximum.
If asked something not related to business data, politely redirect.

Business data:
${JSON.stringify(metrics, null, 2)}`,

  messages: [{ role: "user", content: userMessage }],
});
```

Metrics are fetched once and reused (from cache if available).

### Add to Railway env vars

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Files to create/modify

```
backend/src/routes/dashboard.ts    ← add /ai-insights and /ai-chat endpoints
backend/src/services/dashboard.service.ts ← add getAIMetrics(), getCachedInsights()
backend/src/lib/anthropic.ts       ← Anthropic client instance
backend/src/lib/env.ts             ← add ANTHROPIC_API_KEY
```

---

## Frontend

### Tab component

Add tab switcher at top of DashboardPage:

```tsx
const [activeTab, setActiveTab] = useState<'metrics' | 'ai'>('metrics')

// Tab UI — match Settings tabs style exactly
<div style={{ borderBottom: '1px solid #e0e0dc', marginBottom: 24 }}>
  <button
    onClick={() => setActiveTab('metrics')}
    style={{ borderBottom: activeTab === 'metrics' ? '2px solid #1a1a18' : 'none' }}
  >
    📊 Metrics
  </button>
  <button
    onClick={() => setActiveTab('ai')}
    style={{ borderBottom: activeTab === 'ai' ? '2px solid #1a1a18' : 'none' }}
  >
    ✨ AI Insights
  </button>
</div>

{activeTab === 'metrics' && <MetricsTab />}  // existing dashboard content
{activeTab === 'ai' && <AIInsightsTab />}    // new
```

### AIInsightsTab component

**Auto insights section:**
4 insight cards, same white card style as existing dashboard cards:

```
border: 0.5px solid #e0e0dc
border-radius: 12px
padding: 20px 24px
margin-bottom: 12px
```

Loading state: show 4 skeleton cards while fetching.

Each card:

```tsx
<div style={{ display: "flex", gap: 12 }}>
  <span style={{ fontSize: 24 }}>{insight.emoji}</span>
  <div>
    <div style={{ fontWeight: 600, marginBottom: 4 }}>{insight.title}</div>
    <div style={{ color: "#555", lineHeight: 1.6 }}>{insight.text}</div>
  </div>
</div>
```

**Empty state** (< 10 orders):

```
🔍 Not enough data yet

Add at least 10 completed orders to unlock AI insights.
AI needs real data to find meaningful patterns in your business.

[Go to Orders →]
```

**Chat section:**

Below insights, separated by a divider:

```
Ask AI about your business
```

Chat history area (scrollable, max-height 400px):

- User messages: right-aligned, green bubble (#1D9E75 bg, white text)
- AI messages: left-aligned, white card with border
- Timestamps: small gray text below each message

Input area at bottom:

```tsx
<div style={{ display: "flex", gap: 8, marginTop: 16 }}>
  <input
    placeholder="Ask about your business..."
    value={message}
    onChange={(e) => setMessage(e.target.value)}
    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
    disabled={questionsRemaining === 0 || isLoading}
    style={{ flex: 1 }}
  />
  <span style={{ fontSize: 11, color: "#888", alignSelf: "center" }}>
    {questionsRemaining} left today
  </span>
  <button onClick={handleSend} disabled={!message.trim() || isLoading}>
    →
  </button>
</div>
```

When questionsRemaining = 0:

```
You've used all 5 AI questions for today.
Questions reset at midnight. Upgrade to Pro for unlimited questions.
```

**Suggested questions** (shown when chat is empty):

```
Try asking:
"Why did my revenue drop last week?"
"Which crew is most profitable?"
"How can I improve client retention?"
"Why are clients cancelling?"
"What's my best performing month?"
```

Clicking a suggestion fills the input.

### Hooks

```typescript
// hooks/useAIInsights.ts
export const useAIInsights = () =>
  useQuery({
    queryKey: ["ai-insights"],
    queryFn: () => apiFetch("/dashboard/ai-insights"),
    staleTime: 1000 * 60 * 60, // 1 hour — match server cache
  });

export const useAIChat = () =>
  useMutation({
    mutationFn: (message: string) =>
      apiFetch("/dashboard/ai-chat", {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
  });
```

### Files to create/modify

```
frontend/src/routes/DashboardPage.tsx        ← add tab switcher
frontend/src/components/dashboard/AIInsightsTab.tsx  ← new
frontend/src/components/dashboard/InsightCard.tsx    ← new
frontend/src/components/dashboard/AIChat.tsx         ← new
frontend/src/hooks/useAIInsights.ts                  ← new
```

---

## Acceptance criteria

### Auto insights

- AC1: "AI Insights" tab visible on Dashboard for owner
- AC2: 4 insight cards load with real data from Claude API
- AC3: Insights are specific — contain actual numbers from business data
- AC4: Loading skeleton shown while fetching
- AC5: Empty state shown when < 10 orders exist
- AC6: Insights cached 1 hour — no repeated Claude API calls

### Chat

- AC7: Owner can type question and receive AI response
- AC8: Response uses actual business data (specific numbers)
- AC9: Counter shows remaining questions (5 - used)
- AC10: 6th question returns 429 error, input disabled
- AC11: Suggested questions clickable and fill input
- AC12: Chat history visible in scrollable area
- AC13: Enter key sends message

### Security & cost

- AC14: Endpoint returns 403 for dispatcher role
- AC15: ANTHROPIC_API_KEY only on backend, never exposed to frontend
- AC16: Rate limit prevents >5 API calls per user per day
- AC17: Server-side cache prevents repeated Claude calls for insights

### Design

- AC18: Tab style matches existing Settings tabs
- AC19: Insight cards match existing dashboard card style
- AC20: `npm run typecheck` passes with zero errors

---

## Example prompts for testing after deployment

**English:**

- "Why did my revenue drop last week?"
- "Which crew is my most profitable?"
- "How can I improve client retention?"
- "Why are clients cancelling and how do I reduce it?"
- "What's my best performing type of move?"

**Russian:**

- "Почему упала выручка на прошлой неделе?"
- "Какая бригада приносит больше всего денег?"
- "Как увеличить возвращаемость клиентов?"
- "Почему клиенты отменяют заказы?"

---

## Note on cost

Claude Sonnet 4.6: ~$3 per 1M input tokens, ~$15 per 1M output tokens.
Estimated cost per insights request: ~$0.01-0.02
Estimated cost per chat message: ~$0.005-0.01
With 5 questions/day limit and 100 owners: ~$5-10/day max.
Acceptable for current scale.
