# SPEC.md — IntentLead AI
*Шаг 2 Spec-First. 6 обязательных блоков. Источник правды для SETUP_GENERATOR и субагентов.*
*Версия 1.0 · 2026-06-05 · читать целиком до любого кода.*

---

## БЛОК 1: ОБЗОР СИСТЕМЫ

### Описание
IntentLead AI — веб-приложение, которое находит людей и компании с публичным intent
(боль, вопрос, поиск инструмента) и доводит сигнал до верифицированного контакта с
готовым персонализированным письмом. Полный цикл: **сигнал → компания → email → письмо.**
Ключевая метрика: reply-rate клиентов ≥ 15% (рынок cold email: 2–5%).

### Для кого
Growth-фрилансеры и outbound-агентства (1–5 чел), ведущие pipeline ежедневно. Вторично —
B2B SaaS founders без SDR. Один сегмент, одна боль: «нужен поток качественных лидов каждый день».

### Две точки входа
- **COLD** — пользователь пришёл не через Glook. Минимал-чат-ассистент копает контекст
  (что продаёшь / кого ищешь / какая боль / гео), предлагает скан сайта, запускает pipeline.
- **WARM** — пользователь пришёл после скана Glook. Боль бизнеса и недостатки сайта уже
  известны (читаются из общей Supabase). Чат пропускает discovery, спрашивает только
  «кого ищешь + цели».

Обе точки сходятся в один объект `campaign` → один общий pipeline.

### Data Flow
```
COLD:  Chat (discovery + intake extract) ──┐
WARM:  Glook report (shared Supabase)    ──┤
                                            ▼
                                       campaign (keywords + ICP + tone)
                                            ▼
   Signal detection (Reddit API + HN Algolia, по keywords)
                                            ▼
   Intent classify (GPT-4o-mini, score 0–100, отсечка < 80)   ── L1 verify
                                            ▼
   Company identification (Google CSE + GPT-4o-mini)          ── L2 verify
                                            ▼
   Contact + role verify (LinkedIn role check)                ── L3 verify
                                            ▼
   Email waterfall (Prospeo → Hunter → Apollo)                ── L4 verify
                                            ▼
   Message generation (GPT-4o, RAG-grounded на контексте клиента)
                                            ▼
   Lead card (in-app) + CSV/Sheets export
   credit списывается ТОЛЬКО если L1–L4 все зелёные
```

---

## БЛОК 2: МОДЕЛЬ ДАННЫХ

> Общий Supabase-проект с Glook. Таблицы IntentLead в схеме `public` с префиксом-неймингом
> без коллизий. Glook-данные читаются, не пишутся.

### Сущности

**workspaces** (multi-tenant изоляция; владелец = Supabase auth user)
- id: uuid PK default gen_random_uuid()
- owner_id: uuid NOT NULL (auth.users.id)
- name: text NOT NULL
- plan: text NOT NULL DEFAULT 'free' CHECK in ('free','starter','growth','agency')
- credits_remaining: int NOT NULL DEFAULT 10  *(free = 10 лидов один раз)*
- free_converter_used: boolean NOT NULL DEFAULT false
- chat_messages_today: int NOT NULL DEFAULT 0  *(счётчик Plan/Strategy сообщений, сбрасывается в полночь UTC)*
- chat_messages_reset_at: timestamptz NULL
- created_at / updated_at: timestamptz DEFAULT now()

**workspace_members** (для плана Agency; MVP — только owner)
- id: uuid PK
- workspace_id: uuid FK workspaces ON DELETE CASCADE
- user_id: uuid NOT NULL
- role: text CHECK in ('owner','member') DEFAULT 'member'
- UNIQUE(workspace_id, user_id)

**campaigns** (конфиг поиска; результат intake)
- id: uuid PK
- workspace_id: uuid FK workspaces ON DELETE CASCADE NOT NULL
- entry_mode: text CHECK in ('cold','warm') NOT NULL
- glook_scan_id: uuid NULL  *(ссылка на скан Glook при warm; nullable)*
- what_selling: text NOT NULL
- icp: text NOT NULL          *(роль, размер, индустрия — свободный текст из чата)*
- pain: text NOT NULL
- geo: text NULL
- business_type: text CHECK in ('online_saas','local','b2b_enterprise','ecommerce') NULL
  *(определяется AI из intake; управляет выбором источников сигналов)*
- example_customers: text NULL
- keywords: text[] NOT NULL DEFAULT '{}'   *(AI-сгенерированы из intake)*
- tone: text NULL             *(шаблон тона для писем)*
- status: text CHECK in ('draft','running','done','error') DEFAULT 'draft'
- created_at / updated_at

**signals** (сырой пойманный сигнал)
- id: uuid PK
- campaign_id: uuid FK campaigns ON DELETE CASCADE NOT NULL
- source: text CHECK in (
    -- MVP
    'reddit','hackernews','github','stackoverflow',
    'vk','telegram','habr','vcru',
    'google_reviews','yelp','2gis','yandex_business','foursquare',
    -- V2
    'g2','capterra','producthunt','saashub','trustpilot',
    -- V3
    'greenhouse_jobs','crunchbase','linkedin'
  ) NOT NULL
