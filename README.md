# Ward Council Dashboard

A full-stack AI-powered tool for the Executive Secretary of a Ward Council (The Church of Jesus Christ of Latter-day Saints).

## What It Does

1. **Weekly Pulse** — Automatically texts council members every Wednesday with 3 questions. Collects and displays their responses. You can also add responses manually.
2. **AI Agenda Builder** — One click generates a structured 60-minute agenda using Claude AI, highlighting cross-organization themes, collaboration opportunities, and AI insights. Send it to all council members via SMS.
3. **Goals & Collaboration Tracker** — Track long-term collaborative goals across organizations. AI can suggest new goals based on pulse response patterns.

---

## Setup (Step by Step)

### 1. Prerequisites
- Node.js 18+ installed
- A [Twilio account](https://twilio.com) (free trial works to start)
- An [Anthropic API key](https://console.anthropic.com)

### 2. Install dependencies
```bash
cd ward-council
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
```
Edit `.env` and fill in:
- `TWILIO_ACCOUNT_SID` — from your Twilio Console dashboard
- `TWILIO_AUTH_TOKEN` — from your Twilio Console dashboard
- `TWILIO_PHONE_NUMBER` — the Twilio number you purchase (format: +1xxxxxxxxxx)
- `ANTHROPIC_API_KEY` — from console.anthropic.com

### 4. Add your council members
Edit `src/data/council.js` — replace the placeholder names and phone numbers with your actual council members. Phone numbers must be in E.164 format: `+1xxxxxxxxxx`.

Also update the `cron.schedule` timezone in `server.js` (line near the bottom) to match your local timezone:
- Mountain: `America/Denver`
- Pacific: `America/Los_Angeles`
- Central: `America/Chicago`
- Eastern: `America/New_York`

### 5. Set up Twilio webhook
This is how Twilio forwards inbound text replies to your app.

1. Buy a phone number in your Twilio Console
2. Go to Phone Numbers → Manage → your number → Configure
3. Under "A Message Comes In", set the webhook URL to:
   ```
   https://YOUR-DOMAIN/webhook/sms
   ```
   (If running locally for testing, use [ngrok](https://ngrok.com): `ngrok http 3001`, then use the ngrok URL)

### 6. Run the app
```bash
# Development (runs both server + frontend with hot reload)
npm run dev
```
Open http://localhost:5173 in your browser.

```bash
# Production
npm run build
NODE_ENV=production npm start
```

---

## Deployment (Recommended: Railway or Render)

Both are free-tier friendly and handle Node apps with no config.

**Railway:**
1. Push this folder to a GitHub repo
2. Connect to Railway → Deploy from GitHub
3. Add environment variables in the Railway dashboard
4. Update your Twilio webhook URL to the Railway-provided domain

**Render:**
1. Push to GitHub
2. New Web Service → connect repo
3. Build Command: `npm install && npm run build`
4. Start Command: `node server.js`
5. Add env vars in Render dashboard

---

## How the Automated SMS Pulse Works

Every Wednesday at 9am (your timezone), the server automatically texts every council member (except you) with:

```
Hi [Name]! It's time for your weekly Ward Council check-in:

1️⃣ Are there any members in your organization who need help, a visit, or special attention this week?

2️⃣ Does your organization have any needs that another organization could help with?

3️⃣ Any wins, updates, or good news to share from your organization?

You can reply all at once or separately. Thank you! 🙏
```

Their replies come back to your Twilio number, which forwards them to your app via webhook. Responses are automatically structured and stored.

You can also **manually trigger a pulse** anytime from the dashboard (Weekly Pulse tab → "Send Pulse Now").

---

## Usage Guide

### Weekly Workflow
1. **Wednesday** — Pulse goes out automatically (or you trigger it)
2. **Thursday–Saturday** — Responses come in, visible in the Pulse tab
3. **Saturday before council** — Go to Agenda Builder → "Generate Agenda"
4. Review the AI-generated agenda, edit as needed
5. Click "Send via SMS" to deliver the agenda to all council members
6. **Sunday** — Run the meeting using the agenda

### Goals Workflow
1. Create goals with multiple organizations tagged
2. After each council meeting, add a progress note to each relevant goal
3. Goals automatically get included in future AI-generated agendas
4. Use "AI Suggest Goals" to let Claude identify collaboration opportunities from pulse patterns

---

## Data Storage

All data is stored in `data/db.json` — a simple JSON file on your server. Back this up periodically if you want to preserve history.

---

## Customization

- **Pulse questions**: Edit `PULSE_QUESTIONS` in `src/data/council.js`
- **Pulse schedule**: Edit the cron expression in `server.js` (`0 9 * * 3` = 9am every Wednesday)
- **AI agenda prompt**: Edit the prompt in `src/lib/claude.js` → `generateAgenda()`
