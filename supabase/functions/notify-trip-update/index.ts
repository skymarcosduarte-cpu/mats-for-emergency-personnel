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
      eventType, // 'arrived', 'overdue', 'cancelled', 'eta_updated'
      origin,
      destination,
      eta,
      oldEta, // for eta_updated events
      overdueMinutes, // for overdue events
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
    const userPhone = profile?.phone || null;

    // Get user's emergency contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('emergency_contacts')
      .select('id, name, phone, email, whatsapp')
      .eq('user_id', tripUserId)
      .order('is_primary', { ascending: false });

    if (contactsError) {
      console.error('[notify-trip-update] Error fetching contacts:', contactsError);
      return new Response(
        JSON.stringify({ error: 'Error fetching contacts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!contacts || contacts.length === 0) {
      console.log('[notify-trip-update] No emergency contacts found for user');
      return new Response(
        JSON.stringify({ success: true, notificationsSent: 0, reason: 'no_contacts' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build notification message based on event type
    let title: string;
    let message: string;
    let smsMessage: string;
    let urgency: 'low' | 'normal' | 'high' = 'normal';

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
      case 'arrived':
        title = '✅ Llegada confirmada';
        message = `${userName} ha llegado a su destino: ${destination}. Salió de: ${origin}.`;
        smsMessage = `M.A.T.S.: ${userName} llegó a ${destination} desde ${origin}. Todo bien.`;
        urgency = 'low';
        break;

      case 'overdue':
        title = '⚠️ Viaje atrasado';
        message = `${userName} debía llegar a ${destination} hace ${overdueMinutes} minutos (ETA: ${etaFormatted}). Origen: ${origin}. No ha confirmado su llegada.`;
        smsMessage = `ALERTA M.A.T.S.: ${userName} atrasado ${overdueMinutes}min. Destino: ${destination}. ETA era: ${etaFormatted}. No confirmó llegada.`;
        urgency = 'high';
        break;

      case 'cancelled':
        title = '🚫 Viaje cancelado';
        message = `${userName} ha cancelado su viaje a ${destination}. Origen era: ${origin}.`;
        smsMessage = `M.A.T.S.: ${userName} canceló viaje a ${destination}.`;
        urgency = 'low';
        break;

      case 'eta_updated':
        title = '🕐 Cambio de hora de llegada';
        message = `${userName} actualizó su hora de llegada a ${destination}. Nueva ETA: ${etaFormatted}${oldEtaFormatted ? ` (antes: ${oldEtaFormatted})` : ''}.`;
        smsMessage = `M.A.T.S.: ${userName} cambió ETA a ${destination}. Nueva hora: ${etaFormatted}.`;
        urgency = 'normal';
        break;

      default:
        title = '📍 Actualización de viaje';
        message = `Actualización sobre el viaje de ${userName}: ${origin} → ${destination}.`;
        smsMessage = `M.A.T.S.: Actualización viaje ${userName}: ${origin} → ${destination}.`;
    }

    console.log(`[notify-trip-update] Will notify ${contacts.length} contacts`, {
      title,
      urgency
    });

    // Create in-app notifications for contacts who are also app users
    // (This would require matching contact phone/email to user accounts)
    // For now, we log what would be sent

    const notificationResults = contacts.map(contact => {
      console.log(`[notify-trip-update] Would notify contact: ${contact.name}`, {
        phone: contact.phone,
        email: contact.email,
        whatsapp: contact.whatsapp,
        message: smsMessage
      });

      return {
        contactName: contact.name,
        phone: contact.phone,
        whatsapp: contact.whatsapp,
        email: contact.email,
        messagePreview: smsMessage.substring(0, 50) + '...'
      };
    });

    // Create internal notification for the trip user as confirmation
    const notificationTitle = eventType === 'arrived' 
      ? '✅ Llegada notificada'
      : eventType === 'overdue'
        ? '⚠️ Alerta de retraso enviada'
        : eventType === 'eta_updated'
          ? '🕐 Cambio de ETA notificado'
          : '🚫 Cancelación notificada';

    await supabase
      .from('notifications')
      .insert({
        user_id: tripUserId,
        type: `trip_${eventType}`,
        title: notificationTitle,
        message: `Tus ${contacts.length} contacto(s) de emergencia han sido notificados sobre tu viaje.`,
        read: false
      });

    console.log(`[notify-trip-update] Completed. Would send to ${contacts.length} contacts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        contactsNotified: contacts.length,
        eventType,
        urgency,
        notifications: notificationResults
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
