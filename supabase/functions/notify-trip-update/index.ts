import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      tripId,
      tripUserId,
      eventType, // 'started', 'arrived', 'overdue', 'cancelled', 'eta_updated'
      origin,
      destination,
      eta,
      oldEta, // for eta_updated events
      overdueMinutes, // for overdue events
      originLat,
      originLng,
      destinationLat,
      destinationLng,
    } = await req.json();

    console.log(`[notify-trip-update] Processing ${eventType} for trip ${tripId}`, {
      tripUserId,
      origin,
      destination,
      overdueMinutes
    });

    // Get user's profile info
    const { data: profile } = await supabase
      .from('profiles')
      .select('nickname, full_name, phone')
      .eq('id', tripUserId)
      .maybeSingle();

    const userName = profile?.nickname || profile?.full_name || 'Un usuario';

    // Get all ACTIVE/ONLINE users to notify (except the trip owner)
    const { data: onlineUsers, error: usersError } = await supabase
      .from('user_locations')
      .select('user_id')
      .eq('is_online', true)
      .neq('user_id', tripUserId);

    if (usersError) {
      console.error('[notify-trip-update] Error fetching online users:', usersError);
    }

    const activeUserIds = onlineUsers?.map(u => u.user_id) || [];
    console.log(`[notify-trip-update] Found ${activeUserIds.length} active users to notify`);

    // Build notification message based on event type
    let title: string;
    let message: string;
    let notificationType: string;

    const etaFormatted = eta ? new Date(eta).toLocaleString('es-MX', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'America/Mexico_City'
    }) : 'desconocida';

    const oldEtaFormatted = oldEta ? new Date(oldEta).toLocaleString('es-MX', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'America/Mexico_City'
    }) : null;

    switch (eventType) {
      case 'started':
        title = '🚗 Nuevo viaje iniciado';
        message = `${userName} ha iniciado un viaje: ${origin} → ${destination}. ETA: ${etaFormatted}`;
        notificationType = 'trip_started';
        break;

      case 'arrived':
        title = '✅ Viaje completado';
        message = `${userName} ha llegado a su destino: ${destination}`;
        notificationType = 'trip_arrived';
        break;

      case 'overdue':
        title = '⚠️ Viaje atrasado';
        message = `${userName} debía llegar a ${destination} hace ${overdueMinutes} minutos. No ha confirmado su llegada.`;
        notificationType = 'trip_overdue';
        break;

      case 'cancelled':
        title = '🚫 Viaje cancelado';
        message = `${userName} ha cancelado su viaje a ${destination}.`;
        notificationType = 'trip_cancelled';
        break;

      case 'eta_updated':
        title = '🕐 Cambio de hora de llegada';
        message = `${userName} actualizó su ETA a ${destination}: ${etaFormatted}${oldEtaFormatted ? ` (antes: ${oldEtaFormatted})` : ''}.`;
        notificationType = 'trip_eta_updated';
        break;

      default:
        title = '📍 Actualización de viaje';
        message = `Actualización sobre el viaje de ${userName}: ${origin} → ${destination}.`;
        notificationType = 'trip_update';
    }

    // Create in-app notifications for all active users
    if (activeUserIds.length > 0) {
      const notifications = activeUserIds.map(userId => ({
        user_id: userId,
        type: notificationType,
        title,
        message,
        read: false,
        metadata: {
          trip_id: tripId,
          trip_user_id: tripUserId,
          origin,
          destination,
          origin_lat: originLat,
          origin_lng: originLng,
          destination_lat: destinationLat,
          destination_lng: destinationLng,
        }
      }));

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('[notify-trip-update] Error inserting notifications:', insertError);
      } else {
        console.log(`[notify-trip-update] Created ${notifications.length} notifications for active users`);
      }
    }

    // Create confirmation notification for the trip owner
    const ownerNotification = {
      user_id: tripUserId,
      type: `${notificationType}_confirmation`,
      title: eventType === 'started' 
        ? '✅ Viaje registrado'
        : eventType === 'arrived'
          ? '✅ Llegada confirmada'
          : eventType === 'eta_updated'
            ? '🕐 ETA actualizado'
            : eventType === 'cancelled'
              ? '🚫 Viaje cancelado'
              : '📍 Viaje actualizado',
      message: `${activeUserIds.length} usuario(s) activo(s) fueron notificados sobre tu viaje.`,
      read: false
    };

    await supabase.from('notifications').insert(ownerNotification);

    console.log(`[notify-trip-update] Completed. Notified ${activeUserIds.length} active users`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        usersNotified: activeUserIds.length,
        eventType,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[notify-trip-update] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
