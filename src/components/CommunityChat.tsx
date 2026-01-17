import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, Send, Users, Image, Camera, Mic, MicOff, MapPin, 
  Play, Pause, Trash2, AlertTriangle, Bell, Lock, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { compressImages } from '@/lib/imageCompress';
import { createAudioRecorder, formatDuration, type AudioRecorder } from '@/lib/audioUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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

interface CommunityMessage {
  id: string;
  sender_id: string;
  message: string;
  image_url: string | null;
  audio_url: string | null;
  audio_duration_ms: number | null;
  context_type: string;
  context_id: string | null;
  created_at: string;
}

// Authorized users who can close drill chats
const AUTHORIZED_DRILL_CLOSERS = [
  '7c823685-369d-4f62-8459-80486832ba1a', // Zombie
  '0e0d5ee7-628d-4a98-af26-b60ede2536ce', // El Lagarto
];

interface CommunityChatProps {
  isOpen: boolean;
  onClose: () => void;
  contextType?: 'general' | 'clave100' | 'drill';
  contextId?: string;
  title?: string;
}

export const CommunityChat: React.FC<CommunityChatProps> = ({
  isOpen,
  onClose,
  contextType = 'general',
  contextId,
  title = 'Chat Comunidad',
}) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [onlineCount, setOnlineCount] = useState(0);
  const [chatClosed, setChatClosed] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  
  // Media states
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  
  // Delete confirmation
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  
  // Check if current user can close drill chat
  const canCloseDrillChat = user?.id && AUTHORIZED_DRILL_CLOSERS.includes(user.id) && (contextType === 'drill' || contextType === 'clave100');

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Use type assertion since community_messages table may not be in generated types yet
      let query = (supabase as any)
        .from('community_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(200);
      
      // Filter by context if specific
      if (contextType !== 'general' && contextId) {
        query = query.eq('context_type', contextType).eq('context_id', contextId);
      } else if (contextType !== 'general') {
        query = query.eq('context_type', contextType);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setMessages((data as CommunityMessage[]) || []);
      
      // Fetch user names for senders
      const senderIds = [...new Set(((data as CommunityMessage[]) || []).map(m => m.sender_id))];
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('user_id, nickname')
          .in('user_id', senderIds);
        
        const names: Record<string, string> = {};
        profiles?.forEach(p => {
          names[p.user_id] = p.nickname || 'Usuario';
        });
        setUserNames(prev => ({ ...prev, ...names }));
      }
    } catch (err) {
      console.error('Error fetching community messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, contextType, contextId]);

  // Fetch online users count
  const fetchOnlineCount = useCallback(async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('user_locations')
      .select('*', { count: 'exact', head: true })
      .eq('is_online', true)
      .gte('updated_at', fiveMinutesAgo);
    
    setOnlineCount(count || 0);
  }, []);

  // Check if drill chat is closed
  const checkDrillChatStatus = useCallback(async () => {
    if (!contextId || (contextType !== 'drill' && contextType !== 'clave100')) return;
    
    const { data } = await supabase
      .from('clave100_drills')
      .select('chat_closed_at')
      .eq('id', contextId)
      .single();
    
    if (data?.chat_closed_at) {
      setChatClosed(true);
    }
  }, [contextId, contextType]);

  // Close drill chat (only for authorized users)
  const handleCloseDrillChat = async () => {
    if (!canCloseDrillChat || !contextId) return;
    
    try {
      await supabase
        .from('clave100_drills')
        .update({ 
          chat_closed_at: new Date().toISOString(),
          chat_closed_by: user?.id
        })
        .eq('id', contextId);
      
      // Send system message
      await supabase
        .from('community_messages')
        .insert({
          sender_id: user!.id,
          message: '📢 El chat del simulacro ha sido cerrado por el coordinador. ¡Gracias por participar!',
          context_type: contextType,
          context_id: contextId,
        });
      
      toast.success('Chat del simulacro cerrado');
      setChatClosed(true);
      setShowCloseConfirm(false);
    } catch (err) {
      toast.error('Error al cerrar el chat');
    }
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    
    fetchMessages();
    fetchOnlineCount();
    checkDrillChatStatus();
    
    const channel = supabase
      .channel('community-chat')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_messages',
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as CommunityMessage;
            
            // Filter by context
            if (contextType !== 'general' && contextId) {
              if (newMsg.context_type !== contextType || newMsg.context_id !== contextId) return;
            } else if (contextType !== 'general') {
              if (newMsg.context_type !== contextType) return;
            }
            
            // Fetch sender name if needed
            if (!userNames[newMsg.sender_id]) {
              const { data } = await supabase
                .from('profiles_public')
                .select('nickname')
                .eq('user_id', newMsg.sender_id)
                .single();
              
              if (data) {
                setUserNames(prev => ({ ...prev, [newMsg.sender_id]: data.nickname || 'Usuario' }));
              }
            }
            
            setMessages(prev => [...prev, newMsg]);
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();
    
    const onlineInterval = setInterval(fetchOnlineCount, 30000);
    
    return () => {
      supabase.removeChannel(channel);
      clearInterval(onlineInterval);
    };
  }, [isOpen, user?.id, contextType, contextId, fetchMessages, fetchOnlineCount, userNames]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Send message
  const handleSend = async () => {
    if (!user?.id || (!newMessage.trim() && !selectedImage && !audioBlob)) return;
    
    setIsSending(true);
    try {
      let imageUrl: string | null = null;
      let audioUrl: string | null = null;
      
      // Upload image if selected
      if (selectedImage) {
        const { results, errors } = await compressImages([selectedImage]);
        if (errors.length > 0) throw new Error(errors[0].error);
        const compressed = results[0].file;
        const fileName = `${user.id}/${Date.now()}_community.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('internal-messages')
          .upload(fileName, compressed, { contentType: compressed.type });
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('internal-messages')
          .getPublicUrl(fileName);
        
        imageUrl = urlData.publicUrl;
      }
      
      // Upload audio if recorded
      if (audioBlob) {
        const fileName = `${user.id}/${Date.now()}_community.webm`;
        const { error: uploadError } = await supabase.storage
          .from('internal-messages')
          .upload(fileName, audioBlob, { contentType: 'audio/webm' });
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('internal-messages')
          .getPublicUrl(fileName);
        
        audioUrl = urlData.publicUrl;
      }
      
      let displayMessage = newMessage.trim();
      if (!displayMessage) {
        if (audioBlob) displayMessage = '🎤 Nota de voz';
        else if (selectedImage) displayMessage = '📷 Imagen';
      }
      
      // Use type assertion since community_messages table may not be in generated types yet
      const { error } = await (supabase as any)
        .from('community_messages')
        .insert({
          sender_id: user.id,
          message: displayMessage,
          image_url: imageUrl,
          audio_url: audioUrl,
          audio_duration_ms: audioBlob ? audioDuration : null,
          context_type: contextType,
          context_id: contextId,
        });
      
      if (error) throw error;
      
      // Clear inputs
      setNewMessage('');
      setSelectedImage(null);
      setImagePreview(null);
      setAudioBlob(null);
      setAudioDuration(0);
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Error al enviar mensaje');
    } finally {
      setIsSending(false);
    }
  };

  // Image handling
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('La imagen es muy grande (máx 10MB)');
      return;
    }
    
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    
    // Clear file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const cancelImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  // Audio recording
  const startRecording = async () => {
    try {
      const recorder = createAudioRecorder((state) => {
        setAudioDuration(state.duration);
        if (state.blob) {
          setAudioBlob(state.blob);
        }
      });
      await recorder.start();
      audioRecorderRef.current = recorder;
      setIsRecording(true);
      setAudioBlob(null);
      setAudioDuration(0);
    } catch (err) {
      console.error('Error starting recording:', err);
      toast.error('No se pudo acceder al micrófono');
    }
  };

  const stopRecording = async () => {
    if (!audioRecorderRef.current) return;
    
    try {
      const blob = await audioRecorderRef.current.stop();
      if (blob) {
        setAudioBlob(blob);
      }
      setIsRecording(false);
      audioRecorderRef.current = null;
    } catch (err) {
      console.error('Error stopping recording:', err);
      setIsRecording(false);
    }
  };

  const cancelAudio = () => {
    setAudioBlob(null);
    setAudioDuration(0);
  };

  // Audio playback
  const toggleAudioPlayback = (messageId: string, audioUrl: string) => {
    if (playingAudioId === messageId) {
      audioElementRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      audioElementRef.current = new Audio(audioUrl);
      audioElementRef.current.onended = () => setPlayingAudioId(null);
      audioElementRef.current.play();
      setPlayingAudioId(messageId);
    }
  };

  // Send location
  const sendLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalización no disponible');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        const locationMessage = `📍 Mi ubicación:\n${mapsUrl}`;
        
        setIsSending(true);
        try {
          // Use type assertion since community_messages table may not be in generated types yet
          const { error } = await (supabase as any)
            .from('community_messages')
            .insert({
              sender_id: user!.id,
              message: locationMessage,
              context_type: contextType,
              context_id: contextId,
            });
          
          if (error) throw error;
          toast.success('Ubicación compartida');
        } catch (err) {
          toast.error('Error al compartir ubicación');
        } finally {
          setIsSending(false);
        }
      },
      () => toast.error('No se pudo obtener la ubicación'),
      { enableHighAccuracy: true }
    );
  };

  // Delete message
  const handleDeleteMessage = async () => {
    if (!deleteMessageId) return;
    
    try {
      // Use type assertion since community_messages table may not be in generated types yet
      const { error } = await (supabase as any)
        .from('community_messages')
        .delete()
        .eq('id', deleteMessageId);
      
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== deleteMessageId));
      toast.success('Mensaje eliminado');
    } catch (err) {
      toast.error('Error al eliminar mensaje');
    } finally {
      setDeleteMessageId(null);
    }
  };

  // Format time
  const formatTime = (dateStr: string) => {
    return format(new Date(dateStr), 'HH:mm', { locale: es });
  };

  // Get context badge
  const getContextBadge = () => {
    if (contextType === 'clave100') {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-destructive/20 text-destructive rounded-full text-xs font-medium animate-pulse">
          <AlertTriangle className="w-3 h-3" />
          CLAVE 100
        </div>
      );
    }
    if (contextType === 'drill') {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-600 rounded-full text-xs font-medium">
          <Bell className="w-3 h-3" />
          SIMULACRO
        </div>
      );
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-background flex flex-col">
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between p-3 border-b",
          contextType === 'clave100' && "bg-destructive/10",
          contextType === 'drill' && "bg-amber-500/10"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{title}</h2>
                {getContextBadge()}
                {chatClosed && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs">
                    <Lock className="w-3 h-3" />
                    Cerrado
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {onlineCount} usuarios conectados
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Close drill chat button - only for authorized users */}
            {canCloseDrillChat && !chatClosed && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowCloseConfirm(true)}
                className="text-amber-600 hover:bg-amber-100"
                title="Cerrar chat del simulacro"
              >
                <Lock className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-3" ref={scrollRef}>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Users className="w-12 h-12 mb-2 opacity-50" />
              <p>No hay mensajes aún</p>
              <p className="text-sm">¡Sé el primero en escribir!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isMine = msg.sender_id === user?.id;
                const senderName = userNames[msg.sender_id] || 'Usuario';
                
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2",
                      isMine ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarFallback className={cn(
                        "text-xs",
                        isMine ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        {senderName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className={cn(
                      "max-w-[80%] rounded-lg p-3",
                      isMine 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted"
                    )}>
                      {!isMine && (
                        <p className="text-xs font-medium mb-1 opacity-70">
                          {senderName}
                        </p>
                      )}
                      
                      {/* Image */}
                      {msg.image_url && (
                        <img
                          src={msg.image_url}
                          alt="Imagen"
                          className="max-w-full rounded mb-1 cursor-pointer"
                          onClick={() => window.open(msg.image_url!, '_blank')}
                        />
                      )}
                      
                      {/* Audio */}
                      {msg.audio_url && (
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            onClick={() => toggleAudioPlayback(msg.id, msg.audio_url!)}
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center",
                              isMine ? "bg-primary-foreground/20" : "bg-background"
                            )}
                          >
                            {playingAudioId === msg.id ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 ml-0.5" />
                            )}
                          </button>
                          {msg.audio_duration_ms && (
                            <span className="text-xs opacity-70">
                              {formatDuration(msg.audio_duration_ms)}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Message text - with proper word-breaking for long messages */}
                      <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        {msg.message}
                      </p>
                      
                      <div className="flex items-center justify-between mt-1 gap-2">
                        <span className="text-xs opacity-50">
                          {formatTime(msg.created_at)}
                        </span>
                        {isMine && (
                          <button
                            onClick={() => setDeleteMessageId(msg.id)}
                            className="opacity-50 hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Image Preview */}
        {imagePreview && (
          <div className="px-3 py-2 border-t bg-muted/50">
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="Preview"
                className="h-20 rounded"
              />
              <button
                onClick={cancelImage}
                className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Audio Preview */}
        {audioBlob && (
          <div className="px-3 py-2 border-t bg-muted/50 flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-full">
              <Mic className="w-4 h-4 text-primary" />
              <span className="text-sm">{formatDuration(audioDuration)}</span>
            </div>
            <button
              onClick={cancelAudio}
              className="text-destructive"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Input Area - disabled when chat is closed */}
        <div className="p-3 border-t bg-background">
          {chatClosed ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground py-2">
              <Lock className="w-4 h-4" />
              <span className="text-sm">Este chat ha sido cerrado por el coordinador</span>
            </div>
          ) : (
          <div className="flex items-center gap-2">
            {/* Media buttons */}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageSelect}
              className="hidden"
            />
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending || isRecording}
              className="flex-shrink-0"
            >
              <Image className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute('capture', 'environment');
                  fileInputRef.current.click();
                  fileInputRef.current.removeAttribute('capture');
                }
              }}
              disabled={isSending || isRecording}
              className="flex-shrink-0"
            >
              <Camera className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={sendLocation}
              disabled={isSending || isRecording}
              className="flex-shrink-0"
            >
              <MapPin className="w-5 h-5" />
            </Button>

            {/* Text input */}
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Escribe un mensaje..."
              disabled={isSending || isRecording}
              className="flex-1"
            />

            {/* Voice / Send */}
            {newMessage.trim() || selectedImage || audioBlob ? (
              <Button
                onClick={handleSend}
                disabled={isSending}
                size="icon"
                className="flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                variant={isRecording ? "destructive" : "ghost"}
                size="icon"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isSending}
                className="flex-shrink-0"
              >
                {isRecording ? (
                  <MicOff className="w-5 h-5 animate-pulse" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </Button>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteMessageId} onOpenChange={() => setDeleteMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar mensaje?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage} className="bg-destructive">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Drill Chat Confirmation */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              ¿Cerrar el chat del simulacro?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Al cerrar el chat, los usuarios aún podrán ver los mensajes pero no podrán enviar nuevos mensajes. 
              Esta acción notificará a todos los participantes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseDrillChat} className="bg-amber-600 hover:bg-amber-700">
              Cerrar Chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CommunityChat;
