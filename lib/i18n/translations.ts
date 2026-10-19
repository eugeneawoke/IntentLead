export type Lang = "en" | "ru";

export interface Translations {
  // SiteHeader
  header: {
    signIn: string;
    getStarted: string;
    workspace: string;
  };

  // HeroSection
  hero: {
    headline: string;
    subtitle: string;
    trust: string[];
  };

  // GradientCards (How it works)
  how: {
    badge: string;
    heading: string;
    description: string;
    learnMore: string;
    cards: Array<{ title: string; description: string }>;
  };

  // PricingSection (landing) + PricingCards (/pricing page)
  pricing: {
    heading: string;
    description: string;
    billingMonthly: string;
    billingAnnual: string;
    billingSave: string;
    earlyAccess: string;
    plans: Array<{ note: string; cta: string; features: string[] }>;
    mostPopular: string;
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
      workspace: "Workspace",
    },

    hero: {
      headline: "Find the right opportunity.",
      subtitle:
        "Turn public commercial evidence into a reviewable company, buyer, verified contact, and grounded conversation draft.",
      trust: [
        "Evidence attached",
        "Multi-source discovery",
        "Human review",
        "No automatic sending",
      ],
    },

    how: {
      badge: "Opportunity workflow",
      heading: "How it works",
      description:
        "From an observed signal to a grounded opportunity package you can inspect before acting.",
      learnMore: "Learn more",
      cards: [
        {
          title: "Commercial evidence found",
          description:
            "Discovery gathers public evidence of pains, changes, questions, and active searches that fit your offer and ICP.",
        },
        {
          title: "Company resolved",
          description:
            "Evidence is connected to a company only when the available facts support that relationship.",
        },
        {
          title: "Buyer resolved",
          description:
            "The workflow identifies a relevant buyer role and verifies contact data where reliable sources are available.",
        },
        {
          title: "Grounded brief prepared",
          description:
            "A concise opportunity brief and draft are grounded in the collected evidence and left for human review.",
        },
      ],
    },

    pricing: {
      heading: "Pilot access",
      description:
        "Commercial plans are not published yet. The first controlled pilot is focused on proving useful opportunities and delivery economics.",
      billingMonthly: "Pilot",
      billingAnnual: "Planned",
      billingSave: "In validation",
      earlyAccess: "Design partner",
      plans: [
        {
          note: "Inspect the workflow",
          cta: "Open workspace",
          features: [
            "Structured discovery brief",
            "Evidence-first opportunity view",
            "Human review controls",
            "No automatic outreach",
          ],
        },
        {
          note: "Controlled first engagement",
          cta: "Discuss pilot",
          features: [
            "Multi-source discovery",
            "Company and buyer resolution",
            "Verified contact when available",
            "Grounded brief and draft",
            "CSV export",
          ],
        },
        {
          note: "For a repeatable team workflow",
          cta: "Join waitlist",
          features: [
            "Shared opportunity review",
            "Evidence and decision history",
            "Buyer and contact verification",
            "Grounded drafts",
            "CSV export",
          ],
        },
        {
          note: "Future high-volume workflow",
          cta: "Talk to us",
          features: [
            "Custom source portfolio",
            "Team review workflow",
            "Export and integration options",
            "No unattended sending",
          ],
        },
      ],
      mostPopular: "FIRST PILOT",
    },

    try: {
      heading: "Describe the opportunity you need",
      subheading: "Start with an offer and ICP. The workflow will structure a reviewable discovery brief.",
    },

    pricingCta: "See pilot access →",

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
      workspace: "Кабинет",
    },

    hero: {
      headline: "Найдите подходящую возможность.",
      subtitle:
        "Превратите публичные коммерческие свидетельства в проверяемый пакет: компания, buyer, контакт и grounded draft.",
      trust: [
        "Свидетельства приложены",
        "Много источников",
        "Решение принимает человек",
        "Без автоотправки",
      ],
    },

    how: {
      badge: "Opportunity workflow",
      heading: "Как это работает",
      description:
        "От наблюдаемого сигнала до grounded opportunity, которую можно проверить до любого действия.",
      learnMore: "Подробнее",
      cards: [
        {
          title: "Найдено коммерческое свидетельство",
          description:
            "Discovery собирает публичные свидетельства боли, изменений, вопросов и активного поиска, совпадающие с вашим offer и ICP.",
        },
        {
          title: "Компания установлена",
          description:
            "Свидетельство связывается с компанией только тогда, когда доступные факты подтверждают эту связь.",
        },
        {
          title: "Buyer определён",
          description:
            "Workflow определяет релевантную роль и проверяет контактные данные, если есть надёжные источники.",
        },
        {
          title: "Grounded brief подготовлен",
          description:
            "Opportunity brief и draft опираются на собранные свидетельства и остаются на проверку человеку.",
        },
      ],
    },

    pricing: {
      heading: "Доступ к пилоту",
      description:
        "Коммерческие тарифы ещё не опубликованы. Первый контролируемый пилот проверяет полезность opportunities и экономику delivery.",
      billingMonthly: "Пилот",
      billingAnnual: "Позже",
      billingSave: "В валидации",
      earlyAccess: "Дизайн-партнёр",
      plans: [
        {
          note: "Изучить workflow",
          cta: "Открыть workspace",
          features: [
            "Структурированный discovery brief",
            "Opportunity с исходными evidence",
            "Решение принимает человек",
            "Без автоотправки",
          ],
        },
        {
          note: "Первое контролируемое внедрение",
          cta: "Обсудить пилот",
          features: [
            "Multi-source discovery",
            "Company и buyer resolution",
            "Проверенный контакт, если доступен",
            "Grounded brief и draft",
            "Экспорт CSV",
          ],
        },
        {
          note: "Для повторяемого team workflow",
          cta: "В список ожидания",
          features: [
            "Совместная проверка opportunities",
            "История evidence и решений",
            "Buyer и contact verification",
            "Grounded drafts",
            "Экспорт CSV",
          ],
        },
        {
          note: "Будущий high-volume workflow",
          cta: "Связаться",
          features: [
            "Настраиваемый портфель источников",
            "Командная проверка",
            "Экспорт и интеграции",
            "Без автономной отправки",
          ],
        },
      ],
      mostPopular: "ПЕРВЫЙ ПИЛОТ",
    },

    try: {
      heading: "Опишите нужную opportunity",
      subheading: "Начните с offer и ICP. Workflow соберёт из них проверяемый discovery brief.",
    },

    pricingCta: "Доступ к пилоту →",

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
