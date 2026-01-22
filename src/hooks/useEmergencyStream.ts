/**
 * ============================================
 * EMERGENCY LIVE RECORDING HOOK
 * ============================================
 * 
 * This hook provides complete emergency video recording functionality:
 * - Records 15-second video clips automatically (max 5 minutes / 20 clips)
 * - Uploads clips to private storage bucket with 7-day signed URLs
 * - Posts alerts to community chat with GPS location
 * - Notifies emergency contacts via WhatsApp after recording ends
 * - Allows copying all clip links to clipboard
 * 
 * REQUIREMENTS:
 * - Tables: emergency_streams, emergency_stream_clips
 * - Storage bucket: emergency-streams (private)
 * - Table: community_messages (for chat posts)
 * - Table: emergency_contacts (for WhatsApp notifications)
 * 
 * PORTABLE: Copy this file + EmergencyStreamButton.tsx + useEmergencyNotification.ts
 * to any React project with Supabase.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEmergencyNotification } from './useEmergencyNotification';

// ============================================
// TYPES & CONSTANTS
// ============================================

export interface EmergencyStreamState {
  isStreaming: boolean;
  isPreparing: boolean;
  clipCount: number;
  elapsedSeconds: number;
  error: string | null;
  streamId: string | null;
  mediaStream: MediaStream | null;
}

export interface EmergencyStreamClip {
  id: string;
  stream_id: string;
  video_url: string;
  sequence_number: number;
  duration_ms: number;
  created_at: string;
}

export interface EmergencyStreamRecord {
  id: string;
  user_id: string;
  location_lat: number | null;
  location_lng: number | null;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  clip_count: number;
  created_at: string;
}

const MAX_CLIPS = 20; // 5 minutes max (20 * 15 seconds)
const CLIP_DURATION_MS = 15000; // 15 seconds per clip
const SIGNED_URL_EXPIRY = 604800; // 7 days in seconds
const STORAGE_BUCKET = 'emergency-streams';

// ============================================
// MAIN HOOK
// ============================================

export function useEmergencyStream() {
  const [state, setState] = useState<EmergencyStreamState>({
    isStreaming: false,
    isPreparing: false,
    clipCount: 0,
    elapsedSeconds: 0,
    error: null,
    streamId: null,
    mediaStream: null,
  });

  // Refs for recording state (not reactive)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const clipTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const currentClipRef = useRef<number>(0);
  const streamIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);
  const userNameRef = useRef<string>('Usuario');
  const isStoppingRef = useRef<boolean>(false);

  const { getEmergencyContacts } = useEmergencyNotification();

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /** Clean up all resources */
  const cleanup = useCallback(() => {
    console.log('[useEmergencyStream] Cleaning up resources');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.log('[useEmergencyStream] Error stopping recorder:', e);
      }
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (clipTimerRef.current) {
      clearInterval(clipTimerRef.current);
      clipTimerRef.current = null;
    }
    
    recordedChunksRef.current = [];
    currentClipRef.current = 0;
    isStoppingRef.current = false;
  }, []);

  /** Get current GPS location */
  const getCurrentLocation = useCallback((): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('[useEmergencyStream] Geolocation not supported');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('[useEmergencyStream] Location error:', error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  /** Format phone number for WhatsApp (Mexico default) */
  const formatPhoneForWhatsApp = useCallback((phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    // Add Mexico country code if 10 digits
    if (cleaned.length === 10) {
      cleaned = '52' + cleaned;
    }
    return cleaned;
  }, []);

  // ============================================
  // STORAGE FUNCTIONS
  // ============================================

  /** Upload clip to storage and return signed URL */
  const uploadClip = useCallback(async (blob: Blob, clipNumber: number): Promise<string | null> => {
    if (!userIdRef.current || !streamIdRef.current) return null;

    const fileName = `${userIdRef.current}/${streamIdRef.current}/clip_${String(clipNumber).padStart(3, '0')}.webm`;

    console.log(`[useEmergencyStream] Uploading clip ${clipNumber}, size: ${blob.size} bytes`);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, blob, {
        contentType: 'video/webm',
        upsert: false,
      });

    if (uploadError) {
      console.error('[useEmergencyStream] Upload error:', uploadError);
      return null;
    }

    // Get signed URL valid for 7 days
    const { data: signedData, error: signedError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(fileName, SIGNED_URL_EXPIRY);

    if (signedError || !signedData?.signedUrl) {
      console.error('[useEmergencyStream] Signed URL error:', signedError);
      return null;
    }

    console.log(`[useEmergencyStream] Clip ${clipNumber} uploaded successfully`);
    return signedData.signedUrl;
  }, []);

  // ============================================
  // DATABASE FUNCTIONS
  // ============================================

  /** Post message to community chat */
  const postToCommunityChat = useCallback(async (message: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('community_messages').insert({
      sender_id: user.id,
      message,
      context_type: 'clave100', // Emergency context
    });

    if (error) {
      console.error('[useEmergencyStream] Chat post error:', error);
    }
  }, []);

  /** Save clip record to database */
  const saveClipRecord = useCallback(async (videoUrl: string, clipNumber: number) => {
    if (!userIdRef.current || !streamIdRef.current) return;

    await supabase.from('emergency_stream_clips').insert({
      stream_id: streamIdRef.current,
      user_id: userIdRef.current,
      video_url: videoUrl,
      sequence_number: clipNumber,
      duration_ms: CLIP_DURATION_MS,
    });

    // Update clip count in stream
    await supabase
      .from('emergency_streams')
      .update({ clip_count: clipNumber })
      .eq('id', streamIdRef.current);
  }, []);

  /** Fetch all clips for a stream */
  const fetchStreamClips = useCallback(async (streamId: string): Promise<EmergencyStreamClip[]> => {
    const { data, error } = await supabase
      .from('emergency_stream_clips')
      .select('*')
      .eq('stream_id', streamId)
      .order('sequence_number', { ascending: true });

    if (error) {
      console.error('[useEmergencyStream] Fetch clips error:', error);
      return [];
    }

    return data as EmergencyStreamClip[];
  }, []);

  // ============================================
  // CLIP PROCESSING
  // ============================================

  /** Process recorded clip data */
  const processClip = useCallback(async (clipNumber: number) => {
    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
    recordedChunksRef.current = [];

    if (blob.size === 0) {
      console.warn('[useEmergencyStream] Empty clip, skipping');
      return;
    }

    console.log(`[useEmergencyStream] Processing clip #${clipNumber}, size: ${blob.size}`);

    // Upload and get signed URL
    const videoUrl = await uploadClip(blob, clipNumber);
    if (!videoUrl) {
      toast.error(`Error subiendo clip #${clipNumber}`);
      return;
    }

    // Save to database
    await saveClipRecord(videoUrl, clipNumber);

    // Get fresh location
    const location = await getCurrentLocation();
    const locationLink = location 
      ? `https://maps.google.com/?q=${location.lat},${location.lng}`
      : 'Ubicación no disponible';

    // Post to community chat (only first 3 clips to avoid spam)
    if (clipNumber <= 3) {
      const clipMessage = `🎥 **Clip #${clipNumber} de emergencia** de ${userNameRef.current}\n📍 ${locationLink}\n▶️ Ver video: ${videoUrl}`;
      await postToCommunityChat(clipMessage);
    }

    setState(prev => ({ ...prev, clipCount: clipNumber }));
  }, [uploadClip, saveClipRecord, getCurrentLocation, postToCommunityChat]);

  /** Start recording a single clip */
  const startClipRecording = useCallback(() => {
    if (!mediaStreamRef.current || isStoppingRef.current) return;

    recordedChunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

    try {
      const recorder = new MediaRecorder(mediaStreamRef.current, {
        mimeType,
        videoBitsPerSecond: 1000000, // 1 Mbps
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const clipNumber = currentClipRef.current;
        await processClip(clipNumber);
      };

      recorder.start(1000); // Collect data every second
      mediaRecorderRef.current = recorder;

    } catch (error) {
      console.error('[useEmergencyStream] MediaRecorder error:', error);
      setState(prev => ({ ...prev, error: 'Error al iniciar grabación' }));
    }
  }, [processClip]);

  /** Rotate to next clip */
  const rotateClip = useCallback(() => {
    if (isStoppingRef.current) return;

    // Stop current recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    currentClipRef.current += 1;

    // Check if we've reached max clips
    if (currentClipRef.current > MAX_CLIPS) {
      isStoppingRef.current = true;
      toast.info('⏱️ Transmisión completada (5 minutos máximo)', { duration: 5000 });
      // Will be handled by stopStream
      return;
    }

    // Start new clip after a brief delay
    setTimeout(() => {
      if (!isStoppingRef.current) {
        startClipRecording();
      }
    }, 100);
  }, [startClipRecording]);

  // ============================================
  // SHARING FUNCTIONS
  // ============================================

  /** Build complete message with all clip URLs */
  const buildClipsShareMessage = useCallback(async (
    clipCount: number,
    location: { lat: number; lng: number } | null,
    streamId: string
  ): Promise<string> => {
    const clips = await fetchStreamClips(streamId);

    const locationLink = location
      ? `https://maps.google.com/?q=${location.lat},${location.lng}`
      : 'Ubicación no disponible';

    let message = `🚨 *GRABACIÓN DE EMERGENCIA FINALIZADA*\n\n`;
    message += `👤 ${userNameRef.current}\n`;
    message += `📹 ${clipCount} clips grabados\n`;
    message += `📍 Ubicación: ${locationLink}\n`;
    message += `🕐 ${new Date().toLocaleString('es-MX')}\n\n`;

    if (clips.length > 0) {
      message += `*Videos disponibles (7 días):*\n`;
      clips.forEach((clip) => {
        message += `▶️ Clip #${clip.sequence_number}: ${clip.video_url}\n`;
      });
    }

    message += `\n_Grabado desde la app de emergencia_`;

    return message;
  }, [fetchStreamClips]);

  /** Copy all clip links to clipboard */
  const copyClipsToClipboard = useCallback(async (
    clipCount: number,
    location: { lat: number; lng: number } | null,
    streamId: string
  ) => {
    try {
      const message = await buildClipsShareMessage(clipCount, location, streamId);
      await navigator.clipboard.writeText(message);
      toast.success('📋 Enlaces copiados al portapapeles', { duration: 3000 });
    } catch (error) {
      console.error('[useEmergencyStream] Clipboard error:', error);
      toast.error('Error al copiar enlaces');
    }
  }, [buildClipsShareMessage]);

  /** Show sharing options after recording ends */
  const showSharingOptions = useCallback(async (
    clipCount: number,
    location: { lat: number; lng: number } | null,
    streamId: string
  ) => {
    const contacts = await getEmergencyContacts();
    const message = await buildClipsShareMessage(clipCount, location, streamId);
    const encodedMessage = encodeURIComponent(message);

    // Main toast with sharing options
    toast.success('📹 Grabación finalizada', {
      duration: 20000,
      description: `${clipCount} clips listos para compartir`,
      action: {
        label: '📋 Copiar enlaces',
        onClick: () => copyClipsToClipboard(clipCount, location, streamId),
      },
    });

    // WhatsApp sharing toast (appears after 1 second)
    if (contacts.length > 0) {
      setTimeout(() => {
        toast.info(`📱 ¿Compartir con ${contacts.length} contacto(s) de emergencia?`, {
          duration: 15000,
          action: {
            label: 'WhatsApp',
            onClick: () => {
              const primaryContact = contacts[0];
              const phone = formatPhoneForWhatsApp(primaryContact.whatsapp || primaryContact.phone);
              window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');

              // Offer additional contacts
              if (contacts.length > 1) {
                setTimeout(() => {
                  toast.info(`¿Enviar a ${contacts.length - 1} contacto(s) más?`, {
                    duration: 10000,
                    action: {
                      label: 'Enviar todos',
                      onClick: () => {
                        contacts.slice(1).forEach((contact, idx) => {
                          setTimeout(() => {
                            const ph = formatPhoneForWhatsApp(contact.whatsapp || contact.phone);
                            window.open(`https://wa.me/${ph}?text=${encodedMessage}`, '_blank');
                          }, idx * 1500);
                        });
                      },
                    },
                  });
                }, 2000);
              }
            },
          },
        });
      }, 1000);
    }
  }, [getEmergencyContacts, buildClipsShareMessage, copyClipsToClipboard, formatPhoneForWhatsApp]);

  // ============================================
  // MAIN STREAM CONTROLS
  // ============================================

  /** Start emergency stream */
  const startStream = useCallback(async () => {
    setState(prev => ({ ...prev, isPreparing: true, error: null }));

    try {
      // Get user info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }
      userIdRef.current = user.id;

      // Get user profile name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, nickname')
        .eq('id', user.id)
        .maybeSingle();
      
      userNameRef.current = profile?.nickname || profile?.full_name || 'Usuario';

      // Get initial location
      locationRef.current = await getCurrentLocation();

      // Request camera access (rear camera preferred for discreet recording)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      mediaStreamRef.current = stream;

      // Create stream record in database
      const { data: streamData, error: streamError } = await supabase
        .from('emergency_streams')
        .insert({
          user_id: user.id,
          location_lat: locationRef.current?.lat,
          location_lng: locationRef.current?.lng,
          is_active: true,
        })
        .select()
        .single();

      if (streamError || !streamData) {
        throw new Error('Error creando stream de emergencia');
      }

      streamIdRef.current = streamData.id;

      // Post initial message to community chat
      const locationLink = locationRef.current
        ? `https://maps.google.com/?q=${locationRef.current.lat},${locationRef.current.lng}`
        : 'Ubicación no disponible';

      const startMessage = `🚨 **TRANSMISIÓN DE EMERGENCIA** 🚨\n\n${userNameRef.current} está transmitiendo en vivo. Puede ser una emergencia.\n\n📍 Ubicación: ${locationLink}\n\n⚠️ Por favor mantente alerta.`;
      await postToCommunityChat(startMessage);

      // Notify about emergency contacts (don't open WhatsApp during recording)
      const contacts = await getEmergencyContacts();
      if (contacts.length > 0) {
        toast.info(`📱 ${contacts.length} contacto(s) serán notificados al finalizar`, { duration: 4000 });
      }

      // Start first clip
      currentClipRef.current = 1;
      startClipRecording();

      // Set up clip rotation timer (every 15 seconds)
      clipTimerRef.current = setInterval(rotateClip, CLIP_DURATION_MS);

      // Set up elapsed time counter
      timerRef.current = setInterval(() => {
        setState(prev => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }));
      }, 1000);

      setState(prev => ({
        ...prev,
        isStreaming: true,
        isPreparing: false,
        streamId: streamData.id,
        mediaStream: stream,
        clipCount: 0,
        elapsedSeconds: 0,
      }));

      toast.success('🎥 Transmisión de emergencia iniciada', { duration: 3000 });

    } catch (error: any) {
      console.error('[useEmergencyStream] Start error:', error);
      
      let errorMessage = 'Error al iniciar transmisión';
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permiso de cámara denegado. Habilita el acceso a la cámara.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No se encontró cámara disponible';
      }

      cleanup();
      setState(prev => ({
        ...prev,
        isPreparing: false,
        error: errorMessage,
      }));
      toast.error(errorMessage);
    }
  }, [getCurrentLocation, startClipRecording, rotateClip, postToCommunityChat, getEmergencyContacts, cleanup]);

  /** Stop emergency stream */
  const stopStream = useCallback(async () => {
    console.log('[useEmergencyStream] Stopping stream');
    isStoppingRef.current = true;

    // Stop timers first
    if (clipTimerRef.current) {
      clearInterval(clipTimerRef.current);
      clipTimerRef.current = null;
    }

    // Process any remaining data
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    const finalClipCount = currentClipRef.current;
    const finalStreamId = streamIdRef.current;

    // Mark stream as ended in database
    if (finalStreamId) {
      await supabase
        .from('emergency_streams')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
          clip_count: finalClipCount,
        })
        .eq('id', finalStreamId);

      // Post end message
      const location = await getCurrentLocation();
      const locationLink = location
        ? `https://maps.google.com/?q=${location.lat},${location.lng}`
        : 'Ubicación no disponible';

      const endMessage = `✅ **Transmisión finalizada** de ${userNameRef.current}\n📹 ${finalClipCount} clips grabados\n📍 Última ubicación: ${locationLink}`;
      await postToCommunityChat(endMessage);

      // Wait for last clip to process, then show sharing options
      setTimeout(() => {
        showSharingOptions(finalClipCount, location, finalStreamId);
      }, 2500);
    }

    cleanup();

    setState({
      isStreaming: false,
      isPreparing: false,
      clipCount: 0,
      elapsedSeconds: 0,
      error: null,
      streamId: null,
      mediaStream: null,
    });
  }, [cleanup, getCurrentLocation, postToCommunityChat, showSharingOptions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // ============================================
  // RETURN API
  // ============================================

  return {
    // State
    ...state,
    
    // Actions
    startStream,
    stopStream,
    
    // Utilities (for external use like recordings viewer)
    fetchStreamClips,
    buildClipsShareMessage,
    copyClipsToClipboard,
  };
}

