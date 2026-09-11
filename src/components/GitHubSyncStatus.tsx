import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, RefreshCw, AlertTriangle, GitCommitHorizontal, PlayCircle, Rocket, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { APP_VERSION } from "@/lib/versionCheck";

const GITHUB_REPO = "skymarcosduarte-cpu/safe-guard-link-43a63509";
const WORKFLOW_FILE = "build-android-mesh.yml";
/** Archivo que solo existe en la versión corregida del proyecto. */
const MARKER_PATH = "native-plugins/write-android-mainactivity.mjs";
const VERSION_PATH = "src/lib/versionCheck.ts";

interface SyncInfo {
  commitSha: string;
  commitMessage: string;
  commitDate: string;
  hasFix: boolean;
  remoteVersion: string | null;
  runSha: string | null;
  runStatus: string | null;
  runConclusion: string | null;
  runNumber: number | null;
  runUrl: string | null;
}


async function fetchSyncInfo(): Promise<SyncInfo | null> {
  const headers = { Accept: "application/vnd.github+json" };
  const bust = `_=${Date.now()}`;

  const commitsRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/commits?per_page=1&${bust}`,
    { headers, cache: "no-store" }
  );
  if (!commitsRes.ok) return null;
  const commits = await commitsRes.json();
  const commit = commits?.[0];
  if (!commit) return null;

  const markerRes = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${MARKER_PATH}?ref=${commit.sha}&${bust}`,
    { headers, cache: "no-store" }
  );

  // Versión declarada en el repo remoto
  let remoteVersion: string | null = null;
  try {
    const raw = await fetch(
      `https://raw.githubusercontent.com/${GITHUB_REPO}/${commit.sha}/${VERSION_PATH}?${bust}`,
      { cache: "no-store" }
    );
    if (raw.ok) {
      const text = await raw.text();
      remoteVersion = text.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? null;
    }
  } catch {
    /* sin versión remota */
  }


  let runSha: string | null = null;
  let runStatus: string | null = null;
  let runConclusion: string | null = null;
  let runNumber: number | null = null;
  let runUrl: string | null = null;
  try {
    const runsRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1`,
      { headers }
    );
    if (runsRes.ok) {
      const runs = await runsRes.json();
      const run = runs?.workflow_runs?.[0];
      if (run) {
        runSha = run.head_sha ?? null;
        runStatus = run.status ?? null;
        runConclusion = run.conclusion ?? null;
        runNumber = run.run_number ?? null;
        runUrl = run.html_url ?? null;
      }
    }
  } catch {
    /* sin datos de workflow */
  }

  return {
    commitSha: commit.sha,
    commitMessage: (commit.commit?.message ?? "").split("\n")[0],
    commitDate: commit.commit?.author?.date ?? commit.commit?.committer?.date ?? "",
    hasFix: markerRes.ok,
    remoteVersion,
    runSha,
    runStatus,

    runConclusion,
    runNumber,
    runUrl,
  };
}

function formatDate(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function GitHubSyncStatus() {
  const [info, setInfo] = useState<SyncInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [watching, setWatching] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const baselineSha = useRef<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);


  const dispatchWorkflow = async (target: "android" | "ios") => {
    setDispatching(target);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("github-dispatch", {
        body: { target },
      });
      if (fnError) {
        const details =
          fnError instanceof Error && "context" in fnError
            ? await (fnError as { context: Response }).context.text().catch(() => fnError.message)
            : fnError.message;
        console.error("github-dispatch failed:", details);
        toast.error("GitHub rechazó el disparo. Revisa que el repo esté sincronizado.");
      } else if (data?.success) {
        toast.success(
          target === "android"
            ? "Build de Android disparado en GitHub Actions 🚀"
            : "Build de iOS disparado en GitHub Actions 🚀"
        );
        setTimeout(load, 5000);
      }
    } catch (e) {
      console.error("github-dispatch error:", e);
      toast.error("No se pudo contactar el servidor para disparar el build.");
    }
    setDispatching(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await fetchSyncInfo();
      if (result) {
        setInfo(result);
        if (baselineSha.current && result.commitSha !== baselineSha.current) {
          setChanged(true);
          setWatching(false);
        }
      } else setError(true);
    } catch {
      setError(true);
    }
    setLastCheck(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Monitoreo en vivo: consulta GitHub cada 10s hasta detectar un commit nuevo
  useEffect(() => {
    if (!watching) return;
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [watching, load]);

  const startWatching = () => {
    baselineSha.current = info?.commitSha ?? null;
    setChanged(false);
    setWatching(true);
    window.open("https://lovable.dev/projects", "_blank", "noopener,noreferrer");
    load();
  };

  /** Reintento de sincronización sin desconectar/reconectar manualmente. */
  const retrySync = async () => {
    setRetrying(true);
    baselineSha.current = info?.commitSha ?? null;
    setChanged(false);
    try {
      await load();
      setWatching(true);
      toast.success("Reintento solicitado. Vigilando GitHub cada 10 s…");

    } finally {
      setRetrying(false);
    }
  };

  const versionSynced = info?.remoteVersion ? info.remoteVersion === APP_VERSION : null;
  const ready = (info?.hasFix ?? false) && versionSynced !== false;
  const alreadyBuilt = info && info.runSha === info.commitSha;


  return (
    <Card className="border-2">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Estado de sincronización con GitHub</h2>
          <Button
            variant="outline"
            size="icon"
            onClick={load}
            disabled={loading}
            aria-label="Actualizar estado de sincronización"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {loading && !info && (
          <p className="text-base text-muted-foreground">Consultando el repositorio…</p>
        )}

        {error && !info && (
          <div className="flex items-start gap-2 rounded-lg border-2 border-destructive/40 bg-destructive/10 p-3 text-base">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p>No se pudo consultar GitHub. Revisa que el repositorio sea público e inténtalo de nuevo.</p>
          </div>
        )}

        {info && (
          <>
            <div
              className={`flex items-start gap-2 rounded-lg border-2 p-3 text-base ${
                ready
                  ? "border-green-600/40 bg-green-600/10"
                  : "border-amber-500/50 bg-amber-500/10"
              }`}
            >
              {ready ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              )}
              <div>
                <p className="font-bold">
                  {ready
                    ? "El repositorio ya tiene los últimos cambios"
                    : "El repositorio todavía no recibió los últimos cambios"}
                </p>
                <p className="mt-1">
                  {ready
                    ? alreadyBuilt
                      ? "Esta versión ya se compiló en GitHub Actions."
                      : "Puedes ejecutar el workflow «Build APK con Red Mesh» ahora."
                    : "Sincroniza el proyecto desde Lovable (botón de GitHub) antes de ejecutar el workflow."}
                </p>
              </div>
            </div>

            <div className="space-y-1 text-base">
              <p className="flex items-center gap-2">
                <GitCommitHorizontal className="h-5 w-5 text-muted-foreground" />
                <span className="font-mono">{info.commitSha.slice(0, 7)}</span>
                <span className="text-muted-foreground">{formatDate(info.commitDate)}</span>
              </p>
              <p className="line-clamp-2 text-muted-foreground">{info.commitMessage}</p>
              <p className="pt-1">
                Versión en la app: <strong>{APP_VERSION}</strong> · en GitHub:{" "}
                <strong className={versionSynced === false ? "text-amber-600" : "text-green-600"}>
                  {info.remoteVersion ?? "desconocida"}
                </strong>
              </p>
              {info.runNumber !== null && (
                <p className="flex items-center gap-2 pt-1">
                  <PlayCircle className="h-5 w-5 text-muted-foreground" />
                  <span>
                    Build #{info.runNumber}:{" "}
                    <strong>
                      {info.runConclusion ?? info.runStatus ?? "desconocido"}
                    </strong>{" "}
                    <span className="font-mono text-muted-foreground">
                      ({info.runSha?.slice(0, 7)})
                    </span>
                  </span>
                </p>
              )}
            </div>

            {/* Reintento de sincronización sin desconectar */}
            <Button
              onClick={retrySync}
              size="lg"
              variant="outline"
              className="h-12 w-full text-base"
              disabled={retrying || loading}
            >
              <RotateCw className={`mr-2 h-5 w-5 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Reintentando sincronización…" : "Reintentar sincronización y actualizar estado"}
            </Button>


            {/* Forzar reconexión + monitoreo en vivo */}
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 text-base">
              <p className="font-bold">Forzar reconexión y sincronización</p>
              <ol className="mt-1 space-y-1 text-muted-foreground">
                <li>1. Toca el botón: se abre Lovable en otra pestaña.</li>
                <li>2. En el menú de GitHub elige «Disconnect» y luego «Connect» al repo.</li>
                <li>3. Regresa aquí: esta tarjeta avisa sola cuando llegue el commit nuevo.</li>
              </ol>
              <Button
                onClick={startWatching}
                size="lg"
                className="mt-3 h-12 w-full text-base"
                disabled={watching}
              >
                <RefreshCw className={`mr-2 h-5 w-5 ${watching ? "animate-spin" : ""}`} />
                {watching ? "Esperando el commit nuevo…" : "Forzar reconexión y vigilar"}
              </Button>
              {watching && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Revisando GitHub cada 10 segundos. Última revisión:{" "}
                  {lastCheck ? lastCheck.toLocaleTimeString("es-MX") : "—"}
                </p>
              )}
              {changed && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border-2 border-green-600/40 bg-green-600/10 p-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  <p>¡Sincronización detectada! Ya puedes ejecutar el workflow.</p>
                </div>
              )}
              {watching && (
                <Button
                  onClick={() => setWatching(false)}
                  variant="ghost"
                  className="mt-2 w-full"
                >
                  Detener vigilancia
                </Button>
              )}
            </div>

            {/* Disparar compilación directamente desde la app */}
            <div className="rounded-lg border-2 border-safe/40 bg-safe/5 p-3 text-base">
              <p className="font-bold">Compilar versión nativa</p>
              <p className="mt-1 text-muted-foreground">
                Dispara el workflow de GitHub Actions sin salir de la app. Asegúrate primero de que
                el repo esté sincronizado (tarjeta verde de arriba).
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  onClick={() => dispatchWorkflow("android")}
                  size="lg"
                  className="h-12 text-base"
                  disabled={dispatching !== null || !ready}
                >
                  <Rocket className={`mr-2 h-5 w-5 ${dispatching === "android" ? "animate-pulse" : ""}`} />
                  {dispatching === "android" ? "Disparando…" : "Build Android"}
                </Button>
                <Button
                  onClick={() => dispatchWorkflow("ios")}
                  size="lg"
                  variant="secondary"
                  className="h-12 text-base"
                  disabled={dispatching !== null || !ready}
                >
                  <Rocket className={`mr-2 h-5 w-5 ${dispatching === "ios" ? "animate-pulse" : ""}`} />
                  {dispatching === "ios" ? "Disparando…" : "Build iOS"}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <a
                  href={`https://github.com/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ejecutar workflow
                </a>
              </Button>
              {info.runUrl && (
                <Button asChild variant="ghost">
                  <a href={info.runUrl} target="_blank" rel="noopener noreferrer">
                    Ver último build
                  </a>
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
