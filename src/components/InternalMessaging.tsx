import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Check, CheckCheck, Circle, Maximize2, Minimize2 } from 'lucide-react';
import { X, Send, MessageCircle, ArrowLeft, Bell, BellOff, Trash2, Mic, Play, Pause, Square, Loader2, ImagePlus, Camera, MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useInternalMessages, InternalMessage, requestNotificationPermission } from '@/hooks/useInternalMessages';
import { useAuth } from '@/hooks/useAuth';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

// Image thumbnail component that loads signed URL
const ImageMessageBubble: React.FC<{ imagePath: string; onView: () => void }> = ({ imagePath, onView }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImage = async () => {
      try {
        const { data, error } = await supabase.storage
          .from('reports_media')
          .createSignedUrl(imagePath, 3600);
        
        if (!error && data) {
          setImageUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Error loading image:', err);
      } finally {
        setLoading(false);
      }
    };
    loadImage();
  }, [imagePath]);

  if (loading) {
    return (
      <div className="w-32 h-32 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!imageUrl) {
    return <p className="text-sm">📷 Error al cargar imagen</p>;
  }

  return (
    <img 
      src={imageUrl} 
      alt="Imagen" 
      className="max-w-[200px] max-h-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
      onClick={onView}
    />
  );
};

interface InternalMessagingProps {
  isOpen: boolean;
  onClose: () => void;
  initialUserId?: string | null;
  initialUserName?: string | null;
}

