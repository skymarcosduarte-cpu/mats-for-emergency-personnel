import React, { useRef } from 'react';
import { Camera } from './types';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';

interface VideoCellProps {
  camera: Camera | null;
  isMuted: boolean;
  onToggleMute: () => void;
  // Compatibility with the unused legacy grid.
  onExpand?: () => void;
  onAdd?: () => void;
  onRemove?: () => void;
}

const VideoCell: React.FC<VideoCellProps> = ({ camera, isMuted, onToggleMute }) => {
  const player = useRef<HTMLIFrameElement>(null);
  if (!camera) return null;
  const embedUrl = new URL(camera.embedUrl);
  embedUrl.searchParams.set('origin', window.location.origin);

  const command = (func: string) => {
    player.current?.contentWindow?.postMessage(JSON.stringify({
      event: 'command', func, args: [],
    }), 'https://www.youtube.com');
  };

  const toggleAudio = () => {
    command(isMuted ? 'unMute' : 'mute');
    if (isMuted) command('playVideo');
    onToggleMute();
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden border border-border bg-card">
      <div className="relative min-h-0 flex-1 bg-foreground">
        <iframe
          ref={player}
          src={embedUrl.toString()}
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media"
          title={camera.name}
          onLoad={() => { if (isMuted) command('mute'); }}
        />
      </div>
      <div className="flex min-h-14 items-center justify-between gap-2 px-3 py-2">
        <h2 className="min-w-0 break-words text-sm font-semibold text-card-foreground">{camera.name}</h2>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleAudio}
          aria-label={`${isMuted ? 'Activar audio' : 'Silenciar audio'}: ${camera.name}`}
          aria-pressed={!isMuted}
          title={isMuted ? 'Activar audio' : 'Silenciar audio'}
          className="shrink-0"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </Button>
      </div>
    </section>
  );
};

export default VideoCell;
