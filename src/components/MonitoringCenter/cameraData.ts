// Catálogo de cámaras verificadas — v3
// Fuentes: YouTube
// Última actualización: marzo 2026

import { Camera, LayoutOption } from './types';

const YT_PARAMS = '?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1';

export const DEFAULT_CAMERAS: Camera[] = [
  // ═══════════════════════════════════════
  // México
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
    id: 'yt-basilica-guadalupe',
    name: 'Basílica de Guadalupe, CDMX',
    city: 'CDMX',
    country: 'México',
    description: 'Basílica de Guadalupe en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/FgGBtXzjqkA${YT_PARAMS}`,
    region: 'mexico',
  },
  {
    id: 'yt-bellas-artes',
    name: 'Bellas Artes, CDMX',
    city: 'CDMX',
    country: 'México',
    description: 'Palacio de Bellas Artes en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/fiUMCo3d9nU${YT_PARAMS}`,
    region: 'mexico',
  },
  {
    id: 'yt-cancun-park-royal',
    name: 'Cancún, Hotel Park Royal Beach',
    city: 'Cancún',
    country: 'México',
    description: 'Cancún Hotel Park Royal Beach en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/2Yq0hv2tZM8${YT_PARAMS}`,
    region: 'mexico',
  },
  {
    id: 'yt-cdmx-torre-latino-sur',
    name: 'CDMX Vista Sur Torre Latino',
    city: 'CDMX',
    country: 'México',
    description: 'Vista sur desde la Torre Latinoamericana',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/OwW-Zr4OK3k${YT_PARAMS}`,
    region: 'mexico',
  },
  {
    id: 'yt-cdmx-torre-latino-poniente',
    name: 'Poniente CDMX Torre Latino',
    city: 'CDMX',
    country: 'México',
    description: 'Vista poniente desde la Torre Latinoamericana',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/CsWJN_OgxwE${YT_PARAMS}`,
    region: 'mexico',
  },
  {
    id: 'yt-pachuca',
    name: 'Pachuca, Hidalgo',
    city: 'Pachuca',
    country: 'México',
    description: 'Pachuca, Hidalgo en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/levojxrvxQI${YT_PARAMS}`,
    region: 'mexico',
  },
  {
    id: 'yt-popo-altzomoni',
    name: 'Popocatépetl, Altzomoni',
    city: 'Popocatépetl',
    country: 'México',
    description: 'Vista desde Altzomoni del volcán Popocatépetl',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/rayKu7F6Ub4${YT_PARAMS}`,
    region: 'mexico',
  },
  {
    id: 'yt-ixtapa-zihua',
    name: 'Ixtapa Zihuatanejo, Gro.',
    city: 'Ixtapa Zihuatanejo',
    country: 'México',
    description: 'Ixtapa Zihuatanejo en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/ZmGJecDmuiY${YT_PARAMS}`,
    region: 'mexico',
  },
  {
    id: 'yt-garibaldi-cdmx',
    name: 'Garibaldi, CDMX',
    city: 'CDMX',
    country: 'México',
    description: 'Plaza Garibaldi en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/nM4I71den9Q${YT_PARAMS}`,
    region: 'mexico',
  },
  {
    id: 'yt-chihuahua-puente',
    name: 'Chihuahua Puente Internacional',
    city: 'Ciudad Juárez',
    country: 'México',
    description: 'Puente Internacional Paso del Norte en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/0Pg3S6s76IE${YT_PARAMS}`,
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
  // ═══════════════════════════════════════
  // Norteamérica
  // ═══════════════════════════════════════
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
  // ═══════════════════════════════════════
  // Europa
  // ═══════════════════════════════════════
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
  // ═══════════════════════════════════════
  // Asia
  // ═══════════════════════════════════════
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
  // ═══════════════════════════════════════
  // Global
  // ═══════════════════════════════════════
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
  'yt-cdmx-ref',
  'yt-cdmx-zocalo2',
  'yt-tlamacas-popo',
  'yt-aicm-live',
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
  mexico: '🇲🇽 México',
  latam: '🌎 América Latina',
  northamerica: '🇺🇸 Norteamérica',
  europe: '🇪🇺 Europa',
  asia_mideast: '🌏 Asia y Medio Oriente',
};
