// admin-users — the Supabase Auth admin API, gated to 'admin' co-authors.
//
// Why this exists: listing accounts, changing someone else's email, and setting
// a password all need the service_role key, which bypasses RLS entirely. That
// key can never ship in admin/admin.js — the admin is a static page anyone can
// view source on. It lives here as a function secret instead, and every call is
// re-checked against user_roles. The admin UI hiding the panel from editors is
// convenience; THIS is the control.
//
// Deploy:  supabase functions deploy admin-users
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.)
//
// POST { action, ... } with the caller's session JWT as a Bearer token:
//   list                            → every account + role + last sign-in
//   set_email    { user_id, email }
//   set_password { user_id, password }
//   set_role     { user_id, role }
//   invite       { email, redirect_to }
//   delete       { user_id }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// The admin sends apikey + Authorization; both must be named here or the
// browser's preflight fails before the request is ever made.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const MIN_PASSWORD = 8;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // --- who is calling? ----------------------------------------------------
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Not signed in.' }, 401);

  const { data: { user: caller }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !caller) return json({ error: 'Session expired — sign in again.' }, 401);

  const { data: callerRole } = await admin
    .from('user_roles').select('role').eq('user_id', caller.id).maybeSingle();
  if (callerRole?.role !== 'admin') {
    return json({ error: 'Admin access required.' }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // Every action below is cross-user, so all of them are admin-only. Changing
  // your OWN email/password needs none of this — the client does that with
  // supabase.auth.updateUser() on the publishable key.
  try {
    switch (action) {
      case 'list': {
        // listUsers pages at 50; the co-author list is small but page anyway so
        // it can't silently truncate.
        const users = [];
        for (let page = 1; page <= 20; page++) {
          const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          if (error) throw error;
          users.push(...data.users);
          if (data.users.length < 200) break;
        }
        const { data: roles } = await admin.from('user_roles').select('user_id, role');
        const roleOf = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
        return json({
          users: users.map((u) => ({
            id: u.id,
            email: u.email,
            role: roleOf.get(u.id) ?? 'editor',
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            confirmed: !!u.email_confirmed_at,
            is_self: u.id === caller.id,
          })),
        });
      }

      case 'set_email': {
        const { user_id, email } = body;
        if (!user_id || !email) return json({ error: 'user_id and email are required.' }, 400);
        // email_confirm marks the new address confirmed straight away — an admin
        // setting it IS the confirmation. Without it the account would be locked
        // out until the user clicked a link at an address they may not hold yet.
        const { error } = await admin.auth.admin.updateUserById(user_id, {
          email, email_confirm: true,
        });
        if (error) throw error;
        return json({ ok: true });
      }

      case 'set_password': {
        const { user_id, password } = body;
        if (!user_id || !password) return json({ error: 'user_id and password are required.' }, 400);
        if (String(password).length < MIN_PASSWORD) {
          return json({ error: `Password must be at least ${MIN_PASSWORD} characters.` }, 400);
        }
        const { error } = await admin.auth.admin.updateUserById(user_id, { password });
        if (error) throw error;
        return json({ ok: true });
      }

      case 'set_role': {
        const { user_id, role } = body;
        if (!['admin', 'editor'].includes(role)) return json({ error: 'Unknown role.' }, 400);
        // Two guards against locking the project out of its own user admin:
        // you can't demote yourself, and the last admin can't be demoted at all.
        if (user_id === caller.id && role !== 'admin') {
          return json({ error: "You can't remove your own admin access." }, 400);
        }
        if (role !== 'admin') {
          const { count } = await admin.from('user_roles')
            .select('user_id', { count: 'exact', head: true }).eq('role', 'admin');
          if ((count ?? 0) <= 1) return json({ error: 'This is the last admin.' }, 400);
        }
        const { error } = await admin.from('user_roles')
          .upsert({ user_id, role }, { onConflict: 'user_id' });
        if (error) throw error;
        return json({ ok: true });
      }

      case 'invite': {
        const { email, redirect_to } = body;
        if (!email) return json({ error: 'email is required.' }, 400);
        // Mails a "set your password" link. The new account lands as 'editor'
        // (the user_roles trigger); promote it afterwards if it should be admin.
        const { error } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: redirect_to,
        });
        if (error) throw error;
        return json({ ok: true });
      }

      case 'delete': {
        const { user_id } = body;
        if (!user_id) return json({ error: 'user_id is required.' }, 400);
        if (user_id === caller.id) return json({ error: "You can't delete your own account." }, 400);
        const { error } = await admin.auth.admin.deleteUser(user_id);
        if (error) throw error;
        return json({ ok: true });
      }

      default:
        return json({ error: `Unknown action "${action}".` }, 400);
    }
  } catch (err) {
    return json({ error: (err as Error).message ?? 'Something went wrong.' }, 400);
  }
});