- source_url: text NOT NULL
- author_handle: text NOT NULL
- content: text NOT NULL
- context: text NULL          *(subreddit / HN thread)*
- posted_at: timestamptz NULL
- created_at: timestamptz DEFAULT now()
- UNIQUE(campaign_id, source_url)   *(дедуп одного поста)*

**leads** (обработанный сигнал → потенциальный лид)
- id: uuid PK
- campaign_id: uuid FK campaigns ON DELETE CASCADE NOT NULL
- signal_id: uuid FK signals ON DELETE CASCADE NOT NULL
- intent_score: int NULL CHECK (0–100)
- intent_type: text NULL CHECK in ('pain','recommendation_request','comparison','hiring')
- company_name: text NULL
- company_domain: text NULL
- contact_name: text NULL
- contact_role: text NULL
- contact_linkedin: text NULL
- email: text NULL
- email_provider: text NULL CHECK in ('prospeo','hunter','apollo')
- why_now: text NULL          *(почему этот контакт релевантен сейчас)*
- opening_line: text NULL
- verify_signal: boolean NOT NULL DEFAULT false      *(L1)*
- verify_company: boolean NOT NULL DEFAULT false     *(L2)*
- verify_contact: boolean NOT NULL DEFAULT false     *(L3)*
- verify_email: boolean NOT NULL DEFAULT false       *(L4)*
- status: text CHECK in ('processing','verified','rejected') DEFAULT 'processing'
- reject_reason: text NULL    *(на каком уровне отбросили)*
- credit_charged: boolean NOT NULL DEFAULT false
- created_at / updated_at
- INDEX (campaign_id, status), INDEX (campaign_id, intent_score DESC)

**messages** (сгенерированное письмо)
- id: uuid PK
- lead_id: uuid FK leads ON DELETE CASCADE UNIQUE NOT NULL   *(один message на лид)*
- channel: text CHECK in ('email','dm') DEFAULT 'email'
- subject: text NULL
- body: text NOT NULL
- generated_at: timestamptz DEFAULT now()

**client_context_chunks** (RAG: grounding генерации письма)
- id: uuid PK
- workspace_id: uuid FK workspaces ON DELETE CASCADE NOT NULL
- source: text CHECK in ('chat','glook_report','manual')
- content: text NOT NULL
- embedding: vector(1536)     *(pgvector; OpenAI text-embedding-3-small)*
- created_at
- INDEX ivfflat (embedding vector_cosine_ops)

**conversations** (чат-онбординг)
- id: uuid PK
- workspace_id: uuid FK workspaces ON DELETE CASCADE NOT NULL
- campaign_id: uuid FK campaigns NULL   *(заполняется когда intake собран)*
- created_at

**conversation_messages**
- id: uuid PK
- conversation_id: uuid FK conversations ON DELETE CASCADE NOT NULL
- role: text CHECK in ('user','assistant') NOT NULL
- content: text NOT NULL
- created_at

### Бизнес-правила (влияют на схему)
- Лид `verified` ⇔ verify_signal AND verify_company AND verify_contact AND verify_email = true.
- credit списывается (workspaces.credits_remaining − 1, leads.credit_charged = true)
  **только** при переходе лида в `verified`. При `rejected` — никогда.
- free_converter: workspace на плане 'free' получает 10 verified лидов один раз;
  после 10-го verified → free_converter_used = true, дальнейший запуск требует апгрейда.
- signals UNIQUE(campaign_id, source_url) — один пост = один сигнал.
- messages.lead_id UNIQUE — одно письмо на лид.
- intent_score < 80 → lead.status = 'rejected', reject_reason = 'low_intent', выброс до L2.

---

## БЛОК 3: API ENDPOINTS

### Чат-онбординг (auth обязателен)
```
POST /api/chat
  Body: { conversationId?: uuid, message: string }
  Действие: стрим ответа ассистента (Vercel AI SDK). Ассистент SPIN-копает контекст;
            через tool-call extract_intake формирует/обновляет campaign (what_selling,
            icp, pain, geo, keywords, tone). При готовности intake предлагает скан/запуск.
  Response: text/event-stream (streamed tokens) + финальный tool result { campaignId }
  Security: user input ТОЛЬКО в role 'user', system prompt фиксирован
```

### Campaigns (auth)
```
POST  /api/campaigns                  Body: intake fields → создать campaign (draft)
GET   /api/campaigns/:id              Response: { campaign, leadsSummary }
POST  /api/campaigns/:id/run          Действие: dispatch в Railway worker; status → 'running'
                                      Guard: проверка credits_remaining > 0 или free доступен
```

### Glook bridge (warm-вход, auth)
```
GET   /api/glook/report/:scanId       Действие: читает scan/report из общей Supabase
                                      → создаёт campaign(entry_mode='warm') + RAG-чанки
                                      Response: { campaignId, prefilledIntake }
POST  /api/scan                       Действие (cold): проксирует URL в Glook-scan,
                                      возвращает scanId для последующего warm-обогащения
```

