# Plugins nativos de la Red Malla (BLE Mesh)

La malla BLE **solo funciona en la app nativa** (APK/IPA). En Chrome o PWA el
interruptor "Activar malla" aparece bloqueado porque el navegador no permite
anunciar ni escanear Bluetooth en segundo plano.

## Forma más simple: compilar el APK en la nube (sin Android Studio)

1. En GitHub abre la pestaña **Actions**.
2. Elige el flujo **"Build APK con Red Mesh"** y pulsa **Run workflow**.
3. Espera ~8 minutos y descarga el artefacto **MATS-mesh-apk**.
4. Pasa el `.apk` al teléfono, instálalo (permite "orígenes desconocidos"),
   acepta permisos de Bluetooth y Ubicación y activa *Red Mesh*.

El flujo copia los plugins, parchea el `AndroidManifest.xml` y compila solo.
No necesitas instalar nada en tu computadora.

## Android en local (avanzado)


```bash
git pull                 # tras exportar a GitHub
npm install
npx cap add android      # solo la primera vez
npm run build
npx cap sync android
bash native-plugins/install-android.sh   # copia plugins + registra en MainActivity
```

Después edita `android/app/src/main/AndroidManifest.xml` y pega el contenido de
`native-plugins/android-templates/AndroidManifest.snippet.xml`
(permisos arriba, `<service>` dentro de `<application>`).

Finalmente:

```bash
npx cap run android
```

Al abrir la app, acepta los permisos de **Bluetooth** y **Ubicación**
(Android exige ubicación para escanear BLE). Luego ve a *Mi Estado → Red Malla
Bluetooth* y activa el interruptor.

### Archivos
- `mesh-advertiser/android/MeshAdvertiserPlugin.java` — anuncio BLE (paquete `app.lovable.mats.mesh`)
- `mesh-foreground-service/android/MeshForegroundService.java` + `...Plugin.java` — escaneo en segundo plano
- `android-templates/MainActivity.java.example` — ejemplo de registro de plugins

## iOS

### Opción A — En la nube (sin Mac)

GitHub → **Actions** → **Build IPA con Red Mesh (iOS)** → *Run workflow*.
Al terminar descarga el artefacto **MATS-mesh-ipa**. El IPA sale **sin firmar**:
se instala con AltStore / Sideloadly, o se firma con tu certificado de
desarrollador para TestFlight / App Store.

### Opción B — Con Mac y Xcode

```bash
npx cap add ios && npm run build && npx cap sync ios
gem install xcodeproj          # una sola vez
bash native-plugins/install-ios.sh
npx cap open ios
```

El script copia `MeshAdvertiserPlugin.swift` y `MeshAdvertiserPlugin.m`, crea el
bridging header, los añade al target de Xcode y parcha `Info.plist`
(`NSBluetoothAlwaysUsageDescription`, `NSBluetoothPeripheralUsageDescription`,
descripciones de ubicación y `UIBackgroundModes` con `bluetooth-central`,
`bluetooth-peripheral` y `location`).

En Xcode: *Signing & Capabilities* → **Background Modes** → marca
"Uses Bluetooth LE accessories" y "Acts as a Bluetooth LE accessory", elige tu
equipo de firma y ejecuta en un iPhone real (el simulador no tiene BLE).

El registro del plugin lo hace la macro `CAP_PLUGIN` de
`MeshAdvertiserPlugin.m`; sin ese archivo el plugin **no** aparece en Capacitor.

### Límites de iOS
- En segundo plano el anuncio va al *overflow area*: sólo lo ven otros iPhone
  con la app instalada. Para interoperar con Android, la app debe estar en
  primer plano al emitir.
- El escaneo en background es más lento y sin `allowDuplicates`; los mensajes
  pendientes (DTN en IndexedDB) se emiten al volver a primer plano.


## Prueba
Dos teléfonos con el APK/IPA instalado, **modo avión con Bluetooth encendido**,
a menos de ~30 m. En uno dispara SOS o el botón *Simulacro*; en el otro debe
llegar la alerta y verse el contador de vecinos en *Mi Estado*.
