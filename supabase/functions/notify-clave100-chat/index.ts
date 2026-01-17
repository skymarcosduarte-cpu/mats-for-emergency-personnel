import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSubscription {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the request body
    const { title, body, drillId } = await req.json();

    const notificationTitle = title || '💬 Chat Clave 100 Abierto';
    const notificationBody = body || 'Únete al chat grupal para comentar sobre el simulacro';

    console.log('[notify-clave100-chat] Sending notifications for drill:', drillId);

    // Fetch all push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth');

    if (subError) {
      console.error('[notify-clave100-chat] Error fetching subscriptions:', subError);
      throw subError;
    }

    console.log(`[notify-clave100-chat] Found ${subscriptions?.length || 0} push subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
      // No push subscriptions - fall back to checking active users for in-app notification
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: activeUsers, error: usersError } = await supabase
        .from('user_locations')
        .select('user_id')
        .gte('updated_at', twentyFourHoursAgo);

      if (usersError) {
        console.error('[notify-clave100-chat] Error fetching active users:', usersError);
      }

      console.log(`[notify-clave100-chat] Found ${activeUsers?.length || 0} active users (no push subs)`);

      return new Response(JSON.stringify({
        success: true,
        message: 'No push subscriptions available, users will see in-app notification',
        activeUsers: activeUsers?.length || 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send web push notifications
    const webPushVapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const webPushVapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!webPushVapidPublicKey || !webPushVapidPrivateKey) {
      console.log('[notify-clave100-chat] VAPID keys not configured, skipping web push');
      return new Response(JSON.stringify({
        success: true,
        message: 'VAPID keys not configured, skipping web push',
        subscriptions: subscriptions.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call send-web-push for each subscription
    let successCount = 0;
    let failCount = 0;

    for (const sub of subscriptions as PushSubscription[]) {
      try {
        const { error: pushError } = await supabase.functions.invoke('send-web-push', {
          body: {
            subscription: {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload: {
              title: notificationTitle,
              body: notificationBody,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: 'clave100-chat',
              data: {
                type: 'clave100_chat',
                drillId: drillId,
                url: '/',
              },
            },
          },
        });

        if (pushError) {
          console.error('[notify-clave100-chat] Push error for user:', sub.user_id, pushError);
          failCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error('[notify-clave100-chat] Exception sending push:', err);
        failCount++;
      }
    }

    // Update the drill to mark notifications as sent
    if (drillId) {
      await supabase
        .from('clave100_drills')
        .update({
          notification_sent_at: new Date().toISOString(),
          notified_users: successCount,
        })
        .eq('id', drillId);
    }

    console.log(`[notify-clave100-chat] Push results: ${successCount} success, ${failCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      sent: successCount,
      failed: failCount,
      total: subscriptions.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[notify-clave100-chat] Error:', errMsg);
    return new Response(JSON.stringify({
      success: false,
      error: errMsg,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
