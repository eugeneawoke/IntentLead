-- Task K2: service-role-only persistence of a fully human-approved V2 brief.
-- The existing authenticated V1 RPC is intentionally untouched.

CREATE OR REPLACE FUNCTION public.intentlead_valid_approved_discovery_v2(p jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE
  a jsonb:=p#>'{criteria,intakeApproval}';
  markets jsonb:=p#>'{criteria,intakeApproval,marketMappings}';
  languages jsonb:=p#>'{criteria,intakeApproval,languageMappings}';
  exclusions jsonb:=p#>'{criteria,intakeApproval,exclusionMappings}';
  actual jsonb;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object' OR p->>'schemaVersion' IS DISTINCT FROM '2'
    OR p-ARRAY['schemaVersion','offer','icp','objective','criteria']<>'{}'::jsonb
    OR jsonb_typeof(p->'offer') IS DISTINCT FROM 'object' OR jsonb_typeof(p->'icp') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p->'criteria') IS DISTINCT FROM 'object'
    OR (p->'offer')-ARRAY['name','summary','outcomes','exclusions']<>'{}'::jsonb
    OR (p->'icp')-ARRAY['name','description','targetBuyerDescription','companyAttributes','exclusions']<>'{}'::jsonb
    OR (p->'criteria')-ARRAY['schemaVersion','jurisdictions','marketIntent','languages','signalFamilies',
      'exclusions','requestedConfirmedSignals','limits','intakeApproval']<>'{}'::jsonb
    OR p#>>'{criteria,schemaVersion}' IS DISTINCT FROM '2'
    OR length(btrim(coalesce(p#>>'{offer,name}',''))) NOT BETWEEN 1 AND 120
    OR length(btrim(coalesce(p#>>'{offer,summary}',''))) NOT BETWEEN 1 AND 500
    OR length(btrim(coalesce(p#>>'{icp,name}',''))) NOT BETWEEN 1 AND 120
    OR length(btrim(coalesce(p#>>'{icp,description}',''))) NOT BETWEEN 1 AND 500
    OR length(btrim(coalesce(p->>'objective',''))) NOT BETWEEN 1 AND 500
    OR NOT ((p->'icp')?'targetBuyerDescription')
    OR jsonb_typeof(p#>'{icp,targetBuyerDescription}') NOT IN ('string','null')
    OR (jsonb_typeof(p#>'{icp,targetBuyerDescription}')='string'
      AND length(btrim(p#>>'{icp,targetBuyerDescription}')) NOT BETWEEN 1 AND 500)
  THEN RETURN false; END IF;

  IF jsonb_typeof(p#>'{offer,outcomes}') IS DISTINCT FROM 'array' OR jsonb_array_length(p#>'{offer,outcomes}')>20
    OR jsonb_typeof(p#>'{offer,exclusions}') IS DISTINCT FROM 'array' OR jsonb_array_length(p#>'{offer,exclusions}')>20
    OR jsonb_typeof(p#>'{icp,companyAttributes}') IS DISTINCT FROM 'array' OR jsonb_array_length(p#>'{icp,companyAttributes}')>30
    OR jsonb_typeof(p#>'{icp,exclusions}') IS DISTINCT FROM 'array' OR jsonb_array_length(p#>'{icp,exclusions}')>20
    OR jsonb_typeof(p#>'{criteria,exclusions}') IS DISTINCT FROM 'array' OR jsonb_array_length(p#>'{criteria,exclusions}')>30
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(
      (p#>'{offer,outcomes}')||(p#>'{offer,exclusions}')||(p#>'{icp,companyAttributes}')
      ||(p#>'{icp,exclusions}')||(p#>'{criteria,exclusions}')) value
      WHERE jsonb_typeof(value) IS DISTINCT FROM 'string' OR length(btrim(value#>>'{}')) NOT BETWEEN 1 AND 500)
  THEN RETURN false; END IF;

  IF jsonb_typeof(p#>'{criteria,jurisdictions}') IS DISTINCT FROM 'array' OR jsonb_array_length(p#>'{criteria,jurisdictions}')>30
    OR jsonb_typeof(p#>'{criteria,marketIntent}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p#>'{criteria,marketIntent}') NOT BETWEEN 1 AND 10
    OR jsonb_typeof(p#>'{criteria,languages}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p#>'{criteria,languages}') NOT BETWEEN 1 AND 10
    OR jsonb_typeof(p#>'{criteria,signalFamilies}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p#>'{criteria,signalFamilies}') NOT BETWEEN 1 AND 4
    OR jsonb_typeof(p#>'{criteria,limits}') IS DISTINCT FROM 'object'
    OR (p#>'{criteria,limits}')-ARRAY['maxSourceItems','maxOpportunities']<>'{}'::jsonb
    OR coalesce(p#>>'{criteria,requestedConfirmedSignals}','') !~ '^[0-9]+$'
    OR (p#>>'{criteria,requestedConfirmedSignals}')::integer NOT BETWEEN 20 AND 500
    OR coalesce(p#>>'{criteria,limits,maxSourceItems}','') !~ '^[0-9]+$'
    OR (p#>>'{criteria,limits,maxSourceItems}')::integer NOT BETWEEN 1 AND 500
    OR coalesce(p#>>'{criteria,limits,maxOpportunities}','') !~ '^[0-9]+$'
    OR (p#>>'{criteria,limits,maxOpportunities}')::integer NOT BETWEEN 1 AND 100
  THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p#>'{criteria,jurisdictions}') value
      WHERE jsonb_typeof(value) IS DISTINCT FROM 'object' OR value-'countryCode'-'subdivisionCode'<>'{}'::jsonb
        OR coalesce(value->>'countryCode','') !~ '^[A-Z]{2}$' OR NOT value?'subdivisionCode'
        OR jsonb_typeof(value->'subdivisionCode') NOT IN ('string','null')
        OR (jsonb_typeof(value->'subdivisionCode')='string'
          AND length(btrim(value->>'subdivisionCode')) NOT BETWEEN 1 AND 20))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p#>'{criteria,marketIntent}') value
      WHERE jsonb_typeof(value) IS DISTINCT FROM 'string' OR length(btrim(value#>>'{}')) NOT BETWEEN 1 AND 120)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p#>'{criteria,languages}') value
      WHERE jsonb_typeof(value) IS DISTINCT FROM 'string' OR value#>>'{}' !~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$')
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p#>'{criteria,signalFamilies}') value
      WHERE jsonb_typeof(value) IS DISTINCT FROM 'string'
        OR value#>>'{}' NOT IN ('EXPRESSED_INTENT','BUSINESS_EVENT','DETECTED_PROBLEM','MARKET_OBSERVATION'))
  THEN RETURN false; END IF;

  IF jsonb_typeof(a) IS DISTINCT FROM 'object' OR a-ARRAY['reviewFingerprint','requestFingerprint','humanApproved','prompt',
      'telemetry','marketMappings','languageMappings','exclusionMappings']<>'{}'::jsonb
    OR coalesce(a->>'reviewFingerprint','') !~ '^[a-f0-9]{64}$'
    OR coalesce(a->>'requestFingerprint','') !~ '^[a-f0-9]{64}$' OR a->'humanApproved' IS DISTINCT FROM 'true'::jsonb
    OR jsonb_typeof(a->'prompt') IS DISTINCT FROM 'object' OR (a->'prompt')-ARRAY[
      'templateId','version','systemInstructionHash','userContentRole']<>'{}'::jsonb
    OR length(btrim(coalesce(a#>>'{prompt,templateId}',''))) NOT BETWEEN 1 AND 100
    OR length(btrim(coalesce(a#>>'{prompt,version}',''))) NOT BETWEEN 1 AND 100
    OR coalesce(a#>>'{prompt,systemInstructionHash}','') !~ '^[a-f0-9]{64}$'
    OR a#>>'{prompt,userContentRole}' IS DISTINCT FROM 'UNTRUSTED_USER'
    OR jsonb_typeof(a->'telemetry') IS DISTINCT FROM 'object'
    OR (a->'telemetry')-ARRAY['model','modelVersion','inputTokens','outputTokens','latencyMs','cost','limitations']<>'{}'::jsonb
    OR length(btrim(coalesce(a#>>'{telemetry,model}',''))) NOT BETWEEN 1 AND 200
    OR length(btrim(coalesce(a#>>'{telemetry,modelVersion}',''))) NOT BETWEEN 1 AND 100
    OR coalesce(a#>>'{telemetry,inputTokens}','') !~ '^[0-9]+$'
    OR coalesce(a#>>'{telemetry,outputTokens}','') !~ '^[0-9]+$'
    OR coalesce(a#>>'{telemetry,latencyMs}','') !~ '^[0-9]+$'
    OR jsonb_typeof(a#>'{telemetry,cost}') IS DISTINCT FROM 'object'
    OR (a#>'{telemetry,cost}')-ARRAY['amount','currency']<>'{}'::jsonb
    OR jsonb_typeof(a#>'{telemetry,cost,amount}') IS DISTINCT FROM 'number'
    OR (a#>>'{telemetry,cost,amount}')::numeric<0
    OR coalesce(a#>>'{telemetry,cost,currency}','') !~ '^[A-Z]{3}$'
    OR jsonb_typeof(a#>'{telemetry,limitations}') IS DISTINCT FROM 'array'
    OR jsonb_array_length(a#>'{telemetry,limitations}')>20
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(a#>'{telemetry,limitations}') value
      WHERE jsonb_typeof(value) IS DISTINCT FROM 'string'
        OR length(btrim(value#>>'{}')) NOT BETWEEN 1 AND 500)
  THEN RETURN false; END IF;

  IF jsonb_typeof(markets) IS DISTINCT FROM 'array' OR jsonb_array_length(markets) NOT BETWEEN 1 AND 10
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(markets) item WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR item-ARRAY['marketIntent','scope','jurisdictions']<>'{}'::jsonb
      OR jsonb_typeof(item->'marketIntent') IS DISTINCT FROM 'string' OR length(btrim(item->>'marketIntent')) NOT BETWEEN 1 AND 120
      OR coalesce(item->>'scope','') NOT IN ('GLOBAL','JURISDICTIONS') OR jsonb_typeof(item->'jurisdictions') IS DISTINCT FROM 'array')
  THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(markets) item
      WHERE (item->>'scope'='GLOBAL' AND jsonb_array_length(item->'jurisdictions')<>0)
        OR (item->>'scope'='JURISDICTIONS' AND jsonb_array_length(item->'jurisdictions') NOT BETWEEN 1 AND 30))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(markets) market,
      LATERAL jsonb_array_elements(market->'jurisdictions') j
      WHERE jsonb_typeof(j) IS DISTINCT FROM 'object' OR j-'countryCode'-'subdivisionCode'<>'{}'::jsonb
        OR coalesce(j->>'countryCode','') !~ '^[A-Z]{2}$' OR NOT j?'subdivisionCode'
        OR jsonb_typeof(j->'subdivisionCode') NOT IN ('string','null'))
  THEN RETURN false; END IF;
  SELECT coalesce(jsonb_agg(item->'marketIntent' ORDER BY n),'[]'::jsonb) INTO actual
    FROM jsonb_array_elements(markets) WITH ORDINALITY mapped(item,n);
  IF actual IS DISTINCT FROM p#>'{criteria,marketIntent}' THEN RETURN false; END IF;
  SELECT coalesce(jsonb_agg(j ORDER BY mn,jn),'[]'::jsonb) INTO actual
    FROM jsonb_array_elements(markets) WITH ORDINALITY mapped(item,mn)
    CROSS JOIN LATERAL jsonb_array_elements(mapped.item->'jurisdictions') WITH ORDINALITY nested(j,jn);
  IF actual IS DISTINCT FROM p#>'{criteria,jurisdictions}' THEN RETURN false; END IF;

  IF jsonb_typeof(languages) IS DISTINCT FROM 'array' OR jsonb_array_length(languages)>10
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(languages) item WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR coalesce(item->>'source','') NOT IN ('USER_STATED','HUMAN_ADDED')
      OR coalesce(item->>'language','') !~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'
      OR (item->>'source'='USER_STATED' AND (item-ARRAY['source','languageIntent','language']<>'{}'::jsonb
        OR jsonb_typeof(item->'languageIntent') IS DISTINCT FROM 'string' OR length(btrim(item->>'languageIntent')) NOT BETWEEN 1 AND 80))
      OR (item->>'source'='HUMAN_ADDED' AND (item-ARRAY['source','languageIntent','language','rationale']<>'{}'::jsonb
        OR jsonb_typeof(item->'languageIntent') IS DISTINCT FROM 'null' OR length(btrim(coalesce(item->>'rationale',''))) NOT BETWEEN 1 AND 500)))
    OR (SELECT count(*) FROM jsonb_array_elements(languages))
      <> (SELECT count(DISTINCT item->>'language') FROM jsonb_array_elements(languages) item)
  THEN RETURN false; END IF;
  SELECT coalesce(jsonb_agg(item->'language' ORDER BY n),'[]'::jsonb) INTO actual
    FROM jsonb_array_elements(languages) WITH ORDINALITY mapped(item,n);
  IF actual IS DISTINCT FROM p#>'{criteria,languages}' THEN RETURN false; END IF;

  IF jsonb_typeof(exclusions) IS DISTINCT FROM 'array' OR jsonb_array_length(exclusions)>30
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(exclusions) item WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR item-ARRAY['exclusion','destination']<>'{}'::jsonb OR jsonb_typeof(item->'exclusion') IS DISTINCT FROM 'string'
      OR length(btrim(item->>'exclusion')) NOT BETWEEN 1 AND 500
      OR coalesce(item->>'destination','') NOT IN ('OFFER','ICP','DISCOVERY'))
  THEN RETURN false; END IF;
  SELECT coalesce(jsonb_agg(item->'exclusion' ORDER BY n) FILTER (WHERE item->>'destination'='OFFER'),'[]'::jsonb)
    INTO actual FROM jsonb_array_elements(exclusions) WITH ORDINALITY mapped(item,n);
  IF actual IS DISTINCT FROM p#>'{offer,exclusions}' THEN RETURN false; END IF;
  SELECT coalesce(jsonb_agg(item->'exclusion' ORDER BY n) FILTER (WHERE item->>'destination'='ICP'),'[]'::jsonb)
    INTO actual FROM jsonb_array_elements(exclusions) WITH ORDINALITY mapped(item,n);
  IF actual IS DISTINCT FROM p#>'{icp,exclusions}' THEN RETURN false; END IF;
  SELECT coalesce(jsonb_agg(item->'exclusion' ORDER BY n) FILTER (WHERE item->>'destination'='DISCOVERY'),'[]'::jsonb)
    INTO actual FROM jsonb_array_elements(exclusions) WITH ORDINALITY mapped(item,n);
  IF actual IS DISTINCT FROM p#>'{criteria,exclusions}' THEN RETURN false; END IF;
  RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_valid_approved_discovery_v2(jsonb)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.intentlead_create_approved_discovery_brief(
  p_user_id uuid,p_command jsonb,p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_workspace_id uuid; v_existing public.intentlead_discovery_briefs%ROWTYPE;
  v_offer_id uuid; v_icp_id uuid; v_market_id uuid; v_brief_id uuid;
  v_offer_version integer; v_icp_version integer; v_market_version integer;
  v_fingerprint text:=md5(p_command::text);
  v_capabilities text[]:=ARRAY['SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW'];
BEGIN
  IF p_user_id IS NULL OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{12,128}$'
    OR NOT public.intentlead_valid_approved_discovery_v2(p_command)
    OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_user_id)
  THEN RAISE EXCEPTION 'invalid_approved_discovery_command' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('intentlead-approved-discovery:'||p_user_id::text,0));
  SELECT id INTO v_workspace_id FROM public.workspaces WHERE owner_id=p_user_id ORDER BY created_at,id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN INSERT INTO public.workspaces(owner_id,name) VALUES(p_user_id,'My Workspace') RETURNING id INTO v_workspace_id; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('intentlead-workspace:'||v_workspace_id::text,0));
  SELECT * INTO v_existing FROM public.intentlead_discovery_briefs
    WHERE workspace_id=v_workspace_id AND creation_key=p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.creation_fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='40001'; END IF;
    RETURN jsonb_build_object('discoveryBriefId',v_existing.id,'workspaceId',v_existing.workspace_id,
      'offerProfileId',v_existing.offer_profile_id,'icpDefinitionId',v_existing.icp_definition_id,
      'marketProfileId',v_existing.market_profile_id,'created',false);
  END IF;
  SELECT coalesce(max(version),0)+1 INTO v_offer_version FROM public.intentlead_offer_profiles
    WHERE workspace_id=v_workspace_id AND name=btrim(p_command#>>'{offer,name}');
  INSERT INTO public.intentlead_offer_profiles(workspace_id,version,name,definition)
    VALUES(v_workspace_id,v_offer_version,btrim(p_command#>>'{offer,name}'),(p_command->'offer')-'name') RETURNING id INTO v_offer_id;
  SELECT coalesce(max(version),0)+1 INTO v_icp_version FROM public.intentlead_icp_definitions
    WHERE workspace_id=v_workspace_id AND name=btrim(p_command#>>'{icp,name}');
  INSERT INTO public.intentlead_icp_definitions(workspace_id,version,name,definition)
    VALUES(v_workspace_id,v_icp_version,btrim(p_command#>>'{icp,name}'),(p_command->'icp')-'name') RETURNING id INTO v_icp_id;
  SELECT coalesce(max(version),0)+1 INTO v_market_version FROM public.intentlead_market_profiles
    WHERE workspace_id=v_workspace_id AND profile_key='EN_DISCOVERY_ONLY';
  INSERT INTO public.intentlead_market_profiles(workspace_id,version,profile_key,workflow,configuration,capabilities,disabled_capabilities)
    VALUES(v_workspace_id,v_market_version,'EN_DISCOVERY_ONLY','DISCOVERY_ONLY',jsonb_build_object(
      'jurisdictions',p_command#>'{criteria,jurisdictions}','regions','[]'::jsonb,'languages',p_command#>'{criteria,languages}',
      'legalPolicyId','en-discovery-legal-v1','retentionPolicyId','en-discovery-retention-v1','defaultCurrency','USD','timezone','UTC'),
      v_capabilities,'{}'::text[]) RETURNING id INTO v_market_id;
  INSERT INTO public.intentlead_discovery_briefs(workspace_id,offer_profile_id,icp_definition_id,market_profile_id,
    objective,criteria,creation_key,creation_fingerprint)
    VALUES(v_workspace_id,v_offer_id,v_icp_id,v_market_id,btrim(p_command->>'objective'),p_command->'criteria',
      p_idempotency_key,v_fingerprint) RETURNING id INTO v_brief_id;
  RETURN jsonb_build_object('discoveryBriefId',v_brief_id,'workspaceId',v_workspace_id,'offerProfileId',v_offer_id,
    'icpDefinitionId',v_icp_id,'marketProfileId',v_market_id,'created',true);
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_create_approved_discovery_brief(uuid,jsonb,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_create_approved_discovery_brief(uuid,jsonb,text) TO service_role;
