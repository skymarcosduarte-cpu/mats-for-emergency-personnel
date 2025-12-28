// Map Screen with vanilla Leaflet for COMUNIDAD EX SOS
// Using vanilla Leaflet to avoid react-leaflet context issues

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import DOMPurify from 'dompurify';
import { ChevronDown, ChevronUp, Info, Building2, Fuel, Pill, Shield, Flame, AlertTriangle, Users } from 'lucide-react';
import { GpsStatusBanner } from '@/components/GpsStatusBanner';
import { MapControlsMenu } from '@/components/MapControlsMenu';
import { ImOkButton } from '@/components/ImOkButton';
import { useLocation } from '@/hooks/useLocation';
import type { GeoPosition } from '@/types';
import { useUserLocations, useHelpRequests, useRoadReports, useMedicalProviders, usePanicEvents, useActiveResponders } from '@/hooks/useRealtime';
import { useActiveTrips } from '@/hooks/useActiveTrips';
import { useEmergencyResponse } from '@/hooks/useEmergencyResponse';
import { usePanicResponse } from '@/hooks/usePanicResponse';
import { usePOIs, type POI } from '@/hooks/usePOIs';
import { useEmergencyContactsDB } from '@/hooks/useEmergencyContactsDB';
import { AlertsPanel } from '@/components/AlertsPanel';
import { AlertDetailModal } from '@/components/AlertDetailModal';
import { ActiveUsersPanel } from '@/components/ActiveUsersPanel';
import { InternalMessaging } from '@/components/InternalMessaging';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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
const createFamiliarIcon = (isCurrentUser: boolean = false, hasFirstAidKit: boolean = false, updatedAgo?: string) => L.divIcon({
  className: `mats-marker familiar-marker ${isCurrentUser ? 'current-user-marker' : ''}`,
  html: `
    <div style="position: relative; width: 32px; height: ${isCurrentUser ? '40px' : (updatedAgo ? '48px' : '32px')};">
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
          bottom: ${updatedAgo ? '16px' : '0'};
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
      ${!isCurrentUser && updatedAgo ? `
        <div style="
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.75);
          color: #fff;
          font-size: 8px;
          font-weight: 600;
          padding: 1px 4px;
          border-radius: 3px;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        ">${updatedAgo}</div>
      ` : ''}
    </div>
  `,
  iconSize: [32, isCurrentUser ? 40 : (updatedAgo && !isCurrentUser ? 48 : 32)],
  iconAnchor: [16, isCurrentUser ? 20 : (updatedAgo && !isCurrentUser ? 24 : 16)],
  popupAnchor: [0, isCurrentUser ? -20 : (updatedAgo && !isCurrentUser ? -24 : -16)],
});

// Simple green cross icon for SOS ACTIVO / EX-SOS users
const createRescatistaIcon = (isCurrentUser: boolean = false, hasFirstAidKit: boolean = false, updatedAgo?: string) => L.divIcon({
  className: `mats-marker rescatista-marker ${isCurrentUser ? 'current-user-marker' : ''}`,
  html: `
    <div style="position: relative; width: 32px; height: ${isCurrentUser ? '40px' : (updatedAgo ? '48px' : '32px')};">
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
          bottom: ${updatedAgo ? '16px' : '0'};
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
      ${!isCurrentUser && updatedAgo ? `
        <div style="
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.75);
          color: #fff;
          font-size: 8px;
          font-weight: 600;
          padding: 1px 4px;
          border-radius: 3px;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        ">${updatedAgo}</div>
      ` : ''}
    </div>
  `,
  iconSize: [32, isCurrentUser ? 40 : (updatedAgo && !isCurrentUser ? 48 : 32)],
  iconAnchor: [16, isCurrentUser ? 20 : (updatedAgo && !isCurrentUser ? 24 : 16)],
  popupAnchor: [0, isCurrentUser ? -20 : (updatedAgo && !isCurrentUser ? -24 : -16)],
});

