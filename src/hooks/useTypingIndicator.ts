import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TypingState {
  [conversationKey: string]: boolean;
}

export const useTypingIndicator = (selectedUserId: string | null) => {
  const { user } = useAuth();
  const [othersTyping, setOthersTyping] = useState<TypingState>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Create a unique channel for this conversation pair
  const getChannelName = useCallback((userId1: string, userId2: string) => {
    // Sort to ensure same channel for both users
    const sorted = [userId1, userId2].sort();
    return `typing:${sorted[0]}:${sorted[1]}`;
  }, []);

  // Subscribe to typing events for the selected conversation
  useEffect(() => {
    if (!user?.id || !selectedUserId) return;

    const channelName = getChannelName(user.id, selectedUserId);
    
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false }
      }
    });

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, isTyping } = payload.payload;
        
        // Only show typing for the other user
        if (userId !== user.id) {
          setOthersTyping(prev => ({
            ...prev,
            [userId]: isTyping
          }));

          // Auto-clear typing after 3 seconds if no update
          if (isTyping) {
            setTimeout(() => {
              setOthersTyping(prev => ({
                ...prev,
                [userId]: false
              }));
            }, 3000);
          }
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [user?.id, selectedUserId, getChannelName]);

  // Broadcast typing status (debounced)
  const sendTyping = useCallback((isTyping: boolean) => {
    if (!channelRef.current || !user?.id) return;

    const now = Date.now();
    
    // Debounce: only send if 500ms have passed since last send
    if (isTyping && now - lastTypingSentRef.current < 500) return;
    
    lastTypingSentRef.current = now;

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, isTyping }
    });

    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-send "stopped typing" after 2 seconds of no activity
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: user?.id, isTyping: false }
        });
      }, 2000);
    }
  }, [user?.id]);

  // Check if the selected user is typing
  const isUserTyping = selectedUserId ? (othersTyping[selectedUserId] ?? false) : false;

  // Cleanup
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    isUserTyping,
    sendTyping
  };
};
