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

## Email Sending Setup (Admin `Send Response`)
This project sends customer email replies through a Supabase Edge Function + Resend API.

### 1. Create Resend setup
1. Create a Resend account.
2. Verify a sending domain or sender email.
3. Copy your `RESEND_API_KEY`.

### 2. Set Supabase function secrets
In Supabase project root (CLI):
- `supabase secrets set RESEND_API_KEY=re_xxxxx`
- `supabase secrets set SUPPORT_FROM_EMAIL="SupportIQ <support@your-domain.com>"`

### 3. Deploy edge function
- `supabase functions deploy send-support-response`

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
