# DESIGN_SYSTEM.md — IntentLead AI · "Signal Dark"
*Версия 1.1 · 2026-06-06. Источник правды для всего визуала. Tailwind v4 + shadcn/ui.*

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

### HSL channel variables (DataGridHero cell colors)
```
/* Используются как hsl(var(--green)) */
--green:  150 80% 42%   /* emerald — основной цвет ячеек DataGridHero */
--pink:   300 100% 70%
--cyan:   180 100% 60%
--yellow: 50 100% 60%
--orange: 25 100% 60%
```
> DataGridHero по факту использует `color="hsl(150, 60%, 20%)"` — тёмно-зелёный,
> не --accent напрямую. Свечение мыши = rgba(163,230,53,0.10) через CSS.

### shadcn/ui token layer (oklch)
Shadcn генерирует отдельный слой `--background / --foreground / --primary / ...` в oklch.
Эти переменные используются только компонентами shadcn/ui, не брендовыми компонентами.
Брендовые компоненты (DataGridHero, LandingComposer, LeadCard) всегда используют
`var(--bg) / var(--surface) / var(--accent)` — не shadcn-переменные.

### Intent-score шкала (для карточек)
```
90–100  --accent (#A3E635)  "HOT"
80–89   #C7E86B             "STRONG"
< 80    не показываем (rejected)
```

---

## 2. ТИПОГРАФИКА

```
Display / Headings : "Space Grotesk", system-ui, sans-serif  (weight 500/600/700)
Body / UI          : "DM Sans", system-ui, sans-serif        (weight 400/500/600)
Mono (email, score): system monospace (нет отдельного шрифта, используется fontFamily:"monospace")
```

Подключение в layout.tsx:
```tsx
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "500", "600"] });
```

CSS-правило:
```css
body { font-family: var(--font-sans, "DM Sans", system-ui, sans-serif); }
h1, h2, h3, .font-display { font-family: var(--font-display, "Space Grotesk", system-ui, sans-serif); }
```

Шкала:
```
display   clamp(44px, 6.5vw, 80px)  weight 800   leading 1.0   tracking -0.02em (hero)
h1        32 / 38   weight 600
h2        24 / 30   weight 600
h3        18 / 24   weight 600 (карточки)
body      15 / 24   weight 400
small     13 / 18   weight 400   color text-muted
label     12 / 16   weight 500   uppercase tracking 0.06em color text-faint
```

> Внимание: `StepWizard.tsx` сейчас инлайнит `fontFamily: "Inter, sans-serif"` —
> должно быть `fontFamily: "var(--font-sans, 'DM Sans', sans-serif)"`. Технический долг.

---

## 3. SPACING · RADIUS · ELEVATION

```
spacing base 4px:  1=4 · 2=8 · 3=12 · 4=16 · 6=24 · 8=32 · 12=48 · 16=64
radius:  sm ~6px · md ~8px · lg ~10px (--radius = 0.625rem)
         xl ~14px (calc(var(--radius) * 1.4)) · 2xl ~18px · 3xl ~22px · 4xl ~26px
         full 9999
         (округление инпута-композера = rounded-3xl ≈ 24px)
shadow:  card    0 8px 32px rgba(0,0,0,0.4)
         glow    var(--accent-glow)  (только под активным CTA / focused инпут)
         dock    0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset
         popup   0 16px 48px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)
border:  всё на 1px --border; hover → --border-strong
```

Motion:
```
ease     cubic-bezier(0.22, 1, 0.36, 1)   duration 180–240ms   (основной)
dock     cubic-bezier(0.25, 1, 0.5, 1)    duration 150ms        (dock magnify)
accent-pulse: live-сигнал/processing = мягкий pulse 1.6s на --accent точке
stream:  токены ассистента появляются fade-in 80ms каждый блок
shimmer: composer-border-glow 1.3s ease-out — lime border flash по custom event
НЕ анимировать без причины. Анимация = обратная связь, не декор.
```

