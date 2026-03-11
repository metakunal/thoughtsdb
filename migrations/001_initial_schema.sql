-- Enable pgvector extension
create extension if not exists vector;

-- Initial saves table
create table saves (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  raw_text text,
  is_forwarded boolean default false,
  forwarded_from text,
  source_type text,
  tags text[],
  summary text,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Index for fast user lookups
create index on saves(user_id);