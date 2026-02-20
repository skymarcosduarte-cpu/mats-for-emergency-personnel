// GlobalHazardPanel - Shows international hazard alerts (tsunamis, volcanoes, storms, security)
// with map markers integration for MapScreen

import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import { AlertTriangle, ChevronDown, ChevronUp, X, ExternalLink, RefreshCw } from 'lucide-react';
import { useGDACSAlerts, GDACSAlert } from '@/hooks/useGDACSAlerts';
import { cn } from '@/lib/utils';

interface GlobalHazardPanelProps {
  map: L.Map | null;
  visible: boolean;
  onToggle: () => void;
}

// Category config: icon, colors
const CATEGORY_CONFIG: Record<string, { emoji: string; color: string; bgColor: string; label: string }> = {
  tsunami:     { emoji: '🌊', color: '#0ea5e9', bgColor: '#0ea5e9', label: 'Tsunami' },
  volcano:     { emoji: '🌋', color: '#f97316', bgColor: '#f97316', label: 'Volcán' },
  cyclone:     { emoji: '🌀', color: '#8b5cf6', bgColor: '#8b5cf6', label: 'Ciclón' },
  flood:       { emoji: '💧', color: '#3b82f6', bgColor: '#3b82f6', label: 'Inundación' },
  earthquake:  { emoji: '🌍', color: '#ef4444', bgColor: '#ef4444', label: 'Terremoto' },
  wildfire:    { emoji: '🔥', color: '#f59e0b', bgColor: '#f59e0b', label: 'Incendio' },
  security:    { emoji: '🛡️', color: '#dc2626', bgColor: '#dc2626', label: 'Seguridad' },
  humanitarian:{ emoji: '🆘', color: '#6366f1', bgColor: '#6366f1', label: 'Humanitario' },
  weather:     { emoji: '⛈️', color: '#64748b', bgColor: '#64748b', label: 'Clima' },
  other:       { emoji: '⚠️', color: '#9ca3af', bgColor: '#9ca3af', label: 'Otro' },
};

const ALERT_LEVEL_CONFIG = {
  red:    { border: 'border-red-500',    bg: 'bg-red-500/10',    text: 'text-red-500',    dot: 'bg-red-500',    label: 'ROJO' },
  orange: { border: 'border-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-500', dot: 'bg-orange-500', label: 'NARANJA' },
  green:  { border: 'border-green-500',  bg: 'bg-green-500/10',  text: 'text-green-500',  dot: 'bg-green-500',  label: 'VERDE' },
};

