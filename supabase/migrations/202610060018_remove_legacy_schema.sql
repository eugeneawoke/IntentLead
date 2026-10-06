-- Task E: remove the retired lead/outreach schema and leave a discovery-only
-- Opportunity Core. This migration is intentionally forward-only; rollback is
-- database restore, never recreation of the removed product graph.

-- Reconcile values while the historical constraints and columns still exist.
-- Drop the historical state checks first: their old enum rejects the canonical
-- replacement values used by the reconciliation update itself.
ALTER TABLE public.intentlead_opportunities
  DISABLE TRIGGER intentlead_opportunity_requires_evidence;
ALTER TABLE public.intentlead_opportunities
  DISABLE TRIGGER intentlead_opportunity_snapshot_valid;
ALTER TABLE public.intentlead_opportunities
  DROP CONSTRAINT IF EXISTS intentlead_opportunities_state_check,
  DROP CONSTRAINT IF EXISTS intentlead_opportunities_check;

UPDATE public.intentlead_opportunities
SET state = CASE state
  WHEN 'ENRICHING' THEN 'EVIDENCE_PENDING'
  WHEN 'PACKAGE_READY' THEN 'HUMAN_REVIEW'
  WHEN 'OUTREACH_READY' THEN 'ARCHIVED'
  WHEN 'CONTACTED' THEN 'ARCHIVED'
  WHEN 'REPLIED' THEN 'ARCHIVED'
  WHEN 'NO_REPLY' THEN 'ARCHIVED'
  WHEN 'OPTED_OUT' THEN 'ARCHIVED'
  WHEN 'POSITIVE_REPLY' THEN 'ARCHIVED'
  WHEN 'NEGATIVE_REPLY' THEN 'ARCHIVED'
  WHEN 'MEETING' THEN 'ARCHIVED'
  WHEN 'SALES_OPPORTUNITY' THEN 'ARCHIVED'
  WHEN 'CUSTOMER' THEN 'ARCHIVED'
  WHEN 'CLOSED' THEN 'ARCHIVED'
  ELSE state
END
WHERE state IN (
  'ENRICHING','PACKAGE_READY','OUTREACH_READY','CONTACTED','REPLIED','NO_REPLY','OPTED_OUT',
  'POSITIVE_REPLY','NEGATIVE_REPLY','MEETING','SALES_OPPORTUNITY','CUSTOMER','CLOSED'
);

UPDATE public.intentlead_market_profiles
SET workflow = 'DISCOVERY_ONLY',
    capabilities = ARRAY(
      SELECT value FROM unnest(capabilities) AS value
      WHERE value = ANY(ARRAY[
        'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW'
      ]::text[])
    ),
    disabled_capabilities = ARRAY(
      SELECT value FROM unnest(disabled_capabilities) AS value
      WHERE value = ANY(ARRAY[
        'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW'
      ]::text[])
    );

-- Active read/job RPCs are recreated without the campaign bridge before its FK
-- and column are removed.
CREATE OR REPLACE FUNCTION public.intentlead_discovery_context(p_discovery_brief_id uuid)
RETURNS TABLE(
  discovery_brief_id uuid, workspace_id uuid, profile_key text, workflow text,
  configuration jsonb, capabilities text[], disabled_capabilities text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT b.id,b.workspace_id,m.profile_key,m.workflow,m.configuration,m.capabilities,m.disabled_capabilities
  FROM public.intentlead_discovery_briefs b
  JOIN public.intentlead_market_profiles m ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
  JOIN public.workspaces w ON w.id=b.workspace_id
  WHERE b.id=p_discovery_brief_id AND b.deleted_at IS NULL AND w.owner_id=auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.intentlead_list_discovery_briefs() RETURNS SETOF jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'id',b.id,'state',b.state,'objective',b.objective,'criteria',b.criteria,
    'offer',jsonb_build_object('id',o.id,'name',o.name,'definition',o.definition),
    'icp',jsonb_build_object('id',i.id,'name',i.name,'definition',i.definition),
    'createdAt',b.created_at,'updatedAt',b.updated_at
  )
  FROM public.intentlead_discovery_briefs b
  JOIN public.intentlead_offer_profiles o ON o.id=b.offer_profile_id AND o.workspace_id=b.workspace_id
  JOIN public.intentlead_icp_definitions i ON i.id=b.icp_definition_id AND i.workspace_id=b.workspace_id
  JOIN public.workspaces w ON w.id=b.workspace_id
  WHERE b.deleted_at IS NULL AND w.owner_id=auth.uid()
  ORDER BY b.created_at DESC,b.id DESC
$$;

