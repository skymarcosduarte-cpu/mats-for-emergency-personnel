// Puente entre el Detector de Señales y el mapa: publica la cuadrícula de
// sectores (A1–C3…) con su intensidad para dibujarla como rejilla de calor
// sobre el mapa en vivo. Se guarda en localStorage y expira a las 6 horas.

import { SectorGrid, type SectorSnapshot, type SectorBounds } from './signalSectors';

export interface SectorOverlayCell {
  label: string;
  bounds: SectorBounds;
  /** 0 a 1: concentración relativa de indicios */
  ratio: number;
  bestRssi: number;
  devices: number;
  sustained: number;
  isHot: boolean;
}

export interface SectorOverlay {
  cells: SectorOverlayCell[];
  updatedAt: number;
}

const STORAGE_KEY = 'mats-signal-sectors';
const TTL_MS = 6 * 60 * 60 * 1000;
export const SIGNAL_SECTORS_EVENT = 'mats:signal-sectors-changed';

export function getSectorOverlay(): SectorOverlayCell[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SectorOverlay;
    if (!parsed?.cells || Date.now() - (parsed.updatedAt || 0) > TTL_MS) return [];
    return parsed.cells;
  } catch {
    return [];
  }
}

export function publishSectorOverlay(snapshot: SectorSnapshot): void {
  const { cells, hot } = snapshot;
  // Un snapshot vacío NO borra lo guardado: al reabrir el detector la
  // cuadrícula en memoria empieza vacía pero el mapa guardado (6 h) debe
  // sobrevivir. El borrado sólo ocurre con clearSectorOverlay() explícito.
  if (cells.length === 0) return;
  const maxScore = Math.max(...cells.map((c) => SectorGrid.score(c)), 1);
  const payload: SectorOverlay = {
    updatedAt: Date.now(),
    cells: cells.map((cell) => ({
      label: cell.label,
      bounds: cell.bounds,
      ratio: SectorGrid.score(cell) / maxScore,
      bestRssi: cell.bestRssi,
      devices: cell.devices.size,
      sustained: cell.sustained.size,
      isHot: Boolean(hot && hot.row === cell.row && hot.col === cell.col),
    })),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota errors */
  }
  window.dispatchEvent(new CustomEvent(SIGNAL_SECTORS_EVENT));
}

export function clearSectorOverlay(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(SIGNAL_SECTORS_EVENT));
}

/** Color del sector según su concentración de indicios (bajo → alto) */
export function sectorColor(ratio: number): string {
  if (ratio >= 0.8) return '#dc2626';
  if (ratio >= 0.55) return '#f97316';
  if (ratio >= 0.3) return '#facc15';
  return '#10b981';
}
