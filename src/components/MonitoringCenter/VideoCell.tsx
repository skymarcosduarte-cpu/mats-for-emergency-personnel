// Celda individual de video: iframe + overlay + controles

import React, { useState, useCallback } from 'react';
import { Camera } from './types';
import { CameraOff, Volume2, VolumeX, Maximize2, Plus, X } from 'lucide-react';

interface VideoCellProps {
  camera: Camera | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onExpand: () => void;
  onAdd: () => void;
  onRemove: () => void;
}

const IFRAME_PARAMS = 'autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1';

const VideoCell: React.FC<VideoCellProps> = ({
  camera,
  isMuted,
  onToggleMute,
  onExpand,
  onAdd,
  onRemove,
}) => {
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => setHasError(true), []);

  const hasSignal = camera && camera.youtubeId && !hasError;
  const muteParam = isMuted ? '1' : '0';
  const embedUrl = camera?.youtubeId
    ? `https://www.youtube.com/embed/${camera.youtubeId}?${IFRAME_PARAMS.replace('mute=1', `mute=${muteParam}`)}`
    : '';

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

  // Sin señal (sin ID o error)
  if (!hasSignal) {
    return (
      <div className="relative w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center border border-[#222]">
        <CameraOff className="w-10 h-10 text-[#444] mb-2" />
        <span className="font-mono text-xs text-[#555] uppercase tracking-wider">Sin señal</span>
        {/* Etiqueta de ciudad */}
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/70 flex items-center justify-between">
          <span className="font-mono text-[10px] text-[#888] truncate">
            {camera.city}, {camera.country}
          </span>
          <button onClick={onRemove} className="text-[#555] hover:text-[#ff2222] ml-1">
            <X className="w-3 h-3" />
          </button>
        </div>
        {/* Botón para abrir en YouTube si tiene ID pero falló */}
        {camera.youtubeId && hasError && (
          <a
            href={`https://www.youtube.com/watch?v=${camera.youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 font-mono text-[10px] text-[#00ff88] underline"
          >
            Ver en YouTube
          </a>
        )}
      </div>
    );
  }

  // Feed activo
  return (
    <div className="relative w-full h-full bg-black border border-[#222] overflow-hidden group">
      <iframe
        src={embedUrl}
        className="absolute inset-0 w-full h-full"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        onError={handleError}
        title={`${camera.name} - ${camera.city}`}
      />

      {/* Indicador EN VIVO */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/60 px-1.5 py-0.5 z-10">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ff2222] animate-pulse" />
        <span className="font-mono text-[9px] text-[#ff2222] font-bold uppercase tracking-widest">
          En vivo
        </span>
      </div>

      {/* Controles (visible on hover / touch) */}
      <div className="absolute top-1.5 left-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={onToggleMute}
          className="bg-black/60 p-1 text-white/70 hover:text-[#00ff88]"
          title={isMuted ? 'Activar sonido' : 'Silenciar'}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onExpand}
          className="bg-black/60 p-1 text-white/70 hover:text-[#00ff88]"
          title="Pantalla completa"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Etiqueta de ciudad */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/70 flex items-center justify-between z-10">
        <span className="font-mono text-[10px] text-[#ccc] truncate">
          {camera.city}, {camera.country}
        </span>
        <button
          onClick={onRemove}
          className="text-[#555] hover:text-[#ff2222] ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default VideoCell;
