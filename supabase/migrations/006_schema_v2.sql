-- supabase/migrations/006_schema_v2.sql

-- 1. workspaces: chat message counters for Plan/Strategy rate limiting
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS chat_messages_today int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chat_messages_reset_at timestamptz NULL;

-- 2. campaigns: business_type for signal source selection
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS business_type text NULL
  CONSTRAINT campaigns_business_type_check
  CHECK (business_type IN ('online_saas','local','b2b_enterprise','ecommerce'));

-- 3. signals.source: expand to full source list
--    PostgreSQL requires DROP + ADD for CHECK constraints
ALTER TABLE signals DROP CONSTRAINT IF EXISTS signals_source_check;
ALTER TABLE signals
  ADD CONSTRAINT signals_source_check
  CHECK (source IN (
    'reddit','hackernews','github','stackoverflow',
    'vk','telegram','habr','vcru',
    'google_reviews','yelp','2gis','yandex_business','foursquare',
    'g2','capterra','producthunt','saashub','trustpilot',
    'greenhouse_jobs','crunchbase','linkedin'
  ));
