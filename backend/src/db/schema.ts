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
  baseRates: {               // цены в центах (480 = $4.80 — нет, у нас в долларах)
    studio: number           // 280
    '1br': number            // 380
    '2br': number            // 480
    '3br': number            // 620
    house: number            // 850
  }
  packingFee: number         // доп. стоимость упаковки, default 120
  invoiceFooter?: string     // текст в подвале инвойса (опционально)
  phone?: string             // публичный телефон компании (для booking page / инвойсов)
  contractTerms?: string     // кастомные условия договора, max 2000 символов (для e-signature)
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
    .$type<'owner' | 'dispatcher'>()  // TypeScript enum через тип
    .notNull(),

  name: varchar('name', { length: 255 }).notNull(),
  created_at: timestamp('created_at').defaultNow(),

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

  // Цены в центах — стандарт в финансовых системах
  // $480.00 → 48000 cents
  // Почему центы? Нет проблем с floating point: 0.1 + 0.2 = 0.30000000000000004
  // При отображении: (total_price / 100).toFixed(2) → "480.00"
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

  status: varchar('status', { length: 20 })
    .$type<'draft' | 'sent' | 'paid'>()
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

  // Публичная ссылка: GET /i/:token
  // SELECT * FROM invoices WHERE share_token = ? AND expires_at > NOW()
  // share_token уже unique — индекс создаётся автоматически

  // Инвойс по заказу: один заказ = один инвойс
  orderIdIdx: uniqueIndex('invoices_order_id_idx').on(table.order_id),
}))

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

export type Subscription = typeof subscriptions.$inferSelect
export type Invite = typeof invites.$inferSelect

export type OrderFile = typeof orderFiles.$inferSelect
export type NewOrderFile = typeof orderFiles.$inferInsert