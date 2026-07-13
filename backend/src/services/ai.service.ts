import Anthropic from '@anthropic-ai/sdk'
import { and, desc, eq, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { crews, orders, tenants } from '../db/schema.js'
import { AI_MODEL, anthropic, isAIConfigured } from '../lib/anthropic.js'

const PERIOD_DAYS = 90
const REVENUE_STATUSES = ['completed', 'closed'] as const
const MIN_ORDERS_FOR_INSIGHTS = 10
const INSIGHTS_TTL_MS = 60 * 60 * 1000
const DAILY_CHAT_LIMIT = 5

export interface AIMetricsWeek {
  week: string
  revenue: number
  orders: number
}

export interface AICrewStat {
  name: string
  ordersCount: number
  revenue: number
}

export interface AIMetrics {
  totalRevenue: number
  revenueByWeek: AIMetricsWeek[]
  prevPeriodRevenue: number
  crewStats: AICrewStat[]
  totalOrders: number
  totalClients: number
  repeatClients: number
  cancelledOrders: number
  cancellationRate: number
}

export interface AIInsight {
  type: string
  emoji: string
  title: string
  text: string
}

export interface InsightsResult {
  insights: AIInsight[]
  metrics: AIMetrics
  generatedAt: string
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

function formatWeekLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

const revenueSum = sql<number>`cast(coalesce(sum(${orders.total_price}) filter (where ${orders.status} in ('completed','closed')), 0) as int)`

async function getRevenueByWeek(tenantId: string): Promise<AIMetricsWeek[]> {
  const twelveWeeksAgo = daysAgo(12 * 7).toISOString().slice(0, 10)
  const rows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${orders.move_date}), 'YYYY-MM-DD')`,
      ordersCount: sql<number>`cast(count(${orders.id}) as int)`,
      revenue: revenueSum,
    })
    .from(orders)
    .where(and(eq(orders.tenant_id, tenantId), gte(orders.move_date, twelveWeeksAgo)))
    .groupBy(sql`date_trunc('week', ${orders.move_date})`)
    .orderBy(sql`date_trunc('week', ${orders.move_date}) asc`)
  return rows.map((r) => ({ week: formatWeekLabel(r.week), revenue: r.revenue, orders: r.ordersCount }))
}

async function getCrewStats(tenantId: string, periodStart: Date): Promise<AICrewStat[]> {
  return db
    .select({
      name: crews.name,
      ordersCount: sql<number>`cast(count(${orders.id}) as int)`,
      revenue: sql<number>`cast(coalesce(sum(${orders.total_price}), 0) as int)`,
    })
    .from(orders)
    .innerJoin(crews, and(eq(crews.id, orders.crew_id), eq(crews.tenant_id, tenantId)))
    .where(
      and(
        eq(orders.tenant_id, tenantId),
        inArray(orders.status, [...REVENUE_STATUSES]),
        gte(orders.created_at, periodStart)
      )
    )
    .groupBy(crews.id, crews.name)
    .orderBy(desc(sql`count(${orders.id})`))
}

async function countRepeatClients(tenantId: string, periodStart: Date): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(orders)
    .where(
      and(
        eq(orders.tenant_id, tenantId),
        gte(orders.created_at, periodStart),
        isNotNull(orders.client_id)
      )
    )
    .groupBy(orders.client_id)
  return rows.filter((r) => r.count >= 2).length
}

export async function getAIMetrics(tenantId: string): Promise<AIMetrics> {
  const periodStart = daysAgo(PERIOD_DAYS)
  const prevStart = daysAgo(PERIOD_DAYS * 2)

  const [agg] = await db
    .select({
      totalOrders: sql<number>`cast(count(${orders.id}) as int)`,
      cancelledOrders: sql<number>`cast(count(*) filter (where ${orders.status} = 'cancelled') as int)`,
      totalRevenue: revenueSum,
      totalClients: sql<number>`cast(count(distinct ${orders.client_id}) as int)`,
    })
    .from(orders)
    .where(and(eq(orders.tenant_id, tenantId), gte(orders.created_at, periodStart)))

  const [prev] = await db
    .select({ revenue: revenueSum })
    .from(orders)
    .where(
      and(
        eq(orders.tenant_id, tenantId),
        gte(orders.created_at, prevStart),
        lt(orders.created_at, periodStart)
      )
    )

  const [revenueByWeek, crewStats, repeatClients] = await Promise.all([
    getRevenueByWeek(tenantId),
    getCrewStats(tenantId, periodStart),
    countRepeatClients(tenantId, periodStart),
  ])

  const totalOrders = agg?.totalOrders ?? 0
  const cancelledOrders = agg?.cancelledOrders ?? 0

  return {
    totalRevenue: agg?.totalRevenue ?? 0,
    revenueByWeek,
    prevPeriodRevenue: prev?.revenue ?? 0,
    crewStats,
    totalOrders,
    totalClients: agg?.totalClients ?? 0,
    repeatClients,
    cancelledOrders,
    cancellationRate: totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0,
  }
}

const INSIGHTS_SYSTEM = `You are a business analyst for a moving company.
Analyze the provided metrics and generate exactly 4 insights.
Be specific, use the actual numbers from the data.
Each insight must include: a finding AND a recommendation.
Keep each insight to 2-3 sentences maximum.
Format as JSON array with objects: { type, emoji, title, text }
Types: revenue_trend | crew_utilization | client_retention | cancellations
Be direct and actionable. Owner is a small business operator, not a data analyst.`

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

function isInsight(value: unknown): value is AIInsight {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.type === 'string' &&
    typeof v.emoji === 'string' &&
    typeof v.title === 'string' &&
    typeof v.text === 'string'
  )
}

function parseInsights(message: Anthropic.Message): AIInsight[] {
  let text = extractText(message).trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }
  return Array.isArray(parsed) ? parsed.filter(isInsight) : []
}

async function generateInsights(metrics: AIMetrics): Promise<AIInsight[]> {
  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 1000,
    system: INSIGHTS_SYSTEM,
    messages: [
      {
        role: 'user',
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
  })
  return parseInsights(message)
}

const insightsCache = new Map<string, { result: InsightsResult; expiresAt: number }>()

export async function getCachedInsights(tenantId: string): Promise<InsightsResult> {
  const cached = insightsCache.get(tenantId)
  if (cached && cached.expiresAt > Date.now()) return cached.result

  const metrics = await getAIMetrics(tenantId)
  const insights =
    metrics.totalOrders >= MIN_ORDERS_FOR_INSIGHTS ? await generateInsights(metrics) : []
  const result: InsightsResult = { insights, metrics, generatedAt: new Date().toISOString() }
  insightsCache.set(tenantId, { result, expiresAt: Date.now() + INSIGHTS_TTL_MS })
  return result
}

async function getMetricsForChat(tenantId: string): Promise<AIMetrics> {
  const cached = insightsCache.get(tenantId)
  if (cached && cached.expiresAt > Date.now()) return cached.result.metrics
  return getAIMetrics(tenantId)
}

const chatUsage = new Map<string, { day: string; count: number }>()

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

export function remainingQuestions(userId: string): number {
  const usage = chatUsage.get(userId)
  const used = !usage || usage.day !== todayUtc() ? 0 : usage.count
  return Math.max(0, DAILY_CHAT_LIMIT - used)
}

function recordQuestion(userId: string): void {
  const day = todayUtc()
  const usage = chatUsage.get(userId)
  if (!usage || usage.day !== day) chatUsage.set(userId, { day, count: 1 })
  else usage.count += 1
}

async function getTenantName(tenantId: string): Promise<string> {
  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)
  return tenant?.name ?? 'your company'
}

export interface ChatResult {
  reply: string
  questionsRemaining: number
}

export async function generateChatReply(
  userId: string,
  tenantId: string,
  message: string
): Promise<ChatResult | null> {
  if (remainingQuestions(userId) <= 0) return null

  const [tenantName, metrics] = await Promise.all([
    getTenantName(tenantId),
    getMetricsForChat(tenantId),
  ])

  const response = await anthropic.messages.create({
    model: AI_MODEL,
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
    messages: [{ role: 'user', content: message }],
  })

  recordQuestion(userId)
  return { reply: extractText(response).trim(), questionsRemaining: remainingQuestions(userId) }
}

export { isAIConfigured }
