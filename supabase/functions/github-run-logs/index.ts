import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GITHUB_REPO = 'skymarcosduarte-cpu/safe-guard-link-43a63509';
const WORKFLOW_FILE = 'build-android-mesh.yml';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const PAT = Deno.env.get('GITHUB_FINE_GRAINED_PERSONAL_ACCESS_TOKEN');
    if (!PAT) throw new Error('GITHUB_FINE_GRAINED_PERSONAL_ACCESS_TOKEN no configurado');

    const gh = (path: string) =>
      fetch(`https://api.github.com/${path}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${PAT}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

    const runsRes = await gh(`repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1`);
    if (!runsRes.ok) {
      const body = await runsRes.text();
      return new Response(JSON.stringify({ error: 'runs', status: runsRes.status, details: body }), {
        status: runsRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const runs = await runsRes.json();
    const run = runs.workflow_runs?.[0];
    if (!run) throw new Error('sin runs');

    const jobsRes = await gh(`repos/${GITHUB_REPO}/actions/runs/${run.id}/jobs`);
    const jobs = jobsRes.ok ? await jobsRes.json() : { jobs: [] };
    const job = jobs.jobs?.[0];

    let logTail = '';
    if (job) {
      const logRes = await gh(`repos/${GITHUB_REPO}/actions/jobs/${job.id}/logs`);
      if (logRes.ok) {
        const text = await logRes.text();
        logTail = text.slice(-8000);
      } else {
        logTail = `log status ${logRes.status}`;
      }
    }

    return new Response(
      JSON.stringify({
        run: { id: run.id, number: run.run_number, status: run.status, conclusion: run.conclusion, sha: run.head_sha },
        steps: (job?.steps ?? []).map((s: any) => ({ name: s.name, conclusion: s.conclusion })),
        logTail,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
