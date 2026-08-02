import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export type TenantSettings = {
  timezone: string           // 'America/New_York' | 'America/Los_Angeles' | ...
  baseRates: {               // whole US dollars (480 = $480), never cents
    studio: number           // 280
    '1br': number            // 380
    '2br': number            // 480
    '3br': number            // 620
    house: number            // 850
  }
  packingFee: number         // whole US dollars, default 120
  invoiceFooter?: string     // текст в подвале инвойса (опционально)
  phone?: string             // публичный телефон компании (для booking page / инвойсов)
  contractTerms?: string     // кастомные условия договора, max 2000 символов (для e-signature)
  hasSeenTour?: boolean      // прошёл ли owner интерактивный тур по продукту
}

// ─── TENANTS ──────────────────────────────────────────────────────────────────
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  logo_url: text('logo_url'),

  // Типизированный JSONB — TypeScript знает структуру
  settings: jsonb('settings')
    .$type<TenantSettings>()
    .default({
      timezone: 'America/New_York',
      baseRates: { studio: 280, '1br': 380, '2br': 480, '3br': 620, house: 850 },
      packingFee: 120,
    }),

  plan: varchar('plan', { length: 20 })
    .$type<'trial' | 'basic' | 'pro'>()  // только допустимые значения
    .default('trial'),

  // Публичная страница самостоятельного бронирования (/book/:slug)
  booking_enabled: boolean('booking_enabled').notNull().default(false),
  booking_description: text('booking_description'),

  trial_ends_at: timestamp('trial_ends_at'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
},
// Индексы для tenants
// slug уже unique — PostgreSQL создаёт индекс автоматически
// Дополнительных индексов не нужно — tenants таблица маленькая
() => ({}))

// ─── USERS ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  email: varchar('email', { length: 255 }).unique().notNull(),
  password_hash: text('password_hash').notNull(),

  role: varchar('role', { length: 20 })
    .$type<'owner' | 'dispatcher' | 'crew'>()  // TypeScript enum через тип
    .notNull(),

  // Для роли 'crew' — привязка к бригаде. Ограничивает crew-пользователя
  // заказами только своей бригады (мобильный PWA-экран бригады).
  crew_id: uuid('crew_id').references(() => crews.id),

  name: varchar('name', { length: 255 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),

  // Updated on every successful login — see login_events below for full history.
  last_login_at: timestamp('last_login_at'),

  // Soft delete — не удаляем пользователей физически
  // Если owner удалил диспетчера — данные сохраняются
  // При select всегда фильтруем: .where(isNull(users.deleted_at))
  deleted_at: timestamp('deleted_at'),
},
(table) => ({
  // Почему этот индекс: login делает SELECT WHERE email = ?
  // email уже unique — индекс создаётся автоматически, явно не нужен

  // Но нужен индекс для "все пользователи этого tenant"
  // Используется в: GET /users (список команды)
  tenantIdIdx: index('users_tenant_id_idx').on(table.tenant_id),
}))

// ─── CLIENTS ──────────────────────────────────────────────────────────────────
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
},
(table) => ({
  // Самый важный индекс для clients:
  // При создании заказа диспетчер вводит телефон → система ищет клиента
  // SELECT * FROM clients WHERE tenant_id = ? AND phone = ?
  // Составной индекс покрывает оба условия одним индексом
  tenantPhoneIdx: uniqueIndex('clients_tenant_phone_idx')
    .on(table.tenant_id, table.phone),

  // Для поиска по имени: WHERE tenant_id = ? AND name ILIKE '%smith%'
  // Обычный индекс не помогает с ILIKE, но помогает с точным поиском
  tenantNameIdx: index('clients_tenant_name_idx')
    .on(table.tenant_id, table.name),
}))

// ─── CREWS ────────────────────────────────────────────────────────────────────
export const crews = pgTable('crews', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  name: varchar('name', { length: 255 }).notNull(),
  truck_label: varchar('truck_label', { length: 100 }),
  phone: varchar('phone', { length: 20 }),
  active: boolean('active').default(true),
  created_at: timestamp('created_at').defaultNow(),
},
(table) => ({
  // GET /crews возвращает только активные бригады для tenant
  // SELECT * FROM crews WHERE tenant_id = ? AND active = true
  tenantActiveIdx: index('crews_tenant_active_idx')
    .on(table.tenant_id, table.active),
}))

