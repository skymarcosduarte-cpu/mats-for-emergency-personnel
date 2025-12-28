import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { playMessageNotification, triggerMessageVibration } from '@/lib/alertSound';
import { toast } from 'sonner';

export interface InternalMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  read: boolean;
  created_at: string;
  audio_url: string | null;
  audio_duration_ms: number | null;
  image_url: string | null;
}

export interface Conversation {
  user_id: string;
  display_name: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

// Helper to show browser notification when tab is in background
const showBrowserNotification = (senderName: string, message: string, senderId: string) => {
  if (document.visibilityState === 'visible') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    const notification = new Notification('💬 Nuevo mensaje', {
      body: `${senderName}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `message-${senderId}-${Date.now()}`,
      requireInteraction: false,
      silent: false,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    setTimeout(() => notification.close(), 5000);
  } catch (error) {
    console.error('Error showing browser notification:', error);
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

export const useInternalMessagesStore = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastUnreadSender, setLastUnreadSender] = useState<{ id: string; name: string } | null>(null);
  const senderNamesCache = useRef<Map<string, string>>(new Map());
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const fetchInProgressRef = useRef(false);
  const lastFetchRef = useRef(0);
  const userNamesMapRef = useRef<Map<string, string | null>>(new Map());
  
  // Muted state - persisted in localStorage
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('chat_notifications_muted') === 'true';
    } catch {
      return false;
    }
  });
  
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newValue = !prev;
      try {
        localStorage.setItem('chat_notifications_muted', String(newValue));
      } catch {}
      return newValue;
    });
  }, []);

  // Keep latest messages without changing callback identities (prevents effect loops)
  const messagesRef = useRef<InternalMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Debounced fetch - prevents multiple rapid calls
  const fetchData = useCallback(async (force = false) => {
    if (!user?.id) return;
    
    const now = Date.now();
    // Prevent fetching more than once every 500ms unless forced
    if (!force && (fetchInProgressRef.current || now - lastFetchRef.current < 500)) {
      return;
    }
    
    fetchInProgressRef.current = true;
    lastFetchRef.current = now;

    try {
      const { data, error } = await supabase
        .from('internal_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const messagesData = data || [];
      setMessages(messagesData);

      // Calculate unread count
      const unread = messagesData.filter(m => m.receiver_id === user.id && !m.read).length;
      setUnreadCount(unread);

      // Build conversations from messages
      const conversationMap = new Map<string, {
        last_message: string;
        last_message_at: string;
        unread_count: number;
      }>();

      // Sort by date descending for conversation building
      const sortedForConv = [...messagesData].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      sortedForConv.forEach(msg => {
        const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        
        if (!conversationMap.has(otherUserId)) {
          conversationMap.set(otherUserId, {
            last_message: msg.message,
            last_message_at: msg.created_at,
            unread_count: 0
          });
        }

        if (msg.receiver_id === user.id && !msg.read) {
          const conv = conversationMap.get(otherUserId)!;
          conv.unread_count++;
        }
      });

      // Fetch display names only for new users
      const userIds = Array.from(conversationMap.keys());
      const newUserIds = userIds.filter(id => !userNamesMapRef.current.has(id));
      
      if (newUserIds.length > 0) {
        const { data: usersData } = await supabase
          .from('user_locations_with_roles')
          .select('user_id, display_name, show_name_on_map')
          .in('user_id', newUserIds);

        (usersData || []).forEach(u => {
          userNamesMapRef.current.set(u.user_id!, u.show_name_on_map ? u.display_name : null);
        });
      }

      const convList: Conversation[] = userIds.map(userId => ({
        user_id: userId,
        display_name: userNamesMapRef.current.get(userId) || null,
        ...conversationMap.get(userId)!
      }));

      convList.sort((a, b) => 
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );

      setConversations(convList);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      fetchInProgressRef.current = false;
      setLoading(false);
    }
  }, [user?.id]);

  // Send a message with optimistic update
  const sendMessage = async (
    receiverId: string, 
    message: string,
    audioUrl?: string | null,
    audioDurationMs?: number | null,
    imageUrl?: string | null
  ): Promise<boolean> => {
    if (!user?.id) return false;
    if (!message.trim() && !audioUrl && !imageUrl) return false;

    let displayMessage = message.trim();
    if (!displayMessage) {
      if (audioUrl) displayMessage = '🎤 Nota de voz';
      else if (imageUrl) displayMessage = '📷 Imagen';
    }

    // Create optimistic message
    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: InternalMessage = {
      id: optimisticId,
      sender_id: user.id,
      receiver_id: receiverId,
      message: displayMessage,
      read: false,
      created_at: new Date().toISOString(),
      audio_url: audioUrl || null,
      audio_duration_ms: audioDurationMs || null,
      image_url: imageUrl || null
    };

    // Optimistically add message to state
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const { data, error } = await supabase
        .from('internal_messages')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          message: displayMessage,
          audio_url: audioUrl || null,
          audio_duration_ms: audioDurationMs || null,
          image_url: imageUrl || null
        })
        .select()
        .single();

      if (error) throw error;

      // Replace optimistic message with real one
      setMessages(prev => prev.map(m => 
        m.id === optimisticId ? data : m
      ));

      // Update conversations optimistically
      setConversations(prev => {
        const existing = prev.find(c => c.user_id === receiverId);
        if (existing) {
          return prev.map(c => 
            c.user_id === receiverId 
              ? { ...c, last_message: displayMessage, last_message_at: data.created_at }
              : c
          ).sort((a, b) => 
            new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
          );
        }
        return prev;
      });

      // Send broadcast notification (fire and forget)
      supabase
        .from('profiles')
        .select('nickname, full_name')
        .eq('id', user.id)
        .single()
        .then(({ data: profileData }) => {
          const senderName = profileData?.nickname || profileData?.full_name || 'Usuario';
          const notificationChannel = supabase.channel(`user-notifications:${receiverId}`);
          notificationChannel.send({
            type: 'broadcast',
            event: 'new_message',
            payload: { senderName, messagePreview: displayMessage.substring(0, 100), senderId: user.id }
          }).finally(() => supabase.removeChannel(notificationChannel));
        });

      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      return false;
    }
  };

  // Delete own message with optimistic update
  const deleteMessage = async (messageId: string): Promise<boolean> => {
    if (!user?.id) return false;

    const originalMessages = messages;
    const originalConversations = conversations;

    const msgToDelete = originalMessages.find(m => m.id === messageId);
    const otherUserId = msgToDelete
      ? (msgToDelete.sender_id === user.id ? msgToDelete.receiver_id : msgToDelete.sender_id)
      : null;

    const nextMessages = originalMessages.filter(m => m.id !== messageId);

    // Optimistically remove message
    setMessages(nextMessages);

    // Optimistically update conversation summary (avoid full refetch)
    if (otherUserId) {
      setConversations(prev => {
        const convMsgs = nextMessages.filter(
          m => (m.sender_id === user.id && m.receiver_id === otherUserId) ||
               (m.sender_id === otherUserId && m.receiver_id === user.id)
        );

        if (convMsgs.length === 0) {
          return prev.filter(c => c.user_id !== otherUserId);
        }

        const last = convMsgs.reduce((acc, m) =>
          new Date(m.created_at).getTime() > new Date(acc.created_at).getTime() ? m : acc
        , convMsgs[0]);

        const unread = convMsgs.filter(
          m => m.sender_id === otherUserId && m.receiver_id === user.id && !m.read
        ).length;

        return prev
          .map(c =>
            c.user_id === otherUserId
              ? { ...c, last_message: last.message, last_message_at: last.created_at, unread_count: unread }
              : c
          )
          .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
      });
    }

    try {
      const { error } = await supabase
        .from('internal_messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error deleting message:', err);
      // Restore on error
      setMessages(originalMessages);
      setConversations(originalConversations);
      return false;
    }
  };

  // Clear conversation with optimistic update
  const clearConversation = async (otherUserId: string): Promise<boolean> => {
    if (!user?.id) return false;

    const originalMessages = messages;
    const originalConversations = conversations;

    const nextMessages = originalMessages.filter(
      m => !(m.sender_id === user.id && m.receiver_id === otherUserId)
    );

    // Optimistically remove own sent messages
    setMessages(nextMessages);

    // Optimistically update conversation summary (avoid full refetch)
    setConversations(prev => {
      const convMsgs = nextMessages.filter(
        m => (m.sender_id === user.id && m.receiver_id === otherUserId) ||
             (m.sender_id === otherUserId && m.receiver_id === user.id)
      );

      if (convMsgs.length === 0) {
        return prev.filter(c => c.user_id !== otherUserId);
      }

      const last = convMsgs.reduce((acc, m) =>
        new Date(m.created_at).getTime() > new Date(acc.created_at).getTime() ? m : acc
      , convMsgs[0]);

      const unread = convMsgs.filter(
        m => m.sender_id === otherUserId && m.receiver_id === user.id && !m.read
      ).length;

      return prev
        .map(c =>
          c.user_id === otherUserId
            ? { ...c, last_message: last.message, last_message_at: last.created_at, unread_count: unread }
            : c
        )
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
    });

    try {
      const { error } = await supabase
        .from('internal_messages')
        .delete()
        .eq('sender_id', user.id)
        .eq('receiver_id', otherUserId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error clearing conversation:', err);
      setMessages(originalMessages);
      setConversations(originalConversations);
      return false;
    }
  };

  // Mark messages as read with optimistic update
  const markAsRead = useCallback(async (senderId: string) => {
    if (!user?.id) return;

    // Compute from ref to avoid callback identity changing on every messages update
    const unreadFromSender = messagesRef.current.filter(
      m => m.sender_id === senderId && m.receiver_id === user.id && !m.read
    ).length;

    // Avoid no-op state updates (can cause render churn / freezes)
    if (unreadFromSender === 0) return;

    // Optimistically mark as read
    setMessages(prev => prev.map(m =>
      m.sender_id === senderId && m.receiver_id === user.id && !m.read
        ? { ...m, read: true }
        : m
    ));

    // Update unread count
    setUnreadCount(prev => Math.max(0, prev - unreadFromSender));

    // Update conversations
    setConversations(prev => prev.map(c =>
      c.user_id === senderId ? { ...c, unread_count: 0 } : c
    ));

    try {
      await supabase
        .from('internal_messages')
        .update({ read: true })
        .eq('sender_id', senderId)
        .eq('receiver_id', user.id)
        .eq('read', false);
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  }, [user?.id]);

  // Get messages for a specific conversation
  const getConversationMessages = useCallback((otherUserId: string): InternalMessage[] => {
    if (!user?.id) return [];
    return messages.filter(
      m => (m.sender_id === user.id && m.receiver_id === otherUserId) ||
           (m.sender_id === otherUserId && m.receiver_id === user.id)
    );
  }, [user?.id, messages]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) return;

    setLoading(true);
    fetchData(true);

    const channel = supabase
      .channel('internal_messages_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages',
          filter: `receiver_id=eq.${user.id}`
        },
        async (payload) => {
          const newMessage = payload.new as InternalMessage;
          
          if (newMessage && newMessage.sender_id !== user.id) {
            // Add message if not already present (avoid duplicates)
            setMessages(prev => {
              if (prev.some(m => m.id === newMessage.id)) return prev;
              return [...prev, newMessage];
            });

            // Update unread count
            setUnreadCount(prev => prev + 1);

            // Update conversations
            setConversations(prev => {
              const existing = prev.find(c => c.user_id === newMessage.sender_id);
              if (existing) {
                return prev.map(c => 
                  c.user_id === newMessage.sender_id 
                    ? { ...c, last_message: newMessage.message, last_message_at: newMessage.created_at, unread_count: c.unread_count + 1 }
                    : c
                ).sort((a, b) => 
                  new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
                );
              } else {
                // New conversation - fetch data to get user name
                fetchData();
                return prev;
              }
            });

            // Play notification sound and vibration (if not muted)
            const muted = localStorage.getItem('chat_notifications_muted') === 'true';
            if (!muted) {
              playMessageNotification();
              triggerMessageVibration();
            }
            
            // Get sender name for notification
            let senderName = senderNamesCache.current.get(newMessage.sender_id);
            
            if (!senderName) {
              const { data } = await supabase
                .from('user_locations_with_roles')
                .select('display_name, show_name_on_map')
                .eq('user_id', newMessage.sender_id)
                .single();
              
              senderName = data?.show_name_on_map && data?.display_name ? data.display_name : 'Usuario';
              senderNamesCache.current.set(newMessage.sender_id, senderName);
            }
            
            showBrowserNotification(senderName, newMessage.message, newMessage.sender_id);
            
            toast.info(`💬 ${senderName}`, {
              description: newMessage.message.substring(0, 80) + (newMessage.message.length > 80 ? '...' : ''),
              duration: 5000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'internal_messages',
          filter: `sender_id=eq.${user.id}`
        },
        (payload) => {
          // Update read status for sent messages
          const updated = payload.new as InternalMessage;
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'internal_messages'
        },
        (payload) => {
          const deleted = payload.old as { id: string };
          setMessages(prev => prev.filter(m => m.id !== deleted.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchData]);

  // Reset banner dismissed when new messages arrive
  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  const lastUnreadCountRef = useRef(unreadCount);
  
  useEffect(() => {
    if (unreadCount > lastUnreadCountRef.current) {
      setBannerDismissed(false);
    }
    lastUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  // Calculate last unread sender from conversations
  useEffect(() => {
    const unreadConv = conversations.find(c => c.unread_count > 0);
    if (unreadConv) {
      setLastUnreadSender({
        id: unreadConv.user_id,
        name: unreadConv.display_name || 'Usuario'
      });
    } else {
      setLastUnreadSender(null);
    }
  }, [conversations]);

  return {
    messages,
    conversations,
    loading,
    unreadCount,
    lastUnreadSender,
    bannerDismissed,
    dismissBanner,
    isMuted,
    toggleMute,
    sendMessage,
    deleteMessage,
    clearConversation,
    markAsRead,
    getConversationMessages,
    refetch: () => fetchData(true)
  };
};

export type InternalMessagesStore = ReturnType<typeof useInternalMessagesStore>;

export const InternalMessagesContext = createContext<InternalMessagesStore | null>(null);

export const useInternalMessages = (): InternalMessagesStore => {
  const ctx = useContext(InternalMessagesContext);
  if (!ctx) {
    throw new Error('useInternalMessages must be used within InternalMessagesProvider');
  }
  return ctx;
};