function createHazardMarkerIcon(category: GDACSAlert['category'], alertLevel?: GDACSAlert['alertLevel']): L.DivIcon {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
  const borderColor = alertLevel === 'red' ? '#ef4444' : alertLevel === 'orange' ? '#f97316' : '#6b7280';
  const pulse = alertLevel === 'red' || alertLevel === 'orange';

  return L.divIcon({
    className: 'hazard-marker',
    html: `
      <div style="position: relative; width: 36px; height: 36px;">
        ${pulse ? `<div style="
          position: absolute; top: 0; left: 0;
          width: 36px; height: 36px;
          background: ${borderColor}40;
          border-radius: 50%;
          animation: hazardPulse 1.5s ease-out infinite;
        "></div>` : ''}
        <div style="
          position: absolute; top: 4px; left: 4px;
          width: 28px; height: 28px;
          background: #1e293b;
          border: 2px solid ${borderColor};
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        ">${config.emoji}</div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const diff = Math.floor((now - then) / 1000 / 60);
  if (diff < 60) return `hace ${diff}m`;
  if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
  return `hace ${Math.floor(diff / 1440)}d`;
}

export const GlobalHazardPanel: React.FC<GlobalHazardPanelProps> = ({ map, visible, onToggle }) => {
  const {
    gdacsAlerts,
    loading,
    lastChecked,
    refresh,
    getCategoryIcon,
    getCategoryLabel,
    getAlertLevelColor,
  } = useGDACSAlerts();

  const hazardMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const [selectedAlert, setSelectedAlert] = useState<GDACSAlert | null>(null);
  const [activeFilter, setActiveFilter] = useState<GDACSAlert['category'] | 'all' | 'tsunami'>('all');

  // Add/update/remove hazard markers on the map
  useEffect(() => {
    if (!map) return;

    const currentKeys = new Set<string>();

    gdacsAlerts.forEach((alert) => {
      if (!alert.coordinates) return;
      const key = alert.id;
      currentKeys.add(key);

      const existing = hazardMarkersRef.current.get(key);
      if (existing) return; // already on map

      const icon = createHazardMarkerIcon(alert.category, alert.alertLevel);
      const config = CATEGORY_CONFIG[alert.category] || CATEGORY_CONFIG.other;
      const levelCfg = alert.alertLevel ? ALERT_LEVEL_CONFIG[alert.alertLevel] : null;

      const popup = `
        <div style="max-width:240px; font-family: system-ui, sans-serif;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
            <span style="font-size:20px;">${config.emoji}</span>
            <span style="font-weight:700; font-size:13px; color:#f1f5f9;">${alert.title.substring(0, 60)}${alert.title.length > 60 ? '…' : ''}</span>
          </div>
          ${alert.alertLevel ? `<div style="font-size:11px; font-weight:600; color:${levelCfg?.text || '#9ca3af'}; margin-bottom:4px;">⚠️ Nivel ${levelCfg?.label || alert.alertLevel}</div>` : ''}
          <div style="font-size:11px; color:#94a3b8; margin-bottom:4px;">${getCategoryLabel(alert.category)} · ${alert.source}</div>
          ${alert.country ? `<div style="font-size:11px; color:#94a3b8;">📍 ${alert.country}</div>` : ''}
          ${alert.link ? `<div style="margin-top:6px;"><a href="${alert.link}" target="_blank" style="font-size:11px; color:#60a5fa; text-decoration:underline;">Ver más →</a></div>` : ''}
        </div>
      `;

      const marker = L.marker(alert.coordinates, { icon })
        .addTo(map)
        .bindPopup(popup, { maxWidth: 260, className: 'hazard-popup' });

      hazardMarkersRef.current.set(key, marker);
    });

    // Remove stale markers
    hazardMarkersRef.current.forEach((marker, key) => {
      if (!currentKeys.has(key)) {
        map.removeLayer(marker);
        hazardMarkersRef.current.delete(key);
      }
    });
  }, [map, gdacsAlerts, getCategoryLabel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      hazardMarkersRef.current.forEach((marker) => {
        if (map) map.removeLayer(marker);
      });
      hazardMarkersRef.current.clear();
    };
  }, [map]);

  const filteredAlerts = activeFilter === 'all'
    ? gdacsAlerts
    : gdacsAlerts.filter(a => a.category === activeFilter);

  // Count by category for filter pills
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: gdacsAlerts.length };
    gdacsAlerts.forEach(a => {
      counts[a.category] = (counts[a.category] || 0) + 1;
    });
    return counts;
  }, [gdacsAlerts]);

  const handleFlyToAlert = useCallback((alert: GDACSAlert) => {
    if (!map || !alert.coordinates) return;
    map.flyTo(alert.coordinates, 5, { animate: true, duration: 1 });
    const marker = hazardMarkersRef.current.get(alert.id);
    if (marker) marker.openPopup();
  }, [map]);

  const redCount = gdacsAlerts.filter(a => a.alertLevel === 'red').length;

  return (
    <>
      {/* CSS for hazard pulse animation */}
      <style>{`
        @keyframes hazardPulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .hazard-popup .leaflet-popup-content-wrapper {
          background: #1e293b !important;
          border: 1px solid #334155 !important;
          border-radius: 8px !important;
          color: #f1f5f9 !important;
        }
        .hazard-popup .leaflet-popup-tip {
          background: #1e293b !important;
        }
      `}</style>

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className={cn(
          "fixed z-[1400] flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg transition-all active:scale-95 text-sm font-semibold",
          "bottom-36 right-4",
          redCount > 0
            ? "bg-red-600 text-white animate-pulse"
            : "bg-slate-800/90 text-slate-200 border border-slate-600",
        )}
        aria-label="Panel de alertas globales"
      >
        <AlertTriangle className="w-4 h-4" />
        <span>Riesgos</span>
        {gdacsAlerts.length > 0 && (
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded-full font-bold",
            redCount > 0 ? "bg-white text-red-600" : "bg-slate-600 text-white"
          )}>
            {gdacsAlerts.length}
          </span>
        )}
        {visible ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      {/* Panel */}
      {visible && (
        <div className="fixed bottom-[9rem] right-4 z-[1400] w-80 max-h-[55vh] flex flex-col rounded-xl shadow-2xl border border-slate-700 overflow-hidden bg-slate-900/95 backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-slate-100">Alertas Globales</span>
              {redCount > 0 && (
                <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                  {redCount} ROJO
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={refresh}
                disabled={loading}
                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                title="Actualizar"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              </button>
              <button
                onClick={onToggle}
                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sources info */}
          <div className="px-3 py-1.5 bg-slate-800/60 border-b border-slate-700/50 shrink-0">
            <p className="text-[10px] text-slate-500">GDACS (ONU/UE) · NASA EONET · NOAA Tsunami · USGS Volcanes · CONAGUA · ReliefWeb</p>
          </div>

          {/* Category filters */}
          <div className="flex gap-1.5 px-3 py-2 overflow-x-auto shrink-0 border-b border-slate-700/50">
            {(['all', 'tsunami', 'volcano', 'cyclone', 'flood', 'earthquake', 'wildfire', 'security'] as const).map(cat => {
              const count = categoryCounts[cat] || 0;
              if (cat !== 'all' && count === 0) return null;
              const cfg = cat === 'all' ? null : (CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other);
              return (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={cn(
                    "shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all",
                    activeFilter === cat
                      ? "bg-slate-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                  )}
                >
                  {cfg ? cfg.emoji : '🌐'} {cat === 'all' ? 'Todo' : cfg?.label} {count > 0 && <span className="text-xs opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Alert list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-700/50">
            {loading && filteredAlerts.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 text-slate-500 animate-spin" />
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-8 px-4">
                <AlertTriangle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Sin alertas activas</p>
              </div>
            ) : (
              filteredAlerts.map(alert => {
                const cfg = CATEGORY_CONFIG[alert.category] || CATEGORY_CONFIG.other;
                const levelCfg = alert.alertLevel ? ALERT_LEVEL_CONFIG[alert.alertLevel] : null;
                const hasCoords = !!alert.coordinates;

                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "px-3 py-2.5 cursor-pointer hover:bg-slate-800/60 transition-colors",
                      selectedAlert?.id === alert.id && "bg-slate-800"
                    )}
                    onClick={() => {
                      setSelectedAlert(prev => prev?.id === alert.id ? null : alert);
                      if (hasCoords) handleFlyToAlert(alert);
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Level dot */}
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-1.5 shrink-0",
                        levelCfg ? levelCfg.dot : "bg-slate-600"
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-sm">{cfg.emoji}</span>
                          <span className="text-xs font-semibold text-slate-300 truncate">{alert.title.substring(0, 55)}{alert.title.length > 55 ? '…' : ''}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-slate-500">{cfg.label}</span>
                          {alert.source && (
                            <span className="text-[10px] text-slate-600">· {alert.source}</span>
                          )}
                          {alert.country && (
                            <span className="text-[10px] text-slate-600">· {alert.country}</span>
                          )}
                          {alert.alertLevel && levelCfg && (
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", levelCfg.bg, levelCfg.text)}>
                              {levelCfg.label}
                            </span>
                          )}
                        </div>
                        {formatTimeAgo(alert.pubDate) && (
                          <p className="text-[10px] text-slate-600 mt-0.5">{formatTimeAgo(alert.pubDate)}</p>
                        )}
                        {/* Expanded detail */}
                        {selectedAlert?.id === alert.id && alert.description && (
                          <div className="mt-2 border-t border-slate-700 pt-2">
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              {alert.description.substring(0, 300)}{alert.description.length > 300 ? '…' : ''}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              {hasCoords && (
                                <span className="text-[10px] text-blue-400">📍 Geolocalizado en mapa</span>
                              )}
                              {alert.link && (
                                <a
                                  href={alert.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Ver fuente
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {lastChecked && (
            <div className="px-3 py-1.5 bg-slate-800/50 border-t border-slate-700/50 shrink-0">
              <p className="text-[10px] text-slate-600">
                Actualizado: {lastChecked.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
};
