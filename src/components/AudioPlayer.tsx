// Audio Player Component for playing stored audio
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AudioPlayerProps {
  storagePath: string;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ storagePath, className }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get URL for audio
  useEffect(() => {
    const getAudioUrl = async () => {
      setLoading(true);
      setError(false);
      try {
        // Backwards compatible: if DB stored a full URL, use it directly
        if (/^https?:\/\//i.test(storagePath)) {
          setAudioUrl(storagePath);
          return;
        }

        // Use public URL for the public bucket
        const { data } = supabase.storage
          .from('reports_media')
          .getPublicUrl(storagePath);

        if (data?.publicUrl) {
          setAudioUrl(data.publicUrl);
        } else {
          console.error('Error getting audio public URL');
          setError(true);
        }
      } catch (e) {
        console.error('Error fetching audio:', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (storagePath) {
      getAudioUrl();
    }
  }, [storagePath]);

  const togglePlayback = async () => {
    if (!audioUrl || !audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (e) {
      console.error('Audio play error:', e);
      setIsPlaying(false);
      toast.error('No se pudo reproducir la nota de voz');
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  if (error) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        variant="outline"
        size="sm"
        disabled={loading || !audioUrl}
        onClick={togglePlayback}
        className="h-8"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        <span className="ml-1 text-xs">Nota de voz</span>
      </Button>
      
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={handleEnded}
          onError={() => {
            setIsPlaying(false);
            toast.error('Error al cargar la nota de voz');
          }}
          preload="metadata"
          playsInline
        />
      )}
    </div>
  );
};

export default AudioPlayer;