### Leads (auth)
```
GET   /api/leads?campaignId=&status=&limit=&offset=
      Response: { leads: Lead[], total }
GET   /api/leads/:id                  Response: { lead, message, signal }
POST  /api/leads/export               Body: { campaignId, format: 'csv'|'sheets' }
      Response: { url } (CSV download или Google Sheet link)
```

### Internal — Railway worker (НЕ доступен снаружи)
```
POST  /internal/run-pipeline
      Auth: X-Internal-Key (WORKER_SECRET из env), НЕ JWT
      Body: { campaignId }
      Действие: полный pipeline (signal → classify → company → contact → email → message),
                запись signals/leads/messages, обновление credits, status кампании
      Note: long-running, на Railway. App-endpoint /run только триггерит и возвращает 202.
```

### Health
```
GET /api/health → { status: 'ok' }
GET /internal/health (worker) → { status: 'ok' }
```

---

## БЛОК 4: USER STORIES

**US-00: Auth flow (Progressive disclosure)**
Как новый пользователь
Я хочу попробовать продукт до регистрации
Чтобы убедиться в ценности до создания аккаунта
```
✅ "Start Free" на лендинге → скролл до LandingComposer, auth НЕ требуется
✅ Анонимный чат сохраняет контекст в localStorage: { messages[], intake{}, createdAt }
✅ При триггере pipeline ("Find leads") → AuthModal открывается
✅ После auth → POST /api/session/transfer { anonSession } → создаёт workspace + campaign(draft)
✅ Редирект на /chat?campaign=<id>, разговор продолжается с того же места
✅ Если пользователь закрыл вкладку и вернулся — localStorage жив, контекст не теряется
✅ "Get Started" в header → AuthModal → /workspace (для уже знакомых с продуктом)
✅ Прямой переход /workspace/* без сессии → requireUser() → redirect('/?auth=1')
✅ На лендинге: useEffect проверяет ?auth=1 → auto-открывает AuthModal
✅ Нет отдельной /auth/login страницы — единый AuthModal попап
✅ /auth/callback роут обязателен для Supabase email magic link / OAuth
```

**US-00b: Chat modes**
Как авторизованный пользователь в /chat
Я хочу выбрать режим работы с ассистентом
Чтобы получить нужный формат помощи
```
Режимы:
  Search — запускает полный pipeline (L1→L4). Тратит 1 кредит на verified лид.
  Plan   — AI строит outreach-последовательность (5-7 касаний, каналы, тайминг, сабджекты).
           Без pipeline, без кредитов.
  Strategy — AI уточняет ICP, messaging angles, positioning, subject line варианты.
             Без pipeline, без кредитов.

Лимиты Plan/Strategy (rate-limit, не кредиты):
  Free:    20 сообщений/день
  Starter: 100 сообщений/день
  Growth:  300 сообщений/день
  Agency:  безлимит

✅ Search требует credits_remaining > 0; при 0 → предложение апгрейда
✅ Plan и Strategy работают даже при credits_remaining = 0
✅ Rate-limit Plan/Strategy: counter сбрасывается в полночь UTC
✅ Анонимный чат на лендинге = только discovery, без режимов (режимы только после auth)
```

**US-00c: Источники сигналов по типу бизнеса**
```
Чат определяет business_type из intake и записывает в campaign.business_type.
Pipeline выбирает источники по типу:

online_saas / agency:  reddit, hackernews, github, stackoverflow, vk, telegram, habr, vcru
local:                 google_reviews, yelp, 2gis, yandex_business, foursquare
b2b_enterprise:        reddit, hackernews, github, stackoverflow
ecommerce:             reddit, yelp, google_reviews

Все типы включают CIS-источники (vk, telegram, habr, vcru) если geo=CIS/RU/KZ.
business_type=NULL (не определён) → fallback на reddit + hackernews.
```

**US-01: Cold-онбординг через чат**
Как новый пользователь без Glook
Я хочу объяснить ассистенту что продаю и кого ищу в свободном чате
Чтобы система сама собрала параметры поиска без заполнения формы
```
✅ На старте пустой чат показывает плейсхолдер-вопрос (ротация, напр. "Кому вы продаёте и какую боль решаете?")
✅ Ассистент задаёт уточняющие вопросы по одному (что продаёшь → ICP → боль → гео), адаптивно, не жёсткий скрипт
✅ Через tool-call extract_intake заполняет campaign(what_selling, icp, pain, geo, keywords[], tone)
✅ Когда intake достаточен — ассистент предлагает: "Вставьте ссылку на сайт — просканирую для точности" (оффер скана) ИЛИ "Запустить поиск"
✅ keywords генерируются AI из intake (не вводятся вручную)
✅ Весь диалог сохраняется в conversation_messages; ключевые факты → client_context_chunks (RAG)
✅ Prompt injection: system prompt фиксирован, текст пользователя только в role 'user'
✅ Edge: пользователь даёт мусор/оффтоп → ассистент мягко возвращает к контексту, intake не заполняется неверными данными
```

