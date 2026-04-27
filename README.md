# SmartAI (SupportIQ)
MagentIQ technical demo project.

## Stack
- Frontend: React + Vite + Tailwind
- DB/Auth: Supabase
- AI Workflow: n8n webhook -> Gemini
- Hosting: Vercel

## Local Run
1. Install dependencies:
   - `npm install`
2. Create `.env.local` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_N8N_WEBHOOK_URL`
3. Start dev server:
   - `npm run dev`

## Required Environment Variables
For local and Vercel:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_N8N_WEBHOOK_URL`
- `VITE_EMAILJS_SERVICE_ID`
- `VITE_EMAILJS_TEMPLATE_ID`
- `VITE_EMAILJS_PUBLIC_KEY`

## Vercel Deployment
1. Import this GitHub repo into Vercel.
2. Framework preset:
   - Vite (auto-detected)
3. Build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add environment variables (Production + Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_N8N_WEBHOOK_URL`
   - `VITE_EMAILJS_SERVICE_ID`
   - `VITE_EMAILJS_TEMPLATE_ID`
   - `VITE_EMAILJS_PUBLIC_KEY`
5. Deploy.

## SPA Routing (Important)
This repo includes `vercel.json` with rewrite to `index.html` so `/login` and `/dashboard` work on refresh.

## Supabase Auth URL Configuration
In Supabase dashboard -> Authentication -> URL Configuration:
1. Site URL:
   - `https://<your-vercel-domain>`
2. Redirect URLs:
   - `https://<your-vercel-domain>/**`
   - `http://localhost:3000/**` (for local dev)

## n8n Requirements
1. Workflow must be `Published/Active`.
2. App must use production webhook URL:
   - `https://<your-subdomain>.app.n8n.cloud/webhook/supportiq-analyze`
3. Use test URL only when manually testing workflow editor.

## n8n Priority Fix
The dashboard now supports message-based fallback priority detection, but you should still update your `n8n` workflow so Gemini returns `priority` directly.

### What changed
- Expected AI response now includes:
  - `sentiment`
  - `category`
  - `priority`
  - `confidence`
  - `draft_response`
- Allowed `priority` values are:
  - `low`
  - `medium`
  - `high`

### Step-by-step n8n update
1. Open your `supportiq-analyze` workflow in n8n.
2. Open the `HTTP Request` node that calls Gemini.
3. In the request body / prompt text, update the JSON schema so it includes:
   - `"priority": "low" | "medium" | "high"`
4. Remove the old instruction that says:
   - `Priority is NOT requested here. Do not output priority.`
5. Add a priority guide to the prompt:
   - `high`: urgent outages, blocked access, account lockouts, repeated failures, security concerns, duplicate or unauthorized charges, anything preventing product use
   - `medium`: standard bugs, billing questions, login trouble without clear outage, non-urgent service issues
   - `low`: praise, suggestions, simple questions, non-blocking requests
6. Keep the output format as JSON only.
7. Open the `Code in JavaScript` node after the Gemini call.
8. Make sure it reads `parsed.priority` from the Gemini response.
9. Validate `priority` so only `low`, `medium`, or `high` are returned.
10. If `priority` is missing or invalid, default it to `medium` inside the n8n node.
11. Save the workflow.
12. Click `Test workflow` and send a sample urgent ticket such as:
    - `I can't log in and our whole team is blocked from accessing the dashboard.`
13. Confirm the webhook response now includes:
    - `"priority": "high"`
14. Publish or activate the updated workflow.
15. In the app dashboard, click `Re-Generate` on a ticket and confirm the priority badge changes from `Pending` or `Medium` to the expected value.

### Fastest option
This repo includes an updated workflow export at:
- `SupportIQ.json`

You can import that file into n8n, review credentials, and publish it instead of editing the workflow manually.

## Email Sending Setup (Admin `Send Response`)
This project sends customer replies directly from the frontend using EmailJS.

### 1. Create EmailJS setup
1. Create an EmailJS account.
2. Connect your email service (Gmail/Outlook/custom SMTP).
3. Create an email template.
4. Copy:
   - Service ID
   - Template ID
   - Public Key

### 2. Configure template variables
The app sends these variables:
- `to_email`
- `to_name`
- `ticket_id`
- `ai_category`
- `sentiment`
- `response_message`

### 3. Add Vercel/local env vars
- `VITE_EMAILJS_SERVICE_ID`
- `VITE_EMAILJS_TEMPLATE_ID`
- `VITE_EMAILJS_PUBLIC_KEY`

### 4. Test from app
1. Login as admin.
2. Open a ticket.
3. Click `Send Response`.
4. Confirm customer mailbox receives the reply.
5. Confirm `messages` row is updated to `responded`.

## Production Smoke Test
1. Submit customer ticket on `/`.
2. Login as seeded Supabase admin.
3. Open ticket in dashboard.
4. Click `RE-GENERATE` and confirm AI fields populate.
5. Click `Send Response` and confirm message status updates in Supabase.
