export type Lang = "en" | "ru";

export interface Translations {
  header: {
    signIn: string;
    getStarted: string;
    workspace: string;
  };
  footer: {
    privacy: string;
    terms: string;
    methodology: string;
    roadmap: string;
    copyright: string;
  };
}

export const TRANSLATIONS: Record<Lang, Translations> = {
  en: {
    header: {
      signIn: "Sign In",
      getStarted: "Get Started",
      workspace: "Workspace",
    },
    footer: {
      privacy: "Privacy",
      terms: "Terms",
      methodology: "Method",
      roadmap: "Roadmap",
      copyright: "© 2026 IntentLead AI. All rights reserved.",
    },
  },
  ru: {
    header: {
      signIn: "Войти",
      getStarted: "Начать",
      workspace: "Кабинет",
    },
    footer: {
      privacy: "Конфиденциальность",
      terms: "Условия",
      methodology: "Метод",
      roadmap: "План развития",
      copyright: "© 2026 IntentLead AI. Все права защищены.",
    },
  },
};
