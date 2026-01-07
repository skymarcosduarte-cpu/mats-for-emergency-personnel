import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    // Validate VAPID keys exist
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('[send-message-push] VAPID keys not configured');
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Configure web-push with VAPID keys
    webpush.setVapidDetails(
      'mailto:soporte@mats.app',
      vapidPublicKey,
      vapidPrivateKey
    );

    // Validate JWT and get authenticated user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[send-message-push] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth context to validate JWT
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error('[send-message-push] Invalid authentication:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { receiverId, senderName, messagePreview, senderId, alertType } = await req.json();

    if (!receiverId || !senderName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Permission validation: senderId (if provided) must match authenticated user
    if (senderId && senderId !== user.id) {
      console.error('[send-message-push] Permission denied: cannot send push as another user');
      return new Response(
        JSON.stringify({ error: 'Permission denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-message-push] Sending push to ${receiverId} from ${user.id}`);

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get push subscriptions for the receiver
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', receiverId);

    if (subError) {
      console.error('[send-message-push] Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[send-message-push] No push subscriptions found for user:', receiverId);
      
      // Fallback: send via realtime broadcast (works when app is open)
      try {
        const channel = supabase.channel(`user-notifications:${receiverId}`);
        await channel.send({
          type: 'broadcast',
          event: 'new_message',
          payload: { senderName, messagePreview, senderId: user.id },
        });
        await supabase.removeChannel(channel);
      } catch (e) {
        console.warn('[send-message-push] Broadcast fallback failed:', e);
      }
      
      return new Response(
        JSON.stringify({ success: true, message: 'No push subs, sent broadcast fallback' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isClave100 = alertType === 'CLAVE100';
    const pushPayload = JSON.stringify({
      title: isClave100 ? `🚨 CLAVE 100 - ${senderName}` : `💬 Mensaje de ${senderName}`,
      body: messagePreview || 'Tienes un nuevo mensaje',
      icon: '/icon-192-v2.png',
      badge: '/icon-192-v2.png',
      tag: isClave100 ? 'clave100-emergency' : `message-${user.id}-${Date.now()}`,
      alertType: alertType || 'MESSAGE',
      data: {
        type: 'internal_message',
        senderId: user.id,
        alertType: alertType || 'MESSAGE',
        url: '/community',
      }
    });

    const pushOptions = {
      TTL: 86400, // 24 hours
      urgency: isClave100 || alertType === 'PANIC' ? 'high' as const : 'normal' as const,
    };

    // Send push notifications using web-push library
    const results = await Promise.all(
      subscriptions.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          // Reconstruct the subscription object for web-push
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            }
          };

          console.log(`[send-message-push] Sending to: ${sub.endpoint.substring(0, 60)}...`);

          await webpush.sendNotification(pushSubscription, pushPayload, pushOptions);
          
          console.log(`[send-message-push] Success for subscription ${sub.id}`);
          return { success: true, id: sub.id };
        } catch (error: unknown) {
          const err = error as { statusCode?: number; message?: string };
          console.error(`[send-message-push] Error for ${sub.id}:`, err.message || error);
          
          // If subscription is invalid (410 Gone or 404), remove it
          if (err.statusCode === 404 || err.statusCode === 410) {
            console.log('[send-message-push] Removing invalid subscription:', sub.id);
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
          }
          
          return { success: false, id: sub.id, status: err.statusCode, error: err.message };
        }
      })
    );

    const successCount = results.filter((r: { success: boolean }) => r.success).length;
    console.log(`[send-message-push] Sent ${successCount}/${subscriptions.length} push notifications`);

    // Also send broadcast as backup for foreground delivery
    try {
      const channel = supabase.channel(`user-notifications:${receiverId}`);
      await channel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: { senderName, messagePreview, senderId: user.id },
      });
      await supabase.removeChannel(channel);
    } catch (_e) {
      // Broadcast is just a backup, don't fail on error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount, 
        total: subscriptions.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[send-message-push] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