**US-02: Warm-вход из Glook**
Как пользователь, пришедший после скана Glook
Я хочу чтобы система уже знала мою боль и недостатки сайта
Чтобы сразу перейти к "кого ищу", без повторного discovery
```
✅ GET /api/glook/report/:scanId читает репорт из общей Supabase
✅ campaign создаётся с entry_mode='warm', pain/what_selling префилл из репорта Glook
✅ Недостатки сайта + контекст бизнеса → client_context_chunks (для grounding писем)
✅ Чат пропускает discovery, спрашивает только: кого ищешь + цели
✅ Edge: scanId не найден / чужой workspace → 404, fallback на cold-флоу
✅ Стратегия Glook остаётся доступной; IntentLead добавляет lead-слой сверху
```

**US-03: Детекция сигналов**
Как pipeline
Я хочу сканировать Reddit + HN по keywords кампании
Чтобы найти публичные сигналы intent
```
✅ Reddit official API + HN Algolia API, поиск по campaign.keywords
✅ Первичная фильтрация по subreddit/контексту
✅ Каждый уникальный пост → signals (UNIQUE campaign_id+source_url, дедуп)
✅ Edge: Reddit rate limit (60 req/min) → backoff; при блокировке → продолжить только на HN
✅ Edge: ноль сигналов → campaign.status='done', лидов 0, понятное сообщение пользователю
```

**US-04: Классификация intent (L1)**
Как pipeline
Я хочу оценить каждый сигнал на реальность intent
Чтобы отсеять шум до дорогого enrichment
```
✅ GPT-4o-mini → confidence 0–100 + intent_type (pain/recommendation_request/comparison/hiring)
✅ score < 80 → lead.status='rejected', reject_reason='low_intent', stop (L2 не запускается)
✅ score ≥ 80 → verify_signal=true, переход к L2
✅ Системный промт фиксирован; контент сигнала только как данные, не как инструкция
```

