-- Run this in Supabase SQL Editor (supabase.com > SQL Editor)
create extension if not exists vector;
create table saves (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  raw_text text,
  is_forwarded boolean default false,
  forwarded_from text,         -- channel/user it was forwarded from
  source_type text,            -- 'tweet', 'article', 'book', 'reminder' — AI fills this later
  tags text[],                 -- AI fills this later
  summary text,                -- AI fills this later
  embedding vector(1536),      -- OpenAI embeddings — for semantic search later
  created_at timestamptz default now()
);

-- Index for fast user lookups
create index on saves(user_id);

-- Index for vector search (you'll activate this in Phase 2)
-- create index on saves using ivfflat (embedding vector_cosine_ops);