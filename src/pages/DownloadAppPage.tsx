import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

const APK_URL =
  "https://github.com/skymarcosduarte-cpu/safe-guard-link/releases/latest/download/MATS-RedMesh.apk";

type Platform = "android" | "ios" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/Mac/i.test(ua) && "ontouchend" in document) return "ios";
  return "desktop";
}

export default function DownloadAppPage() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [qr, setQr] = useState<string | null>(null);

  const pageUrl = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}/descargar`
        : "https://mats-app.com/descargar",
    []
  );

  useEffect(() => {
    setPlatform(detectPlatform());
    QRCode.toDataURL(pageUrl, { width: 240, margin: 2 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [pageUrl]);

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
            <Button asChild size="lg" className="h-14 w-full text-lg">
              <a href={APK_URL}>
                <Download className="mr-2 h-6 w-6" />
                Descargar app para Android
              </a>
            </Button>
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
