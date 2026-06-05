export type SignalSource = 'reddit' | 'hackernews';

export interface Signal {
  id: string;
  campaign_id: string;
  source: SignalSource;
  source_url: string;
  author_handle: string;
  content: string;
  context: string | null;
  posted_at: string | null;
  created_at: string;
}

export interface CreateSignalInput {
  campaign_id: string;
  source: SignalSource;
  source_url: string;
  author_handle: string;
  content: string;
  context?: string;
  posted_at?: string;
}
