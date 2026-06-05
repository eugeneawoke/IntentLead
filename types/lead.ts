export type LeadStatus = 'processing' | 'verified' | 'rejected';
export type IntentType = 'pain' | 'recommendation_request' | 'comparison' | 'hiring';
export type EmailProvider = 'prospeo' | 'hunter' | 'apollo';

export interface Lead {
  id: string;
  campaign_id: string;
  signal_id: string;
  intent_score: number | null;
  intent_type: IntentType | null;
  company_name: string | null;
  company_domain: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_linkedin: string | null;
  email: string | null;
  email_provider: EmailProvider | null;
  why_now: string | null;
  opening_line: string | null;
  verify_signal: boolean;
  verify_company: boolean;
  verify_contact: boolean;
  verify_email: boolean;
  status: LeadStatus;
  reject_reason: string | null;
  credit_charged: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadWithMessage extends Lead {
  message?: {
    id: string;
    subject: string | null;
    body: string;
    generation_failed: boolean;
    generated_at: string;
  } | null;
}
