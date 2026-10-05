-- Keep authenticated source links safe when callers invoke the detail RPC directly.
-- Query and fragment are omitted; percent-encoded paths are rejected because SQL cannot
-- safely canonicalize their contact/profile semantics. This is a URL exposure filter,
-- not generic person or role de-identification.
CREATE OR REPLACE FUNCTION public.intentlead_sanitize_review_source_url(p_source_url text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_value text := btrim(p_source_url);
  v_without_query text;
  v_authority text;
  v_host text;
  v_path text;
  v_port_text text;
  v_port integer;
BEGIN
  IF v_value IS NULL OR v_value = '' OR char_length(v_value) > 2048
    OR v_value !~* '^https://[[:alnum:]-]+(\.[[:alnum:]-]+)+(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
  THEN RETURN NULL; END IF;

  v_without_query := regexp_replace(regexp_replace(v_value, '^https://', 'https://', 'i'), '[?#].*$', '');
  IF v_without_query ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
    OR v_without_query ~ '(^|[^0-9])\+?[0-9][0-9(). -]{7,}[0-9]([^0-9]|$)'
  THEN RETURN NULL; END IF;

  v_authority := substring(v_without_query FROM '^https://([^/?#]+)');
  v_host := lower(regexp_replace(v_authority, ':[0-9]+$', ''));
  v_port_text := substring(v_authority FROM ':([0-9]+)$');
  IF v_port_text IS NOT NULL THEN
    v_port := v_port_text::integer;
    IF v_port > 65535 THEN RETURN NULL; END IF;
  END IF;

  IF v_host IN ('localhost', 'localhost.localdomain')
    OR v_host LIKE '%.localhost' OR v_host LIKE '%.local'
    OR v_host ~ '^[0-9.]+$'
  THEN RETURN NULL; END IF;

  v_path := substring(v_without_query FROM '^https://[^/?#]+(/[^?#]*)?$');
  IF v_path IS NOT NULL AND position('%' IN v_path) > 0 THEN RETURN NULL; END IF;

  RETURN 'https://' || v_host
    || CASE WHEN v_port IS NOT NULL AND v_port <> 443 THEN ':' || v_port::text ELSE '' END
    || coalesce(v_path, '');
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_sanitize_review_source_url(text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Preserve migration 011's assessment and fact filters while sanitizing this projection.
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
BEGIN
  v_result := public.intentlead_build_opportunity_review_dto_unfiltered(p_opportunity_id, p_include_evidence);
  IF v_result IS NULL THEN RETURN NULL; END IF;

  v_assessment := v_result->'assessment';
  IF jsonb_typeof(v_assessment) = 'object' AND v_assessment ? 'problemStatement' THEN
    v_text := v_assessment->>'problemStatement';
    IF v_text IS NOT NULL AND NOT public.intentlead_review_text_is_safe(v_text, 600) THEN
      v_assessment := jsonb_set(v_assessment, '{problemStatement}', 'null'::jsonb, true);
    END IF;
    v_result := jsonb_set(v_result, '{assessment}', v_assessment, true);
  END IF;

  IF p_include_evidence AND jsonb_typeof(v_result->'evidence') = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_result->'evidence') LOOP
      IF v_item ? 'sourceUrl' THEN
        v_source_url := public.intentlead_sanitize_review_source_url(v_item->>'sourceUrl');
        v_item := jsonb_set(v_item, '{sourceUrl}', coalesce(to_jsonb(v_source_url), 'null'::jsonb), true);
      END IF;

      v_facts := v_item->'facts';
      v_problem := v_facts->'problem';
      IF jsonb_typeof(v_problem) = 'object' AND v_problem ? 'observedCondition' THEN
        v_text := v_problem->>'observedCondition';
        IF v_text IS NOT NULL AND NOT public.intentlead_review_text_is_safe(v_text, 500) THEN
          v_problem := v_problem - 'observedCondition';
          v_facts := jsonb_set(v_facts, '{problem}', v_problem, true);
          v_item := jsonb_set(v_item, '{facts}', v_facts, true);
        END IF;
      END IF;
      v_evidence := v_evidence || jsonb_build_array(v_item);
    END LOOP;
    v_result := jsonb_set(v_result, '{evidence}', v_evidence, true);
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_build_opportunity_review_dto(uuid, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
