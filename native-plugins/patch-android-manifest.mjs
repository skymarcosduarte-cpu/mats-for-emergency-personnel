#!/usr/bin/env node
// Añade permisos BLE + el <service> de la malla al AndroidManifest.xml generado
// por Capacitor. Es idempotente: se puede correr las veces que quieras.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const path = 'android/app/src/main/AndroidManifest.xml';
if (!existsSync(path)) {
  console.error('No existe ' + path + '. Ejecuta antes: npx cap add android');
  process.exit(1);
}

let xml = readFileSync(path, 'utf8');

const permissions = [
  '<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />',
  '<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />',
  '<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />',
  '<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />',
  '<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.WAKE_LOCK" />',
  '<uses-feature android:name="android.hardware.bluetooth_le" android:required="true" />',
];

const missing = permissions.filter((p) => {
  const name = p.match(/android:name="([^"]+)"/)?.[1];
  return name ? !xml.includes(`android:name="${name}"`) : false;
});

if (missing.length) {
  xml = xml.replace('</manifest>', `    ${missing.join('\n    ')}\n</manifest>`);
}

const service =
  '        <service\n' +
  '            android:name="app.lovable.mats.mesh.MeshForegroundService"\n' +
  '            android:foregroundServiceType="connectedDevice"\n' +
  '            android:exported="false" />\n';

if (!xml.includes('app.lovable.mats.mesh.MeshForegroundService')) {
  xml = xml.replace('</application>', service + '    </application>');
}

writeFileSync(path, xml);
console.log(`AndroidManifest.xml actualizado (${missing.length} permisos añadidos).`);
