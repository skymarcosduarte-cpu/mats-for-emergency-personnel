// Modal de pantalla completa para un feed individual

import React from 'react';
import { Camera } from './types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Volume2, VolumeX } from 'lucide-react';

interface FullscreenModalProps {
  camera: Camera | null;
  open: boolean;
  isMuted: boolean;
  onClose: () => void;
  onToggleMute: () => void;
}

const IFRAME_PARAMS = 'autoplay=1&controls=1&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1';

const FullscreenModal: React.FC<FullscreenModalProps> = ({
  camera,
  open,
  isMuted,
  onClose,
  onToggleMute,
}) => {
  if (!camera) return null;

  const muteParam = isMuted ? '1' : '0';
  const embedUrl = camera.youtubeId
    ? `https://www.youtube.com/embed/${camera.youtubeId}?${IFRAME_PARAMS}&mute=${muteParam}`
    : '';

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[85vh] p-0 bg-black border-[#222] overflow-hidden [&>button]:hidden">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={camera.name}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[#555] font-mono text-sm">
            Sin señal disponible
          </div>
        )}

        {/* Overlay controls */}
        <div className="absolute top-2 right-2 flex gap-2 z-20">
          <button
            onClick={onToggleMute}
            className="bg-black/70 p-2 text-white hover:text-[#00ff88]"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="bg-black/70 p-2 text-white hover:text-[#ff2222]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Etiqueta */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-black/70 flex items-center z-20">
          <span className="w-2 h-2 rounded-full bg-[#ff2222] animate-pulse mr-2" />
          <span className="font-mono text-xs text-[#ff2222] font-bold mr-3 uppercase tracking-wider">En vivo</span>
          <span className="font-mono text-sm text-white">
            {camera.city}, {camera.country}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FullscreenModal;