export const InternalMessaging: React.FC<InternalMessagingProps> = ({
  isOpen,
  onClose,
  initialUserId,
  initialUserName
}) => {
  const { user } = useAuth();
  const { 
    conversations, 
    sendMessage,
    deleteMessage,
    clearConversation,
    markAsRead, 
    getConversationMessages,
    loading,
    isMuted,
    toggleMute,
    refetch
  } = useInternalMessages();
  
  // Refetch messages when modal opens to ensure fresh data
  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);
  
  // Clear conversation state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingConversation, setClearingConversation] = useState(false);
  
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [justSentId, setJustSentId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Typing indicator
  const { isUserTyping, sendTyping } = useTypingIndicator(selectedUserId);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  
  // Image state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  
  // Location state
  const [sendingLocation, setSendingLocation] = useState(false);
  
  // Fullscreen mode state
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // User online status
  const [userOnlineStatus, setUserOnlineStatus] = useState<{
    isOnline: boolean;
    lastSeen: string | null;
  } | null>(null);
  
  // Fetch user online status when selecting a conversation
  useEffect(() => {
    if (!selectedUserId) {
      setUserOnlineStatus(null);
      return;
    }
    
    const fetchOnlineStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('user_locations')
          .select('is_online, updated_at')
          .eq('user_id', selectedUserId)
          .maybeSingle();
        
        if (!error && data) {
          setUserOnlineStatus({
            isOnline: data.is_online ?? false,
            lastSeen: data.updated_at
          });
        } else {
          setUserOnlineStatus({ isOnline: false, lastSeen: null });
        }
      } catch (err) {
        console.error('Error fetching online status:', err);
        setUserOnlineStatus({ isOnline: false, lastSeen: null });
      }
    };
    
    fetchOnlineStatus();
    
    // Subscribe to real-time updates for this user's online status
    const channel = supabase
      .channel(`user-status-${selectedUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_locations',
          filter: `user_id=eq.${selectedUserId}`
        },
        (payload: any) => {
          if (payload.new) {
            setUserOnlineStatus({
              isOnline: payload.new.is_online ?? false,
              lastSeen: payload.new.updated_at
            });
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUserId]);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission('unsupported');
    }
  }, []);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotificationPermission('granted');
      toast.success('Notificaciones activadas');
    } else {
      toast.error('No se pudieron activar las notificaciones');
    }
  };

  // Handle initial user selection
  useEffect(() => {
    if (initialUserId && isOpen) {
      setSelectedUserId(initialUserId);
      setSelectedUserName(initialUserName || null);
    }
  }, [initialUserId, initialUserName, isOpen]);

  // Auto-scroll to bottom when messages change
  const conversationMessages = useMemo(
    () => (selectedUserId ? getConversationMessages(selectedUserId) : []),
    [selectedUserId, getConversationMessages]
  );

  useEffect(() => {
    const el = messagesEndRef.current;
    if (!el) return;

    const shouldSmooth = conversationMessages.length <= 40;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: shouldSmooth ? 'smooth' : 'auto', block: 'end' });
    });
  }, [conversationMessages.length]);

  // Mark as read when opening conversation
  useEffect(() => {
    if (selectedUserId && isOpen) {
      markAsRead(selectedUserId);
    }
  }, [selectedUserId, isOpen, markAsRead]);

  // Focus input when selecting user
  useEffect(() => {
    if (selectedUserId && isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [selectedUserId, isOpen]);

  const handleSend = async () => {
    if (!selectedUserId || !messageText.trim() || sending) return;

    const textToSend = messageText.trim();
    setSending(true);
    setMessageText(''); // Clear immediately for better UX
    sendTyping(false); // Stop typing indicator
    
    try {
      const success = await sendMessage(selectedUserId, textToSend);
      if (success) {
        // Find the latest message we just sent and animate it
        setTimeout(() => {
          const latestMessages = getConversationMessages(selectedUserId);
          const lastSent = latestMessages.filter(m => m.sender_id === user?.id).pop();
          if (lastSent) {
            setJustSentId(lastSent.id);
            // Clear animation after it plays
            setTimeout(() => setJustSentId(null), 600);
          }
        }, 100);
      } else {
        // Restore text if send failed
        setMessageText(textToSend);
      }
    } catch (error) {
      console.error('Error in handleSend:', error);
      // Restore text on error
      setMessageText(textToSend);
    } finally {
      setSending(false);
      // Re-focus the input
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;
    
    setDeletingId(messageToDelete);
    try {
      const success = await deleteMessage(messageToDelete);
      if (success) {
        toast.success('Mensaje eliminado');
      } else {
        toast.error('No se pudo eliminar el mensaje');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Error al eliminar mensaje');
    } finally {
      setDeletingId(null);
      setMessageToDelete(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleBack = () => {
    setSelectedUserId(null);
    setSelectedUserName(null);
    setShowClearConfirm(false);
  };

  const handleSendLocation = async () => {
    if (!selectedUserId || sendingLocation) return;
    
    setSendingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      
      const { latitude, longitude } = position.coords;
      const locationMessage = `📍 Mi ubicación: https://www.google.com/maps?q=${latitude},${longitude}`;
      
      const success = await sendMessage(selectedUserId, locationMessage);
      if (success) {
        toast.success('Ubicación enviada');
      }
    } catch (error: any) {
      console.error('Error getting location:', error);
      if (error.code === 1) {
        toast.error('Permiso de ubicación denegado');
      } else if (error.code === 2) {
        toast.error('No se pudo obtener la ubicación');
      } else if (error.code === 3) {
        toast.error('Tiempo de espera agotado');
      } else {
        toast.error('Error al enviar ubicación');
      }
    } finally {
      setSendingLocation(false);
    }
  };

  const handleSelectConversation = (userId: string, displayName: string | null) => {
    setSelectedUserId(userId);
    setSelectedUserName(displayName);
  };

  const handleClearConversation = async () => {
    if (!selectedUserId) return;
    
    setClearingConversation(true);
    try {
      const success = await clearConversation(selectedUserId);
      if (success) {
        toast.success('Tus mensajes fueron eliminados');
      } else {
        toast.error('No se pudo limpiar el chat');
      }
    } catch (error) {
      console.error('Error clearing conversation:', error);
      toast.error('Error al limpiar el chat');
    } finally {
      setClearingConversation(false);
      setShowClearConfirm(false);
    }
  };

  const formatMessageTime = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return format(date, 'HH:mm', { locale: es });
    }
    return format(date, 'dd/MM HH:mm', { locale: es });
  }, []);


  const getDisplayName = (userId: string) => {
    const conv = conversations.find(c => c.user_id === userId);
    return conv?.display_name || `Usuario ${userId.slice(0, 6)}...`;
  };

  // Get supported audio mime type for recording
  const getSupportedMimeType = (): string => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav',
      ''  // Empty string = browser default
    ];
    
    for (const type of types) {
      if (type === '' || MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  };

  // Voice recording functions
  const startRecording = async () => {
    // Prevent multiple clicks
    if (isRecording) return;
    
    try {
      // Check for microphone permission first
      if (navigator.permissions) {
        try {
          const permResult = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (permResult.state === 'denied') {
            toast.error('Permiso de micrófono denegado. Habilítalo en configuración.');
            return;
          }
        } catch {
          // Some browsers don't support permissions API for microphone
        }
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      
      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch {
        // Fallback without options
        mediaRecorder = new MediaRecorder(stream);
      }
      
      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const actualMime = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        toast.error('Error al grabar audio');
        stopRecording();
      };
      
      mediaRecorder.start(1000); // Collect data every second for better compatibility
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Update duration every second
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev >= 30) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          toast.error('Permiso de micrófono denegado');
        } else if (error.name === 'NotFoundError') {
          toast.error('No se encontró micrófono');
        } else {
          toast.error('Error al acceder al micrófono');
        }
      } else {
        toast.error('No se pudo acceder al micrófono');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setRecordingDuration(0);
  };

  const sendVoiceMessage = async () => {
    if (!audioBlob || !selectedUserId || !user?.id) return;
    
    setSending(true);
    try {
      // Determine file extension based on blob type
      const mimeType = audioBlob.type || 'audio/webm';
      let ext = 'webm';
      if (mimeType.includes('mp4') || mimeType.includes('m4a')) ext = 'm4a';
      else if (mimeType.includes('ogg')) ext = 'ogg';
      else if (mimeType.includes('wav')) ext = 'wav';
      
      // Upload to Supabase storage
      const fileName = `voice_messages/${user.id}/${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('reports_media')
        .upload(fileName, audioBlob, {
          contentType: mimeType,
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Error al subir el audio');
      }

      // Send message with audio URL
      const success = await sendMessage(
        selectedUserId, 
        '🎤 Nota de voz',
        fileName,
        recordingDuration * 1000
      );

      if (success) {
        setAudioBlob(null);
        setRecordingDuration(0);
        toast.success('Nota de voz enviada');
      } else {
        throw new Error('Error al enviar');
      }
    } catch (error) {
      console.error('Error sending voice message:', error);
      toast.error('Error al enviar nota de voz');
    } finally {
      setSending(false);
    }
  };

  // Ref to track current playing audio id (prevents callback identity changes)
  const playingAudioIdRef = useRef<string | null>(null);
  useEffect(() => {
    playingAudioIdRef.current = playingAudioId;
  }, [playingAudioId]);

  // Audio playback function - stable callback (no deps on playingAudioId)
  const playAudio = useCallback(async (msg: InternalMessage) => {
    if (!msg.audio_url) return;

    // If already playing this audio, stop it
    if (playingAudioIdRef.current === msg.id) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      setPlayingAudioId(null);
      return;
    }

    // Stop any currently playing audio
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }

    setLoadingAudioId(msg.id);

    try {
      const { data, error } = await supabase.storage
        .from('reports_media')
        .createSignedUrl(msg.audio_url, 3600);

      if (error) throw error;

      const audio = new Audio(data.signedUrl);
      audioElementRef.current = audio;

      audio.onended = () => {
        setPlayingAudioId(null);
        audioElementRef.current = null;
      };

      audio.onerror = () => {
        toast.error('Error al reproducir audio');
        setPlayingAudioId(null);
        setLoadingAudioId(null);
      };

      await audio.play();
      setPlayingAudioId(msg.id);
    } catch (error) {
      console.error('Error playing audio:', error);
      toast.error('Error al reproducir audio');
    } finally {
      setLoadingAudioId(null);
    }
  }, []);


  // Image handling functions - with compression to prevent freezing
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    // Reset inputs immediately to allow re-selecting the same file
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes');
      return;
    }
    
    // Validate file size (max 15MB before compression)
    if (file.size > 15 * 1024 * 1024) {
      toast.error('La imagen es muy grande (máx 15MB)');
      return;
    }
    
    // Use requestAnimationFrame to prevent UI blocking
    requestAnimationFrame(async () => {
      try {
        // Show loading state
        setSendingImage(true);
        toast.info('Procesando imagen...');
        
        // Compress the image using our utility
        const { compressImages } = await import('@/lib/imageCompress');
        const { results, errors } = await compressImages([file]);
        
        if (errors.length > 0) {
          toast.error(errors[0].error);
          setSendingImage(false);
          return;
        }
        
        if (results.length === 0) {
          toast.error('Error al procesar la imagen');
          setSendingImage(false);
          return;
        }
        
        const compressedFile = results[0].file;
        setSelectedImage(compressedFile);
        const previewUrl = URL.createObjectURL(compressedFile);
        setImagePreview(previewUrl);
        
        // Show compression info
        const savedPercent = Math.round((1 - results[0].compressedSize / results[0].originalSize) * 100);
        if (savedPercent > 10) {
          toast.success(`Imagen optimizada (${savedPercent}% más ligera)`);
        } else {
          toast.dismiss();
        }
      } catch (error) {
        console.error('Error processing image:', error);
        toast.error('Error al procesar la imagen');
      } finally {
        setSendingImage(false);
      }
    });
  };

  const cancelImage = () => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const sendImageMessage = async () => {
    if (!selectedImage || !selectedUserId || !user?.id || sendingImage) return;
    
    setSendingImage(true);
    
    // Use setTimeout to prevent UI blocking
    setTimeout(async () => {
      try {
        // Upload to Supabase storage
        const fileExt = selectedImage.type === 'image/webp' ? 'webp' : 
                        selectedImage.type === 'image/png' ? 'png' : 'jpg';
        const fileName = `chat_images/${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('reports_media')
          .upload(fileName, selectedImage, {
            contentType: selectedImage.type,
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error('Error al subir la imagen');
        }

        // Send message with image URL
        const success = await sendMessage(
          selectedUserId, 
          '📷 Imagen',
          null,
          null,
          fileName
        );

        if (success) {
          cancelImage();
          toast.success('Imagen enviada');
        } else {
          throw new Error('Error al enviar');
        }
      } catch (error) {
        console.error('Error sending image:', error);
        toast.error('Error al enviar imagen');
      } finally {
        setSendingImage(false);
      }
    }, 50);
  };

  const getSignedImageUrl = useCallback(async (imagePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('reports_media')
        .createSignedUrl(imagePath, 3600);

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
  }, []);

  const handleViewImage = useCallback(async (imagePath: string) => {
    const url = await getSignedImageUrl(imagePath);
    if (url) {
      setViewingImage(url);
    }
  }, [getSignedImageUrl]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Lock background scroll + disable map interactions while chat is open
  useEffect(() => {
    if (!isOpen) return;

    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;

    const prev = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      touchAction: body.style.touchAction,
    };

    html.classList.add('chat-modal-open');

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.touchAction = 'none';

    return () => {
      html.classList.remove('chat-modal-open');

      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.touchAction = prev.touchAction;

      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  const renderedMessages = useMemo(() => {
    if (conversationMessages.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Inicia la conversación</p>
        </div>
      );
    }

    return conversationMessages.map((msg: InternalMessage) => {
      const isMine = msg.sender_id === user?.id;
      const isJustSent = msg.id === justSentId;
      const isDeleting = msg.id === deletingId;

      return (
        <div
          key={msg.id}
          className={cn(
            'flex transition-all duration-300 group',
            isMine ? 'justify-end' : 'justify-start',
            isJustSent && 'animate-scale-in',
            isDeleting && 'animate-slide-out-right opacity-0'
          )}
        >
          {/* Delete button for own messages */}
          {isMine && !isDeleting && (
            <button
              onClick={() => setMessageToDelete(msg.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 mr-1 self-center text-muted-foreground hover:text-destructive"
              title="Eliminar mensaje"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <div
            className={cn(
              'max-w-[80%] rounded-2xl px-4 py-2 transition-all duration-300',
              isMine
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted text-foreground rounded-bl-md',
              isJustSent && 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background'
            )}
          >
            {/* Image message */}
            {msg.image_url ? (
              <ImageMessageBubble imagePath={msg.image_url} onView={() => handleViewImage(msg.image_url!)} />
            ) : msg.audio_url ? (
              <button
                onClick={() => playAudio(msg)}
                disabled={loadingAudioId === msg.id}
                className={cn(
                  'flex items-center gap-2 py-1',
                  isMine ? 'text-primary-foreground' : 'text-foreground'
                )}
              >
                {loadingAudioId === msg.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : playingAudioId === msg.id ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                <span className="text-sm">
                  {msg.audio_duration_ms ? `${Math.round(msg.audio_duration_ms / 1000)}s` : 'Nota de voz'}
                </span>
              </button>
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
            )}
            <div
              className={cn(
                'flex items-center justify-end gap-1 mt-1',
                isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'
              )}
            >
              <span className="text-[10px]">{formatMessageTime(msg.created_at)}</span>
              {isMine && (msg.read ? <CheckCheck className="w-3.5 h-3.5 text-blue-400" /> : <Check className="w-3.5 h-3.5" />)}
            </div>
          </div>
        </div>
      );
    });
  }, [conversationMessages, user?.id, justSentId, deletingId, loadingAudioId, playingAudioId, formatMessageTime, handleViewImage]);

  if (!isOpen) return null;

  return (

    <div 
      className={cn(
        "fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto",
        isFullscreen 
          ? "bg-background p-0" 
          : "bg-black/70 p-4 pt-16 pb-24"
      )}
      style={{ touchAction: 'none' }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchMove={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchEnd={(e) => e.stopPropagation()}
      onWheel={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div 
        className={cn(
          "bg-card flex flex-col overflow-hidden",
          isFullscreen 
            ? "w-full h-full rounded-none border-0" 
            : "border border-border rounded-xl shadow-2xl w-full max-w-md min-h-[400px] max-h-[calc(100dvh-10rem)]"
        )}
        style={{ touchAction: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between p-4 border-b border-border bg-muted/30",
          isFullscreen && "safe-top"
        )}>
          <div className="flex items-center gap-3">
            {selectedUserId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleBack}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <MessageCircle className="w-5 h-5 text-primary" />
            <div className="flex flex-col">
              <h2 className="font-semibold text-foreground leading-tight">
                {selectedUserId 
                  ? (selectedUserName || getDisplayName(selectedUserId))
                  : 'Mensajes'}
              </h2>
              {selectedUserId && userOnlineStatus && (
                <div className="flex items-center gap-1">
                  <Circle 
                    className={cn(
                      "w-2 h-2",
                      userOnlineStatus.isOnline 
                        ? "fill-green-500 text-green-500" 
                        : "fill-muted-foreground/50 text-muted-foreground/50"
                    )} 
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {userOnlineStatus.isOnline 
                      ? 'En línea' 
                      : userOnlineStatus.lastSeen 
                        ? `Últ. vez ${formatDistanceToNow(new Date(userOnlineStatus.lastSeen), { addSuffix: true, locale: es })}`
                        : 'Desconectado'}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Clear conversation button - only when in conversation */}
            {selectedUserId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => setShowClearConfirm(true)}
                title="Limpiar mis mensajes"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            {/* Fullscreen toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Modo ventana' : 'Pantalla completa'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
            {/* Mute notifications toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={toggleMute}
              title={isMuted ? 'Activar sonidos' : 'Silenciar notificaciones'}
            >
              {isMuted ? (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Bell className="w-4 h-4 text-primary" />
              )}
            </Button>
            {/* Browser notification permission */}
            {notificationPermission !== 'unsupported' && notificationPermission !== 'granted' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleEnableNotifications}
                title="Activar notificaciones del navegador"
              >
                <Bell className="w-4 h-4 text-muted-foreground animate-pulse" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {!selectedUserId ? (
          // Conversations List
          <ScrollArea className="flex-1">
            <div className="p-2">
              {conversations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No hay conversaciones</p>
                  <p className="text-xs mt-1">Selecciona un usuario del mapa para iniciar</p>
                </div>
              ) : (
                conversations.map(conv => (
                  <button
                    key={conv.user_id}
                    onClick={() => handleSelectConversation(conv.user_id, conv.display_name)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">👤</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">
                          {conv.display_name || `Usuario ${conv.user_id.slice(0, 6)}...`}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                          {formatMessageTime(conv.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {conv.last_message}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ml-2">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        ) : (
          // Messages View
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {renderedMessages}
                {/* Typing indicator */}
                {isUserTyping && (
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground rounded-2xl rounded-bl-md px-4 py-2">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border">
              {/* Recording UI */}
              {isRecording || audioBlob ? (
                <div className="flex items-center gap-2">
                  {isRecording ? (
                    <>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                        <span className="text-sm font-mono">{recordingDuration}s / 30s</span>
                      </div>
                      <Button
                        onClick={stopRecording}
                        size="icon"
                        variant="destructive"
                      >
                        <Square className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 flex items-center gap-2">
                        <Mic className="w-4 h-4 text-primary" />
                        <span className="text-sm">Nota de voz ({recordingDuration}s)</span>
                      </div>
                      <Button
                        onClick={cancelRecording}
                        size="icon"
                        variant="ghost"
                        disabled={sending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={sendVoiceMessage}
                        size="icon"
                        disabled={sending}
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </>
                  )}
                </div>
              ) : selectedImage ? (
                // Image preview UI
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <img 
                      src={imagePreview!} 
                      alt="Preview" 
                      className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                    />
                    <span className="text-sm text-muted-foreground">
                      📷 Foto lista para enviar
                    </span>
                  </div>
                  <Button
                    onClick={cancelImage}
                    size="icon"
                    variant="ghost"
                    disabled={sendingImage}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={sendImageMessage}
                    size="icon"
                    disabled={sendingImage}
                  >
                    {sendingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              ) : (
              <div className="flex gap-2">
                  {/* Hidden input for gallery */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  {/* Hidden input for camera */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  {/* Camera button */}
                  <Button
                    onClick={() => cameraInputRef.current?.click()}
                    size="icon"
                    variant="ghost"
                    disabled={sending}
                    title="Tomar foto"
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                  {/* Gallery button */}
                  <Button
                    onClick={() => imageInputRef.current?.click()}
                    size="icon"
                    variant="ghost"
                    disabled={sending}
                    title="Enviar imagen de galería"
                  >
                    <ImagePlus className="w-4 h-4" />
                  </Button>
                  {/* Location button */}
                  <Button
                    onClick={handleSendLocation}
                    size="icon"
                    variant="ghost"
                    disabled={sending || sendingLocation}
                    title="Enviar ubicación"
                  >
                    {sendingLocation ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    onClick={startRecording}
                    size="icon"
                    variant="ghost"
                    disabled={sending}
                    title="Grabar nota de voz"
                  >
                    <Mic className="w-4 h-4" />
                  </Button>
                  <Input
                    ref={inputRef}
                    value={messageText}
                    onChange={(e) => {
                      setMessageText(e.target.value);
                      sendTyping(e.target.value.length > 0);
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={() => sendTyping(false)}
                    placeholder="Escribe un mensaje..."
                    className="flex-1"
                    disabled={sending}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!messageText.trim() || sending}
                    size="icon"
                    className="flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!messageToDelete} onOpenChange={(open) => !open && setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar mensaje?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El mensaje será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear conversation confirmation dialog */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar tus mensajes?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán todos los mensajes que <strong>tú enviaste</strong> en esta conversación. 
              Los mensajes del otro usuario permanecerán visibles para él. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingConversation}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearConversation}
              disabled={clearingConversation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearingConversation ? 'Limpiando...' : 'Limpiar mis mensajes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image viewer dialog */}
      <Dialog open={!!viewingImage} onOpenChange={(open) => !open && setViewingImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 bg-black/90 border-none">
          {viewingImage && (
            <img 
              src={viewingImage} 
              alt="Imagen" 
              className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InternalMessaging;
