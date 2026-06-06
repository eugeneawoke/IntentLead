# DESIGN_SYSTEM.md — IntentLead AI · "Signal Dark"
*Версия 1.0 · 2026-06-05. Источник правды для всего визуала. Tailwind v4 + shadcn/ui.*

> **Принцип:** один акцент — lime-зелёный = «intent пойман / verified / live / деньги».
> Глубокий тёмный холст, премиальная B2B-серьёзность. Энергия Lovable, но не радуга:
> один сигнальный цвет вместо градиентного спектра. Зелёный несёт семантику продукта
> (как match-% у horyx), а не просто декор.

---

## 1. ЦВЕТ (CSS-переменные / Tailwind tokens)

### Холст и поверхности (dark base)
```
--bg            #0A0C0F   /* near-black холст */
--surface       #14181D   /* карточки, инпут */
--surface-2     #1C2129   /* hover-поверхность, поповеры */
--border        #262C35   /* тонкие грани 1px */
--border-strong #353D49   /* акцентная грань на hover */
```

### Текст
```
--text          #F4F6F8   /* основной */
--text-muted    #9AA4B2   /* вторичный, подписи */
--text-faint    #5B6675   /* плейсхолдер, дизейбл */
```

### Акцент — Signal Lime (единственный бренд-цвет)
```
--accent        #A3E635   /* lime-400 — CTA, send, активный сигнал */
--accent-hover  #B6F04C
--accent-press  #8FD11F
--accent-fg     #0A0C0F   /* текст на акценте — тёмный, не белый */
--accent-glow    0 0 40px rgba(163,230,53,0.25)  /* свечение под инпутом/CTA */
```

### Семантика верификации и статусов
```
--verified      #A3E635   /* зелёный чек — уровень пройден (= accent) */
--pending       #F5C451   /* amber — обработка / processing */
--rejected      #6B7280   /* серый — отброшен (НЕ красный: это норма, не ошибка) */
--error         #F87171   /* red — реальная системная ошибка */
--info          #6BA4FF   /* blue — нейтральная инфа, intent-type chip */
```

> Важно: **rejected лид = серый, не красный.** Отброс по верификации — нормальная работа
> гарантии качества, не сбой. Красный резервируем за настоящие ошибки.

### Intent-score шкала (для карточек)
```
90–100  --accent (#A3E635)  "HOT"
80–89   #C7E86B             "STRONG"
< 80    не показываем (rejected)
```

---

## 2. ТИПОГРАФИКА

```
Display / Headings : "Geist", system-ui, sans-serif   (tight tracking -0.02em)
Body / UI          : "Inter", system-ui, sans-serif
Mono (email, score): "Geist Mono", ui-monospace        (для email, доменов, чисел)
```

Шкала:
```
display   48 / 52   weight 600   tracking -0.03em   (hero headline)
h1        32 / 38   weight 600
h2        24 / 30   weight 600
h3        18 / 24   weight 600
body      15 / 24   weight 400
small     13 / 18   weight 400   color text-muted
label     12 / 16   weight 500   uppercase tracking 0.06em color text-muted
```

---

## 3. SPACING · RADIUS · ELEVATION

```
spacing base 4px:  1=4 · 2=8 · 3=12 · 4=16 · 6=24 · 8=32 · 12=48 · 16=64
radius:  sm 8 · md 12 · lg 16 · xl 24 · full 9999
         (чат-композер и карточки = xl 24, кнопки = full или md)
shadow:  card    0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px rgba(0,0,0,0.4)
         glow    var(--accent-glow)  (только под активным CTA / focused инпут)
border:  всё на 1px --border; hover → --border-strong
```

Motion:
```
ease     cubic-bezier(0.22, 1, 0.36, 1)   duration 180–240ms
accent-pulse: live-сигнал/processing = мягкий pulse 1.6s на --accent точке
stream:  токены ассистента появляются fade-in 80ms каждый блок
НЕ анимировать без причины. Анимация = обратная связь, не декор.
```

---

