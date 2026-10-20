export type Lang = "en" | "ru";

export interface Translations {
  // SiteHeader
  header: {
    signIn: string;
    getStarted: string;
    pilotAccess: string;
    workspace: string;
  };

  // HeroSection
  hero: {
    headline: string;
    subtitle: string;
    regionLabel: string;
    trust: string[];
  };

  composer: {
    label: string;
    placeholders: string[];
    modeLabel: string;
    modes: Array<{ value: string; label: string; description: string }>;
    microphoneUnavailable: string;
    submit: string;
    siteHint: string;
  };

  // GradientCards (How it works)
  how: {
    badge: string;
    heading: string;
    description: string;
    learnMore: string;
    cards: Array<{ badge: string; title: string; description: string }>;
  };

  // Pilot Access narrative on the landing page
  pricing: {
    heading: string;
    description: string;
    eyebrow: string;
    freeTitle: string;
    freeDescription: string;
    points: Array<{ label: string; title: string; description: string }>;
    terms: string;
    noSending: string;
  };

  // "Try for free" section (landing)
  try: {
    heading: string;
    subheading: string;
  };

  // Landing pricing CTA
  pricingCta: string;

  // Footer (simple Footer.tsx + BackgroundBoxes)
  footer: {
    privacy: string;
    terms: string;
    pricing: string;
    compare: string;
    copyright: string;
    description: string;
    product: string;
    legal: string;
    howItWorks: string;
    methodology: string;
    roadmap: string;
  };
}

