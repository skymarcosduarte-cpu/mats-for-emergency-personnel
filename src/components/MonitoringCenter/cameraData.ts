// Catálogo de cámaras verificadas — v2
// Fuentes: YouTube, SkylineWebcams, EarthTV, WebcamsDeMexico, URLs externas
// Última actualización: marzo 2026

import { Camera, LayoutOption } from './types';

const YT_PARAMS = '?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1';

export const DEFAULT_CAMERAS: Camera[] = [
  // ═══════════════════════════════════════
  // YouTube — Cámaras verificadas
  // ═══════════════════════════════════════
  {
    id: 'yt-cdmx-ref',
    name: 'Ciudad de México',
    city: 'CDMX',
    country: 'México',
    description: 'Ciudad de México en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/yyWbHA_EWCc${YT_PARAMS}`,
    region: 'mexico',
  },
  {
    id: 'yt-cdmx-zocalo2',
    name: 'Zócalo CDMX EN VIVO',
    city: 'CDMX',
    country: 'México',
    description: 'Zócalo de la Ciudad de México en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/iFk6nRCYOd0${YT_PARAMS}`,
    region: 'mexico',
  },
  {
    id: 'yt-tlamacas-popo',
    name: 'Tlamacas, Popocatépetl',
    city: 'Popocatépetl',
    country: 'México',
    description: 'Vista desde Tlamacas del volcán Popocatépetl',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/NI4v1OlIlZM${YT_PARAMS}`,
    region: 'mexico',
  },
  {
    id: 'yt-aicm-live',
    name: 'AICM En Vivo',
    city: 'CDMX',
    country: 'México',
    description: 'Aeropuerto Internacional de la Ciudad de México en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/mCyFwnCcZJk${YT_PARAMS}`,
    region: 'mexico',
  },
  {
    id: 'yt-marina-acapulco',
    name: 'Marina Acapulco, Guerrero',
    city: 'Acapulco',
    country: 'México',
    description: 'Marina de Acapulco, Guerrero en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/9f3npaKdyCA${YT_PARAMS}`,
    region: 'mexico',
  },
  {
    id: 'yt-popocatepetl-afartv',
    name: 'Popocatépetl 4K - AfarTV',
    city: 'Popocatépetl',
    country: 'México',
    description: 'Volcán en vivo 4K — canal @afartv',
    sourceType: 'youtube_channel',
    embedUrl: `https://www.youtube.com/embed/live_stream?channel=UCaG0IHN1RMOZ4-U3wDXAkwA${YT_PARAMS.replace('?', '&')}`,
    region: 'mexico',
  },
  {
    id: 'yt-times-square',
    name: 'Times Square, NY',
    city: 'Nueva York',
    country: 'EE.UU.',
    description: 'Times Square en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/rnXIjl_Rzy4${YT_PARAMS}`,
    region: 'northamerica',
  },
  {
    id: 'yt-washington-dc',
    name: 'Washington D.C.',
    city: 'Washington D.C.',
    country: 'EE.UU.',
    description: 'Washington D.C. en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/1wV9lLe14aU${YT_PARAMS}`,
    region: 'northamerica',
  },
  {
    id: 'yt-white-house',
    name: 'White House, Washington D.C.',
    city: 'Washington D.C.',
    country: 'EE.UU.',
    description: 'Casa Blanca en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/Fu8vYoIkaeM${YT_PARAMS}`,
    region: 'northamerica',
  },
  {
    id: 'yt-bryant-park',
    name: 'Bryant Park, New York',
    city: 'Nueva York',
    country: 'EE.UU.',
    description: 'Bryant Park en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/XDgu2VKXM3s${YT_PARAMS}`,
    region: 'northamerica',
  },
  {
    id: 'yt-venice-beach',
    name: 'Venice Beach, CA',
    city: 'Los Ángeles',
    country: 'EE.UU.',
    description: 'Venice Beach en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/EO_1LWqsCNE${YT_PARAMS}`,
    region: 'northamerica',
  },
  {
    id: 'yt-madrid',
    name: 'Madrid, España',
    city: 'Madrid',
    country: 'España',
    description: 'Madrid en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/dVAtjVi7bUQ${YT_PARAMS}`,
    region: 'europe',
  },
  {
    id: 'yt-paris',
    name: 'París, Francia',
    city: 'París',
    country: 'Francia',
    description: 'París en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/OzYp4NRZlwQ${YT_PARAMS}`,
    region: 'europe',
  },
  {
    id: 'yt-berlin',
    name: 'Berlín, Alemania',
    city: 'Berlín',
    country: 'Alemania',
    description: 'Berlín en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/IRqboacDNFg${YT_PARAMS}`,
    region: 'europe',
  },
  {
    id: 'yt-tokyo',
    name: 'Tokio, Japón',
    city: 'Tokio',
    country: 'Japón',
    description: 'Tokio en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/_k-5U7IeK8g${YT_PARAMS}`,
    region: 'asia_mideast',
  },
  {
    id: 'yt-tokyo-odaiba',
    name: 'Tokio, Odaiba',
    city: 'Tokio',
    country: 'Japón',
    description: 'Odaiba, Tokio en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/ytXE2pk07dA${YT_PARAMS}`,
    region: 'asia_mideast',
  },
  {
    id: 'yt-world-random',
    name: 'Cámaras del Mundo (aleatorio)',
    city: 'Varias',
    country: 'Mundial',
    description: 'Diferentes cámaras del mundo aleatoriamente',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/EFum1rGUdkk${YT_PARAMS}`,
    region: 'europe',
  },
];

// IDs de las 4 cámaras por defecto al abrir por primera vez
export const DEFAULT_INITIAL_CAMERA_IDS = [
  'yt-cdmx-ref',             // Celda 1: Ciudad de México (yyWbHA_EWCc)
  'yt-cdmx-zocalo2',         // Celda 2: Zócalo CDMX EN VIVO (iFk6nRCYOd0)
  'yt-tlamacas-popo',         // Celda 3: Tlamacas, Popocatépetl (NI4v1OlIlZM)
  'yt-aicm-live',             // Celda 4: AICM En Vivo (mCyFwnCcZJk)
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

// Agrupar cámaras por región para la biblioteca
export const REGION_LABELS: Record<string, string> = {
  mexico: '🇲🇽 México',
  latam: '🌎 América Latina',
  northamerica: '🇺🇸 Norteamérica',
  europe: '🇪🇺 Europa',
  asia_mideast: '🌏 Asia y Medio Oriente',
};
