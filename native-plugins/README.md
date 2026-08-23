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

```bash
npx cap add ios && npm run build && npx cap sync ios
```

Copia `mesh-advertiser/ios/MeshAdvertiserPlugin.swift` a `ios/App/App/` (Xcode →
*Add Files to "App"*), y en `ios/App/App/Info.plist` agrega:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>MATS usa Bluetooth para crear una red malla de emergencia sin internet.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>MATS usa Bluetooth para retransmitir alertas SOS entre dispositivos cercanos.</string>
<key>UIBackgroundModes</key>
<array>
  <string>bluetooth-central</string>
  <string>bluetooth-peripheral</string>
</array>
```

En iOS el registro del plugin es automático gracias a `@objc(MeshAdvertiserPlugin)`.

## Prueba
Dos teléfonos con el APK/IPA instalado, **modo avión con Bluetooth encendido**,
a menos de ~30 m. En uno dispara SOS o el botón *Simulacro*; en el otro debe
llegar la alerta y verse el contador de vecinos en *Mi Estado*.
