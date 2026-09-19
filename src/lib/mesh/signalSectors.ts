// Mapa de indicios por sectores (cuadrícula tipo A1–C3) para el Detector de
// Señales. Mientras el rescatista camina con el GPS activo, cada lectura BLE se
// acumula en la celda donde se encontraba, generando un mapa de calor de
// indicios y un "vector de interés" hacia la celda con mayor concentración.

export const SECTOR_SIZE_M = 15;

export interface SectorBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface SectorCell {
  row: number;
  col: number;
  /** Rectángulo geográfico de la celda, para dibujarla en el mapa */
  bounds: SectorBounds;
  /** Etiqueta legible tipo A1, B3… */
  label: string;
  /** Mejor intensidad registrada en la celda */
  bestRssi: number;
  /** Dispositivos distintos oídos en la celda */
  devices: Set<string>;
  /** Dispositivos con presencia sostenida (indicio fuerte) */
  sustained: Set<string>;
  samples: number;
  lat: number;
  lng: number;
  updatedAt: number;
}

export interface SectorSnapshot {
  cells: SectorCell[];
  rows: number[];
  cols: number[];
  hot: SectorCell | null;
}

function labelFor(row: number, col: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const idx = ((row % letters.length) + letters.length) % letters.length;
  return `${letters[idx]}${col + 1}`;
}

export class SectorGrid {
  private origin: { lat: number; lng: number } | null = null;
  private cells = new Map<string, SectorCell>();

  reset(): void {
    this.origin = null;
    this.cells.clear();
  }

  hasData(): boolean {
    return this.cells.size > 0;
  }

  private cellIndex(lat: number, lng: number): { row: number; col: number } {
    if (!this.origin) this.origin = { lat, lng };
    const latMeters = (lat - this.origin.lat) * 111320;
    const lngMeters =
      (lng - this.origin.lng) * 111320 * Math.cos((this.origin.lat * Math.PI) / 180);
    return {
      row: Math.floor(-latMeters / SECTOR_SIZE_M),
      col: Math.floor(lngMeters / SECTOR_SIZE_M),
    };
  }

  /** Sector en el que está el rescatista ahora (sin registrar indicios).
   *  Si la cuadrícula aún no tiene origen, la primera posición GPS lo fija,
   *  para que el "TÚ" aparezca aunque todavía no haya detecciones. */
  locate(lat: number, lng: number): { row: number; col: number; label: string } {
    const { row, col } = this.cellIndex(lat, lng);
    return { row, col, label: labelFor(row, col) };
  }

  /** Rectángulo geográfico de una celda (para dibujarla en el mapa) */
  private boundsFor(row: number, col: number): SectorBounds {
    const origin = this.origin ?? { lat: 0, lng: 0 };
    const latStep = SECTOR_SIZE_M / 111320;
    const lngStep =
      SECTOR_SIZE_M / (111320 * Math.max(0.1, Math.cos((origin.lat * Math.PI) / 180)));
    return {
      north: origin.lat - row * latStep,
      south: origin.lat - (row + 1) * latStep,
      west: origin.lng + col * lngStep,
      east: origin.lng + (col + 1) * lngStep,
    };
  }

  record(params: {
    lat: number;
    lng: number;
    rssi: number;
    deviceId: string;
    sustained: boolean;
  }): void {
    const { row, col } = this.cellIndex(params.lat, params.lng);
    const key = `${row}:${col}`;
    const prev = this.cells.get(key);
    const cell: SectorCell = prev ?? {
      row,
      col,
      bounds: this.boundsFor(row, col),
      label: labelFor(row, col),
      bestRssi: params.rssi,
      devices: new Set<string>(),
      sustained: new Set<string>(),
      samples: 0,
      lat: params.lat,
      lng: params.lng,
      updatedAt: Date.now(),
    };
    cell.bestRssi = Math.max(cell.bestRssi, params.rssi);
    cell.devices.add(params.deviceId);
    if (params.sustained) cell.sustained.add(params.deviceId);
    cell.samples += 1;
    cell.lat = params.lat;
    cell.lng = params.lng;
    cell.updatedAt = Date.now();
    this.cells.set(key, cell);
  }

  /** Puntaje de indicios: pondera dispositivos sostenidos e intensidad */
  static score(cell: SectorCell): number {
    const strength = Math.max(0, cell.bestRssi + 100) / 45; // 0..1 aprox
    return cell.sustained.size * 2 + cell.devices.size + strength * 2;
  }

  snapshot(): SectorSnapshot {
    const cells = Array.from(this.cells.values());
    if (cells.length === 0) return { cells, rows: [], cols: [], hot: null };
    const rowsRange = cells.map((c) => c.row);
    const colsRange = cells.map((c) => c.col);
    const rows: number[] = [];
    const cols: number[] = [];
    for (let r = Math.min(...rowsRange); r <= Math.max(...rowsRange); r += 1) rows.push(r);
    for (let c = Math.min(...colsRange); c <= Math.max(...colsRange); c += 1) cols.push(c);
    const hot = cells.reduce(
      (best, cell) => (best && SectorGrid.score(best) >= SectorGrid.score(cell) ? best : cell),
      null as SectorCell | null,
    );
    return { cells, rows, cols, hot };
  }

  cellAt(row: number, col: number): SectorCell | undefined {
    return this.cells.get(`${row}:${col}`);
  }
}
