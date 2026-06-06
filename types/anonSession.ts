export interface AnonSessionMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AnonSessionIntake {
  what_selling?: string;
  icp?: string;
  pain?: string;
  geo?: string;
  keywords?: string[];
  tone?: string;
}

export interface AnonSession {
  messages: AnonSessionMessage[];
  intake: AnonSessionIntake;
  createdAt: string;
}

export const ANON_SESSION_KEY = "il_anon_session";
