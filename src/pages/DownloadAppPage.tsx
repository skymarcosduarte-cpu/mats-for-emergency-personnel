import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MatsLogo } from "@/components/MatsLogo";
import {
  Download,
  Smartphone,
  Apple,
  Monitor,
  Share2,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

const GITHUB_REPO = "skymarcosduarte-cpu/safe-guard-link";
const APK_FALLBACK_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/MATS-RedMesh.apk`;
const CACHE_KEY = "mats-apk-check-v1";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

type Platform = "android" | "ios" | "desktop";
type ApkStatus = "checking" | "ok" | "unavailable";

interface CachedResult {
  status: ApkStatus;
  url: string;
  ts: number;
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/Mac/i.test(ua) && "ontouchend" in document) return "ios";
  return "desktop";
}

/**
 * Verifica la disponibilidad del APK en dos pasos:
 * 1) API de GitHub (/releases/latest) — entrega la URL real del asset y metadatos.
 *    Si el repo es privado o no hay release, responde 404 y caemos al paso 2.
 * 2) HEAD directo a la URL de descrega (releases/latest/download/*.apk) — no
 *    consume cuota de la API y confirma si el archivo redirige a un 200.
 * El resultado se cachea en sessionStorage 10 min para no agotar el límite de
 * 60 peticiones/hora por IP de la API no autenticada.
 */
async function checkApkAvailability(): Promise<{ status: ApkStatus; url: string }> {
  // 1) API de GitHub
  try {
    const apiRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (apiRes.ok) {
      const data = await apiRes.json();
      const asset = (data?.assets ?? []).find((a: { name?: string }) =>
        a?.name?.toLowerCase().endsWith(".apk")
      );
      if (asset?.browser_download_url) {
        return { status: "ok", url: asset.browser_download_url };
      }
      // El release existe pero sin asset .apk
      return { status: "unavailable", url: APK_FALLBACK_URL };
    }
    // 404 = repo privado o sin releases → caer al HEAD de respaldo
  } catch {
    // error de red → caer al HEAD de respaldo
  }

  // 2) HEAD directo al enlace de descarga (respaldo, sin límite de API)
  try {
    const headRes = await fetch(APK_FALLBACK_URL, {
      method: "HEAD",
      redirect: "follow",
    });
    if (headRes.ok) {
      return { status: "ok", url: APK_FALLBACK_URL };
    }
  } catch {
    // ignorar y reportar no disponible
  }

  return { status: "unavailable", url: APK_FALLBACK_URL };
}

function readCache(): CachedResult | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedResult;
    if (Date.now() - parsed.ts > CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(result: { status: ApkStatus; url: string }) {
  try {
    const entry: CachedResult = { ...result, ts: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* sessionStorage no disponible */
  }
}

export default function DownloadAppPage() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [qr, setQr] = useState<string | null>(null);
  const [apkUrl, setApkUrl] = useState<string>(APK_FALLBACK_URL);
  const [apkStatus, setApkStatus] = useState<ApkStatus>("checking");

  const pageUrl = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}/descargar`
        : "https://mats-app.com/descargar",
    []
  );

  const runCheck = useCallback(async () => {
    setApkStatus("checking");

    // 1) Intentar caché primero
    const cached = readCache();
    if (cached) {
      setApkUrl(cached.url);
      setApkStatus(cached.status);
      return;
    }

    // 2) Verificación en vivo
    const result = await checkApkAvailability();
    setApkUrl(result.url);
    setApkStatus(result.status);
    writeCache(result);
  }, []);

  useEffect(() => {
    setPlatform(detectPlatform());
    QRCode.toDataURL(pageUrl, { width: 240, margin: 2 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [pageUrl]);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  const shareText = `Descarga la app MATS (alertas y seguridad) desde este enlace seguro:\n${pageUrl}`;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Descargar MATS", text: shareText, url: pageUrl });
        return;
      } catch {
        /* usuario canceló */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center gap-3 border-b p-4">
        <Link to="/" aria-label="Volver al inicio">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-6 w-6" />
          </Button>
        </Link>
        <MatsLogo className="h-8 w-8" />
        <span className="text-lg font-bold">Descargar MATS</span>
      </header>

      <main className="mx-auto w-full max-w-xl space-y-6 p-4">
        <h1 className="text-3xl font-extrabold leading-tight">
          Instala la app MATS en tu equipo
        </h1>
        <p className="text-lg text-muted-foreground">
          Elige tu dispositivo y sigue los pasos. Solo toma un minuto.
        </p>

        {/* ANDROID */}
        <Card className={platform === "android" ? "border-primary border-2" : ""}>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <Smartphone className="h-8 w-8 text-primary" />
              <h2 className="text-2xl font-bold">Android (celular o tablet)</h2>
            </div>
            <p className="text-base">
              Versión completa con <strong>Red Mesh por Bluetooth</strong> para usarla
              aún sin internet.
            </p>
            {apkStatus === "unavailable" ? (
              <div className="rounded-lg border-2 border-destructive/40 bg-destructive/10 p-4 text-base">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <p className="font-bold">Descarga no disponible por ahora</p>
                </div>
                <p className="mt-2">
                  El archivo APK aún no se ha publicado o el repositorio es privado.
                  Esto suele resolverse en unos minutos tras ejecutar el build en GitHub Actions.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <Button
                    onClick={runCheck}
                    variant="outline"
                    size="lg"
                    className="h-12 w-full text-base"
                    disabled={apkStatus === "checking"}
                  >
                    <RefreshCw className={`mr-2 h-5 w-5 ${apkStatus === "checking" ? "animate-spin" : ""}`} />
                    Reintentar verificación
                  </Button>
                  <Button asChild variant="secondary" size="lg" className="h-12 w-full text-base">
                    <Link to="/install">Instalar desde el navegador (alternativa)</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                asChild
                size="lg"
                className="h-14 w-full text-lg"
                disabled={apkStatus === "checking"}
              >
                <a href={apkUrl}>
                  <Download className="mr-2 h-6 w-6" />
                  {apkStatus === "checking" ? "Verificando descarga..." : "Descargar app para Android"}
                </a>
              </Button>
            )}
            <ol className="space-y-2 text-base">
              <li>1. Toca el botón y espera a que baje el archivo.</li>
              <li>2. Ábrelo y acepta “Instalar apps desconocidas”.</li>
              <li>3. Si aparece un aviso de Play Protect, toca “Instalar de todos modos”.</li>
              <li>4. Abre MATS y entra a <strong>Red Mesh</strong> para activarla.</li>
            </ol>
          </CardContent>
        </Card>

        {/* IPHONE */}
        <Card className={platform === "ios" ? "border-primary border-2" : ""}>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <Apple className="h-8 w-8 text-primary" />
              <h2 className="text-2xl font-bold">iPhone o iPad</h2>
            </div>
            <ol className="space-y-2 text-base">
              <li>1. Abre esta página en <strong>Safari</strong>.</li>
              <li>
                2. Toca el botón <Share2 className="inline h-4 w-4" /> Compartir (abajo).
              </li>
              <li>3. Elige <strong>“Agregar a pantalla de inicio”</strong>.</li>
              <li>4. Confirma en “Agregar”. Listo, ya tienes el ícono de MATS.</li>
            </ol>
            <Button asChild variant="secondary" size="lg" className="h-12 w-full text-base">
              <Link to="/install">Ver guía con imágenes</Link>
            </Button>
          </CardContent>
        </Card>

        {/* DESKTOP */}
        <Card className={platform === "desktop" ? "border-primary border-2" : ""}>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <Monitor className="h-8 w-8 text-primary" />
              <h2 className="text-2xl font-bold">Laptop, PC o Mac</h2>
            </div>
            <ol className="space-y-2 text-base">
              <li>1. Abre MATS en Chrome, Edge o Safari.</li>
              <li>
                2. En la barra de direcciones toca el ícono <Download className="inline h-4 w-4" />{" "}
                <strong>Instalar</strong>.
              </li>
              <li>3. Confirma “Instalar”. La app quedará en tu escritorio.</li>
            </ol>
            <Button asChild variant="secondary" size="lg" className="h-12 w-full text-base">
              <Link to="/install">Ver guía con imágenes</Link>
            </Button>
          </CardContent>
        </Card>

        {/* COMPARTIR */}
        <Card>
          <CardContent className="space-y-4 p-5 text-center">
            <h2 className="text-xl font-bold">Comparte este enlace</h2>
            <p className="break-all text-base font-semibold text-primary">{pageUrl}</p>
            {qr && (
              <img
                src={qr}
                alt="Código QR para descargar la app MATS"
                className="mx-auto h-40 w-40 rounded-lg border"
              />
            )}
            <Button onClick={share} size="lg" className="h-14 w-full text-lg">
              <Share2 className="mr-2 h-6 w-6" />
              Compartir por WhatsApp
            </Button>
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" /> Enlace oficial y seguro de MATS
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
