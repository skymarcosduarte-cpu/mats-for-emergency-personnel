import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle, ArrowLeft, Bell, BellOff, Trash2, Mic, Play, Pause, Square, Loader2, ImagePlus } from 'lucide-react';
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
    markAsRead, 
    getConversationMessages,
    loading
  } = useInternalMessages();
  
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
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

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
  const conversationMessages = selectedUserId ? getConversationMessages(selectedUserId) : [];
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
  };

  const handleSelectConversation = (userId: string, displayName: string | null) => {
    setSelectedUserId(userId);
    setSelectedUserName(displayName);
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return format(date, 'HH:mm', { locale: es });
    }
    return format(date, 'dd/MM HH:mm', { locale: es });
  };

  const getDisplayName = (userId: string) => {
    const conv = conversations.find(c => c.user_id === userId);
    return conv?.display_name || `Usuario ${userId.slice(0, 6)}...`;
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
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
      toast.error('No se pudo acceder al micrófono');
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
      // Upload to Supabase storage
      const fileName = `voice_messages/${user.id}/${Date.now()}.webm`;
      
      const { error: uploadError } = await supabase.storage
        .from('reports_media')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
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

  // Audio playback function
  const playAudio = async (msg: InternalMessage) => {
    if (!msg.audio_url) return;
    
    // If already playing this audio, stop it
    if (playingAudioId === msg.id) {
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
  };

  // Image handling functions
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen es muy grande (máx 5MB)');
      return;
    }
    
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
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
    if (!selectedImage || !selectedUserId || !user?.id) return;
    
    setSendingImage(true);
    try {
      // Upload to Supabase storage
      const fileExt = selectedImage.name.split('.').pop() || 'jpg';
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
  };

  const getSignedImageUrl = async (imagePath: string): Promise<string | null> => {
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
  };

  const handleViewImage = async (imagePath: string) => {
    const url = await getSignedImageUrl(imagePath);
    if (url) {
      setViewingImage(url);
    }
  };

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-16 pb-24 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md min-h-[400px] max-h-[calc(100dvh-10rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
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
            <h2 className="font-semibold text-foreground">
              {selectedUserId 
                ? (selectedUserName || getDisplayName(selectedUserId))
                : 'Mensajes'}
            </h2>
          </div>
          {/* Notification toggle */}
          {notificationPermission !== 'unsupported' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleEnableNotifications}
              title={notificationPermission === 'granted' ? 'Notificaciones activadas' : 'Activar notificaciones'}
            >
              {notificationPermission === 'granted' ? (
                <Bell className="w-4 h-4 text-primary" />
              ) : (
                <BellOff className="w-4 h-4 text-muted-foreground" />
              )}
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
                {conversationMessages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Inicia la conversación</p>
                  </div>
                ) : (
                  conversationMessages.map((msg: InternalMessage) => {
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
                            <ImageMessageBubble 
                              imagePath={msg.image_url}
                              onView={() => handleViewImage(msg.image_url!)}
                            />
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
                                {msg.audio_duration_ms 
                                  ? `${Math.round(msg.audio_duration_ms / 1000)}s`
                                  : 'Nota de voz'}
                              </span>
                            </button>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {msg.message}
                            </p>
                          )}
                          <p
                            className={cn(
                              'text-[10px] mt-1',
                              isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            )}
                          >
                            {formatMessageTime(msg.created_at)}
                            {isMine && msg.read && ' ✓✓'}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
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
                  <div className="flex-1 flex items-center gap-2">
                    <img 
                      src={imagePreview!} 
                      alt="Preview" 
                      className="w-12 h-12 object-cover rounded-lg"
                    />
                    <span className="text-sm truncate">{selectedImage.name}</span>
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
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <Button
                    onClick={() => imageInputRef.current?.click()}
                    size="icon"
                    variant="ghost"
                    disabled={sending}
                    title="Enviar imagen"
                  >
                    <ImagePlus className="w-4 h-4" />
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
