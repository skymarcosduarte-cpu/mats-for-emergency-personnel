// Catálogo de cámaras preconfiguradas
// NOTA: Los IDs de livestreams de YouTube cambian frecuentemente.
// Dejar youtubeId vacío si no se conoce el ID actual.

import { Camera, LayoutOption } from './types';

export const DEFAULT_CAMERAS: Camera[] = [
  // México (prioridad máxima)
  { id: 'mx-cdmx', name: 'Ciudad de México', city: 'CDMX', country: 'México', youtubeId: 'yyWbHA_EWCc' },
  { id: 'mx-gdl', name: 'Guadalajara', city: 'Guadalajara', country: 'México', youtubeId: '' },
  { id: 'mx-mty', name: 'Monterrey', city: 'Monterrey', country: 'México', youtubeId: '' },
  { id: 'mx-pue', name: 'Puebla', city: 'Puebla', country: 'México', youtubeId: '' },
  { id: 'mx-tij', name: 'Tijuana', city: 'Tijuana', country: 'México', youtubeId: '' },
  { id: 'mx-leon', name: 'León', city: 'León', country: 'México', youtubeId: '' },
  { id: 'mx-mer', name: 'Mérida', city: 'Mérida', country: 'México', youtubeId: '' },

  // América Latina
  { id: 'co-bog', name: 'Bogotá', city: 'Bogotá', country: 'Colombia', youtubeId: '' },
  { id: 'ar-bue', name: 'Buenos Aires', city: 'Buenos Aires', country: 'Argentina', youtubeId: '' },
  { id: 'pe-lim', name: 'Lima', city: 'Lima', country: 'Perú', youtubeId: '' },
  { id: 'cl-scl', name: 'Santiago', city: 'Santiago', country: 'Chile', youtubeId: '' },
  { id: 'br-sao', name: 'São Paulo', city: 'São Paulo', country: 'Brasil', youtubeId: '' },

  // Mundo
  { id: 'us-nyc', name: 'Nueva York', city: 'Nueva York', country: 'EE.UU.', youtubeId: '' },
  { id: 'us-ts', name: 'Times Square', city: 'Nueva York', country: 'EE.UU.', youtubeId: '' },
  { id: 'uk-lon', name: 'Londres', city: 'Londres', country: 'UK', youtubeId: '' },
  { id: 'jp-tok', name: 'Tokio', city: 'Tokio', country: 'Japón', youtubeId: '' },
  { id: 'es-mad', name: 'Madrid', city: 'Madrid', country: 'España', youtubeId: '' },
];

export const LAYOUT_OPTIONS: LayoutOption[] = [
  { type: '1x1', label: '1×1', cells: 1, icon: '⬜' },
  { type: '2x1', label: '2×1', cells: 2, icon: '▬' },
  { type: '2x2', label: '2×2', cells: 4, icon: '⊞' },
  { type: '1+2', label: '1+2', cells: 3, icon: '◧' },
  { type: '1+4', label: '1+4', cells: 5, icon: '◫' },
  { type: '3x3', label: '3×3', cells: 9, icon: '▦' },
];

export function getCellCount(layout: string): number {
  return LAYOUT_OPTIONS.find(l => l.type === layout)?.cells ?? 4;
}
