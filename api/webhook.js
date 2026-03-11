import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Reply directly in the HTTP response — no outbound fetch needed
function reply(res, chatId, text) {
  return res.status(200).json({
    method: "sendMessage",
    chat_id: chatId,
    text,
  });
}

// Generate embedding via Cohere
async function getEmbedding(text) {
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
        input_type: "search_document",
        embedding_types: ["float"],
      }),
    });
    const data = await response.json();
    return data.embeddings.float[0];
  } catch (err) {
  console.error("Embedding error FULL:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
  return null;
}
}

// AI processing — classifies and summarises content
async function processWithAI(text) {
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: "You are a second brain assistant. Analyse the given text and return ONLY a JSON object with no markdown, no backticks, no explanation.",
        },
        {
          role: "user",
          content: `Analyse this saved content and return JSON only:

"${text}"

Return this exact JSON structure:
{
  "source_type": "one of: tweet | article | book | reminder | quote | video | other",
  "tags": ["tag1", "tag2", "tag3"],
  "summary": "one sentence summary under 15 words",
  "title": "short title for this save, under 8 words"
}`,
        },
      ],
    });

    const raw = response.choices[0].message.content.trim();
    return JSON.parse(raw);
  } catch (err) {
    console.error("AI processing error:", err.message);
    return { source_type: "other", tags: [], summary: null, title: null };
  }
}

// Semantic search via pgvector
async function searchSaves(userId, query) {
  try {
    const response = await fetch("https://api.cohere.com/v2/embed", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.COHERE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        texts: [query],
        model: "embed-english-v3.0",
        input_type: "search_query", // different input_type for queries vs documents
        embedding_types: ["float"],
      }),
    });
    const data = await response.json();
    const queryEmbedding = data.embeddings.float[0];

    const { data: results, error } = await supabase.rpc("search_saves", {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_count: 5,
    });

    if (error) throw error;
    return results;
  } catch (err) {
    console.error("Search error:", err.message);
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).send("Second Brain Bot is running.");
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const message = req.body?.message;
  if (!message) return res.status(200).json({ ok: true });

  const chatId = message.chat.id;
  const userId = String(message.from.id);
  const text = message.text || message.caption || null;

  if (text === "/start") {
    return reply(res, chatId, "Hey! Your second brain is ready.\n\nCommands:\n/list — see recent saves\n/search <query> — search your saves");
  }

  if (text === "/list") {
    const { data, error } = await supabase
      .from("saves")
      .select("title, source_type, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error || !data?.length) {
      return reply(res, chatId, "Nothing saved yet. Forward me something!");
    }

    const list = data
      .map((item, i) => {
        const date = new Date(item.created_at).toLocaleDateString();
        const label = item.source_type ? `[${item.source_type}]` : "";
        const title = item.title || "Untitled";
        return `${i + 1}. ${label} ${title} — ${date}`;
      })
      .join("\n");

    return reply(res, chatId, `Your last ${data.length} saves:\n\n${list}`);
  }

  // Handle /search command
  if (text?.startsWith("/search")) {
    const query = text.replace("/search", "").trim();

    if (!query) {
      return reply(res, chatId, "What are you looking for? Try: /search stoicism");
    }

    const results = await searchSaves(userId, query);

    if (!results?.length) {
      return reply(res, chatId, `Nothing found for "${query}". Try different keywords.`);
    }

    const formatted = results
      .map((item, i) => {
        const label = item.source_type ? `[${item.source_type}]` : "";
        const title = item.title || "Untitled";
        const summary = item.summary || item.raw_text?.slice(0, 100) || "";
        return `${i + 1}. ${label} ${title}\n${summary}`;
      })
      .join("\n\n");

    return reply(res, chatId, `Results for "${query}":\n\n${formatted}`);
  }

  if (!text) {
    return reply(res, chatId, "Got your message! (Note: only text is stored for now)");
  }

  // Reply to user immediately
  reply(res, chatId, "Saving...");

  // Process AI + embeddings in parallel
  const [ai, embedding] = await Promise.all([
    processWithAI(text),
    getEmbedding(text),
  ]);

  const { error } = await supabase.from("saves").insert({
    user_id: userId,
    raw_text: text,
    is_forwarded: !!message.forward_origin || !!message.forward_date,
    forwarded_from:
      message.forward_origin?.sender_user?.username ||
      message.forward_origin?.chat?.title ||
      message.forward_origin?.sender_user_name ||
      null,
    source_type: ai.source_type,
    tags: ai.tags,
    summary: ai.summary,
    title: ai.title,
    embedding: embedding,
  });

  if (error) {
    console.error("Supabase insert error:", error.message);
  }
}