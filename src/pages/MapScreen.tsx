// Map Screen with vanilla Leaflet for COMUNIDAD EX SOS
// Using vanilla Leaflet to avoid react-leaflet context issues

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import DOMPurify from 'dompurify';
import { Locate, ChevronDown, ChevronUp, Info, Building2, Fuel, Pill, Shield, Flame } from 'lucide-react';
import { ShareLocationButton } from '@/components/ShareLocationButton';
import { ImOkButton } from '@/components/ImOkButton';
import { useLocation } from '@/hooks/useLocation';
import { useUserLocations, useHelpRequests, useRoadReports, useMedicalProviders, usePanicEvents, useActiveResponders } from '@/hooks/useRealtime';
import { useEmergencyResponse } from '@/hooks/useEmergencyResponse';
import { usePanicResponse } from '@/hooks/usePanicResponse';
import { usePOIs, type POI } from '@/hooks/usePOIs';
import { AlertsPanel } from '@/components/AlertsPanel';
import { ActiveUsersPanel } from '@/components/ActiveUsersPanel';
import { InternalMessaging } from '@/components/InternalMessaging';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import 'leaflet/dist/leaflet.css';

// Sanitize user content for safe HTML rendering
const sanitize = (text: string | null | undefined): string => {
  if (!text) return '';
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom icons
// Star icon for FAMILIAR users (5-pointed star)
const createFamiliarIcon = (isCurrentUser: boolean = false, hasFirstAidKit: boolean = false) => L.divIcon({
  className: `mats-marker familiar-marker ${isCurrentUser ? 'current-user-marker' : ''}`,
  html: `
    <div style="position: relative; width: 32px; height: ${isCurrentUser ? '40px' : '32px'};">
      ${isCurrentUser ? `
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: 32px;
          height: 32px;
          background: rgba(251, 191, 36, 0.4);
          border-radius: 50%;
          animation: pulse-current-user 1.5s ease-out infinite;
        "></div>
      ` : ''}
      <div style="
        position: absolute;
        top: 0;
        left: 0;
        width: 32px;
        height: 32px;
        background: #2e8b57;
        border: 2px solid ${isCurrentUser ? '#fbbf24' : '#0a0a0a'};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: ${isCurrentUser ? '0 0 12px #fbbf24, 0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.3)'};
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L14 8H20L15 12L17 18L12 14L7 18L9 12L4 8H10L12 2Z" fill="#0a0a0a"/>
        </svg>
      </div>
      ${hasFirstAidKit ? `
        <div style="
          position: absolute;
          top: -4px;
          right: -4px;
          width: 16px;
          height: 16px;
          background: #ef4444;
          border: 2px solid #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        ">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
          </svg>
        </div>
      ` : ''}
      ${isCurrentUser ? `
        <div style="
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          background: #fbbf24;
          color: #000;
          font-size: 8px;
          font-weight: 800;
          padding: 1px 4px;
          border-radius: 3px;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        ">TÚ</div>
      ` : ''}
    </div>
  `,
  iconSize: [32, isCurrentUser ? 40 : 32],
  iconAnchor: [16, isCurrentUser ? 20 : 16],
  popupAnchor: [0, isCurrentUser ? -20 : -16],
});

// Simple green cross icon for SOS ACTIVO / EX-SOS users
const createRescatistaIcon = (isCurrentUser: boolean = false, hasFirstAidKit: boolean = false) => L.divIcon({
  className: `mats-marker rescatista-marker ${isCurrentUser ? 'current-user-marker' : ''}`,
  html: `
    <div style="position: relative; width: 32px; height: ${isCurrentUser ? '40px' : '32px'};">
      ${isCurrentUser ? `
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: 32px;
          height: 32px;
          background: rgba(251, 191, 36, 0.4);
          border-radius: 50%;
          animation: pulse-current-user 1.5s ease-out infinite;
        "></div>
      ` : ''}
      <div style="
        position: absolute;
        top: 0;
        left: 0;
        width: 32px;
        height: 32px;
        background: #ffffff;
        border: 2px solid ${isCurrentUser ? '#fbbf24' : '#16a34a'};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: ${isCurrentUser ? '0 0 12px #fbbf24, 0 2px 8px rgba(22,163,74,0.4)' : '0 2px 8px rgba(22,163,74,0.4)'};
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 4v16M4 12h16" stroke="#16a34a" stroke-width="4" stroke-linecap="round"/>
        </svg>
      </div>
      ${hasFirstAidKit ? `
        <div style="
          position: absolute;
          top: -4px;
          right: -4px;
          width: 16px;
          height: 16px;
          background: #ef4444;
          border: 2px solid #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        ">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
          </svg>
        </div>
      ` : ''}
      ${isCurrentUser ? `
        <div style="
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          background: #fbbf24;
          color: #000;
          font-size: 8px;
          font-weight: 800;
          padding: 1px 4px;
          border-radius: 3px;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        ">TÚ</div>
      ` : ''}
    </div>
  `,
  iconSize: [32, isCurrentUser ? 40 : 32],
  iconAnchor: [16, isCurrentUser ? 20 : 16],
  popupAnchor: [0, isCurrentUser ? -20 : -16],
});

// Transit icon for users with active road trips (orange/amber color with car icon)
const createTransitIcon = (isCurrentUser: boolean = false) => L.divIcon({
  className: `mats-marker transit-marker ${isCurrentUser ? 'current-user-marker' : ''}`,
  html: `
    <div style="position: relative; width: 32px; height: ${isCurrentUser ? '40px' : '32px'};">
      ${isCurrentUser ? `
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: 32px;
          height: 32px;
          background: rgba(251, 191, 36, 0.4);
          border-radius: 50%;
          animation: pulse-current-user 1.5s ease-out infinite;
        "></div>
      ` : ''}
      <div style="
        position: absolute;
        top: 0;
        left: 0;
        width: 32px;
        height: 32px;
        background: #f59e0b;
        border: 2px solid ${isCurrentUser ? '#fbbf24' : '#0a0a0a'};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: ${isCurrentUser ? '0 0 12px #fbbf24, 0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.3)'};
        animation: pulse-transit 2s ease-in-out infinite;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2"/>
          <circle cx="7" cy="17" r="2"/>
          <circle cx="17" cy="17" r="2"/>
        </svg>
      </div>
      ${isCurrentUser ? `
        <div style="
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          background: #fbbf24;
          color: #000;
          font-size: 8px;
          font-weight: 800;
          padding: 1px 4px;
          border-radius: 3px;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        ">TÚ</div>
      ` : ''}
    </div>
  `,
  iconSize: [32, isCurrentUser ? 40 : 32],
  iconAnchor: [16, isCurrentUser ? 20 : 16],
  popupAnchor: [0, isCurrentUser ? -20 : -16],
});

// Ambulance icon for users with ambulance - with emergency pulsing animation
const createAmbulanceIcon = (hasEmergencyNearby: boolean = false) => L.divIcon({
  className: 'ambulance-marker',
  html: `
    <div style="
      width: ${hasEmergencyNearby ? '44px' : '36px'};
      height: ${hasEmergencyNearby ? '44px' : '36px'};
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        width: ${hasEmergencyNearby ? '44px' : '36px'};
        height: ${hasEmergencyNearby ? '44px' : '36px'};
        background: rgba(239, 68, 68, ${hasEmergencyNearby ? '0.5' : '0.3'});
        border-radius: 50%;
        animation: ${hasEmergencyNearby ? 'pulseEmergency 0.8s infinite' : 'pulseMedical 2s infinite'};
      "></div>
      ${hasEmergencyNearby ? `
      <div style="
        position: absolute;
        width: 56px;
        height: 56px;
        background: rgba(239, 68, 68, 0.2);
        border-radius: 50%;
        animation: pulseEmergencyOuter 1.2s infinite;
      "></div>
      ` : ''}
      <div style="
        width: ${hasEmergencyNearby ? '32px' : '28px'};
        height: ${hasEmergencyNearby ? '32px' : '28px'};
        background: #ef4444;
        border: ${hasEmergencyNearby ? '3px' : '2px'} solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
        box-shadow: 0 2px 8px rgba(239, 68, 68, ${hasEmergencyNearby ? '0.7' : '0.4'});
        font-size: ${hasEmergencyNearby ? '16px' : '14px'};
      ">🚑</div>
    </div>
  `,
  iconSize: [hasEmergencyNearby ? 44 : 36, hasEmergencyNearby ? 44 : 36],
  iconAnchor: [hasEmergencyNearby ? 22 : 18, hasEmergencyNearby ? 22 : 18],
  popupAnchor: [0, hasEmergencyNearby ? -22 : -18],
});

// First aid kit / Paramédico icon - GREEN for medical assistance
const createFirstAidKitIcon = () => L.divIcon({
  className: 'firstaid-marker',
  html: `
    <div style="
      width: 32px;
      height: 32px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        width: 32px;
        height: 32px;
        background: rgba(34, 197, 94, 0.3);
        border-radius: 50%;
        animation: pulseMedical 2s infinite;
      "></div>
      <div style="
        width: 24px;
        height: 24px;
        background: #22c55e;
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
        box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Default icon for users (uses FAMILIAR style - green with star)
const createMatsIcon = (isCurrentUser: boolean = false) => createFamiliarIcon(isCurrentUser);

const createHelp14Icon = () => L.divIcon({
  className: 'help14-marker',
  html: `
    <div style="
      width: 40px;
      height: 40px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        width: 40px;
        height: 40px;
        background: rgba(239, 68, 68, 0.3);
        border-radius: 50%;
        animation: pulse14 1s infinite;
      "></div>
      <div style="
        width: 28px;
        height: 28px;
        background: #ef4444;
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
        z-index: 1;
      ">14</div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

const createCurrentLocationIcon = () => L.divIcon({
  className: 'current-location-marker',
  html: `
    <div style="
      width: 18px;
      height: 18px;
      background: #3b82f6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 10px #3b82f6;
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const createReportIcon = (severity: number, category?: string) => {
  const colors: Record<number, string> = {
    1: '#22c55e',
    2: '#eab308',
    3: '#f97316',
    4: '#ef4444',
  };
  
  // Category emojis
  const categoryEmojis: Record<string, string> = {
    'BLOCKADE': '🚧',
    'ACCIDENT': '🚨',
    'PROTEST': '✊',
    'HAZARD': '⚠️',
    'OTHER': '📍',
  };
  const emoji = category ? (categoryEmojis[category] || '📍') : '⚠️';
  
  return L.divIcon({
    className: 'report-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: ${colors[severity] || colors[2]};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      ">${emoji}</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

// Panic event icons with different colors based on type
const createPanicIcon = (panicType: string) => {
  const typeConfig: Record<string, { color: string; emoji: string }> = {
    'AMBULANCIA_PROPIA': { color: '#ef4444', emoji: '🚑' },
    'AMBULANCIA_TERCERO': { color: '#ef4444', emoji: '🚑' },
    'PATRULLA': { color: '#3b82f6', emoji: '🚔' },
    'MECANICO': { color: '#eab308', emoji: '🔧' },
    'PROTECCION_CIVIL': { color: '#f97316', emoji: '🆘' },
  };
  const config = typeConfig[panicType] || { color: '#ef4444', emoji: '🆘' };
  
  return L.divIcon({
    className: 'panic-marker',
    html: `
      <div style="
        width: 44px;
        height: 44px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 44px;
          height: 44px;
          background: ${config.color}40;
          border-radius: 50%;
          animation: pulsePanic 1s infinite;
        "></div>
        <div style="
          width: 32px;
          height: 32px;
          background: ${config.color};
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
          font-size: 16px;
          box-shadow: 0 2px 8px ${config.color}80;
        ">${config.emoji}</div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
};

// Responder icon - shows RESCATISTA responding to emergency
const createResponderIcon = () => L.divIcon({
  className: 'responder-marker',
  html: `
    <div style="
      width: 44px;
      height: 44px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        position: absolute;
        width: 44px;
        height: 44px;
        background: rgba(59, 130, 246, 0.3);
        border-radius: 50%;
        animation: pulseResponder 1.5s infinite;
      "></div>
      <div style="
        width: 32px;
        height: 32px;
        background: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -22],
});

// Medical provider icon with cross symbol
const createMedicalIcon = (hasKit: boolean, canProvide: boolean) => {
  const iconContent = canProvide 
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
       </svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2">
        <path d="M12 2v20M2 12h20"/>
       </svg>`;

  return L.divIcon({
    className: 'medical-marker',
    html: `
      <div style="
        width: 36px;
        height: 36px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 36px;
          height: 36px;
          background: rgba(34, 197, 94, 0.3);
          border-radius: 50%;
          animation: pulseMedical 2s infinite;
        "></div>
        <div style="
          width: 28px;
          height: 28px;
          background: #22c55e;
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
          box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
        ">${iconContent}</div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

// POI Icons
const createPOIIcon = (type: POI['type'], isPrivate?: boolean) => {
  const configs: Record<POI['type'], { color: string; emoji: string }> = {
    hospital: { color: isPrivate ? '#8b5cf6' : '#ef4444', emoji: '🏥' },
    gas_station: { color: '#f97316', emoji: '⛽' },
    pharmacy: { color: '#22c55e', emoji: '💊' },
    police: { color: '#3b82f6', emoji: '👮' },
    fire_station: { color: '#dc2626', emoji: '🚒' },
  };
  const config = configs[type];

  return L.divIcon({
    className: `poi-marker poi-${type}`,
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background: ${config.color};
        border: 2px solid white;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">${config.emoji}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

// POI visibility state type
export interface POIVisibility {
  hospital: boolean;
  gas_station: boolean;
  pharmacy: boolean;
  police: boolean;
  fire_station: boolean;
  first_aid_kit: boolean;
  ambulance: boolean;
}

// Collapsible Map Legend Component with POI toggles
interface MapLegendProps {
  poiVisibility: POIVisibility;
  onTogglePOI: (type: keyof POIVisibility) => void;
  poisLoading?: boolean;
}

const MapLegend: React.FC<MapLegendProps> = ({ poiVisibility, onTogglePOI, poisLoading }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const poiItems: { type: keyof POIVisibility; label: string; color: string; emoji: string }[] = [
    { type: 'first_aid_kit', label: 'Botiquines', color: '#22c55e', emoji: '🩹' },
    { type: 'ambulance', label: 'Ambulancias', color: '#ef4444', emoji: '🚑' },
    { type: 'hospital', label: 'Hospitales', color: '#ef4444', emoji: '🏥' },
    { type: 'gas_station', label: 'Gasolineras', color: '#f97316', emoji: '⛽' },
    { type: 'pharmacy', label: 'Farmacias', color: '#22c55e', emoji: '💊' },
    { type: 'police', label: 'Policía', color: '#3b82f6', emoji: '👮' },
    { type: 'fire_station', label: 'Bomberos', color: '#dc2626', emoji: '🚒' },
  ];

  return (
    <div className="absolute bottom-20 right-4 z-[500] bg-card/95 backdrop-blur-sm rounded-lg shadow-lg border border-border overflow-hidden max-h-[60vh] overflow-y-auto">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2.5 hover:bg-accent/50 transition-colors"
        aria-label={isExpanded ? 'Ocultar leyenda' : 'Mostrar leyenda'}
      >
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Info className="w-3.5 h-3.5" />
          <span>Leyenda</span>
          {poisLoading && <span className="text-[10px] text-primary animate-pulse">Cargando...</span>}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 text-xs animate-in slide-in-from-bottom-2 duration-200">
          {/* Core markers */}
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Comunidad</div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#2e8b57' }} />
            <span className="text-foreground">Miembro</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#22c55e' }} />
            <span className="text-foreground">Paramédico/Botiquín</span>
          </div>
          
          {/* Badge explanations */}
          <div className="flex items-start gap-2 bg-accent/30 p-2 rounded-md border border-border/50">
            <div className="relative flex-shrink-0 mt-0.5">
              <div className="w-5 h-5 rounded-full" style={{ background: '#22c55e' }} />
              <span style={{ fontSize: '10px', position: 'absolute', top: '-2px', right: '-2px' }}>🩹</span>
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-medium text-foreground leading-tight">
                Verde = Paramédico/Botiquín
              </div>
              <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                Puede brindar asistencia médica
              </div>
            </div>
          </div>
          
          <div className="flex items-start gap-2 bg-accent/30 p-2 rounded-md border border-border/50">
            <div className="relative flex-shrink-0 mt-0.5">
              <div className="w-5 h-5 rounded-full" style={{ background: '#ef4444' }} />
              <span style={{ fontSize: '10px', position: 'absolute', top: '-2px', right: '-2px' }}>🚑</span>
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-medium text-foreground leading-tight">
                Rojo = Ambulancia disponible
              </div>
              <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                Cuenta con vehículo de emergencia
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
            <span className="text-foreground">Alerta SOS</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#ef4444', opacity: 0.7 }} />
            <span className="text-foreground">Ayuda 14</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#eab308' }} />
            <span className="text-foreground">Reporte</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full animate-pulse" style={{ background: '#3b82f6' }} />
            <span className="text-foreground">Rescatista</span>
          </div>

          {/* Recursos comunitarios Toggles */}
          <div className="border-t border-border my-2 pt-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Recursos comunitarios</div>
            {poiItems.filter(item => item.type === 'first_aid_kit' || item.type === 'ambulance').map(item => (
              <button
                key={item.type}
                onClick={() => onTogglePOI(item.type)}
                className={cn(
                  "flex items-center gap-2 w-full py-1 px-1 rounded transition-colors",
                  poiVisibility[item.type] ? "bg-accent/50" : "opacity-60 hover:opacity-100"
                )}
              >
                <div 
                  className="w-4 h-4 rounded flex items-center justify-center text-[10px]" 
                  style={{ background: item.color }}
                >
                  {item.emoji}
                </div>
                <span className="text-foreground flex-1 text-left">{item.label}</span>
                {poiVisibility[item.type] && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          {/* POI Toggles */}
          <div className="border-t border-border my-2 pt-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Servicios (click para mostrar)</div>
            {poiItems.filter(item => item.type !== 'first_aid_kit' && item.type !== 'ambulance').map(item => (
              <button
                key={item.type}
                onClick={() => onTogglePOI(item.type)}
                className={cn(
                  "flex items-center gap-2 w-full py-1 px-1 rounded transition-colors",
                  poiVisibility[item.type] ? "bg-accent/50" : "opacity-60 hover:opacity-100"
                )}
              >
                <div 
                  className="w-4 h-4 rounded flex items-center justify-center text-[10px]" 
                  style={{ background: item.color }}
                >
                  {item.emoji}
                </div>
                <span className="text-foreground flex-1 text-left">{item.label}</span>
                {poiVisibility[item.type] && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

import type { ActiveResponderInfo } from '@/hooks/useMyAlertResponders';

interface MapScreenProps {
  className?: string;
  respondersToMyAlerts?: ActiveResponderInfo[];
}

export const MapScreen: React.FC<MapScreenProps> = ({ className, respondersToMyAlerts = [] }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const currentLocationMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const [mapReady, setMapReady] = useState(false);
  
  // Messaging state
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);
  const [messagingUserName, setMessagingUserName] = useState<string | null>(null);

  // POI visibility state
  const [poiVisibility, setPoiVisibility] = useState<POIVisibility>({
    hospital: false,
    gas_station: false,
    pharmacy: false,
    police: false,
    fire_station: false,
    first_aid_kit: false,
    ambulance: false,
  });

  const { position, error: locationError } = useLocation();
  const { role, user } = useAuth();
  const { locations } = useUserLocations();
  const { requests: helpRequests, resolveRequest } = useHelpRequests(position);
  const { reports } = useRoadReports();
  const { providers: medicalProviders } = useMedicalProviders();
  const { events: panicEvents, resolveEvent } = usePanicEvents();
  const { responders: activeResponders } = useActiveResponders();
  const { startResponding, stopResponding, markAsArrived, markAsResolved } = useEmergencyResponse();
  const { 
    startResponding: startPanicResponding, 
    stopResponding: stopPanicResponding, 
    markAsArrived: markPanicAsArrived, 
    markAsResolved: markPanicAsResolved,
    activeResponse: activePanicResponse
  } = usePanicResponse();
  const { pois, loading: poisLoading, fetchPOIs } = usePOIs();
  
  const isRescatista = role === 'SOS_ACTIVO' || role === 'EX_SOS';
  const currentUserId = user?.id;

  // Check if any POI type is enabled
  const anyPOIEnabled = Object.values(poiVisibility).some(v => v);

  // Toggle POI visibility
  const handleTogglePOI = useCallback((type: keyof POIVisibility) => {
    setPoiVisibility(prev => ({ ...prev, [type]: !prev[type] }));
  }, []);

  // Handle respond to help request or panic event from modal
  const handleRespondToRequest = useCallback(async (requestId: string) => {
    // First try to find in help requests
    const request = helpRequests.find(r => r.id === requestId);
    if (request) {
      return await startResponding(requestId, request.lat, request.lng, isRescatista);
    }
    
    // If not found in help requests, try panic events
    const panicEvent = panicEvents.find(e => e.id === requestId);
    if (panicEvent) {
      return await startPanicResponding(requestId, panicEvent.lat, panicEvent.lng, isRescatista);
    }
    
    console.error('[MapScreen] Alert not found:', requestId);
    return false;
  }, [helpRequests, panicEvents, startResponding, startPanicResponding, isRescatista]);

  // Handle cancel response - check which type of response is active
  const handleCancelResponse = useCallback(async () => {
    if (activePanicResponse) {
      await stopPanicResponding();
    } else {
      await stopResponding();
    }
  }, [activePanicResponse, stopPanicResponding, stopResponding]);

  // Handle mark as arrived - check which type of response is active  
  const handleMarkAsArrived = useCallback(async () => {
    if (activePanicResponse) {
      return await markPanicAsArrived();
    }
    return await markAsArrived();
  }, [activePanicResponse, markPanicAsArrived, markAsArrived]);

  // Handle mark as resolved - check which type of response is active
  const handleMarkAsResolved = useCallback(async () => {
    if (activePanicResponse) {
      return await markPanicAsResolved();
    }
    return await markAsResolved();
  }, [activePanicResponse, markPanicAsResolved, markAsResolved]);

  // Handle messaging a user
  const handleMessageUser = useCallback((userId: string, displayName: string | null) => {
    setMessagingUserId(userId);
    setMessagingUserName(displayName);
    setMessagingOpen(true);
  }, []);

  // Default center (Mexico City)
  const defaultCenter: [number, number] = [19.4326, -99.1332];

  // Center map on user's location
  const centerOnMe = useCallback(() => {
    if (!mapInstanceRef.current || !position) return;
    mapInstanceRef.current.setView([position.lat, position.lng], 16, { animate: true });
  }, [position]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: 14,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Add zoom control to bottom right
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    mapInstanceRef.current = map;
    setMapReady(true);

    // Add pulse animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse14 {
        0%, 100% { transform: scale(1); opacity: 0.5; }
        50% { transform: scale(1.5); opacity: 0; }
      }
      @keyframes pulseMedical {
        0%, 100% { transform: scale(1); opacity: 0.4; }
        50% { transform: scale(1.3); opacity: 0; }
      }
      @keyframes pulsePanic {
        0%, 100% { transform: scale(1); opacity: 0.5; }
        50% { transform: scale(1.4); opacity: 0; }
      }
      @keyframes pulseResponder {
        0%, 100% { transform: scale(1); opacity: 0.5; }
        50% { transform: scale(1.3); opacity: 0.2; }
      }
      @keyframes pulse-current-user {
        0% { transform: scale(1); opacity: 0.6; }
        50% { transform: scale(1.8); opacity: 0; }
        100% { transform: scale(1); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      style.remove();
    };
  }, []);

  // Update current location
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    if (position) {
      const latlng: [number, number] = [position.lat, position.lng];

      // Update or create current location marker
      if (currentLocationMarkerRef.current) {
        currentLocationMarkerRef.current.setLatLng(latlng);
      } else {
        currentLocationMarkerRef.current = L.marker(latlng, {
          icon: createCurrentLocationIcon(),
          zIndexOffset: 1000,
        })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center;">
              <strong>Tu ubicación</strong><br/>
              <span style="font-size: 11px; color: #666;">
                Precisión: ${position.accuracy?.toFixed(0) || '?'}m
              </span>
            </div>
          `);

        // Center map on first position
        map.setView(latlng, 14);
      }

      // Update accuracy circle
      if (position.accuracy) {
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.setLatLng(latlng);
          accuracyCircleRef.current.setRadius(position.accuracy);
        } else {
          accuracyCircleRef.current = L.circle(latlng, {
            radius: position.accuracy,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            weight: 1,
          }).addTo(map);
        }
      }
    }
  }, [position, mapReady]);

  // Update user location markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Filter out stale locations (older than 10 minutes) except current user
    const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();
    const activeLocations = locations.filter(loc => {
      if (loc.user_id === currentUserId) return true; // Always show current user
      if (!loc.updated_at) return false;
      const updatedMs = new Date(loc.updated_at).getTime();
      return (now - updatedMs) < STALE_THRESHOLD_MS;
    });

    // Remove old markers
    markersRef.current.forEach((marker, key) => {
      // keys are stored as `user-<uuid>`
      const stillExists = !!activeLocations.find(l => `user-${l.user_id}` === key);
      if (!stillExists) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    });

    // Add/update markers with role-based icons, transit status, and name visibility
    activeLocations.forEach((loc) => {
      const key = `user-${loc.user_id}`;
      const existingMarker = markersRef.current.get(key);
      const isSosActivo = loc.role === 'SOS_ACTIVO' || loc.role === 'EX_SOS';
      const isInTransit = loc.is_in_transit;
      const isMe = loc.user_id === currentUserId;
      const hasFirstAidKit = loc.has_first_aid_kit ?? false;
      const canProvideMedical = loc.can_provide_medical_assistance ?? false;
      const hasAmbulance = (loc as any).has_ambulance ?? false;
      
      // Priority: Transit > SOS Activo/EX-SOS > Familiar
      let icon;
      let roleLabel;
      let bgColor;
      let badgeColor;
      
      if (isInTransit) {
        icon = createTransitIcon(isMe);
        roleLabel = 'En tránsito';
        bgColor = '#f59e0b';
        badgeColor = '#f59e0b';
      } else if (isSosActivo) {
        icon = createRescatistaIcon(isMe, hasFirstAidKit);
        roleLabel = loc.role === 'SOS_ACTIVO' ? 'SOS ACTIVO' : 'EX-SOS';
        bgColor = loc.role === 'SOS_ACTIVO' ? '#22c55e' : '#3b82f6';
        badgeColor = loc.role === 'SOS_ACTIVO' ? '#22c55e' : '#3b82f6';
      } else {
        icon = createFamiliarIcon(isMe, hasFirstAidKit);
        roleLabel = 'FAMILIAR';
        bgColor = '#2e8b57';
        badgeColor = '#2e8b57';
      }
      
      // Calculate time since last update
      let updatedAgo = '';
      if (loc.updated_at) {
        const updatedDate = new Date(loc.updated_at);
        const now = new Date();
        const diffMs = now.getTime() - updatedDate.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHrs = Math.floor(diffMin / 60);
        
        if (diffSec < 60) {
          updatedAgo = `hace ${diffSec}s`;
        } else if (diffMin < 60) {
          updatedAgo = `hace ${diffMin}m`;
        } else {
          updatedAgo = `hace ${diffHrs}h`;
        }
      }
      
      const displayName = loc.display_name ? sanitize(loc.display_name) : null;
      const transitInfo = isInTransit && loc.transit_destination 
        ? `<div style="font-size: 10px; color: #f59e0b; margin-top: 4px;">🚗 → ${sanitize(loc.transit_destination)}</div>`
        : '';
      
      // Medical capabilities info
      const medicalCapabilities: string[] = [];
      if (canProvideMedical) medicalCapabilities.push('🩺 Asistencia médica');
      if (hasFirstAidKit) medicalCapabilities.push('🧰 Botiquín');
      if (hasAmbulance) medicalCapabilities.push('🚑 Ambulancia');
      const medicalInfo = medicalCapabilities.length > 0 
        ? `<div style="font-size: 10px; color: #22c55e; margin-top: 4px;">${medicalCapabilities.join(' • ')}</div>`
        : '';

      // Badge HTML for role
      const roleBadge = `<span style="
        display: inline-block;
        padding: 2px 6px;
        font-size: 9px;
        font-weight: 700;
        color: #fff;
        background: ${badgeColor};
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      ">${roleLabel}</span>`;
      
      // Updated ago HTML
      const updatedInfo = updatedAgo 
        ? `<div style="font-size: 10px; color: #888; margin-top: 4px;">⏱ Actualizado ${updatedAgo}</div>`
        : '';

      const popupContent = `
        <div style="min-width: 140px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <div style="width: 28px; height: 28px; background: ${bgColor}; border-radius: 50%; flex-shrink: 0;"></div>
            <div>
              ${displayName ? `<div style="font-weight: 600; font-size: 13px;">${displayName}</div>` : ''}
              ${roleBadge}
            </div>
          </div>
          ${medicalInfo}
          ${transitInfo}
          ${updatedInfo}
        </div>
      `;

      if (existingMarker) {
        existingMarker.setLatLng([loc.lat, loc.lng]);
        existingMarker.setIcon(icon);
        existingMarker.setPopupContent(popupContent);
      } else {
        const marker = L.marker([loc.lat, loc.lng], {
          icon: icon,
        })
          .addTo(map)
          .bindPopup(popupContent);
        markersRef.current.set(key, marker);
      }
    });
  }, [locations, mapReady]);

  // Draw transit routes for users in transit with destination coordinates
  const transitRoutesRef = useRef<Map<string, L.Polyline>>(new Map());
  
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Get users in transit with valid destination coordinates
    const transitUsers = locations.filter(
      loc => loc.is_in_transit && 
             loc.transit_destination_lat && 
             loc.transit_destination_lng
    );

    // Remove old transit routes
    transitRoutesRef.current.forEach((polyline, key) => {
      if (!transitUsers.find(u => `transit-route-${u.user_id}` === key)) {
        map.removeLayer(polyline);
        transitRoutesRef.current.delete(key);
      }
    });

    // Add/update transit routes
    transitUsers.forEach((loc) => {
      const key = `transit-route-${loc.user_id}`;
      const existingRoute = transitRoutesRef.current.get(key);
      
      const userPos: [number, number] = [loc.lat, loc.lng];
      const destPos: [number, number] = [loc.transit_destination_lat!, loc.transit_destination_lng!];

      if (existingRoute) {
        existingRoute.setLatLngs([userPos, destPos]);
      } else {
        // Create dashed line from current position to destination
        const polyline = L.polyline([userPos, destPos], {
          color: '#f59e0b',
          weight: 3,
          opacity: 0.7,
          dashArray: '10, 10',
          lineCap: 'round',
        }).addTo(map);

        // Add destination marker
        const destMarker = L.marker(destPos, {
          icon: L.divIcon({
            className: 'transit-destination-marker',
            html: `
              <div style="
                width: 24px;
                height: 24px;
                background: #f59e0b;
                border: 2px solid #0a0a0a;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/>
                  <circle cx="12" cy="10" r="3" fill="#fff"/>
                </svg>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
          zIndexOffset: 100,
        }).addTo(map);

        const displayName = loc.display_name ? sanitize(loc.display_name) : 'Usuario';
        const destName = loc.transit_destination ? sanitize(loc.transit_destination) : 'Destino';
        
        destMarker.bindPopup(`
          <div style="text-align: center; padding: 4px;">
            <div style="font-size: 12px; font-weight: 600; color: #f59e0b;">📍 Destino</div>
            <div style="font-size: 14px; font-weight: 500; margin-top: 4px;">${destName}</div>
            <div style="font-size: 11px; color: #666; margin-top: 2px;">
              Viaje de ${displayName}
            </div>
          </div>
        `);

        // Store polyline and marker together (use polyline as main reference)
        transitRoutesRef.current.set(key, polyline);
        markersRef.current.set(`${key}-dest`, destMarker);
      }
    });

    // Clean up destination markers for removed routes
    markersRef.current.forEach((marker, key) => {
      if (key.includes('transit-route-') && key.endsWith('-dest')) {
        const routeKey = key.replace('-dest', '');
        if (!transitRoutesRef.current.has(routeKey)) {
          map.removeLayer(marker);
          markersRef.current.delete(key);
        }
      }
    });
  }, [locations, mapReady]);

  // Update help 14 markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    const help14Requests = helpRequests.filter(r => r.kind === 'SISMO_AYUDA_14' && !r.resolved);

    // Remove old help markers
    markersRef.current.forEach((marker, key) => {
      if (key.startsWith('help-') && !help14Requests.find(r => `help-${r.id}` === key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    });

    // Add/update help markers
    help14Requests.forEach((req) => {
      const key = `help-${req.id}`;
      const existingMarker = markersRef.current.get(key);

      if (existingMarker) {
        existingMarker.setLatLng([req.lat, req.lng]);
      } else {
        const marker = L.marker([req.lat, req.lng], {
          icon: createHelp14Icon(),
          zIndexOffset: 500,
        })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center; padding: 4px;">
              <div style="font-size: 16px; font-weight: bold; color: #ef4444;">⚠️ AYUDA 14</div>
              <div style="font-size: 11px; color: #666; margin-top: 4px;">
                ${new Date(req.created_at).toLocaleTimeString()}
              </div>
              ${req.message ? `<div style="font-size: 13px; margin-top: 8px;">${sanitize(req.message)}</div>` : ''}
            </div>
          `);
        markersRef.current.set(key, marker);
      }
    });
  }, [helpRequests, mapReady]);

  // Update report markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Remove old report markers
    markersRef.current.forEach((marker, key) => {
      if (key.startsWith('report-') && !reports.find(r => `report-${r.id}` === key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    });

    // Add/update report markers
    reports.forEach((report) => {
      const key = `report-${report.id}`;
      const existingMarker = markersRef.current.get(key);

      if (existingMarker) {
        existingMarker.setLatLng([report.lat, report.lng]);
      } else {
        const categoryLabels: Record<string, string> = {
          'BLOCKADE': 'Bloqueo',
          'ACCIDENT': 'Accidente',
          'PROTEST': 'Manifestación',
          'HAZARD': 'Peligro',
          'OTHER': 'Otro',
        };
        const categoryLabel = categoryLabels[report.category] || report.category;
        
        const marker = L.marker([report.lat, report.lng], {
          icon: createReportIcon(report.severity, report.category),
        })
          .addTo(map)
          .bindPopup(`
            <div style="max-width: 200px;">
              <div style="font-weight: 600; font-size: 14px;">${sanitize(report.title)}</div>
              <div style="font-size: 11px; color: #888; margin-top: 4px;">
                ${categoryLabel} • Severidad ${report.severity}/4
              </div>
              ${report.description ? `<div style="font-size: 12px; margin-top: 8px; color: #ccc;">${sanitize(report.description)}</div>` : ''}
              <a href="https://maps.google.com/?q=${report.lat},${report.lng}" target="_blank" style="display: inline-block; margin-top: 8px; font-size: 11px; color: #3b82f6; text-decoration: none;">📍 Ver en Google Maps</a>
            </div>
          `);
        markersRef.current.set(key, marker);
      }
    });
  }, [reports, mapReady]);

  // Update medical provider markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Remove old medical markers
    markersRef.current.forEach((marker, key) => {
      if (key.startsWith('medical-') && !medicalProviders.find(p => `medical-${p.user_id}` === key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    });

    // Add/update medical provider markers
    medicalProviders.forEach((provider) => {
      const key = `medical-${provider.user_id}`;
      const existingMarker = markersRef.current.get(key);

      // Determine popup content
      const capabilities: string[] = [];
      if (provider.can_provide_medical_assistance) capabilities.push('Asistencia médica');
      if (provider.has_first_aid_kit) capabilities.push('Botiquín disponible');

      if (existingMarker) {
        existingMarker.setLatLng([provider.lat, provider.lng]);
      } else {
        const marker = L.marker([provider.lat, provider.lng], {
          icon: createMedicalIcon(provider.has_first_aid_kit, provider.can_provide_medical_assistance),
          zIndexOffset: 400,
        })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center; padding: 4px;">
              <div style="font-size: 14px; font-weight: bold; color: #22c55e;">🏥 Asistencia Médica</div>
              <div style="font-size: 12px; color: #666; margin-top: 6px;">
                ${capabilities.join(' • ')}
              </div>
            </div>
          `);
        markersRef.current.set(key, marker);
      }
    });
  }, [medicalProviders, mapReady]);

  // Update first aid kit and ambulance markers based on POI visibility toggles
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Handle first aid kit markers
    if (poiVisibility.first_aid_kit) {
      // Add markers for users with first aid kits
      locations.forEach((loc) => {
        const hasKit = loc.has_first_aid_kit ?? false;
        if (!hasKit) return;
        
        const key = `firstaid-${loc.user_id}`;
        if (markersRef.current.has(key)) return; // Already exists
        
        const marker = L.marker([loc.lat, loc.lng], {
          icon: createFirstAidKitIcon(),
          zIndexOffset: 450,
        })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center; padding: 4px;">
              <div style="font-size: 14px; font-weight: bold; color: #ef4444;">🩹 Botiquín Disponible</div>
              <div style="font-size: 11px; color: #666; margin-top: 6px;">
                Miembro con kit de primeros auxilios
              </div>
            </div>
          `);
        markersRef.current.set(key, marker);
      });
    } else {
      // Remove first aid kit markers
      markersRef.current.forEach((marker, key) => {
        if (key.startsWith('firstaid-')) {
          map.removeLayer(marker);
          markersRef.current.delete(key);
        }
      });
    }

    // Check if there are active emergencies (unresolved help requests or panic events)
    const hasActiveEmergency = helpRequests.length > 0 || panicEvents.length > 0;

    // Handle ambulance markers
    if (poiVisibility.ambulance) {
      // First, remove existing ambulance markers to update with new icon state
      markersRef.current.forEach((marker, key) => {
        if (key.startsWith('ambulance-')) {
          map.removeLayer(marker);
          markersRef.current.delete(key);
        }
      });

      // Add markers for users with ambulances
      locations.forEach((loc) => {
        const hasAmbulance = (loc as any).has_ambulance ?? false;
        if (!hasAmbulance) return;
        
        const key = `ambulance-${loc.user_id}`;
        
        const emergencyMessage = hasActiveEmergency 
          ? '<div style="font-size: 11px; color: #ef4444; font-weight: bold; margin-top: 6px;">⚠️ Emergencia activa cercana</div>'
          : '';
        
        const marker = L.marker([loc.lat, loc.lng], {
          icon: createAmbulanceIcon(hasActiveEmergency),
          zIndexOffset: hasActiveEmergency ? 550 : 500,
        })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center; padding: 4px;">
              <div style="font-size: 14px; font-weight: bold; color: #ef4444;">🚑 Ambulancia Disponible</div>
              ${emergencyMessage}
              <div style="font-size: 11px; color: #666; margin-top: 6px;">
                Miembro con vehículo de emergencia
              </div>
            </div>
          `);
        markersRef.current.set(key, marker);
      });
    } else {
      // Remove ambulance markers
      markersRef.current.forEach((marker, key) => {
        if (key.startsWith('ambulance-')) {
          map.removeLayer(marker);
          markersRef.current.delete(key);
        }
      });
    }
  }, [locations, poiVisibility.first_aid_kit, poiVisibility.ambulance, mapReady, helpRequests.length, panicEvents.length]);

  // Update panic event markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Remove old panic markers
    markersRef.current.forEach((marker, key) => {
      if (key.startsWith('panic-') && !panicEvents.find(e => `panic-${e.id}` === key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    });

    // Add/update panic markers
    panicEvents.forEach((event) => {
      const key = `panic-${event.id}`;
      const existingMarker = markersRef.current.get(key);

      const typeLabels: Record<string, string> = {
        'AMBULANCIA_PROPIA': '🚑 Ambulancia para mí',
        'AMBULANCIA_TERCERO': '🚑 Ambulancia Tercero',
        'PATRULLA': '🚔 Patrulla',
        'MECANICO': '🔧 Mecánico',
        'PROTECCION_CIVIL': '🆘 Protección Civil',
      };
      const label = typeLabels[event.panic_type] || '🆘 Emergencia';

      if (existingMarker) {
        existingMarker.setLatLng([event.lat, event.lng]);
      } else {
        const marker = L.marker([event.lat, event.lng], {
          icon: createPanicIcon(event.panic_type),
          zIndexOffset: 600,
        })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center; padding: 4px;">
              <div style="font-size: 16px; font-weight: bold; color: #ef4444;">⚠️ ALERTA SOS</div>
              <div style="font-size: 13px; margin-top: 4px;">${label}</div>
              <div style="font-size: 11px; color: #666; margin-top: 4px;">
                ${new Date(event.created_at).toLocaleTimeString()}
              </div>
              <a href="https://maps.google.com/?q=${event.lat},${event.lng}" 
                 target="_blank" 
                 style="display: inline-block; margin-top: 8px; font-size: 12px; color: #3b82f6;">
                Abrir en Google Maps
              </a>
            </div>
          `);
        markersRef.current.set(key, marker);
      }
    });
  }, [panicEvents, mapReady]);

  // Update responder markers and route lines
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Get current responder keys for comparison
    const currentResponderKeys = new Set(activeResponders.map(r => `responder-${r.request_id}-${r.responder_id}`));
    const currentRouteKeys = new Set(activeResponders.map(r => `route-${r.request_id}-${r.responder_id}`));

    // Remove old responder markers
    markersRef.current.forEach((marker, key) => {
      if (key.startsWith('responder-') && !currentResponderKeys.has(key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    });

    // Remove old route polylines
    polylinesRef.current.forEach((polyline, key) => {
      if (key.startsWith('route-') && !currentRouteKeys.has(key)) {
        map.removeLayer(polyline);
        polylinesRef.current.delete(key);
      }
    });

    // Count responders per request for display
    const respondersPerRequest = new Map<string, number>();
    activeResponders.forEach(r => {
      respondersPerRequest.set(r.request_id, (respondersPerRequest.get(r.request_id) || 0) + 1);
    });

    // Add/update responder markers and route lines
    activeResponders.forEach((responder, index) => {
      // Use composite key to support multiple responders per request
      const markerKey = `responder-${responder.request_id}-${responder.responder_id}`;
      const routeKey = `route-${responder.request_id}-${responder.responder_id}`;
      const existingMarker = markersRef.current.get(markerKey);
      const existingPolyline = polylinesRef.current.get(routeKey);

      const responderLatLng: [number, number] = [responder.responder_lat, responder.responder_lng];
      const emergencyLatLng: [number, number] = [responder.emergency_lat, responder.emergency_lng];

      // Format ETA display
      const formatEta = (minutes: number | null, distanceKm: number) => {
        const distanceText = distanceKm < 1 
          ? `${Math.round(distanceKm * 1000)}m` 
          : `${distanceKm.toFixed(1)}km`;
        
        if (minutes === null) {
          return `📍 ${distanceText}`;
        }
        
        if (minutes < 1) {
          return `⏱️ <1 min • ${distanceText}`;
        } else if (minutes < 60) {
          return `⏱️ ~${Math.round(minutes)} min • ${distanceText}`;
        } else {
          const hours = Math.floor(minutes / 60);
          const mins = Math.round(minutes % 60);
          return `⏱️ ~${hours}h ${mins}min • ${distanceText}`;
        }
      };

      const etaDisplay = formatEta(responder.eta_minutes, responder.distance_km);
      const speedDisplay = responder.speed 
        ? `${Math.round(responder.speed * 3.6)} km/h` 
        : 'Velocidad desconocida';
      
      // Show responder count if multiple
      const totalResponders = respondersPerRequest.get(responder.request_id) || 1;
      const responderIndexForRequest = activeResponders
        .filter(r => r.request_id === responder.request_id)
        .indexOf(responder) + 1;
      
      const responderLabel = totalResponders > 1 
        ? `Rescatista ${responderIndexForRequest}/${totalResponders}`
        : 'Rescatista en camino';

      // Check if arrived
      const arrivedBadge = responder.arrived_at 
        ? '<div style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-top: 4px;">✓ LLEGÓ</div>'
        : '';

      const popupContent = `
        <div style="text-align: center; padding: 4px; min-width: 160px;">
          <div style="font-size: 14px; font-weight: bold; color: #3b82f6;">🚨 ${responderLabel}</div>
          ${arrivedBadge}
          <div style="font-size: 13px; font-weight: 600; color: #22c55e; margin-top: 6px;">
            ${etaDisplay}
          </div>
          <div style="font-size: 11px; color: #666; margin-top: 4px;">
            ${speedDisplay}
          </div>
          <div style="font-size: 10px; color: #999; margin-top: 4px;">
            Desde ${new Date(responder.responding_started_at).toLocaleTimeString()}
          </div>
        </div>
      `;

      // Update or create responder marker
      if (existingMarker) {
        existingMarker.setLatLng(responderLatLng);
        existingMarker.setPopupContent(popupContent);
      } else {
        const marker = L.marker(responderLatLng, {
          icon: createResponderIcon(),
          zIndexOffset: 700 + index, // Stagger z-index for multiple markers
        })
          .addTo(map)
          .bindPopup(popupContent);
        markersRef.current.set(markerKey, marker);
      }

      // Different colors for multiple responders
      const routeColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899'];
      const routeColor = routeColors[responderIndexForRequest - 1] || routeColors[0];

      // Update or create route polyline (dashed line from responder to emergency)
      if (existingPolyline) {
        existingPolyline.setLatLngs([responderLatLng, emergencyLatLng]);
        existingPolyline.setStyle({ color: routeColor });
      } else {
        const polyline = L.polyline([responderLatLng, emergencyLatLng], {
          color: routeColor,
          weight: 3,
          opacity: 0.8,
          dashArray: '10, 10',
        }).addTo(map);
        polylinesRef.current.set(routeKey, polyline);
      }
    });
  }, [activeResponders, mapReady]);

  // Update markers and route lines for responders to MY alerts (with names, routes, and ETA)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Keys for my alert responders
    const myResponderKeys = new Set(
      respondersToMyAlerts
        .filter(r => r.lat && r.lng)
        .map(r => `my-responder-${r.id}`)
    );
    const myRouteKeys = new Set(
      respondersToMyAlerts
        .filter(r => r.lat && r.lng)
        .map(r => `my-route-${r.id}`)
    );

    // Remove old my-responder markers
    markersRef.current.forEach((marker, key) => {
      if (key.startsWith('my-responder-') && !myResponderKeys.has(key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    });

    // Remove old my-route polylines
    polylinesRef.current.forEach((polyline, key) => {
      if (key.startsWith('my-route-') && !myRouteKeys.has(key)) {
        map.removeLayer(polyline);
        polylinesRef.current.delete(key);
      }
    });

    // Add/update my alert responder markers and routes
    respondersToMyAlerts
      .filter(r => r.lat && r.lng)
      .forEach((responder, index) => {
        const markerKey = `my-responder-${responder.id}`;
        const routeKey = `my-route-${responder.id}`;
        const existingMarker = markersRef.current.get(markerKey);
        const existingPolyline = polylinesRef.current.get(routeKey);
        const latLng: [number, number] = [responder.lat!, responder.lng!];
        const alertLatLng: [number, number] = [responder.alert_lat, responder.alert_lng];

        // Format ETA display
        const formatEta = (minutes: number | null, distanceKm: number) => {
          const distanceText = distanceKm < 1 
            ? `${Math.round(distanceKm * 1000)}m` 
            : `${distanceKm.toFixed(1)}km`;
          
          if (minutes === null || minutes <= 0) {
            return `📍 ${distanceText}`;
          }
          
          if (minutes < 1) {
            return `⏱️ <1 min • ${distanceText}`;
          } else if (minutes < 60) {
            return `⏱️ ~${Math.round(minutes)} min • ${distanceText}`;
          } else {
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return `⏱️ ~${hours}h ${mins}min • ${distanceText}`;
          }
        };

        const etaDisplay = formatEta(responder.eta_minutes, responder.distance_km);
        const speedDisplay = responder.speed 
          ? `🚗 ${Math.round(responder.speed * 3.6)} km/h` 
          : 'Velocidad desconocida';

        const arrivedBadge = responder.arrived_at 
          ? '<div style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-top: 4px;">✅ LLEGÓ</div>'
          : '<div style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-top: 4px;">🚗 En camino</div>';

        const popupContent = `
          <div style="text-align: center; padding: 4px; min-width: 160px;">
            <div style="font-size: 14px; font-weight: bold; color: #3b82f6;">🚨 ${sanitize(responder.nickname)}</div>
            ${arrivedBadge}
            <div style="font-size: 13px; font-weight: 600; color: #22c55e; margin-top: 6px;">
              ${etaDisplay}
            </div>
            <div style="font-size: 11px; color: #666; margin-top: 4px;">
              ${speedDisplay}
            </div>
            <div style="font-size: 10px; color: #999; margin-top: 4px;">
              Desde ${new Date(responder.started_at).toLocaleTimeString()}
            </div>
          </div>
        `;

        if (existingMarker) {
          existingMarker.setLatLng(latLng);
          existingMarker.setPopupContent(popupContent);
        } else {
          const marker = L.marker(latLng, {
            icon: createResponderIcon(),
            zIndexOffset: 800 + index,
          })
            .addTo(map)
            .bindPopup(popupContent);
          markersRef.current.set(markerKey, marker);
        }

        // Route line colors - use different colors for multiple responders
        const routeColors = ['#22c55e', '#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b'];
        const routeColor = routeColors[index % routeColors.length];

        // Update or create route polyline (dashed line from responder to alert)
        if (!responder.arrived_at) {
          if (existingPolyline) {
            existingPolyline.setLatLngs([latLng, alertLatLng]);
            existingPolyline.setStyle({ color: routeColor });
          } else {
            const polyline = L.polyline([latLng, alertLatLng], {
              color: routeColor,
              weight: 4,
              opacity: 0.9,
              dashArray: '12, 8',
            }).addTo(map);
            polylinesRef.current.set(routeKey, polyline);
          }
        } else {
          // Remove route line if arrived
          if (existingPolyline) {
            map.removeLayer(existingPolyline);
            polylinesRef.current.delete(routeKey);
          }
        }
      });
  }, [respondersToMyAlerts, mapReady]);

  // Fetch POIs when map moves and any POI type is enabled
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Only fetch if any POI type is enabled
    if (!anyPOIEnabled) return;

    const handleMoveEnd = () => {
      const bounds = map.getBounds();
      fetchPOIs({
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      });
    };

    // Fetch immediately for current bounds
    handleMoveEnd();

    map.on('moveend', handleMoveEnd);
    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [mapReady, anyPOIEnabled, fetchPOIs]);

  // Re-fetch POIs when visibility changes and POIs are enabled
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady || !anyPOIEnabled) return;
    const map = mapInstanceRef.current;
    
    const bounds = map.getBounds();
    fetchPOIs({
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    });
  }, [poiVisibility, mapReady, anyPOIEnabled, fetchPOIs]);

  // Update POI markers
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Get visible POI types
    const visiblePOIs = pois.filter(poi => poiVisibility[poi.type]);
    const visiblePOIKeys = new Set(visiblePOIs.map(poi => `poi-${poi.id}`));

    // Remove old POI markers
    markersRef.current.forEach((marker, key) => {
      if (key.startsWith('poi-') && !visiblePOIKeys.has(key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    });

    // Add/update POI markers
    visiblePOIs.forEach(poi => {
      const key = `poi-${poi.id}`;
      const existingMarker = markersRef.current.get(key);

      const hospitalLabel = poi.type === 'hospital' 
        ? (poi.isPrivate ? ' (Privado)' : ' (Público)')
        : '';

      const popupContent = `
        <div style="text-align: center; padding: 4px; max-width: 180px;">
          <div style="font-size: 13px; font-weight: 600;">${sanitize(poi.name)}${hospitalLabel}</div>
          <a href="https://maps.google.com/?q=${poi.lat},${poi.lng}" 
             target="_blank" 
             style="display: inline-block; margin-top: 6px; font-size: 11px; color: #3b82f6;">
            Abrir en Google Maps
          </a>
        </div>
      `;

      if (existingMarker) {
        existingMarker.setLatLng([poi.lat, poi.lng]);
        existingMarker.setPopupContent(popupContent);
      } else {
        const marker = L.marker([poi.lat, poi.lng], {
          icon: createPOIIcon(poi.type, poi.isPrivate),
          zIndexOffset: 100,
        })
          .addTo(map)
          .bindPopup(popupContent);
        markersRef.current.set(key, marker);
      }
    });
  }, [pois, poiVisibility, mapReady]);

  // Handle view location from alerts panel
  const handleViewLocation = useCallback((lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([lat, lng], 17, { animate: true });
  }, []);

  return (
    <div className={cn('relative w-full h-full', className)}>
      {/* Location error banner */}
      {locationError && (
        <div className="absolute top-2 left-2 right-2 z-[1000] bg-warning/90 text-background p-2 rounded-lg text-sm font-medium">
          {locationError}
        </div>
      )}

      {/* Map container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Active users count + center button + alerts panel */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-border">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-safe" />
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-safe animate-ping opacity-75" />
              </div>
              <span className="text-sm font-medium text-foreground">
                {locations.length} {locations.length === 1 ? 'activo' : 'activos'}
              </span>
            </div>
          </div>
          <button
            onClick={centerOnMe}
            disabled={!position}
            className="bg-card/95 backdrop-blur-sm rounded-lg p-2.5 shadow-lg border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Centrar en mi ubicación"
          >
            <Locate className="w-5 h-5 text-primary" />
          </button>
          
          {/* Share location button */}
          <ShareLocationButton 
            position={position} 
            className="relative"
          />
          
          {/* I'm OK button */}
          <ImOkButton 
            position={position} 
            className="relative"
          />
        </div>
        
        {/* Alerts Panel Button */}
        <AlertsPanel
          panicEvents={panicEvents}
          helpRequests={helpRequests}
          onViewLocation={handleViewLocation}
          isRescatista={isRescatista}
          currentUserId={currentUserId}
          onResolveHelpRequest={resolveRequest}
          onResolvePanicEvent={resolveEvent}
          activeResponders={activeResponders}
          userPosition={position}
          onRespondToRequest={handleRespondToRequest}
          onCancelResponse={handleCancelResponse}
          onMarkAsArrived={handleMarkAsArrived}
          onResolve={handleMarkAsResolved}
        />
      </div>

      {/* Map legend with POI toggles */}
      <MapLegend 
        poiVisibility={poiVisibility}
        onTogglePOI={handleTogglePOI}
        poisLoading={poisLoading}
      />

      {/* Active Users Panel */}
      <ActiveUsersPanel
        users={locations}
        onCenterOnUser={handleViewLocation}
        onMessageUser={handleMessageUser}
      />

      {/* Internal Messaging Modal */}
      <InternalMessaging
        isOpen={messagingOpen}
        onClose={() => {
          setMessagingOpen(false);
          setMessagingUserId(null);
          setMessagingUserName(null);
        }}
        initialUserId={messagingUserId}
        initialUserName={messagingUserName}
      />
    </div>
  );
};

export default MapScreen;
