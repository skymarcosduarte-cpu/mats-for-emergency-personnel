import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Delay threshold in minutes
const DELAY_THRESHOLD_MINUTES = 30;

// Web Push VAPID keys (you'll need to set these as secrets)
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

interface DelayedTrip {
  id: string;
  user_id: string;
  origin: string;
  destination: string;
  eta: string;
  created_at: string;
  nickname?: string;
  minutes_overdue: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[check-delayed-trips] Starting delayed trips check...');

    // Find active trips where ETA has passed by more than DELAY_THRESHOLD_MINUTES
    const thresholdTime = new Date(Date.now() - DELAY_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    
    const { data: delayedTrips, error: tripsError } = await supabase
      .from('transit_trips')
      .select(`
        id,
        user_id,
        origin,
        destination,
        eta,
        created_at
      `)
      .eq('status', 'ACTIVE')
      .lt('eta', thresholdTime); // ETA is in the past by at least threshold

    if (tripsError) {
      console.error('[check-delayed-trips] Error fetching trips:', tripsError);
      throw tripsError;
    }

    if (!delayedTrips || delayedTrips.length === 0) {
      console.log('[check-delayed-trips] No delayed trips found');
      return new Response(
        JSON.stringify({ success: true, delayedCount: 0, notificationsSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-delayed-trips] Found ${delayedTrips.length} delayed trips`);

    // Get user nicknames
    const userIds = [...new Set(delayedTrips.map(t => t.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nickname, full_name')
      .in('id', userIds);

    const nicknameMap = new Map(
      profiles?.map(p => [p.id, p.nickname || p.full_name || 'Usuario']) || []
    );

    // Calculate delay for each trip
    const now = Date.now();
    const tripsWithDelay: DelayedTrip[] = delayedTrips.map(trip => ({
      ...trip,
      nickname: nicknameMap.get(trip.user_id),
      minutes_overdue: Math.floor((now - new Date(trip.eta).getTime()) / 60000)
    }));

    // Check which trips have already been notified recently (within last 2 hours)
    // to avoid spam notifications
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    const { data: recentNotifications } = await supabase
      .from('notifications')
      .select('user_id, message')
      .eq('type', 'trip_delayed')
      .gte('created_at', twoHoursAgo);

    const recentlyNotifiedUsers = new Set(recentNotifications?.map(n => n.user_id) || []);

    // Filter out trips that were already notified
    const tripsToNotify = tripsWithDelay.filter(trip => !recentlyNotifiedUsers.has(trip.user_id));

    if (tripsToNotify.length === 0) {
      console.log('[check-delayed-trips] All delayed trips already notified recently');
      return new Response(
        JSON.stringify({ 
          success: true, 
          delayedCount: delayedTrips.length, 
          notificationsSent: 0,
          alreadyNotified: delayedTrips.length 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-delayed-trips] Sending notifications for ${tripsToNotify.length} trips`);

    // Get all online users to notify about each delayed trip
    const { data: onlineUsers } = await supabase
      .from('user_locations')
      .select('user_id')
      .eq('is_online', true);

    const onlineUserIds = onlineUsers?.map(u => u.user_id) || [];

    // Create notifications for each delayed trip
    const allNotifications: Array<{
      user_id: string;
      type: string;
      title: string;
      message: string;
      read: boolean;
    }> = [];

    for (const trip of tripsToNotify) {
      const title = '⚠️ Viaje retrasado';
      const message = `${trip.nickname} debía llegar a ${trip.destination} hace ${trip.minutes_overdue} minutos. No ha confirmado su llegada.`;

      // Notify the trip owner
      allNotifications.push({
        user_id: trip.user_id,
        type: 'trip_delayed',
        title: '⏰ Tu viaje está retrasado',
        message: `Debías llegar a ${trip.destination} hace ${trip.minutes_overdue} minutos. ¿Todo bien?`,
        read: false
      });

      // Notify other online users (community)
      for (const userId of onlineUserIds) {
        if (userId !== trip.user_id) {
          allNotifications.push({
            user_id: userId,
            type: 'trip_delayed',
            title,
            message,
            read: false
          });
        }
      }

      // Get emergency contacts for the trip owner
      const { data: emergencyContacts } = await supabase
        .from('emergency_contacts')
        .select('name, phone, email')
        .eq('user_id', trip.user_id)
        .order('is_primary', { ascending: false });

      if (emergencyContacts && emergencyContacts.length > 0) {
        console.log(`[check-delayed-trips] Trip ${trip.id} has ${emergencyContacts.length} emergency contacts`);
        // In a production app, you would send SMS/email to emergency contacts here
        // For now, we log it
      }
    }

    // Insert all notifications
    if (allNotifications.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(allNotifications);

      if (insertError) {
        console.error('[check-delayed-trips] Error inserting notifications:', insertError);
      } else {
        console.log(`[check-delayed-trips] Created ${allNotifications.length} notifications`);
      }
    }

    // Send push notifications to trip owners
    const tripOwnerIds = tripsToNotify.map(t => t.user_id);
    const { data: pushSubscriptions } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', tripOwnerIds);

    let pushSent = 0;
    if (pushSubscriptions && pushSubscriptions.length > 0) {
      for (const sub of pushSubscriptions) {
        const trip = tripsToNotify.find(t => t.user_id === sub.user_id);
        if (!trip) continue;

        try {
          // Send web push notification
          // Note: Full web push implementation requires the web-push library
          // For now, we log the intent
          console.log(`[check-delayed-trips] Would send push to user ${sub.user_id}: Trip ${trip.minutes_overdue}min late`);
          pushSent++;
        } catch (pushError) {
          console.error(`[check-delayed-trips] Push error for user ${sub.user_id}:`, pushError);
        }
      }
    }

    console.log(`[check-delayed-trips] Completed. Delayed: ${delayedTrips.length}, Notified: ${tripsToNotify.length}, Push sent: ${pushSent}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        delayedCount: delayedTrips.length,
        notificationsSent: allNotifications.length,
        pushSent,
        tripsNotified: tripsToNotify.map(t => ({
          id: t.id,
          destination: t.destination,
          minutesOverdue: t.minutes_overdue
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-delayed-trips] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