// ─── ORDERS ───────────────────────────────────────────────────────────────────
// Самая важная таблица — больше всего запросов и индексов
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  client_id: uuid('client_id').references(() => clients.id),
  crew_id: uuid('crew_id').references(() => crews.id),
  // nullable — заказы с публичной booking-страницы создаются системой (created_by = null)
  created_by: uuid('created_by').references(() => users.id),

  status: varchar('status', { length: 20 })
    .$type<'new' | 'confirmed' | 'in_progress' | 'completed' | 'closed' | 'cancelled'>()
    .notNull()
    .default('new'),

  move_date: date('move_date').notNull(),
  from_address: text('from_address').notNull(),
  to_address: text('to_address').notNull(),
  from_floor: integer('from_floor').default(1),
  to_floor: integer('to_floor').default(1),
  from_elevator: boolean('from_elevator').default(false),
  to_elevator: boolean('to_elevator').default(false),

  home_size: varchar('home_size', { length: 20 })
    .$type<'studio' | '1br' | '2br' | '3br' | 'house'>()
    .notNull(),

  packing: boolean('packing').default(false),
  notes: text('notes'),

  // Whole US dollars, NOT cents. $480 is stored as 480.
  // tenant.settings.baseRates and settings.packingFee use the same unit, and
  // Stripe conversion multiplies by 100 at the call site (invoices.service.ts).
  // Mixing units here previously caused a 100x overcharge on packing.
  base_price: integer('base_price').notNull().default(0),
  total_price: integer('total_price').notNull().default(0),

  // ─── Digital contract / e-signature (Sprint 6) ──────────────────────────────
  // none  — договор ещё не создан
  // sent  — сгенерирован токен, ссылка отправлена клиенту, ждём подписи
  // signed — клиент подписал
  contract_status: varchar('contract_status', { length: 20 })
    .$type<'none' | 'sent' | 'signed'>()
    .notNull()
    .default('none'),
  // Публичный токен для страницы подписания /contract/:token — UUID, не угадывается
  contract_token: uuid('contract_token').unique(),
  contract_signed_at: timestamp('contract_signed_at'),
  contract_signed_name: varchar('contract_signed_name', { length: 255 }),
  // URL картинки подписи в R2
  contract_signature_url: text('contract_signature_url'),

  // ─── Automated notifications (Sprint 6) ─────────────────────────────────────
  // Guard against sending the 24h reminder email more than once per order.
  reminder_sent: boolean('reminder_sent').notNull().default(false),

  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
},
(table) => ({
  // ── Индекс 1: Kanban доска ─────────────────────────────────────────────────
  // Самый частый запрос: все заказы tenant по статусам
  // SELECT * FROM orders WHERE tenant_id = ? ORDER BY move_date
  // Составной индекс: сначала фильтр по tenant, потом сортировка по дате
  tenantMoveDateIdx: index('orders_tenant_move_date_idx')
    .on(table.tenant_id, table.move_date),

  // ── Индекс 2: Фильтр по статусу ───────────────────────────────────────────
  // WHERE tenant_id = ? AND status = 'new'
  // Используется при фильтрации колонок Kanban
  tenantStatusIdx: index('orders_tenant_status_idx')
    .on(table.tenant_id, table.status),

  // ── Индекс 3: Заказы клиента ───────────────────────────────────────────────
  // История заказов в карточке клиента
  // SELECT * FROM orders WHERE client_id = ? AND tenant_id = ?
  clientIdIdx: index('orders_client_id_idx')
    .on(table.client_id, table.tenant_id),

  // ── Индекс 4: Заказы бригады ───────────────────────────────────────────────
  // Загрузка бригады на неделю: WHERE crew_id = ? AND move_date BETWEEN ? AND ?
  crewMoveDateIdx: index('orders_crew_move_date_idx')
    .on(table.crew_id, table.move_date),
}))