// Transit icon for users with active road trips (orange/amber color with car icon)
const createTransitIcon = (isCurrentUser: boolean = false, updatedAgo?: string) => L.divIcon({
  className: `mats-marker transit-marker ${isCurrentUser ? 'current-user-marker' : ''}`,
  html: `
    <div style="position: relative; width: 32px; height: ${isCurrentUser ? '40px' : (updatedAgo ? '48px' : '32px')};">
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
          bottom: ${updatedAgo ? '16px' : '0'};
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
      ${!isCurrentUser && updatedAgo ? `
        <div style="
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.75);
          color: #fff;
          font-size: 8px;
          font-weight: 600;
          padding: 1px 4px;
          border-radius: 3px;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        ">${updatedAgo}</div>
      ` : ''}
    </div>
  `,
  iconSize: [32, isCurrentUser ? 40 : (updatedAgo && !isCurrentUser ? 48 : 32)],
  iconAnchor: [16, isCurrentUser ? 20 : (updatedAgo && !isCurrentUser ? 24 : 16)],
  popupAnchor: [0, isCurrentUser ? -20 : (updatedAgo && !isCurrentUser ? -24 : -16)],
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
// Now includes responder info badge showing name, transport mode, ETA, and arrival status
interface ResponderInfo {
  name: string;
  transport_mode: string | null;
  eta_minutes: number | null;
  arrived: boolean;
}

const createPanicIcon = (panicType: string, responderInfos: ResponderInfo[] = []) => {
  const typeConfig: Record<string, { color: string; emoji: string }> = {
    'AMBULANCIA_PROPIA': { color: '#ef4444', emoji: '🚑' },
    'AMBULANCIA_TERCERO': { color: '#ef4444', emoji: '🚑' },
    'PATRULLA': { color: '#3b82f6', emoji: '🚔' },
    'MECANICO': { color: '#eab308', emoji: '🔧' },
    'PROTECCION_CIVIL': { color: '#f97316', emoji: '🆘' },
  };
  const config = typeConfig[panicType] || { color: '#ef4444', emoji: '🆘' };
  
  // Transport mode emojis
  const transportEmojis: Record<string, string> = {
    'car': '🚗',
    'motorcycle': '🏍️',
    'walking': '🚶',
    'bicycle': '🚲',
  };
  
  // Badge showing responder info with transport and ETA
  let responderBadge = '';
  if (responderInfos.length > 0) {
    const first = responderInfos[0];
    const displayName = first.name.length > 6 ? first.name.substring(0, 6) + '..' : first.name;
    const transportEmoji = first.transport_mode ? (transportEmojis[first.transport_mode] || '🚗') : '';
    
    // Show arrival status, ETA, or just responding
    let statusText = '';
    if (first.arrived) {
      statusText = '✅';
    } else if (first.eta_minutes != null && first.eta_minutes > 0) {
      const etaMin = Math.round(first.eta_minutes);
      statusText = etaMin < 60 ? `${etaMin}m` : `${Math.round(etaMin / 60)}h`;
    }
    
    const extraCount = responderInfos.length > 1 ? ` +${responderInfos.length - 1}` : '';
    const badgeColor = first.arrived ? '#22c55e' : '#3b82f6';
    
    responderBadge = `
      <div style="
        position: absolute;
        top: -8px;
        left: 50%;
        transform: translateX(-50%);
        min-width: 50px;
        max-width: 120px;
        height: 20px;
        background: ${badgeColor};
        border: 2px solid white;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        font-size: 9px;
        font-weight: bold;
        color: white;
        z-index: 10;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        padding: 0 6px;
        white-space: nowrap;
      ">${transportEmoji}${displayName}${statusText ? ' ' + statusText : ''}${extraCount}</div>
    `;
  }
  
  return L.divIcon({
    className: 'panic-marker',
    html: `
      <div style="
        width: 44px;
        height: ${responderInfos.length > 0 ? '56px' : '44px'};
        position: relative;
        display: flex;
        align-items: ${responderInfos.length > 0 ? 'flex-end' : 'center'};
        justify-content: center;
      ">
        ${responderBadge}
        <div style="
          position: ${responderInfos.length > 0 ? 'absolute' : 'relative'};
          bottom: 0;
          width: 44px;
          height: 44px;
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
      </div>
    `,
    iconSize: [44, responderInfos.length > 0 ? 56 : 44],
    iconAnchor: [22, responderInfos.length > 0 ? 44 : 22],
    popupAnchor: [0, responderInfos.length > 0 ? -44 : -22],
  });
};

// Responder icon - shows RESCATISTA responding to emergency with their name, transport, and ETA
interface ResponderMarkerInfo {
  name?: string;
  transport_mode?: string | null;
  eta_minutes?: number | null;
  arrived?: boolean;
}

const createResponderIcon = (info?: ResponderMarkerInfo) => {
  const displayName = info?.name 
    ? (info.name.length > 8 ? info.name.substring(0, 8) + '..' : info.name)
    : null;
  
  // Transport mode emojis
  const transportEmojis: Record<string, string> = {
    'car': '🚗',
    'motorcycle': '🏍️',
    'walking': '🚶',
    'bicycle': '🚲',
  };
  
  const transportEmoji = info?.transport_mode ? (transportEmojis[info.transport_mode] || '') : '';
  
  // Build ETA text
  let etaText = '';
  if (info?.arrived) {
    etaText = '✅';
  } else if (info?.eta_minutes != null && info.eta_minutes > 0) {
    const etaMin = Math.round(info.eta_minutes);
    etaText = etaMin < 60 ? `${etaMin}m` : `${Math.round(etaMin / 60)}h`;
  }
  
  const badgeColor = info?.arrived ? '#22c55e' : '#3b82f6';
  
  const nameBadge = displayName ? `
    <div style="
      position: absolute;
      bottom: -4px;
      left: 50%;
      transform: translateX(-50%);
      background: ${badgeColor};
      color: white;
      font-size: 9px;
      font-weight: bold;
      padding: 1px 6px;
      border-radius: 6px;
      border: 1px solid white;
      white-space: nowrap;
      z-index: 10;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 2px;
    ">${transportEmoji}${displayName}${etaText ? ' ' + etaText : ''}</div>
  ` : '';
  
  return L.divIcon({
    className: 'responder-marker',
    html: `
      <div style="
        width: 44px;
        height: ${displayName ? '56px' : '44px'};
        position: relative;
        display: flex;
        align-items: ${displayName ? 'flex-start' : 'center'};
        justify-content: center;
      ">
        <div style="
          position: absolute;
          top: 0;
          width: 44px;
          height: 44px;
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
            background: ${badgeColor};
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
        ${nameBadge}
      </div>
    `,
    iconSize: [44, displayName ? 56 : 44],
    iconAnchor: [22, displayName ? 22 : 22],
    popupAnchor: [0, displayName ? -22 : -22],
  });
};

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
  isNavigating?: boolean;
}

