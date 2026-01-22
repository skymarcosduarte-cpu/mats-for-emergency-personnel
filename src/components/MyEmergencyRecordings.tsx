/**
 * ============================================
 * MY EMERGENCY RECORDINGS VIEWER
 * ============================================
 * 
 * Displays the user's past emergency recordings with options to:
 * - View all clips from each recording
 * - Copy clip links to clipboard
 * - Delete recordings (user can only delete their own)
 * 
 * Add this component to SettingsScreen or user profile section.
 */

import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Video, 
  Trash2, 
  Copy, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp,
  MapPin,
  Clock,
  Film,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  useMyEmergencyRecordings, 
  type EmergencyStreamRecord,
  type EmergencyStreamClip 
} from '@/hooks/useEmergencyStream';

interface RecordingItemProps {
  recording: EmergencyStreamRecord;
  onDelete: (id: string) => void;
}

function RecordingItem({ recording, onDelete }: RecordingItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [clips, setClips] = useState<EmergencyStreamClip[]>([]);
  const [loadingClips, setLoadingClips] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const fetchClips = async () => {
    if (clips.length > 0) return; // Already loaded
    
    setLoadingClips(true);
    try {
      const { data, error } = await supabase
        .from('emergency_stream_clips')
        .select('*')
        .eq('stream_id', recording.id)
        .order('sequence_number', { ascending: true });

      if (!error && data) {
        setClips(data as EmergencyStreamClip[]);
      }
    } finally {
      setLoadingClips(false);
    }
  };

  const handleExpand = () => {
    if (!expanded) {
      fetchClips();
    }
    setExpanded(!expanded);
  };

  const copyAllLinks = async () => {
    if (clips.length === 0) {
      await fetchClips();
    }
    
    const locationLink = recording.location_lat && recording.location_lng
      ? `https://maps.google.com/?q=${recording.location_lat},${recording.location_lng}`
      : 'Sin ubicación';

    let message = `🚨 Grabación de Emergencia\n`;
    message += `📅 ${format(new Date(recording.created_at), "d 'de' MMMM, yyyy HH:mm", { locale: es })}\n`;
    message += `📍 ${locationLink}\n`;
    message += `📹 ${recording.clip_count} clips\n\n`;
    
    clips.forEach((clip) => {
      message += `▶️ Clip #${clip.sequence_number}: ${clip.video_url}\n`;
    });

    try {
      await navigator.clipboard.writeText(message);
      toast.success('📋 Enlaces copiados');
    } catch {
      toast.error('Error al copiar');
    }
  };

  const duration = recording.ended_at
    ? Math.round((new Date(recording.ended_at).getTime() - new Date(recording.started_at).getTime()) / 1000)
    : null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header Row */}
        <div 
          className="p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={handleExpand}
        >
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <Video className="w-5 h-5 text-destructive" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">
                {format(new Date(recording.created_at), "d MMM yyyy, HH:mm", { locale: es })}
              </span>
              {recording.is_active && (
                <Badge variant="destructive" className="text-xs">EN VIVO</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <Film className="w-3 h-3" />
                {recording.clip_count} clips
              </span>
              {duration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(duration)}
                </span>
              )}
              {recording.location_lat && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  GPS
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                copyAllLinks();
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Expanded Clips List */}
        {expanded && (
          <div className="border-t bg-muted/30 p-3 space-y-2">
            {loadingClips ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : clips.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                No hay clips disponibles
              </p>
            ) : (
              clips.map((clip) => (
                <div
                  key={clip.id}
                  className="flex items-center gap-2 bg-background rounded-lg p-2"
                >
                  <div className="w-8 h-8 rounded bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-destructive">
                      #{clip.sequence_number}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">
                      {clip.video_url.substring(0, 50)}...
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => window.open(clip.video_url, '_blank')}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))
            )}

            {/* Location link */}
            {recording.location_lat && recording.location_lng && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => 
                  window.open(
                    `https://maps.google.com/?q=${recording.location_lat},${recording.location_lng}`,
                    '_blank'
                  )
                }
              >
                <MapPin className="w-4 h-4 mr-2" />
                Ver ubicación en mapa
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar grabación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la grabación y todos sus {recording.clip_count} clips.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(recording.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function MyEmergencyRecordings() {
  const { recordings, loading, refresh, deleteRecording } = useMyEmergencyRecordings();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Video className="w-5 h-5 text-destructive" />
            Mis Grabaciones de Emergencia
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={loading}
            className="h-8 w-8"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No tienes grabaciones de emergencia</p>
            <p className="text-xs mt-1">
              Las grabaciones aparecerán aquí después de usar la función de transmisión
            </p>
          </div>
        ) : (
          recordings.map((recording) => (
            <RecordingItem
              key={recording.id}
              recording={recording}
              onDelete={deleteRecording}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
