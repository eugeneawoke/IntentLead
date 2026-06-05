export type CampaignStatus = 'draft' | 'running' | 'done' | 'error';
export type EntryMode = 'cold' | 'warm';
export type WorkspacePlan = 'free' | 'starter' | 'growth' | 'agency' | 'starter_ltd' | 'growth_ltd';

export interface Campaign {
  id: string;
  workspace_id: string;
  entry_mode: EntryMode;
  glook_scan_id: string | null;
  what_selling: string;
  icp: string;
  pain: string;
  geo: string | null;
  example_customers: string | null;
  keywords: string[];
  tone: string | null;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignInput {
  workspace_id: string;
  entry_mode: EntryMode;
  glook_scan_id?: string;
  what_selling: string;
  icp: string;
  pain: string;
  geo?: string;
  example_customers?: string;
  keywords?: string[];
  tone?: string;
}

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  plan: WorkspacePlan;
  credits_remaining: number;
  free_converter_used: boolean;
  created_at: string;
  updated_at: string;
}
