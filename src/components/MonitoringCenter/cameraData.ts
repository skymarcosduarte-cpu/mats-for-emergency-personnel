// Catálogo de cámaras preconfiguradas
// NOTA: Los IDs de livestreams de YouTube cambian frecuentemente.
// Dejar youtubeId vacío si no se conoce el ID actual.
// Última actualización de IDs: marzo 2026

import { Camera, LayoutOption } from './types';

export const DEFAULT_CAMERAS: Camera[] = [
  // México (prioridad máxima)
  { id: 'mx-cdmx', name: 'CDMX - Zócalo', city: 'CDMX', country: 'México', youtubeId: 'yyWbHA_EWCc' },
  { id: 'mx-cdmx2', name: 'CDMX - Zócalo Panorámica', city: 'CDMX', country: 'México', youtubeId: 'baurr90Q9b0' },
  { id: 'mx-cdmx3', name: 'CDMX - Zócalo Gran Hotel', city: 'CDMX', country: 'México', youtubeId: 'ee7Joc-_RK0' },
  { id: 'mx-popocatepetl', name: 'Volcán Popocatépetl', city: 'Puebla', country: 'México', youtubeId: 't83sHSz0UU8' },
  { id: 'mx-popocatepetl2', name: 'Popocatépetl - San Nicolás', city: 'Puebla', country: 'México', youtubeId: 'NTvCbzl8oIg' },
  { id: 'mx-popocatepetl3', name: 'Popocatépetl - Tlamacas', city: 'Edo. de México', country: 'México', youtubeId: 'szKkWkhVdsE' },
  { id: 'mx-pvr', name: 'Puerto Vallarta', city: 'Puerto Vallarta', country: 'México', youtubeId: 'W0XiV7Ikn_k' },
  { id: 'mx-gdl', name: 'Guadalajara', city: 'Guadalajara', country: 'México', youtubeId: '' },
  { id: 'mx-mty', name: 'Monterrey', city: 'Monterrey', country: 'México', youtubeId: '' },
  { id: 'mx-tij', name: 'Tijuana', city: 'Tijuana', country: 'México', youtubeId: '' },
  { id: 'mx-leon', name: 'León', city: 'León', country: 'México', youtubeId: '' },
  { id: 'mx-mer', name: 'Mérida', city: 'Mérida', country: 'México', youtubeId: '' },

  // América Latina
  { id: 'ar-bue', name: 'Buenos Aires', city: 'Buenos Aires', country: 'Argentina', youtubeId: 'reShHDyLGbc' },
  { id: 'cl-scl', name: 'Santiago - Costanera Center', city: 'Santiago', country: 'Chile', youtubeId: 'Fc8OHbjpsyw' },
  { id: 'cl-scl2', name: 'Santiago - Plaza Baquedano', city: 'Santiago', country: 'Chile', youtubeId: 'jkv0VUSmI4o' },
  { id: 'br-rio', name: 'Río de Janeiro - Copacabana', city: 'Río de Janeiro', country: 'Brasil', youtubeId: '2PJfQY9LUoU' },
  { id: 'co-bog', name: 'Bogotá', city: 'Bogotá', country: 'Colombia', youtubeId: '' },
  { id: 'pe-lim', name: 'Lima', city: 'Lima', country: 'Perú', youtubeId: '' },
  { id: 'br-sao', name: 'São Paulo', city: 'São Paulo', country: 'Brasil', youtubeId: '' },

  // Mundo
  { id: 'us-ts', name: 'Times Square - EarthCam 4K', city: 'Nueva York', country: 'EE.UU.', youtubeId: 'kQYk-j2e1JE' },
  { id: 'us-ts2', name: 'Times Square 24/7', city: 'Nueva York', country: 'EE.UU.', youtubeId: 'dzxIlgCST-4' },
  { id: 'us-mia', name: 'Miami Port - 4K', city: 'Miami', country: 'EE.UU.', youtubeId: 'mqJLCYASw2E' },
  { id: 'uk-lon', name: 'Londres - Piccadilly Circus', city: 'Londres', country: 'UK', youtubeId: 'gGq4GZsLMCc' },
  { id: 'uk-lon2', name: 'Londres - Abbey Road', city: 'Londres', country: 'UK', youtubeId: 'j-d93A6v73Q' },
  { id: 'jp-tok', name: 'Tokio - Shibuya Crossing', city: 'Tokio', country: 'Japón', youtubeId: 'cBoy-gKL5So' },
  { id: 'jp-tok2', name: 'Tokio Bay - Rainbow Bridge 4K', city: 'Tokio', country: 'Japón', youtubeId: '_k-5U7IeK8g' },
  { id: 'jp-tok3', name: 'Tokio - Odaiba', city: 'Tokio', country: 'Japón', youtubeId: 'JDZ4ApWdq7w' },
  { id: 'au-syd', name: 'Sydney - Harbour Bridge', city: 'Sydney', country: 'Australia', youtubeId: 'SEg0VujJiFU' },
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
