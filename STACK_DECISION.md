# STACK DECISION: IntentLead AI
*Заполнено 2026-06-05. Стек выбран под задачу, зафиксирован. Менять только через DECISIONS.md.*

---

## 5 ВОПРОСОВ

**1. Что на выходе?**
- [x] Веб-приложение (минимал-чат + lead-карточки + лендинг)
- Гибрид: Next.js web-app + долгоживущий pipeline-worker

**2. База данных? Сложность?**
- [x] Многопользовательское с изоляцией (multi-tenant через `workspace`)
- [x] Векторные данные (RAG: grounding письма через pgvector)
- Реляционные: campaigns ← signals ← leads ← messages, + credits/plans

**3. Реалтайм?**
- [x] Мягкий реалтайм — стриминг ответа ассистента в чате (Vercel AI SDK),
  прогресс pipeline (polling статуса, как Glook-scan)

**4. Хостинг — бюджет?**
- [x] $5–10 — Vercel (free/pro) + Railway worker + Supabase free → ~$0 на старте,
  ~$5–10 после роста

**5. Масштаб?**
- [x] 10–100 пользователей на старте, multi-tenant заложен с первого дня

**Таймаут-чувствительные операции?**
- [x] ДА — enrichment waterfall + 2× GPT-вызова + Google CSE на лид легко > 10 сек,
  а батч сигналов — минуты.
  → **Supabase Edge Fn НЕ подходит (лимит 10 сек).**
  → Pipeline живёт на **Railway worker (Node.js)** — тот же паттерн, что Railway-scanner Glook.

---

## РЕШЕНИЕ

### Выбранный стек

| Слой | Технология | Обоснование |
|------|-----------|-------------|
| Frontend / чат | Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, shadcn/ui | Один стек с Glook. Минимал-чат в стиле Lovable — родная зона Next.js |
| Стриминг-ассистент | Vercel AI SDK + OpenAI | Стриминг токенов, tool-calls для извлечения intake → campaign |
| Backend (app) | Next.js route handlers (`app/api/*`) | Лёгкие endpoints, auth-guard, dispatch в worker |
| Pipeline worker | **Railway (Node.js, long-running)** | Enrichment > 10 сек → не Edge Fn. Reddit/HN/CSE/Prospeo/Hunter/Apollo/OpenAI |
| База данных | Supabase PostgreSQL + RLS (**общий проект с Glook**) | Бесшовный warm-handoff, общий auth/биллинг, минимум кода |
| Вектор / RAG | Supabase `pgvector` + OpenAI embeddings | RAG без Python: grounding письма на контексте клиента |
| AI | OpenAI — GPT-4o-mini (classify, company extract), GPT-4o (message gen) | Совпадает со scope и с Glook (OPENAI_API_KEY уже есть) |
| Auth | Supabase Auth (общий с Glook) | Один логин на экосистему |
| Delivery | In-app lead-карточки + CSV/Google Sheets экспорт | Чат — это продукт; карточки сильнее Sheets |
| Деплой: front | Vercel | Как Glook app runtime |
| Деплой: worker | Railway | Долгоживущий процесс + cron |
| Платежи | **PayPro Global** (MoR, как Glook D-28) — переиспользуем интеграцию (webhook, subscriptions/payment_events) | MoR снимает налоги; общий аккаунт с Glook. MVP: PayPro checkout-ссылки + ручная активация плана, автобиллинг через webhook |

### Что отвергнуто и почему

| Вариант | Причина отказа |
|---------|---------------|
| **Python / FastAPI** (из MVP scope) | Единственный плюс — локальный ML, которого здесь нет (интеллект арендуем у OpenAI API). Дал бы второй стек, второй деплой, мост к TS-Glook. Чистый проигрыш в поддержке |
| Отдельный Supabase-проект | Warm-handoff потребовал бы API-мост/синк. Общая БД — меньше кода, бесшовно |
| Supabase Edge Functions для pipeline | Лимит 10 сек убивает enrichment waterfall |
| Vercel Cron / serverless для скана | Батч сигналов — минуты, нужен долгоживущий процесс → Railway |
| Pinecone/Weaviate для RAG | pgvector в той же Supabase — ноль доп. инфраструктуры |
| Claude API для генерации | Glook на OpenAI, scope на GPT-4o — держим один провайдер |
| **Stripe / Lemon Squeezy** | Не Merchant of Record (налоговая головная боль), слабая RU-поддержка. Glook уже отверг (D-28). Берём PayPro Global |

---

## ФИНАЛЬНАЯ ПРОВЕРКА

- [x] Стек покрывает все требования PROJECT_IDEA.md
- [x] Нет таймаут-проблем — pipeline на Railway, не Edge Fn
- [x] Хостинг в бюджете — ~$0 старт, ~$5–10 рост
- [x] Нет технологий, недоступных в нужных регионах (платежи — PayPro Global, как Glook D-28)

→ Переход к SPEC.md
