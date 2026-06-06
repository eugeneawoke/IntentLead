# CLAUDE.md — IntentLead AI · Agent Context

> Короткий файл. Загружается агентами автоматически. Источник правды по продукту: `SPEC.md`.
> Решения по стеку: `STACK_DECISION.md`. Визуал: `DESIGN_SYSTEM.md`. Идея: `PROJECT_IDEA.md`.

---

## STARTUP RITUAL — до любого предложения по архитектуре/фичам/статусу

В порядке:
0. **Прочитать релевантные документы молча, потом отвечать** (глобальное правило). Никаких «сейчас прочитаю и отвечу».
1. `SPEC.md` — 6 блоков, текущая спецификация продукта
2. `STACK_DECISION.md` — зафиксированный стек, что отвергнуто
3. `PROJECT_IDEA.md` — пользователь, боль, монетизация
4. `DESIGN_SYSTEM.md` — Signal Dark, токены, компоненты
5. `DECISIONS.md` — принятые/отвергнутые архитектурные решения (создать при первой записи)
6. `EVIDENCE.md` — проверенные факты и устаревшие предположения (создать при первой записи)

После завершённого изменения — обновить релевантный документ, не оставлять устаревшие планы.

---

## 4 ПРИНЦИПА (Karpathy) — переопределяют дефолтное поведение

### 1. Думай до кода
Не предполагай молча. Не прячь путаницу. Показывай tradeoffs.
- Явно называй допущения. Если неуверен — спрашивай.
- Несколько интерпретаций → покажи, не выбирай молча.
- Есть проще путь → скажи. Возражай по делу.
- Непонятно → стоп, назови что неясно, спроси.

### 2. Простота прежде всего
Минимум кода, решающий задачу. Ничего спекулятивного.
- Никаких фич сверх запрошенного.
- Никаких абстракций для одноразового кода.
- Никакой «гибкости», которую не просили.
- Никакой обработки невозможных сценариев.
- 200 строк там, где хватит 50 → перепиши.
Тест: «senior сказал бы, что переусложнено?» Да → упрости.

### 3. Хирургические изменения
Трогай только нужное. Убирай только свой мусор.
- Не «улучшай» соседний код/комментарии/форматирование.
- Не рефактори то, что не сломано.
- Держи существующий стиль.
- Заметил чужой dead code → скажи, не удаляй.
- Свои изменения осиротили import/переменную → убери. Чужой dead code не трогай без просьбы.
Тест: каждая изменённая строка трассируется к запросу пользователя.

### 4. Goal-driven исполнение
Определи критерии успеха. Крути до проверки.
- «Добавь валидацию» → «напиши тесты на невалидный ввод, проведи их в зелёный».
- «Почини баг» → «тест, воспроизводящий баг, потом в зелёный».
Для multi-step — короткий план с verify на каждом шаге.

---

## ПРОДУКТ

IntentLead AI: сигнал → компания → email → письмо. Находит публичный intent
(Reddit + HN), доводит до верифицированного контакта с готовым письмом.
**Продолжение Glook** (старое имя ShipReady — аудит сайтов). Две точки входа:
- **COLD** — минимал-чат, ассистент копает контекст, предлагает скан, запускает pipeline.
- **WARM** — из Glook: боль и недостатки сайта уже известны (общая Supabase), сразу «кого ищешь».

Аудитория: growth-фрилансеры и outbound-агентства (1–5 чел). Фаза: **MVP build.**

**Конкурентное преимущество, которое нельзя скопировать быстро:** 4 уровня верификации
(сигнал/компания/контакт/email). Кредит не списан, если хоть один красный.

---

## РАБОЧИЙ ПРОЦЕСС — SPEC-FIRST (нельзя нарушать)

