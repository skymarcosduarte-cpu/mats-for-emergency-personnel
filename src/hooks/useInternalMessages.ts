import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { playMessageNotification, triggerMessageVibration, playClave100Alert } from '@/lib/alertSound';
import { triggerClave100Notification } from './useClave100Notification';
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
  
  // Used to avoid playing sounds/toasts on the initial hydration fetch
  const hasHydratedRef = useRef(false);

  // Prevent double notifications between realtime + polling fetches
  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());
  const lastNotifiedAtRef = useRef<number>(0);
  const notifyCooldownUntilRef = useRef<number>(0);

  // Realtime health tracking (used for auto-reconnect + debugging)
  const realtimeStatusRef = useRef<string>('INIT');
  const lastRealtimeEventAtRef = useRef<number>(0);

  // Burst mode: collect rapid messages into a single notification
  const BURST_WINDOW_MS = 3000; // 3 seconds window
  const burstQueueRef = useRef<{ senderId: string; senderName: string; message: string; isClave100: boolean }[]>([]);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const burstSoundPlayedRef = useRef<boolean>(false);

  // Process burst queue - show grouped toast
  const processBurstQueue = useCallback(() => {
    const queue = burstQueueRef.current;
    if (queue.length === 0) return;

    // Check if any message in burst is Clave100
    const hasClave100 = queue.some(m => m.isClave100);
    
    if (queue.length === 1) {
      // Single message - show normal toast
      const msg = queue[0];
      if (msg.isClave100) {
        toast.error(`🚨 CLAVE 100 de ${msg.senderName}`, {
          description: msg.message.substring(0, 100) + (msg.message.length > 100 ? '...' : ''),
          duration: 15000,
        });
      } else {
        toast.info(`💬 ${msg.senderName}`, {
          description: msg.message.substring(0, 80) + (msg.message.length > 80 ? '...' : ''),
          duration: 5000,
        });
      }
    } else {
      // Multiple messages - grouped toast
      const uniqueSenders = [...new Set(queue.map(m => m.senderName))];
      const senderText = uniqueSenders.length === 1 
        ? uniqueSenders[0] 
        : uniqueSenders.slice(0, 2).join(', ') + (uniqueSenders.length > 2 ? ` y ${uniqueSenders.length - 2} más` : '');
      
      if (hasClave100) {
        toast.error(`🚨 ${queue.length} mensajes (incluye CLAVE 100)`, {
          description: `De: ${senderText}`,
          duration: 15000,
        });
      } else {
        toast.info(`💬 ${queue.length} mensajes nuevos`, {
          description: `De: ${senderText}`,
          duration: 5000,
        });
      }
    }

    // Clear queue
    burstQueueRef.current = [];
    burstSoundPlayedRef.current = false;
    burstTimerRef.current = null;
  }, []);

  // Add message to burst queue
  const queueBurstNotification = useCallback((
    senderId: string,
    senderName: string,
    message: string,
    isClave100: boolean,
    playSound: boolean
  ) => {
    // Add to queue
    burstQueueRef.current.push({ senderId, senderName, message, isClave100 });

    // Play sound only once per burst (unless Clave100 - always play)
    if (playSound && (!burstSoundPlayedRef.current || isClave100)) {
      const muted = localStorage.getItem('chat_notifications_muted') === 'true';
      
      if (!muted || isClave100) {
        if (isClave100) {
          playClave100Alert();
        } else {
          playMessageNotification();
          triggerMessageVibration();
        }
      }
      burstSoundPlayedRef.current = true;
    }

    // Reset timer on each new message to extend burst window
    if (burstTimerRef.current) {
      clearTimeout(burstTimerRef.current);
    }

    // Schedule processing after burst window
    burstTimerRef.current = setTimeout(() => {
      processBurstQueue();
    }, BURST_WINDOW_MS);
  }, [processBurstQueue]);
  
  // Clave 100 overlay state
  const [clave100Alert, setClave100Alert] = useState<{
    isVisible: boolean;
    senderName: string;
    senderId: string;
    message: string;
    imageUrl: string | null;
    audioUrl: string | null;
    audioDurationMs: number | null;
  } | null>(null);
  
  const dismissClave100 = useCallback(() => {
    setClave100Alert(null);
  }, []);
  
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
      const prevIds = new Set(messagesRef.current.map((m) => m.id));

      const { data, error } = await supabase
        .from('internal_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messagesData = data || [];

      // Detect new, unread incoming messages that might have been missed by realtime.
      // IMPORTANT: avoid notifying on initial hydration.
      const newUnreadIncoming = hasHydratedRef.current
        ? messagesData.filter(
            (m) =>
              m.receiver_id === user.id &&
              !m.read &&
              m.sender_id !== user.id &&
              !prevIds.has(m.id) &&
              !notifiedMessageIdsRef.current.has(m.id),
          )
        : [];

      setMessages(messagesData);

      // Calculate unread count
      const unread = messagesData.filter((m) => m.receiver_id === user.id && !m.read).length;
      setUnreadCount(unread);

      // Build conversations from messages
      const conversationMap = new Map<
        string,
        {
          last_message: string;
          last_message_at: string;
          unread_count: number;
        }
      >();

      // Sort by date descending for conversation building
      const sortedForConv = [...messagesData].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      sortedForConv.forEach((msg) => {
        const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;

        if (!conversationMap.has(otherUserId)) {
          conversationMap.set(otherUserId, {
            last_message: msg.message,
            last_message_at: msg.created_at,
            unread_count: 0,
          });
        }

        if (msg.receiver_id === user.id && !msg.read) {
          const conv = conversationMap.get(otherUserId)!;
          conv.unread_count++;
        }
      });

      // Fetch display names only for new users
      const userIds = Array.from(conversationMap.keys());
      const newUserIds = userIds.filter((id) => !userNamesMapRef.current.has(id));

      if (newUserIds.length > 0) {
        // First try user_locations_with_roles (for users sharing location)
        const { data: usersData } = await supabase
          .from('user_locations_with_roles')
          .select('user_id, display_name, show_name_on_map')
          .in('user_id', newUserIds);

        (usersData || []).forEach((u) => {
          userNamesMapRef.current.set(u.user_id!, u.show_name_on_map ? u.display_name : null);
        });

        // Fallback to profiles for users not found in the view (e.g. share_location=false)
        const missingIds = newUserIds.filter((id) => !userNamesMapRef.current.has(id));
        if (missingIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, nickname')
            .in('id', missingIds);

          (profilesData || []).forEach((p) => {
            userNamesMapRef.current.set(p.id, p.nickname || null);
          });
        }
      }

      const convList: Conversation[] = userIds.map((userId) => ({
        user_id: userId,
        display_name: userNamesMapRef.current.get(userId) || null,
        ...conversationMap.get(userId)!,
      }));

      convList.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

      setConversations(convList);

      // Fallback notifications (polling path): if realtime silently dropped, we still notify.
      // IMPORTANT: this must be extremely strict to avoid loops.
      if (newUnreadIncoming.length > 0) {
        const candidates = newUnreadIncoming
          .map((m) => ({ m, t: new Date(m.created_at).getTime() }))
          .filter(({ t }) => t > lastNotifiedAtRef.current);

        // Mark all as "seen" for notification purposes so we never spam.
        for (const { m } of candidates) {
          notifiedMessageIdsRef.current.add(m.id);
        }

        if (candidates.length > 0) {
          lastNotifiedAtRef.current = Math.max(...candidates.map((c) => c.t));

          // Cooldown: prevents bursts if fetchData runs repeatedly.
          const nowMs = Date.now();
          if (nowMs < notifyCooldownUntilRef.current) {
            console.log('🔇 [PollingNotify] Cooldown active, skipping sound/toast');
          } else {
            notifyCooldownUntilRef.current = nowMs + 1500;

            try {
              const { unlockAudioContext } = await import('@/lib/alertSound');
              await unlockAudioContext();
            } catch (e) {
              console.warn('🔇 [PollingNotify] Could not unlock audio context:', e);
            }

            // Use burst mode: queue all candidates and let burst system handle grouping
            for (const { m } of candidates) {
              const isClave100 =
                m.message.includes('🚨 CLAVE 100') || m.message.includes('CLAVE 100 - EMERGENCIA');

              let senderName = senderNamesCache.current.get(m.sender_id);
              if (!senderName) {
                const conv = convList.find((c) => c.user_id === m.sender_id);
                senderName = conv?.display_name || 'Usuario';
                senderNamesCache.current.set(m.sender_id, senderName);
              }

              // Clave100 always gets special treatment
              if (isClave100) {
                triggerClave100Notification(senderName, m.message, m.sender_id);
                setClave100Alert({
                  isVisible: true,
                  senderName,
                  senderId: m.sender_id,
                  message: m.message,
                  imageUrl: m.image_url || null,
                  audioUrl: m.audio_url || null,
                  audioDurationMs: m.audio_duration_ms || null,
                });
              }

              // Queue for burst notification (sound only on first message of burst)
              queueBurstNotification(m.sender_id, senderName, m.message, isClave100, true);

              showBrowserNotification(
                isClave100 ? '🚨 CLAVE 100 - EMERGENCIA' : senderName,
                m.message,
                m.sender_id,
              );
            }
          }
        }
      }

      hasHydratedRef.current = true;
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      fetchInProgressRef.current = false;
      setLoading(false);
    }
  }, [user?.id, queueBurstNotification]);

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

      // Send push notification via edge function (fire and forget) 
      setTimeout(async () => {
        try {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('nickname, full_name')
            .eq('id', user.id)
            .single();
          
          const senderName = profileData?.nickname || profileData?.full_name || 'Usuario';
          
          // First, send broadcast for in-app notification
          const notificationChannel = supabase.channel(`user-notifications:${receiverId}`);
          await notificationChannel.send({
            type: 'broadcast',
            event: 'new_message',
            payload: { senderName, messagePreview: displayMessage.substring(0, 100), senderId: user.id }
          });
          supabase.removeChannel(notificationChannel);
          
          // Then, send real Web Push via edge function (for background delivery)
          const isClave100 = displayMessage.includes('🚨 CLAVE 100') || displayMessage.includes('CLAVE 100 - EMERGENCIA');
          await supabase.functions.invoke('send-message-push', {
            body: {
              receiverId,
              senderName,
              messagePreview: displayMessage.substring(0, 100),
              senderId: user.id,
              alertType: isClave100 ? 'PANIC' : 'MESSAGE'
            }
          });
        } catch (e) {
          // Ignore errors for background notification
          console.warn('[InternalMessages] Push notification failed:', e);
        }
      }, 0);

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

  // Get messages for a specific conversation - uses ref to prevent callback identity changes
  const getConversationMessages = useCallback((otherUserId: string): InternalMessage[] => {
    if (!user?.id) return [];
    return messagesRef.current.filter(
      m => (m.sender_id === user.id && m.receiver_id === otherUserId) ||
           (m.sender_id === otherUserId && m.receiver_id === user.id)
    );
  }, [user?.id]);

  // Subscribe to realtime updates (auto-reconnect). This is what powers in-app chat notifications.
  useEffect(() => {
    if (!user?.id) return;

    setLoading(true);
    fetchData(true);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimer: number | null = null;
    let healthTimer: number | null = null;
    let cancelled = false;
    let reconnectAttempts = 0;

    const clearTimers = () => {
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (healthTimer) window.clearInterval(healthTimer);
      reconnectTimer = null;
      healthTimer = null;
    };

    const scheduleReconnect = (reason: string) => {
      if (cancelled) return;

      const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts)); // 1s, 2s, 4s… max 30s
      reconnectAttempts = Math.min(reconnectAttempts + 1, 10);

      console.warn('🔁 [Realtime] Scheduling reconnect:', { reason, delay, reconnectAttempts });

      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(() => {
        if (!cancelled) setupChannel('scheduled_reconnect');
      }, delay);
    };

    const setupChannel = (cause: string) => {
      if (cancelled) return;

      try {
        if (channel) {
          console.log('🧹 [Realtime] Removing existing channel before resubscribe');
          supabase.removeChannel(channel);
          channel = null;
        }

        console.log('📡 [Realtime] Subscribing internal_messages channel', { cause, userId: user.id });

        channel = supabase
          .channel(`internal_messages_changes:${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'internal_messages',
              filter: `receiver_id=eq.${user.id}`,
            },
            async (payload) => {
              lastRealtimeEventAtRef.current = Date.now();

              const newMessage = payload.new as InternalMessage;
              if (!newMessage) return;
              if (newMessage.sender_id === user.id) return;

              // De-dupe: never notify twice for the same message id
              if (notifiedMessageIdsRef.current.has(newMessage.id)) {
                console.log('🧯 [Realtime] Duplicate message event ignored:', newMessage.id);
                return;
              }

              notifiedMessageIdsRef.current.add(newMessage.id);
              const newMessageAt = new Date(newMessage.created_at).getTime();
              if (newMessageAt > lastNotifiedAtRef.current) {
                lastNotifiedAtRef.current = newMessageAt;
              }

              console.log('📨 [Realtime] New message received via postgres_changes');

              // Add message if not already present (avoid duplicates)
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
              });

              // Update unread count
              setUnreadCount((prev) => prev + 1);

              // Update conversations
              setConversations((prev) => {
                const existing = prev.find((c) => c.user_id === newMessage.sender_id);
                if (existing) {
                  return prev
                    .map((c) =>
                      c.user_id === newMessage.sender_id
                        ? {
                            ...c,
                            last_message: newMessage.message,
                            last_message_at: newMessage.created_at,
                            unread_count: c.unread_count + 1,
                          }
                        : c,
                    )
                    .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
                }

                // New conversation - fetch data to get user name
                fetchData();
                return prev;
              });

              // Check if it's a Clave 100 message
              const isClave100 =
                newMessage.message.includes('🚨 CLAVE 100') || newMessage.message.includes('CLAVE 100 - EMERGENCIA');

              console.log('📨 New message details:', {
                isClave100,
                messagePreview: newMessage.message.substring(0, 50),
                senderId: newMessage.sender_id,
                documentVisible: document.visibilityState,
              });

              // Cooldown check - prevents immediate duplicate sound if fetchData also runs
              const nowMs = Date.now();
              if (nowMs < notifyCooldownUntilRef.current) {
                console.log('🔇 [Realtime] Cooldown active, skipping notification');
                return;
              }
              notifyCooldownUntilRef.current = nowMs + 500; // Short cooldown, burst queue handles grouping

              try {
                const { unlockAudioContext } = await import('@/lib/alertSound');
                await unlockAudioContext();
                console.log('🔊 Audio context unlocked before playing notification');
              } catch (e) {
                console.warn('🔇 Could not unlock audio context:', e);
              }

              // Get sender name for notification (with error protection)
              let senderName = senderNamesCache.current.get(newMessage.sender_id);

              if (!senderName) {
                try {
                  // Try user_locations_with_roles first
                  const { data } = await supabase
                    .from('user_locations_with_roles')
                    .select('display_name, show_name_on_map')
                    .eq('user_id', newMessage.sender_id)
                    .single();

                  senderName = data?.show_name_on_map && data?.display_name ? data.display_name : null;

                  // Fallback to profiles if not found (e.g. share_location=false)
                  if (!senderName) {
                    const { data: profile } = await supabase
                      .from('profiles')
                      .select('nickname')
                      .eq('id', newMessage.sender_id)
                      .single();
                    senderName = profile?.nickname || 'Usuario';
                  }

                  senderNamesCache.current.set(newMessage.sender_id, senderName);
                } catch (e) {
                  console.warn('[Realtime] Failed to fetch sender name, using default:', e);
                  senderName = 'Usuario';
                }
              }

              // Trigger native notification for Clave 100 (works in background)
              if (isClave100) {
                console.log('🚨 Triggering native Clave 100 notification');
                triggerClave100Notification(senderName, newMessage.message, newMessage.sender_id);
                setClave100Alert({
                  isVisible: true,
                  senderName,
                  senderId: newMessage.sender_id,
                  message: newMessage.message,
                  imageUrl: newMessage.image_url || null,
                  audioUrl: newMessage.audio_url || null,
                  audioDurationMs: newMessage.audio_duration_ms || null,
                });
              }

              showBrowserNotification(
                isClave100 ? '🚨 CLAVE 100 - EMERGENCIA' : senderName,
                newMessage.message,
                newMessage.sender_id,
              );

              // Use burst queue for sound and toast (groups rapid messages)
              console.log('📨 [Realtime] Queueing message for burst notification');
              queueBurstNotification(
                newMessage.sender_id,
                senderName,
                newMessage.message,
                isClave100,
                true
              );
            },
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'internal_messages',
              filter: `sender_id=eq.${user.id}`,
            },
            (payload) => {
              lastRealtimeEventAtRef.current = Date.now();
              const updated = payload.new as InternalMessage;
              setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            },
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'internal_messages',
            },
            (payload) => {
              lastRealtimeEventAtRef.current = Date.now();
              const deleted = payload.old as { id: string };
              setMessages((prev) => prev.filter((m) => m.id !== deleted.id));
            },
          )
          .subscribe((status) => {
            realtimeStatusRef.current = status;
            console.log('📡 [Realtime] internal_messages status:', status);

            if (status === 'SUBSCRIBED') {
              reconnectAttempts = 0;
              setLoading(false);
              return;
            }

            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              scheduleReconnect(status);
            }
          });
      } catch (err) {
        console.error('❌ [Realtime] Failed to setup channel:', err);
        scheduleReconnect('setup_failed');
      }
    };

    // Initial subscribe
    setupChannel('initial');

    // Refetch + resubscribe when coming back to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ App became visible - refetching + checking realtime');
        fetchData(true);
        if (realtimeStatusRef.current !== 'SUBSCRIBED') {
          setupChannel('visibility_refocus');
        }
      }
    };

    // Resubscribe when network comes back
    const handleOnline = () => {
      console.log('🌐 Back online - refetching + resubscribing realtime');
      fetchData(true);
      setupChannel('online');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    // Health check: if channel drops silently, re-subscribe.
    healthTimer = window.setInterval(() => {
      if (cancelled) return;

      const status = realtimeStatusRef.current;
      if (status !== 'SUBSCRIBED') {
        console.warn('🩺 [Realtime] Healthcheck detected non-subscribed state:', status);
        setupChannel('healthcheck_not_subscribed');
        return;
      }

      // Also refetch occasionally to catch missed messages.
      // In foreground we poll more aggressively because mobile OSes can silently pause sockets.
      const sinceLastEventMs = Date.now() - (lastRealtimeEventAtRef.current || 0);
      const thresholdMs = document.visibilityState === 'visible' ? 25_000 : 120_000;
      if (sinceLastEventMs > thresholdMs) {
        fetchData();
      }
    }, 30000);

    return () => {
      cancelled = true;
      clearTimers();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (channel) supabase.removeChannel(channel);
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

  // Expose realtime status for debugging indicator
  const [realtimeStatus, setRealtimeStatus] = useState<string>('INIT');
  
  // Sync internal ref to exposed state
  useEffect(() => {
    const interval = setInterval(() => {
      if (realtimeStatusRef.current !== realtimeStatus) {
        setRealtimeStatus(realtimeStatusRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [realtimeStatus]);

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
    refetch: () => fetchData(true),
    clave100Alert,
    dismissClave100,
    realtimeStatus
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

