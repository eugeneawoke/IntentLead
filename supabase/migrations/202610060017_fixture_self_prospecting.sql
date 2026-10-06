-- Task D: align persisted signal contracts with the accepted domain taxonomy and
-- expose only the active leased DiscoveryBrief context to the offline worker.

ALTER TABLE public.intentlead_opportunity_assessments DISABLE TRIGGER intentlead_append_only;
ALTER TABLE public.intentlead_opportunities
  DROP CONSTRAINT IF EXISTS intentlead_opportunity_signal_v1_check;
ALTER TABLE public.intentlead_opportunity_assessments
  DROP CONSTRAINT IF EXISTS intentlead_assessment_signal_v1_check;

CREATE OR REPLACE FUNCTION public.intentlead_valid_signal(p_value jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT public.intentlead_jsonb_keys_allowed(p_value, ARRAY['family','subtype'])
    AND p_value ?& ARRAY['family','subtype']
    AND jsonb_typeof(p_value->'family') = 'string'
    AND jsonb_typeof(p_value->'subtype') = 'string'
    AND CASE p_value->>'family'
      WHEN 'EXPRESSED_INTENT' THEN p_value->>'subtype' IN (
        'recommendation_request','comparison','switching','complaint','solution_search','rfp'
      )
      WHEN 'BUSINESS_EVENT' THEN p_value->>'subtype' IN (
        'hiring','funding','launch','expansion','leadership_change','technology_change'
      )
      WHEN 'DETECTED_PROBLEM' THEN p_value->>'subtype' IN (
        'operations','acquisition','conversion','reputation','customer_experience','market_presence'
      )
      WHEN 'MARKET_OBSERVATION' THEN p_value->>'subtype' IN (
        'competitor_change','review_pattern','category_gap','local_presence','visibility_gap'
      )
      ELSE false
    END
$$;

UPDATE public.intentlead_opportunities
SET signal=jsonb_build_object(
  'family',CASE signal->>'family'
    WHEN 'TRIGGER_EVENT' THEN 'BUSINESS_EVENT'
    WHEN 'VISIBILITY_FINDING' THEN 'MARKET_OBSERVATION'
    ELSE signal->>'family'
  END,
  'subtype',CASE
    WHEN signal->>'family'='VISIBILITY_FINDING' THEN CASE signal->>'subtype'
      WHEN 'competitor_overtake' THEN 'competitor_change'
      WHEN 'local_visibility' THEN 'local_presence'
      ELSE 'visibility_gap'
    END
    WHEN signal->>'family'='DETECTED_PROBLEM' THEN CASE signal->>'subtype'
      WHEN 'website' THEN 'market_presence'
      WHEN 'local_listing' THEN 'market_presence'
      WHEN 'reviews' THEN 'reputation'
      ELSE signal->>'subtype'
    END
    ELSE signal->>'subtype'
  END
)
WHERE signal->>'family' IN ('TRIGGER_EVENT','VISIBILITY_FINDING')
  OR (signal->>'family'='DETECTED_PROBLEM' AND signal->>'subtype' IN ('website','local_listing','reviews'));

UPDATE public.intentlead_opportunity_assessments
SET signal=jsonb_build_object(
  'family',CASE signal->>'family'
    WHEN 'TRIGGER_EVENT' THEN 'BUSINESS_EVENT'
    WHEN 'VISIBILITY_FINDING' THEN 'MARKET_OBSERVATION'
    ELSE signal->>'family'
  END,
  'subtype',CASE
    WHEN signal->>'family'='VISIBILITY_FINDING' THEN CASE signal->>'subtype'
      WHEN 'competitor_overtake' THEN 'competitor_change'
      WHEN 'local_visibility' THEN 'local_presence'
      ELSE 'visibility_gap'
    END
    WHEN signal->>'family'='DETECTED_PROBLEM' THEN CASE signal->>'subtype'
      WHEN 'website' THEN 'market_presence'
      WHEN 'local_listing' THEN 'market_presence'
      WHEN 'reviews' THEN 'reputation'
      ELSE signal->>'subtype'
    END
    ELSE signal->>'subtype'
  END
)
WHERE signal->>'family' IN ('TRIGGER_EVENT','VISIBILITY_FINDING')
  OR (signal->>'family'='DETECTED_PROBLEM' AND signal->>'subtype' IN ('website','local_listing','reviews'));

SET CONSTRAINTS ALL IMMEDIATE;
ALTER TABLE public.intentlead_opportunity_assessments ENABLE TRIGGER intentlead_append_only;

ALTER TABLE public.intentlead_opportunities
  ADD CONSTRAINT intentlead_opportunity_signal_v1_check CHECK (public.intentlead_valid_signal(signal));
ALTER TABLE public.intentlead_opportunity_assessments
  ADD CONSTRAINT intentlead_assessment_signal_v1_check CHECK (public.intentlead_valid_signal(signal));

CREATE OR REPLACE FUNCTION public.intentlead_get_self_prospecting_context(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_job public.intentlead_jobs%ROWTYPE;
  v_brief public.intentlead_discovery_briefs%ROWTYPE;
  v_market public.intentlead_market_profiles%ROWTYPE;
  v_offer public.intentlead_offer_profiles%ROWTYPE;
  v_icp public.intentlead_icp_definitions%ROWTYPE;
BEGIN
  SELECT * INTO v_job
  FROM public.intentlead_jobs
  WHERE id=p_job_id
    AND lease_owner=p_worker_id
    AND lease_token=p_lease_token
    AND state IN ('LEASED','RUNNING')
    AND lease_expires_at>clock_timestamp()
    AND market_profile_key='EN_DISCOVERY_ONLY'
    AND capability='SOURCE_SEARCH'
    AND job_type='OPPORTUNITY_DISCOVERY';
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_active_lease'; END IF;

  SELECT b.* INTO v_brief
  FROM public.intentlead_discovery_briefs b
  JOIN public.intentlead_market_profiles m
    ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
  WHERE b.id=v_job.discovery_brief_id
    AND b.workspace_id=v_job.workspace_id
    AND b.legacy_campaign_id IS NULL
    AND b.deleted_at IS NULL
    AND m.profile_key='EN_DISCOVERY_ONLY'
    AND m.workflow='DISCOVERY_ONLY'
    AND m.capabilities @> ARRAY[
      'SOURCE_SEARCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW'
    ]::text[]
    AND m.disabled_capabilities @> ARRAY[
      'PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION',
      'OUTREACH_READY','OUTREACH_SEND','OUTCOME_RECORDING','PACKAGE_VERIFIED'
    ]::text[];
  IF NOT FOUND THEN RAISE EXCEPTION 'job_discovery_context_invalid'; END IF;
  SELECT * INTO STRICT v_market
  FROM public.intentlead_market_profiles
  WHERE id=v_brief.market_profile_id AND workspace_id=v_brief.workspace_id;
  SELECT * INTO v_offer
  FROM public.intentlead_offer_profiles
  WHERE id=v_brief.offer_profile_id AND workspace_id=v_brief.workspace_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_offer_context_invalid'; END IF;
  SELECT * INTO v_icp
  FROM public.intentlead_icp_definitions
  WHERE id=v_brief.icp_definition_id AND workspace_id=v_brief.workspace_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_icp_context_invalid'; END IF;

  RETURN jsonb_build_object(
    'profile',jsonb_build_object(
      'schemaVersion',1,
      'id',v_market.profile_key,
      'workspaceId',v_market.workspace_id,
      'workflow',v_market.workflow,
      'jurisdictions',v_market.configuration->'jurisdictions',
      'regions',v_market.configuration->'regions',
      'languages',v_market.configuration->'languages',
      'capabilities',to_jsonb(v_market.capabilities),
      'disabledCapabilities',to_jsonb(v_market.disabled_capabilities),
      'legalPolicyId',v_market.configuration->'legalPolicyId',
      'retentionPolicyId',v_market.configuration->'retentionPolicyId',
      'outreachPolicyId',v_market.configuration->'outreachPolicyId',
      'outreachChannels',v_market.configuration->'outreachChannels',
      'defaultCurrency',v_market.configuration->'defaultCurrency',
      'timezone',v_market.configuration->'timezone'
    ),
    'brief',jsonb_build_object(
      'schemaVersion',1,
      'id',v_brief.id,
      'workspaceId',v_brief.workspace_id,
      'offerProfileId',v_brief.offer_profile_id,
      'icpDefinitionId',v_brief.icp_definition_id,
      'marketProfileId',v_market.profile_key,
      'objective',v_brief.objective,
      'jurisdictions',v_brief.criteria->'jurisdictions',
      'languages',v_brief.criteria->'languages',
      'signalFamilies',v_brief.criteria->'signalFamilies',
      'exclusions',v_brief.criteria->'exclusions',
      'limits',v_brief.criteria->'limits',
      'createdAt',v_brief.created_at
    ),
    'offer',jsonb_build_object(
      'id',v_offer.id,
      'name',v_offer.name,
      'definition',v_offer.definition
    ),
    'icp',jsonb_build_object(
      'id',v_icp.id,
      'name',v_icp.name,
      'definition',v_icp.definition
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.intentlead_get_self_prospecting_context(uuid,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_get_self_prospecting_context(uuid,text,uuid)
  TO service_role;

-- Preserve the only currently supported query-bearing public evidence URL.
-- HN item identity lives in ?id=; every other query and all fragments remain stripped.
CREATE OR REPLACE FUNCTION public.intentlead_sanitize_review_source_url(p_source_url text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_value text := p_source_url;
  v_without_query text;
  v_authority text;
  v_host text;
  v_path text;
  v_hacker_news_id text;
BEGIN
  IF v_value IS NULL OR v_value = '' OR char_length(v_value) > 2048
    OR v_value !~* '^https://'
  THEN RETURN NULL; END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.generate_series(1, char_length(v_value)) AS char_position(i)
    WHERE pg_catalog.ascii(pg_catalog.substr(v_value, char_position.i, 1)) <= 32
      OR pg_catalog.ascii(pg_catalog.substr(v_value, char_position.i, 1)) = 127
  ) THEN RETURN NULL; END IF;

  v_without_query := regexp_replace(v_value, '^https://', 'https://', 'i');
  v_without_query := regexp_replace(v_without_query, '[?#].*$', '');
  IF v_without_query ~ '(^|[^0-9])\+?[0-9][0-9(). -]{7,}[0-9]([^0-9]|$)'
  THEN RETURN NULL; END IF;
  v_authority := substring(v_without_query FROM '^https://([^/?#]+)');
  IF v_authority IS NULL OR octet_length(v_authority) <> char_length(v_authority)
    OR v_authority !~ '^[A-Za-z0-9.-]+$'
  THEN RETURN NULL; END IF;

  v_host := lower(v_authority);
  IF NOT public.intentlead_review_source_url_domain_is_allowed(v_host)
  THEN RETURN NULL; END IF;

  v_path := substring(v_without_query FROM '^https://[^/?#]+(/[^?#]*)?$');
  v_path := coalesce(v_path, '/');
  IF NOT public.intentlead_review_source_url_path_is_safe(v_path) THEN RETURN NULL; END IF;

  IF v_host='news.ycombinator.com' AND v_path='/item' THEN
    v_hacker_news_id := substring(lower(v_value) FROM '^https://news[.]ycombinator[.]com/item[?]id=([0-9]+)$');
  END IF;

  RETURN 'https://' || v_host || v_path
    || CASE WHEN v_hacker_news_id IS NOT NULL THEN '?id=' || v_hacker_news_id ELSE '' END;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_sanitize_review_source_url(text)
  FROM PUBLIC,anon,authenticated,service_role;

-- Extend the authenticated review projection with safe observed source text and
-- provider limitations. Raw excerpts remain unavailable and all projected text
-- passes the existing contact/link safety filter.
CREATE OR REPLACE FUNCTION public.intentlead_build_opportunity_review_dto(
  p_opportunity_id uuid,
  p_include_evidence boolean
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result jsonb;
  v_assessment jsonb;
  v_evidence jsonb := '[]'::jsonb;
  v_item jsonb;
  v_facts jsonb;
  v_problem jsonb;
  v_text text;
  v_source_url text;
  v_limitations jsonb := '[]'::jsonb;
BEGIN
  v_result := public.intentlead_build_opportunity_review_dto_unfiltered(p_opportunity_id,p_include_evidence);
  IF v_result IS NULL THEN RETURN NULL; END IF;

  v_assessment := v_result->'assessment';
  IF jsonb_typeof(v_assessment)='object' AND v_assessment ? 'problemStatement' THEN
    v_text := v_assessment->>'problemStatement';
    IF v_text IS NOT NULL AND NOT public.intentlead_review_text_is_safe(v_text,600) THEN
      v_assessment := jsonb_set(v_assessment,'{problemStatement}','null'::jsonb,true);
    END IF;
    v_result := jsonb_set(v_result,'{assessment}',v_assessment,true);
  END IF;

  IF p_include_evidence AND jsonb_typeof(v_result->'evidence')='array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_result->'evidence') LOOP
      v_source_url := public.intentlead_sanitize_review_source_url(v_item->>'sourceUrl');
      v_item := jsonb_set(v_item,'{sourceUrl}',coalesce(to_jsonb(v_source_url),'null'::jsonb),true);
      v_facts := coalesce(v_item->'facts','{}'::jsonb);
      v_problem := v_facts->'problem';
      IF jsonb_typeof(v_problem)='object' AND v_problem ? 'observedCondition' THEN
        v_text := v_problem->>'observedCondition';
        IF v_text IS NOT NULL AND NOT public.intentlead_review_text_is_safe(v_text,500) THEN
          v_problem := v_problem-'observedCondition';
          v_facts := jsonb_set(v_facts,'{problem}',v_problem,true);
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
        v_facts := jsonb_set(v_facts,'{observedCondition}',to_jsonb(btrim(v_text)),true);
      END IF;
      v_item := jsonb_set(v_item,'{facts}',v_facts,true);
      v_evidence := v_evidence || jsonb_build_array(v_item);
    END LOOP;

    SELECT coalesce(jsonb_agg(to_jsonb(limitation) ORDER BY limitation),'[]'::jsonb)
    INTO v_limitations
    FROM (
      SELECT DISTINCT btrim(value #>> '{}') AS limitation
      FROM public.intentlead_opportunities o
      LEFT JOIN public.intentlead_opportunity_assessments a
        ON a.id=o.current_assessment_id AND a.workspace_id=o.workspace_id
      JOIN public.intentlead_provider_runs r ON r.workspace_id=o.workspace_id
        AND (
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
      ) AS limitation_row(value)
      WHERE o.id=p_opportunity_id AND o.tombstoned_at IS NULL
        AND public.intentlead_is_workspace_member(o.workspace_id)
        AND jsonb_typeof(value)='string'
        AND public.intentlead_review_text_is_safe(btrim(value #>> '{}'),240)
      LIMIT 12
    ) safe_limitations;

    v_result := jsonb_set(v_result,'{evidence}',v_evidence,true);
    v_result := jsonb_set(v_result,'{limitations}',v_limitations,true);
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.intentlead_build_opportunity_review_dto(uuid,boolean)
  FROM PUBLIC,anon,authenticated,service_role;