```
PROJECT_IDEA.md → STACK_DECISION.md → SPEC.md (6 блоков)
   → новая сессия: SETUP_GENERATOR + SPEC.md → автономная сборка субагентами
   → CODE_REVIEWER → OWASP_AI_AUDIT → деплой
```
1. **Спека до кода.** Без заполненного SPEC.md — Claude Code не открывать.
2. **CLAUDE.md — первое сообщение каждой сессии.**
3. **CODE_REVIEWER + OWASP перед каждым деплоем.** Не опционально.

---

## STACK (зафиксирован — менять только через DECISIONS.md)

```
Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui
Vercel AI SDK (стриминг-ассистент) + OpenAI (GPT-4o-mini classify, GPT-4o message)
Supabase PostgreSQL + Auth + RLS  (ОБЩИЙ проект с Glook)
pgvector (RAG: grounding письма, text-embedding-3-small)
Pipeline: Railway worker (Node.js, long-running) — НЕ Supabase Edge Fn (таймаут 10с)
Источники: Reddit API · HN Algolia · Google Custom Search · Prospeo→Hunter→Apollo
Deploy: Vercel (app) + Railway (worker) · Платежи: PayPro Global (MoR, как Glook D-28)
```
**Не Python/FastAPI** (ML не нужен — интеллект у OpenAI API). **Не Claude** для генерации (один провайдер). Подробности и отвергнутое → `STACK_DECISION.md`.

---

## COMMANDS

```bash
npm run dev          # Next.js app
npm run lint
npm run build        # практический type/build gate
npm test
npx supabase db push # миграции
# worker (Railway): npm run worker  (long-running pipeline)
```

---

## ⛔️ GIT — НИКОГДА НЕ КОММИТИТЬ

Запрещено трекать:
- `.claude/`, `.agents/`, `.kiro/`, `.windsurf/`, `.superpowers/`, `.cursor/` — IDE-конфиги
- `MEMORY.md`, `PLAN.md`, `TODO.md`, `DECISIONS.md`, `EVIDENCE.md`, `ACTION-PLAN.md`
- `docs/plans/`, `docs/superpowers/`, `docs/setup/` — рабочие планы
- `.env`, любые секреты, ключи провайдеров
- `*.pid`, `*.log`, runtime-файлы
- research/анализ-документы в корне

Перед `git add` — всегда `git status`, добавлять поимённо. **Никогда `git add -A`.**

---

## HARD RULES

- Читать релевантные доки до ответа на проектные вопросы.
- Читать Next.js 16 доки под `node_modules/next/dist/docs/` до изменения Next.js-кода.
- Секреты только в `process.env.*`, никогда в коде.
- **RLS на КАЖДОЙ таблице IntentLead.** Glook-таблицы — read-only через service role в worker.
- **Кредит списывается ТОЛЬКО при переходе лида в verified, атомарно через RPC.** Нет состояния
  credit_charged=true при status≠'verified'. Покрыто тестом, не ломать рефактором.
- **Verified ⇔ все 4 уровня зелёные.** Красный уровень → rejected, кредит не списан.
- Prompt injection: system prompt фиксирован; user/signal-текст только в role 'user', не в system.
- **Assistant scope:** чат-ассистент держится ТОЛЬКО в контексте лидогенерации. Слои: system-refusal +
  capability-scoping (нет tools кроме intake/scan/run — картинки/код невозможны) + topic-gate при абьюзе.
  Полные слои → SPEC Блок 5 «Assistant scope & guardrails».
- **L2 company-ID за адаптером провайдеров** (Exa primary, SERPER fallback). Не хардкодить один источник. См. AI_MODELS_AUDIT.md.
- **Авто-отправки писем в MVP нет.** Assisted-send через свой ящик клиента — V2 (D-9).
- Pipeline (long-running) — на Railway, не Edge Fn. App-endpoint только триггерит (202), не ждёт.
- Технические факты — из измеренных данных/провайдеров, не выдумывать. AI может суммировать
  и улучшать промты, но не выдумывать компании, email или intent-score.
