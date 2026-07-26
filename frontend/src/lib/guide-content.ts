export type GuideLang = 'en' | 'ru'

export type GuideBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'subheading'; text: string }
  | { type: 'placeholder'; label: string; images?: string[] }

export interface GuideSection {
  id: string
  title: string
  blocks: GuideBlock[]
}

const en: GuideSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    blocks: [
      {
        type: 'p',
        text: 'Welcome — this is a pilot/test version of MovingDesk, a CRM built for small moving companies. You are one of a small group of moving companies helping us test it with a real workflow before a wider release.',
      },
      {
        type: 'p',
        text: 'The goal of this pilot is to use MovingDesk the way you would on a normal day — booking jobs, assigning crews, sending contracts and invoices — and tell us what breaks, what is confusing, or what is missing. Please report any bugs or feedback as you go; that is exactly what this period is for.',
      },
    ],
  },
  {
    id: 'getting-started',
    title: 'Getting started — registration',
    blocks: [
      {
        type: 'p',
        text: 'Register at the app URL shown below. Registering automatically creates your own company account (a "tenant" in MovingDesk) — you do not need anyone to set it up for you, and your data is fully separate from any other company using the app.',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings walkthrough',
    blocks: [
      {
        type: 'subheading',
        text: 'Company tab',
      },
      {
        type: 'p',
        text: 'Set your base rates by home size, packing fee, timezone, and logo here. These settings drive pricing everywhere in the app from one place — the New Order price preview, the public booking page, and invoices all pull from the same numbers, so you only need to update them once.',
      },
      { type: 'placeholder', label: 'Screenshot: Settings → Company tab', images: ['/guide/settings-company.png'] },
      {
        type: 'subheading',
        text: 'Team vs. Crews — read this carefully, it confused testers before you',
      },
      {
        type: 'list',
        items: [
          'Crews tab = a truck/roster profile (name, truck label, phone). It is NOT a login — it just describes a truck and who is on it.',
          'Team tab = where you invite actual user logins, including logins for crew members. When you invite someone, pick role "Crew member" and select which Crew profile (from the Crews tab) that login should be tied to.',
        ],
      },
      { type: 'placeholder', label: 'Screenshot: Settings → Team tab, invite form', images: ['/guide/settings-team.png'] },
      { type: 'placeholder', label: 'Screenshot: Settings → Crews tab', images: ['/guide/settings-crew.png'] },
      {
        type: 'subheading',
        text: 'Booking tab',
      },
      {
        type: 'p',
        text: 'Shows your public booking page link. Booking is enabled by default for every new company. Use the "Copy link" button here to get your shareable booking URL — this is what you send to clients or put on your website or social media.',
      },
      {
        type: 'p',
        text: 'Note: the booking calendar only shows available dates once you have at least one crew added (Settings → Crews). Add a crew before you share this link with real clients, or the calendar will look empty.',
      },
      {
        type: 'placeholder',
        label: 'Screenshot: Settings → Booking tab',
        images: ['/guide/settings-booking.png', '/guide/settings-booking-page.png', '/guide/settings-booking-recieved.png'],
      },
    ],
  },
  {
    id: 'leads-orders',
    title: 'Leads and Orders',
    blocks: [
      {
        type: 'p',
        text: 'When a client submits a request through your public booking page, it shows up in your account as a Lead, not yet as an Order.',
      },
      {
        type: 'p',
        text: 'Convert a lead into an Order whenever you are ready to commit to the job. Note: orders created this way (or created directly through the public booking page) start out with no crew assigned — go to the order detail panel and assign a crew there before the move date.',
      },
      { type: 'placeholder', label: 'Screenshot: Leads tab with a new lead', images: ['/guide/leads-new-lead.png'] },
    ],
  },
  {
    id: 'assign-crew',
    title: 'Assigning a crew to an order',
    blocks: [
      {
        type: 'p',
        text: 'Open the order detail panel, find the Crew field, select a crew, and click Save. This step is required for the crew member to see the job in their mobile app — an order with no crew assigned will not show up for anyone.',
      },
      { type: 'placeholder', label: 'Screenshot: Order detail panel, Crew field', images: ['/guide/order-crew-field.png'] },
    ],
  },
  {
    id: 'crew-pwa',
    title: 'Crew mobile PWA',
    blocks: [
      {
        type: 'list',
        items: [
          'Crew members log in at /crew/login using the credentials created via the Team tab invite (see the Settings walkthrough above).',
          'If an email invite does not arrive (see Known limitations below), use the "Copy link" shown after clicking "Send invite" to share the join link manually — texting or messaging it works fine.',
          'Known quirk: occasionally, after refreshing the PWA page, you may see a blank white screen. Simply log in again if this happens — no data is lost.',
        ],
      },
      {
        type: 'placeholder',
        label: 'Screenshot: Crew mobile PWA, job view',
        images: ['/guide/crew-pwa-login.png', '/guide/crew-pwa-job-view.png'],
      },
    ],
  },
  {
    id: 'contracts',
    title: 'Contracts (e-signature)',
    blocks: [
      {
        type: 'list',
        items: [
          'From an order’s detail panel, you can send the contract for the client to sign electronically.',
          'If the email does not arrive, use the "Copy link" button next to "Resend" to share the signing link manually.',
          'Once the client signs, the panel shows the signature date and a link to view or download the signed PDF.',
        ],
      },
      {
        type: 'placeholder',
        label: 'Screenshot: Order detail panel, Contract section',
        images: ['/guide/order-contract-section.png', '/guide/order-contract-page.png', '/guide/order-contract-successfull.png'],
      },
    ],
  },
  {
    id: 'invoices',
    title: 'Invoices and payment',
    blocks: [
      {
        type: 'list',
        items: [
          'Invoices can only be generated for orders that are completed or closed.',
          'Order of operations matters: click "Send to client" first — the share/copy link only becomes available after sending, not before.',
          'Once the link is available, copy it (if the email does not arrive) and share it with the client. They can pay by card using the link — in test mode, use card 4242 4242 4242 4242, any future expiry date, and any CVC.',
        ],
      },
      {
        type: 'placeholder',
        label: 'Screenshot: Invoice detail, Send to client / Copy link',
        images: [
          '/guide/invoice-page.png',
          '/guide/invoice-sent-copy-link.png',
          '/guide/invoice-page-payment.png',
          '/guide/invoice-page-payment-successfull.png',
        ],
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    blocks: [
      {
        type: 'p',
        text: 'The bell icon in the top navigation shows in-app notifications for new leads/bookings, signed contracts, and paid invoices. Check it regularly, especially while email delivery is limited — see Known limitations below.',
      },
      { type: 'placeholder', label: 'Screenshot: Notification bell, top navigation', images: ['/guide/notification-bell.png'] },
    ],
  },
  {
    id: 'known-limitations',
    title: 'Known limitations',
    blocks: [
      {
        type: 'p',
        text: 'We want to be upfront about a few limitations during this pilot:',
      },
      {
        type: 'list',
        items: [
          'Email delivery is currently limited to internal testing — the app’s email provider (Resend) is not yet fully configured with a verified domain, so automated emails (invites, contracts, invoices, booking confirmations, payment confirmations, move reminders) may not reach real client inboxes yet. Wherever a "Copy link" option is available (invites, contracts, invoices, the booking page), use it to share links manually in the meantime. For booking confirmations, payment confirmations, and move reminders — which have no link to copy — please follow up with clients directly by phone or text until this is resolved.',
          'Occasional PWA white-screen-on-refresh on the crew mobile app — just log in again (see the Crew mobile PWA section above).',
          'This is an active pilot. Please report anything unexpected, even if it seems minor.',
        ],
      },
    ],
  },
]

const ru: GuideSection[] = [
  {
    id: 'overview',
    title: 'Обзор',
    blocks: [
      {
        type: 'p',
        text: 'Добро пожаловать — это пилотная/тестовая версия MovingDesk, CRM для небольших переездных компаний. Вы — одна из немногих компаний, которые помогают нам протестировать систему в реальной работе перед более широким запуском.',
      },
      {
        type: 'p',
        text: 'Цель этого пилота — использовать MovingDesk так, как вы работаете в обычный день: бронировать заказы, назначать бригады, отправлять договоры и счета — и сообщать нам, что не работает, что непонятно или чего не хватает. Пожалуйста, сообщайте о любых ошибках и замечаниях по ходу работы — именно для этого нужен этот период.',
      },
    ],
  },
  {
    id: 'getting-started',
    title: 'Начало работы — регистрация',
    blocks: [
      {
        type: 'p',
        text: 'Зарегистрируйтесь по адресу приложения, указанному ниже. Регистрация автоматически создаёт учётную запись вашей компании ("tenant" в MovingDesk) — никто не должен настраивать её за вас, и ваши данные полностью отделены от данных любой другой компании, использующей приложение.',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Обзор настроек',
    blocks: [
      {
        type: 'subheading',
        text: 'Вкладка Company (Компания)',
      },
      {
        type: 'p',
        text: 'Здесь задаются базовые тарифы по размеру жилья, плата за упаковку, часовой пояс и логотип. Эти настройки формируют цену во всех частях приложения из одного места — в предпросмотре цены при создании заказа, на публичной странице бронирования и в счетах используются одни и те же значения, поэтому обновлять их нужно только один раз.',
      },
      { type: 'placeholder', label: 'Скриншот: Настройки → вкладка Company', images: ['/guide/settings-company.png'] },
      {
        type: 'subheading',
        text: 'Team и Crews — прочитайте внимательно, это путало тестировщиков ранее',
      },
      {
        type: 'list',
        items: [
          'Вкладка Crews = профиль грузовика/бригады (название, номер грузовика, телефон). Это НЕ логин — просто описание грузовика и того, кто в нём работает.',
          'Вкладка Team = место, где вы приглашаете реальные логины пользователей, включая логины членов бригады. При приглашении выберите роль "Crew member" и укажите, к какому профилю Crew (из вкладки Crews) привязан этот логин.',
        ],
      },
      { type: 'placeholder', label: 'Скриншот: Настройки → вкладка Team, форма приглашения', images: ['/guide/settings-team.png'] },
      { type: 'placeholder', label: 'Скриншот: Настройки → вкладка Crews', images: ['/guide/settings-crew.png'] },
      {
        type: 'subheading',
        text: 'Вкладка Booking (Бронирование)',
      },
      {
        type: 'p',
        text: 'Здесь показана ссылка на вашу публичную страницу бронирования. Бронирование включено по умолчанию для каждой новой компании. Используйте кнопку "Copy link" на этой вкладке, чтобы получить ссылку для отправки клиентам или размещения на сайте либо в соцсетях.',
      },
      {
        type: 'p',
        text: 'Важно: календарь бронирования показывает свободные даты только если добавлена хотя бы одна бригада (Настройки → Crews). Добавьте бригаду перед тем, как делиться этой ссылкой с реальными клиентами — иначе календарь будет выглядеть пустым.',
      },
      {
        type: 'placeholder',
        label: 'Скриншот: Настройки → вкладка Booking',
        images: ['/guide/settings-booking.png', '/guide/settings-booking-page.png', '/guide/settings-booking-recieved.png'],
      },
    ],
  },
  {
    id: 'leads-orders',
    title: 'Лиды и заказы',
    blocks: [
      {
        type: 'p',
        text: 'Когда клиент отправляет заявку через вашу публичную страницу бронирования, она появляется в аккаунте как Lead (лид), а не сразу как заказ.',
      },
      {
        type: 'p',
        text: 'Конвертируйте лид в заказ (Order), когда готовы взяться за работу. Обратите внимание: заказы, созданные таким образом (или напрямую через публичную страницу бронирования), изначально создаются без назначенной бригады — перейдите в панель деталей заказа и назначьте бригаду до дня переезда.',
      },
      { type: 'placeholder', label: 'Скриншот: вкладка Leads с новым лидом', images: ['/guide/leads-new-lead.png'] },
    ],
  },
  {
    id: 'assign-crew',
    title: 'Назначение бригады на заказ',
    blocks: [
      {
        type: 'p',
        text: 'Откройте панель деталей заказа, найдите поле Crew, выберите бригаду и нажмите Save. Этот шаг необходим, чтобы член бригады увидел заказ в своём мобильном приложении — заказ без назначенной бригады никому не отображается.',
      },
      { type: 'placeholder', label: 'Скриншот: панель деталей заказа, поле Crew', images: ['/guide/order-crew-field.png'] },
    ],
  },
  {
    id: 'crew-pwa',
    title: 'Мобильное приложение бригады (PWA)',
    blocks: [
      {
        type: 'list',
        items: [
          'Члены бригады входят в систему по адресу /crew/login, используя учётные данные, созданные через приглашение на вкладке Team (см. раздел "Обзор настроек" выше).',
          'Если email-приглашение не приходит (см. раздел "Известные ограничения" ниже), используйте "Copy link", появляющуюся после нажатия "Send invite", чтобы передать ссылку для входа вручную — отправка по СМС или мессенджеру подойдёт.',
          'Известная особенность: иногда после обновления страницы PWA может появиться пустой белый экран. В этом случае просто войдите в систему снова — данные не теряются.',
        ],
      },
      {
        type: 'placeholder',
        label: 'Скриншот: мобильное PWA бригады, экран заказа',
        images: ['/guide/crew-pwa-login.png', '/guide/crew-pwa-job-view.png'],
      },
    ],
  },
  {
    id: 'contracts',
    title: 'Договоры (электронная подпись)',
    blocks: [
      {
        type: 'list',
        items: [
          'Из панели деталей заказа можно отправить договор клиенту для электронного подписания.',
          'Если письмо не приходит, используйте кнопку "Copy link" рядом с "Resend", чтобы передать ссылку на подписание вручную.',
          'После подписания клиентом панель показывает дату подписания и ссылку для просмотра или скачивания подписанного PDF.',
        ],
      },
      {
        type: 'placeholder',
        label: 'Скриншот: панель деталей заказа, раздел Contract',
        images: ['/guide/order-contract-section.png', '/guide/order-contract-page.png', '/guide/order-contract-successfull.png'],
      },
    ],
  },
  {
    id: 'invoices',
    title: 'Счета и оплата',
    blocks: [
      {
        type: 'list',
        items: [
          'Счета можно создавать только для заказов со статусом completed или closed.',
          'Важен порядок действий: сначала нажмите "Send to client" — ссылка для отправки/копирования становится доступна только после отправки, а не до неё.',
          'После появления ссылки скопируйте её (если письмо не приходит) и отправьте клиенту. Оплата картой доступна по ссылке — в тестовом режиме используйте карту 4242 4242 4242 4242, любую будущую дату истечения и любой CVC.',
        ],
      },
      {
        type: 'placeholder',
        label: 'Скриншот: детали счёта, Send to client / Copy link',
        images: [
          '/guide/invoice-page.png',
          '/guide/invoice-sent-copy-link.png',
          '/guide/invoice-page-payment.png',
          '/guide/invoice-page-payment-successfull.png',
        ],
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Уведомления',
    blocks: [
      {
        type: 'p',
        text: 'Значок колокольчика в верхней навигации показывает внутренние уведомления о новых лидах/бронированиях, подписанных договорах и оплаченных счетах. Проверяйте его регулярно, особенно пока доставка email ограничена — см. раздел "Известные ограничения" ниже.',
      },
      { type: 'placeholder', label: 'Скриншот: значок уведомлений, верхняя навигация', images: ['/guide/notification-bell.png'] },
    ],
  },
  {
    id: 'known-limitations',
    title: 'Известные ограничения',
    blocks: [
      {
        type: 'p',
        text: 'Мы хотим сразу предупредить о нескольких ограничениях во время этого пилота:',
      },
      {
        type: 'list',
        items: [
          'Доставка email пока ограничена внутренним тестированием — почтовый провайдер приложения (Resend) ещё не полностью настроен с подтверждённым доменом, поэтому автоматические письма (приглашения, договоры, счета, подтверждения бронирования, подтверждения оплаты, напоминания о переезде) могут не доходить до реальных клиентов. Везде, где есть опция "Copy link" (приглашения, договоры, счета, страница бронирования), используйте её, чтобы передавать ссылки вручную. Для подтверждений бронирования, подтверждений оплаты и напоминаний о переезде — у которых нет ссылки для копирования — пожалуйста, связывайтесь с клиентами напрямую по телефону или СМС, пока это не будет исправлено.',
          'Периодический пустой белый экран после обновления страницы в мобильном PWA бригады — просто войдите снова (см. раздел "Мобильное приложение бригады" выше).',
          'Это активный пилот. Пожалуйста, сообщайте о любых неожиданных ситуациях, даже если они кажутся незначительными.',
        ],
      },
    ],
  },
]

export const GUIDE_CONTENT: Record<GuideLang, GuideSection[]> = { en, ru }

export const GUIDE_UI_STRINGS: Record<GuideLang, { pageTitle: string; pageSubtitle: string; tocHeading: string; appUrlLabel: string }> = {
  en: {
    pageTitle: 'MovingDesk — Pilot guide',
    pageSubtitle: 'A single-page reference for your pilot team. Everything you need to get started.',
    tocHeading: 'On this page',
    appUrlLabel: 'App URL',
  },
  ru: {
    pageTitle: 'MovingDesk — Руководство для пилота',
    pageSubtitle: 'Справочная страница для вашей пилотной команды. Всё необходимое для начала работы.',
    tocHeading: 'На этой странице',
    appUrlLabel: 'Адрес приложения',
  },
}
