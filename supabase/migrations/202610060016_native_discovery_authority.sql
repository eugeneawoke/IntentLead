-- Task C: make DiscoveryBrief the only active discovery authority.
-- Historical campaign-linked rows remain readable for Task E reconciliation, but
-- no native command, context, enqueue, or lifecycle transition touches campaigns.

ALTER TABLE public.intentlead_discovery_briefs
  ADD COLUMN creation_key text,
  ADD COLUMN creation_fingerprint text,
  ADD COLUMN deleted_at timestamptz,
  ADD CONSTRAINT intentlead_discovery_creation_identity_check CHECK (
    (creation_key IS NULL AND creation_fingerprint IS NULL)
    OR (creation_key ~ '^[A-Za-z0-9._:-]{12,128}$' AND creation_fingerprint ~ '^[a-f0-9]{32}$')
  );

CREATE UNIQUE INDEX intentlead_discovery_brief_creation_key_uq
  ON public.intentlead_discovery_briefs(workspace_id, creation_key)
  WHERE creation_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.intentlead_create_discovery_brief(
  p_command jsonb,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_existing public.intentlead_discovery_briefs%ROWTYPE;
  v_offer_id uuid;
  v_icp_id uuid;
  v_market_id uuid;
  v_brief_id uuid;
  v_offer_version integer;
  v_icp_version integer;
  v_market_version integer;
  v_fingerprint text;
  v_capabilities text[] := ARRAY[
    'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW'
  ]::text[];
  v_disabled text[] := ARRAY[
    'PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION',
    'OUTREACH_READY','OUTREACH_SEND','OUTCOME_RECORDING','PACKAGE_VERIFIED'
  ]::text[];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='28000'; END IF;
  IF p_idempotency_key IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{12,128}$'
    OR p_command IS NULL OR jsonb_typeof(p_command) <> 'object'
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
    OR jsonb_array_length(p_command#>'{offer,outcomes}') > 20
    OR jsonb_typeof(p_command#>'{offer,exclusions}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command#>'{offer,exclusions}') > 20
    OR jsonb_typeof(p_command#>'{icp,companyAttributes}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command#>'{icp,companyAttributes}') > 30
    OR jsonb_typeof(p_command#>'{icp,exclusions}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command#>'{icp,exclusions}') > 20
    OR jsonb_typeof(p_command#>'{criteria,jurisdictions}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command#>'{criteria,jurisdictions}') > 30
    OR jsonb_typeof(p_command#>'{criteria,languages}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command#>'{criteria,languages}') NOT BETWEEN 1 AND 10
    OR jsonb_typeof(p_command#>'{criteria,signalFamilies}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command#>'{criteria,signalFamilies}') NOT BETWEEN 1 AND 4
    OR jsonb_typeof(p_command#>'{criteria,exclusions}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_command#>'{criteria,exclusions}') > 30
    OR jsonb_typeof(p_command#>'{criteria,limits}') IS DISTINCT FROM 'object'
    OR coalesce(p_command#>>'{criteria,limits,maxSourceItems}','') !~ '^[0-9]+$'
    OR coalesce(p_command#>>'{criteria,limits,maxOpportunities}','') !~ '^[0-9]+$'
    OR (p_command#>>'{criteria,limits,maxSourceItems}')::integer NOT BETWEEN 1 AND 500
    OR (p_command#>>'{criteria,limits,maxOpportunities}')::integer NOT BETWEEN 1 AND 100
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_command#>'{criteria,signalFamilies}') value
      WHERE jsonb_typeof(value)<>'string'
        OR value#>>'{}' NOT IN ('EXPRESSED_INTENT','BUSINESS_EVENT','DETECTED_PROBLEM','MARKET_OBSERVATION')
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_command#>'{criteria,languages}') value
      WHERE jsonb_typeof(value)<>'string' OR value#>>'{}' !~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        (p_command#>'{offer,outcomes}') || (p_command#>'{offer,exclusions}')
        || (p_command#>'{icp,companyAttributes}') || (p_command#>'{icp,exclusions}')
        || (p_command#>'{criteria,exclusions}')
      ) value
      WHERE jsonb_typeof(value)<>'string' OR length(btrim(value#>>'{}')) NOT BETWEEN 1 AND 500
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_command#>'{criteria,jurisdictions}') value
      WHERE jsonb_typeof(value) <> 'object' OR coalesce(value->>'countryCode','') !~ '^[A-Z]{2}$'
        OR value - 'countryCode' - 'subdivisionCode' <> '{}'::jsonb
        OR NOT value ? 'subdivisionCode'
        OR jsonb_typeof(value->'subdivisionCode') NOT IN ('string','null')
        OR (jsonb_typeof(value->'subdivisionCode')='string'
          AND length(btrim(value->>'subdivisionCode')) NOT BETWEEN 1 AND 20)
    )
  THEN RAISE EXCEPTION 'invalid_discovery_command' USING ERRCODE='22023'; END IF;

  v_fingerprint := md5(p_command::text);
  PERFORM pg_advisory_xact_lock(hashtextextended('intentlead-native-discovery:' || v_user_id::text, 0));

  SELECT id INTO v_workspace_id FROM public.workspaces
  WHERE owner_id=v_user_id ORDER BY created_at,id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.workspaces(owner_id,name) VALUES (v_user_id,'My Workspace') RETURNING id INTO v_workspace_id;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('intentlead-workspace:' || v_workspace_id::text, 0));

  SELECT * INTO v_existing FROM public.intentlead_discovery_briefs
  WHERE workspace_id=v_workspace_id AND creation_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.creation_fingerprint <> v_fingerprint THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='40001'; END IF;
    RETURN jsonb_build_object(
      'discoveryBriefId',v_existing.id,'workspaceId',v_existing.workspace_id,
      'offerProfileId',v_existing.offer_profile_id,'icpDefinitionId',v_existing.icp_definition_id,
      'marketProfileId',v_existing.market_profile_id,'created',false
    );
  END IF;

  SELECT coalesce(max(version),0)+1 INTO v_offer_version FROM public.intentlead_offer_profiles
  WHERE workspace_id=v_workspace_id AND name=btrim(p_command#>>'{offer,name}');
  INSERT INTO public.intentlead_offer_profiles(workspace_id,version,name,definition)
  VALUES (v_workspace_id,v_offer_version,btrim(p_command#>>'{offer,name}'),jsonb_build_object(
    'summary',btrim(p_command#>>'{offer,summary}'),
    'outcomes',p_command#>'{offer,outcomes}','exclusions',p_command#>'{offer,exclusions}'
  )) RETURNING id INTO v_offer_id;

  SELECT coalesce(max(version),0)+1 INTO v_icp_version FROM public.intentlead_icp_definitions
  WHERE workspace_id=v_workspace_id AND name=btrim(p_command#>>'{icp,name}');
  INSERT INTO public.intentlead_icp_definitions(workspace_id,version,name,definition)
  VALUES (v_workspace_id,v_icp_version,btrim(p_command#>>'{icp,name}'),jsonb_build_object(
    'description',btrim(p_command#>>'{icp,description}'),
    'companyAttributes',p_command#>'{icp,companyAttributes}','exclusions',p_command#>'{icp,exclusions}'
  )) RETURNING id INTO v_icp_id;

  SELECT coalesce(max(version),0)+1 INTO v_market_version FROM public.intentlead_market_profiles
  WHERE workspace_id=v_workspace_id AND profile_key='EN_DISCOVERY_ONLY';
  INSERT INTO public.intentlead_market_profiles(
    workspace_id,version,profile_key,workflow,configuration,capabilities,disabled_capabilities
  ) VALUES (
    v_workspace_id,v_market_version,'EN_DISCOVERY_ONLY','DISCOVERY_ONLY',jsonb_build_object(
      'jurisdictions',p_command#>'{criteria,jurisdictions}','regions','[]'::jsonb,
      'languages',p_command#>'{criteria,languages}','legalPolicyId','en-discovery-legal-v1',
      'retentionPolicyId','en-discovery-retention-v1','outreachPolicyId',NULL,
      'outreachChannels','[]'::jsonb,'defaultCurrency','USD','timezone','UTC'
    ),v_capabilities,v_disabled
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
    'discoveryBriefId',v_brief_id,'workspaceId',v_workspace_id,'offerProfileId',v_offer_id,
    'icpDefinitionId',v_icp_id,'marketProfileId',v_market_id,'created',true
  );
END;
$$;

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
  WHERE b.id=p_discovery_brief_id AND b.legacy_campaign_id IS NULL
    AND b.deleted_at IS NULL AND w.owner_id=auth.uid()
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
  WHERE b.legacy_campaign_id IS NULL AND b.deleted_at IS NULL AND w.owner_id=auth.uid()
  ORDER BY b.created_at DESC,b.id DESC
$$;

CREATE OR REPLACE FUNCTION public.intentlead_enqueue_discovery_job(
  p_discovery_brief_id uuid,
  p_user_id uuid,
  p_idempotency_key text,
  p_payload jsonb DEFAULT '{}'::jsonb
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
  WHERE b.id=p_discovery_brief_id AND b.legacy_campaign_id IS NULL
    AND b.deleted_at IS NULL AND w.owner_id=p_user_id
  FOR UPDATE OF b,w;
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
    v_brief.workspace_id,v_brief.id,
    (SELECT profile_key FROM public.intentlead_market_profiles
      WHERE id=v_brief.market_profile_id AND workspace_id=v_brief.workspace_id),
    'SOURCE_SEARCH','OPPORTUNITY_DISCOVERY',p_payload,p_idempotency_key,v_input_hash
  ) RETURNING * INTO v_job;
  UPDATE public.intentlead_discovery_briefs SET state='QUEUED' WHERE id=v_brief.id;
  RETURN v_job.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_sync_job_terminal_state(
  p_workspace_id uuid,
  p_discovery_brief_id uuid,
  p_terminal_state text
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
    AND legacy_campaign_id IS NULL
    AND (state IN ('DRAFT','QUEUED','RUNNING') OR state=v_brief_state);
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.intentlead_delete_discovery_brief_taskc_v4(uuid,uuid,text)') IS NULL THEN
    ALTER FUNCTION public.intentlead_delete_discovery_brief(uuid,uuid,text)
      RENAME TO intentlead_delete_discovery_brief_taskc_v4;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.intentlead_delete_discovery_brief_taskc_v4(uuid,uuid,text)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.intentlead_delete_discovery_brief(
  p_discovery_brief_id uuid,p_user_id uuid,p_reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_brief public.intentlead_discovery_briefs%ROWTYPE;
BEGIN
  SELECT b.* INTO v_brief FROM public.intentlead_discovery_briefs b
  JOIN public.workspaces w ON w.id=b.workspace_id
  WHERE b.id=p_discovery_brief_id AND b.legacy_campaign_id IS NULL AND w.owner_id=p_user_id
  FOR UPDATE OF b,w;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF NOT public.intentlead_delete_discovery_brief_taskc_v4(p_discovery_brief_id,p_user_id,p_reason) THEN
    RETURN false;
  END IF;
  UPDATE public.intentlead_discovery_briefs
    SET deleted_at=coalesce(deleted_at,clock_timestamp())
    WHERE id=p_discovery_brief_id AND workspace_id=v_brief.workspace_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.intentlead_discovery_briefs b
    WHERE b.workspace_id=v_brief.workspace_id AND b.offer_profile_id=v_brief.offer_profile_id
      AND b.id<>p_discovery_brief_id AND b.deleted_at IS NULL
  ) THEN
    UPDATE public.intentlead_offer_profiles
      SET name='deleted:' || id::text,definition='{}'::jsonb,
          archived_at=coalesce(archived_at,clock_timestamp())
      WHERE id=v_brief.offer_profile_id AND workspace_id=v_brief.workspace_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.intentlead_discovery_briefs b
    WHERE b.workspace_id=v_brief.workspace_id AND b.icp_definition_id=v_brief.icp_definition_id
      AND b.id<>p_discovery_brief_id AND b.deleted_at IS NULL
  ) THEN
    UPDATE public.intentlead_icp_definitions
      SET name='deleted:' || id::text,definition='{}'::jsonb,
          archived_at=coalesce(archived_at,clock_timestamp())
      WHERE id=v_brief.icp_definition_id AND workspace_id=v_brief.workspace_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.intentlead_discovery_briefs b
    WHERE b.workspace_id=v_brief.workspace_id AND b.market_profile_id=v_brief.market_profile_id
      AND b.id<>p_discovery_brief_id AND b.deleted_at IS NULL
  ) THEN
    UPDATE public.intentlead_market_profiles SET configuration=jsonb_build_object(
      'jurisdictions','[]'::jsonb,'regions','[]'::jsonb,'languages','["en"]'::jsonb,
      'legalPolicyId','en-discovery-legal-v1','retentionPolicyId','en-discovery-retention-v1',
      'outreachPolicyId',NULL,'outreachChannels','[]'::jsonb,'defaultCurrency','USD','timezone','UTC'
    ) WHERE id=v_brief.market_profile_id AND workspace_id=v_brief.workspace_id;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.intentlead_create_discovery_brief(jsonb,text) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.intentlead_discovery_context(uuid) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.intentlead_list_discovery_briefs() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.intentlead_create_discovery_brief(jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_discovery_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_list_discovery_briefs() TO authenticated;

REVOKE ALL ON FUNCTION public.intentlead_enqueue_discovery_job(uuid,uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_enqueue_discovery_job(uuid,uuid,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.intentlead_sync_job_terminal_state(uuid,uuid,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.intentlead_delete_discovery_brief(uuid,uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_delete_discovery_brief(uuid,uuid,text) TO service_role;