- Типы лидов/сигналов — в одном месте (`types/*.ts`), без inline-дублей.
- Файлы > 300 строк → разбить. Никаких `console.log` (использовать logger).
- Новые архитектурные решения → `DECISIONS.md`. Новые проверенные факты → `EVIDENCE.md`.
- **Гибкость разрешена:** чего нет в документах — лучше уточни у автора, чем выдумывай.

---

## QUALITY CONTRACT

- Лид имеет 4 флага верификации; verified только при всех true.
- **Rejected — это норма (серый), не ошибка (не красный).** Гарантия качества работает.
- Email прошёл waterfall и не bounce → verify_email=true; Apollo → «требует доп. верификации».
- AI fail при генерации письма → лид остаётся verified, message помечен failed (не блокирует контакт).
- Лучше 10 идеальных лидов, чем 50 сомнительных. Качество верификации — единственное
  преимущество, которое нельзя скопировать быстро.

---

## ENVIRONMENT VARIABLES

```
# App / Supabase (общий с Glook)
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # только server/worker
# AI
OPENAI_API_KEY
# Worker
WORKER_URL                       # Railway pipeline endpoint
WORKER_SECRET                    # X-Internal-Key для /internal/*
# Источники сигналов / enrichment
REDDIT_CLIENT_ID
REDDIT_CLIENT_SECRET
EXA_API_KEY                      # L2 company-ID primary (entity-search)
SERPER_API_KEY                   # L2 fallback (Google SERP, переиспользуем из Glook)
GOOGLE_CSE_API_KEY               # опц. доп. fallback
GOOGLE_CSE_ENGINE_ID             # опц.
PARALLEL_API_KEY                 # опц. L3 deep research (V2)
PERPLEXITY_API_KEY               # опц. L3 narrative why-now (V2)
FIRECRAWL_API_KEY                # опц. RAG-скрейп сайта/Glook
PROSPEO_API_KEY
HUNTER_API_KEY
APOLLO_API_KEY
# Платежи — PayPro Global (MoR, как Glook D-28; переиспользуем интеграцию)
PAYPRO_VALIDATION_KEY
PAYPRO_SECRET_KEY
PAYPRO_SANDBOX
PAYPRO_PRODUCT_STARTER
PAYPRO_PRODUCT_GROWTH
PAYPRO_PRODUCT_AGENCY
```

---

## FILE MAP (планируемый, Тип Г — гибрид web + worker)

```
app/
  page.tsx                       # лендинг (Signal Dark, step-wizard)
  chat/page.tsx                  # cold-онбординг (минимал-чат)
  campaigns/[id]/page.tsx        # lead-карточки + прогресс
  api/
    chat/route.ts                # стриминг-ассистент (Vercel AI SDK)
    campaigns/route.ts
    campaigns/[id]/run/route.ts  # dispatch в worker (202)
    glook/report/[scanId]/route.ts
    leads/route.ts
    leads/export/route.ts
    health/route.ts
worker/                          # Railway long-running pipeline
  index.ts                       # /internal/run-pipeline, /internal/health
  pipeline/
    signals.ts                   # Reddit + HN
    classify.ts                  # GPT-4o-mini intent (L1)
    company.ts                   # Google CSE + GPT (L2)
    contact.ts                   # role verify (L3)
    email.ts                     # waterfall Prospeo→Hunter→Apollo (L4)
    message.ts                   # GPT-4o + RAG grounding
lib/
  supabase/client.ts             # anon + service_role
  rag/embed.ts                   # pgvector helpers
  ai/openai.ts                   # retry-обёртка
components/
  chat/Composer.tsx
  leads/LeadCard.tsx
  leads/VerificationBadges.tsx
  landing/StepWizard.tsx
types/
  lead.ts  signal.ts  campaign.ts
supabase/
  migrations/*.sql               # tables, RLS, RPC (credit-atomic), pgvector
```
