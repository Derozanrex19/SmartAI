import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type RequestBody = {
  ticketId?: string;
  toEmail?: string;
  customerName?: string;
  aiCategory?: string;
  sentiment?: string;
  responseText?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const supportFromEmail = Deno.env.get('SUPPORT_FROM_EMAIL');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !resendApiKey || !supportFromEmail) {
    return new Response(JSON.stringify({ error: 'Missing required server environment variables' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const accessToken = authHeader.replace('Bearer ', '').trim();

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Invalid user session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false }
  });
  const { data: adminProfile, error: adminError } = await adminClient
    .from('admin_profiles')
    .select('user_id, is_active')
    .eq('user_id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (adminError || !adminProfile) {
    return new Response(JSON.stringify({ error: 'Forbidden: admin access required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const toEmail = body.toEmail?.trim().toLowerCase();
  const responseText = body.responseText?.trim();
  if (!toEmail || !responseText) {
    return new Response(JSON.stringify({ error: 'Missing toEmail or responseText' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const customerName = body.customerName?.trim() || 'Customer';
  const ticketId = body.ticketId?.trim() || 'N/A';
  const aiCategory = body.aiCategory?.trim() || 'other';
  const sentiment = body.sentiment?.trim() || 'neutral';

  const subject = `SupportIQ Response - Ticket ${ticketId}`;
  const textBody = `Hello ${customerName},

${responseText}

---
Ticket ID: ${ticketId}
AI Category: ${aiCategory}
Sentiment: ${sentiment}

SupportIQ Team`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <p>Hello ${customerName},</p>
      <p>${responseText.replace(/\n/g, '<br />')}</p>
      <hr style="margin: 16px 0; border: 0; border-top: 1px solid #e2e8f0;" />
      <p style="font-size: 12px; color: #475569;">
        Ticket ID: ${ticketId}<br />
        AI Category: ${aiCategory}<br />
        Sentiment: ${sentiment}
      </p>
      <p style="font-size: 12px; color: #475569;">SupportIQ Team</p>
    </div>
  `;

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: supportFromEmail,
      to: [toEmail],
      subject,
      text: textBody,
      html: htmlBody
    })
  });

  const resendData = await resendResponse.json();
  if (!resendResponse.ok) {
    return new Response(JSON.stringify({ error: 'Resend API failed', details: resendData }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    provider: 'resend',
    deliveryStatus: 'queued',
    messageId: resendData.id ?? null
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
