# Second Brain Bot — Day 1 Setup

## In 30 Minutes You'll Have a Working Bot

### Step 1: Create Your Telegram Bot
1. Open Telegram → search @BotFather
2. Send `/newbot` → follow the prompts
3. Copy the `BOT_TOKEN` you receive

### Step 2: Set Up Supabase
1. Go to supabase.com → create a new project
2. Go to SQL Editor → paste and run `schema.sql`
3. Go to Project Settings → API → copy `Project URL` and `service_role` key

### Step 3: Run Locally First
```bash
npm install
cp .env.example .env
# Fill in your .env values
npm run dev
```

### Step 4: Expose Your Local Server (for testing)
Install ngrok: https://ngrok.com
```bash
ngrok http 3000
# Copy the https URL it gives you e.g. https://abc123.ngrok.io
```

### Step 5: Register Your Webhook With Telegram
Run this in your browser or curl (replace the values):
```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<YOUR_NGROK_URL>/webhook
```

You should see: `{"ok":true,"result":true}`

### Step 6: Test It
1. Open your bot in Telegram
2. Send `/start`
3. Forward any message to it
4. Check Supabase → Table Editor → saves → your row should be there

### Day 1 Done. You now have:
- Bot receiving messages
- Data stored in Supabase
- /start and /list commands working
- Forwarded message metadata being captured

### Deploy to Production (When Ready)
Push to Railway (railway.app) or Render (render.com).
Set your environment variables there.
Update your Telegram webhook URL to the production URL.