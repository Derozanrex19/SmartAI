# SmartAI (SupportIQ)
MagentIQ technical demo project.

## Architecture Summary
- Frontend: React + Vite + Tailwind
- Data/Auth: Supabase (`messages`, `admin_profiles`)
- AI Orchestration: n8n webhook (`SupportIQ.json`) + Groq analysis
- Email:
  - Manual path: frontend EmailJS (`Send Response` button)
  - Auto path: n8n policy branch calls EmailJS API

End-to-end flow:
1. Customer submits ticket on `/contact-us` -> row created in Supabase with `status = new`.
2. Admin opens ticket modal on `/dashboard`:
   - If `ai_draft` or `final_response` exists: no auto webhook call.
   - If neither exists: frontend auto-calls webhook once (deduped while in-flight).
3. n8n analyzes ticket, applies safety policy, and returns structured JSON.
4. Frontend persists AI fields + status in Supabase.
5. Manual controls remain available: `Generate/Re-Generate` and `Send Response`.

## Status Contract
Supported statuses:
- `needs_attention`
- `replied`
- `closed`
- Legacy/AI states still tolerated by the dashboard: `new`, `ai_ready`, `needs_human`, `customer_replied`, `responded`
- `ai_generating` (optional/transient; reserved)

Current behavior:
- New contact form submissions create `needs_attention`.
- Admin replies move tickets to `replied`.
- Customer replies caught by n8n should move tickets back to `needs_attention`.
- Resolved tickets move to `closed` from the dashboard.

## Threaded Conversation Demo
Run `supabase-conversation-setup.sql` in Supabase to add `conversation_messages`.

Thread flow:
1. Customer submits `/contact-us` -> app creates a ticket and the first `conversation_messages` row.
2. Admin sends a reply -> EmailJS sends the email with a `/reply/{{ticket_id}}` link, app saves an admin conversation row, and status becomes `replied`.
3. Customer clicks the reply link -> app inserts a customer conversation row directly in Supabase and updates status to `needs_attention`.
4. Optional email fallback -> n8n Email Trigger (IMAP/Gmail) can still extract the ticket ID from the subject, insert a customer conversation row, and update status to `needs_attention`.
5. Admin clicks `Close Ticket` once resolved -> status becomes `closed`.

Outgoing EmailJS templates should include the ticket ID in the subject, for example:
`[SupportIQ {{ticket_id}}] Response to your concern`

Templates should also include the in-app reply link:
`{{reply_link}}`

## Policy Routing Rules (n8n)
Routing decision after parse/validation:
- `needs_human` if any of:
  - `priority == "high"`
  - `confidence < 85`
  - `category == "billing"`
  - AI output is invalid/unparseable
- `auto_send` only when all checks above are false.

Safety guardrails:
- Billing tickets never auto-send.
- High-priority tickets never auto-send.
- Low-confidence tickets never auto-send.
- If email send fails in auto branch, status is forced to `needs_human` (not `responded`).

## Environment Variables and Secrets
### Frontend (`.env.local` / Vercel)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_N8N_WEBHOOK_URL`
- `VITE_EMAILJS_SERVICE_ID`
- `VITE_EMAILJS_TEMPLATE_ID`
- `VITE_EMAILJS_PUBLIC_KEY`

### n8n runtime secrets (for auto-send branch)
- `EMAILJS_SERVICE_ID`
- `EMAILJS_TEMPLATE_ID`
- `EMAILJS_PUBLIC_KEY`

### n8n runtime secrets for Groq
- Node: `HTTP Request` (AI call)
- URL: `https://api.groq.com/openai/v1/chat/completions`
- Header: `Authorization: Bearer <GROQ_API_KEY>`
- In n8n environment, set: `GROQ_API_KEY=<your_key>`
- Keep body in JSON mode (workflow import already includes required schema + prompt).

## Local Run
1. Install dependencies:
   - `npm install`
2. Create `.env.local` and set frontend vars.
3. Start dev server:
   - `npm run dev`
4. Import `SupportIQ.json` into n8n.
5. Set n8n secrets for EmailJS.
6. Activate workflow and copy production webhook URL into `VITE_N8N_WEBHOOK_URL`.

## n8n Response Contract (frontend consumption)
Webhook response includes AI fields plus policy metadata:
- `sentiment`
- `category`
- `priority`
- `confidence`
- `draft_response`
- `status` (`ai_ready` | `needs_human` | `responded`)
- `route_action` (`needs_human` | `auto_send`)
- `auto_sent` (`true`/`false`)
- `responded_at` (`ISO timestamp | null`)
- `final_response` (`string | null`)
- `email_error` (`string | null`)

## Live Demo Steps
### 1) needs_human branch (blocked from auto-send)
Submit payload to webhook (or submit in app then open ticket):
```json
{
  "ticketId": "TKT-DEMO-HIGH-001",
  "firstName": "Ava",
  "lastName": "Reed",
  "email": "ava@example.com",
  "message": "I was charged twice on my subscription and this is urgent."
}
```
Expected outcome:
- `category` likely `billing` and/or `priority` high.
- Workflow returns `route_action: "needs_human"` and `status: "needs_human"`.
- No auto email sent.
- Dashboard still allows manual `Generate/Re-Generate` and `Send Response`.

### 2) auto_send branch (safe ticket)
Submit payload:
```json
{
  "ticketId": "TKT-DEMO-LOW-001",
  "firstName": "Noah",
  "lastName": "Park",
  "email": "noah@example.com",
  "message": "Great product. I have a small suggestion for improving the dashboard filters."
}
```
Expected outcome:
- High confidence, non-billing, non-high priority.
- Workflow returns `route_action: "auto_send"`, `auto_sent: true`, `status: "responded"`, `responded_at` set.
- Frontend persists `responded` and shows ticket as replied.

## Acceptance Checklist
- Opening an unprocessed ticket auto-generates without clicking `Generate`.
- Reopening while generation is in-flight does not duplicate webhook calls.
- Reopening already processed ticket does not auto-call again.
- High-priority/low-confidence/billing tickets do not auto-send and are `needs_human`.
- Safe tickets can auto-send and become `responded`.
- Manual regenerate/send controls remain usable.

## Deployment Notes
- `vercel.json` includes SPA rewrite to `index.html`.
- In Supabase Auth URL config, include Vercel domain and localhost callback URLs.
- Use n8n production webhook URL (not test URL) in deployed frontend.
