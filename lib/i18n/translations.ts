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
      headline: "Find people ready to buy.",
      subtitle:
        "Reddit + HN signals → verified company → verified email → personalized message. Pay only for leads that pass all 4 verification levels.",
      trust: [
        "4-level verification",
        "Credit charged only when verified",
        "<3% bounce rate",
        "Reddit + HN signals",
      ],
    },

    how: {
      badge: "4-Level Verification",
      heading: "How it works",
      description:
        "Signal to verified lead in minutes. Credit charged only when all levels pass.",
      learnMore: "Learn more",
      cards: [
        {
          title: "Reddit + HN signals",
          description:
            "AI scans Reddit and Hacker News for pain, questions, and tool searches that match your ICP — in real time.",
        },
        {
          title: "Company identified",
          description:
            "From post author to company domain. Exa entity search + GPT extract the right org — not a guess.",
        },
        {
          title: "Role verified",
          description:
            "Decision-maker confirmed. Role, seniority, LinkedIn profile — all checked before paying for an email.",
        },
        {
          title: "Verified email + message",
          description:
            "Waterfall Prospeo → Hunter → Apollo. Credit charged only when all 4 levels pass. Rejected leads are free.",
        },
      ],
    },

    pricing: {
      heading: "Simple pricing",
      description:
        "Credit charged only when all 4 verification levels pass. Rejected leads are free.",
      billingMonthly: "Monthly",
      billingAnnual: "Annual",
      billingSave: "Save 20%",
      earlyAccess: "Early access",
      plans: [
        {
          note: "One time, forever",
          cta: "Start free",
          features: [
            "10 verified leads (one-time)",
            "4-level verification",
            "Credit guarantee",
            "Personalized email message",
            "Plan mode · 20 msg/day",
            "1 team member",
          ],
        },
        {
          note: "Solo founders & freelancers",
          cta: "Get Starter",
          features: [
            "30 verified leads/month",
            "4-level verification",
            "Credit guarantee",
            "Personalized email message",
            "CSV export",
            "100 AI messages/day",
            "⚡ 100 leads · first 3 months",
          ],
        },
        {
          note: "Growing outbound agencies",
          cta: "Get Growth",
          features: [
            "100 verified leads/month",
            "4-level verification",
            "Credit guarantee",
            "Personalized email message",
            "CSV export",
            "Priority pipeline",
            "300 AI messages/day",
            "3 team members",
          ],
        },
        {
          note: "High-volume agencies",
          cta: "Get Agency",
          features: [
            "300 verified leads/month",
            "4-level verification",
            "Credit guarantee",
            "Personalized email message",
            "CSV export",
            "Priority pipeline",
            "Unlimited AI modes",
            "API access",
            "10 team members",
          ],
        },
      ],
      mostPopular: "MOST POPULAR",
    },

    try: {
      heading: "Start finding leads for free",
      subheading: "10 verified leads on us. No card required.",
    },

    pricingCta: "See full plans & compare →",

    footer: {
      privacy: "Privacy",
      terms: "Terms",
      pricing: "Pricing",
      compare: "Compare",
      copyright: "© 2026 IntentLead AI. All rights reserved.",
      description:
        "Signal-to-lead pipeline. Reddit + HN intent → verified contact → personalized message.",
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
      headline: "Найдите тех, кто готов купить.",
      subtitle:
        "Сигналы Reddit + HN → верифицированная компания → верифицированный email → персонализированное письмо. Платите только за лидов, прошедших все 4 уровня верификации.",
      trust: [
        "4-уровневая верификация",
        "Кредит только за верифицированных",
        "<3% показатель отказов",
        "Сигналы Reddit + HN",
      ],
    },

    how: {
      badge: "4-Уровневая верификация",
      heading: "Как это работает",
      description:
        "От сигнала до верифицированного лида — за минуты. Кредит списывается только при прохождении всех уровней.",
      learnMore: "Подробнее",
      cards: [
        {
          title: "Сигналы Reddit + HN",
          description:
            "AI сканирует Reddit и Hacker News на предмет болей, вопросов и поиска инструментов, подходящих под ваш ICP — в реальном времени.",
        },
        {
          title: "Компания идентифицирована",
          description:
            "От автора поста до домена компании. Exa entity search + GPT извлекают нужную организацию — без догадок.",
        },
        {
          title: "Роль верифицирована",
          description:
            "Лицо, принимающее решения, подтверждено. Роль, уровень, LinkedIn — всё проверено до оплаты за email.",
        },
        {
          title: "Верифицированный email + письмо",
          description:
            "Waterfall Prospeo → Hunter → Apollo. Кредит списывается только при прохождении всех 4 уровней. Отклонённые лиды — бесплатно.",
        },
      ],
    },

    pricing: {
      heading: "Простые тарифы",
      description:
        "Кредит списывается только при прохождении всех 4 уровней верификации. Отклонённые лиды бесплатны.",
      billingMonthly: "Ежемесячно",
      billingAnnual: "Ежегодно",
      billingSave: "Скидка 20%",
      earlyAccess: "Ранний доступ",
      plans: [
        {
          note: "Один раз, навсегда",
          cta: "Начать бесплатно",
          features: [
            "10 верифицированных лидов",
            "4-уровневая верификация",
            "Гарантия кредита",
            "Персонализированное письмо",
            "Plan-режим · 20 сообщений/день",
            "1 участник команды",
          ],
        },
        {
          note: "Для соло-фаундеров",
          cta: "Выбрать Starter",
          features: [
            "30 лидов в месяц",
            "4-уровневая верификация",
            "Гарантия кредита",
            "Персонализированное письмо",
            "Экспорт CSV",
            "100 сообщений AI в день",
            "⚡ 100 лидов · первые 3 месяца",
          ],
        },
        {
          note: "Для растущих агентств",
          cta: "Выбрать Growth",
          features: [
            "100 лидов в месяц",
            "4-уровневая верификация",
            "Гарантия кредита",
            "Персонализированное письмо",
            "Экспорт CSV",
            "Приоритетный пайплайн",
            "300 сообщений AI в день",
            "3 участника команды",
          ],
        },
        {
          note: "Для высокого объёма",
          cta: "Выбрать Agency",
          features: [
            "300 лидов в месяц",
            "4-уровневая верификация",
            "Гарантия кредита",
            "Персонализированное письмо",
            "Экспорт CSV",
            "Приоритетный пайплайн",
            "Безлимитные AI-режимы",
            "API доступ",
            "10 участников команды",
          ],
        },
      ],
      mostPopular: "ПОПУЛЯРНЫЙ",
    },

    try: {
      heading: "Начните бесплатно",
      subheading: "10 верифицированных лидов — от нас. Карта не нужна.",
    },

    pricingCta: "Полные тарифы и сравнение →",

    footer: {
      privacy: "Конфиденциальность",
      terms: "Условия",
      pricing: "Тарифы",
      compare: "Сравнение",
      copyright: "© 2026 IntentLead AI. Все права защищены.",
      description:
        "Pipeline «сигнал → лид». Сигналы Reddit + HN → верифицированный контакт → персонализированное письмо.",
      product: "Продукт",
      legal: "Правовые",
      howItWorks: "Как это работает",
      methodology: "Методология",
      roadmap: "Роадмап",
    },
  },
};
