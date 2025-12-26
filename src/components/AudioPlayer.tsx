// Audio Player Component for playing stored audio from Supabase
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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

  // Get signed URL for audio
  useEffect(() => {
    const getAudioUrl = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from('reports_media')
          .createSignedUrl(storagePath, 3600); // 1 hour validity

        if (error) {
          console.error('Error getting audio URL:', error);
          setError(true);
          return;
        }

        setAudioUrl(data.signedUrl);
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

  const togglePlayback = () => {
    if (!audioUrl || !audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
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
          preload="metadata"
        />
      )}
    </div>
  );
};

export default AudioPlayer;
