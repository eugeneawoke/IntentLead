DO $migration$
DECLARE
  v_signature regprocedure := to_regprocedure('public.intentlead_persist_self_prospecting_candidate(uuid,text,uuid,text,jsonb)');
  v_definition text;
  v_updated text;
BEGIN
  IF v_signature IS NULL THEN RAISE EXCEPTION 'intentlead self-prospecting persistence function is missing'; END IF;
  SELECT pg_get_functiondef(v_signature) INTO v_definition;
  IF position($$NOT IN ('reddit','hackernews','exa','serper','openai')$$ IN v_definition) = 0
    OR position($$IN ('reddit','hackernews') AND v_run->>'capability'<>'SOURCE_SEARCH'$$ IN v_definition) = 0
    OR position($$NOT IN ('reddit','hackernews','exa','serper')$$ IN v_definition) = 0
    OR position($$IN ('reddit','hackernews') THEN 'SOURCE_SEARCH'$$ IN v_definition) = 0
  THEN
    RAISE EXCEPTION 'Task K provider allowlist precondition does not match the persistence function';
  END IF;
  v_updated := replace(
    v_definition,
    $$NOT IN ('reddit','hackernews','exa','serper','openai')$$,
    $$NOT IN ('reddit','hackernews','github','stackexchange','exa','serper','openai')$$
  );
  v_updated := replace(
    v_updated,
    $$IN ('reddit','hackernews') AND v_run->>'capability'<>'SOURCE_SEARCH'$$,
    $$IN ('reddit','hackernews','github','stackexchange') AND v_run->>'capability'<>'SOURCE_SEARCH'$$
  );
  v_updated := replace(
    v_updated,
    $$NOT IN ('reddit','hackernews','exa','serper')$$,
    $$NOT IN ('reddit','hackernews','github','stackexchange','exa','serper')$$
  );
  v_updated := replace(
    v_updated,
    $$IN ('reddit','hackernews') THEN 'SOURCE_SEARCH'$$,
    $$IN ('reddit','hackernews','github','stackexchange') THEN 'SOURCE_SEARCH'$$
  );
  IF v_updated = v_definition
    OR position($$NOT IN ('reddit','hackernews','github','stackexchange','exa','serper','openai')$$ IN v_updated) = 0
    OR position($$IN ('reddit','hackernews','github','stackexchange') AND v_run->>'capability'<>'SOURCE_SEARCH'$$ IN v_updated) = 0
    OR position($$NOT IN ('reddit','hackernews','github','stackexchange','exa','serper')$$ IN v_updated) = 0
    OR position($$IN ('reddit','hackernews','github','stackexchange') THEN 'SOURCE_SEARCH'$$ IN v_updated) = 0
  THEN
    RAISE EXCEPTION 'Task K provider allowlist patch did not match the persistence function';
  END IF;
  EXECUTE v_updated;
END;
$migration$;