const MapLegend: React.FC<MapLegendProps> = ({ poiVisibility, onTogglePOI, poisLoading, isNavigating = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  // Auto-hide when navigating (viewing an alert/user)
  React.useEffect(() => {
    if (isNavigating) {
      setIsHidden(true);
      setIsExpanded(false);
    }
  }, [isNavigating]);

  // If hidden, show only a small restore button
  if (isHidden) {
    return (
      <button
        onClick={() => setIsHidden(false)}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-[500] bg-card/95 backdrop-blur-sm rounded-lg shadow-lg border border-border p-2 hover:bg-accent/50 transition-colors"
        aria-label="Mostrar leyenda"
      >
        <Info className="w-4 h-4 text-muted-foreground" />
      </button>
    );
  }

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
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-[500] bg-card/95 backdrop-blur-sm rounded-lg shadow-lg border border-border overflow-hidden max-h-[60vh] overflow-y-auto">
      <div className="flex items-center">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-1 flex items-center justify-between p-2.5 hover:bg-accent/50 transition-colors"
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
        <button
          onClick={() => setIsHidden(true)}
          className="p-2 hover:bg-accent/50 transition-colors border-l border-border"
          aria-label="Minimizar leyenda"
        >
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground rotate-90" />
        </button>
      </div>
      
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 text-xs animate-in slide-in-from-bottom-2 duration-200">
          {/* Core markers */}
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Comunidad</div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#2e8b57' }} />
            <span className="text-foreground">Miembro</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-white border-2 flex items-center justify-center" style={{ borderColor: '#16a34a' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 4v16M4 12h16" stroke="#16a34a" strokeWidth="4" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-foreground">SOS Activo / Ex-SOS</span>
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
          
          {/* Viajes activos */}
          <div className="border-t border-border my-2 pt-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Viajes en tránsito</div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ background: '#f59e0b' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h2"/>
                </svg>
              </div>
              <span className="text-foreground">Usuario en viaje</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div 
                className="w-8 h-1 rounded" 
                style={{ 
                  background: 'repeating-linear-gradient(90deg, #f59e0b 0, #f59e0b 4px, transparent 4px, transparent 8px)',
                  opacity: 0.7
                }} 
              />
              <span className="text-foreground text-[11px]">Ruta de viaje activo</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-3 h-3 rounded-full" style={{ background: '#22c55e', border: '1px solid #fff' }} />
              <span className="text-foreground text-[11px]">Origen</span>
              <div className="w-3 h-3 rounded-full ml-2" style={{ background: '#f59e0b', border: '1px solid #fff' }} />
              <span className="text-foreground text-[11px]">Destino</span>
            </div>
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
  onNavigateToSettings?: () => void;
}

export const MapScreen: React.FC<MapScreenProps> = ({ className, respondersToMyAlerts = [], onNavigateToSettings }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const currentLocationMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const [mapReady, setMapReady] = useState(false);
  // Messaging state
  const [messagingOpen, setMessagingOpen] = useState(false);
  
  // Active users panel state for legend auto-hide
  const [usersPanelOpen, setUsersPanelOpen] = useState(false);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);
  const [messagingUserName, setMessagingUserName] = useState<string | null>(null);

  // Alert detail modal state (for clicking markers on map)
  const [selectedMapAlert, setSelectedMapAlert] = useState<any | null>(null);
  const [selectedMapAlertType, setSelectedMapAlertType] = useState<'panic' | 'help' | null>(null);
  const [isDeletingMapAlert, setIsDeletingMapAlert] = useState(false);

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

  const { position, error: locationError, getCurrentPosition, loading: locationLoading, watching: locationWatching } = useLocation();
  const { role, user } = useAuth();
  const { locations, refetch: refetchLocations } = useUserLocations();
  const { requests: helpRequests, resolveRequest } = useHelpRequests(position);
  const { reports } = useRoadReports();
  const { providers: medicalProviders } = useMedicalProviders();
  const { events: panicEvents, resolveEvent } = usePanicEvents();
  const { responders: activeResponders } = useActiveResponders();
  const { trips: activeTrips } = useActiveTrips();
  const { startResponding, stopResponding, markAsArrived, markAsResolved, updateTransportMode } = useEmergencyResponse();
  const { 
    startResponding: startPanicResponding, 
    stopResponding: stopPanicResponding, 
    markAsArrived: markPanicAsArrived, 
    markAsResolved: markPanicAsResolved,
    updateTransportMode: updatePanicTransportMode,
    activeResponse: activePanicResponse
  } = usePanicResponse();
  const { pois, loading: poisLoading, fetchPOIs } = usePOIs();
  const { hasMinimumContacts, loading: contactsLoading } = useEmergencyContactsDB();
  
  const isRescatista = role === 'SOS_ACTIVO' || role === 'EX_SOS';
  const currentUserId = user?.id;

  // Check if any POI type is enabled
  const anyPOIEnabled = Object.values(poiVisibility).some(v => v);

  // Toggle POI visibility
  const handleTogglePOI = useCallback((type: keyof POIVisibility) => {
    setPoiVisibility(prev => ({ ...prev, [type]: !prev[type] }));
  }, []);

  // Handle respond to help request or panic event from modal
  const handleRespondToRequest = useCallback(async (
    requestId: string, 
    alertType: 'panic' | 'help', 
    alertLat: number, 
    alertLng: number,
    transportMode?: string, 
    estimatedEtaMinutes?: number
  ) => {
    console.log('[MapScreen] handleRespondToRequest called', { requestId, alertType, alertLat, alertLng, isRescatista, role, transportMode, estimatedEtaMinutes });
    
    // Validate alertType to prevent inserting into wrong table
    if (!alertType || (alertType !== 'panic' && alertType !== 'help')) {
      console.error('[MapScreen] Invalid or missing alert type:', alertType);
      toast.error('Error: Tipo de alerta no válido');
      return false;
    }
    
    try {
      if (alertType === 'help') {
        console.log('[MapScreen] Responding to help request...');
        return await startResponding(requestId, alertLat, alertLng, isRescatista, transportMode, estimatedEtaMinutes);
      }
      
      if (alertType === 'panic') {
        console.log('[MapScreen] Responding to panic event...');
        return await startPanicResponding(requestId, alertLat, alertLng, isRescatista, transportMode, estimatedEtaMinutes);
      }
    } catch (error) {
      console.error('[MapScreen] Error responding to alert:', error);
      toast.error('Error al responder: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      return false;
    }
    
    return false;
  }, [startResponding, startPanicResponding, isRescatista, role]);

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

  // Handle update transport mode - check which type of response is active
  const handleUpdateTransport = useCallback(async (transportMode: string, estimatedEtaMinutes: number) => {
    if (activePanicResponse) {
      return await updatePanicTransportMode(transportMode, estimatedEtaMinutes);
    }
    return await updateTransportMode(transportMode, estimatedEtaMinutes);
  }, [activePanicResponse, updatePanicTransportMode, updateTransportMode]);

  // Handle messaging a user
  const handleMessageUser = useCallback((userId: string, displayName: string | null) => {
    setMessagingUserId(userId);
    setMessagingUserName(displayName);
    setMessagingOpen(true);
  }, []);

  // Handle opening alert detail from map marker
  const handleOpenAlertFromMap = useCallback((alert: any, type: 'panic' | 'help') => {
    setSelectedMapAlert(alert);
    setSelectedMapAlertType(type);
  }, []);

  const handleCloseAlertFromMap = useCallback(() => {
    setSelectedMapAlert(null);
    setSelectedMapAlertType(null);
  }, []);

  // Handle delete from map alert modal
  const handleDeleteMapAlert = useCallback(async () => {
    if (!selectedMapAlert || !selectedMapAlertType) return;
    
    setIsDeletingMapAlert(true);
    try {
      let success = false;
      if (selectedMapAlertType === 'panic') {
        success = await resolveEvent(selectedMapAlert.id);
      } else {
        success = await resolveRequest(selectedMapAlert.id);
      }
      
      if (success) {
        handleCloseAlertFromMap();
      }
    } finally {
      setIsDeletingMapAlert(false);
    }
  }, [selectedMapAlert, selectedMapAlertType, resolveEvent, resolveRequest, handleCloseAlertFromMap]);

  // Default center (Mexico City)
  const defaultCenter: [number, number] = [19.4326, -99.1332];

  // Center map on user's location - with iOS-friendly fallback and multiple retries
  const centerOnMe = useCallback(async () => {
    if (!mapInstanceRef.current) return;
    
    // If we have a recent position (< 60s old), use it immediately
    const isRecent = position?.timestamp && (Date.now() - position.timestamp) < 60000;
    if (position && isRecent) {
      mapInstanceRef.current.setView([position.lat, position.lng], 16, { animate: true });
      toast.success('Centrado en tu ubicación');
      return;
    }
    
    // For iOS: Try multiple approaches sequentially
    toast.info('Obteniendo ubicación...', { id: 'center-gps', duration: 20000 });
    
    // Attempt 1: High accuracy with short timeout
    const tryGetPosition = (enableHighAccuracy: boolean, timeout: number, maximumAge: number): Promise<GeoPosition> => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              heading: pos.coords.heading,
              speed: pos.coords.speed,
              timestamp: pos.timestamp,
            });
          },
          (err) => reject(err),
          { enableHighAccuracy, timeout, maximumAge }
        );
      });
    };

    try {
      // Try 1: Fast high-accuracy (10s timeout)
      const pos = await tryGetPosition(true, 10000, 30000);
      toast.dismiss('center-gps');
      mapInstanceRef.current?.setView([pos.lat, pos.lng], 16, { animate: true });
      toast.success('Ubicación encontrada');
      return;
    } catch (e1) {
      console.log('[centerOnMe] Attempt 1 failed, trying low accuracy...', e1);
    }

    let lastError: GeolocationPositionError | null = null;
    
    try {
      // Try 2: Low accuracy with cached position allowed (15s timeout)
      const pos = await tryGetPosition(false, 15000, 120000);
      toast.dismiss('center-gps');
      mapInstanceRef.current?.setView([pos.lat, pos.lng], 16, { animate: true });
      toast.success('Ubicación encontrada (aproximada)');
      return;
    } catch (e2) {
      lastError = e2 as GeolocationPositionError;
      console.log('[centerOnMe] Attempt 2 failed', e2);
    }

    // Both attempts failed
    toast.dismiss('center-gps');
    
    // Provide specific guidance based on error
    const code = lastError?.code;
    
    if (code === 1) {
      toast.error('Permiso de ubicación denegado', {
        description: 'Ve a Configuración > Safari > Sitios web > Ubicación y permite el acceso.'
      });
    } else if (code === 2) {
      toast.error('GPS no disponible', {
        description: 'Asegúrate de tener el GPS activado y buena señal.'
      });
    } else {
      toast.error('No se pudo obtener tu ubicación', {
        description: 'Intenta de nuevo o verifica permisos en Ajustes > Privacidad > Ubicación > Safari'
      });
    }
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
      
      // Calculate time since last update FIRST (needed for icon badge)
      let updatedAgo = '';
      if (loc.updated_at) {
        const updatedDate = new Date(loc.updated_at);
        const now = new Date();
        const diffMs = now.getTime() - updatedDate.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHrs = Math.floor(diffMin / 60);
        
        if (diffSec < 60) {
          updatedAgo = `${diffSec}s`;
        } else if (diffMin < 60) {
          updatedAgo = `${diffMin}m`;
        } else {
          updatedAgo = `${diffHrs}h`;
        }
      }
      
      // Priority: Transit > SOS Activo/EX-SOS > Familiar
      let icon;
      let roleLabel;
      let bgColor;
      let badgeColor;
      
      if (isInTransit) {
        icon = createTransitIcon(isMe, isMe ? undefined : updatedAgo);
        roleLabel = 'En tránsito';
        bgColor = '#f59e0b';
        badgeColor = '#f59e0b';
      } else if (isSosActivo) {
        icon = createRescatistaIcon(isMe, hasFirstAidKit, isMe ? undefined : updatedAgo);
        roleLabel = loc.role === 'SOS_ACTIVO' ? 'SOS ACTIVO' : 'EX-SOS';
        bgColor = loc.role === 'SOS_ACTIVO' ? '#22c55e' : '#3b82f6';
        badgeColor = loc.role === 'SOS_ACTIVO' ? '#22c55e' : '#3b82f6';
      } else {
        icon = createFamiliarIcon(isMe, hasFirstAidKit, isMe ? undefined : updatedAgo);
        roleLabel = 'FAMILIAR';
        bgColor = '#2e8b57';
        badgeColor = '#2e8b57';
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
      
      // Updated ago HTML (for popup, use "hace X" format)
      const updatedInfo = updatedAgo 
        ? `<div style="font-size: 10px; color: #888; margin-top: 4px;">⏱ Actualizado hace ${updatedAgo}</div>`
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

  // Draw transit routes for users in transit
  const transitRoutesRef = useRef<Map<string, L.Polyline>>(new Map());
  
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Get users in transit (with or without destination coordinates)
    const transitUsers = locations.filter(loc => loc.is_in_transit);

    // Remove old transit routes and markers
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
      const existingOriginMarker = markersRef.current.get(`${key}-origin`);
      const existingDestMarker = markersRef.current.get(`${key}-dest`);
      
      const userPos: [number, number] = [loc.lat, loc.lng];
      const hasDestCoords = loc.transit_destination_lat && loc.transit_destination_lng;
      const hasOriginCoords = (loc as any).transit_origin_lat && (loc as any).transit_origin_lng;
      
      // Determine route points
      let routePoints: [number, number][] = [];
      let originPos: [number, number] | null = null;
      let destPos: [number, number] | null = null;
      
      if (hasOriginCoords) {
        originPos = [(loc as any).transit_origin_lat, (loc as any).transit_origin_lng];
      }
      if (hasDestCoords) {
        destPos = [loc.transit_destination_lat!, loc.transit_destination_lng!];
      }
      
      // Build route: origin -> current position -> destination
      if (originPos) routePoints.push(originPos);
      routePoints.push(userPos);
      if (destPos) routePoints.push(destPos);

      // Only draw if we have at least 2 points
      if (routePoints.length >= 2) {
        if (existingRoute) {
          existingRoute.setLatLngs(routePoints);
        } else {
          // Create dashed line for the route
          const polyline = L.polyline(routePoints, {
            color: '#f59e0b',
            weight: 3,
            opacity: 0.7,
            dashArray: '10, 10',
            lineCap: 'round',
          }).addTo(map);
          
          transitRoutesRef.current.set(key, polyline);
        }
        
        // Add origin marker if we have origin coords
        if (originPos && !existingOriginMarker) {
          const originMarker = L.marker(originPos, {
            icon: L.divIcon({
              className: 'transit-origin-marker',
              html: `
                <div style="
                  width: 20px;
                  height: 20px;
                  background: #22c55e;
                  border: 2px solid #0a0a0a;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                ">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3">
                    <circle cx="12" cy="12" r="8"/>
                  </svg>
                </div>
              `,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
            zIndexOffset: 90,
          }).addTo(map);

          const displayName = loc.display_name ? sanitize(loc.display_name) : 'Usuario';
          const originName = (loc as any).transit_origin ? sanitize((loc as any).transit_origin) : 'Origen';
          
          originMarker.bindPopup(`
            <div style="text-align: center; padding: 4px;">
              <div style="font-size: 12px; font-weight: 600; color: #22c55e;">🚀 Origen</div>
              <div style="font-size: 14px; font-weight: 500; margin-top: 4px;">${originName}</div>
              <div style="font-size: 11px; color: #666; margin-top: 2px;">
                Viaje de ${displayName}
              </div>
            </div>
          `);
          
          markersRef.current.set(`${key}-origin`, originMarker);
        }
        
        // Add destination marker if we have destination coords
        if (destPos && !existingDestMarker) {
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
          const etaText = (loc as any).transit_eta 
            ? new Date((loc as any).transit_eta).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
            : null;
          
          destMarker.bindPopup(`
            <div style="text-align: center; padding: 4px;">
              <div style="font-size: 12px; font-weight: 600; color: #f59e0b;">📍 Destino</div>
              <div style="font-size: 14px; font-weight: 500; margin-top: 4px;">${destName}</div>
              ${etaText ? `<div style="font-size: 11px; color: #f59e0b; margin-top: 2px;">ETA: ${etaText}</div>` : ''}
              <div style="font-size: 11px; color: #666; margin-top: 2px;">
                Viaje de ${displayName}
              </div>
            </div>
          `);
          
          markersRef.current.set(`${key}-dest`, destMarker);
        }
      } else if (existingRoute) {
        // Remove route if we no longer have enough points
        map.removeLayer(existingRoute);
        transitRoutesRef.current.delete(key);
      }
    });

    // Clean up origin and destination markers for removed routes
    markersRef.current.forEach((marker, key) => {
      if (key.includes('transit-route-') && (key.endsWith('-dest') || key.endsWith('-origin'))) {
        const routeKey = key.replace('-dest', '').replace('-origin', '');
        if (!transitRoutesRef.current.has(routeKey)) {
          map.removeLayer(marker);
          markersRef.current.delete(key);
        }
      }
    });
  }, [locations, mapReady]);

  // Draw community active trips routes (for trips without realtime location)
  const communityTripsRoutesRef = useRef<Map<string, L.Polyline>>(new Map());
  
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Get user IDs that already have realtime transit routes displayed
    const usersWithRealtimeTransit = new Set(
      locations.filter(loc => loc.is_in_transit).map(loc => loc.user_id)
    );

    // Filter active trips that don't have realtime location and have both origin/destination coords
    const tripsToShow = activeTrips.filter(trip => 
      !usersWithRealtimeTransit.has(trip.user_id) &&
      trip.origin_lat && trip.origin_lng &&
      trip.destination_lat && trip.destination_lng
    );

    // Remove old community trip routes
    communityTripsRoutesRef.current.forEach((polyline, key) => {
      if (!tripsToShow.find(t => `community-trip-${t.id}` === key)) {
        map.removeLayer(polyline);
        communityTripsRoutesRef.current.delete(key);
        // Remove associated markers
        const originKey = `${key}-origin`;
        const destKey = `${key}-dest`;
        if (markersRef.current.has(originKey)) {
          map.removeLayer(markersRef.current.get(originKey)!);
          markersRef.current.delete(originKey);
        }
        if (markersRef.current.has(destKey)) {
          map.removeLayer(markersRef.current.get(destKey)!);
          markersRef.current.delete(destKey);
        }
      }
    });

    // Add/update community trip routes
    tripsToShow.forEach((trip) => {
      const key = `community-trip-${trip.id}`;
      const existingRoute = communityTripsRoutesRef.current.get(key);
      const existingOriginMarker = markersRef.current.get(`${key}-origin`);
      const existingDestMarker = markersRef.current.get(`${key}-dest`);

      const originPos: [number, number] = [trip.origin_lat!, trip.origin_lng!];
      const destPos: [number, number] = [trip.destination_lat!, trip.destination_lng!];
      const routePoints: [number, number][] = [originPos, destPos];

      const displayName = trip.nickname || 'Usuario';
      const transitType = trip.transit_type === 'FLIGHT' ? '✈️' : '🚗';
      const etaText = new Date(trip.eta).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      const etaDate = new Date(trip.eta).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

      // Build detailed popup content for route
      const vehicleInfo = trip.vehicle_type ? `<div style="font-size: 11px; margin-top: 4px;">🚙 ${sanitize(trip.vehicle_type)}</div>` : '';
      const platesInfo = trip.plates ? `<div style="font-size: 11px; color: #666;">Placas: <strong>${sanitize(trip.plates)}</strong></div>` : '';
      const companionsInfo = trip.companions ? `<div style="font-size: 11px; color: #666; margin-top: 4px;">👥 ${sanitize(trip.companions)}</div>` : '';
      const flightInfo = trip.transit_type === 'FLIGHT' && trip.airline 
        ? `<div style="font-size: 11px; margin-top: 4px;">✈️ ${sanitize(trip.airline)} ${trip.flight_number ? sanitize(trip.flight_number) : ''}</div>` 
        : '';

      const routePopupContent = `
        <div style="min-width: 180px; padding: 4px;">
          <div style="font-size: 14px; font-weight: 600; color: #f59e0b; margin-bottom: 6px;">
            ${transitType} Viaje Activo
          </div>
          <div style="font-size: 13px; font-weight: 500;">${sanitize(displayName)}</div>
          <div style="font-size: 12px; color: #666; margin-top: 6px;">
            <div>📍 <strong>De:</strong> ${sanitize(trip.origin)}</div>
            <div style="margin-top: 2px;">🎯 <strong>A:</strong> ${sanitize(trip.destination)}</div>
          </div>
          <div style="font-size: 12px; color: #f59e0b; font-weight: 600; margin-top: 8px;">
            ⏰ ETA: ${etaText} (${etaDate})
          </div>
          ${vehicleInfo}
          ${platesInfo}
          ${flightInfo}
          ${companionsInfo}
        </div>
      `;

      // Create or update route polyline
      if (existingRoute) {
        existingRoute.setLatLngs(routePoints);
        existingRoute.setPopupContent(routePopupContent);
      } else {
        const polyline = L.polyline(routePoints, {
          color: '#f59e0b',
          weight: 5,
          opacity: 0.6,
          dashArray: '8, 12',
          lineCap: 'round',
        }).addTo(map);
        
        // Add popup to polyline
        polyline.bindPopup(routePopupContent);
        
        communityTripsRoutesRef.current.set(key, polyline);
      }

      // Add origin marker if not exists
      if (!existingOriginMarker) {
        const originMarker = L.marker(originPos, {
          icon: L.divIcon({
            className: 'community-trip-origin-marker',
            html: `
              <div style="
                width: 18px;
                height: 18px;
                background: #22c55e;
                border: 2px solid #fff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                opacity: 0.8;
              ">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3">
                  <circle cx="12" cy="12" r="6"/>
                </svg>
              </div>
            `,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
          zIndexOffset: 80,
        }).addTo(map);

        originMarker.bindPopup(`
          <div style="text-align: center; padding: 4px;">
            <div style="font-size: 11px; font-weight: 600; color: #22c55e;">🚀 Origen</div>
            <div style="font-size: 13px; font-weight: 500; margin-top: 2px;">${sanitize(trip.origin)}</div>
            <div style="font-size: 10px; color: #666; margin-top: 2px;">
              ${transitType} Viaje de ${sanitize(displayName)}
            </div>
          </div>
        `);

        markersRef.current.set(`${key}-origin`, originMarker);
      }

      // Add destination marker if not exists
      if (!existingDestMarker) {
        const destMarker = L.marker(destPos, {
          icon: L.divIcon({
            className: 'community-trip-dest-marker',
            html: `
              <div style="
                width: 22px;
                height: 22px;
                background: #f59e0b;
                border: 2px solid #fff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                opacity: 0.9;
              ">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/>
                  <circle cx="12" cy="10" r="2" fill="#fff"/>
                </svg>
              </div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          zIndexOffset: 85,
        }).addTo(map);

        destMarker.bindPopup(`
          <div style="text-align: center; padding: 4px;">
            <div style="font-size: 11px; font-weight: 600; color: #f59e0b;">📍 Destino</div>
            <div style="font-size: 13px; font-weight: 500; margin-top: 2px;">${sanitize(trip.destination)}</div>
            <div style="font-size: 10px; color: #f59e0b; margin-top: 2px;">ETA: ${etaText}</div>
            <div style="font-size: 10px; color: #666; margin-top: 2px;">
              ${transitType} Viaje de ${sanitize(displayName)}
            </div>
            ${trip.plates ? `<div style="font-size: 9px; color: #888; margin-top: 2px;">Placas: ${sanitize(trip.plates)}</div>` : ''}
          </div>
        `);

        markersRef.current.set(`${key}-dest`, destMarker);
      }
    });
  }, [activeTrips, locations, mapReady]);

  // Update help 14 markers - clicking opens detail modal
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
          .addTo(map);
        
        // Click opens the detail modal
        marker.on('click', () => {
          handleOpenAlertFromMap(req, 'help');
        });
        
        // Popup for quick info
        marker.bindPopup(`
          <div style="text-align: center; padding: 4px;">
            <div style="font-size: 16px; font-weight: bold; color: #ef4444;">⚠️ AYUDA 14</div>
            <div style="font-size: 11px; color: #666; margin-top: 4px;">
              ${new Date(req.created_at).toLocaleTimeString()}
            </div>
            ${req.message ? `<div style="font-size: 13px; margin-top: 8px;">${sanitize(req.message)}</div>` : ''}
            <div style="font-size: 12px; color: #3b82f6; margin-top: 8px;">
              Toca para ver detalles
            </div>
          </div>
        `);
        
        markersRef.current.set(key, marker);
      }
    });
  }, [helpRequests, mapReady, handleOpenAlertFromMap]);

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

  // Update panic event markers - clicking opens detail modal
  // Now shows responder count badge and updates when responders change
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Collect responder names per panic event
    // Build responder info per panic event including transport mode, ETA, and arrival status
    const respondersPerEvent = new Map<string, { infos: ResponderInfo[]; names: string[]; count: number }>();
    activeResponders.forEach(r => {
      // Check if this responder is for a panic event
      if (panicEvents.some(e => e.id === r.request_id)) {
        const current = respondersPerEvent.get(r.request_id) || { infos: [], names: [], count: 0 };
        current.infos.push({
          name: r.responder_name,
          transport_mode: r.transport_mode,
          eta_minutes: r.estimated_eta_minutes ?? r.eta_minutes,
          arrived: !!r.arrived_at,
        });
        current.names.push(r.responder_name);
        current.count++;
        respondersPerEvent.set(r.request_id, current);
      }
    });

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
      const responderInfo = respondersPerEvent.get(event.id) || { infos: [], names: [], count: 0 };
      const responderInfos = responderInfo.infos;
      const responderNames = responderInfo.names;

      const typeLabels: Record<string, string> = {
        'AMBULANCIA_PROPIA': '🚑 Ambulancia para mí',
        'AMBULANCIA_TERCERO': '🚑 Ambulancia Tercero',
        'PATRULLA': '🚔 Patrulla',
        'MECANICO': '🔧 Mecánico',
        'PROTECCION_CIVIL': '🆘 Protección Civil',
      };
      const label = typeLabels[event.panic_type] || '🆘 Emergencia';
      
      // Build responder status with names
      let responderStatus: string;
      if (responderNames.length > 0) {
        const namesList = responderNames.length > 2 
          ? `${responderNames.slice(0, 2).join(', ')} +${responderNames.length - 2} más`
          : responderNames.join(', ');
        responderStatus = `<div style="font-size: 12px; color: #22c55e; font-weight: bold; margin-top: 6px;">
            🚨 En camino: ${namesList}
           </div>`;
      } else {
        responderStatus = '<div style="font-size: 11px; color: #f97316; margin-top: 6px;">⏳ Esperando respuesta...</div>';
      }

      const popupContent = `
        <div style="text-align: center; padding: 4px;">
          <div style="font-size: 16px; font-weight: bold; color: #ef4444;">⚠️ ALERTA SOS</div>
          <div style="font-size: 13px; margin-top: 4px;">${label}</div>
          ${responderStatus}
          <div style="font-size: 11px; color: #666; margin-top: 4px;">
            ${new Date(event.created_at).toLocaleTimeString()}
          </div>
          <div style="font-size: 12px; color: #3b82f6; margin-top: 8px; cursor: pointer;">
            Toca para ver detalles
          </div>
        </div>
      `;

      if (existingMarker) {
        existingMarker.setLatLng([event.lat, event.lng]);
        existingMarker.setIcon(createPanicIcon(event.panic_type, responderInfos));
        existingMarker.setPopupContent(popupContent);
      } else {
        const marker = L.marker([event.lat, event.lng], {
          icon: createPanicIcon(event.panic_type, responderInfos),
          zIndexOffset: 600,
        })
          .addTo(map);
        
        // Click opens the detail modal instead of popup
        marker.on('click', () => {
          handleOpenAlertFromMap(event, 'panic');
        });
        
        // Also add popup for quick info on hover/long press
        marker.bindPopup(popupContent);
        
        markersRef.current.set(key, marker);
      }
    });
  }, [panicEvents, activeResponders, mapReady, handleOpenAlertFromMap]);

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
      
      // Use responder name instead of generic label
      const responderLabel = totalResponders > 1 
        ? `${responder.responder_name} (${responderIndexForRequest}/${totalResponders})`
        : responder.responder_name;

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

      // Update or create responder marker with name, transport, and ETA
      const responderMarkerInfo: ResponderMarkerInfo = {
        name: responder.responder_name,
        transport_mode: responder.transport_mode,
        eta_minutes: responder.estimated_eta_minutes ?? responder.eta_minutes,
        arrived: !!responder.arrived_at,
      };
      
      if (existingMarker) {
        existingMarker.setLatLng(responderLatLng);
        existingMarker.setIcon(createResponderIcon(responderMarkerInfo));
        existingMarker.setPopupContent(popupContent);
      } else {
        const marker = L.marker(responderLatLng, {
          icon: createResponderIcon(responderMarkerInfo),
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
      {/* GPS Status Banner - helpful for iPhone debugging */}
      <GpsStatusBanner
        position={position}
        loading={locationLoading}
        error={locationError}
        watching={locationWatching}
        onRetry={getCurrentPosition}
        className="absolute top-2 left-2 right-2 z-[998]"
      />

      {/* No emergency contacts warning banner - only show after loading completes */}
      {!contactsLoading && !hasMinimumContacts && (
        <button
          onClick={onNavigateToSettings}
          className="absolute top-14 left-2 right-2 z-[999] bg-destructive/95 text-destructive-foreground p-3 rounded-lg shadow-lg border border-destructive/50 flex items-center gap-2 hover:bg-destructive transition-colors cursor-pointer text-left"
        >
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Sin contactos de emergencia</p>
            <p className="text-xs opacity-90">Toca aquí para agregar uno y usar el botón SOS</p>
          </div>
          <Users className="w-5 h-5 shrink-0 opacity-70" />
        </button>
      )}

      {/* Map container */}
      <div ref={mapRef} className="w-full h-full map-container" />

      {/* Active users count + center button + alerts panel */}
      <div className="map-fixed-header flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto">
          <MapControlsMenu 
            position={position}
            onCenterOnMe={centerOnMe}
            onRefreshLocations={refetchLocations}
            activeUsersCount={locations.length}
          />
        </div>
        
        {/* Alerts Panel Button */}
        <div className="pointer-events-auto">
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
      </div>

      {/* Map legend with POI toggles */}
      <MapLegend 
        poiVisibility={poiVisibility}
        onTogglePOI={handleTogglePOI}
        poisLoading={poisLoading}
        isNavigating={!!selectedMapAlert || usersPanelOpen}
      />

      {/* Active Users Panel */}
      <ActiveUsersPanel
        users={locations}
        onCenterOnUser={handleViewLocation}
        onMessageUser={handleMessageUser}
        onOpenChange={setUsersPanelOpen}
      />

      {/* Internal Messaging Modal */}
      {messagingOpen && (
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
      )}


      {/* Alert Detail Modal - opened from map markers */}
      <AlertDetailModal
        alert={selectedMapAlert}
        alertType={selectedMapAlertType}
        isOpen={!!selectedMapAlert}
        onClose={handleCloseAlertFromMap}
        onViewLocation={handleViewLocation}
        onDelete={handleDeleteMapAlert}
        isDeleting={isDeletingMapAlert}
        isOwner={selectedMapAlert?.user_id === currentUserId}
        isRescatista={isRescatista}
        canDelete={selectedMapAlert?.user_id === currentUserId}
        responders={activeResponders}
        currentUserId={currentUserId}
        userPosition={position}
        onRespond={handleRespondToRequest}
        onCancelResponse={handleCancelResponse}
        onMarkAsArrived={handleMarkAsArrived}
        onResolve={handleMarkAsResolved}
        onUpdateTransport={handleUpdateTransport}
        onOpenMessaging={handleMessageUser}
      />
    </div>
  );
};

export default MapScreen;
