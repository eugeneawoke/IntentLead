-- The terminal synchronization helper is an implementation detail of the
-- owner-controlled SECURITY DEFINER job RPCs, not a service-role endpoint.
REVOKE EXECUTE ON FUNCTION public.intentlead_sync_job_terminal_state(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
