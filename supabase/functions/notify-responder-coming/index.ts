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

// Transport mode configurations with icons and estimated speeds
const TRANSPORT_CONFIG: Record<string, { label: string; emoji: string; speedKmh: number }> = {
  walking: { label: 'caminando', emoji: '🚶', speedKmh: 5 },
  bicycle: { label: 'en bicicleta', emoji: '🚴', speedKmh: 15 },
  motorcycle: { label: 'en moto', emoji: '🏍️', speedKmh: 50 },
  car: { label: 'en auto', emoji: '🚗', speedKmh: 40 },
  public_transport: { label: 'en transporte público', emoji: '🚌', speedKmh: 25 },
  ambulance: { label: 'en ambulancia', emoji: '🚑', speedKmh: 60 },
};

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: WebPushPayload
): Promise<boolean> {
  // For now, we'll create in-app notifications
  // Web Push requires VAPID keys which can be added later
  console.log('Would send push to:', subscription.endpoint, 'with payload:', payload);
  return true;
}

// Calculate distance between two coordinates (Haversine)
function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
      eventType, // 'responding', 'arrived', 'resolved', 'cancelled'
      estimatedEtaMinutes,
      transportMode,
      targetUserIds, // array of user IDs to notify (for cancelled event)
      responderLat,
      responderLng,
    } = await req.json();

    console.log(`[notify-responder-coming] ${eventType} for ${alertType} ${alertId}`, {
      responderUserId,
      responderCount,
      estimatedEtaMinutes,
      transportMode
    });

    // For cancelled events, notify multiple responders
    if (eventType === 'cancelled' && targetUserIds && targetUserIds.length > 0) {
      const notifications = targetUserIds.map((userId: string) => ({
        user_id: userId,
        type: 'alert_cancelled',
        title: '⚠️ Alerta cancelada',
        message: 'La alerta a la que estabas respondiendo ha sido cancelada por el creador.',
        read: false
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('Error creating cancellation notifications:', insertError);
      }

      console.log(`Notified ${notifications.length} responders about cancellation`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          notificationsCreated: notifications.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get responder's name and location
    const { data: responderProfile } = await supabase
      .from('profiles')
      .select('nickname, full_name, can_provide_medical_assistance, has_ambulance, has_first_aid_kit')
      .eq('id', responderUserId)
      .maybeSingle();

    const responderName = responderProfile?.nickname || responderProfile?.full_name || 'Un rescatista';
    
    // Build responder credentials for notification
    const credentials: string[] = [];
    if (responderProfile?.can_provide_medical_assistance) credentials.push('👨‍⚕️ Médico');
    if (responderProfile?.has_ambulance) credentials.push('🚑 Ambulancia');
    if (responderProfile?.has_first_aid_kit) credentials.push('🩹 Botiquín');
    const credentialsText = credentials.length > 0 ? ` (${credentials.join(', ')})` : '';

    // Get alert location
    let alertLat: number | null = null;
    let alertLng: number | null = null;
    
    if (alertType === 'panic') {
      const { data: alertData } = await supabase
        .from('panic_events')
        .select('lat, lng')
        .eq('id', alertId)
        .maybeSingle();
      alertLat = alertData?.lat ?? null;
      alertLng = alertData?.lng ?? null;
    } else {
      const { data: alertData } = await supabase
        .from('help_requests')
        .select('lat, lng')
        .eq('id', alertId)
        .maybeSingle();
      alertLat = alertData?.lat ?? null;
      alertLng = alertData?.lng ?? null;
    }

    // Get responder's current location if not provided
    let respLat = responderLat;
    let respLng = responderLng;
    if (!respLat || !respLng) {
      const { data: locData } = await supabase
        .from('user_locations')
        .select('lat, lng')
        .eq('user_id', responderUserId)
        .maybeSingle();
      respLat = locData?.lat;
      respLng = locData?.lng;
    }

    // Calculate distance and ETA
    let distanceKm: number | null = null;
    let calculatedEta: number | null = estimatedEtaMinutes;
    
    if (alertLat && alertLng && respLat && respLng) {
      distanceKm = calculateDistanceKm(respLat, respLng, alertLat, alertLng);
      
      // If no ETA provided, calculate based on transport mode
      if (!calculatedEta && transportMode) {
        const transport = TRANSPORT_CONFIG[transportMode];
        if (transport) {
          calculatedEta = Math.ceil((distanceKm / transport.speedKmh) * 60);
        }
      }
    }

    // Get transport config
    const transport = transportMode ? TRANSPORT_CONFIG[transportMode] : null;

    // Determine notification content based on event type
    let title: string;
    let message: string;
    let notificationType: string;

    switch (eventType) {
      case 'responding':
        title = '🚨 ¡Ayuda en camino!';
        
        // Build detailed message
        const parts: string[] = [`${responderName}${credentialsText}`];
        
        if (transport) {
          parts.push(`viene ${transport.emoji} ${transport.label}`);
        } else {
          parts.push('está en camino');
        }
        
        if (distanceKm !== null && distanceKm < 50) {
          parts.push(`(${distanceKm.toFixed(1)} km)`);
        }
        
        if (calculatedEta !== null && calculatedEta < 120) {
          parts.push(`• ETA: ~${Math.round(calculatedEta)} min`);
        }
        
        message = responderCount > 1 
          ? `${responderCount} rescatistas están respondiendo. ${parts.join(' ')}`
          : parts.join(' ');
        notificationType = 'responder_coming';
        break;
        
      case 'arrived':
        title = '✅ ¡Rescatista llegó!';
        message = `${responderName}${credentialsText} ha llegado a tu ubicación. La ayuda está aquí.`;
        notificationType = 'responder_arrived';
        break;
        
      case 'resolved':
        title = '🎉 Alerta resuelta';
        message = `Tu alerta ha sido atendida exitosamente por ${responderName}.`;
        notificationType = 'alert_resolved';
        break;
        
      default:
        title = '📍 Actualización de alerta';
        message = 'Hay una actualización sobre tu alerta.';
        notificationType = 'alert_update';
    }

    // Create in-app notification with extra data
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
          data: { 
            alertId, 
            alertType, 
            eventType,
            responderName,
            transportMode,
            estimatedEta: calculatedEta,
            distanceKm
          }
        });
        if (success) pushSent++;
      }
    }

    console.log(`[notify-responder-coming] Notification created, ${pushSent} push sent`, {
      title,
      message,
      distanceKm,
      calculatedEta
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationCreated: !notifError,
        pushNotificationsSent: pushSent,
        responderName,
        distanceKm,
        estimatedEta: calculatedEta
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
