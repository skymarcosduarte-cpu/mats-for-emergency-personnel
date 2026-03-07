// Tipos para el Centro de Monitoreo

export interface Camera {
  id: string;
  name: string;
  city: string;
  country: string;
  youtubeId: string; // vacío si no disponible
  isCustom?: boolean;
}

export interface CellConfig {
  slotIndex: number;
  cameraId: string | null; // null = celda vacía
  isMuted: boolean;
}

export type LayoutType = '1x1' | '2x1' | '2x2' | '1+2' | '1+4' | '3x3';

export interface LayoutOption {
  type: LayoutType;
  label: string;
  cells: number;
  icon: string; // emoji representativo
}

export interface MonitoringState {
  layout: LayoutType;
  cells: CellConfig[];
  customCameras: Camera[];
}
