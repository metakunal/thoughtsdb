import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function getEmbedding(text, inputType = "search_document", retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch("https://api.cohere.com/v2/embed", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.COHERE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          texts: [text],
          model: "embed-english-v3.0",
          input_type: inputType,
          embedding_types: ["float"],
        }),
      });
      const data = await response.json();
      return data.embeddings.float[0];
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, (i + 1) * 1000));
    }
  }
}

export async function searchSaves(userId, query, count = 5) {
  const embedding = await getEmbedding(query, "search_query");

  const { data, error } = await supabase.rpc("search_saves", {
    query_embedding: embedding,
    match_user_id: userId,
    match_count: count,
  });

  if (error) throw error;
  return data;
}