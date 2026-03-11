import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const openai = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Reply directly in the HTTP response — no outbound fetch needed
function reply(res, chatId, text) {
  return res.status(200).json({
    method: "sendMessage",
    chat_id: chatId,
    text,
  });
}

// AI processing — classifies and summarises the saved content
async function processWithAI(text) {
  try {
    const response = await openai.chat.completions.create({
      model: "llama-3.1-8b-instant", 
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: `You are a second brain assistant. Analyse the given text and return ONLY a JSON object with no markdown, no backticks, no explanation.`,
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
    return {
      source_type: "other",
      tags: [],
      summary: null,
      title: null,
    };
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
    return reply(res, chatId, "Hey! Your second brain is ready. Forward me anything — tweets, articles, book recs, reminders. I'll store it all.");
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

  if (!text) {
    return reply(res, chatId, "Got your message! (Note: only text is stored for now)");
  }

  // Reply to user immediately — don't make them wait for AI
  reply(res, chatId, "Saving...");

  // Process with AI after responding
  const ai = await processWithAI(text);

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
  });

  if (error) {
    console.error("Supabase insert error:", error.message);
  }
}