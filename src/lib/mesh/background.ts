// Ejecución en segundo plano de la malla.
//
// Android: un Foreground Service (plugin nativo "MeshForegroundService") mantiene
//   vivo el proceso con una notificación persistente, para que el escaneo BLE y
//   el encolado de mensajes sigan funcionando con la pantalla apagada.
// iOS: no existe foreground service; se usan los background modes
//   `bluetooth-central` y `bluetooth-peripheral` declarados en Info.plist, que
//   permiten seguir escaneando (con menor frecuencia) y anunciando en overflow.
//
// Todo se carga dinámicamente: en web/PWA este módulo no importa nada nativo.

interface MeshForegroundServicePlugin {
  start(options: { title: string; body: string }): Promise<void>;
  stop(): Promise<void>;
}

let plugin: MeshForegroundServicePlugin | null = null;
let running = false;

export type MeshBackgroundMode = 'foreground-service' | 'ios-background-modes' | 'unavailable';

let mode: MeshBackgroundMode = 'unavailable';

export function getBackgroundMode(): MeshBackgroundMode {
  return mode;
}

export function isBackgroundRunning(): boolean {
  return running;
}

/** Arranca la ejecución en segundo plano si la plataforma lo permite. */
export async function startBackground(disaster: boolean): Promise<MeshBackgroundMode> {
  try {
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
    const platform = Capacitor.getPlatform();

    if (platform === 'ios') {
      // Los background modes de Info.plist ya mantienen el escaneo BLE vivo.
      mode = 'ios-background-modes';
      running = true;
      return mode;
    }

    if (platform !== 'android' || !Capacitor.isPluginAvailable('MeshForegroundService')) {
      mode = 'unavailable';
      return mode;
    }

    plugin = plugin ?? registerPlugin<MeshForegroundServicePlugin>('MeshForegroundService');
    await plugin.start({
      title: disaster ? 'MATS · Red malla activa (emergencia)' : 'MATS · Red malla activa',
      body: 'Retransmitiendo alertas cercanas sin internet',
    });
    mode = 'foreground-service';
    running = true;
    return mode;
  } catch (error) {
    console.warn('[mesh] segundo plano no disponible:', error);
    mode = 'unavailable';
    return mode;
  }
}

export async function stopBackground(): Promise<void> {
  running = false;
  try {
    await plugin?.stop();
  } catch {
    /* ignore */
  }
}