CREATE OR REPLACE FUNCTION public.intentlead_enqueue_discovery_job(
  p_discovery_brief_id uuid,p_user_id uuid,p_idempotency_key text,p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_brief public.intentlead_discovery_briefs%ROWTYPE;
  v_job public.intentlead_jobs%ROWTYPE;
  v_input_hash text;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key)=''
    OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
  THEN RAISE EXCEPTION 'invalid_enqueue_input'; END IF;
  v_input_hash := md5(p_discovery_brief_id::text || E'\nSOURCE_SEARCH\nOPPORTUNITY_DISCOVERY\n' || p_payload::text);
  SELECT b.* INTO v_brief FROM public.intentlead_discovery_briefs b
  JOIN public.workspaces w ON w.id=b.workspace_id
  JOIN public.intentlead_market_profiles m ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
  WHERE b.id=p_discovery_brief_id AND b.deleted_at IS NULL AND w.owner_id=p_user_id
    AND m.workflow='DISCOVERY_ONLY' AND m.profile_key='EN_DISCOVERY_ONLY'
    AND m.capabilities @> ARRAY['SOURCE_SEARCH']::text[]
  FOR UPDATE OF b,w,m;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_job FROM public.intentlead_jobs
  WHERE workspace_id=v_brief.workspace_id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_job.discovery_brief_id IS DISTINCT FROM p_discovery_brief_id
      OR v_job.capability<>'SOURCE_SEARCH' OR v_job.job_type<>'OPPORTUNITY_DISCOVERY'
      OR v_job.input_hash<>v_input_hash
    THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN v_job.id;
  END IF;
  IF v_brief.state<>'DRAFT' THEN RAISE EXCEPTION 'brief_transition_denied'; END IF;
  INSERT INTO public.intentlead_jobs(
    workspace_id,discovery_brief_id,market_profile_key,capability,job_type,payload,idempotency_key,input_hash
  ) VALUES (
    v_brief.workspace_id,v_brief.id,'EN_DISCOVERY_ONLY','SOURCE_SEARCH','OPPORTUNITY_DISCOVERY',
    p_payload,p_idempotency_key,v_input_hash
  ) RETURNING * INTO v_job;
  UPDATE public.intentlead_discovery_briefs SET state='QUEUED' WHERE id=v_brief.id;
  RETURN v_job.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_sync_job_terminal_state(
  p_workspace_id uuid,p_discovery_brief_id uuid,p_terminal_state text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_brief_state text;
BEGIN
  v_brief_state := CASE
    WHEN p_terminal_state IN ('COMPLETED','PARTIAL') THEN 'COMPLETED'
    WHEN p_terminal_state='FAILED' THEN 'FAILED'
    WHEN p_terminal_state='CANCELLED' THEN 'CANCELLED'
    ELSE NULL
  END;
  IF v_brief_state IS NULL THEN RAISE EXCEPTION 'invalid_terminal_state'; END IF;
  UPDATE public.intentlead_discovery_briefs SET state=v_brief_state,updated_at=clock_timestamp()
  WHERE id=p_discovery_brief_id AND workspace_id=p_workspace_id
    AND (state IN ('DRAFT','QUEUED','RUNNING') OR state=v_brief_state);
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_get_self_prospecting_context(
  p_job_id uuid,p_worker_id text,p_lease_token uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_job public.intentlead_jobs%ROWTYPE;
  v_brief public.intentlead_discovery_briefs%ROWTYPE;
  v_market public.intentlead_market_profiles%ROWTYPE;
  v_offer public.intentlead_offer_profiles%ROWTYPE;
  v_icp public.intentlead_icp_definitions%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.intentlead_jobs
  WHERE id=p_job_id AND lease_owner=p_worker_id AND lease_token=p_lease_token
    AND state IN ('LEASED','RUNNING') AND lease_expires_at>clock_timestamp()
    AND market_profile_key='EN_DISCOVERY_ONLY' AND capability='SOURCE_SEARCH'
    AND job_type='OPPORTUNITY_DISCOVERY';
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_active_lease'; END IF;
  SELECT b.* INTO v_brief
  FROM public.intentlead_discovery_briefs b
  JOIN public.intentlead_market_profiles m ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
  WHERE b.id=v_job.discovery_brief_id AND b.workspace_id=v_job.workspace_id
    AND b.deleted_at IS NULL AND m.profile_key='EN_DISCOVERY_ONLY' AND m.workflow='DISCOVERY_ONLY'
    AND m.capabilities @> ARRAY[
      'SOURCE_SEARCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW'
    ]::text[];
  IF NOT FOUND THEN RAISE EXCEPTION 'job_discovery_context_invalid'; END IF;
  SELECT * INTO STRICT v_market FROM public.intentlead_market_profiles
  WHERE id=v_brief.market_profile_id AND workspace_id=v_brief.workspace_id;
  SELECT * INTO v_offer FROM public.intentlead_offer_profiles
  WHERE id=v_brief.offer_profile_id AND workspace_id=v_brief.workspace_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_offer_context_invalid'; END IF;
  SELECT * INTO v_icp FROM public.intentlead_icp_definitions
  WHERE id=v_brief.icp_definition_id AND workspace_id=v_brief.workspace_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_icp_context_invalid'; END IF;
  RETURN jsonb_build_object(
    'profile',jsonb_build_object(
      'schemaVersion',1,'id',v_market.profile_key,'workspaceId',v_market.workspace_id,
      'workflow',v_market.workflow,'jurisdictions',v_market.configuration->'jurisdictions',
      'regions',v_market.configuration->'regions','languages',v_market.configuration->'languages',
      'capabilities',to_jsonb(v_market.capabilities),'disabledCapabilities',to_jsonb(v_market.disabled_capabilities),
      'legalPolicyId',v_market.configuration->'legalPolicyId',
      'retentionPolicyId',v_market.configuration->'retentionPolicyId',
      'defaultCurrency',v_market.configuration->'defaultCurrency','timezone',v_market.configuration->'timezone'
    ),
    'brief',jsonb_build_object(
      'schemaVersion',1,'id',v_brief.id,'workspaceId',v_brief.workspace_id,
      'offerProfileId',v_brief.offer_profile_id,'icpDefinitionId',v_brief.icp_definition_id,
      'marketProfileId',v_market.profile_key,'objective',v_brief.objective,
      'jurisdictions',v_brief.criteria->'jurisdictions','languages',v_brief.criteria->'languages',
      'signalFamilies',v_brief.criteria->'signalFamilies','exclusions',v_brief.criteria->'exclusions',
      'limits',v_brief.criteria->'limits','createdAt',v_brief.created_at
    ),
    'offer',jsonb_build_object('id',v_offer.id,'name',v_offer.name,'definition',v_offer.definition),
    'icp',jsonb_build_object('id',v_icp.id,'name',v_icp.name,'definition',v_icp.definition)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.intentlead_discovery_context(uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.intentlead_list_discovery_briefs() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.intentlead_discovery_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_list_discovery_briefs() TO authenticated;
REVOKE ALL ON FUNCTION public.intentlead_enqueue_discovery_job(uuid,uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_enqueue_discovery_job(uuid,uuid,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.intentlead_sync_job_terminal_state(uuid,uuid,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.intentlead_get_self_prospecting_context(uuid,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_get_self_prospecting_context(uuid,text,uuid) TO service_role;

-- Canonical SQL enums/sets. All rows were reconciled above.
ALTER TABLE public.intentlead_opportunities
  DROP CONSTRAINT IF EXISTS intentlead_opportunities_state_check,
  DROP CONSTRAINT IF EXISTS intentlead_opportunities_check;
ALTER TABLE public.intentlead_opportunities
  ADD CONSTRAINT intentlead_opportunities_state_check CHECK (state IN (
    'DISCOVERED','EVIDENCE_PENDING','ASSESSABLE','INSUFFICIENT_EVIDENCE',
    'MODEL_QUALIFIED','MODEL_REVIEW','MODEL_REJECTED','HUMAN_REVIEW',
    'ACCEPTED','REJECTED','NEEDS_RESEARCH','ARCHIVED'
  ));
ALTER TABLE public.intentlead_job_candidate_results
  DROP CONSTRAINT IF EXISTS intentlead_job_candidate_results_opportunity_state_check;
ALTER TABLE public.intentlead_job_candidate_results
  ADD CONSTRAINT intentlead_job_candidate_results_opportunity_state_check CHECK (
    opportunity_state IN (
      'MODEL_QUALIFIED','HUMAN_REVIEW','MODEL_REJECTED','INSUFFICIENT_EVIDENCE'
    )
  );

ALTER TABLE public.intentlead_market_profiles
  DROP CONSTRAINT IF EXISTS intentlead_market_profiles_workflow_check,
  DROP CONSTRAINT IF EXISTS intentlead_market_profiles_check,
  DROP CONSTRAINT IF EXISTS intentlead_market_capabilities_known_check,
  DROP CONSTRAINT IF EXISTS intentlead_market_discovery_capabilities_check;
ALTER TABLE public.intentlead_market_profiles
  ADD CONSTRAINT intentlead_market_profiles_workflow_check CHECK (workflow='DISCOVERY_ONLY'),
  ADD CONSTRAINT intentlead_market_capabilities_known_check CHECK (
    capabilities <@ ARRAY[
      'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW'
    ]::text[]
    AND disabled_capabilities <@ ARRAY[
      'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW'
    ]::text[]
    AND NOT capabilities && disabled_capabilities
  );

-- The historical trigger encoded the retired outreach-era state machine. Keep
-- its reference checks, but align the snapshot contract with Opportunity Core.
CREATE OR REPLACE FUNCTION public.intentlead_validate_opportunity_snapshot()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_assessment_opportunity uuid; v_market_profile_key text;
BEGIN
  IF NEW.tombstoned_at IS NOT NULL THEN RETURN NULL; END IF;
  SELECT m.profile_key INTO v_market_profile_key
  FROM public.intentlead_discovery_briefs b
  JOIN public.intentlead_market_profiles m
    ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
  WHERE b.id=NEW.discovery_brief_id AND b.workspace_id=NEW.workspace_id;
  IF v_market_profile_key IS NULL THEN
    RAISE EXCEPTION 'opportunity_market_profile_missing';
  END IF;
  IF NEW.state NOT IN (
    'DISCOVERED','EVIDENCE_PENDING','ASSESSABLE','INSUFFICIENT_EVIDENCE',
    'MODEL_QUALIFIED','MODEL_REVIEW','MODEL_REJECTED','HUMAN_REVIEW',
    'ACCEPTED','REJECTED','NEEDS_RESEARCH','ARCHIVED'
  ) THEN
    RAISE EXCEPTION 'discovery_opportunity_state_denied';
  END IF;
  IF NEW.state IN ('DISCOVERED','EVIDENCE_PENDING','INSUFFICIENT_EVIDENCE') THEN
    IF NEW.current_assessment_id IS NOT NULL THEN
      RAISE EXCEPTION 'incomplete_opportunity_has_assessment';
    END IF;
  ELSIF NEW.state='ASSESSABLE' THEN
    IF NEW.company_id IS NULL OR NEW.current_assessment_id IS NOT NULL THEN
      RAISE EXCEPTION 'assessable_opportunity_reference_invalid';
    END IF;
  ELSIF NEW.company_id IS NULL OR NEW.current_assessment_id IS NULL THEN
    RAISE EXCEPTION 'assessed_opportunity_references_required';
  END IF;
  IF NEW.current_assessment_id IS NOT NULL THEN
    SELECT opportunity_id INTO v_assessment_opportunity
    FROM public.intentlead_opportunity_assessments
    WHERE id=NEW.current_assessment_id AND workspace_id=NEW.workspace_id;
    IF v_assessment_opportunity IS DISTINCT FROM NEW.id THEN
      RAISE EXCEPTION 'assessment_opportunity_mismatch';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_validate_opportunity_snapshot()
  FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.intentlead_opportunities
  ENABLE TRIGGER intentlead_opportunity_requires_evidence;
ALTER TABLE public.intentlead_opportunities
  ENABLE TRIGGER intentlead_opportunity_snapshot_valid;

CREATE OR REPLACE FUNCTION public.intentlead_create_discovery_brief(
  p_command jsonb,p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid:=auth.uid();
  v_workspace_id uuid;
  v_existing public.intentlead_discovery_briefs%ROWTYPE;
  v_offer_id uuid; v_icp_id uuid; v_market_id uuid; v_brief_id uuid;
  v_offer_version integer; v_icp_version integer; v_market_version integer;
  v_fingerprint text;
  v_capabilities text[]:=ARRAY[
    'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW'
  ]::text[];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='28000'; END IF;
  IF p_idempotency_key IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{12,128}$'
    OR p_command IS NULL OR jsonb_typeof(p_command)<>'object'
    OR p_command->>'schemaVersion' IS DISTINCT FROM '1'
    OR jsonb_typeof(p_command->'offer') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_command->'icp') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_command->'criteria') IS DISTINCT FROM 'object'
    OR length(btrim(coalesce(p_command#>>'{offer,name}',''))) NOT BETWEEN 1 AND 120
    OR length(btrim(coalesce(p_command#>>'{offer,summary}',''))) NOT BETWEEN 1 AND 500
    OR length(btrim(coalesce(p_command#>>'{icp,name}',''))) NOT BETWEEN 1 AND 120
    OR length(btrim(coalesce(p_command#>>'{icp,description}',''))) NOT BETWEEN 1 AND 500
    OR length(btrim(coalesce(p_command->>'objective',''))) NOT BETWEEN 1 AND 500
    OR jsonb_typeof(p_command#>'{offer,outcomes}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command#>'{offer,outcomes}')>20
    OR jsonb_typeof(p_command#>'{offer,exclusions}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command#>'{offer,exclusions}')>20
    OR jsonb_typeof(p_command#>'{icp,companyAttributes}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command#>'{icp,companyAttributes}')>30
    OR jsonb_typeof(p_command#>'{icp,exclusions}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command#>'{icp,exclusions}')>20
    OR jsonb_typeof(p_command#>'{criteria,jurisdictions}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command#>'{criteria,jurisdictions}')>30
    OR jsonb_typeof(p_command#>'{criteria,languages}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command#>'{criteria,languages}') NOT BETWEEN 1 AND 10
    OR jsonb_typeof(p_command#>'{criteria,signalFamilies}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command#>'{criteria,signalFamilies}') NOT BETWEEN 1 AND 4
    OR jsonb_typeof(p_command#>'{criteria,exclusions}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command#>'{criteria,exclusions}')>30
    OR jsonb_typeof(p_command#>'{criteria,limits}') IS DISTINCT FROM 'object'
    OR coalesce(p_command#>>'{criteria,limits,maxSourceItems}','') !~ '^[0-9]+$'
    OR coalesce(p_command#>>'{criteria,limits,maxOpportunities}','') !~ '^[0-9]+$'
    OR (p_command#>>'{criteria,limits,maxSourceItems}')::integer NOT BETWEEN 1 AND 500
    OR (p_command#>>'{criteria,limits,maxOpportunities}')::integer NOT BETWEEN 1 AND 100
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_command#>'{criteria,signalFamilies}') value
      WHERE jsonb_typeof(value)<>'string' OR value#>>'{}' NOT IN (
        'EXPRESSED_INTENT','BUSINESS_EVENT','DETECTED_PROBLEM','MARKET_OBSERVATION'
      )
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_command#>'{criteria,languages}') value
      WHERE jsonb_typeof(value)<>'string'
        OR value#>>'{}' !~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        (p_command#>'{offer,outcomes}')||(p_command#>'{offer,exclusions}')
        ||(p_command#>'{icp,companyAttributes}')||(p_command#>'{icp,exclusions}')
        ||(p_command#>'{criteria,exclusions}')
      ) value
      WHERE jsonb_typeof(value)<>'string'
        OR length(btrim(value#>>'{}')) NOT BETWEEN 1 AND 500
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_command#>'{criteria,jurisdictions}') value
      WHERE jsonb_typeof(value)<>'object'
        OR coalesce(value->>'countryCode','') !~ '^[A-Z]{2}$'
        OR value-'countryCode'-'subdivisionCode'<>'{}'::jsonb
        OR NOT value?'subdivisionCode'
        OR jsonb_typeof(value->'subdivisionCode') NOT IN ('string','null')
        OR (jsonb_typeof(value->'subdivisionCode')='string'
          AND length(btrim(value->>'subdivisionCode')) NOT BETWEEN 1 AND 20)
    )
  THEN RAISE EXCEPTION 'invalid_discovery_command' USING ERRCODE='22023'; END IF;

  v_fingerprint:=md5(p_command::text);
  PERFORM pg_advisory_xact_lock(hashtextextended('intentlead-native-discovery:'||v_user_id::text,0));
  SELECT id INTO v_workspace_id FROM public.workspaces
  WHERE owner_id=v_user_id ORDER BY created_at,id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.workspaces(owner_id,name)
    VALUES (v_user_id,'My Workspace') RETURNING id INTO v_workspace_id;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('intentlead-workspace:'||v_workspace_id::text,0));
  SELECT * INTO v_existing FROM public.intentlead_discovery_briefs
  WHERE workspace_id=v_workspace_id AND creation_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.creation_fingerprint<>v_fingerprint
    THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='40001'; END IF;
    RETURN jsonb_build_object(
      'discoveryBriefId',v_existing.id,'workspaceId',v_existing.workspace_id,
      'offerProfileId',v_existing.offer_profile_id,'icpDefinitionId',v_existing.icp_definition_id,
      'marketProfileId',v_existing.market_profile_id,'created',false
    );
  END IF;

  SELECT coalesce(max(version),0)+1 INTO v_offer_version
  FROM public.intentlead_offer_profiles
  WHERE workspace_id=v_workspace_id AND name=btrim(p_command#>>'{offer,name}');
  INSERT INTO public.intentlead_offer_profiles(workspace_id,version,name,definition)
  VALUES (
    v_workspace_id,v_offer_version,btrim(p_command#>>'{offer,name}'),jsonb_build_object(
      'summary',btrim(p_command#>>'{offer,summary}'),
      'outcomes',p_command#>'{offer,outcomes}','exclusions',p_command#>'{offer,exclusions}'
    )
  ) RETURNING id INTO v_offer_id;
  SELECT coalesce(max(version),0)+1 INTO v_icp_version
  FROM public.intentlead_icp_definitions
  WHERE workspace_id=v_workspace_id AND name=btrim(p_command#>>'{icp,name}');
  INSERT INTO public.intentlead_icp_definitions(workspace_id,version,name,definition)
  VALUES (
    v_workspace_id,v_icp_version,btrim(p_command#>>'{icp,name}'),jsonb_build_object(
      'description',btrim(p_command#>>'{icp,description}'),
      'companyAttributes',p_command#>'{icp,companyAttributes}',
      'exclusions',p_command#>'{icp,exclusions}'
    )
  ) RETURNING id INTO v_icp_id;
  SELECT coalesce(max(version),0)+1 INTO v_market_version
  FROM public.intentlead_market_profiles
  WHERE workspace_id=v_workspace_id AND profile_key='EN_DISCOVERY_ONLY';
  INSERT INTO public.intentlead_market_profiles(
    workspace_id,version,profile_key,workflow,configuration,capabilities,disabled_capabilities
  ) VALUES (
    v_workspace_id,v_market_version,'EN_DISCOVERY_ONLY','DISCOVERY_ONLY',jsonb_build_object(
      'jurisdictions',p_command#>'{criteria,jurisdictions}','regions','[]'::jsonb,
      'languages',p_command#>'{criteria,languages}',
      'legalPolicyId','en-discovery-legal-v1',
      'retentionPolicyId','en-discovery-retention-v1',
      'defaultCurrency','USD','timezone','UTC'
    ),v_capabilities,'{}'::text[]
  ) RETURNING id INTO v_market_id;
  INSERT INTO public.intentlead_discovery_briefs(
    workspace_id,offer_profile_id,icp_definition_id,market_profile_id,objective,criteria,
    creation_key,creation_fingerprint
  ) VALUES (
    v_workspace_id,v_offer_id,v_icp_id,v_market_id,btrim(p_command->>'objective'),jsonb_build_object(
      'jurisdictions',p_command#>'{criteria,jurisdictions}',
      'languages',p_command#>'{criteria,languages}',
      'signalFamilies',p_command#>'{criteria,signalFamilies}',
      'exclusions',p_command#>'{criteria,exclusions}',
      'limits',p_command#>'{criteria,limits}'
    ),p_idempotency_key,v_fingerprint
  ) RETURNING id INTO v_brief_id;
  RETURN jsonb_build_object(
    'discoveryBriefId',v_brief_id,'workspaceId',v_workspace_id,
    'offerProfileId',v_offer_id,'icpDefinitionId',v_icp_id,
    'marketProfileId',v_market_id,'created',true
  );
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_create_discovery_brief(jsonb,text)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.intentlead_create_discovery_brief(jsonb,text) TO authenticated;

ALTER TABLE public.intentlead_jobs DROP CONSTRAINT IF EXISTS intentlead_jobs_capability_check;
ALTER TABLE public.intentlead_jobs ADD CONSTRAINT intentlead_jobs_capability_check CHECK (capability IN (
  'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW'
));

CREATE OR REPLACE FUNCTION public.intentlead_valid_capability_error(p_value jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT jsonb_typeof(p_value)='object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_value) key
      WHERE key<>ALL(ARRAY['schemaVersion','message','capability','traceId','retryable','code','retryAfterMs'])
    )
    AND p_value ?& ARRAY['schemaVersion','message','capability','traceId','retryable','code','retryAfterMs']
    AND p_value->>'schemaVersion'='1'
    AND jsonb_typeof(p_value->'message')='string' AND btrim(p_value->>'message')<>''
    AND p_value->>'capability' IN (
      'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW'
    )
    AND jsonb_typeof(p_value->'traceId')='string' AND btrim(p_value->>'traceId')<>''
    AND jsonb_typeof(p_value->'retryable')='boolean'
    AND (
      (p_value->>'retryable'='true'
        AND p_value->>'code' IN ('RATE_LIMITED','TIMEOUT','DEPENDENCY_UNAVAILABLE')
        AND jsonb_typeof(p_value->'retryAfterMs') IN ('number','null')
        AND (jsonb_typeof(p_value->'retryAfterMs')='null' OR (p_value->>'retryAfterMs')::numeric>=0))
      OR (p_value->>'retryable'='false'
        AND p_value->>'code' IN ('INVALID_INPUT','UNAUTHENTICATED','FORBIDDEN','NOT_FOUND','POLICY_DENIED',
          'CAPABILITY_UNAVAILABLE','BUDGET_EXCEEDED','CONFLICT','INTERNAL_ERROR')
        AND jsonb_typeof(p_value->'retryAfterMs')='null')
    )
$$;

CREATE OR REPLACE FUNCTION public.intentlead_record_opportunity_review(
  p_opportunity_id uuid,p_decision text,p_reason text,p_note text,p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_workspace uuid;
  v_opportunity public.intentlead_opportunities%ROWTYPE;
  v_existing public.intentlead_human_reviews%ROWTYPE;
  v_note text:=nullif(btrim(p_note),'');
  v_fingerprint text;
  v_reviewed_at timestamptz;
  v_state text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='28000'; END IF;
  IF p_opportunity_id IS NULL OR p_idempotency_key IS NULL
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{12,128}$'
    OR p_decision NOT IN ('ACCEPTED','REJECTED','NEEDS_RESEARCH')
    OR p_reason IS NULL OR length(p_reason)>80
  THEN RAISE EXCEPTION 'invalid_review_command' USING ERRCODE='22023'; END IF;
  IF (p_decision='ACCEPTED' AND p_reason<>'RELEVANT')
    OR (p_decision<>'ACCEPTED' AND p_reason NOT IN (
      'WRONG_COMPANY','WEAK_SIGNAL','NOT_RELEVANT','TOO_OLD','ALREADY_SOLVED',
      'DUPLICATE','POLICY_CONCERN','OTHER'
    )) OR (p_reason='OTHER' AND v_note IS NULL)
  THEN RAISE EXCEPTION 'invalid_review_reason' USING ERRCODE='22023'; END IF;
  IF p_note IS NOT NULL AND (
    length(v_note)>500 OR NOT public.intentlead_review_text_is_safe(v_note,500)
  ) THEN RAISE EXCEPTION 'invalid_review_note' USING ERRCODE='22023'; END IF;

  SELECT o.workspace_id INTO v_workspace FROM public.intentlead_opportunities o
  WHERE o.id=p_opportunity_id AND public.intentlead_is_workspace_member(o.workspace_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'opportunity_not_found' USING ERRCODE='P0002'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('intentlead-workspace:'||v_workspace::text,0));
  SELECT o.* INTO v_opportunity FROM public.intentlead_opportunities o
  JOIN public.intentlead_discovery_briefs b
    ON b.id=o.discovery_brief_id AND b.workspace_id=o.workspace_id
  JOIN public.intentlead_market_profiles m
    ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
  WHERE o.id=p_opportunity_id AND o.workspace_id=v_workspace AND o.tombstoned_at IS NULL
    AND b.deleted_at IS NULL AND m.profile_key='EN_DISCOVERY_ONLY'
    AND m.workflow='DISCOVERY_ONLY' AND m.capabilities @> ARRAY['HUMAN_REVIEW']::text[]
    AND public.intentlead_is_workspace_member(o.workspace_id)
  FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'opportunity_not_found' USING ERRCODE='P0002'; END IF;

  v_fingerprint:=jsonb_build_object(
    'decision',p_decision,'reason',p_reason,'note',v_note
  )::text;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_workspace::text||':'||p_idempotency_key,0));
  SELECT * INTO v_existing FROM public.intentlead_human_reviews
  WHERE workspace_id=v_workspace AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_existing.tombstoned_at IS NOT NULL OR v_existing.opportunity_id<>p_opportunity_id
      OR v_existing.request_fingerprint<>v_fingerprint
    THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='40001'; END IF;
    RETURN jsonb_build_object(
      'opportunityId',p_opportunity_id,'state',v_existing.decision,
      'decision',v_existing.decision,'reason',v_existing.reason,
      'reviewedAt',v_existing.reviewed_at,'replayed',true
    );
  END IF;
  IF v_opportunity.state<>'HUMAN_REVIEW' OR EXISTS (
    SELECT 1 FROM public.intentlead_human_reviews
    WHERE workspace_id=v_workspace AND opportunity_id=p_opportunity_id AND tombstoned_at IS NULL
  ) THEN RAISE EXCEPTION 'stale_opportunity' USING ERRCODE='40001'; END IF;

  v_reviewed_at:=clock_timestamp();
  INSERT INTO public.intentlead_human_reviews(
    workspace_id,opportunity_id,reviewer_id,decision,reason,note,reviewed_at,
    idempotency_key,request_fingerprint
  ) VALUES (
    v_workspace,p_opportunity_id,v_user,p_decision,p_reason,v_note,v_reviewed_at,
    p_idempotency_key,v_fingerprint
  );
  v_state:=p_decision;
  UPDATE public.intentlead_opportunities SET state=v_state
  WHERE id=p_opportunity_id AND workspace_id=v_workspace AND tombstoned_at IS NULL;
  RETURN jsonb_build_object(
    'opportunityId',p_opportunity_id,'state',v_state,'decision',p_decision,
    'reason',p_reason,'reviewedAt',v_reviewed_at,'replayed',false
  );
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_record_opportunity_review(uuid,text,text,text,text)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.intentlead_record_opportunity_review(uuid,text,text,text,text)
  TO authenticated;

-- Rebuild the review read model after canonical state/capability cleanup. The
-- private projection retains membership checks; the public RPCs retain their
-- narrow authenticated execution boundary.
CREATE OR REPLACE FUNCTION public.intentlead_build_opportunity_review_dto_unfiltered(
  p_opportunity_id uuid,p_include_evidence boolean
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row record;
  v_total integer;
  v_active integer;
  v_evidence jsonb:='[]'::jsonb;
  v_result jsonb;
BEGIN
  SELECT o.*,c.canonical_name AS company_name,c.domain AS company_domain,
    c.confidence AS company_confidence,a.decision AS assessment_decision,
    a.confidence AS assessment_confidence,a.evidence_strength,a.freshness,
    a.commercial_impact,a.icp_fit,a.actionability,a.problem_statement,
    latest.decision AS latest_decision,latest.reviewed_at AS latest_reviewed_at
  INTO v_row
  FROM public.intentlead_opportunities o
  JOIN public.intentlead_discovery_briefs b
    ON b.id=o.discovery_brief_id AND b.workspace_id=o.workspace_id
  JOIN public.intentlead_market_profiles m
    ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
  LEFT JOIN public.intentlead_companies c
    ON c.id=o.company_id AND c.workspace_id=o.workspace_id AND c.tombstoned_at IS NULL
  LEFT JOIN public.intentlead_opportunity_assessments a
    ON a.id=o.current_assessment_id AND a.workspace_id=o.workspace_id AND a.tombstoned_at IS NULL
  LEFT JOIN LATERAL (
    SELECT r.decision,r.reviewed_at FROM public.intentlead_human_reviews r
    WHERE r.workspace_id=o.workspace_id AND r.opportunity_id=o.id AND r.tombstoned_at IS NULL
    ORDER BY r.reviewed_at DESC,r.id DESC LIMIT 1
  ) latest ON true
  WHERE o.id=p_opportunity_id AND o.tombstoned_at IS NULL AND b.deleted_at IS NULL
    AND public.intentlead_is_workspace_member(o.workspace_id)
    AND o.state IN ('HUMAN_REVIEW','ACCEPTED','REJECTED','NEEDS_RESEARCH')
    AND m.profile_key='EN_DISCOVERY_ONLY' AND m.workflow='DISCOVERY_ONLY'
    AND m.capabilities @> ARRAY['HUMAN_REVIEW']::text[];
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT count(*),count(*) FILTER (
    WHERE oe.tombstoned_at IS NULL AND e.tombstoned_at IS NULL
  ) INTO v_total,v_active
  FROM public.intentlead_opportunity_evidence oe
  LEFT JOIN public.intentlead_evidence_items e
    ON e.id=oe.evidence_id AND e.workspace_id=oe.workspace_id
  WHERE oe.workspace_id=v_row.workspace_id AND oe.opportunity_id=v_row.id;

  v_result:=jsonb_build_object(
    'id',v_row.id,'state',v_row.state,'signal',v_row.signal,
    'company',CASE WHEN v_row.company_name IS NULL THEN NULL ELSE jsonb_build_object(
      'name',v_row.company_name,'domain',v_row.company_domain,'confidence',v_row.company_confidence
    ) END,
    'assessment',CASE WHEN v_row.assessment_decision IS NULL THEN NULL ELSE jsonb_build_object(
      'decision',v_row.assessment_decision,'confidence',v_row.assessment_confidence,
      'evidenceStrength',v_row.evidence_strength,'freshness',v_row.freshness,
      'commercialImpact',v_row.commercial_impact,'icpFit',v_row.icp_fit,
      'actionability',v_row.actionability,'problemStatement',v_row.problem_statement
    ) END,
    'evidenceCount',v_active,
    'evidenceStatus',CASE
      WHEN v_active=0 THEN 'MISSING' WHEN v_active<v_total THEN 'PARTIAL' ELSE 'COMPLETE'
    END,
    'latestReview',CASE WHEN v_row.latest_decision IS NULL THEN NULL ELSE jsonb_build_object(
      'decision',v_row.latest_decision,'reviewedAt',v_row.latest_reviewed_at
    ) END,
    'createdAt',v_row.created_at,'updatedAt',v_row.updated_at
  );

  IF p_include_evidence THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',e.id,'sourceUrl',e.source_url,
      'provider',coalesce(r.provider,s.provider,'unknown'),'capturedAt',e.captured_at,
      'confidence',e.confidence,'verificationMethod',e.verification_method,
      'contentHash',e.content_hash,
      'facts',jsonb_strip_nulls(jsonb_build_object(
        'companyName',e.structured_facts->>'companyName',
        'companyDomain',e.structured_facts->>'companyDomain',
        'employeeCount',e.structured_facts->'employeeCount',
        'technologies',e.structured_facts->'technologies',
        'location',e.structured_facts->'location',
        'problemCategory',e.structured_facts->'problem'->>'category',
        'problem',CASE WHEN jsonb_typeof(e.structured_facts->'problem')='object' THEN
          jsonb_strip_nulls(jsonb_build_object(
            'category',e.structured_facts->'problem'->>'category',
            'observedCondition',e.structured_facts->'problem'->>'observedCondition'
          )) END,
        'measurement',CASE WHEN e.structured_facts?'sourceMeasurement' THEN jsonb_build_object(
          'metric',e.structured_facts->'sourceMeasurement'->>'metric',
          'value',e.structured_facts->'sourceMeasurement'->'value',
          'observedAt',e.structured_facts->'sourceMeasurement'->'observedAt'
        ) END
      ))
    ) ORDER BY e.captured_at DESC,e.id),'[]'::jsonb)
    INTO v_evidence
    FROM public.intentlead_opportunity_evidence oe
    JOIN public.intentlead_evidence_items e
      ON e.id=oe.evidence_id AND e.workspace_id=oe.workspace_id
    LEFT JOIN public.intentlead_provider_runs r
      ON r.id=e.provider_run_id AND r.workspace_id=e.workspace_id
    LEFT JOIN public.intentlead_source_items s
      ON s.id=e.source_item_id AND s.workspace_id=e.workspace_id
    WHERE oe.workspace_id=v_row.workspace_id AND oe.opportunity_id=v_row.id
      AND oe.tombstoned_at IS NULL AND e.tombstoned_at IS NULL;
    v_result:=v_result||jsonb_build_object('evidence',v_evidence,'limitations','[]'::jsonb);
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_build_opportunity_review_dto(
  p_opportunity_id uuid,p_include_evidence boolean
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result jsonb;
  v_assessment jsonb;
  v_evidence jsonb:='[]'::jsonb;
  v_item jsonb;
  v_facts jsonb;
  v_problem jsonb;
  v_text text;
  v_source_url text;
  v_limitations jsonb:='[]'::jsonb;
BEGIN
  v_result:=public.intentlead_build_opportunity_review_dto_unfiltered(
    p_opportunity_id,p_include_evidence
  );
  IF v_result IS NULL THEN RETURN NULL; END IF;
  v_assessment:=v_result->'assessment';
  IF jsonb_typeof(v_assessment)='object' AND v_assessment?'problemStatement' THEN
    v_text:=v_assessment->>'problemStatement';
    IF v_text IS NOT NULL AND NOT public.intentlead_review_text_is_safe(v_text,600) THEN
      v_assessment:=jsonb_set(v_assessment,'{problemStatement}','null'::jsonb,true);
    END IF;
    v_result:=jsonb_set(v_result,'{assessment}',v_assessment,true);
  END IF;
  IF p_include_evidence AND jsonb_typeof(v_result->'evidence')='array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_result->'evidence') LOOP
      v_source_url:=public.intentlead_sanitize_review_source_url(v_item->>'sourceUrl');
      v_item:=jsonb_set(
        v_item,'{sourceUrl}',coalesce(to_jsonb(v_source_url),'null'::jsonb),true
      );
      v_facts:=coalesce(v_item->'facts','{}'::jsonb);
      v_problem:=v_facts->'problem';
      IF jsonb_typeof(v_problem)='object' AND v_problem?'observedCondition' THEN
        v_text:=v_problem->>'observedCondition';
        IF v_text IS NOT NULL AND NOT public.intentlead_review_text_is_safe(v_text,500) THEN
          v_problem:=v_problem-'observedCondition';
          v_facts:=jsonb_set(v_facts,'{problem}',v_problem,true);
        END IF;
      END IF;
      SELECT e.excerpt INTO v_text
      FROM public.intentlead_opportunity_evidence oe
      JOIN public.intentlead_evidence_items e
        ON e.id=oe.evidence_id AND e.workspace_id=oe.workspace_id
      WHERE oe.opportunity_id=p_opportunity_id
        AND oe.evidence_id=(v_item->>'id')::uuid
        AND oe.tombstoned_at IS NULL AND e.tombstoned_at IS NULL;
      IF v_text IS NOT NULL AND public.intentlead_review_text_is_safe(v_text,500) THEN
        v_facts:=jsonb_set(v_facts,'{observedCondition}',to_jsonb(btrim(v_text)),true);
      END IF;
      v_item:=jsonb_set(v_item,'{facts}',v_facts,true);
      v_evidence:=v_evidence||jsonb_build_array(v_item);
    END LOOP;
    SELECT coalesce(jsonb_agg(to_jsonb(limitation) ORDER BY limitation),'[]'::jsonb)
    INTO v_limitations
    FROM (
      SELECT DISTINCT btrim(value#>>'{}') AS limitation
      FROM public.intentlead_opportunities o
      LEFT JOIN public.intentlead_opportunity_assessments a
        ON a.id=o.current_assessment_id AND a.workspace_id=o.workspace_id
      JOIN public.intentlead_provider_runs r ON r.workspace_id=o.workspace_id AND (
        r.id=a.model_run_id OR EXISTS (
          SELECT 1 FROM public.intentlead_opportunity_evidence oe
          JOIN public.intentlead_evidence_items e
            ON e.id=oe.evidence_id AND e.workspace_id=oe.workspace_id
          WHERE oe.opportunity_id=o.id AND oe.workspace_id=o.workspace_id
            AND oe.tombstoned_at IS NULL AND e.tombstoned_at IS NULL
            AND e.provider_run_id=r.id
        )
      )
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(r.response_metadata->'limitations')='array'
          THEN r.response_metadata->'limitations' ELSE '[]'::jsonb END
      ) limitation_row(value)
      WHERE o.id=p_opportunity_id AND o.tombstoned_at IS NULL
        AND public.intentlead_is_workspace_member(o.workspace_id)
        AND jsonb_typeof(value)='string'
        AND public.intentlead_review_text_is_safe(btrim(value#>>'{}'),240)
      LIMIT 12
    ) safe_limitations;
    v_result:=jsonb_set(v_result,'{evidence}',v_evidence,true);
    v_result:=jsonb_set(v_result,'{limitations}',v_limitations,true);
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_list_opportunities_for_review(
  p_limit integer DEFAULT 20,p_after_created_at timestamptz DEFAULT NULL,p_after_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row record;
  v_count integer:=0;
  v_rows jsonb:='[]'::jsonb;
  v_has_more boolean:=false;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50
  THEN RAISE EXCEPTION 'invalid_page_size' USING ERRCODE='22023'; END IF;
  IF (p_after_created_at IS NULL)<>(p_after_id IS NULL)
  THEN RAISE EXCEPTION 'invalid_cursor' USING ERRCODE='22023'; END IF;
  FOR v_row IN
    SELECT o.id,o.created_at FROM public.intentlead_opportunities o
    JOIN public.intentlead_discovery_briefs b
      ON b.id=o.discovery_brief_id AND b.workspace_id=o.workspace_id
    JOIN public.intentlead_market_profiles m
      ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
    WHERE o.tombstoned_at IS NULL AND b.deleted_at IS NULL
      AND o.state IN ('HUMAN_REVIEW','ACCEPTED','REJECTED','NEEDS_RESEARCH')
      AND public.intentlead_is_workspace_member(o.workspace_id)
      AND m.profile_key='EN_DISCOVERY_ONLY' AND m.workflow='DISCOVERY_ONLY'
      AND m.capabilities @> ARRAY['HUMAN_REVIEW']::text[]
      AND (p_after_created_at IS NULL OR (o.created_at,o.id)<(p_after_created_at,p_after_id))
    ORDER BY o.created_at DESC,o.id DESC LIMIT p_limit+1
  LOOP
    v_count:=v_count+1;
    IF v_count>p_limit THEN v_has_more:=true; EXIT; END IF;
    v_rows:=v_rows||jsonb_build_array(
      public.intentlead_build_opportunity_review_dto(v_row.id,false)
    );
  END LOOP;
  RETURN jsonb_build_object('rows',v_rows,'hasMore',v_has_more);
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_get_opportunity_for_review(p_opportunity_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT public.intentlead_build_opportunity_review_dto(p_opportunity_id,true)
$$;

REVOKE ALL ON FUNCTION public.intentlead_build_opportunity_review_dto_unfiltered(uuid,boolean)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.intentlead_build_opportunity_review_dto(uuid,boolean)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.intentlead_list_opportunities_for_review(integer,timestamptz,uuid)
  FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.intentlead_get_opportunity_for_review(uuid)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.intentlead_list_opportunities_for_review(integer,timestamptz,uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_get_opportunity_for_review(uuid) TO authenticated;

-- Cost events describe external provider/model usage only.
DROP TRIGGER IF EXISTS intentlead_append_only ON public.intentlead_cost_events;
DELETE FROM public.intentlead_cost_events WHERE event_type='PACKAGE_VERIFIED';
ALTER TABLE public.intentlead_cost_events
  DROP CONSTRAINT IF EXISTS intentlead_cost_events_event_type_check,
  DROP CONSTRAINT IF EXISTS intentlead_cost_events_workspace_id_verified_package_id_fkey,
  DROP CONSTRAINT IF EXISTS intentlead_cost_events_check,
  DROP COLUMN IF EXISTS verified_package_id,
  DROP COLUMN IF EXISTS customer_credit_delta;
ALTER TABLE public.intentlead_cost_events
  ADD CONSTRAINT intentlead_cost_events_event_type_check
  CHECK (event_type IN ('PROVIDER_COST','MODEL_COST'));
CREATE TRIGGER intentlead_append_only
  BEFORE UPDATE OR DELETE ON public.intentlead_cost_events
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_reject_audit_mutation();

-- Core-only erasure primitives replace the historical wrapper chain before any
-- referenced legacy relation is dropped.
CREATE OR REPLACE FUNCTION public.intentlead_tombstone_opportunity(
  p_opportunity_id uuid,p_user_id uuid,p_reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_workspace_id uuid;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason)='' OR length(p_reason)>200
  THEN RAISE EXCEPTION 'invalid_tombstone_reason'; END IF;
  SELECT workspace_id INTO v_workspace_id
  FROM public.intentlead_opportunities WHERE id=p_opportunity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('intentlead-workspace:'||v_workspace_id::text,0));
  PERFORM 1 FROM public.workspaces
  WHERE id=v_workspace_id AND owner_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM 1 FROM public.intentlead_opportunities
  WHERE id=p_opportunity_id AND workspace_id=v_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.intentlead_opportunities
  SET tombstoned_at=coalesce(tombstoned_at,clock_timestamp()),state='ARCHIVED'
  WHERE id=p_opportunity_id;
  UPDATE public.intentlead_opportunity_evidence
  SET tombstoned_at=coalesce(tombstoned_at,clock_timestamp())
  WHERE opportunity_id=p_opportunity_id;
  UPDATE public.intentlead_evidence_items e
  SET excerpt=NULL,structured_facts='{}'::jsonb,
      tombstoned_at=coalesce(e.tombstoned_at,clock_timestamp())
  WHERE e.workspace_id=v_workspace_id
    AND EXISTS (
      SELECT 1 FROM public.intentlead_opportunity_evidence own_link
      WHERE own_link.opportunity_id=p_opportunity_id AND own_link.evidence_id=e.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_opportunity_evidence live_link
      JOIN public.intentlead_opportunities live_o ON live_o.id=live_link.opportunity_id
      WHERE live_link.evidence_id=e.id AND live_link.tombstoned_at IS NULL
        AND live_o.tombstoned_at IS NULL
    );
  UPDATE public.intentlead_source_items s
  SET content=NULL,normalized_facts='{}'::jsonb,
      tombstoned_at=coalesce(s.tombstoned_at,clock_timestamp())
  WHERE s.workspace_id=v_workspace_id
    AND EXISTS (
      SELECT 1 FROM public.intentlead_evidence_items e
      JOIN public.intentlead_opportunity_evidence oe ON oe.evidence_id=e.id
      WHERE oe.opportunity_id=p_opportunity_id AND e.source_item_id=s.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_evidence_items live_e
      WHERE live_e.source_item_id=s.id AND live_e.tombstoned_at IS NULL
    );
  UPDATE public.intentlead_artifact_metadata a
  SET storage_reference='deleted://tombstone',size_bytes=0,
      tombstoned_at=coalesce(a.tombstoned_at,clock_timestamp())
  WHERE a.workspace_id=v_workspace_id
    AND EXISTS (
      SELECT 1 FROM public.intentlead_evidence_items e
      JOIN public.intentlead_opportunity_evidence oe ON oe.evidence_id=e.id
      WHERE oe.opportunity_id=p_opportunity_id AND e.artifact_id=a.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_evidence_items live_e
      WHERE live_e.artifact_id=a.id AND live_e.tombstoned_at IS NULL
    );
  UPDATE public.intentlead_opportunity_assessments
  SET signal='{"family":"DETECTED_PROBLEM","subtype":"operations"}'::jsonb,
      problem_type='deleted',problem_statement='[deleted]',
      evidence_strength=0,explicitness=0,urgency=0,freshness=0,commercial_impact=0,
      icp_fit=0,company_confidence=0,buyer_relevance=0,actionability=0,confidence=0,
      rejection_reasons=CASE WHEN decision='REJECT' THEN ARRAY['deleted']::text[] ELSE '{}'::text[] END,
      review_reasons=CASE WHEN decision='REVIEW' THEN ARRAY['deleted']::text[] ELSE '{}'::text[] END,
      tombstoned_at=coalesce(tombstoned_at,clock_timestamp())
  WHERE opportunity_id=p_opportunity_id;
  UPDATE public.intentlead_human_reviews
  SET reason='[deleted]',note=NULL,
      request_fingerprint=CASE WHEN idempotency_key IS NULL THEN NULL ELSE '[redacted]' END,
      tombstoned_at=coalesce(tombstoned_at,clock_timestamp())
  WHERE opportunity_id=p_opportunity_id;
  INSERT INTO public.intentlead_deletion_tombstones(
    workspace_id,resource_type,resource_id,reason,requested_by
  ) VALUES (v_workspace_id,'OPPORTUNITY',p_opportunity_id,p_reason,p_user_id)
  ON CONFLICT (workspace_id,resource_type,resource_id) DO NOTHING;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_tombstone_opportunity(uuid,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_tombstone_opportunity(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.intentlead_delete_discovery_brief(
  p_discovery_brief_id uuid,p_user_id uuid,p_reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_brief public.intentlead_discovery_briefs%ROWTYPE;
  v_opportunity_id uuid;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason)='' OR length(p_reason)>200
  THEN RAISE EXCEPTION 'invalid_deletion_reason'; END IF;
  SELECT b.* INTO v_brief FROM public.intentlead_discovery_briefs b
  JOIN public.workspaces w ON w.id=b.workspace_id
  WHERE b.id=p_discovery_brief_id AND w.owner_id=p_user_id
  FOR UPDATE OF b,w;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('intentlead-workspace:'||v_brief.workspace_id::text,0));

  UPDATE public.intentlead_jobs
  SET state=CASE WHEN state IN ('QUEUED','LEASED','RUNNING','RETRY_WAIT') THEN 'CANCELLED' ELSE state END,
      cancellation_requested_at=CASE WHEN state IN ('QUEUED','LEASED','RUNNING','RETRY_WAIT')
        THEN coalesce(cancellation_requested_at,clock_timestamp()) ELSE cancellation_requested_at END,
      cancelled_at=CASE WHEN state IN ('QUEUED','LEASED','RUNNING','RETRY_WAIT')
        THEN coalesce(cancelled_at,clock_timestamp()) ELSE cancelled_at END,
      lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,heartbeat_at=NULL,
      completion_token=CASE WHEN state IN ('QUEUED','LEASED','RUNNING','RETRY_WAIT') THEN NULL ELSE completion_token END,
      completion_worker=CASE WHEN state IN ('QUEUED','LEASED','RUNNING','RETRY_WAIT') THEN NULL ELSE completion_worker END,
      completion_fingerprint=CASE WHEN state IN ('QUEUED','LEASED','RUNNING','RETRY_WAIT') THEN NULL ELSE completion_fingerprint END,
      payload='{}'::jsonb,checkpoint='{}'::jsonb,result=NULL,error=NULL,cost_scope='{}'::jsonb
  WHERE discovery_brief_id=p_discovery_brief_id;
  UPDATE public.intentlead_job_step_attempts a
  SET state=CASE WHEN state='STARTED' THEN 'CANCELLED' ELSE state END,
      finished_at=CASE WHEN state='STARTED' THEN clock_timestamp() ELSE finished_at END,
      retry_reason=NULL,checkpoint='{}'::jsonb,cost_scope='{}'::jsonb
  WHERE a.job_id IN (
    SELECT id FROM public.intentlead_jobs WHERE discovery_brief_id=p_discovery_brief_id
  );
  DELETE FROM public.intentlead_job_step_provider_runs link
  WHERE link.step_attempt_id IN (
    SELECT a.id FROM public.intentlead_job_step_attempts a
    JOIN public.intentlead_jobs j ON j.id=a.job_id
    WHERE j.discovery_brief_id=p_discovery_brief_id
  );
  UPDATE public.intentlead_discovery_briefs
  SET state='CANCELLED',objective='[deleted]',criteria='{}'::jsonb,
      deleted_at=coalesce(deleted_at,clock_timestamp())
  WHERE id=p_discovery_brief_id AND workspace_id=v_brief.workspace_id;

  FOR v_opportunity_id IN
    SELECT id FROM public.intentlead_opportunities
    WHERE workspace_id=v_brief.workspace_id AND discovery_brief_id=p_discovery_brief_id ORDER BY id
  LOOP
    PERFORM public.intentlead_tombstone_opportunity(v_opportunity_id,p_user_id,p_reason);
  END LOOP;

  UPDATE public.intentlead_companies c
  SET canonical_name='[deleted]',domain=NULL,jurisdiction=NULL,
      tombstoned_at=coalesce(c.tombstoned_at,clock_timestamp())
  WHERE c.workspace_id=v_brief.workspace_id
    AND EXISTS (
      SELECT 1 FROM public.intentlead_opportunities own_o
      WHERE own_o.discovery_brief_id=p_discovery_brief_id AND own_o.company_id=c.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_opportunities live_o
      WHERE live_o.company_id=c.id AND live_o.tombstoned_at IS NULL
    );
  UPDATE public.intentlead_provider_runs pr
  SET provider='redacted',provider_version=NULL,
      status=CASE WHEN status='STARTED' THEN 'FAILED' ELSE status END,
      request_metadata='{}'::jsonb,response_metadata='{}'::jsonb,
      latency_ms=NULL,usage_units=0,cost_amount=0,currency=NULL,
      finished_at=coalesce(finished_at,clock_timestamp())
  WHERE pr.workspace_id=v_brief.workspace_id
    AND pr.job_id IN (
      SELECT id FROM public.intentlead_jobs
      WHERE workspace_id=v_brief.workspace_id AND discovery_brief_id=p_discovery_brief_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_source_items s
      WHERE s.workspace_id=pr.workspace_id AND s.provider_run_id=pr.id AND s.tombstoned_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_evidence_items e
      WHERE e.workspace_id=pr.workspace_id AND e.provider_run_id=pr.id AND e.tombstoned_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_opportunity_assessments a
      JOIN public.intentlead_opportunities live_o
        ON live_o.workspace_id=a.workspace_id AND live_o.id=a.opportunity_id
      WHERE a.workspace_id=pr.workspace_id AND a.model_run_id=pr.id
        AND a.tombstoned_at IS NULL AND live_o.tombstoned_at IS NULL
    );

  IF NOT EXISTS (
    SELECT 1 FROM public.intentlead_discovery_briefs
    WHERE workspace_id=v_brief.workspace_id AND offer_profile_id=v_brief.offer_profile_id
      AND id<>p_discovery_brief_id AND deleted_at IS NULL
  ) THEN
    UPDATE public.intentlead_offer_profiles
    SET name='deleted:'||id::text,definition='{}'::jsonb,
        archived_at=coalesce(archived_at,clock_timestamp())
    WHERE id=v_brief.offer_profile_id AND workspace_id=v_brief.workspace_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.intentlead_discovery_briefs
    WHERE workspace_id=v_brief.workspace_id AND icp_definition_id=v_brief.icp_definition_id
      AND id<>p_discovery_brief_id AND deleted_at IS NULL
  ) THEN
    UPDATE public.intentlead_icp_definitions
    SET name='deleted:'||id::text,definition='{}'::jsonb,
        archived_at=coalesce(archived_at,clock_timestamp())
    WHERE id=v_brief.icp_definition_id AND workspace_id=v_brief.workspace_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.intentlead_discovery_briefs
    WHERE workspace_id=v_brief.workspace_id AND market_profile_id=v_brief.market_profile_id
      AND id<>p_discovery_brief_id AND deleted_at IS NULL
  ) THEN
    UPDATE public.intentlead_market_profiles
    SET configuration=jsonb_build_object(
      'jurisdictions','[]'::jsonb,'regions','[]'::jsonb,'languages','["en"]'::jsonb,
      'legalPolicyId','en-discovery-legal-v1','retentionPolicyId','en-discovery-retention-v1',
      'defaultCurrency','USD','timezone','UTC'
    )
    WHERE id=v_brief.market_profile_id AND workspace_id=v_brief.workspace_id;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_delete_discovery_brief(uuid,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_delete_discovery_brief(uuid,uuid,text) TO service_role;

-- Grounding is a core persistence invariant, not a task-version concern.
CREATE OR REPLACE FUNCTION public.intentlead_claim_supported(
  p_claim text,p_items jsonb,p_ids uuid[]
) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item jsonb;
  v_claim text:=regexp_replace(lower(p_claim),'[^[:alnum:]]+','','g');
BEGIN
  IF btrim(p_claim)='' OR cardinality(p_ids)=0 THEN RETURN false; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF (v_item->>'id')::uuid=ANY(p_ids) THEN
      IF regexp_replace(lower(coalesce(v_item->>'excerpt','')),'[^[:alnum:]]+','','g')=v_claim
      THEN RETURN true; END IF;
      IF EXISTS (
        WITH RECURSIVE nodes(value) AS (
          SELECT v_item->'structuredFacts'
          UNION ALL
          SELECT child.value FROM nodes n CROSS JOIN LATERAL (
            SELECT entry.value FROM jsonb_each(
              CASE WHEN jsonb_typeof(n.value)='object' THEN n.value ELSE '{}'::jsonb END
            ) entry
            UNION ALL
            SELECT entry.value FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(n.value)='array' THEN n.value ELSE '[]'::jsonb END
            ) entry
          ) child
        )
        SELECT 1 FROM nodes WHERE jsonb_typeof(value) IN ('string','number')
          AND regexp_replace(lower(value #>> '{}'),'[^[:alnum:]]+','','g')=v_claim
      ) THEN RETURN true; END IF;
    END IF;
  END LOOP;
  RETURN false;
EXCEPTION WHEN others THEN RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_claim_supported(text,jsonb,uuid[])
  FROM PUBLIC,anon,authenticated,service_role;

-- One active persistence RPC owns validation and writes; the historical
-- task7_v1 implementation is no longer called as a hidden second stage.
CREATE OR REPLACE FUNCTION public.intentlead_persist_self_prospecting_candidate(
  p_job_id uuid,p_worker_id text,p_lease_token uuid,p_candidate_key text,p_slice jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_job public.intentlead_jobs%ROWTYPE;
  v_brief public.intentlead_discovery_briefs%ROWTYPE;
  v_existing public.intentlead_job_candidate_results%ROWTYPE;
  v_run jsonb; v_source jsonb; v_evidence jsonb; v_claim jsonb; v_company jsonb;
  v_opportunity jsonb; v_assessment jsonb;
  v_workspace uuid; v_run_id uuid; v_source_id uuid; v_evidence_id uuid;
  v_company_id uuid; v_opportunity_id uuid; v_assessment_id uuid;
  v_opportunity_evidence uuid[]; v_distinct_evidence uuid[];
  v_assessment_evidence uuid[]; v_claim_refs uuid[];
  v_seen_runs uuid[]:='{}'::uuid[];
  v_hash text; v_state text; v_decision text; v_company_name text;
  v_rejection text[] := '{}'::text[]; v_review text[] := '{}'::text[];
  v_policy_reasons text[];
BEGIN
  IF p_job_id IS NULL OR p_worker_id IS NULL OR btrim(p_worker_id)=''
    OR p_lease_token IS NULL OR p_candidate_key IS NULL OR btrim(p_candidate_key)=''
    OR length(p_candidate_key)>160 OR p_slice IS NULL OR jsonb_typeof(p_slice)<>'object'
  THEN RAISE EXCEPTION 'invalid_candidate_input'; END IF;
  SELECT * INTO v_job FROM public.intentlead_jobs
  WHERE id=p_job_id AND lease_owner=p_worker_id AND lease_token=p_lease_token
    AND state IN ('LEASED','RUNNING') AND lease_expires_at>clock_timestamp()
    AND market_profile_key='EN_DISCOVERY_ONLY' AND capability='SOURCE_SEARCH'
    AND job_type='OPPORTUNITY_DISCOVERY' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_active_lease'; END IF;
  v_workspace:=v_job.workspace_id;
  SELECT b.* INTO v_brief FROM public.intentlead_discovery_briefs b
  JOIN public.intentlead_market_profiles m
    ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
  WHERE b.id=v_job.discovery_brief_id AND b.workspace_id=v_workspace
    AND b.deleted_at IS NULL AND m.profile_key='EN_DISCOVERY_ONLY'
    AND m.workflow='DISCOVERY_ONLY'
    AND m.capabilities @> ARRAY[
      'SOURCE_SEARCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW'
    ]::text[]
  FOR SHARE OF b,m;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_discovery_context_invalid'; END IF;

  IF NOT public.intentlead_jsonb_keys_allowed(p_slice,ARRAY[
      'schemaVersion','candidateKey','modelDecision','policyReasons','groundedClaims',
      'providerRuns','sourceItems','evidenceItems','company','opportunity','assessment'
    ])
    OR NOT (p_slice ?& ARRAY[
      'schemaVersion','candidateKey','modelDecision','policyReasons','groundedClaims',
      'providerRuns','sourceItems','evidenceItems','company','opportunity','assessment'
    ])
    OR p_slice->>'schemaVersion'<>'1' OR p_slice->>'candidateKey'<>p_candidate_key
    OR jsonb_typeof(p_slice->'policyReasons')<>'array'
    OR jsonb_array_length(p_slice->'policyReasons')>16
    OR jsonb_typeof(p_slice->'groundedClaims') NOT IN ('array','null')
    OR jsonb_typeof(p_slice->'providerRuns')<>'array'
    OR jsonb_array_length(p_slice->'providerRuns') NOT BETWEEN 1 AND 32
    OR jsonb_typeof(p_slice->'sourceItems')<>'array'
    OR jsonb_array_length(p_slice->'sourceItems') NOT BETWEEN 1 AND 16
    OR jsonb_typeof(p_slice->'evidenceItems')<>'array'
    OR jsonb_array_length(p_slice->'evidenceItems') NOT BETWEEN 1 AND 16
    OR jsonb_typeof(p_slice->'opportunity')<>'object'
  THEN RAISE EXCEPTION 'invalid_candidate_shape'; END IF;

  v_opportunity:=p_slice->'opportunity';
  v_assessment:=p_slice->'assessment';
  v_company:=p_slice->'company';
  IF NOT public.intentlead_jsonb_keys_allowed(v_opportunity,ARRAY[
      'id','state','signal','jurisdiction','evidenceIds','assessmentId','createdAt','updatedAt'
    ])
    OR NOT (v_opportunity ?& ARRAY[
      'id','state','signal','jurisdiction','evidenceIds','assessmentId','createdAt','updatedAt'
    ])
    OR NOT public.intentlead_valid_signal(v_opportunity->'signal')
    OR jsonb_typeof(v_opportunity->'evidenceIds')<>'array'
    OR jsonb_array_length(v_opportunity->'evidenceIds') NOT BETWEEN 1 AND 16
    OR jsonb_typeof(v_opportunity->'id')<>'string'
    OR jsonb_typeof(v_opportunity->'state')<>'string'
    OR jsonb_typeof(v_opportunity->'createdAt')<>'string'
    OR jsonb_typeof(v_opportunity->'updatedAt')<>'string'
    OR (v_opportunity->'jurisdiction'<>'null'::jsonb
      AND NOT public.intentlead_valid_jurisdictions(jsonb_build_array(v_opportunity->'jurisdiction')))
  THEN RAISE EXCEPTION 'invalid_candidate_opportunity'; END IF;
  v_opportunity_id:=(v_opportunity->>'id')::uuid;
  SELECT array_agg((value #>> '{}')::uuid),array_agg(DISTINCT (value #>> '{}')::uuid)
  INTO v_opportunity_evidence,v_distinct_evidence
  FROM jsonb_array_elements(v_opportunity->'evidenceIds');
  IF cardinality(v_opportunity_evidence)<>cardinality(v_distinct_evidence)
  THEN RAISE EXCEPTION 'duplicate_candidate_evidence'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(v_opportunity_evidence) value
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_slice->'evidenceItems') evidence_item(item)
      WHERE evidence_item.item->>'id'=value::text
    )
  ) THEN RAISE EXCEPTION 'candidate_evidence_cross_slice_reference'; END IF;

  IF jsonb_typeof(v_company)='null' THEN
    v_company_id:=NULL;
  ELSE
    IF NOT public.intentlead_jsonb_keys_allowed(v_company,ARRAY[
        'id','canonicalName','domain','jurisdiction','confidence'
      ])
      OR NOT (v_company ?& ARRAY['id','canonicalName','domain','jurisdiction','confidence'])
      OR btrim(v_company->>'canonicalName')=''
      OR jsonb_typeof(v_company->'confidence')<>'number'
      OR (v_company->>'confidence')::numeric NOT BETWEEN 0 AND 1
      OR v_company->'domain'='null'::jsonb
      OR v_company->>'domain' !~ '^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$'
      OR v_company->'jurisdiction'<>'null'::jsonb
    THEN RAISE EXCEPTION 'invalid_candidate_company'; END IF;
    v_company_id:=(v_company->>'id')::uuid;
  END IF;

  IF jsonb_typeof(v_assessment)='null' THEN
    IF v_opportunity->>'state'<>'INSUFFICIENT_EVIDENCE'
      OR jsonb_typeof(v_company)<>'null' OR v_opportunity->'assessmentId'<>'null'::jsonb
      OR jsonb_typeof(p_slice->'modelDecision')<>'null'
      OR jsonb_typeof(p_slice->'groundedClaims')<>'null'
    THEN RAISE EXCEPTION 'incomplete_candidate_state_mismatch'; END IF;
    v_state:='INSUFFICIENT_EVIDENCE';
  ELSE
    IF NOT public.intentlead_jsonb_keys_allowed(v_assessment,ARRAY[
        'id','decision','problemType','problemStatement','evidenceStrength','explicitness','urgency',
        'freshness','commercialImpact','icpFit','companyConfidence','buyerRelevance','actionability',
        'confidence','evidenceIds','rejectionReasons','reviewReasons','modelRunId','assessedAt'
      ])
      OR NOT (v_assessment ?& ARRAY[
        'id','decision','problemType','problemStatement','evidenceStrength','explicitness','urgency',
        'freshness','commercialImpact','icpFit','companyConfidence','buyerRelevance','actionability',
        'confidence','evidenceIds','rejectionReasons','reviewReasons','modelRunId','assessedAt'
      ])
      OR jsonb_typeof(v_company)<>'object'
      OR jsonb_typeof(p_slice->'groundedClaims')<>'array'
      OR jsonb_array_length(p_slice->'groundedClaims') NOT BETWEEN 1 AND 8
      OR jsonb_typeof(p_slice->'modelDecision')<>'string'
      OR p_slice->>'modelDecision' NOT IN ('QUALIFY','REVIEW','REJECT')
      OR jsonb_typeof(v_assessment->'evidenceIds')<>'array'
      OR jsonb_array_length(v_assessment->'evidenceIds') NOT BETWEEN 1 AND 16
      OR jsonb_typeof(v_assessment->'rejectionReasons')<>'array'
      OR jsonb_array_length(v_assessment->'rejectionReasons')>16
      OR jsonb_typeof(v_assessment->'reviewReasons')<>'array'
      OR jsonb_array_length(v_assessment->'reviewReasons')>16
      OR jsonb_typeof(v_assessment->'modelRunId')<>'string'
      OR jsonb_typeof(v_assessment->'id')<>'string'
      OR jsonb_typeof(v_assessment->'decision')<>'string'
      OR jsonb_typeof(v_assessment->'problemType')<>'string'
      OR btrim(v_assessment->>'problemType')=''
      OR jsonb_typeof(v_assessment->'problemStatement')<>'string'
      OR btrim(v_assessment->>'problemStatement')=''
      OR length(v_assessment->>'problemStatement')>500
      OR jsonb_typeof(v_assessment->'assessedAt')<>'string'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(jsonb_build_array(
          v_assessment->'evidenceStrength',v_assessment->'explicitness',
          v_assessment->'urgency',v_assessment->'freshness',
          v_assessment->'commercialImpact',v_assessment->'icpFit',
          v_assessment->'companyConfidence',v_assessment->'buyerRelevance',
          v_assessment->'actionability',v_assessment->'confidence'
        )) score(value)
        WHERE jsonb_typeof(score.value)<>'number'
          OR (score.value #>> '{}')::numeric NOT BETWEEN 0 AND 1
      )
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_assessment->'rejectionReasons') reason(value)
        WHERE jsonb_typeof(reason.value)<>'string' OR btrim(reason.value #>> '{}')=''
      )
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_assessment->'reviewReasons') reason(value)
        WHERE jsonb_typeof(reason.value)<>'string' OR btrim(reason.value #>> '{}')=''
      )
      OR jsonb_typeof(v_opportunity->'assessmentId')<>'string'
      OR v_opportunity->>'assessmentId'<>v_assessment->>'id'
      OR (p_slice->>'modelDecision'='REJECT'
        AND (v_opportunity->>'state'<>'MODEL_REJECTED' OR v_assessment->>'decision'<>'REJECT'))
      OR (p_slice->>'modelDecision'<>'REJECT'
        AND (v_opportunity->>'state'<>'HUMAN_REVIEW' OR v_assessment->>'decision'<>'REVIEW'))
    THEN RAISE EXCEPTION 'invalid_candidate_assessment'; END IF;
    v_assessment_id:=(v_assessment->>'id')::uuid;
    v_decision:=v_assessment->>'decision';
    v_state:=v_opportunity->>'state';
    v_assessment_evidence:=ARRAY(
      SELECT jsonb_array_elements_text(v_assessment->'evidenceIds')::uuid
    );
    IF cardinality(v_assessment_evidence)=0
      OR cardinality(v_assessment_evidence)<>(
        SELECT count(DISTINCT value) FROM unnest(v_assessment_evidence) value
      )
      OR EXISTS (
      SELECT 1 FROM unnest(v_assessment_evidence) value
      WHERE NOT value=ANY(v_opportunity_evidence)
    ) THEN RAISE EXCEPTION 'invalid_assessment_evidence_references'; END IF;
    v_rejection:=ARRAY(SELECT jsonb_array_elements_text(v_assessment->'rejectionReasons'));
    v_review:=ARRAY(SELECT jsonb_array_elements_text(v_assessment->'reviewReasons'));
    IF (v_decision='REVIEW' AND (cardinality(v_rejection)<>0 OR cardinality(v_review)=0))
      OR (v_decision='REJECT' AND (cardinality(v_rejection)=0 OR cardinality(v_review)<>0))
    THEN RAISE EXCEPTION 'invalid_candidate_assessment_decision'; END IF;
  END IF;

  IF jsonb_typeof(v_company)='object' AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_slice->'evidenceItems') e(value)
    JOIN jsonb_array_elements(p_slice->'sourceItems') s(value)
      ON s.value->>'id'=e.value->>'sourceItemId'
    JOIN jsonb_array_elements(p_slice->'providerRuns') r(value)
      ON r.value->>'id'=e.value->'provenance'->>'providerRunId'
    WHERE (e.value->>'id')::uuid=ANY(v_opportunity_evidence)
      AND s.value->>'provider' IN ('exa','serper')
      AND r.value->>'provider'=s.value->>'provider'
      AND r.value->>'capability'='COMPANY_RESOLUTION' AND r.value->>'status'='SUCCEEDED'
      AND e.value->'structuredFacts'->>'companyName'=btrim(v_company->>'canonicalName')
      AND lower(e.value->'structuredFacts'->>'companyDomain')=lower(btrim(v_company->>'domain'))
      AND position(lower(btrim(v_company->>'canonicalName')) IN lower(coalesce(e.value->>'excerpt','')))>0
      AND e.value->'provenance'->>'providerRunId'=r.value->>'id'
      AND (
        lower(regexp_replace(split_part(split_part(e.value->>'sourceUrl','://',2),'/',1), ':[0-9]+$', ''))
          =lower(btrim(v_company->>'domain'))
        OR lower(regexp_replace(split_part(split_part(e.value->>'sourceUrl','://',2),'/',1), ':[0-9]+$', ''))
          LIKE '%.'||lower(btrim(v_company->>'domain'))
      )
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(r.value->'provenance') p(value)
        WHERE p.value->>'providerSourceId'=s.value->>'externalId'
          AND p.value->>'sourceUrl'=s.value->>'sourceUrl'
      )
  ) THEN RAISE EXCEPTION 'candidate_company_evidence_unbound'; END IF;

  v_policy_reasons:=ARRAY(SELECT jsonb_array_elements_text(p_slice->'policyReasons'));
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_slice->'policyReasons') reason(value)
    WHERE jsonb_typeof(reason.value)<>'string' OR btrim(reason.value #>> '{}')=''
  ) OR EXISTS (
    SELECT 1 FROM unnest(v_policy_reasons) reason
    WHERE reason NOT IN (
      'SIGNAL_FAMILY_UNSUPPORTED','SIGNAL_TOO_OLD','SIGNAL_TOO_WEAK','INSUFFICIENT_EVIDENCE',
      'COMPANY_UNCERTAIN','WRONG_COMPANY','LOW_COMPANY_CONFIDENCE','MODEL_REVIEW',
      'MODEL_REJECTED','POLICY_REVIEW_REQUIRED','LOW_EXPLICITNESS','LOW_EVIDENCE_STRENGTH',
      'LOW_ICP_FIT','LOW_ACTIONABILITY','LOW_CONFIDENCE'
    )
  ) THEN RAISE EXCEPTION 'invalid_candidate_policy_reason'; END IF;
  v_hash:=md5(p_slice::text);
  SELECT * INTO v_existing FROM public.intentlead_job_candidate_results
  WHERE workspace_id=v_workspace AND job_id=p_job_id AND candidate_key=p_candidate_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.input_hash<>v_hash THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN v_existing.opportunity_id;
  END IF;

  FOR v_run IN SELECT value FROM jsonb_array_elements(p_slice->'providerRuns') LOOP
    IF NOT public.intentlead_jsonb_keys_allowed(v_run,ARRAY[
        'id','provider','providerVersion','capability','status','startedAt','finishedAt','latencyMs',
        'requestCount','recordCount','configuredCost','reservedCost','actualCost','currency',
        'provenance','limitations'
      ])
      OR NOT (v_run ?& ARRAY[
        'id','provider','providerVersion','capability','status','startedAt','finishedAt','latencyMs',
        'requestCount','recordCount','configuredCost','reservedCost','actualCost','currency',
        'provenance','limitations'
      ])
      OR v_run->>'provider' NOT IN ('reddit','hackernews','exa','serper','openai')
      OR v_run->>'capability' NOT IN ('SOURCE_SEARCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT')
      OR (v_run->>'provider' IN ('reddit','hackernews') AND v_run->>'capability'<>'SOURCE_SEARCH')
      OR (v_run->>'provider' IN ('exa','serper') AND v_run->>'capability'<>'COMPANY_RESOLUTION')
      OR (v_run->>'provider'='openai'
        AND v_run->>'capability' NOT IN ('COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT'))
      OR v_run->>'status' NOT IN ('SUCCEEDED','PARTIAL','FAILED','RATE_LIMITED','TIMEOUT')
      OR jsonb_typeof(v_run->'id')<>'string'
      OR jsonb_typeof(v_run->'providerVersion') NOT IN ('string','null')
      OR jsonb_typeof(v_run->'latencyMs')<>'number' OR (v_run->>'latencyMs')::numeric<0
      OR trunc((v_run->>'latencyMs')::numeric)<>(v_run->>'latencyMs')::numeric
      OR jsonb_typeof(v_run->'requestCount')<>'number' OR (v_run->>'requestCount')::numeric<0
      OR trunc((v_run->>'requestCount')::numeric)<>(v_run->>'requestCount')::numeric
      OR jsonb_typeof(v_run->'recordCount')<>'number' OR (v_run->>'recordCount')::numeric<0
      OR trunc((v_run->>'recordCount')::numeric)<>(v_run->>'recordCount')::numeric
      OR jsonb_typeof(v_run->'configuredCost') NOT IN ('number','null')
      OR (v_run->'configuredCost'<>'null'::jsonb AND (v_run->>'configuredCost')::numeric<0)
      OR jsonb_typeof(v_run->'reservedCost') NOT IN ('number','null')
      OR (v_run->'reservedCost'<>'null'::jsonb AND (v_run->>'reservedCost')::numeric<0)
      OR jsonb_typeof(v_run->'actualCost') NOT IN ('number','null')
      OR (v_run->'actualCost'<>'null'::jsonb AND (v_run->>'actualCost')::numeric<0)
      OR jsonb_typeof(v_run->'currency') NOT IN ('string','null')
      OR (v_run->'currency'<>'null'::jsonb AND v_run->>'currency' !~ '^[A-Z]{3}$')
      OR jsonb_typeof(v_run->'startedAt')<>'string'
      OR jsonb_typeof(v_run->'finishedAt')<>'string'
      OR jsonb_typeof(v_run->'provenance')<>'array'
      OR jsonb_typeof(v_run->'limitations')<>'array'
    THEN RAISE EXCEPTION 'invalid_candidate_provider_run'; END IF;
    v_run_id:=(v_run->>'id')::uuid;
    IF v_run_id=ANY(v_seen_runs) THEN RAISE EXCEPTION 'duplicate_candidate_provider_run'; END IF;
    v_seen_runs:=array_append(v_seen_runs,v_run_id);
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_run->'provenance') provenance(value)
      WHERE NOT public.intentlead_jsonb_keys_allowed(
          provenance.value,ARRAY['providerSourceId','sourceUrl','capturedAt']
        )
        OR NOT (provenance.value ?& ARRAY['providerSourceId','sourceUrl','capturedAt'])
        OR btrim(provenance.value->>'providerSourceId')=''
        OR jsonb_typeof(provenance.value->'sourceUrl') NOT IN ('string','null')
        OR jsonb_typeof(provenance.value->'capturedAt')<>'string'
        OR (provenance.value->'sourceUrl'<>'null'::jsonb
          AND provenance.value->>'sourceUrl' !~ '^https?://')
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_run->'limitations') limitation(value)
      WHERE jsonb_typeof(limitation.value)<>'string'
    ) THEN RAISE EXCEPTION 'invalid_candidate_provider_provenance'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.intentlead_provider_runs existing
      WHERE existing.id=v_run_id
        AND (existing.workspace_id<>v_workspace OR existing.job_id<>p_job_id
          OR existing.provider<>v_run->>'provider'
          OR existing.capability<>v_run->>'capability'
          OR existing.status<>v_run->>'status'
          OR coalesce(existing.provider_version,'')<>coalesce(v_run->>'providerVersion',''))
    ) THEN RAISE EXCEPTION 'provider_run_identity_conflict'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.intentlead_provider_runs
      WHERE id=v_run_id AND workspace_id=v_workspace AND job_id=p_job_id
    ) THEN
      INSERT INTO public.intentlead_provider_runs(
        id,workspace_id,job_id,capability,provider,provider_version,status,
        request_metadata,response_metadata,latency_ms,usage_units,cost_amount,currency,
        started_at,finished_at
      ) VALUES (
        v_run_id,v_workspace,p_job_id,v_run->>'capability',v_run->>'provider',v_run->>'providerVersion',
        v_run->>'status',jsonb_build_object(
          'traceId',v_job.trace_id,'requestCount',v_run->'requestCount',
          'configuredCost',v_run->'configuredCost','reservedCost',v_run->'reservedCost'
        ),jsonb_build_object(
          'recordCount',v_run->'recordCount','provenance',v_run->'provenance',
          'limitations',v_run->'limitations'
        ),(v_run->>'latencyMs')::integer,(v_run->>'requestCount')::numeric,
        (v_run->>'actualCost')::numeric,v_run->>'currency',
        (v_run->>'startedAt')::timestamptz,(v_run->>'finishedAt')::timestamptz
      );
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM public.intentlead_provider_runs
    WHERE job_id=p_job_id AND workspace_id=v_workspace AND capability='SOURCE_SEARCH'
  ) THEN RAISE EXCEPTION 'candidate_source_run_missing'; END IF;
  IF v_assessment IS NOT NULL AND v_assessment<>'null'::jsonb AND NOT EXISTS (
    SELECT 1 FROM public.intentlead_provider_runs
    WHERE id=(v_assessment->>'modelRunId')::uuid AND job_id=p_job_id
      AND workspace_id=v_workspace AND capability='OPPORTUNITY_ASSESSMENT'
      AND provider='openai' AND status='SUCCEEDED'
  ) THEN RAISE EXCEPTION 'candidate_assessment_run_missing'; END IF;

  FOR v_source IN SELECT value FROM jsonb_array_elements(p_slice->'sourceItems') LOOP
    IF NOT public.intentlead_jsonb_keys_allowed(v_source,ARRAY[
        'id','provider','externalId','sourceUrl','content','normalizedFacts','provenance',
        'contentHash','capturedAt','publishedAt'
      ])
      OR NOT (v_source ?& ARRAY[
        'id','provider','externalId','sourceUrl','content','normalizedFacts','provenance',
        'contentHash','capturedAt','publishedAt'
      ])
      OR v_source->>'provider' NOT IN ('reddit','hackernews','exa','serper')
      OR btrim(v_source->>'externalId')=''
      OR jsonb_typeof(v_source->'sourceUrl')<>'string'
      OR v_source->>'sourceUrl' !~ '^https?://'
      OR btrim(coalesce(v_source->>'content',''))=''
      OR v_source->>'contentHash' !~ '^[0-9a-fA-F]{64}$'
      OR NOT public.intentlead_valid_structured_facts(v_source->'normalizedFacts')
      OR NOT public.intentlead_valid_provenance(v_source->'provenance')
      OR jsonb_typeof(v_source->'capturedAt')<>'string'
      OR jsonb_typeof(v_source->'publishedAt') NOT IN ('string','null')
      OR v_source->'provenance'->'rawArtifactId'<>'null'::jsonb
    THEN RAISE EXCEPTION 'invalid_candidate_source'; END IF;
    v_source_id:=(v_source->>'id')::uuid;
    v_run_id:=(v_source->'provenance'->>'providerRunId')::uuid;
    IF v_source->'provenance'->>'sourceId'<>v_source_id::text OR NOT EXISTS (
      SELECT 1 FROM public.intentlead_provider_runs provider_run
      WHERE provider_run.id=v_run_id AND provider_run.workspace_id=v_workspace
        AND provider_run.job_id=p_job_id AND provider_run.provider=v_source->>'provider'
        AND provider_run.status IN ('SUCCEEDED','PARTIAL')
        AND provider_run.capability=CASE
          WHEN v_source->>'provider' IN ('reddit','hackernews') THEN 'SOURCE_SEARCH'
          ELSE 'COMPANY_RESOLUTION'
        END
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(provider_run.response_metadata->'provenance') provenance(value)
          WHERE provenance.value->>'providerSourceId'=v_source->>'externalId'
            AND provenance.value->>'sourceUrl'=v_source->>'sourceUrl'
        )
    ) THEN RAISE EXCEPTION 'invalid_candidate_source_provenance'; END IF;
    INSERT INTO public.intentlead_source_items(
      id,workspace_id,provider,external_id,provider_run_id,source_url,content,
      normalized_facts,provenance,content_hash,captured_at,published_at
    ) VALUES (
      v_source_id,v_workspace,v_source->>'provider',v_source->>'externalId',v_run_id,
      v_source->>'sourceUrl',v_source->>'content',v_source->'normalizedFacts',v_source->'provenance',
      v_source->>'contentHash',(v_source->>'capturedAt')::timestamptz,
      (v_source->>'publishedAt')::timestamptz
    );
  END LOOP;

  FOR v_evidence IN SELECT value FROM jsonb_array_elements(p_slice->'evidenceItems') LOOP
    IF NOT public.intentlead_jsonb_keys_allowed(v_evidence,ARRAY[
        'id','sourceItemId','type','sourceUrl','capturedAt','excerpt','structuredFacts',
        'verificationMethod','confidence','contentHash','provenance'
      ])
      OR NOT (v_evidence ?& ARRAY[
        'id','sourceItemId','type','sourceUrl','capturedAt','excerpt','structuredFacts',
        'verificationMethod','confidence','contentHash','provenance'
      ])
      OR v_evidence->>'type' NOT IN ('text','structured_fact','screenshot','document','observation')
      OR btrim(v_evidence->>'verificationMethod')=''
      OR jsonb_typeof(v_evidence->'confidence')<>'number'
      OR (v_evidence->>'confidence')::numeric NOT BETWEEN 0 AND 1
      OR jsonb_typeof(v_evidence->'sourceUrl')<>'string'
      OR v_evidence->>'sourceUrl' !~ '^https?://'
      OR jsonb_typeof(v_evidence->'capturedAt')<>'string'
      OR jsonb_typeof(v_evidence->'excerpt') NOT IN ('string','null')
      OR v_evidence->>'contentHash' !~ '^[0-9a-fA-F]{64}$'
      OR NOT public.intentlead_valid_structured_facts(v_evidence->'structuredFacts')
      OR NOT public.intentlead_valid_provenance(v_evidence->'provenance')
      OR v_evidence->'provenance'->'rawArtifactId'<>'null'::jsonb
    THEN RAISE EXCEPTION 'invalid_candidate_evidence'; END IF;
    v_evidence_id:=(v_evidence->>'id')::uuid;
    v_source_id:=(v_evidence->>'sourceItemId')::uuid;
    v_run_id:=(v_evidence->'provenance'->>'providerRunId')::uuid;
    IF v_evidence->'provenance'->>'sourceId'<>v_source_id::text
      OR NOT EXISTS (
        SELECT 1 FROM public.intentlead_source_items
        WHERE id=v_source_id AND workspace_id=v_workspace AND provider_run_id=v_run_id
          AND source_url=v_evidence->>'sourceUrl'
          AND captured_at=(v_evidence->>'capturedAt')::timestamptz
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.intentlead_provider_runs provider_run
        JOIN public.intentlead_source_items source_item
          ON source_item.id=v_source_id AND source_item.workspace_id=v_workspace
          AND source_item.provider_run_id=v_run_id
        WHERE provider_run.id=v_run_id AND provider_run.workspace_id=v_workspace
          AND provider_run.job_id=p_job_id
      )
    THEN RAISE EXCEPTION 'invalid_candidate_evidence_provenance'; END IF;
    INSERT INTO public.intentlead_evidence_items(
      id,workspace_id,source_item_id,provider_run_id,evidence_type,source_url,captured_at,
      excerpt,structured_facts,verification_method,confidence,content_hash,provenance
    ) VALUES (
      v_evidence_id,v_workspace,v_source_id,v_run_id,v_evidence->>'type',v_evidence->>'sourceUrl',
      (v_evidence->>'capturedAt')::timestamptz,v_evidence->>'excerpt',v_evidence->'structuredFacts',
      v_evidence->>'verificationMethod',(v_evidence->>'confidence')::numeric,
      v_evidence->>'contentHash',v_evidence->'provenance'
    );
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM unnest(v_opportunity_evidence) value
    WHERE NOT EXISTS (
      SELECT 1 FROM public.intentlead_evidence_items
      WHERE id=value AND workspace_id=v_workspace AND tombstoned_at IS NULL
    )
  ) THEN RAISE EXCEPTION 'candidate_evidence_reference_missing'; END IF;

  IF v_assessment IS NOT NULL AND v_assessment<>'null'::jsonb THEN
    FOR v_claim IN SELECT value FROM jsonb_array_elements(p_slice->'groundedClaims') LOOP
      IF NOT public.intentlead_jsonb_keys_allowed(v_claim,ARRAY['text','evidenceIds'])
        OR NOT (v_claim ?& ARRAY['text','evidenceIds'])
        OR jsonb_typeof(v_claim->'evidenceIds')<>'array'
      THEN RAISE EXCEPTION 'invalid_grounded_claim'; END IF;
      v_claim_refs:=ARRAY(
        SELECT jsonb_array_elements_text(v_claim->'evidenceIds')::uuid
      );
      IF cardinality(v_claim_refs)=0
        OR cardinality(v_claim_refs)<>(
          SELECT count(DISTINCT value) FROM unnest(v_claim_refs) value
        )
        OR EXISTS (
          SELECT 1 FROM unnest(v_claim_refs) value
          WHERE NOT value=ANY(v_assessment_evidence)
        )
        OR NOT public.intentlead_claim_supported(
          v_claim->>'text',p_slice->'evidenceItems',v_claim_refs
        )
      THEN RAISE EXCEPTION 'unsupported_grounded_claim'; END IF;
    END LOOP;
    IF EXISTS (
      SELECT 1 FROM unnest(v_assessment_evidence) assessment_evidence(evidence_id)
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_slice->'groundedClaims') claim(value)
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(claim.value->'evidenceIds') reference(value)
          WHERE reference.value::uuid=assessment_evidence.evidence_id
        )
      )
    ) THEN RAISE EXCEPTION 'ungrounded_assessment_evidence'; END IF;
    IF regexp_replace(lower(v_assessment->>'problemStatement'),'[^[:alnum:]]+','','g') NOT IN (
      SELECT regexp_replace(lower(value->>'text'),'[^[:alnum:]]+','','g')
      FROM jsonb_array_elements(p_slice->'groundedClaims')
    ) THEN RAISE EXCEPTION 'unsupported_problem_statement'; END IF;
  END IF;

  IF jsonb_typeof(v_company)='object' THEN
    SELECT id,canonical_name INTO v_company_id,v_company_name FROM public.intentlead_companies
    WHERE workspace_id=v_workspace AND lower(domain)=lower(v_company->>'domain') FOR UPDATE;
    IF FOUND THEN
      IF v_company_name<>btrim(v_company->>'canonicalName')
      THEN RAISE EXCEPTION 'company_domain_identity_conflict'; END IF;
    ELSE
      v_company_id:=(v_company->>'id')::uuid;
      INSERT INTO public.intentlead_companies(
        id,workspace_id,canonical_name,domain,jurisdiction,confidence
      ) VALUES (
        v_company_id,v_workspace,btrim(v_company->>'canonicalName'),lower(btrim(v_company->>'domain')),NULL,
        (v_company->>'confidence')::numeric
      );
    END IF;
  END IF;

  INSERT INTO public.intentlead_opportunities(
    id,workspace_id,discovery_brief_id,company_id,current_assessment_id,state,signal,jurisdiction,
    created_at,updated_at
  ) VALUES (
    v_opportunity_id,v_workspace,v_brief.id,v_company_id,v_assessment_id,v_state,
    v_opportunity->'signal',NULL,(v_opportunity->>'createdAt')::timestamptz,
    (v_opportunity->>'updatedAt')::timestamptz
  );
  INSERT INTO public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id)
  SELECT v_workspace,v_opportunity_id,value FROM unnest(v_opportunity_evidence) value;
  IF v_assessment_id IS NOT NULL THEN
    INSERT INTO public.intentlead_opportunity_assessments(
      id,workspace_id,opportunity_id,version,decision,signal,problem_type,problem_statement,
      evidence_strength,explicitness,urgency,freshness,commercial_impact,icp_fit,
      company_confidence,buyer_relevance,actionability,confidence,rejection_reasons,
      review_reasons,model_run_id,assessed_at
    ) VALUES (
      v_assessment_id,v_workspace,v_opportunity_id,1,v_decision,v_opportunity->'signal',
      v_assessment->>'problemType',v_assessment->>'problemStatement',
      (v_assessment->>'evidenceStrength')::numeric,(v_assessment->>'explicitness')::numeric,
      (v_assessment->>'urgency')::numeric,(v_assessment->>'freshness')::numeric,
      (v_assessment->>'commercialImpact')::numeric,(v_assessment->>'icpFit')::numeric,
      (v_assessment->>'companyConfidence')::numeric,(v_assessment->>'buyerRelevance')::numeric,
      (v_assessment->>'actionability')::numeric,(v_assessment->>'confidence')::numeric,
      v_rejection,v_review,(v_assessment->>'modelRunId')::uuid,
      (v_assessment->>'assessedAt')::timestamptz
    );
    INSERT INTO public.intentlead_assessment_evidence(
      workspace_id,assessment_id,opportunity_id,evidence_id
    ) SELECT v_workspace,v_assessment_id,v_opportunity_id,value
      FROM unnest(v_assessment_evidence) value;
  END IF;
  INSERT INTO public.intentlead_job_candidate_results(
    workspace_id,job_id,candidate_key,input_hash,opportunity_id,opportunity_state,
    model_decision,policy_reasons,grounded_claims
  ) VALUES (
    v_workspace,p_job_id,p_candidate_key,v_hash,v_opportunity_id,v_state,
    p_slice->>'modelDecision',v_policy_reasons,
    CASE WHEN p_slice->'groundedClaims'='null'::jsonb THEN '[]'::jsonb ELSE p_slice->'groundedClaims' END
  );
  RETURN v_opportunity_id;
EXCEPTION
  WHEN invalid_text_representation OR datetime_field_overflow OR numeric_value_out_of_range
    OR array_subscript_error
  THEN RAISE EXCEPTION 'invalid_candidate_shape';
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_persist_self_prospecting_candidate(uuid,text,uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_persist_self_prospecting_candidate(uuid,text,uuid,text,jsonb)
  TO service_role;

-- Remove callable legacy helpers before their referenced graph disappears.
DROP FUNCTION IF EXISTS public.intentlead_charge_verified_package(uuid,uuid,text);
DROP FUNCTION IF EXISTS public.verify_lead_and_charge_credit(uuid,uuid);
DROP FUNCTION IF EXISTS public.intentlead_consume_chat_quota(uuid,uuid);
DROP FUNCTION IF EXISTS public.intentlead_persist_discovery_slice(uuid,text,uuid,uuid,text,jsonb);
DROP FUNCTION IF EXISTS public.intentlead_discovery_setup_for_campaign(uuid);
DROP FUNCTION IF EXISTS public.intentlead_legacy_campaign_is_discovery_only(uuid);
DO $$
DECLARE v_signature regprocedure;
BEGIN
  FOR v_signature IN
    SELECT p.oid::regprocedure FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='match_chunks'
  LOOP
    EXECUTE format('DROP FUNCTION %s',v_signature);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.intentlead_delete_discovery_brief_taskc_v4(uuid,uuid,text);
DROP FUNCTION IF EXISTS public.intentlead_delete_discovery_brief_task8_v3(uuid,uuid,text);
DROP FUNCTION IF EXISTS public.intentlead_delete_discovery_brief_task7_v2(uuid,uuid,text);
DROP FUNCTION IF EXISTS public.intentlead_delete_discovery_brief_task5_v1(uuid,uuid,text);
DROP FUNCTION IF EXISTS public.intentlead_persist_self_prospecting_candidate_task7_v1(uuid,text,uuid,text,jsonb);
DROP FUNCTION IF EXISTS public.intentlead_task7_company_evidence_bound(jsonb);
DROP FUNCTION IF EXISTS public.intentlead_task7_claim_supported(text,jsonb,uuid[]);

-- Reverse dependency order for the retired personal-contact/outreach/package graph.
DROP TABLE IF EXISTS public.intentlead_package_check_evidence;
DROP TABLE IF EXISTS public.intentlead_package_check_results;
DROP TABLE IF EXISTS public.intentlead_verified_packages;
DROP TABLE IF EXISTS public.intentlead_verification_policies;
DROP TABLE IF EXISTS public.intentlead_suppression_decisions;
DROP TABLE IF EXISTS public.intentlead_outreach_draft_claims;
DROP TABLE IF EXISTS public.intentlead_outreach_drafts;
DROP TABLE IF EXISTS public.intentlead_contact_verification_evidence;
DROP TABLE IF EXISTS public.intentlead_contact_verifications;
DROP TABLE IF EXISTS public.intentlead_contact_point_evidence;
DROP TABLE IF EXISTS public.intentlead_contact_points;
DROP TABLE IF EXISTS public.intentlead_buyer_candidate_evidence;
DROP TABLE IF EXISTS public.intentlead_buyer_candidates;
DROP TABLE IF EXISTS public.intentlead_people;
DROP TABLE IF EXISTS public.intentlead_outcomes;
DROP TABLE IF EXISTS public.intentlead_suppression_entries;

-- Detach the last bridge, then remove the original lead/chat storage.
ALTER TABLE public.intentlead_discovery_briefs
  DROP CONSTRAINT IF EXISTS intentlead_discovery_brief_campaign_workspace_fk,
  DROP CONSTRAINT IF EXISTS intentlead_discovery_briefs_legacy_campaign_id_fkey,
  DROP COLUMN IF EXISTS legacy_campaign_id;
DROP INDEX IF EXISTS public.intentlead_campaigns_workspace_id_id_uq;

DROP TABLE IF EXISTS public.conversation_messages;
DROP TABLE IF EXISTS public.conversations;
DROP TABLE IF EXISTS public.client_context_chunks;
DROP TABLE IF EXISTS public.messages;
DROP TABLE IF EXISTS public.leads;
DROP TABLE IF EXISTS public.signals;
DROP TABLE IF EXISTS public.campaigns;

ALTER TABLE public.workspaces
  DROP COLUMN IF EXISTS chat_messages_today,
  DROP COLUMN IF EXISTS chat_messages_reset_at,
  DROP COLUMN IF EXISTS credits_remaining,
  DROP COLUMN IF EXISTS free_converter_used,
  DROP COLUMN IF EXISTS plan;

-- Worker replay protection is deliberately retained and remains RPC-only.
REVOKE ALL ON TABLE public.intentlead_worker_nonces FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.intentlead_claim_worker_nonce(uuid,bigint)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_claim_worker_nonce(uuid,bigint) TO service_role;
