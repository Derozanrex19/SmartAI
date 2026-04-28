-- Run this in the Supabase SQL editor before demoing threaded replies.
-- The existing messages table remains the ticket table.

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null references public.messages(ticket_id) on delete cascade,
  sender_type text not null check (sender_type in ('customer', 'admin', 'ai')),
  sender_email text,
  body text not null,
  email_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists conversation_messages_ticket_id_created_at_idx
  on public.conversation_messages (ticket_id, created_at);

alter table public.conversation_messages enable row level security;

drop policy if exists "Customers can create conversation messages" on public.conversation_messages;
create policy "Customers can create conversation messages"
  on public.conversation_messages
  for insert
  to anon, authenticated
  with check (sender_type = 'customer');

drop policy if exists "Admins can manage conversation messages" on public.conversation_messages;
create policy "Admins can manage conversation messages"
  on public.conversation_messages
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.admin_profiles
      where admin_profiles.user_id = auth.uid()
        and admin_profiles.is_active = true
    )
  )
  with check (
    exists (
      select 1
      from public.admin_profiles
      where admin_profiles.user_id = auth.uid()
        and admin_profiles.is_active = true
    )
  );

-- Optional if your messages.status has a check constraint:
-- include needs_attention, replied, and closed in the allowed values.
-- n8n inbound email workflow should:
-- 1. Extract TKT-YYMMDD-XXXXXX from the email subject.
-- 2. Insert a conversation_messages row with sender_type = 'customer'.
-- 3. Update messages.status = 'needs_attention' for that ticket_id.