**US-05: Идентификация компании (L2)**
```
✅ История постов автора + **Exa entity-search** (1B+ профилей / 70M компаний) как primary;
   **SERPER** (Google SERP, уже в Glook) как fallback. За адаптером `worker/lib/providers/*` (D-10)
✅ GPT-4o-mini извлекает/валидирует company_name + company_domain с confidence
✅ Нет уверенного маппинга → rejected, reject_reason='no_company', кредит не списан
✅ Домен существует и активен → verify_company=true
✅ Edge: лимит/ошибка primary-провайдера → fallback на SERPER + кэш результатов
```

**US-06: Контакт + роль (L3) и email (L4)**
```
✅ Роль подтверждается через LinkedIn ДО enrichment; проходят только founder/CEO/CMO/Head of Growth → verify_contact=true
✅ Email waterfall: Prospeo → (если нет) Hunter → (если нет) Apollo
✅ Кредит провайдера тратится только у того, кто нашёл; Apollo → пометка "требует доп. верификации"
✅ Email найден и не bounce → verify_email=true, записать email_provider
✅ Все 3 провайдера пусто → rejected, reject_reason='no_email', кредит клиента не списан
✅ Edge: роль не decision-maker → rejected, reject_reason='not_decision_maker'
```

**US-07: 4-уровневая верификация + кредит-логика**
Как pipeline и как клиент
Я хочу платить только за лиды прошедшие все 4 уровня
Чтобы качество было гарантией без споров
```
✅ Лид → 'verified' ТОЛЬКО при verify_signal AND verify_company AND verify_contact AND verify_email
✅ При 'verified': workspaces.credits_remaining − 1 АТОМАРНО с lead.credit_charged=true (RPC, защита от гонки)
✅ Любой красный уровень → 'rejected', кредит НЕ списан, reject_reason заполнен
✅ free-план: 10-й verified лид → free_converter_used=true; следующий run требует апгрейда
✅ credits_remaining = 0 и не free → /run возвращает 402, предложение апгрейда
```

**US-08: Генерация письма (RAG-grounded)**
```
✅ GPT-4o анализирует сигнал + роль + компанию + контекст клиента
✅ RAG: достаём релевантные client_context_chunks (pgvector cosine) → в промт как grounding
✅ Генерим subject + body + opening_line + why_now; тон из campaign.tone
✅ messages.lead_id UNIQUE — одно письмо на лид
✅ Edge: AI fail после 3 retry → лид остаётся verified, но message помечен 'generation_failed', алерт в лог (не блокирует доставку контакта)
✅ Prompt injection: контент сигнала/контекст — только данные, не инструкции
```

**US-09: Free-конвертер**
```
✅ Новый workspace = plan 'free', credits_remaining=10, free_converter_used=false
✅ Получает 10 verified лидов полного формата (компания+контакт+email+письмо), один раз, без срока
✅ После 10 verified → апселл на Starter/Growth
✅ Edge: уже использован → лендинг показывает CTA апгрейда, не повторный free
```

**US-10: Доставка лидов (карточки + экспорт)**
```
✅ Verified лиды показываются карточками (horyx-style): company, contact, role, email,
   intent_score, intent_type, why_now, opening_line, 4 verification-бейджа (зелёные)
✅ Сортировка по intent_score DESC
✅ Экспорт CSV и Google Sheets (поля из scope §7)
✅ Rejected лиды НЕ показываются как доставленные (но доступны в "отброшенные" с причиной)
✅ Edge: pipeline ещё running → прогресс-состояние, карточки появляются прогрессивно

ВАЖНО — ГРАНИЦА ОТВЕТСТВЕННОСТИ АГЕНТА:
Pipeline завершается на генерации письма. Агент НЕ отправляет письмо.
Клиент нажимает "Copy message" / "mailto:" / экспортирует и шлёт сам.
Авто-отправки нет в MVP (D-9). Assisted-send через свой ящик клиента — V2.
```

---

## БЛОК 5: НЕФУНКЦИОНАЛЬНЫЕ ТРЕБОВАНИЯ

### Безопасность
- RLS на КАЖДОЙ таблице IntentLead: workspaces, workspace_members, campaigns, signals,
  leads, messages, client_context_chunks, conversations, conversation_messages.
- Паттерн RLS: пользователь видит только строки своего workspace (workspace_id в JWT app_metadata
  или join через workspace_members). Glook-таблицы — read-only через service role в worker.
- Worker endpoint `/internal/*`: X-Internal-Key (WORKER_SECRET), не JWT, недоступен снаружи.
- App → worker dispatch: подписанный запрос с WORKER_SECRET (как SCANNER_SECRET в Glook).
- Все секреты в env (process.env.*), никогда в коде. Service-role ключ — только worker/server.
- Prompt injection: system prompt всех AI-вызовов фиксирован; user/signal текст только в role 'user'.
- Rate limiting:
  - /api/chat: 30 req/min per user
  - /api/chat Plan/Strategy mode: 20 msg/day (free), 100 (starter), 300 (growth), unlimited (agency)
    Counter в workspaces.chat_messages_today, сбрасывается в полночь UTC
  - /api/campaigns/:id/run: 5 req/min per workspace
  - /internal/run-pipeline: вызывается только app-сервером, не публичен
  - Внешние API (Reddit 60/min, Google CSE 100/день): worker соблюдает лимиты с backoff

### Assistant scope & guardrails (чат-ассистент)
Ассистент работает ТОЛЬКО в контексте «поиск клиентов / лидов / трафика + сбор кампании».
Защита слоями (не один промт):
- **Слой 1 — System role + refusal-policy:** system-промт фиксирует роль «ассистент IntentLead
  по лидогенерации». На всё вне темы — короткий отказ + редирект к лидогенерации. Явные примеры
  out-of-scope (сгенерировать картинку, написать эссе, код, оффтоп) → вежливый отказ.
- **Слой 2 — Capability-scoping (сильнейший барьер):** у ассистента НЕТ инструментов кроме
  `extract_intake`, `offer_scan`, `run_campaign`. Картинки/код/браузинг физически невозможны — tool не подключён.
- **Слой 3 — Topic-gate (опц., при абьюзе):** дешёвая пред-проверка GPT-4o-mini «сообщение про
  бизнес/лидген? да/нет» → нет и явный оффтоп → канонический редирект, основную модель не зовём.
- **Слой 4 — Injection-стойкость:** system велит игнорировать инструкции внутри текста
  пользователя/сигнала; ввод и скрейпленные сигналы — недоверенные данные, только в role 'user'.
- **Слой 5 — Auth + rate-limit** (см. ниже) ограничивают радиус абьюза.
- MVP — слои 1, 2, 4. Слой 3 включить при появлении абьюза.

### Обработка ошибок
- Все API: `{ success: bool, data: any, error: string | null }`
- AI-вызовы: retry 3× backoff 1s/2s/4s; финальный fail → лид не блокируется (см. US-08),
  ошибка в лог с контекстом.
- Email-провайдеры: последовательный fallback; ошибка одного → следующий, не падать.
- Pipeline частичный сбой: уже verified лиды сохраняются, кампания → 'error' с деталями,
  частичный результат доступен (прогрессивно, как Glook scan).
- Worker timeout-устойчивость: каждый лид обрабатывается независимо; падение на одном
  не валит батч.

### Производительность
- /api/campaigns/:id/run отвечает < 1 сек (только dispatch 202), pipeline асинхронно.
- /api/leads, /api/campaigns: < 500ms.
- Индексы: leads(campaign_id, status), leads(campaign_id, intent_score DESC),
  signals(campaign_id), client_context_chunks ivfflat(embedding).
- Дедуп сигналов на уровне БД (UNIQUE), не в коде.

### Кредит-гарантия (доменное правило = тоже non-functional контракт качества)
- Кредит списывается ИСКЛЮЧИТЕЛЬНО атомарно с переходом лида в verified (RPC).
- Нет состояния, где credit_charged=true при status≠'verified'.
- Это проверяется тестом и не может быть нарушено рефактором.

### Логирование (без PII в открытом виде)
- Каждый pipeline-run: campaign_id, найдено сигналов, прошло L1–L4, verified, rejected по причинам.
- Каждый AI-вызов: lead_id, tokens_used, duration_ms (cost tracking).
- Каждый enrichment: провайдер, hit/miss (для расчёта расхода кредитов провайдеров).
- email/контакты не логировать в plaintext в общие логи.

### Метрики успеха (цель месяц 1)
- Free → paid ≥ 3 клиента · reply-rate ≥ 15% · verified-rate ≥ 60% · bounce < 3% · retention м2 ≥ 70%

---

## БЛОК 6: MVP VS ROADMAP

### Страницы — приоритеты создания

**Blocker (до PayPro review):**
- [ ] `/pricing` — страница тарифов (см. дизайн ниже)
- [ ] `/privacy` — политика конфиденциальности, соответствие требованиям PayPro Global (MoR)
- [ ] `/terms` — условия использования, соответствие требованиям PayPro Global (MoR)
- [ ] `/auth/callback` — Supabase OAuth callback (magic link + Google OAuth)
- [ ] `/vs` + `/vs/[slug]` — competitor comparison pages: Clay · Apollo.io · Hunter.io · Instantly.ai · Lemlist
- [ ] Auth-защита `/workspace/*` — requireUser() в app/workspace/layout.tsx (Server Component)

### Upgrade / Paywall flow

Earlybird офферы показываются ВО ВСЕХ upgrade-точках (с меткой "Early access"):

```
Trigger 1: credits_remaining = 0 → Search нажат
  Modal:
    "You've used all 10 free leads."
    "Upgrade to keep finding verified leads."
    
    [⚡ Early access · Starter — $39/mo · 100 leads first 3 months, then 30/mo]  ← primary
    [⚡ Early access · Growth  — $89/mo · 100 leads/mo · price locked forever]
    [See all plans →] → /pricing?utm_source=app&utm_medium=in-app&utm_campaign=upgrade-prompt&utm_content=credits-empty

Trigger 2: credits_remaining ≤ 3 (warning banner, не блокирующий)
    "3 verified leads remaining. [⚡ Upgrade — Early access pricing →]"
    → /pricing?utm_source=app&utm_medium=in-app&utm_campaign=upgrade-prompt&utm_content=credits-low

Trigger 3: free_converter_used=true, повторный запуск
    "Free leads used."
    [⚡ Early access · Get Starter] [See plans]
    → /pricing?utm_source=app&utm_medium=in-app&utm_campaign=upgrade-prompt&utm_content=free-used
```

Earlybird метка: "⚡ Early access" или "🔒 Price locked" — до исчерпания 100 мест.
После 100 мест — стандартные тарифы без метки.

### Дизайн /pricing

```
Hero:  "Simple pricing. No games."
       "Credit charged only when all 4 verification levels pass. Rejected leads are free."

[Earlybird banner] "🔒 Early access pricing — locked in forever for first 100 users"

[Annual/Monthly toggle — annual default, -20%]

Тарифы (из PixelPricingCard):
  Free      $0          10 verified leads, one time, forever
  Starter   $39/mo      30 leads/mo · CSV export · Plan/Strategy modes
  Growth    $89/mo ★    100 leads/mo · Priority pipeline · 3 team members
  Agency    $199/mo     300 leads/mo · 10 members · API access

[Feature comparison table]
[FAQ — 6-8 вопросов]
[Footer CTA: "Not sure? Start free — no credit card required."]
```

### Earlybird offer

Оффер: первые 100 пользователей — price lock навсегда + 3 месяца Growth-кредитов по цене Starter.
```
Earlybird Starter: $39/mo → 100 leads/mo первые 3 месяца, затем 30/mo, цена не меняется
Earlybird Growth:  $89/mo → заморожена навсегда (при росте цен — не затрагивает)
```
Почему price lock, не LTD: credits-based модель — LTD убивает unit-экономику.
Ограничение: 100 мест (счётчик на странице). Дедлайн: до PayPro-ревью.

### UTM-ссылки earlybird кампании

```
Reddit:        /pricing?utm_source=reddit&utm_medium=social&utm_campaign=earlybird&utm_content=post
LinkedIn:      /pricing?utm_source=linkedin&utm_medium=social&utm_campaign=earlybird&utm_content=founder-post
Product Hunt:  /pricing?utm_source=producthunt&utm_medium=referral&utm_campaign=earlybird
IndieHackers:  /pricing?utm_source=indiehackers&utm_medium=social&utm_campaign=earlybird&utm_content=ih-post
Email:         /pricing?utm_source=email&utm_medium=email&utm_campaign=earlybird&utm_content=cta-button
Glook→IL:      /pricing?utm_source=glook&utm_medium=referral&utm_campaign=earlybird&utm_content=dashboard-banner
Twitter/X:     /pricing?utm_source=twitter&utm_medium=social&utm_campaign=earlybird&utm_content=thread
Bio link:      /pricing?utm_source=bio&utm_medium=direct&utm_campaign=earlybird
```

### /vs/[slug] — структура страницы

Конкуренты: clay · apollo · hunter · instantly · lemlist

Структура каждой страницы:
```
1. TL;DR (2 предложения — ключевая разница)
2. Comparison table (features + pricing, "as of [date]")
3. Paragraph: чем [Конкурент] силён (честно)
4. Paragraph: где не хватает (без defamation, из публичных источников)
5. Кому подходит [Конкурент], кому IntentLead
6. CTA: "Try free — 10 verified leads, no card required"
```

Целевые keywords:
  /vs/clay:      "clay alternative", "clay vs intentlead", "clay ai alternative cheap"
  /vs/apollo:    "apollo.io alternative", "apollo alternative free", "apollo vs"
  /vs/hunter:    "hunter.io alternative", "hunter io vs", "email finder alternative"
  /vs/instantly: "instantly ai alternative with lead finding", "instantly alternative"
  /vs/lemlist:   "lemlist alternative", "lemlist vs"

**Уже есть:**
- [x] `/` — лендинг
- [x] `/chat` — чат-онбординг
- [x] `/workspace` — список кампаний
- [x] `/workspace/[id]` — lead-карточки + прогресс
- [x] `/methodology` — методология
- [x] `/roadmap` — роадмап

**Footer (добавить на существующих страницах):**
- Контакт: support@glook.dev
- Ссылки: Privacy · Terms · Roadmap · Methodology

---

### MVP — делаем сейчас
- [ ] Conversational onboarding (чат, intake extraction, оффер скана)
- [ ] Warm-вход из Glook (чтение report из общей Supabase)
- [ ] Signal pipeline: Reddit + HN + GitHub + SO + VK + Telegram + Habr + vcru + Google Reviews + Yelp + 2GIS + Yandex Business + Foursquare → classify → company → contact → email → message
      Источники выбираются по campaign.business_type (см. US-00c)
- [ ] 4-уровневая верификация + атомарная кредит-логика (RPC)
- [ ] RAG-grounded генерация письма (pgvector, grounding only)
- [ ] Lead-карточки (horyx-style) + CSV/Sheets экспорт
- [ ] Free-конвертер (10 verified, один раз)
- [ ] Ручной запуск pipeline (кнопка) + worker cron
- [ ] Лендинг (Signal Dark) с animated step-wizard как у horyx

### V2 — после первых 10 клиентов
- [ ] **Assisted-send через свой ящик клиента** (Gmail/Outlook OAuth): письмо шлётся как человек,
      с репутации клиента, лимиты + warmup, human-in-the-loop (клиент апрувит батч). Выбор:
      ручной экспорт (MVP-default) vs assisted-send. НЕ бот-блast. См. D-9.
- [ ] **Research-провайдеры L3** (Parallel Search / Perplexity Sonar) для verifiable why-now. См. D-10, AI_MODELS_AUDIT.md
- [ ] Полноценный дашборд + аналитика (reply-rate, verified-rate, расход кредитов)
- [ ] Multi-workspace (план Agency)
- [ ] Семантический ICP-матч через RAG (не только grounding)
- [ ] **Источники сигналов — Review/comparison (Tier 1):**
      G2 + Capterra: негативные отзывы на конкурентов (Apollo/Clay/Lemlist) = switching intent.
      Автор отзыва → имя + компания → L2–L4 pipeline.
- [ ] **Источники сигналов — Discovery/switching (Tier 2):**
      SaaSHub ("alternatives to X" pages + discussions) + AlternativeTo (explicit replacement search) +
      ProductHunt (комментарии к лончам конкурентов, Ask PH треды).
- [ ] **Источники сигналов — Job postings:**
      Greenhouse / Lever / Ashby: компания нанимает "SDR / Head of Outbound / Lead Gen Specialist" →
      масштабирует outbound → покупает инструменты. Опережающий сигнал за 2–4 нед до покупки.
- [ ] **Источники сигналов — Funding (Crunchbase/Dealroom):**
      Раунд $1–20M → бюджет есть, команда растёт, enterprise-контрактов ещё нет → покупают инструменты.
- [ ] **Источники сигналов — CIS рынок (меньший приоритет):**
      vc.ru (предприниматели, "ищу инструмент для X"), Habr / qna.habr.com (IT Q&A),
      startpack.ru (русский Capterra, отзывы + alternatives).
      Второй ряд: spark.ru, dou.ua (Украина), tadviser.ru (enterprise RU).
- [ ] LinkedIn (Proxycurl / Exa) источник сигналов — профессиональные pain posts
- [ ] Полный автобиллинг через PayPro webhook (переиспользуем интеграцию Glook: subscriptions + payment_events)
- [ ] Real-time алерты по новым сигналам

### Phase 3
- [ ] X/Twitter, GitHub Issues, Indie Hackers источники
- [ ] Tech stack signal (BuiltWith/Wappalyzer): компания использует конкурента → switching candidate
- [ ] CRM-интеграции
- [ ] (Осторожно) полуавтоматический outreach — только при решённом риске блокировок

### Никогда в этом продукте
- Автоматическая массовая отправка писем без участия пользователя (риск домена/блокировок).
- Собственная CRM (рынок занят).
- Скрейпинг в обход официальных API источников.

### SEO — аудит и задачи (2026-06-06, URL: intent-lead-hazel.vercel.app)

**Критично — блокирует индексацию:**
- [ ] `app/robots.ts` — robots.txt (404 сейчас)
- [ ] `app/sitemap.ts` — sitemap.xml (404 сейчас)
- [ ] Кастомный домен вместо vercel.app (весь SEO-сок на один домен)

**Высокий приоритет:**
- [ ] Structured data: SoftwareApplication + FAQPage JSON-LD в layout.tsx
- [ ] Canonical тег в metadata (layout.tsx)
- [ ] hreflang ru/en для CIS-рынка
- [ ] /pricing, /vs/* страницы (уже запланированы — дают keyword coverage)

**ОК сейчас:** title ✅ · meta description ✅ · OG/Twitter cards ✅ · H1 ✅ · HTTPS ✅

### Дизайн /privacy и /terms (по аналогии с Glook, адаптировано для IntentLead)

**Privacy — IntentLead-специфичные секции (сверх Glook-шаблона):**
```
Раздел "Данные" — добавить:
  - Campaign data: ICP, keywords, tone, business context (из чата)
  - Lead data: company/contact/email — получены через Prospeo/Hunter/Apollo из публичных источников
  - Signal data: публичные посты Reddit/HN/VK/GitHub/etc.

Раздел "Третьи стороны" — добавить:
  - Prospeo / Hunter.io / Apollo — contact enrichment
  - Reddit API, HN Algolia, VK API — signal sources (только публичный контент)
  - Railway — worker hosting (pipeline)
  - OpenAI — AI processing (GPT-4o-mini classify, GPT-4o message gen)
```

**Terms — IntentLead-специфичные клаузулы:**
```
Допустимое использование — добавить:
  - Не использовать для spam / unsolicited mass outreach
  - Не запускать pipeline по защищённым категориям данных
  - Пользователь несёт ответственность за соответствие CAN-SPAM / GDPR при отправке писем

Free plan limits:
  - 10 verified leads, один раз навсегда, не обнуляется ежемесячно

Billing — тарифы:
  - Starter $39/mo · Growth $89/mo · Agency $199/mo (auto-renew monthly)
  - Annual: -20% off, auto-renew annually

Кредит-гарантия (обязательная клаузула):
  "A credit is deducted only when a lead passes all 4 verification levels
   (signal, company, contact, email). Rejected leads are never charged.
   This guarantee is technically enforced at the database level."

Отмена/возврат:
  - Отмена действует с конца текущего периода
  - Рефанды/чарджбэки — по политикам PayPro Global
```

Email для обоих документов: support@glook.dev (единый до появления IntentLead-домена)

### Зафиксировано в ходе дизайн-сессии 2026-06-06
- README переписан (минимальный, без setup/deploy/internal ссылок)
- `.agents/product-marketing.md` создан (позиционирование, конкуренты, персоны, customer language)
- Grafana — не приоритет; подключить после MVP, одновременно с Glook
- `/alternatives` = то же что `/vs` (не отдельный раздел)

### Решения уже приняты (не обсуждать заново — см. STACK_DECISION.md)
- Стек: Next.js 16 + Supabase (общий с Glook) + Railway worker. Не Python/FastAPI.
- Платежи: PayPro Global (MoR, как Glook D-28). Не Stripe, не Lemon Squeezy. MVP — checkout-ссылки + ручная активация.
- Warm-handoff через общую Supabase БД, не через API-мост.
- RAG через pgvector, не внешний vector store.
- AI: OpenAI (GPT-4o-mini classify, GPT-4o message). Не Claude.
- Pipeline на Railway (long-running), не Supabase Edge Fn (таймаут 10 сек).
- Онбординг = чат, не статичная форма. Delivery = карточки + экспорт, не только Sheets.
- Кредит списывается только при verified, атомарно через RPC.
- Авто-отправки писем в MVP НЕТ (риск домена/банов). Assisted-send через свой ящик — V2 (D-9).
- L2 company-ID: Exa (primary) + SERPER (fallback), за адаптером провайдеров (D-10, AI_MODELS_AUDIT.md). Не хардкодить CSE.
- Ассистент удерживается в контексте лидогенерации слоями guardrails (Блок 5).

---

## ПРОВЕРКА ГОТОВНОСТИ К SETUP_GENERATOR
- [x] Блок 1: data flow и две точки входа понятны за 30 сек
- [x] Блок 2: SQL пишется без вопросов (типы, связи, constraints, pgvector)
- [x] Блок 3: каждый endpoint имеет action, auth, response shape; worker отделён
- [x] Блок 4: каждая US с критериями и edge cases; 4 уровня верификации покрыты
- [x] Блок 5: RLS, rate limits, prompt-injection, кредит-гарантия, провайдер-waterfall
- [x] Блок 6: MVP чётко отделён, решения зафиксированы
- [x] Нет противоречий между блоками
