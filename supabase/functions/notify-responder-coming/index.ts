import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: WebPushPayload
): Promise<boolean> {
  // For now, we'll create in-app notifications
  // Web Push requires VAPID keys which can be added later
  console.log('Would send push to:', subscription.endpoint, 'with payload:', payload);
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      alertId, 
      alertType, // 'panic' or 'help_request'
      creatorUserId, 
      responderUserId,
      responderCount,
      eventType // 'responding', 'arrived', 'resolved'
    } = await req.json();

    console.log(`Notifying user ${creatorUserId} about responder for ${alertType} ${alertId}`);

    // Get responder's name
    const { data: responderProfile } = await supabase
      .from('profiles')
      .select('nickname, full_name')
      .eq('id', responderUserId)
      .maybeSingle();

    const responderName = responderProfile?.nickname || responderProfile?.full_name || 'Un rescatista';

    // Determine notification content based on event type
    let title: string;
    let message: string;
    let notificationType: string;

    switch (eventType) {
      case 'responding':
        title = '🚨 ¡Ayuda en camino!';
        message = responderCount > 1 
          ? `${responderCount} personas están respondiendo a tu alerta.`
          : `${responderName} está en camino a ayudarte.`;
        notificationType = 'responder_coming';
        break;
      case 'arrived':
        title = '✅ ¡Rescatista llegó!';
        message = `${responderName} ha llegado a tu ubicación.`;
        notificationType = 'responder_arrived';
        break;
      case 'resolved':
        title = '🎉 Alerta resuelta';
        message = 'Tu alerta ha sido marcada como resuelta.';
        notificationType = 'alert_resolved';
        break;
      default:
        title = '📍 Actualización de alerta';
        message = 'Hay una actualización sobre tu alerta.';
        notificationType = 'alert_update';
    }

    // Create in-app notification
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: creatorUserId,
        type: notificationType,
        title,
        message,
        read: false
      });

    if (notifError) {
      console.error('Error creating notification:', notifError);
    }

    // Try to send web push notification if user has subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', creatorUserId);

    let pushSent = 0;
    if (subscriptions && subscriptions.length > 0) {
      console.log(`Found ${subscriptions.length} push subscriptions for user`);
      
      for (const sub of subscriptions) {
        const success = await sendWebPush(sub, {
          title,
          body: message,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `${alertType}-${alertId}-${eventType}`,
          data: { alertId, alertType, eventType }
        });
        if (success) pushSent++;
      }
    }

    console.log(`Notification created, ${pushSent} push notifications sent`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationCreated: !notifError,
        pushNotificationsSent: pushSent 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in notify-responder-coming:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
