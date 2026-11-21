// Supabase Edge Function: create-store-user (ADR-0025)
// Allows authenticated Store Admins (`admin` / `tung`) to create new staff accounts
// or reset passwords directly from the Settings Admin UI without touching Supabase SQL/Dashboard.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeUsernameToEmail(usernameOrEmail: string): string {
  const clean = String(usernameOrEmail || '').trim().toLowerCase();
  if (!clean) return '';
  if (clean.includes('@')) return clean;
  return `${clean}@mexucxich.pos`;
}

function isAdminUser(user: any): boolean {
  const email = String(user?.email || '').trim().toLowerCase();
  const metaRole = String(user?.app_metadata?.role || '').trim().toLowerCase();
  return metaRole === 'admin' || email === 'admin@mexucxich.pos' || email === 'tung@mexucxich.pos';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server missing SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY env vars' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization') || '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: valid Supabase session required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isAdminUser(callerData.user)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const rawUsername = String(body?.username || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const requestedRole = ['admin', 'owner', 'staff'].includes(body?.role) ? body.role : 'staff';
    const mode = body?.mode === 'update_password' ? 'update_password' : 'create_or_update';

    if (!rawUsername || password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Username required and password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const email = normalizeUsernameToEmail(rawUsername);
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if user already exists by email so both create & reset work idempotently
    const { data: listedUsers, error: listErr } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) {
      return new Response(
        JSON.stringify({ error: listErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existing = (listedUsers?.users || []).find(
      (u: any) => String(u.email || '').trim().toLowerCase() === email
    );

    if (existing) {
      const { data: updated, error: updateErr } = await adminClient.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        app_metadata: { ...(existing.app_metadata || {}), role: requestedRole },
        user_metadata: { ...(existing.user_metadata || {}), username: rawUsername },
      });
      if (updateErr) {
        return new Response(
          JSON.stringify({ error: updateErr.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          action: mode === 'update_password' ? 'password_updated' : 'updated',
          user: { id: updated.user?.id, email, username: rawUsername, role: requestedRole },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: requestedRole },
      user_metadata: { username: rawUsername },
    });

    if (createErr) {
      return new Response(
        JSON.stringify({ error: createErr.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: 'created',
        user: { id: created.user?.id, email, username: rawUsername, role: requestedRole },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
