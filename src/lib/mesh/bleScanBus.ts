// Candado compartido para el escaneo Bluetooth LE.
// El plugin @capacitor-community/bluetooth-le sólo permite UNA sesión de
// escaneo activa: quien llama requestLEScan reemplaza al callback anterior y
// stopLEScan detiene el escaneo de todos. Este bus multiplexa un solo escaneo
// entre los interesados (Red Mesh y el Detector de Señales) para que no se
// pisen: cada uno recibe los anuncios y el escaneo físico sólo se detiene
// cuando nadie lo está usando.

type RawScanResult = {
  device: { deviceId: string; name?: string | null };
  localName?: string | null;
  rssi?: number | null;
  manufacturerData?: Record<string, DataView> | null;
};

export type BleScanListener = (result: RawScanResult) => void;

type BleClientType = typeof import('@capacitor-community/bluetooth-le').BleClient;

class BleScanBus {
  private ble: BleClientType | null = null;
  private listeners = new Map<string, BleScanListener>();
  private running = false;
  private starting: Promise<void> | null = null;

  private async ensureClient(): Promise<BleClientType> {
    if (!this.ble) {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      this.ble = BleClient;
    }
    return this.ble;
  }

  /** Suscribe un interesado; arranca el escaneo físico si nadie lo tenía */
  async acquire(ownerId: string, listener: BleScanListener): Promise<void> {
    const ble = await this.ensureClient();
    this.listeners.set(ownerId, listener);
    if (this.running) return;
    if (this.starting) {
      await this.starting;
      return;
    }
    this.starting = ble
      .requestLEScan({ allowDuplicates: true }, (result) => {
        const raw = result as unknown as RawScanResult;
        this.listeners.forEach((fn) => {
          try {
            fn(raw);
          } catch (error) {
            console.warn('[ble-bus] listener error:', error);
          }
        });
      })
      .then(() => {
        this.running = true;
        this.starting = null;
      })
      .catch((error) => {
        this.starting = null;
        throw error;
      });
    await this.starting;
  }

  /** Da de baja al interesado; detiene el escaneo físico cuando nadie escucha */
  async release(ownerId: string): Promise<void> {
    this.listeners.delete(ownerId);
    if (this.listeners.size > 0 || !this.running) return;
    this.running = false;
    try {
      await this.ble?.stopLEScan();
    } catch {
      /* ya estaba detenido */
    }
  }

  isRunning(): boolean {
    return this.running;
  }
}

export const bleScanBus = new BleScanBus();
