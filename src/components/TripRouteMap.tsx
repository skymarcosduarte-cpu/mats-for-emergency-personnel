import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Loader2, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

/**
 * TripRouteMap
 * Imperative Leaflet implementation (no react-leaflet) to avoid runtime issues in some builds.
 */

interface TripRouteMapProps {
  routeCoordinates: [number, number][];
  originCoords?: { lat: number; lng: number } | null;
  destinationCoords?: { lat: number; lng: number } | null;
  currentPosition?: { lat: number; lng: number } | null;
  originName?: string;
  destinationName?: string;
  className?: string;
  height?: string;
}

const isFiniteNumber = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

const isValidLatLng = (lat: unknown, lng: unknown) =>
  isFiniteNumber(lat) &&
  isFiniteNumber(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180;

const hslVar = (cssVarName: string, fallback: string) => {
  try {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(cssVarName)
      .trim();
    return raw ? `hsl(${raw})` : fallback;
  } catch {
    return fallback;
  }
};

const createDotIcon = (bg: string, size = 22) =>
  L.divIcon({
    html: `<div style="
      background-color: ${bg};
      width: ${size}px;
      height: ${size}px;
      border-radius: 9999px;
      border: 3px solid ${hslVar("--background", "#ffffff")};
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
    "></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

export default function TripRouteMap({
  routeCoordinates,
  originCoords,
  destinationCoords,
  currentPosition,
  originName = "Origen",
  destinationName = "Destino",
  className,
  height = "300px",
}: TripRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const currentMarkerRef = useRef<L.Marker | null>(null);

  const [isMapReady, setIsMapReady] = useState(false);

  const safeRouteCoordinates = useMemo(() => {
    const input = routeCoordinates ?? [];
    const filtered = input.filter(([lat, lng]) => isValidLatLng(lat, lng));
    if (filtered.length !== input.length) {
      console.warn("[TripRouteMap] Dropped invalid route points", {
        total: input.length,
        valid: filtered.length,
      });
    }
    return filtered;
  }, [routeCoordinates]);

  const safeOrigin = useMemo(
    () => (originCoords && isValidLatLng(originCoords.lat, originCoords.lng) ? originCoords : null),
    [originCoords]
  );

  const safeDestination = useMemo(
    () =>
      destinationCoords && isValidLatLng(destinationCoords.lat, destinationCoords.lng)
        ? destinationCoords
        : null,
    [destinationCoords]
  );

  const safeCurrent = useMemo(
    () => (currentPosition && isValidLatLng(currentPosition.lat, currentPosition.lng) ? currentPosition : null),
    [currentPosition]
  );

  const pointsForBounds = useMemo(() => {
    const all: [number, number][] = [...safeRouteCoordinates];
    if (safeOrigin) all.push([safeOrigin.lat, safeOrigin.lng]);
    if (safeDestination) all.push([safeDestination.lat, safeDestination.lng]);
    if (safeCurrent) all.push([safeCurrent.lat, safeCurrent.lng]);
    return all;
  }, [safeRouteCoordinates, safeOrigin, safeDestination, safeCurrent]);

  const defaultCenter: [number, number] = useMemo(() => {
    if (safeCurrent) return [safeCurrent.lat, safeCurrent.lng];
    if (safeOrigin) return [safeOrigin.lat, safeOrigin.lng];
    if (safeRouteCoordinates.length > 0) return safeRouteCoordinates[0];
    return [19.4326, -99.1332];
  }, [safeCurrent, safeOrigin, safeRouteCoordinates]);

  const hasAnyData =
    safeRouteCoordinates.length > 0 || !!safeOrigin || !!safeDestination || !!safeCurrent;

  // Store initial center to avoid re-creating map on data changes
  const initialCenterRef = useRef<[number, number] | null>(null);
  if (!initialCenterRef.current && hasAnyData) {
    initialCenterRef.current = defaultCenter;
  }

  useEffect(() => {
    if (!containerRef.current) return;
    // Prevent multiple initializations
    if (mapRef.current) return;

    setIsMapReady(false);

    const center = initialCenterRef.current || defaultCenter;
    const map = L.map(containerRef.current, {
      center,
      zoom: 13,
      zoomControl: false,
    });

    mapRef.current = map;

    const tile = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    });

    tile.on("load", () => setIsMapReady(true));
    tile.addTo(map);
    tileRef.current = tile;

    // Ensure proper sizing inside dialogs
    const t = window.setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 80);

    const container = containerRef.current;
    const ro = new ResizeObserver(() => {
      try {
        map.invalidateSize();
      } catch {}
    });
    ro.observe(container);

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      routeRef.current = null;
      originMarkerRef.current = null;
      destMarkerRef.current = null;
      currentMarkerRef.current = null;
      initialCenterRef.current = null;
    };
  // Empty deps - only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Update route
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }
    if (safeRouteCoordinates.length > 1) {
      const routeColor = hslVar("--primary", "#3b82f6");
      routeRef.current = L.polyline(safeRouteCoordinates, {
        color: routeColor,
        weight: 4,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    }

    // Origin marker
    if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }
    if (safeOrigin) {
      const icon = createDotIcon(hslVar("--safe", "#22c55e"), 20);
      originMarkerRef.current = L.marker([safeOrigin.lat, safeOrigin.lng], { icon })
        .addTo(map)
        .bindPopup(`<strong>Origen</strong><br/>${originName}`);
    }

    // Destination marker
    if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
    if (safeDestination) {
      const icon = createDotIcon(hslVar("--destructive", "#ef4444"), 20);
      destMarkerRef.current = L.marker([safeDestination.lat, safeDestination.lng], { icon })
        .addTo(map)
        .bindPopup(`<strong>Destino</strong><br/>${destinationName}`);
    }

    // Current marker
    if (currentMarkerRef.current) {
      currentMarkerRef.current.remove();
      currentMarkerRef.current = null;
    }
    if (safeCurrent) {
      const icon = createDotIcon(hslVar("--primary", "#3b82f6"), 24);
      currentMarkerRef.current = L.marker([safeCurrent.lat, safeCurrent.lng], { icon })
        .addTo(map)
        .bindPopup("<strong>Posición actual</strong>");
    }

    // Fit bounds / set view
    try {
      if (pointsForBounds.length >= 2) {
        const bounds = L.latLngBounds(pointsForBounds.map(([lat, lng]) => L.latLng(lat, lng)));
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
        }
      } else {
        map.setView(defaultCenter, 13, { animate: false });
      }
    } catch (err) {
      console.warn("[TripRouteMap] Error fitting bounds", err);
    }
  }, [safeRouteCoordinates, safeOrigin, safeDestination, safeCurrent, originName, destinationName, pointsForBounds, defaultCenter]);

  if (!hasAnyData) {
    return (
      <div className={cn("flex items-center justify-center bg-muted rounded-lg", className)} style={{ height }}>
        <div className="text-center text-muted-foreground">
          <Navigation className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No hay datos de ubicación válidos</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("rounded-lg overflow-hidden border relative", className)}
      style={{ height, background: "hsl(var(--muted))" }}
    >
      {!isMapReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs">Cargando mapa...</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
