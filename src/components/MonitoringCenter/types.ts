// Tipos para el Centro de Monitoreo — v2

export type SourceType = 'youtube' | 'youtube_channel' | 'skylinewebcams' | 'earthtv' | 'webcamsdemexico' | 'external_url';

export type Region = 'mexico' | 'latam' | 'northamerica' | 'europe' | 'asia_mideast';

export interface Camera {
  id: string;
  name: string;
  city: string;
  country: string;
  description: string;
  sourceType: SourceType;
  embedUrl: string;        // URL completa del iframe (o vacía si external_url)
  externalUrl?: string;    // URL para abrir en navegador externo
  region: Region;
  isCustom?: boolean;
}

export interface CellConfig {
  slotIndex: number;
  cameraId: string | null;
  isMuted: boolean;
}

export type LayoutType = '1x1' | '2x1' | '2x2' | '1+2' | '1+4' | '3x3';

export interface LayoutOption {
  type: LayoutType;
  label: string;
  cells: number;
  icon: string;
}

export interface MonitoringState {
  layout: LayoutType;
  cells: CellConfig[];
  customCameras: Camera[];
  allCells?: CellConfig[];
}