// ─── INVOICES ─────────────────────────────────────────────────────────────────
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  order_id: uuid('order_id').notNull().references(() => orders.id),
  number: varchar('number', { length: 20 }).notNull(),

  // 'refunded'/'disputed' cover charge.refunded / charge.dispute.created — without
  // them a refunded invoice kept showing 'paid' (Payment received) forever.
  status: varchar('status', { length: 20 })
    .$type<'draft' | 'sent' | 'paid' | 'refunded' | 'disputed'>()
    .notNull()
    .default('draft'),

  pdf_url: text('pdf_url'),
  share_token: uuid('share_token').unique().defaultRandom(),
  stripe_payment_intent_id: varchar('stripe_payment_intent_id', { length: 255 }),
  stripe_checkout_session_id: varchar('stripe_checkout_session_id', { length: 255 }),
  paid_amount: integer('paid_amount'),
  sent_at: timestamp('sent_at'),
  paid_at: timestamp('paid_at'),
  expires_at: timestamp('expires_at'),
  created_at: timestamp('created_at').defaultNow(),
},
(table) => ({
  // Список инвойсов для tenant
  tenantStatusIdx: index('invoices_tenant_status_idx')
    .on(table.tenant_id, table.status),

  // Concurrent invoice creation for the same tenant used to be able to compute the
  // same count(*)+1001 number twice — this constraint turns that race into a
  // retryable unique-violation instead of a silent duplicate (see generateInvoice).
  tenantNumberIdx: uniqueIndex('invoices_tenant_number_idx')
    .on(table.tenant_id, table.number),

  // Публичная ссылка: GET /i/:token
  // SELECT * FROM invoices WHERE share_token = ? AND expires_at > NOW()
  // share_token уже unique — индекс создаётся автоматически

  // Инвойс по заказу: один заказ = один инвойс
  orderIdIdx: uniqueIndex('invoices_order_id_idx').on(table.order_id),
}))

// ─── INVOICE COUNTERS ─────────────────────────────────────────────────────────
// Backs generateInvoice()'s per-tenant numbering. A plain count(*)+1001 has no
// atomicity: two concurrent requests can read the same count and try to insert the
// same number. This table exists purely so `INSERT ... ON CONFLICT (tenant_id) DO
// UPDATE SET last_number = last_number + 1 RETURNING last_number` can hand out a
// number — Postgres serializes concurrent upserts on the same row via a row lock,
// so no two callers can ever get the same value back, regardless of concurrency.
export const invoiceCounters = pgTable('invoice_counters', {
  tenant_id: uuid('tenant_id').primaryKey().references(() => tenants.id),
  last_number: integer('last_number').notNull(),
})

// ─── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').unique().notNull().references(() => tenants.id),
  stripe_customer_id: varchar('stripe_customer_id', { length: 255 }),
  stripe_sub_id: varchar('stripe_sub_id', { length: 255 }),

  plan: varchar('plan', { length: 20 })
    .$type<'trial' | 'basic' | 'pro'>()
    .notNull()
    .default('trial'),

  status: varchar('status', { length: 20 })
    .$type<'trialing' | 'active' | 'past_due' | 'cancelled'>()
    .notNull()
    .default('trialing'),

  current_period_end: timestamp('current_period_end'),
}
// Нет дополнительных индексов — таблица маленькая (1 строка на tenant)
// tenant_id уже unique — индекс создаётся автоматически
)

// ─── INVITES ──────────────────────────────────────────────────────────────────
export const invites = pgTable('invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  email: varchar('email', { length: 255 }).notNull(),
  token: uuid('token').unique().notNull().defaultRandom(),

  // Роль приглашённого пользователя. Для 'crew' обязателен crew_id — при
  // принятии инвайта пользователь привязывается к своей бригаде.
  role: varchar('role', { length: 20 })
    .$type<'owner' | 'dispatcher' | 'crew'>()
    .notNull()
    .default('dispatcher'),
  crew_id: uuid('crew_id').references(() => crews.id),

  expires_at: timestamp('expires_at').notNull(),
  created_at: timestamp('created_at').defaultNow(),
}
// token уже unique — индекс автоматически
// Таблица маленькая — доп. индексов не нужно
)

