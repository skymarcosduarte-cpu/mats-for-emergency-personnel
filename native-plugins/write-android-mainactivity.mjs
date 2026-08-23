#!/usr/bin/env node
/**
 * Reescribe por completo MainActivity.java con una versión canónica:
 * registra los plugins de la Red Mesh y fija el zoom del WebView.
 *
 * Al reescribir el archivo (en vez de parchearlo) es imposible que queden
 * dos métodos onCreate duplicados, que era la causa del fallo de compilación.
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

const existing = findMainActivity(base);
if (!existing) {
  console.error('[write-android-mainactivity] No se encontró MainActivity. Ejecuta antes: npx cap add android');
  process.exit(1);
}

const src = fs.readFileSync(existing, 'utf8');
const pkgMatch = src.match(/^\s*package\s+([\w.]+)\s*;?/m);
if (!pkgMatch) {
  console.error('[write-android-mainactivity] No se pudo leer el package de MainActivity.');
  process.exit(1);
}
const pkg = pkgMatch[1];

const java = `package ${pkg};

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
import app.lovable.mats.mesh.MeshAdvertiserPlugin;
import app.lovable.mats.mesh.MeshForegroundServicePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MeshAdvertiserPlugin.class);
        registerPlugin(MeshForegroundServicePlugin.class);
        super.onCreate(savedInstanceState);

        WebSettings settings = this.bridge.getWebView().getSettings();
        settings.setTextZoom(100);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(false);
    }
}
`;

// Si el proyecto venía en Kotlin, eliminamos el .kt y escribimos el .java.
const target = path.join(path.dirname(existing), 'MainActivity.java');
if (existing.endsWith('.kt')) fs.rmSync(existing);
fs.writeFileSync(target, java);
console.log(`[write-android-mainactivity] MainActivity reescrito (package ${pkg}) en ${target}`);
