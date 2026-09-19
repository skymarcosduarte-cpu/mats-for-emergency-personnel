import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/github';
const GITHUB_REPO = 'skymarcosduarte-cpu/mats-for-emergency-personnel';

const ALLOWED_WORKFLOWS: Record<string, string> = {
  android: 'build-android-mesh.yml',
  ios: 'build-ios-mesh.yml',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    // Require an authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const target = typeof body.target === 'string' ? body.target : 'android';
    const workflows =
      target === 'all' ? Object.values(ALLOWED_WORKFLOWS) : [ALLOWED_WORKFLOWS[target]];
    if (!workflows[0]) {
      return new Response(JSON.stringify({ error: 'Workflow no permitido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prefer the user's fine-grained PAT (reaches the private repo directly);
    // fall back to the connector gateway for public repos.
    const PAT = Deno.env.get('GITHUB_FINE_GRAINED_PERSONAL_ACCESS_TOKEN');
    const usePat = typeof PAT === 'string' && PAT.length > 0;

    const results: Array<{ workflow: string; ok: boolean; status: number }> = [];

    for (const workflow of workflows) {
      const url = usePat
        ? `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${workflow}/dispatches`
        : `${GATEWAY_URL}/repos/${GITHUB_REPO}/actions/workflows/${workflow}/dispatches`;

      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      if (usePat) {
        headers.Authorization = `Bearer ${PAT}`;
      } else {
        const GITHUB_API_KEY = Deno.env.get('GITHUB_API_KEY');
        if (!GITHUB_API_KEY) throw new Error('GITHUB_API_KEY is not configured');
        headers.Authorization = `Bearer ${LOVABLE_API_KEY}`;
        headers['X-Connection-Api-Key'] = GITHUB_API_KEY;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ref: 'newversion', inputs: { expected_version: '2.9.9' } }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Dispatch failed for ${workflow} [${response.status}]: ${errorBody}`);
        return new Response(
          JSON.stringify({
            error: 'GitHub rechazó el disparo del workflow',
            status: response.status,
            details: errorBody,
            workflow,
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      results.push({ workflow, ok: true, status: response.status });
    }

    return new Response(JSON.stringify({ success: true, dispatched: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('github-dispatch error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
