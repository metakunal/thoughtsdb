import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Telegram sendMessage helper
async function sendMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

// Main webhook handler
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Always acknowledge Telegram immediately

  const message = req.body?.message;
  if (!message) return;

  const chatId = message.chat.id;
  const userId = String(message.from.id);
  const text = message.text || message.caption || null;

  // Handle /start command
  if (text === "/start") {
    await sendMessage(chatId, "Hey! Your second brain is ready. Forward me anything — tweets, articles, book recs, reminders. I'll store it all.");
    return;
  }

  // Handle /list command — last 10 saves
  if (text === "/list") {
    const { data, error } = await supabase
      .from("saves")
      .select("raw_text, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error || !data?.length) {
      await sendMessage(chatId, "Nothing saved yet. Forward me something!");
      return;
    }

    const list = data
      .map((item, i) => {
        const date = new Date(item.created_at).toLocaleDateString();
        const preview = item.raw_text?.slice(0, 80) || "[no text]";
        return `${i + 1}. [${date}] ${preview}...`;
      })
      .join("\n\n");

    await sendMessage(chatId, `Your last ${data.length} saves:\n\n${list}`);
    return;
  }

  // Ignore messages with no text content
  if (!text) {
    await sendMessage(chatId, "Got your message! (Note: only text is stored for now)");
    return;
  }

  // Detect if this is a forwarded message
  const isForwarded = !!message.forward_date;
  const forwardedFrom =
    message.forward_from?.username ||
    message.forward_from_chat?.title ||
    null;

  // Save to Supabase
  const { error } = await supabase.from("saves").insert({
    user_id: userId,
    raw_text: text,
    is_forwarded: isForwarded,
    forwarded_from: forwardedFrom,
    source_type: null, // AI will fill this in Phase 2
  });

  if (error) {
    console.error("Supabase insert error:", error.message);
    await sendMessage(chatId, "Something went wrong saving that. Try again.");
    return;
  }

  const confirmation = isForwarded && forwardedFrom
    ? `Saved! (forwarded from ${forwardedFrom})`
    : "Saved to your second brain!";

  await sendMessage(chatId, confirmation);
});

// Health check
app.get("/", (req, res) => res.send("Second Brain Bot is running."));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));