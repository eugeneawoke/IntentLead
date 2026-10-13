-- workspaces
CREATE TABLE workspaces (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','starter','growth','agency','starter_ltd','growth_ltd')),
  credits_remaining int NOT NULL DEFAULT 10,
  free_converter_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- workspace_members
CREATE TABLE workspace_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- campaigns
CREATE TABLE campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entry_mode text NOT NULL CHECK (entry_mode IN ('cold','warm')),
  glook_scan_id uuid NULL,
  what_selling text NOT NULL DEFAULT '',
  icp text NOT NULL DEFAULT '',
  pain text NOT NULL DEFAULT '',
  geo text NULL,
  example_customers text NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  tone text NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','done','error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- signals
CREATE TABLE signals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('reddit','hackernews')),
  source_url text NOT NULL,
  author_handle text NOT NULL,
  content text NOT NULL,
  context text NULL,
  posted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, source_url)
);

CREATE INDEX idx_signals_campaign ON signals(campaign_id);

-- leads
CREATE TABLE leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  signal_id uuid NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  intent_score int NULL CHECK (intent_score >= 0 AND intent_score <= 100),
  intent_type text NULL CHECK (intent_type IN ('pain','recommendation_request','comparison','hiring')),
  company_name text NULL,
  company_domain text NULL,
  contact_name text NULL,
  contact_role text NULL,
  contact_linkedin text NULL,
  email text NULL,
  email_provider text NULL CHECK (email_provider IN ('prospeo','hunter','apollo')),
  why_now text NULL,
  opening_line text NULL,
  verify_signal boolean NOT NULL DEFAULT false,
  verify_company boolean NOT NULL DEFAULT false,
  verify_contact boolean NOT NULL DEFAULT false,
  verify_email boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','verified','rejected')),
  reject_reason text NULL,
  credit_charged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_campaign_status ON leads(campaign_id, status);
CREATE INDEX idx_leads_campaign_score ON leads(campaign_id, intent_score DESC);

-- messages
CREATE TABLE messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE UNIQUE,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','dm')),
  subject text NULL,
  body text NOT NULL,
  generation_failed boolean NOT NULL DEFAULT false,
  generated_at timestamptz NOT NULL DEFAULT now()
);

-- client_context_chunks (RAG)
CREATE TABLE client_context_chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('chat','glook_report','manual')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- conversations
CREATE TABLE conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NULL REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- conversation_messages
CREATE TABLE conversation_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