export const TRANSLATIONS: Record<Lang, Translations> = {
  en: {
    header: {
      signIn: "Sign In",
      getStarted: "Get Started",
      pilotAccess: "Pilot Access",
      workspace: "Workspace",
    },

    hero: {
      headline: "Find the right opportunity.",
      subtitle:
        "Turn public commercial evidence into a reviewable company, buyer, verified contact, and grounded conversation draft.",
      regionLabel: "Opportunity discovery introduction",
      trust: [
        "Evidence attached",
        "Multi-source discovery",
        "Human review",
        "No automatic sending",
      ],
    },

    composer: {
      label: "Describe your offer and ideal customer",
      placeholders: [
        "Who are you selling to and what pain do you solve?",
        "Describe your ideal customer...",
        "Which commercial evidence would make an opportunity relevant?",
      ],
      modeLabel: "Discovery mode",
      modes: [
        { value: "discover", label: "Discover", description: "Find evidence-backed opportunities" },
        { value: "refine", label: "Refine", description: "Clarify your offer and ideal customer" },
        { value: "research", label: "Research", description: "Structure a broader discovery brief" },
      ],
      microphoneUnavailable: "Voice input is not available yet",
      submit: "Continue to conversational discovery",
      siteHint: "Have a site? Paste its URL for business context only.",
    },

    how: {
      badge: "Opportunity workflow",
      heading: "How it works",
      description:
        "From an observed signal to a grounded opportunity package you can inspect before acting.",
      learnMore: "Learn more",
      cards: [
        {
          badge: "01 · Evidence",
          title: "Commercial evidence found",
          description:
            "Discovery gathers public evidence of pains, changes, questions, and active searches that fit your offer and ICP.",
        },
        {
          badge: "02 · Company",
          title: "Company resolved",
          description:
            "Evidence is connected to a company only when the available facts support that relationship.",
        },
        {
          badge: "03 · Buyer",
          title: "Buyer resolved",
          description:
            "The workflow identifies a relevant buyer role and verifies contact data where reliable sources are available.",
        },
        {
          badge: "04 · Brief",
          title: "Grounded brief prepared",
          description:
            "A concise opportunity brief and draft are grounded in the collected evidence and left for human review.",
        },
      ],
    },

    pricing: {
      heading: "Pilot Access",
      description:
        "A closed, founder-managed program for proving useful Opportunity work before agreeing any continuation.",
      eyebrow: "A diagnostic engagement, not a plan",
      freeTitle: "The first diagnostic pilot is free",
      freeDescription:
        "We clarify your offer, ICP, market and evidence standard, then run the authorized source portfolio and review the result together.",
      points: [
        {
          label: "Complete run",
          title: "20+ confirmed signals is the target",
          description:
            "A complete run targets at least 20 evidence-backed signals when current source and backend coverage permits.",
        },
        {
          label: "Honest coverage",
          title: "Partial means partial",
          description:
            "If the available portfolio is exhausted first, we report the actual result, shortfall and source gaps instead of padding the count.",
        },
        {
          label: "Continuation",
          title: "Paid work is agreed individually",
          description:
            "Continuation may combine later runs, recurring discovery and agreed source expansion, with scope and terms set together.",
        },
      ],
      terms: "No published plans, checkout, credits or automatic billing.",
      noSending: "IntentLead prepares evidence and grounded material. It never sends messages.",
    },

    try: {
      heading: "Describe the opportunity you need",
      subheading: "Start with an offer and ICP. The workflow will structure a reviewable discovery brief.",
    },

    pricingCta: "How Pilot Access works →",

    footer: {
      privacy: "Privacy",
      terms: "Terms",
      pricing: "Pricing",
      compare: "Explore",
      copyright: "© 2026 IntentLead AI. All rights reserved.",
      description:
        "Public evidence → company → buyer → verified contact → grounded draft.",
      product: "Product",
      legal: "Legal",
      howItWorks: "How it works",
      methodology: "Methodology",
      roadmap: "Roadmap",
    },
  },

  ru: {
    header: {
      signIn: "Войти",
      getStarted: "Начать",
      pilotAccess: "Обсудить пилот",
      workspace: "Кабинет",
    },

    hero: {
      headline: "Найдите подходящую возможность.",
      subtitle:
        "Превратите публичные коммерческие свидетельства в проверяемый пакет: компания, buyer, контакт и grounded draft.",
      regionLabel: "Введение в поиск коммерческих возможностей",
      trust: [
        "Свидетельства приложены",
        "Много источников",
        "Решение принимает человек",
        "Без автоотправки",
      ],
    },

    composer: {
      label: "Опишите предложение и идеального клиента",
      placeholders: [
        "Кому вы продаёте и какую проблему решаете?",
        "Опишите идеального клиента...",
        "Какие коммерческие свидетельства сделают opportunity релевантной?",
      ],
      modeLabel: "Режим discovery",
      modes: [
        { value: "discover", label: "Найти", description: "Найти opportunities с подтверждёнными evidence" },
        { value: "refine", label: "Уточнить", description: "Уточнить offer и идеального клиента" },
        { value: "research", label: "Исследовать", description: "Собрать более широкий discovery brief" },
      ],
      microphoneUnavailable: "Голосовой ввод пока недоступен",
      submit: "Перейти к диалогу о discovery",
      siteHint: "Есть сайт? Вставьте URL только для бизнес-контекста.",
    },

    how: {
      badge: "Opportunity workflow",
      heading: "Как это работает",
      description:
        "От наблюдаемого сигнала до grounded opportunity, которую можно проверить до любого действия.",
      learnMore: "Подробнее",
      cards: [
        {
          badge: "01 · Evidence",
          title: "Найдено коммерческое свидетельство",
          description:
            "Discovery собирает публичные свидетельства боли, изменений, вопросов и активного поиска, совпадающие с вашим offer и ICP.",
        },
        {
          badge: "02 · Компания",
          title: "Компания установлена",
          description:
            "Свидетельство связывается с компанией только тогда, когда доступные факты подтверждают эту связь.",
        },
        {
          badge: "03 · Buyer",
          title: "Buyer определён",
          description:
            "Workflow определяет релевантную роль и проверяет контактные данные, если есть надёжные источники.",
        },
        {
          badge: "04 · Brief",
          title: "Grounded brief подготовлен",
          description:
            "Opportunity brief и draft опираются на собранные свидетельства и остаются на проверку человеку.",
        },
      ],
    },

    pricing: {
      heading: "Pilot Access",
      description:
        "Закрытая программа под управлением основателя: сначала проверяем полезность Opportunity-работы, затем обсуждаем продолжение.",
      eyebrow: "Диагностическая работа, а не тариф",
      freeTitle: "Первый диагностический пилот — бесплатно",
      freeDescription:
        "Вместе уточняем offer, ICP, рынок и стандарт evidence, запускаем разрешённый портфель источников и разбираем результат.",
      points: [
        {
          label: "Полный запуск",
          title: "Цель — 20+ подтверждённых сигналов",
          description:
            "Полный запуск нацелен минимум на 20 сигналов с evidence, когда это допускает текущее покрытие источников и backend.",
        },
        {
          label: "Честное покрытие",
          title: "Partial остаётся partial",
          description:
            "Если доступные источники исчерпаны раньше, показываем фактический результат, дефицит и пробелы, а не дополняем счётчик слабыми находками.",
        },
        {
          label: "Продолжение",
          title: "Платная работа согласуется индивидуально",
          description:
            "Продолжение может объединять следующие запуски, регулярный discovery и согласованное расширение источников; объём и условия определяем вместе.",
        },
      ],
      terms: "Без опубликованных тарифов, checkout, кредитов и автоматического биллинга.",
      noSending: "IntentLead готовит evidence и grounded-материалы, но никогда не отправляет сообщения.",
    },

    try: {
      heading: "Опишите нужную opportunity",
      subheading: "Начните с offer и ICP. Workflow соберёт из них проверяемый discovery brief.",
    },

    pricingCta: "Как устроен Pilot Access →",

    footer: {
      privacy: "Конфиденциальность",
      terms: "Условия",
      pricing: "Тарифы",
      compare: "Изучить",
      copyright: "© 2026 IntentLead AI. Все права защищены.",
      description:
        "Публичные evidence → компания → buyer → контакт → grounded draft.",
      product: "Продукт",
      legal: "Правовые",
      howItWorks: "Как это работает",
      methodology: "Методология",
      roadmap: "Роадмап",
    },
  },
};
