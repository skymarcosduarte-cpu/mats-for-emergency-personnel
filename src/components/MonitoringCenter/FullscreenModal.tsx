// Modal de pantalla completa para un feed individual — v2

import React from 'react';
import { Camera } from './types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Volume2, VolumeX, ExternalLink } from 'lucide-react';

interface FullscreenModalProps {
  camera: Camera | null;
  open: boolean;
  isMuted: boolean;
  onClose: () => void;
  onToggleMute: () => void;
}

const FullscreenModal: React.FC<FullscreenModalProps> = ({
  camera,
  open,
  isMuted,
  onClose,
  onToggleMute,
}) => {
  if (!camera) return null;

  // Construir URL del iframe según sourceType
  let iframeSrc = camera.embedUrl;
  if ((camera.sourceType === 'youtube' || camera.sourceType === 'youtube_channel') && iframeSrc) {
    const muteVal = isMuted ? '1' : '0';
    // En fullscreen habilitar controles
    iframeSrc = iframeSrc.replace(/mute=\d/, `mute=${muteVal}`).replace(/controls=0/, 'controls=1');
  }

  const hasEmbed = !!iframeSrc;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[85vh] p-0 bg-black border-[#222] overflow-hidden [&>button]:hidden">
        {hasEmbed ? (
          <iframe
            src={iframeSrc}
            className="w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={camera.name}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[#555] font-mono text-sm">
            <span>Sin señal disponible</span>
            {camera.externalUrl && (
              <a
                href={camera.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[#00ff88] text-xs hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Ver en navegador externo
              </a>
            )}
          </div>
        )}

        {/* Overlay controls */}
        <div className="absolute top-2 right-2 flex gap-2 z-20">
          {hasEmbed && (camera.sourceType === 'youtube' || camera.sourceType === 'youtube_channel') && (
            <button
              onClick={onToggleMute}
              className="bg-black/70 p-2 text-white hover:text-[#00ff88]"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          )}
          {camera.externalUrl && (
            <a
              href={camera.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-black/70 p-2 text-white hover:text-[#00ff88]"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          )}
          <button
            onClick={onClose}
            className="bg-black/70 p-2 text-white hover:text-[#ff2222]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Etiqueta */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-black/70 flex items-center z-20">
          {hasEmbed && (
            <>
              <span className="w-2 h-2 rounded-full bg-[#ff2222] animate-pulse mr-2" />
              <span className="font-mono text-xs text-[#ff2222] font-bold mr-3 uppercase tracking-wider">En vivo</span>
            </>
          )}
          <span className="font-mono text-sm text-white">
            {camera.name} — {camera.city}, {camera.country}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FullscreenModal;