// ─── ORDER FILES ──────────────────────────────────────────────────────────────
export const orderFiles = pgTable('order_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  order_id: uuid('order_id').notNull().references(() => orders.id),
  name: varchar('name', { length: 255 }).notNull(),
  url: text('url').notNull(),

  // Ключ объекта в R2 — нужен для DeleteObjectCommand при удалении файла
  // Не в исходной спецификации таблицы, но без него нельзя удалить объект из R2
  key: text('key').notNull(),

  size: integer('size').notNull(),
  mime_type: varchar('mime_type', { length: 100 }).notNull(),
  uploaded_by: uuid('uploaded_by').notNull().references(() => users.id),
  created_at: timestamp('created_at').defaultNow(),
},
(table) => ({
  // Список файлов заказа: WHERE order_id = ? AND tenant_id = ?
  orderIdIdx: index('order_files_order_id_idx').on(table.order_id, table.tenant_id),
}))

// ─── LEADS ────────────────────────────────────────────────────────────────────
// Потенциальные клиенты до превращения в заказ. Воронка продаж:
// new → contacted → quoted → booked (конвертирован в order) | lost
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),

  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),

  // Детали переезда — необязательны на стадии лида
  from_address: text('from_address'),
  to_address: text('to_address'),
  move_date: date('move_date'),
  home_size: varchar('home_size', { length: 20 }),
  notes: text('notes'),

  status: varchar('status', { length: 20 })
    .$type<'new' | 'contacted' | 'quoted' | 'booked' | 'lost'>()
    .notNull()
    .default('new'),

  // Откуда пришёл лид — для аналитики источников
  source: varchar('source', { length: 50 })
    .$type<'manual' | 'booking_page' | 'zapier' | 'phone'>()
    .notNull()
    .default('manual'),

  // Guard против повторной отправки напоминания владельцу о незакрытом лиде.
  reminder_sent: boolean('reminder_sent').default(false),

  // Заполняется при конвертации лида в заказ.
  converted_order_id: uuid('converted_order_id').references(() => orders.id),

  created_by: uuid('created_by').references(() => users.id),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
},
(table) => ({
  // Список лидов по статусу: WHERE tenant_id = ? AND status = ?
  tenantStatusIdx: index('leads_tenant_status_idx').on(table.tenant_id, table.status),
}))

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
// In-app notification centre. A parallel channel to email, not a replacement:
// email delivery depends on a verified sending domain, this does not.
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),

  type: varchar('type', { length: 40 })
    .$type<
      | 'lead_new'
      | 'contract_signed'
      | 'invoice_paid'
      | 'invoice_refunded'
      | 'invoice_disputed'
      | 'move_reminder'
      | 'feedback_new'
    >()
    .notNull(),

  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),

  // Polymorphic pointer to the record this is about — kept as a type + id pair
  // rather than one opaque string so the frontend can build the route without
  // parsing. No FK: the target lives in one of four different tables.
  related_type: varchar('related_type', { length: 20 })
    .$type<'order' | 'invoice' | 'lead' | 'feedback'>(),
  related_id: uuid('related_id'),

  read_at: timestamp('read_at'),
  created_at: timestamp('created_at').defaultNow(),
},
(table) => ({
  // GET /notifications: WHERE tenant_id = ? ORDER BY created_at DESC
  tenantCreatedIdx: index('notifications_tenant_created_idx')
    .on(table.tenant_id, table.created_at),

  // Unread badge count: WHERE tenant_id = ? AND read_at IS NULL
  tenantReadAtIdx: index('notifications_tenant_read_at_idx')
    .on(table.tenant_id, table.read_at),

  // Dedupe lookup for the reminder job, which cannot rely on orders.reminder_sent
  // (that flag is only set after a successful email send).
  tenantRelatedIdx: index('notifications_tenant_related_idx')
    .on(table.tenant_id, table.type, table.related_id),
}))

