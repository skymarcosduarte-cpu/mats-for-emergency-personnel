// Aviso que detecta si la app corre como Web/PWA y sugiere abrir la versión nativa.
// Distingue tres casos: navegador web, PWA instalada (acceso directo) y app nativa.
// Solo la app nativa no muestra el aviso.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, X, Globe, Home } from "lucide-react";
import { isNative } from "@/lib/capacitor";

type RunMode = "native" | "pwa" | "web";

function detectRunMode(): RunMode {
  if (isNative()) return "native";
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
  return standalone ? "pwa" : "web";
}

const SESSION_KEY = "native-app-notice-dismissed";

export function NativeAppNotice() {
  const [mode, setMode] = useState<RunMode>("native");
  const [dismissed, setDismissed] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const m = detectRunMode();
    setMode(m);
    if (m === "native") return;
    // Mostrar de nuevo en cada sesión: el objetivo es que el usuario migre a la app nativa.
    setDismissed(sessionStorage.getItem(SESSION_KEY) === "1");
  }, []);

  if (mode === "native" || dismissed) return null;

  const isPwa = mode === "pwa";

  return (
    <Card className="fixed top-2 left-4 right-4 z-[60] border-amber-500/60 bg-amber-50 dark:bg-amber-950/90 shadow-lg animate-in slide-in-from-top-4">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            {isPwa ? (
              <Home className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <Globe className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-amber-900 dark:text-amber-100">
              {isPwa
                ? "Estás usando el acceso directo web"
                : "Estás usando la versión web"}
            </h3>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-0.5">
              {isPwa
                ? "Este ícono abre la versión del navegador, no la app nativa. Instala el APK/IPA oficial para tener Red Mesh y todas las funciones."
                : "Para Red Mesh (Bluetooth), notificaciones y mejor rendimiento, instala la app nativa oficial."}
            </p>
            <div className="flex gap-2 mt-2.5">
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => navigate("/descargar")}
              >
                <Smartphone className="h-4 w-4 mr-1.5" />
                Obtener app nativa
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDismissed(true);
                  sessionStorage.setItem(SESSION_KEY, "1");
                }}
              >
                Continuar aquí
              </Button>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 -mt-1 -mr-1"
            onClick={() => {
              setDismissed(true);
              sessionStorage.setItem(SESSION_KEY, "1");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