// ============================================
// HOOK FOR VIEWING USER'S RECORDINGS
// ============================================

export function useMyEmergencyRecordings() {
  const [recordings, setRecordings] = useState<EmergencyStreamRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyRecordings = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRecordings([]);
        return;
      }

      const { data, error } = await supabase
        .from('emergency_streams')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useMyEmergencyRecordings] Fetch error:', error);
        setRecordings([]);
        return;
      }

      setRecordings(data as EmergencyStreamRecord[]);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteRecording = useCallback(async (streamId: string) => {
    try {
      // Delete clips first (cascade should handle this, but just in case)
      await supabase
        .from('emergency_stream_clips')
        .delete()
        .eq('stream_id', streamId);

      // Delete stream record
      const { error } = await supabase
        .from('emergency_streams')
        .delete()
        .eq('id', streamId);

      if (error) throw error;

      // Refresh list
      await fetchMyRecordings();
      toast.success('Grabación eliminada');
    } catch (error) {
      console.error('[useMyEmergencyRecordings] Delete error:', error);
      toast.error('Error al eliminar grabación');
    }
  }, [fetchMyRecordings]);

  useEffect(() => {
    fetchMyRecordings();
  }, [fetchMyRecordings]);

  return {
    recordings,
    loading,
    refresh: fetchMyRecordings,
    deleteRecording,
  };
}
