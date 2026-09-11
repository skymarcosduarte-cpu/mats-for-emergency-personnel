import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/**
 * Consulta el estado del repositorio (privado) usando la conexión de GitHub
 * del workspace a través del gateway. Devuelve:
 * - último commit de la rama configurada
 * - versión declarada en src/lib/versionCheck.ts
 * - último run del workflow de Android
 * - última release con asset .apk (URL de descarga)
 */

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/github';
// Repos candidatos: primero el privado conectado a Lovable; si el token no
// lo alcanza, se usa el público (donde están los builds y releases previos).
const REPO_CANDIDATES = [
  'skymarcosduarte-cpu/safe-guard-link-43a63509',
  'skymarcosduarte-cpu/safe-guard-link',
];
const BRANCH_CANDIDATES = ['newversion', 'mesh', 'main'];
const WORKFLOW_FILE = 'build-android-mesh.yml';
const MARKER_PATH = 'native-plugins/write-android-mainactivity.mjs';
const VERSION_PATH = 'src/lib/versionCheck.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');
    const GITHUB_API_KEY = Deno.env.get('GITHUB_API_KEY');
    if (!GITHUB_API_KEY) throw new Error('GITHUB_API_KEY is not configured');

    const gh = async (path: string) => {
      const res = await fetch(`${GATEWAY_URL}/${path}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': GITHUB_API_KEY,
        },
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`GitHub ${path} [${res.status}]: ${body}`);
        return { ok: false as const, status: res.status, data: null };
      }
      return { ok: true as const, status: res.status, data: await res.json() };
    };

    // 1) Localizar un repo alcanzable y su último commit
    let GITHUB_REPO: string | null = null;
    let BRANCH: string | null = null;
    let commit: any = null;
    for (const repo of REPO_CANDIDATES) {
      for (const branch of BRANCH_CANDIDATES) {
        const commits = await gh(`repos/${repo}/commits?sha=${branch}&per_page=1`);
        if (commits.ok && Array.isArray(commits.data) && commits.data[0]) {
          GITHUB_REPO = repo;
          BRANCH = branch;
          commit = commits.data[0];
          break;
        }
      }
      if (commit) break;
    }
    if (!GITHUB_REPO || !commit) {
      return json({ ok: false, error: 'repo_unreachable', status: 404 }, 200);
    }

    // 2) Marcador de fix
    const marker = await gh(
      `repos/${GITHUB_REPO}/contents/${MARKER_PATH}?ref=${commit.sha}`,
    );

    // 3) Versión remota
    let remoteVersion: string | null = null;
    const versionFile = await gh(
      `repos/${GITHUB_REPO}/contents/${VERSION_PATH}?ref=${commit.sha}`,
    );
    if (versionFile.ok && versionFile.data?.content) {
      try {
        const text = atob(String(versionFile.data.content).replace(/\n/g, ''));
        remoteVersion = text.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? null;
      } catch {
        remoteVersion = null;
      }
    }

    // 4) Último run del workflow de Android
    let run: Record<string, unknown> | null = null;
    const runs = await gh(
      `repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1`,
    );
    if (runs.ok && runs.data?.workflow_runs?.[0]) {
      const r = runs.data.workflow_runs[0];
      run = {
        sha: r.head_sha ?? null,
        status: r.status ?? null,
        conclusion: r.conclusion ?? null,
        number: r.run_number ?? null,
        url: r.html_url ?? null,
      };
    }

    // 5) Última release con APK
    let apk: { url: string; tag: string; name: string } | null = null;
    const release = await gh(`repos/${GITHUB_REPO}/releases/latest`);
    if (release.ok && Array.isArray(release.data?.assets)) {
      const asset = release.data.assets.find((a: { name?: string }) =>
        a?.name?.toLowerCase().endsWith('.apk'),
      );
      if (asset?.browser_download_url) {
        apk = {
          url: asset.browser_download_url,
          tag: release.data.tag_name ?? '',
          name: asset.name,
        };
      }
    }

    return json({
      ok: true,
      repo: GITHUB_REPO,
      branch: BRANCH,
      commit: {
        sha: commit.sha,
        message: String(commit.commit?.message ?? '').split('\n')[0],
        date: commit.commit?.author?.date ?? commit.commit?.committer?.date ?? '',
      },
      hasFix: marker.ok,
      remoteVersion,
      run,
      apk,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('github-repo-status error:', message);
    return json({ ok: false, error: message }, 500);
  }
});
