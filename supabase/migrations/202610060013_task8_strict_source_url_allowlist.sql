-- Limit review source links to normalized public HTTPS hostnames and safe ASCII paths.
-- This is a narrow URL exposure filter, not generic person or role de-identification.
CREATE OR REPLACE FUNCTION public.intentlead_review_source_url_path_is_safe(p_path text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT p_path IS NOT NULL
    AND octet_length(p_path) = char_length(p_path)
    AND p_path ~ '^/[A-Za-z0-9/_~.-]*$'
    AND p_path !~ '(^|/)[.][.]?(/|$)'
$$;
REVOKE ALL ON FUNCTION public.intentlead_review_source_url_path_is_safe(text)
  FROM PUBLIC, anon, authenticated, service_role;

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
  v_label text;
  v_path text;
  v_port_text text;
  v_port integer;
BEGIN
  IF v_value IS NULL OR v_value = '' OR char_length(v_value) > 2048
    OR v_value !~* '^https://'
  THEN RETURN NULL; END IF;

  v_without_query := regexp_replace(v_value, '^https://', 'https://', 'i');
  v_without_query := regexp_replace(v_without_query, '[?#].*$', '');
  IF v_without_query ~ '(^|[^0-9])\+?[0-9][0-9(). -]{7,}[0-9]([^0-9]|$)'
  THEN RETURN NULL; END IF;
  v_authority := substring(v_without_query FROM '^https://([^/?#]+)');
  IF v_authority IS NULL OR octet_length(v_authority) <> char_length(v_authority)
    OR v_authority !~ '^[A-Za-z0-9.-]+(:[0-9]{1,5})?$'
  THEN RETURN NULL; END IF;

  v_host := lower(regexp_replace(v_authority, ':[0-9]+$', ''));
  v_port_text := substring(v_authority FROM ':([0-9]+)$');
  IF v_port_text IS NOT NULL THEN
    v_port := v_port_text::integer;
    IF v_port > 65535 THEN RETURN NULL; END IF;
  END IF;

  IF char_length(v_host) > 253 OR cardinality(string_to_array(v_host, '.')) < 2 OR v_host ~ '^[0-9.]+$'
    OR v_host IN ('localhost', 'localhost.localdomain')
    OR v_host LIKE '%.localhost' OR v_host LIKE '%.local'
  THEN RETURN NULL; END IF;
  FOREACH v_label IN ARRAY string_to_array(v_host, '.') LOOP
    IF char_length(v_label) < 1 OR char_length(v_label) > 63
      OR v_label !~ '^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$'
    THEN RETURN NULL; END IF;
  END LOOP;

  v_path := substring(v_without_query FROM '^https://[^/?#]+(/[^?#]*)?$');
  v_path := coalesce(v_path, '/');
  IF NOT public.intentlead_review_source_url_path_is_safe(v_path) THEN RETURN NULL; END IF;

  RETURN 'https://' || v_host
    || CASE WHEN v_port IS NOT NULL AND v_port <> 443 THEN ':' || v_port::text ELSE '' END
    || v_path;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_sanitize_review_source_url(text)
  FROM PUBLIC, anon, authenticated, service_role;
