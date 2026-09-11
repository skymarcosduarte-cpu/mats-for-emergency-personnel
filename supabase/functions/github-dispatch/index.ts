import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/github';
const GITHUB_REPO = 'skymarcosduarte-cpu/safe-guard-link-43a63509';

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
    const GITHUB_API_KEY = Deno.env.get('GITHUB_API_KEY');
    if (!GITHUB_API_KEY) throw new Error('GITHUB_API_KEY is not configured');

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

    const results: Array<{ workflow: string; ok: boolean; status: number }> = [];

    for (const workflow of workflows) {
      const response = await fetch(
        `${GATEWAY_URL}/repos/${GITHUB_REPO}/actions/workflows/${workflow}/dispatches`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'X-Connection-Api-Key': GITHUB_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'newversion' }),
        },
      );

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
