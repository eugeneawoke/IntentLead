-- Filter protocol-less URL-shaped text at the authenticated SQL projection boundary.
-- Only dotted host + slash/path tokens are rejected; plain domains and business prose stay visible.
-- This is a narrow contact-link heuristic, not generic person or role de-identification.
CREATE OR REPLACE FUNCTION public.intentlead_review_text_is_safe(p_value text, p_max_chars integer)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT p_value IS NOT NULL
    AND char_length(btrim(p_value)) BETWEEN 1 AND p_max_chars
    AND p_value !~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
    AND p_value !~* '(https?://|www\.)'
    AND p_value !~ '(^|[^[:alnum:]_])@[A-Za-z0-9_]{2,}'
    AND p_value !~ '(^|[^0-9])\+?[0-9][0-9(). -]{7,}[0-9]([^0-9]|$)'
    AND p_value !~* '(^|[^[:alnum:]@_-])([[:alnum:]-]+\.)+[[:alpha:]]{2,}(:[0-9]+)?/[^[:space:]]*'
$$;
REVOKE ALL ON FUNCTION public.intentlead_review_text_is_safe(text,integer)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.intentlead_enforce_safe_review_note()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.note IS NOT NULL AND NOT public.intentlead_review_text_is_safe(NEW.note,500) THEN
    RAISE EXCEPTION 'invalid_review_note' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_enforce_safe_review_note() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS intentlead_human_review_safe_note ON public.intentlead_human_reviews;
CREATE TRIGGER intentlead_human_review_safe_note
  BEFORE INSERT OR UPDATE OF note ON public.intentlead_human_reviews
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_enforce_safe_review_note();

-- Keep the earlier projection implementation private, then wrap its DTO with the new filter.
DO $$
BEGIN
  IF to_regprocedure('public.intentlead_build_opportunity_review_dto(uuid,boolean)') IS NOT NULL
    AND to_regprocedure('public.intentlead_build_opportunity_review_dto_unfiltered(uuid,boolean)') IS NULL THEN
    ALTER FUNCTION public.intentlead_build_opportunity_review_dto(uuid,boolean)
      RENAME TO intentlead_build_opportunity_review_dto_unfiltered;
  END IF;
END $$;

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
      v_source_url := v_item->>'sourceUrl';
      IF v_source_url IS NOT NULL AND (
        v_source_url !~* '^https://[[:alnum:]-]+(\.[[:alnum:]-]+)+(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
        OR v_source_url ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
        OR v_source_url ~ '(^|[^0-9])\+?[0-9][0-9(). -]{7,}[0-9]([^0-9]|$)'
      ) THEN
        v_item := jsonb_set(v_item,'{sourceUrl}','null'::jsonb,true);
      END IF;

      v_facts := v_item->'facts';
      v_problem := v_facts->'problem';
      IF jsonb_typeof(v_problem)='object' AND v_problem ? 'observedCondition' THEN
        v_text := v_problem->>'observedCondition';
        IF v_text IS NOT NULL AND NOT public.intentlead_review_text_is_safe(v_text,500) THEN
          v_problem := v_problem - 'observedCondition';
          v_facts := jsonb_set(v_facts,'{problem}',v_problem,true);
          v_item := jsonb_set(v_item,'{facts}',v_facts,true);
        END IF;
      END IF;
      v_evidence := v_evidence || jsonb_build_array(v_item);
    END LOOP;
    v_result := jsonb_set(v_result,'{evidence}',v_evidence,true);
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_build_opportunity_review_dto(uuid,boolean)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.intentlead_build_opportunity_review_dto_unfiltered(uuid,boolean)
  FROM PUBLIC, anon, authenticated, service_role;
