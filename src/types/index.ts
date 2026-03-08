// COMUNIDAD EX SOS - Type Definitions

export type UserRole = 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR';

export type PanicType = 
  | 'AMBULANCIA_PROPIA' 
  | 'AMBULANCIA_TERCERO' 
  | 'PATRULLA' 
  | 'MECANICO' 
  | 'PROTECCION_CIVIL'
  | 'BOMBEROS'
  | 'GRUA';

export type StatusType = 'OK' | 'NEED_HELP' | 'UNKNOWN';

export type TransitType = 'ROAD' | 'FLIGHT' | 'HELICOPTER';

export type TransitStatus = 'ACTIVE' | 'ARRIVED' | 'CANCELLED' | 'OVERDUE';

export type ReportCategory = 
  | 'BLOCKADE' 
  | 'ACCIDENT' 
  | 'PROTEST' 
  | 'HAZARD' 
  | 'ROAD_REPAIR'
  | 'HEAVY_TRAFFIC'
  | 'STOPPED_TRAFFIC'
  | 'TOLL_CLOSED'
  | 'TOLL_OPEN'
  | 'FOG'
  | 'HAIL_SNOW'
  | 'OTHER';

export type ReportSeverity = 1 | 2 | 3 | 4;

export type QuakeIntensity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type QuakeDamage = 'OK' | 'DAMAGE' | 'UNSURE';

export type HelpKind = 'SISMO_AYUDA_14' | 'GENERAL';

export type MeshMessageType = 
  | 'PANIC' 
  | 'STATUS_OK' 
  | 'STATUS_NEED_HELP' 
  | 'DRILL_TEST' 
  | 'DRILL_ACK' 
  | 'HELP_14';

export interface Profile {
  id: string;
  full_name: string;
  nickname: string;
  specialty: string | null;
  phone: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface UserLocation {
  user_id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  updated_at: string;
  is_online: boolean;
}

export interface PanicEvent {
  id: string;
  user_id: string;
  panic_type: PanicType;
  lat: number;
  lng: number;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface StatusMessage {
  id: string;
  user_id: string;
  status: StatusType;
  message: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface TransitTrip {
  id: string;
  user_id: string;
  transit_type: TransitType;
  // Road fields
  plates: string | null;
  companions: string | null;
  origin: string;
  destination: string;
  vehicle_type: string | null;
  // Flight fields
  airline: string | null;
  flight_number: string | null;
  departure_airport: string | null;
  arrival_airport: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  // Common
  eta: string;
  status: TransitStatus;
  created_at: string;
  arrived_at: string | null;
}

export interface RoadReport {
  id: string;
  user_id: string;
  trip_id: string | null;
  category: ReportCategory;
  severity: ReportSeverity;
  title: string;
  description: string | null;
  lat: number;
  lng: number;
  is_active: boolean;
  created_at: string;
  resolved_at: string | null;
  verification_count: number;
  verified_by: string[];
}

export interface QuakeCheckin {
  id: string;
  user_id: string;
  usgs_event_id: string;
  intensity: QuakeIntensity;
  damage_report: QuakeDamage;
  lat: number;
  lng: number;
  created_at: string;
}

export interface HelpRequest {
  id: string;
  user_id: string;
  kind: HelpKind;
  quake_event_id: string | null;
  lat: number;
  lng: number;
  message: string | null;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface ReportMedia {
  id: string;
  report_type: 'help_request' | 'road_report';
  report_id: string;
  media_type: 'image' | 'audio';
  storage_path: string;
  mime_type: string;
  duration_ms: number | null;
  created_at: string;
}

export interface Invite {
  id: string;
  code: string;
  created_by: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  created_at: string;
}

export interface AppState {
  id: string;
  disaster_mode: boolean;
  disaster_started_at: string | null;
  updated_at: string;
}

export interface AppRelease {
  id: string;
  version: string;
  min_supported: string;
  release_notes: string | null;
  released_at: string;
}

// USGS Earthquake data
export interface USGSEarthquake {
  id: string;
  source?: 'USGS' | 'SSN' | 'EMSC';
  properties: {
    mag: number;
    place: string;
    time: number;
    updated: number;
    url: string;
    title: string;
    alert: string | null;
    tsunami: number;
    depth?: number; // SSN includes depth here
  };
  geometry: {
    coordinates: [number, number, number]; // lng, lat, depth
  };
}

// Map marker types
export interface MapMarker {
  id: string;
  type: 'user' | 'help14' | 'report' | 'panic' | 'overdue';
  lat: number;
  lng: number;
  data?: unknown;
}

// Media upload
export interface MediaRef {
  storage_path: string;
  mime_type: string;
  duration_ms?: number;
}

// Offline queue item
export interface OfflineQueueItem {
  id: string;
  action: string;
  payload: unknown;
  created_at: string;
  retries: number;
}

// Mesh message envelope
export interface MeshEnvelope {
  type: MeshMessageType;
  sender_id: string;
  timestamp: number;
  payload: unknown;
  signature?: string;
}

// Version info
export interface VersionInfo {
  current: string;
  latest: string;
  minSupported: string;
  mustUpdate: boolean;
  releaseNotes: string | null;
}

// Geolocation
export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}
