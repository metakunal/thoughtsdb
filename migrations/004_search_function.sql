-- Semantic search function using pgvector cosine similarity
create or replace function search_saves(
  query_embedding vector(1024),
  match_user_id text,
  match_count int default 5
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
  order by embedding <=> query_embedding
  limit match_count;
$$;