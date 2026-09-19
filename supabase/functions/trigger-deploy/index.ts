// trigger-deploy — fires the "Build & deploy site" GitHub Actions workflow
// (.github/workflows/rebuild.yml) from the admin, without shipping a
// repo-write GitHub token to the browser. Same shape as admin-users: the
// token lives only in this function's environment, and every call is
// re-checked against the caller's Supabase session before it's used.
//
// Any signed-in co-author may deploy — same access level as every other
// write in this project (see CLAUDE.md's access model). This isn't gated to
// admins the way admin-users is, since deploying isn't a credentials change.
//
// Deploy:  supabase functions deploy trigger-deploy
// Secret:  supabase secrets set DEPLOY_GITHUB_TOKEN=<fine-grained PAT>
//   Mint the PAT at github.com/settings/personal-access-tokens/new:
//     Repository access → Only select repositories → this repo only
//     Permissions → Repository permissions → Actions → Read and write
//   That's the only permission it needs — it can't touch code, issues, or
//   any other repo.
//   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.)
//
// Optional overrides (defaults match this repo):
//   GITHUB_REPO           "owner/name" — default charger71/Super-Powers-Project
//   GITHUB_WORKFLOW_FILE  — default rebuild.yml
//   GITHUB_REF            — default main
//
// POST with the caller's session JWT as a Bearer token. No body needed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // --- who is calling? -----------------------------------------------------
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Not signed in.' }, 401);

  const { data: { user: caller }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !caller) return json({ error: 'Session expired — sign in again.' }, 401);

  const token = Deno.env.get('DEPLOY_GITHUB_TOKEN');
  if (!token) {
    return json({ error: 'DEPLOY_GITHUB_TOKEN is not configured on this function.' }, 500);
  }

  const repo = Deno.env.get('GITHUB_REPO') ?? 'charger71/Super-Powers-Project';
  const workflow = Deno.env.get('GITHUB_WORKFLOW_FILE') ?? 'rebuild.yml';
  const ref = Deno.env.get('GITHUB_REF') ?? 'main';

  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'superpowersproject-admin',
        },
        body: JSON.stringify({ ref }),
      },
    );

    // Success is 204 with no body — GitHub hands back no run id to poll, so
    // this is a fire-and-confirm. The admin's "View runs" link is how you
    // watch it actually build.
    if (ghRes.status !== 204) {
      const detail = await ghRes.json().catch(() => null);
      return json({ error: detail?.message ?? `GitHub API responded ${ghRes.status}.` }, 502);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ error: (err as Error).message ?? 'Something went wrong.' }, 502);
  }
});
