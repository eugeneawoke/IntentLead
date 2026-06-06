# IntentLead AI

> Сигнал → компания → email → письмо. Находит людей и компании с публичным intent и доводит
> сигнал до верифицированного контакта с готовым персонализированным письмом.

Не «вот пост, пиши сам» — а «вот человек, компания, email, и письмо готово».
Продолжение [Glook](https://glook.dev) (аудит сайтов): общий аккаунт, два входа — холодный чат и тёплый переход после скана.

---

## Что делает

1. **Сканирует** Reddit + Hacker News по ключам клиента → ловит сигналы intent.
2. **Классифицирует** intent (GPT-4o-mini, confidence ≥ 80, иначе выброс).
3. **Идентифицирует** компанию автора (Google Custom Search + GPT).
4. **Находит email** через waterfall Prospeo → Hunter → Apollo.
5. **Генерирует** персонализированное письмо (GPT-4o, grounded на контексте клиента через RAG).
6. **Отдаёт** верифицированный лид карточкой: компания, контакт, роль, email, why-now, opening line.

**4 уровня верификации.** Лид зелёный только если все 4 прошли. Кредит не списывается при провале — гарантия качества без споров.

---

## Два сценария входа

- **Cold** — пришёл не через Glook: минимал-чат-ассистент копает контекст, предлагает скан, запускает поиск.
- **Warm** — пришёл после скана Glook: боль и недостатки сайта уже известны (общая Supabase), сразу «кого ищешь».

---

## Стек

| Слой | Технология |
|---|---|
| Front / чат | Next.js 16 App Router, React 19, TS strict, Tailwind v4, shadcn/ui, Vercel AI SDK |
| Backend (app) | Next.js route handlers (`app/api/*`) |
| Pipeline | Railway worker (Node, long-running) |
| БД / Auth | Supabase PostgreSQL + RLS + pgvector (общий проект с Glook) |
| AI | OpenAI (GPT-4o-mini, GPT-4o, text-embedding-3-small) |
| Источники | Reddit API · HN Algolia · Google CSE · Prospeo/Hunter/Apollo |
| Платежи | PayPro Global (MoR) |
| Deploy | Vercel (app) + Railway (worker) |

Полное обоснование стека — [STACK_DECISION.md](STACK_DECISION.md).

---

## Документация проекта

| Файл | Назначение |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Контекст агентов: правила, стек, env, file-map |
| [AGENTS.md](AGENTS.md) | Унифицированный контекст для всех агентов, протокол записи |
| [PROJECT_IDEA.md](PROJECT_IDEA.md) | Идея, пользователь, боль, монетизация |
| [SPEC.md](SPEC.md) | Спецификация — 6 блоков (источник правды) |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | «Signal Dark» — токены, компоненты |
| [BUILD_PROMPT.md](BUILD_PROMPT.md) | Мегапромт автономной сборки (7 субагентов) |
| [DECISIONS.md](DECISIONS.md) · [EVIDENCE.md](EVIDENCE.md) · [MEMORY.md](MEMORY.md) | Решения · факты · память |
| [PLAN.md](PLAN.md) · [TODO.md](TODO.md) | Фазы · задачи |

---

## Запуск (после сборки)

```bash
# 1. App (Next.js)
npm install
cp .env.example .env        # заполнить значения (см. ниже)
npm run dev                 # http://localhost:3000

# 2. Миграции БД
npx supabase db push

# 3. Pipeline worker (Railway / локально)
npm run worker              # long-running, слушает /internal/run-pipeline

# Проверка
npm run lint
npm run build               # type/build gate
npm test
```

### Environment variables
Полный список — [CLAUDE.md](CLAUDE.md). Ключевые группы:
`NEXT_PUBLIC_SUPABASE_*` · `SUPABASE_SERVICE_ROLE_KEY` · `OPENAI_API_KEY` ·
`WORKER_URL` / `WORKER_SECRET` · `REDDIT_*` · `GOOGLE_CSE_*` · `PROSPEO_API_KEY` /
`HUNTER_API_KEY` / `APOLLO_API_KEY` · `PAYPRO_*`.

---

## Деплой
- **App** → Vercel (как Glook app runtime).
- **Worker** → Railway (long-running, cron для плановых сканов).
- **БД** → Supabase (общий проект с Glook). Миграции `supabase/migrations/*`.

---

## Метрики MVP (цель месяц 1)
Free→paid ≥ 3 · reply-rate ≥ 15% · verified-rate ≥ 60% · bounce < 3% · retention м2 ≥ 70%.

---

## Принцип
> Лучше 10 идеальных лидов, чем 50 сомнительных. Качество верификации — единственное преимущество, которое нельзя скопировать быстро.
