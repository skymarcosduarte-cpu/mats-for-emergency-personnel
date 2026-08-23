#!/usr/bin/env node
/**
 * Evita que la app nativa se vea "con zoom".
 *
 * Android aplica el ajuste del sistema "Tamaño de fuente / Tamaño de pantalla"
 * al WebView (textZoom), lo que agranda todo el contenido y hace que la UI no
 * quepa en pantalla. Aquí forzamos textZoom = 100 y desactivamos el zoom manual
 * en MainActivity, de forma idempotente.
 */
import fs from 'node:fs';
import path from 'node:path';

const base = 'android/app/src/main/java';

function findMainActivity(dir) {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findMainActivity(p);
      if (found) return found;
    } else if (entry.name === 'MainActivity.java' || entry.name === 'MainActivity.kt') {
      return p;
    }
  }
  return null;
}

const file = findMainActivity(base);
if (!file) {
  console.log('[patch-android-webview] MainActivity no encontrado, se omite.');
  process.exit(0);
}

let src = fs.readFileSync(file, 'utf8');
if (src.includes('setTextZoom')) {
  console.log('[patch-android-webview] Ya parcheado.');
  process.exit(0);
}

const isKotlin = file.endsWith('.kt');

if (isKotlin) {
  if (!src.includes('import android.os.Bundle')) {
    src = src.replace(/(package .*\n)/, '$1\nimport android.os.Bundle\n');
  }
  const body = `
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val settings = this.bridge.webView.settings
        settings.textZoom = 100
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.loadWithOverviewMode = false
        settings.useWideViewPort = false
    }
`;
  // Inserta antes de la última llave de la clase
  const idx = src.lastIndexOf('}');
  src = src.slice(0, idx) + body + src.slice(idx);
} else {
  if (!src.includes('import android.os.Bundle;')) {
    src = src.replace(/(package .*;\n)/, '$1\nimport android.os.Bundle;\nimport android.webkit.WebSettings;\n');
  } else if (!src.includes('import android.webkit.WebSettings;')) {
    src = src.replace('import android.os.Bundle;', 'import android.os.Bundle;\nimport android.webkit.WebSettings;');
  }
  const body = `
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebSettings settings = this.bridge.getWebView().getSettings();
        settings.setTextZoom(100);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(false);
    }
`;
  const idx = src.lastIndexOf('}');
  src = src.slice(0, idx) + body + src.slice(idx);
}

fs.writeFileSync(file, src);
console.log(`[patch-android-webview] Parcheado ${file}`);
