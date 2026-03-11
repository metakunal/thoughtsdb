-- Cohere embed-english-v3.0 uses 1024 dimensions, not 1536
alter table saves drop column embedding;
alter table saves add column embedding vector(1024);