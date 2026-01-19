import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Delay threshold in minutes before sending push
const OVERDUE_THRESHOLD_MINUTES = 30;

interface OverdueTrip {
  id: string;
  user_id: string;
  origin: string;
  destination: string;
  eta: string;
  minutes_overdue: number;
  traveler_nickname?: string;
  traveler_phone?: string;
}

interface EmergencyContact {
  user_id: string;
  name: string;
  phone: string;
  whatsapp?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[push-overdue-trips] Starting overdue trips push check...');

    // Find active trips where ETA has passed by more than threshold
    const thresholdTime = new Date(Date.now() - OVERDUE_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    
    const { data: overdueTrips, error: tripsError } = await supabase
      .from('transit_trips')
      .select('id, user_id, origin, destination, eta, destination_lat, destination_lng')
      .eq('status', 'ACTIVE')
      .lt('eta', thresholdTime);

    if (tripsError) {
      console.error('[push-overdue-trips] Error fetching trips:', tripsError);
      throw tripsError;
    }

    if (!overdueTrips || overdueTrips.length === 0) {
      console.log('[push-overdue-trips] No overdue trips found');
      return new Response(
        JSON.stringify({ success: true, overdueCount: 0, pushSent: 0, contactsNotified: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();
    const userIds = [...new Set(overdueTrips.map(t => t.user_id))];

    // Fetch traveler profiles for nicknames
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nickname, phone')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, { nickname: p.nickname, phone: p.phone }]) || []);

    const tripsWithDelay: OverdueTrip[] = overdueTrips.map(trip => {
      const profile = profileMap.get(trip.user_id);
      return {
        ...trip,
        minutes_overdue: Math.floor((now - new Date(trip.eta).getTime()) / 60000),
        traveler_nickname: profile?.nickname || 'Viajero',
        traveler_phone: profile?.phone,
      };
    });

    console.log(`[push-overdue-trips] Found ${tripsWithDelay.length} overdue trips`);

    // Check which trips have been notified recently (last 4 hours) to avoid spam
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    
    const { data: recentNotifications } = await supabase
      .from('notifications')
      .select('user_id, type')
      .in('type', ['overdue_push_reminder', 'overdue_contact_alert'])
      .gte('created_at', fourHoursAgo);

    const recentlyNotifiedTravelers = new Set(
      recentNotifications?.filter(n => n.type === 'overdue_push_reminder').map(n => n.user_id) || []
    );
    const recentlyNotifiedContacts = new Set(
      recentNotifications?.filter(n => n.type === 'overdue_contact_alert').map(n => n.user_id) || []
    );

    // Filter trips for traveler notifications
    const tripsToNotifyTraveler = tripsWithDelay.filter(trip => !recentlyNotifiedTravelers.has(trip.user_id));
    // Filter trips for contact notifications (we still notify contacts even if traveler was notified)
    const tripsToNotifyContacts = tripsWithDelay.filter(trip => !recentlyNotifiedContacts.has(trip.user_id));

    // Get push subscriptions for trip owners
    const { data: pushSubscriptions } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', userIds);

    const subscriptionMap = new Map<string, { endpoint: string; p256dh: string; auth: string }>();
    pushSubscriptions?.forEach(sub => {
      subscriptionMap.set(sub.user_id, {
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
      });
    });

    // Get emergency contacts for all overdue travelers
    const { data: emergencyContacts } = await supabase
      .from('emergency_contacts')
      .select('user_id, name, phone, whatsapp')
      .in('user_id', userIds)
      .eq('is_primary', true);

    const contactsByUser = new Map<string, EmergencyContact[]>();
    emergencyContacts?.forEach(contact => {
      const existing = contactsByUser.get(contact.user_id) || [];
      existing.push(contact);
      contactsByUser.set(contact.user_id, existing);
    });

    // Also get push subscriptions for emergency contacts (if they have accounts)
    // We'll use the phone number to try to match them to user accounts
    const contactPhones = emergencyContacts?.map(c => c.phone) || [];
    const { data: contactProfiles } = await supabase
      .from('profiles')
      .select('id, phone')
      .in('phone', contactPhones);

    const phoneToUserId = new Map(contactProfiles?.map(p => [p.phone, p.id]) || []);

    // Get push subscriptions for contacts who are also app users
    const contactUserIds = [...new Set(contactProfiles?.map(p => p.id) || [])];
    const { data: contactPushSubscriptions } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', contactUserIds);

    const contactSubscriptionMap = new Map<string, { endpoint: string; p256dh: string; auth: string }>();
    contactPushSubscriptions?.forEach(sub => {
      contactSubscriptionMap.set(sub.user_id, {
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
      });
    });

    let pushSentTravelers = 0;
    let pushSentContacts = 0;
    const notificationsToInsert: Array<{
      user_id: string;
      type: string;
      title: string;
      message: string;
      read: boolean;
    }> = [];

    // Send push to each traveler
    for (const trip of tripsToNotifyTraveler) {
      const subscription = subscriptionMap.get(trip.user_id);
      
      const title = '📍 ¿Ya llegaste?';
      const message = `Tu viaje a ${trip.destination} está retrasado ${trip.minutes_overdue} min. Abre MATS para confirmar tu llegada.`;

      notificationsToInsert.push({
        user_id: trip.user_id,
        type: 'overdue_push_reminder',
        title,
        message,
        read: false,
      });

      if (subscription) {
        try {
          await supabase.channel('push-notifications').send({
            type: 'broadcast',
            event: 'push_notification',
            payload: {
              user_id: trip.user_id,
              title,
              body: message,
              alertType: 'TRIP_OVERDUE',
              data: {
                tripId: trip.id,
                destination: trip.destination,
                minutesOverdue: trip.minutes_overdue,
              },
            },
          });
          pushSentTravelers++;
          console.log(`[push-overdue-trips] Sent push reminder to traveler ${trip.user_id}`);
        } catch (pushError) {
          console.error(`[push-overdue-trips] Error sending push to traveler:`, pushError);
        }
      }
    }

    // Send push notifications to emergency contacts
    for (const trip of tripsToNotifyContacts) {
      const contacts = contactsByUser.get(trip.user_id) || [];
      
      for (const contact of contacts) {
        const contactUserId = phoneToUserId.get(contact.phone);
        const contactSubscription = contactUserId ? contactSubscriptionMap.get(contactUserId) : null;
        
        const title = '⚠️ Viajero Atrasado';
        const message = `${trip.traveler_nickname} no ha confirmado llegada a ${trip.destination}. Atrasado ${trip.minutes_overdue} min.`;

        // Only create notification if contact is an app user
        if (contactUserId) {
          notificationsToInsert.push({
            user_id: contactUserId,
            type: 'overdue_contact_alert',
            title,
            message,
            read: false,
          });

          if (contactSubscription) {
            try {
              await supabase.channel('push-notifications').send({
                type: 'broadcast',
                event: 'push_notification',
                payload: {
                  user_id: contactUserId,
                  title,
                  body: message,
                  alertType: 'TRIP_OVERDUE_CONTACT',
                  data: {
                    tripId: trip.id,
                    travelerId: trip.user_id,
                    travelerName: trip.traveler_nickname,
                    travelerPhone: trip.traveler_phone,
                    destination: trip.destination,
                    minutesOverdue: trip.minutes_overdue,
                  },
                },
              });
              pushSentContacts++;
              console.log(`[push-overdue-trips] Sent alert to emergency contact ${contact.name} for traveler ${trip.traveler_nickname}`);
            } catch (pushError) {
              console.error(`[push-overdue-trips] Error sending push to contact:`, pushError);
            }
          }
        }
      }

      // Mark that contacts were notified for this traveler
      if (contacts.length > 0) {
        notificationsToInsert.push({
          user_id: trip.user_id,
          type: 'overdue_contact_alert',
          title: 'Contactos notificados',
          message: `Tus contactos de emergencia fueron notificados de tu retraso a ${trip.destination}`,
          read: false,
        });
      }
    }

    // Insert notification records
    if (notificationsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notificationsToInsert);

      if (insertError) {
        console.error('[push-overdue-trips] Error inserting notifications:', insertError);
      }
    }

    console.log(`[push-overdue-trips] Completed. Overdue: ${overdueTrips.length}, Traveler push: ${pushSentTravelers}, Contact push: ${pushSentContacts}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        overdueCount: overdueTrips.length,
        pushSentTravelers,
        pushSentContacts,
        notificationsCreated: notificationsToInsert.length,
        tripsNotified: tripsWithDelay.map(t => ({
          id: t.id,
          traveler: t.traveler_nickname,
          destination: t.destination,
          minutesOverdue: t.minutes_overdue,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[push-overdue-trips] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