## 4. КЛЮЧЕВЫЕ КОМПОНЕНТЫ

### 4.1 Chat Composer (сердце продукта — cold-вход)
```
Контейнер: surface, radius-xl, border 1px, max-w 720px, центр экрана
Focused:   border-strong + accent-glow снизу
Плейсхолдер: text-faint, РОТАЦИЯ вопросов каждые ~4s
   ["Кому вы продаёте и какую боль решаете?",
    "Опишите идеального клиента…",
    "Кого хотите найти сегодня?"]
Левый слот:  кнопка "+" (вставить ссылку сайта → скан), круглая, surface-2
Правый слот: chip режима (тихий, text-muted) + Send (круглый, --accent fill, иконка ↑ accent-fg)
Над инпутом (пусто): display-headline "Find people ready to buy." + подзаголовок text-muted
```

### 4.2 Lead Card (horyx-style, доставка)
```
surface, radius-lg, border, padding 6, hover → border-strong + lift 2px
Шапка:   company_name (h3) · domain (mono small text-muted) · справа intent-score chip (HOT/STRONG)
Тело:    contact_name + role (founder/CEO/CMO → role-badge)
         email (mono) + email_provider tag
         why_now (body) · opening_line (italic, surface-2 цитата-блок)
Футер:   4 verification-бейджа в ряд — все зелёные чеки:
         [✓ Signal] [✓ Company] [✓ Contact] [✓ Email]   (accent fill, accent-fg текст)
         кнопки: Copy email · Copy message · Export
```

### 4.3 Verification Badges
```
Зелёный (пройден): pill, --verified fill 12% opacity bg, accent текст, ✓ иконка
Серый (rejected на уровне): pill, --rejected, ✕, показывается только в "отброшенные"
4 уровня фиксированы: Signal · Company · Contact · Email
```

### 4.4 Landing Step-Wizard (proof, как у horyx — но честно)
```
4 анимированные карточки-превью реального флоу (НЕ фейк-инвентарь):
  Step 1 — "Опишите кого ищете" (мини-чат)
  Step 2 — "AI ловит сигналы" (Reddit/HN сигнал → intent-score появляется)
  Step 3 — "Верификация 4 уровня" (чеки загораются зелёным по очереди)
  Step 4 — "Лид + письмо готовы" (lead-card материализуется)
Каждая карточка с лейблом "Step N of 4", accent-pulse на активном шаге.
ВАЖНО: никаких повторяющихся демо-данных (ошибка horyx). Один честный пример на шаг.
```

### 4.5 Buttons
```
Primary:   --accent fill, accent-fg текст, radius-full, hover accent-hover, press accent-press
Secondary: surface-2, text, border, hover border-strong
Ghost:     прозрачный, text-muted, hover text + surface
Disabled:  surface, text-faint, no glow
```

### 4.6 Trust strip (чинит слабость horyx — громкое доверие)
```
Под hero: живые цифры (НЕ фейк) — "X verified leads delivered" · "<3% bounce" ·
"кредит не списан если лид не прошёл 4 уровня" — последнее как бейдж-гарантия.
Когда данных нет (старт): показываем гарантию верификации, не выдуманные числа.
```

---

## 5. ПРАВИЛА (что нельзя)
- Не вводить второй акцентный цвет. Один lime. Всё остальное — нейтрали + семантика статусов.
- Не красить rejected красным.
- Не показывать повторяющиеся/демо-данные как реальные лиды (главный урок horyx).
- Не прятать цену и гарантию — выводить на лендинг (вторая слабость horyx).
- Белый текст на акценте запрещён — только --accent-fg (тёмный).
- Анимация только как обратная связь (stream, verify-чеки, live-pulse), не ради вау.

---

## 6. РЕФЕРЕНСЫ
- Энергия инпута/чата: Lovable (тёмный, один большой rounded input) — но один цвет вместо радуги.
- Proof-флоу + match-карточки: horyx.com (step-wizard, % match) — но без фейк-инвентаря.
- Серьёзность/грани/мono-числа: Linear, Vercel.
