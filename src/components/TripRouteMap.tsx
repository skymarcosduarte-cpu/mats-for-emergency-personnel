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
  /** Estimated route coordinates (purple dashed line) */
  estimatedRouteCoordinates?: [number, number][];
  originCoords?: { lat: number; lng: number } | null;
  destinationCoords?: { lat: number; lng: number } | null;
  currentPosition?: { lat: number; lng: number } | null;
  /** Last known real position before estimation started */
  lastRealPosition?: { lat: number; lng: number } | null;
  originName?: string;
  destinationName?: string;
  className?: string;
  height?: string;
  /** Show legend for route types */
  showLegend?: boolean;
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
  estimatedRouteCoordinates,
  originCoords,
  destinationCoords,
  currentPosition,
  lastRealPosition,
  originName = "Origen",
  destinationName = "Destino",
  className,
  height = "300px",
  showLegend = false,
}: TripRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const estimatedRouteRef = useRef<L.Polyline | null>(null);
  const estimationConnectorRef = useRef<L.Polyline | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const currentMarkerRef = useRef<L.Marker | null>(null);
  const lastRealMarkerRef = useRef<L.Marker | null>(null);

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

  const safeEstimatedRouteCoordinates = useMemo(() => {
    const input = estimatedRouteCoordinates ?? [];
    const filtered = input.filter(([lat, lng]) => isValidLatLng(lat, lng));
    return filtered;
  }, [estimatedRouteCoordinates]);

  const safeLastRealPosition = useMemo(
    () => (lastRealPosition && isValidLatLng(lastRealPosition.lat, lastRealPosition.lng) ? lastRealPosition : null),
    [lastRealPosition]
  );

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
    const all: [number, number][] = [...safeRouteCoordinates, ...safeEstimatedRouteCoordinates];
    if (safeOrigin) all.push([safeOrigin.lat, safeOrigin.lng]);
    if (safeDestination) all.push([safeDestination.lat, safeDestination.lng]);
    if (safeCurrent) all.push([safeCurrent.lat, safeCurrent.lng]);
    if (safeLastRealPosition) all.push([safeLastRealPosition.lat, safeLastRealPosition.lng]);
    return all;
  }, [safeRouteCoordinates, safeEstimatedRouteCoordinates, safeOrigin, safeDestination, safeCurrent, safeLastRealPosition]);

  const defaultCenter: [number, number] = useMemo(() => {
    if (safeCurrent) return [safeCurrent.lat, safeCurrent.lng];
    if (safeOrigin) return [safeOrigin.lat, safeOrigin.lng];
    if (safeRouteCoordinates.length > 0) return safeRouteCoordinates[0];
    return [19.4326, -99.1332];
  }, [safeCurrent, safeOrigin, safeRouteCoordinates]);

  const hasAnyData =
    safeRouteCoordinates.length > 0 || safeEstimatedRouteCoordinates.length > 0 || !!safeOrigin || !!safeDestination || !!safeCurrent;

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
      estimatedRouteRef.current = null;
      estimationConnectorRef.current = null;
      originMarkerRef.current = null;
      destMarkerRef.current = null;
      currentMarkerRef.current = null;
      lastRealMarkerRef.current = null;
      initialCenterRef.current = null;
    };
  // Empty deps - only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Update real route (blue solid line)
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
      routeRef.current.bindPopup("<strong>Ruta real</strong><br/>Posiciones GPS registradas");
    }

    // Update estimated route (purple dashed line)
    if (estimatedRouteRef.current) {
      estimatedRouteRef.current.remove();
      estimatedRouteRef.current = null;
    }
    if (safeEstimatedRouteCoordinates.length > 1) {
      estimatedRouteRef.current = L.polyline(safeEstimatedRouteCoordinates, {
        color: "#8b5cf6", // Purple
        weight: 4,
        opacity: 0.75,
        lineCap: "round",
        lineJoin: "round",
        dashArray: "8, 12",
      }).addTo(map);
      estimatedRouteRef.current.bindPopup("<strong>Ruta estimada</strong><br/>Posiciones interpoladas cuando GPS estaba inactivo");
    }

    // Connector line from last real position to start of estimated route
    if (estimationConnectorRef.current) {
      estimationConnectorRef.current.remove();
      estimationConnectorRef.current = null;
    }
    if (safeLastRealPosition && safeEstimatedRouteCoordinates.length > 0) {
      const firstEstimatedPoint = safeEstimatedRouteCoordinates[0];
      estimationConnectorRef.current = L.polyline(
        [[safeLastRealPosition.lat, safeLastRealPosition.lng], firstEstimatedPoint],
        {
          color: "#8b5cf6",
          weight: 2,
          opacity: 0.5,
          dashArray: "4, 8",
        }
      ).addTo(map);
    }

    // Last real position marker (where estimation started)
    if (lastRealMarkerRef.current) {
      lastRealMarkerRef.current.remove();
      lastRealMarkerRef.current = null;
    }
    if (safeLastRealPosition && safeEstimatedRouteCoordinates.length > 0) {
      const icon = L.divIcon({
        html: `<div style="
          background-color: #8b5cf6;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>`,
        className: "",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      lastRealMarkerRef.current = L.marker([safeLastRealPosition.lat, safeLastRealPosition.lng], { icon })
        .addTo(map)
        .bindPopup("<strong>Última posición real</strong><br/>GPS dejó de reportar aquí");
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
  }, [safeRouteCoordinates, safeEstimatedRouteCoordinates, safeLastRealPosition, safeOrigin, safeDestination, safeCurrent, originName, destinationName, pointsForBounds, defaultCenter]);

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

  const hasEstimatedRoute = safeEstimatedRouteCoordinates.length > 0;

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
      
      {/* Route legend */}
      {showLegend && (safeRouteCoordinates.length > 0 || hasEstimatedRoute) && (
        <div className="absolute bottom-2 left-2 z-20 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border text-xs">
          <div className="space-y-1">
            {safeRouteCoordinates.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-5 h-1 rounded-full" style={{ backgroundColor: hslVar("--primary", "#3b82f6") }} />
                <span className="text-muted-foreground">Ruta real (GPS)</span>
              </div>
            )}
            {hasEstimatedRoute && (
              <div className="flex items-center gap-2">
                <div className="w-5 h-0.5 rounded-full" style={{ 
                  backgroundColor: "#8b5cf6",
                  backgroundImage: "repeating-linear-gradient(90deg, #8b5cf6 0, #8b5cf6 4px, transparent 4px, transparent 8px)"
                }} />
                <span className="text-muted-foreground">Ruta estimada</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
