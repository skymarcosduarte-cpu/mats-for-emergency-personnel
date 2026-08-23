#!/usr/bin/env node
// Añade los background modes y descripciones de permisos BLE al Info.plist de iOS.
// Idempotente: se puede correr las veces que quieras.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const path = 'ios/App/App/Info.plist';
if (!existsSync(path)) {
  console.error('No existe ' + path + '. Ejecuta antes: npx cap add ios');
  process.exit(1);
}

let xml = readFileSync(path, 'utf8');

const strings = {
  NSBluetoothAlwaysUsageDescription:
    'MATS usa Bluetooth para formar una red malla y retransmitir alertas de emergencia cuando no hay internet.',
  NSBluetoothPeripheralUsageDescription:
    'MATS emite alertas de auxilio por Bluetooth hacia dispositivos cercanos.',
  NSLocationWhenInUseUsageDescription:
    'MATS comparte tu ubicación en alertas de emergencia y en Tránsito Seguro.',
  NSLocationAlwaysAndWhenInUseUsageDescription:
    'MATS comparte tu ubicación en alertas de emergencia, incluso en segundo plano.',
};

const additions = [];
for (const [key, value] of Object.entries(strings)) {
  if (!xml.includes(`<key>${key}</key>`)) {
    additions.push(`\t<key>${key}</key>\n\t<string>${value}</string>`);
  }
}

if (!xml.includes('<key>UIBackgroundModes</key>')) {
  additions.push(
    '\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>bluetooth-central</string>\n\t\t<string>bluetooth-peripheral</string>\n\t\t<string>location</string>\n\t</array>'
  );
} else {
  for (const mode of ['bluetooth-central', 'bluetooth-peripheral', 'location']) {
    if (!xml.includes(`<string>${mode}</string>`)) {
      xml = xml.replace('<key>UIBackgroundModes</key>\n\t<array>', `<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>${mode}</string>`);
    }
  }
}

if (additions.length) {
  const marker = xml.lastIndexOf('</dict>');
  xml = xml.slice(0, marker) + additions.join('\n') + '\n' + xml.slice(marker);
  writeFileSync(path, xml);
  console.log('Info.plist actualizado con ' + additions.length + ' entradas.');
} else {
  writeFileSync(path, xml);
  console.log('Info.plist ya contenía las entradas de la malla.');
}
