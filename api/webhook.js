import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Reply directly in the HTTP response — no outbound fetch needed
function reply(res, chatId, text) {
  return res.status(200).json({
    method: "sendMessage",
    chat_id: chatId,
    text,
  });
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
      .select("raw_text, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error || !data?.length) {
      return reply(res, chatId, "Nothing saved yet. Forward me something!");
    }

    const list = data
      .map((item, i) => {
        const date = new Date(item.created_at).toLocaleDateString();
        const preview = item.raw_text?.slice(0, 80) || "[no text]";
        return `${i + 1}. [${date}] ${preview}...`;
      })
      .join("\n\n");

    return reply(res, chatId, `Your last ${data.length} saves:\n\n${list}`);
  }

  if (!text) {
    return reply(res, chatId, "Got your message! (Note: only text is stored for now)");
  }

  const isForwarded = !!message.forward_date;
  const forwardedFrom =
    message.forward_from?.username ||
    message.forward_from_chat?.title ||
    null;

  const { error } = await supabase.from("saves").insert({
    user_id: userId,
    raw_text: text,
    is_forwarded: isForwarded,
    forwarded_from: forwardedFrom,
    source_type: null,
  });

  if (error) {
    console.error("Supabase insert error:", error.message);
    return reply(res, chatId, "Something went wrong saving that. Try again.");
  }

  const confirmation = isForwarded && forwardedFrom
    ? `Saved! (forwarded from ${forwardedFrom})`
    : "Saved to your second brain!";

  return reply(res, chatId, confirmation);
}