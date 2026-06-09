-- Rate limiting via Supabase (replaces in-process Map and external Redis)
-- Uses fixed-window counter with atomic upsert — no TOCTOU.

CREATE TABLE IF NOT EXISTS rate_limits (
  key            text        NOT NULL,
  window_start   timestamptz NOT NULL,
  request_count  int         NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- RLS: table is only touched via SECURITY DEFINER RPC — direct access blocked.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies needed: all access goes through the RPC below.

-- Cleanup index: fast purge of old windows
CREATE INDEX IF NOT EXISTS rate_limits_window_start_idx ON rate_limits (window_start);

-- check_rate_limit(key, max_requests, window_seconds) → true if allowed
-- Atomically increments the counter for the current fixed window.
-- Returns false when the counter exceeds max_requests (request should be rejected).
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key            text,
  p_max_requests   int,
  p_window_seconds int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count        int;
BEGIN
  -- Floor current time to the window boundary
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO rate_limits (key, window_start, request_count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (key, window_start) DO UPDATE
    SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  -- Purge windows older than 2× the window to prevent unbounded growth
  DELETE FROM rate_limits
  WHERE window_start < now() - (p_window_seconds * 2 * interval '1 second')
    AND key = p_key;

  RETURN v_count <= p_max_requests;
END;
$$;
