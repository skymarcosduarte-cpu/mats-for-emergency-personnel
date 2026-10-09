// Streams fijos del Centro de Monitoreo.
import { Camera, LayoutOption } from './types';

const YT_PARAMS = '?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&enablejsapi=1';

export const DEFAULT_CAMERAS: Camera[] = [
  {
    id: 'yt-nplus-live',
    name: 'N+',
    city: 'CDMX',
    country: 'México',
    description: 'N+ 24/7',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/p2AzyIEuFak${YT_PARAMS}`,
    region: 'noticias',
  },
  {
    id: 'yt-cnn-es-live',
    name: 'CNN en Español',
    city: 'Atlanta',
    country: 'EE.UU.',
    description: 'CNN en Español en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/Qr61waJ6AZg${YT_PARAMS}`,
    region: 'noticias',
  },
  {
    id: 'yt-euronews-es',
    name: 'Euronews Español',
    city: 'Lyon',
    country: 'Francia',
    description: 'Euronews en español en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/O9mOtdZ-nSk${YT_PARAMS}`,
    region: 'noticias',
  },
  {
    id: 'yt-earthquake-monitor',
    name: 'Live Earthquake Monitoring / GlobalQuake',
    city: 'Global',
    country: 'Global',
    description: 'Monitor de sismos en tiempo real',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/rvtygG4n6ew${YT_PARAMS}`,
    region: 'northamerica',
  },
];

// IDs de las 4 cámaras por defecto al abrir por primera vez
export const DEFAULT_INITIAL_CAMERA_IDS = [
  'yt-nplus-live',
  'yt-cnn-es-live',
  'yt-euronews-es',
  'yt-earthquake-monitor',
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

export const REGION_LABELS: Record<string, string> = {
  noticias: '📺 Noticias en Vivo',
  mexico: '🇲🇽 México',
  northamerica: '🇺🇸 Norteamérica',
  europe: '🇪🇺 Europa',
  asia_mideast: '🌏 Asia y Medio Oriente',
};
