import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageCircle, ArrowLeft, Bell, BellOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useInternalMessages, InternalMessage, requestNotificationPermission } from '@/hooks/useInternalMessages';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md h-[70vh] max-h-[600px] flex flex-col overflow-hidden">
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
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.message}
                          </p>
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
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
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
    </div>
  );
};

export default InternalMessaging;