---

## 4. КЛЮЧЕВЫЕ КОМПОНЕНТЫ

### 4.1 DataGridHero (фоновый компонент)
```
Анимированная сетка ячеек — absolute inset-0, z-index < content
Каждая ячейка: border-radius 2px, aspect-ratio 1, cell-pulse animation (opacity min/max)
Mouse glow: radial-gradient 380px на cursor pos, rgba(163,230,53,0.10), z-index 1
Bottom fade: linear-gradient transparent → var(--bg) h:180px, z-index 5 — переход в следующую секцию
Props: rows=25, cols=35, spacing=4, duration=7.5, color="hsl(150,60%,20%)",
       animationType="pulse", pulseEffect=true, mouseGlow=true
       opacityMin=0.08, opacityMax=0.65, background="var(--bg)"
```

### 4.2 LandingComposer (сердце продукта — холодный вход)
```
Контейнер: surface, rounded-3xl (24px), border 1px, max-w-3xl / max-w-xl (fat variant)
Focused:   border-strong + accent-glow (box-shadow)
Shimmer:   при custom event "composer-shimmer" → composer-border-glow 1.3s (lime flash)
Плейсхолдер: typewriter-эффект, РОТАЦИЯ 3 фраз (typing 55ms/char, delete 28ms/char, пауза 2200ms)
  ["Who are you selling to and what pain do you solve?",
   "Describe your ideal customer...",
   "Who do you want to find today?"]
Textarea: прозрачный bg, DM Sans 15px, auto-resize, Enter → submit (Shift+Enter = перенос)

Нижняя строка (flex between):
  Левый слот:  пусто (зарезервировано)
  Правый слот: [Mode dropdown ▾] + [Mic (неактивен)] + [Send button]

Mode dropdown (Lovable-style, bottom-up):
  Trigger: surface-2, border, radius 8px, text 13px weight 500 + chevron
  Popup: bg #1A1D21 (≈surface-2), border rgba(255,255,255,0.08), radius 14px, padding 6px
         box-shadow: 0 16px 48px rgba(0,0,0,0.7)
  Options: Search / Plan / Strategy — каждая с описанием desc (12px text-faint)
           active = checkmark SVG, hover = rgba(255,255,255,0.05) bg
  Закрытие: click outside через window listener

Send button: круглый 36×36, accent fill когда есть текст, surface-2 + text-faint когда пусто
Mic button: круглый 32×32, transparent, text-muted, cursor:default (placeholder, не реализован)

URL hint (под composer, всегда виден):
  ⬡ Have a site? [Paste a URL] — we'll scan it for context.
  Цвет: text-muted с [accent 62% opacity] для "Paste a URL"

Variants: default (max-w-3xl, rows=1) · fat (max-w-xl, rows=3) — fat для Try-секции
```

### 4.3 DockNav (фиксированная навигация)
```
Позиция: fixed bottom-6 left-1/2, z-index 50
Контейнер: surface bg, border --border, rounded-2xl, px-3 py-2
            box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset
Элементы: Home · How it works · Pricing · Try for free (lucide icons)
Иконка: 48×48px (var(--icon-size)), rounded-xl, gradient surface-2→surface, border
Magnify-эффект: CSS :has() — hover = 1.0, соседи = 1.33, через-один = 1.17
Tooltip: absolute bottom-full, surface-2 bg, border, opacity-0 → opacity-100 on hover
Hover: иконка SVG переходит в #A3E635 (--accent)
"Try for free" click: dispatches custom event "composer-shimmer" → LandingComposer shimmer
```

