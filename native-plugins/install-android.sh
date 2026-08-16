#!/usr/bin/env bash
# Instala los plugins nativos de la malla en el proyecto Android generado por Capacitor.
# Uso:  bash native-plugins/install-android.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/android/app/src/main/java/app/lovable/mats/mesh"

if [ ! -d "$ROOT/android" ]; then
  echo "No existe la carpeta android/. Ejecuta primero: npx cap add android"
  exit 1
fi

mkdir -p "$DEST"
cp "$ROOT/native-plugins/mesh-advertiser/android/MeshAdvertiserPlugin.java" "$DEST/"
cp "$ROOT/native-plugins/mesh-foreground-service/android/MeshForegroundService.java" "$DEST/"
cp "$ROOT/native-plugins/mesh-foreground-service/android/MeshForegroundServicePlugin.java" "$DEST/"
echo "Plugins copiados en: $DEST"

MAIN=$(find "$ROOT/android/app/src/main/java" -name MainActivity.java | head -1)
if [ -n "$MAIN" ] && ! grep -q "MeshAdvertiserPlugin" "$MAIN"; then
  python3 - "$MAIN" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p).read()
if "import android.os.Bundle;" not in s:
    s = s.replace("import com.getcapacitor.BridgeActivity;",
                  "import android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;")
s = s.replace("import com.getcapacitor.BridgeActivity;",
              "import com.getcapacitor.BridgeActivity;\nimport app.lovable.mats.mesh.MeshAdvertiserPlugin;\nimport app.lovable.mats.mesh.MeshForegroundServicePlugin;")
if "onCreate" in s:
    s = re.sub(r"(super\.onCreate\(savedInstanceState\);)",
               r"\1\n        registerPlugin(MeshAdvertiserPlugin.class);\n        registerPlugin(MeshForegroundServicePlugin.class);", s, count=1)
else:
    s = re.sub(r"(public class MainActivity extends BridgeActivity \{)",
               r"""\1
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MeshAdvertiserPlugin.class);
        registerPlugin(MeshForegroundServicePlugin.class);
        super.onCreate(savedInstanceState);
    }
""", s, count=1)
open(p, "w").write(s)
print("MainActivity actualizado:", p)
PY
else
  echo "MainActivity ya registra los plugins (o no se encontró)."
fi

echo
echo "FALTA MANUAL: añade a android/app/src/main/AndroidManifest.xml el contenido de"
echo "native-plugins/android-templates/AndroidManifest.snippet.xml"
