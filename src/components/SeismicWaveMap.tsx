// Seismic Wave Propagation Map
// Shows concentric circles expanding from earthquake epicenter representing P and S waves

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, X, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { GeoPosition } from '@/types';

// Seismic wave velocities (km/s)
const P_WAVE_VELOCITY = 6.0; // Primary waves (fastest, less destructive)
const S_WAVE_VELOCITY = 3.5; // Secondary/Shear waves (slower, more destructive)

interface SeismicWaveMapProps {
  epicenterLat: number;
  epicenterLng: number;
  magnitude: number;
  earthquakeTime: number; // Unix timestamp in ms
  userPosition?: GeoPosition | null;
  onClose?: () => void;
  className?: string;
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Format time helper
function formatTime(seconds: number): string {
  if (seconds < 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export const SeismicWaveMap: React.FC<SeismicWaveMapProps> = ({
  epicenterLat,
  epicenterLng,
  magnitude,
  earthquakeTime,
  userPosition,
  onClose,
  className,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const pWaveCircleRef = useRef<L.Circle | null>(null);
  const sWaveCircleRef = useRef<L.Circle | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const isInitializedRef = useRef(false);
  
  const [waveState, setWaveState] = useState({
    elapsedSeconds: 0,
    pWaveRadiusKm: 0,
    sWaveRadiusKm: 0,
    pWaveReached: false,
    sWaveReached: false,
    sWaveWarning: false,
  });

  // Calculate user distance from epicenter - memoized once
  const userDistanceKm = useMemo(() => {
    if (!userPosition) return null;
    return calculateDistance(epicenterLat, epicenterLng, userPosition.lat, userPosition.lng);
  }, [epicenterLat, epicenterLng, userPosition]);

  // Calculate ETA for waves to reach user - memoized once
  const waveETAs = useMemo(() => {
    if (!userDistanceKm) return null;
    return {
      pWaveSeconds: userDistanceKm / P_WAVE_VELOCITY,
      sWaveSeconds: userDistanceKm / S_WAVE_VELOCITY,
    };
  }, [userDistanceKm]);

  // Store initial values in refs to avoid dependency changes
  const epicenterRef = useRef({ lat: epicenterLat, lng: epicenterLng });
  const magnitudeRef = useRef(magnitude);
  const userPositionRef = useRef(userPosition);
  const earthquakeTimeRef = useRef(earthquakeTime);
  const userDistanceKmRef = useRef(userDistanceKm);

  // Update refs when props change
  useEffect(() => {
    epicenterRef.current = { lat: epicenterLat, lng: epicenterLng };
    magnitudeRef.current = magnitude;
    userPositionRef.current = userPosition;
    earthquakeTimeRef.current = earthquakeTime;
    userDistanceKmRef.current = userDistanceKm;
  }, [epicenterLat, epicenterLng, magnitude, userPosition, earthquakeTime, userDistanceKm]);

  // Initialize map only once
  useEffect(() => {
    if (!mapRef.current || isInitializedRef.current) return;
    isInitializedRef.current = true;

    const { lat: eLat, lng: eLng } = epicenterRef.current;
    const mag = magnitudeRef.current;
    const userPos = userPositionRef.current;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([eLat, eLng], 6);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Add zoom control
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Add epicenter marker
    const epicenterIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-8 h-8 bg-destructive rounded-full animate-ping opacity-50"></div>
          <div class="relative w-6 h-6 bg-destructive rounded-full border-2 border-white flex items-center justify-center">
            <span class="text-white text-xs font-bold">${mag.toFixed(1)}</span>
          </div>
        </div>
      `,
      className: 'epicenter-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker([eLat, eLng], { icon: epicenterIcon })
      .addTo(map)
      .bindPopup(`<strong>Epicentro</strong><br/>Magnitud: ${mag.toFixed(1)}`);

    // Add user marker if position available
    if (userPos) {
      const userIcon = L.divIcon({
        html: `
          <div class="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg"></div>
        `,
        className: 'user-marker',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      L.marker([userPos.lat, userPos.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup('<strong>Tu ubicación</strong>');

      // Fit bounds to show both epicenter and user
      const bounds = L.latLngBounds([
        [eLat, eLng],
        [userPos.lat, userPos.lng],
      ]);
      map.fitBounds(bounds.pad(0.3));
    }

    // Create P-wave circle (blue, faster)
    pWaveCircleRef.current = L.circle([eLat, eLng], {
      radius: 0,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      weight: 2,
      dashArray: '5, 10',
    }).addTo(map);

    // Create S-wave circle (orange/red, slower but more destructive)
    sWaveCircleRef.current = L.circle([eLat, eLng], {
      radius: 0,
      color: '#f97316',
      fillColor: '#f97316',
      fillOpacity: 0.15,
      weight: 3,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
      isInitializedRef.current = false;
    };
  }, []); // Empty deps - initialize only once

  // Animation loop for wave propagation - with throttling
  useEffect(() => {
    let isCancelled = false;

    const animate = () => {
      if (isCancelled) return;

      const now = Date.now();
      
      // Throttle state updates to every 1000ms to reduce re-renders
      if (now - lastUpdateRef.current < 1000) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastUpdateRef.current = now;

      const quakeTime = earthquakeTimeRef.current;
      const elapsed = (now - quakeTime) / 1000; // seconds since earthquake

      // Calculate wave radii based on elapsed time
      const pRadius = elapsed * P_WAVE_VELOCITY; // km
      const sRadius = elapsed * S_WAVE_VELOCITY; // km

      // Update circles on map directly (no state update needed for this)
      if (pWaveCircleRef.current) {
        pWaveCircleRef.current.setRadius(pRadius * 1000);
      }
      if (sWaveCircleRef.current) {
        sWaveCircleRef.current.setRadius(sRadius * 1000);
      }

      // Check wave status relative to user
      const distKm = userDistanceKmRef.current;
      let pReached = false;
      let sReached = false;
      let sWarning = false;

      if (distKm) {
        pReached = pRadius >= distKm;
        sReached = sRadius >= distKm;
        
        // Warning when S-wave is about to reach (within 30 seconds)
        if (!sReached) {
          const timeToSWave = (distKm - sRadius) / S_WAVE_VELOCITY;
          sWarning = timeToSWave > 0 && timeToSWave <= 30;
        }
      }

      // Update state in a single batch
      setWaveState({
        elapsedSeconds: elapsed,
        pWaveRadiusKm: pRadius,
        sWaveRadiusKm: sRadius,
        pWaveReached: pReached,
        sWaveReached: sReached,
        sWaveWarning: sWarning,
      });

      // Continue animation for up to 30 minutes
      if (elapsed < 1800 && !isCancelled) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      isCancelled = true;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []); // Empty deps - runs once

  const { elapsedSeconds, pWaveRadiusKm, sWaveRadiusKm, pWaveReached, sWaveReached, sWaveWarning } = waveState;

  return (
    <div className={cn("relative w-full h-full min-h-[350px] bg-background rounded-lg overflow-hidden", className)}>
      {/* Map container */}
      <div ref={mapRef} className="absolute inset-0 z-0" />

      {/* Close button */}
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-20 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      )}

      {/* Wave status panel - combined with legend */}
      <div className="absolute top-2 left-2 z-20 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg max-w-[180px]">
        <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-warning" />
          Propagación de Ondas
        </div>
        
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tiempo:</span>
            <span className="font-mono font-bold">{formatTime(elapsedSeconds)}</span>
          </div>
          
          {/* P-Wave status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Onda P:</span>
            </div>
            <span className="font-mono">{pWaveRadiusKm.toFixed(0)} km</span>
          </div>
          
          {/* S-Wave status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">Onda S:</span>
            </div>
            <span className="font-mono">{sWaveRadiusKm.toFixed(0)} km</span>
          </div>

          {/* Legend integrated */}
          <div className="pt-1.5 mt-1.5 border-t border-border/50 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-blue-500 border-dashed" />
              <span className="text-muted-foreground">Onda P (rápida)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-orange-500" />
              <span className="text-muted-foreground">Onda S (fuerte)</span>
            </div>
          </div>
        </div>
      </div>

      {/* User distance and ETA panel - positioned to avoid overlap */}
      {userDistanceKm && waveETAs && (
        <div className="absolute bottom-12 left-2 right-2 z-20 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Tu distancia al epicentro:</span>
            <Badge variant="outline" className="font-mono text-xs">
              {userDistanceKm.toFixed(0)} km
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {/* P-Wave ETA */}
            <div className={cn(
              "p-2 rounded-lg border text-center",
              pWaveReached 
                ? "bg-blue-500/20 border-blue-500" 
                : "bg-muted/50 border-border"
            )}>
              <div className="text-xs text-muted-foreground">Onda P</div>
              <div className={cn(
                "text-sm font-bold",
                pWaveReached ? "text-blue-500" : "text-foreground"
              )}>
                {pWaveReached ? (
                  <span className="flex items-center justify-center gap-1">
                    ✓ Llegó
                  </span>
                ) : (
                  formatTime(waveETAs.pWaveSeconds - elapsedSeconds)
                )}
              </div>
            </div>
            
            {/* S-Wave ETA */}
            <div className={cn(
              "p-2 rounded-lg border text-center",
              sWaveReached 
                ? "bg-orange-500/20 border-orange-500" 
                : sWaveWarning
                ? "bg-destructive/20 border-destructive animate-pulse"
                : "bg-muted/50 border-border"
            )}>
              <div className="text-xs text-muted-foreground">Onda S (fuerte)</div>
              <div className={cn(
                "text-sm font-bold",
                sWaveReached 
                  ? "text-orange-500" 
                  : sWaveWarning 
                  ? "text-destructive"
                  : "text-foreground"
              )}>
                {sWaveReached ? (
                  <span className="flex items-center justify-center gap-1">
                    ✓ Llegó
                  </span>
                ) : (
                  formatTime(waveETAs.sWaveSeconds - elapsedSeconds)
                )}
              </div>
            </div>
          </div>

          {/* Warning banner */}
          {sWaveWarning && !sWaveReached && (
            <div className="mt-2 p-2 bg-destructive/20 border border-destructive rounded-lg flex items-center gap-2 animate-pulse">
              <Bell className="w-4 h-4 text-destructive" />
              <span className="text-xs font-semibold text-destructive">
                ¡Onda S llegando! Busca refugio
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