### 4.4 StepWizard (proof-флоу)
```
4 карточки — How It Works секция
Progress tabs: flex row, height 3px, accent fill = активный, --border = остальные
               transition cubic-bezier(0.22, 1, 0.36, 1) 240ms
               auto-advance: 3000ms interval
               кликабельные (setActive)
Карточка: surface bg, border, radius 16px, padding 24, minHeight 140
label: text-faint 11px uppercase tracking 0.06em (Step N of 4)
title: text 16px weight 600

Шаги (фиксированный пример, не рандом):
  Step 1 — Describe who you're looking for (ICP + ключевые слова → accent 12px)
  Step 2 — AI catches intent signals (Reddit-пост + Intent score chip HOT, mono 12px)
  Step 3 — 4-level verification (Signal/Company/Contact/Email, ✓ accent 16px)
  Step 4 — Lead + message ready (Sarah Chen, sarah@acme.io, opening line italic text-muted)

ВАЖНО: данные в шагах — демо-пример (не реальные лиды), НЕ повторяющийся инвентарь.
```

### 4.5 Lead Card (horyx-style, доставка) — ЕЩЁ НЕ РЕАЛИЗОВАН
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

### 4.6 Verification Badges — ЕЩЁ НЕ РЕАЛИЗОВАН
```
Зелёный (пройден): pill, --verified fill 12% opacity bg, accent текст, ✓ иконка
Серый (rejected на уровне): pill, --rejected, ✕, показывается только в "отброшенные"
4 уровня фиксированы: Signal · Company · Contact · Email
```

### 4.7 Buttons
```
Primary:   --accent fill, accent-fg текст, radius-full, hover accent-hover, press accent-press
Secondary: surface-2, text, border, hover border-strong
Ghost:     прозрачный, text-muted, hover text + surface
Disabled:  surface, text-faint, no glow
```

### 4.8 Trust strip (под hero)
```
4 items в ряд flex-wrap gap-6, center:
  [✓ accent] "4-level verification"
  [✓ accent] "Credit charged only when verified"
  [✓ accent] "<3% bounce rate"
  [✓ accent] "Reddit + HN signals"
Стиль: text-xs, text-muted, иконка accent. СТАТИЧНЫЕ строки (нет живых данных на старте).
Когда появятся данные: добавить "X verified leads delivered" — только реальные числа.
```

---

## 5. ПРАВИЛА (что нельзя)
- Не вводить второй акцентный цвет. Один lime. Всё остальное — нейтрали + семантика статусов.
- Не красить rejected красным.
- Не показывать повторяющиеся/демо-данные как реальные лиды (главный урок horyx).
- Не прятать цену и гарантию — выводить на лендинг (вторая слабость horyx).
- Белый текст на акценте запрещён — только --accent-fg (тёмный).
- Анимация только как обратная связь (stream, verify-чеки, live-pulse, shimmer), не ради вау.
- Брендовые компоненты используют `var(--bg/--surface/--accent)`, НЕ shadcn-переменные.
- Хардкод цветов (#1A1D21 в dropdown) — технический долг, заменять на токены при рефакторе.
- Шрифты только через CSS-переменные (`var(--font-sans)`, `var(--font-display)`), не inline строками.

---

## 6. ТЕХНИЧЕСКИЕ ДОЛГИ (выявлено при аудите)
- `StepWizard.tsx`: инлайн `fontFamily: "Inter, sans-serif"` → заменить на `var(--font-sans)`
- `LandingComposer.tsx` mode dropdown: хардкод `background: "#1A1D21"` → `var(--surface-2)`
- Mic-кнопка: `cursor: "default"` — или убрать до реализации voice, или показать tooltip "Coming soon"
- Trust strip: статичные строки, в V2 заменить на реальные счётчики из DB

---

## 7. РЕФЕРЕНСЫ
- Энергия инпута/чата: Lovable (тёмный, один большой rounded input, mode dropdown) — один цвет.
- Proof-флоу + match-карточки: horyx.com (step-wizard, % match) — без фейк-инвентаря.
- Серьёзность/грани/mono-числа: Linear, Vercel.
- Grid-фон: DataGridHero вдохновлён анимированными grid-backgrounds из 21st.dev.
