-- Add similarity threshold to avoid returning irrelevant results
-- Only returns results with >40% similarity to query

-- Tuning guide:

-- 0.3 — broader results, more noise
-- 0.4 — good default balance
-- 0.5 — stricter, only strong matches

drop function if exists search_saves;

create or replace function search_saves(
  query_embedding vector(1024),
  match_user_id text,
  match_count int default 5,
  match_threshold float default 0.4
)
returns table (
  id uuid,
  title text,
  summary text,
  source_type text,
  tags text[],
  raw_text text,
  similarity float
)
language sql stable
as $$
  select
    id, title, summary, source_type, tags, raw_text,
    1 - (embedding <=> query_embedding) as similarity
  from saves
  where user_id = match_user_id
    and embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;