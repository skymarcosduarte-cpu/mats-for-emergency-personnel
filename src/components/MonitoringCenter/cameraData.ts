// Catálogo de cámaras verificadas — v5
// Solo fuentes embebibles (YouTube) verificadas EN VIVO al momento de la actualización.
// IMPORTANTE: los IDs de YouTube live caducan cuando el canal reinicia su transmisión;
// re-verificar este catálogo periódicamente y reemplazar IDs caídos.
// Última actualización: junio 2026 — limpieza de 41 streams caídos.

import { Camera, LayoutOption } from './types';

const YT_PARAMS = '?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1';

export const DEFAULT_CAMERAS: Camera[] = [
  // ═══════════════════════════════════════
  // México
  // ═══════════════════════════════════════
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
    id: 'yt-chihuahua-puente',
    name: 'Chihuahua Puente Internacional',
    city: 'Ciudad Juárez',
    country: 'México',
    description: 'Puente Internacional Paso del Norte en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/0Pg3S6s76IE${YT_PARAMS}`,
    region: 'mexico',
  },
  // ═══════════════════════════════════════
  // Norteamérica (EE.UU.)
  // ═══════════════════════════════════════
  {
    id: 'yt-manhattan-broadway',
    name: 'Manhattan Broadway, NY',
    city: 'Nueva York',
    country: 'EE.UU.',
    description: 'Manhattan Broadway en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/4qyZLflp-sI${YT_PARAMS}`,
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
    id: 'yt-san-diego-ca',
    name: 'San Diego, CA',
    city: 'San Diego',
    country: 'EE.UU.',
    description: 'San Diego, California en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/edz0ux7JClE${YT_PARAMS}`,
    region: 'northamerica',
  },
  // ═══════════════════════════════════════
  // Canadá
  // ═══════════════════════════════════════
  {
    id: 'yt-ottawa-canada',
    name: 'Ottawa, Canadá',
    city: 'Ottawa',
    country: 'Canadá',
    description: 'Ottawa en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/lLYosWv_AwQ${YT_PARAMS}`,
    region: 'northamerica',
  },
  // ═══════════════════════════════════════
  // Europa
  // ═══════════════════════════════════════
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
  // Asia y Medio Oriente
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
  // ═══════════════════════════════════════
  // Noticias en Vivo
  // ═══════════════════════════════════════
  {
    id: 'yt-nplus-live',
    name: 'N+ Foro Noticias en vivo',
    city: 'CDMX',
    country: 'México',
    description: 'N+ Foro Noticias en vivo 24/7',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/p2AzyIEuFak${YT_PARAMS}`,
    region: 'noticias',
  },
  {
    id: 'yt-milenio-live',
    name: 'Milenio Noticias en vivo',
    city: 'CDMX',
    country: 'México',
    description: 'Milenio Noticias en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/tQ941SU5UR0${YT_PARAMS}`,
    region: 'noticias',
  },
  {
    id: 'yt-sky-news-live',
    name: 'SKY News',
    city: 'Londres',
    country: 'Reino Unido',
    description: 'SKY News en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/YDvsBbKfLPA${YT_PARAMS}`,
    region: 'noticias',
  },
  {
    id: 'yt-al-jazeera-live',
    name: 'Al Jazeera English',
    city: 'Doha',
    country: 'Qatar',
    description: 'Al Jazeera English en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/gCNeDWCI0vo${YT_PARAMS}`,
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
    id: 'yt-telemundo-live',
    name: 'Telemundo Noticias en vivo',
    city: 'Miami',
    country: 'EE.UU.',
    description: 'Telemundo Noticias en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/9CHbF8k-W7I${YT_PARAMS}`,
    region: 'noticias',
  },
  // ═══════════════════════════════════════
  // Latinoamérica
  // ═══════════════════════════════════════
  {
    id: 'telesur-live',
    name: 'TELESUR',
    city: 'Latinoamérica',
    country: 'Internacional',
    description: 'Señal en vivo de teleSUR 24/7',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/live_stream${YT_PARAMS.replace('?', '?channel=UCZSdNK_ZmMQcLTz-obKr-Dw&')}`,
    region: 'latam',
  },
  // ═══════════════════════════════════════
  // Norteamérica (aeropuertos)
  // ═══════════════════════════════════════
  {
    id: 'yt-lax-airport',
    name: 'LAX Airport LIVE',
    city: 'Los Ángeles',
    country: 'EE.UU.',
    description: 'Aeropuerto de Los Ángeles en vivo',
    sourceType: 'youtube',
    embedUrl: `https://www.youtube.com/embed/12KqO5IBLeY${YT_PARAMS}`,
    region: 'northamerica',
  },
  // ═══════════════════════════════════════
  // Global
  // ═══════════════════════════════════════
  {
    id: 'yt-earthquake-monitor',
    name: 'LIVE Earthquake Monitor',
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
  'yt-sky-news-live',
  'telesur-live',
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
  latam: '🌎 Latinoamérica',
  northamerica: '🇺🇸 Norteamérica',
  europe: '🇪🇺 Europa',
  asia_mideast: '🌏 Asia y Medio Oriente',
};
