import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { playMessageNotification } from '@/lib/alertSound';

export interface InternalMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface Conversation {
  user_id: string;
  display_name: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export const useInternalMessages = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastMessageCountRef = useRef<number>(0);
  const initialLoadDoneRef = useRef<boolean>(false);

  // Fetch all messages for the current user
  const fetchMessages = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('internal_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Calculate unread count
      const unread = (data || []).filter(
        m => m.receiver_id === user.id && !m.read
      ).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Fetch conversations (grouped by user)
  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('internal_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Group by other user
      const conversationMap = new Map<string, {
        last_message: string;
        last_message_at: string;
        unread_count: number;
      }>();

      (messagesData || []).forEach(msg => {
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

      // Fetch display names for all users in conversations
      const userIds = Array.from(conversationMap.keys());
      
      if (userIds.length === 0) {
        setConversations([]);
        return;
      }

      // Get names from user_locations_with_roles view
      const { data: usersData } = await supabase
        .from('user_locations_with_roles')
        .select('user_id, display_name, show_name_on_map')
        .in('user_id', userIds);

      const userNameMap = new Map<string, string | null>();
      (usersData || []).forEach(u => {
        userNameMap.set(u.user_id!, u.show_name_on_map ? u.display_name : null);
      });

      const convList: Conversation[] = Array.from(conversationMap.entries()).map(([userId, data]) => ({
        user_id: userId,
        display_name: userNameMap.get(userId) || null,
        ...data
      }));

      // Sort by last message date
      convList.sort((a, b) => 
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );

      setConversations(convList);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  }, [user?.id]);

  // Send a message
  const sendMessage = async (receiverId: string, message: string): Promise<boolean> => {
    if (!user?.id || !message.trim()) return false;

    try {
      const { error } = await supabase
        .from('internal_messages')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          message: message.trim()
        });

      if (error) throw error;
      
      await fetchMessages();
      await fetchConversations();
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      return false;
    }
  };

  // Mark messages as read
  const markAsRead = async (senderId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('internal_messages')
        .update({ read: true })
        .eq('sender_id', senderId)
        .eq('receiver_id', user.id)
        .eq('read', false);

      if (error) throw error;
      
      await fetchMessages();
      await fetchConversations();
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  // Get messages for a specific conversation
  const getConversationMessages = (otherUserId: string): InternalMessage[] => {
    if (!user?.id) return [];
    return messages.filter(
      m => (m.sender_id === user.id && m.receiver_id === otherUserId) ||
           (m.sender_id === otherUserId && m.receiver_id === user.id)
    );
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) return;

    console.log('[InternalMessages] Setting up realtime subscription for user:', user.id);

    fetchMessages();
    fetchConversations();

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
        (payload) => {
          console.log('[InternalMessages] Received INSERT event:', payload);
          // Play notification for new incoming message
          const newMessage = payload.new as InternalMessage;
          if (newMessage && newMessage.sender_id !== user.id) {
            console.log('[InternalMessages] Playing notification for new message from:', newMessage.sender_id);
            playMessageNotification();
          }
          fetchMessages();
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'internal_messages',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          fetchMessages();
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_messages',
          filter: `sender_id=eq.${user.id}`
        },
        () => {
          fetchMessages();
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchMessages, fetchConversations]);

  return {
    messages,
    conversations,
    loading,
    unreadCount,
    sendMessage,
    markAsRead,
    getConversationMessages,
    refetch: fetchMessages
  };
};
