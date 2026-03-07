// Celda individual de video: iframe multi-fuente + overlay + controles

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Camera } from './types';
import { CameraOff, Volume2, VolumeX, Maximize2, Plus, ExternalLink, RefreshCw } from 'lucide-react';

interface VideoCellProps {
  camera: Camera | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onExpand: () => void;
  onAdd: () => void;
  onRemove: () => void;
}

const LOAD_TIMEOUT = 15000; // 15s

const VideoCell: React.FC<VideoCellProps> = ({
  camera,
  isMuted,
  onToggleMute,
  onExpand,
  onAdd,
  onRemove,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // Reset state when camera changes
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (camera?.embedUrl) {
      timeoutRef.current = setTimeout(() => {
        // After timeout, just stop showing loading (iframe may still work)
        setIsLoading(false);
      }, LOAD_TIMEOUT);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [camera?.id]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
  }, []);

  // Sin cámara asignada
  if (!camera) {
    return (
      <div className="relative w-full h-full bg-[#0a0a0a] flex items-center justify-center border border-[#222]">
        <button
          onClick={onAdd}
          className="flex flex-col items-center gap-2 text-[#555] hover:text-[#00ff88] transition-colors"
        >
          <Plus className="w-8 h-8" />
          <span className="font-mono text-xs uppercase tracking-wider">Agregar cámara</span>
        </button>
      </div>
    );
  }

  // Tipo external_url — solo placeholder con botón
  if (camera.sourceType === 'external_url') {
    return (
      <div className="relative w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center border border-[#222] gap-3">
        <CameraOff className="w-8 h-8 text-[#444]" />
        <span className="font-mono text-xs text-[#888] text-center px-2">{camera.name}</span>
        {camera.externalUrl && (
          <a
            href={camera.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00ff88]/20 text-[#00ff88] font-mono text-[11px] uppercase tracking-wider hover:bg-[#00ff88]/30 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Ver en vivo →
          </a>
        )}
        {/* Botón cambiar cámara */}
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-black/70 flex items-center justify-between">
          <span className="font-mono text-[10px] text-[#888] truncate">
            {camera.city}, {camera.country}
          </span>
          <button
            onClick={onAdd}
            className="font-mono text-[10px] text-white/80 hover:text-[#00ff88] uppercase tracking-wider px-2 py-0.5 bg-white/10 hover:bg-white/20 transition-colors"
          >
            Cambiar cámara
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (hasError || !camera.embedUrl) {
    return (
      <div className="relative w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center border border-[#222] gap-2">
        <CameraOff className="w-8 h-8 text-[#444]" />
        <span className="font-mono text-xs text-[#555] uppercase tracking-wider">Sin señal</span>
        <div className="flex gap-2 mt-1">
          {camera.embedUrl && (
            <button
              onClick={handleRetry}
              className="flex items-center gap-1 px-2 py-1 bg-[#222] text-[#aaa] font-mono text-[10px] hover:text-white transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Reintentar
            </button>
          )}
          {camera.externalUrl && (
            <a
              href={camera.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 bg-[#222] text-[#aaa] font-mono text-[10px] hover:text-[#00ff88] transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Ver en navegador
            </a>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-black/70 flex items-center justify-between">
          <span className="font-mono text-[10px] text-[#888] truncate">
            {camera.city}, {camera.country}
          </span>
          <button
            onClick={onAdd}
            className="font-mono text-[10px] text-white/80 hover:text-[#00ff88] uppercase tracking-wider px-2 py-0.5 bg-white/10 hover:bg-white/20 transition-colors"
          >
            Cambiar cámara
          </button>
        </div>
      </div>
    );
  }

  // Feed activo — construir URL del iframe según sourceType
  let iframeSrc = camera.embedUrl;
  // Para YouTube, manejar mute dinámicamente
  if (camera.sourceType === 'youtube' || camera.sourceType === 'youtube_channel') {
    const muteVal = isMuted ? '1' : '0';
    iframeSrc = camera.embedUrl.replace(/mute=1/, `mute=${muteVal}`);
  }

  return (
    <div className="relative w-full h-full bg-black border border-[#222] overflow-hidden group">
      {/* iframe */}
      <iframe
        key={hasError ? 'retry' : camera.id}
        src={iframeSrc}
        className="absolute inset-0 w-full h-full"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        onError={handleError}
        onLoad={handleLoad}
        title={`${camera.name} - ${camera.city}`}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-[#0a0a0a] flex items-center justify-center z-5">
          <div className="w-5 h-5 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin" />
        </div>
      )}

      {/* Indicador EN VIVO */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/60 px-1.5 py-0.5 z-10">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ff2222] animate-pulse" />
        <span className="font-mono text-[9px] text-[#ff2222] font-bold uppercase tracking-widest">
          En vivo
        </span>
      </div>

      {/* Controles hover */}
      <div className="absolute top-1.5 left-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {(camera.sourceType === 'youtube' || camera.sourceType === 'youtube_channel') && (
          <button
            onClick={onToggleMute}
            className="bg-black/60 p-1 text-white/70 hover:text-[#00ff88]"
            title={isMuted ? 'Activar sonido' : 'Silenciar'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          onClick={onExpand}
          className="bg-black/60 p-1 text-white/70 hover:text-[#00ff88]"
          title="Pantalla completa"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Barra inferior: ciudad + CAMBIAR CÁMARA */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-black/70 flex items-center justify-between z-10">
        <span className="font-mono text-[10px] text-[#ccc] truncate">
          {camera.city}, {camera.country}
        </span>
        <button
          onClick={onAdd}
          className="font-mono text-[10px] text-white/80 hover:text-[#00ff88] uppercase tracking-wider px-2 py-0.5 bg-white/10 hover:bg-white/20 transition-colors shrink-0 ml-1"
        >
          Cambiar cámara
        </button>
      </div>
    </div>
  );
};

export default VideoCell;
