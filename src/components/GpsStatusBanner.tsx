// GPS Status Banner - Shows permission status, last position, and retry button
// Primarily useful for debugging iOS location issues

import React, { useState, useEffect } from 'react';
import { MapPin, RefreshCw, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { GeoPosition } from '@/types';

interface GpsStatusBannerProps {
  position: GeoPosition | null;
  loading: boolean;
  error: string | null;
  watching: boolean;
  onRetry: () => void;
  className?: string;
}

type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown' | 'checking';

export const GpsStatusBanner: React.FC<GpsStatusBannerProps> = ({
  position,
  loading,
  error,
  watching,
  onRetry,
  className,
}) => {
  const [permissionState, setPermissionState] = useState<PermissionState>('checking');
  const [retrying, setRetrying] = useState(false);

  // Check geolocation permission state
  useEffect(() => {
    const checkPermission = async () => {
      try {
        if ('permissions' in navigator) {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          setPermissionState(result.state as PermissionState);

          // Listen for permission changes
          result.onchange = () => {
            setPermissionState(result.state as PermissionState);
          };
        } else {
          // Fallback for browsers that don't support permissions API (like iOS Safari)
          // We infer from whether we have a position or an error
          if (position) {
            setPermissionState('granted');
          } else if (error?.includes('denegado') || error?.includes('denied')) {
            setPermissionState('denied');
          } else {
            setPermissionState('unknown');
          }
        }
      } catch {
        setPermissionState('unknown');
      }
    };

    checkPermission();
  }, [position, error]);

  // Update permission state based on position/error for iOS
  useEffect(() => {
    if (position && permissionState !== 'granted') {
      setPermissionState('granted');
    }
  }, [position, permissionState]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setTimeout(() => setRetrying(false), 1000);
    }
  };

  const formatLastUpdate = () => {
    if (!position?.timestamp) return null;
    const date = new Date(position.timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 10) return 'Ahora';
    if (diffSec < 60) return `Hace ${diffSec}s`;
    if (diffMin < 60) return `Hace ${diffMin}min`;
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  const getPermissionIcon = () => {
    switch (permissionState) {
      case 'granted':
        return <CheckCircle className="w-3.5 h-3.5 text-mats-green" />;
      case 'denied':
        return <XCircle className="w-3.5 h-3.5 text-destructive" />;
      case 'prompt':
        return <AlertTriangle className="w-3.5 h-3.5 text-warning" />;
      case 'checking':
        return <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />;
      default:
        return <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const getPermissionLabel = () => {
    switch (permissionState) {
      case 'granted':
        return 'Permitido';
      case 'denied':
        return 'Denegado';
      case 'prompt':
        return 'Pendiente';
      case 'checking':
        return 'Verificando...';
      default:
        return 'Desconocido';
    }
  };

  const hasError = !!error;
  const isActive = watching || loading;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
        hasError
          ? 'bg-destructive/10 border border-destructive/30'
          : position
          ? 'bg-mats-green/10 border border-mats-green/30'
          : 'bg-muted/50 border border-border',
        className
      )}
    >
      {/* GPS Icon with status */}
      <div className="flex items-center gap-1.5">
        <MapPin
          className={cn(
            'w-4 h-4',
            hasError
              ? 'text-destructive'
              : position
              ? 'text-mats-green'
              : 'text-muted-foreground'
          )}
        />
        <span className="font-medium text-foreground">GPS</span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-border" />

      {/* Permission status */}
      <div className="flex items-center gap-1">
        {getPermissionIcon()}
        <span className="text-muted-foreground">{getPermissionLabel()}</span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-border" />

      {/* Position / Error info */}
      <div className="flex-1 min-w-0 truncate">
        {loading ? (
          <span className="text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Obteniendo...
          </span>
        ) : error ? (
          <span className="text-destructive truncate">{error}</span>
        ) : position ? (
          <span className="text-muted-foreground">
            {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
            {position.accuracy && (
              <span className="ml-1 opacity-70">±{Math.round(position.accuracy)}m</span>
            )}
            {formatLastUpdate() && (
              <span className="ml-1 opacity-70">• {formatLastUpdate()}</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">Sin ubicación</span>
        )}
      </div>

      {/* Retry button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRetry}
        disabled={retrying || loading}
        className="h-6 px-2 text-xs"
      >
        <RefreshCw
          className={cn('w-3.5 h-3.5 mr-1', (retrying || loading) && 'animate-spin')}
        />
        {retrying ? 'Reintentando...' : 'Reintentar'}
      </Button>

      {/* Active indicator */}
      {isActive && !loading && (
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-mats-green animate-pulse" />
        </div>
      )}
    </div>
  );
};
