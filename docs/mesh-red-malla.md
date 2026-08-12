# Red Malla (Mesh BLE) — arquitectura y despliegue

## Qué hace hoy la app (solo TypeScript, ya funcionando)

| Capa | Archivo | Función |
|---|---|---|
| Protocolo binario | `src/lib/mesh/protocol.ts` | Paquete de 21 bytes: tipo, msgId, TTL, origen, lat/lng (~2 m), timestamp |
| Fragmentación + ACK | `src/lib/mesh/frames.ts` | Divide payloads grandes en tramas de 12 bytes, las reensambla y confirma con un bitmap |
| Almacenamiento persistente | `src/lib/mesh/meshStore.ts` | Bandeja de salida y caché anti-duplicados en IndexedDB (sobreviven al cierre de la app) |
| Transporte | `src/lib/mesh/nativeMeshTransport.ts` | Ciclos de escaneo, prioridades, jitter, backoff y supresión de tormenta |
| UI | `src/pages/StatusScreen.tsx` | Interruptor de malla, vecinos detectados y mensajes pendientes |

### Prioridades

| Prioridad | Tipos | Vida en la bandeja |
|---|---|---|
| 0 | `PANIC`, `HELP_14` | 24 h |
| 1 | `STATUS_NEED_HELP` | 6 h |
| 2 | resto | 1 h |

### Control de tormenta
- **Jitter** aleatorio de 0–800 ms antes de cada emisión.
- **Supresión por gossip**: si se escuchan 3 copias del mismo mensaje de vecinos, se deja de retransmitir (nunca aplica a los propios SOS).
- **Backoff exponencial** hasta 60 s, máximo 12 intentos, o hasta recibir ACK.

### Store-and-forward (DTN)
Un teléfono que recibe un SOS lo guarda en IndexedDB y lo sigue anunciando durante 24 h. Si camina hacia una zona con otros nodos o con internet, el mensaje llega allá aunque nunca existiera una ruta directa.

## Lo que falta: emisión nativa

`@capacitor-community/bluetooth-le` solo escucha. Para que cada teléfono sea repetidor hace falta el plugin `MeshAdvertiser`, ya escrito en `native-plugins/mesh-advertiser/`.

### Android
1. Copiar `MeshAdvertiserPlugin.java` a `android/app/src/main/java/app/lovable/mesh/`.
2. En `MainActivity.java`: `registerPlugin(MeshAdvertiserPlugin.class);`
3. En `AndroidManifest.xml`:
   ```xml
   <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
   <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
   <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
   ```
4. `npx cap sync android`

### iOS
1. Copiar `MeshAdvertiserPlugin.swift` a `ios/App/App/`.
2. En `Info.plist`: `NSBluetoothAlwaysUsageDescription` y `UIBackgroundModes` con `bluetooth-peripheral` y `bluetooth-central`.
3. `npx cap sync ios`

La app detecta el plugin automáticamente (`Capacitor.isPluginAvailable('MeshAdvertiser')`). Mientras no exista, la malla opera en **modo recepción** y encola todo lo que se quiera emitir.

## Siguientes pasos sugeridos
- **Segundo plano**: foreground service en Android; en iOS aprovechar los background modes ya declarados.
- **Firma Ed25519** de los paquetes para evitar SOS falsos inyectados en la malla.
- **Puente malla ↔ internet**: el primer nodo con datos sube todo lo acumulado.
- **Beacons ESP32** fijos en albergues y puntos de reunión.