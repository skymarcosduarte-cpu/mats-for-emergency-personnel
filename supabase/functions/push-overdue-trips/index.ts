import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Delay threshold in minutes before sending push
const OVERDUE_THRESHOLD_MINUTES = 30;

// Web Push configuration
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

interface OverdueTrip {
  id: string;
  user_id: string;
  origin: string;
  destination: string;
  eta: string;
  minutes_overdue: number;
}

// Simple web push sender without external library
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object
): Promise<boolean> {
  try {
    // For actual web push, we'd use the web-push library
    // Since Deno has limitations, we use the Supabase broadcast as fallback
    console.log(`[push-overdue-trips] Push to ${subscription.endpoint.slice(0, 50)}...`);
    
    // Make HTTP request to push endpoint (simplified - in production use proper VAPID signing)
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400',
      },
      body: JSON.stringify(payload),
    }).catch(() => null);

    return response?.ok ?? false;
  } catch (error) {
    console.error('[push-overdue-trips] Web push error:', error);
    return false;
  }
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
        JSON.stringify({ success: true, overdueCount: 0, pushSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = Date.now();
    const tripsWithDelay: OverdueTrip[] = overdueTrips.map(trip => ({
      ...trip,
      minutes_overdue: Math.floor((now - new Date(trip.eta).getTime()) / 60000)
    }));

    console.log(`[push-overdue-trips] Found ${tripsWithDelay.length} overdue trips`);

    // Check which users have been notified recently (last 4 hours) to avoid spam
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    
    const { data: recentPushNotifications } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('type', 'overdue_push_reminder')
      .gte('created_at', fourHoursAgo);

    const recentlyPushedUsers = new Set(recentPushNotifications?.map(n => n.user_id) || []);

    // Filter out trips for users already notified
    const tripsToNotify = tripsWithDelay.filter(trip => !recentlyPushedUsers.has(trip.user_id));

    if (tripsToNotify.length === 0) {
      console.log('[push-overdue-trips] All overdue trip owners already notified recently');
      return new Response(
        JSON.stringify({ 
          success: true, 
          overdueCount: overdueTrips.length, 
          pushSent: 0,
          skippedRecent: overdueTrips.length 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get push subscriptions for trip owners
    const userIds = tripsToNotify.map(t => t.user_id);
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

    let pushSent = 0;
    const notificationsToInsert: Array<{
      user_id: string;
      type: string;
      title: string;
      message: string;
      read: boolean;
    }> = [];

    // Send push to each trip owner
    for (const trip of tripsToNotify) {
      const subscription = subscriptionMap.get(trip.user_id);
      
      const title = '📍 ¿Ya llegaste?';
      const message = `Tu viaje a ${trip.destination} está retrasado ${trip.minutes_overdue} min. Abre MATS para confirmar tu llegada.`;

      // Record the notification attempt
      notificationsToInsert.push({
        user_id: trip.user_id,
        type: 'overdue_push_reminder',
        title,
        message,
        read: false,
      });

      if (subscription) {
        try {
          // Use Supabase realtime broadcast as reliable fallback
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

          pushSent++;
          console.log(`[push-overdue-trips] Sent push reminder to user ${trip.user_id} for trip ${trip.id}`);
        } catch (pushError) {
          console.error(`[push-overdue-trips] Error sending push to ${trip.user_id}:`, pushError);
        }
      } else {
        console.log(`[push-overdue-trips] No push subscription for user ${trip.user_id}`);
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

    console.log(`[push-overdue-trips] Completed. Overdue: ${overdueTrips.length}, Push sent: ${pushSent}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        overdueCount: overdueTrips.length,
        pushSent,
        tripsNotified: tripsToNotify.map(t => ({
          id: t.id,
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
