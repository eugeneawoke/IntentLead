-- Keep direct authenticated review RPC source links within the conservative DNS host policy.
-- Ports and IDN/punycode labels are intentionally excluded for SQL/WHATWG parity.
CREATE OR REPLACE FUNCTION public.intentlead_review_source_url_domain_is_allowed(p_host text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_label text;
  v_labels text[];
BEGIN
  IF p_host IS NULL OR octet_length(p_host) <> char_length(p_host)
    OR char_length(p_host) > 253 OR p_host ~ '[^A-Za-z0-9.-]'
  THEN RETURN false; END IF;

  v_labels := string_to_array(lower(p_host), '.');
  IF cardinality(v_labels) < 2 OR v_labels[cardinality(v_labels)] !~ '^[a-z]+$'
    OR p_host IN ('localhost', 'localhost.localdomain')
    OR p_host LIKE '%.localhost' OR p_host LIKE '%.local'
  THEN RETURN false; END IF;

  FOREACH v_label IN ARRAY v_labels LOOP
    IF char_length(v_label) < 1 OR char_length(v_label) > 63
      OR v_label !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
      OR v_label LIKE 'xn--%'
    THEN RETURN false; END IF;
  END LOOP;

  RETURN public.intentlead_review_source_url_host_is_safe(lower(p_host));
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_review_source_url_domain_is_allowed(text)
  FROM PUBLIC, anon, authenticated, service_role;

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

  RETURN 'https://' || v_host || v_path;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_sanitize_review_source_url(text)
  FROM PUBLIC, anon, authenticated, service_role;