// ─── FEEDBACK ─────────────────────────────────────────────────────────────────
// Pilot bug/feedback reports, submitted in-app. tenant_id and user_id are both
// nullable — the button also renders on pages with no tenant context at all
// (e.g. /guide), so a submission there has nowhere tenant-scoped to attach to.
export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').references(() => tenants.id),
  user_id: uuid('user_id').references(() => users.id),

  message: text('message').notNull(),
  page_url: text('page_url').notNull(),
  severity: varchar('severity', { length: 20 }).$type<'bug' | 'suggestion' | 'other'>(),

  created_at: timestamp('created_at').defaultNow(),
},
(table) => ({
  // Direct DB review (no admin UI in this task): WHERE tenant_id = ? ORDER BY created_at DESC
  tenantCreatedIdx: index('feedback_tenant_created_idx').on(table.tenant_id, table.created_at),
}))

// ─── LOGIN EVENTS ─────────────────────────────────────────────────────────────
// Full login history, one row per successful login (failed attempts are not
// recorded — see routes/auth.ts). users.last_login_at is the cheap "when did
// they last log in" read; this table is for a fuller history if a UI ever
// wants it.
export const loginEvents = pgTable('login_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  ip_address: varchar('ip_address', { length: 64 }),

  created_at: timestamp('created_at').defaultNow(),
},
(table) => ({
  // GET /users/:id/login-history: WHERE user_id = ? AND tenant_id = ? ORDER BY created_at DESC
  userTenantCreatedIdx: index('login_events_user_tenant_created_idx')
    .on(table.user_id, table.tenant_id, table.created_at),
}))

// ─── STRIPE EVENTS ────────────────────────────────────────────────────────────
// Idempotency + ordering ledger for Stripe webhooks. `id` is Stripe's own event id
// (globally unique), so a row existing IS the idempotency check. `customer_id` +
// `created` (Stripe's event timestamp, not our insert time) let a handler ask "is
// this the most recent event for this customer?" before applying a status change —
// without it, an out-of-order customer.subscription.updated can regress a newer
// status back to an older one.
export const stripeEvents = pgTable('stripe_events', {
  id: varchar('id', { length: 255 }).primaryKey(),
  customer_id: varchar('customer_id', { length: 255 }),
  type: varchar('type', { length: 100 }).notNull(),
  created: timestamp('created').notNull(),
  processed_at: timestamp('processed_at').defaultNow(),
},
(table) => ({
  // "What's the latest event we've applied for this customer?" — MAX(created)
  // WHERE customer_id = ?
  customerCreatedIdx: index('stripe_events_customer_created_idx')
    .on(table.customer_id, table.created),
}))

// ─── ЭКСПОРТ ТИПОВ ────────────────────────────────────────────────────────────
// Drizzle умеет автоматически генерировать TypeScript типы из схемы
// Используй их вместо ручного написания интерфейсов

export type Tenant = typeof tenants.$inferSelect      // тип для SELECT
export type NewTenant = typeof tenants.$inferInsert   // тип для INSERT

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert

export type Crew = typeof crews.$inferSelect
export type NewCrew = typeof crews.$inferInsert

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert

export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert

export type InvoiceCounter = typeof invoiceCounters.$inferSelect

export type Subscription = typeof subscriptions.$inferSelect
export type Invite = typeof invites.$inferSelect

export type OrderFile = typeof orderFiles.$inferSelect
export type NewOrderFile = typeof orderFiles.$inferInsert

export type Lead = typeof leads.$inferSelect
export type NewLead = typeof leads.$inferInsert

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert

export type Feedback = typeof feedback.$inferSelect
export type NewFeedback = typeof feedback.$inferInsert

export type LoginEvent = typeof loginEvents.$inferSelect
export type NewLoginEvent = typeof loginEvents.$inferInsert

export type StripeEvent = typeof stripeEvents.$inferSelect
export type NewStripeEvent = typeof stripeEvents.$inferInsert