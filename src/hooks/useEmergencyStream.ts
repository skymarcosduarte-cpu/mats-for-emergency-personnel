// Hook for Emergency Live Recording functionality
import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEmergencyNotification } from './useEmergencyNotification';

interface EmergencyStreamState {
  isStreaming: boolean;
  isPreparing: boolean;
  clipCount: number;
  elapsedSeconds: number;
  error: string | null;
  streamId: string | null;
  mediaStream: MediaStream | null;
}

const MAX_CLIPS = 20; // 5 minutes max (20 * 15 seconds)
const CLIP_DURATION_MS = 15000; // 15 seconds per clip
const SIGNED_URL_EXPIRY = 604800; // 7 days in seconds

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

  const { notifyEmergencyContacts, getEmergencyContacts } = useEmergencyNotification();

  // Cleanup function
  const cleanup = useCallback(() => {
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
  }, []);

  // Get current location
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

  // Upload clip to storage and get signed URL
  const uploadClip = useCallback(async (blob: Blob, clipNumber: number): Promise<string | null> => {
    if (!userIdRef.current || !streamIdRef.current) return null;

    const fileName = `${userIdRef.current}/${streamIdRef.current}/clip_${String(clipNumber).padStart(3, '0')}.webm`;

    const { error: uploadError } = await supabase.storage
      .from('emergency-streams')
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
      .from('emergency-streams')
      .createSignedUrl(fileName, SIGNED_URL_EXPIRY);

    if (signedError || !signedData?.signedUrl) {
      console.error('[useEmergencyStream] Signed URL error:', signedError);
      return null;
    }

    return signedData.signedUrl;
  }, []);

  // Post clip to community chat
  const postToCommunityChat = useCallback(async (
    message: string,
    isStart: boolean = false
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('community_messages').insert({
      sender_id: user.id,
      message,
      context_type: 'clave100', // Use emergency context
    });
  }, []);

  // Save clip record to database
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

  // Process recorded clip
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

  // Start recording a clip
  const startClipRecording = useCallback(() => {
    if (!mediaStreamRef.current) return;

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

  // Handle clip rotation
  const rotateClip = useCallback(() => {
    // Stop current recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    currentClipRef.current += 1;

    // Check if we've reached max clips
    if (currentClipRef.current > MAX_CLIPS) {
      stopStream();
      toast.info('⏱️ Transmisión completada (5 minutos máximo)', { duration: 5000 });
      return;
    }

    // Start new clip after a brief delay
    setTimeout(() => {
      startClipRecording();
    }, 100);
  }, [startClipRecording]);

  // Start emergency stream
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

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Rear camera by default
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
      await postToCommunityChat(startMessage, true);

      // Notify emergency contacts
      if (locationRef.current) {
        notifyEmergencyContacts(
          'transmision_emergencia',
          locationRef.current.lat,
          locationRef.current.lng,
          'He iniciado una transmisión de emergencia en vivo. Por favor revisa el chat comunitario.'
        );
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
  }, [getCurrentLocation, startClipRecording, rotateClip, postToCommunityChat, notifyEmergencyContacts, cleanup]);

  // Stop emergency stream
  const stopStream = useCallback(async () => {
    console.log('[useEmergencyStream] Stopping stream');

    // Process any remaining data
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // Mark stream as ended in database
    if (streamIdRef.current) {
      await supabase
        .from('emergency_streams')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
          clip_count: currentClipRef.current,
        })
        .eq('id', streamIdRef.current);

      // Post end message
      const location = await getCurrentLocation();
      const locationLink = location
        ? `https://maps.google.com/?q=${location.lat},${location.lng}`
        : 'Ubicación no disponible';

      const endMessage = `✅ **Transmisión finalizada** de ${userNameRef.current}\n📹 ${currentClipRef.current} clips grabados\n📍 Última ubicación: ${locationLink}`;
      await postToCommunityChat(endMessage);
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

    toast.success('📹 Transmisión de emergencia finalizada', { duration: 3000 });
  }, [cleanup, getCurrentLocation, postToCommunityChat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    startStream,
    stopStream,
  };
}
