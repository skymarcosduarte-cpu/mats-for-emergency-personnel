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
      lat, 
      lng, 
      magnitude, 
      place, 
      intensity, 
      damageReport, 
      creatorId, 
      radiusMeters = 10000  // 10km radius for earthquake damage alerts
    } = await req.json();

    console.log(`[notify-quake-damage] Damage report at ${lat}, ${lng}`);
    console.log(`[notify-quake-damage] Magnitude: ${magnitude}, Intensity: ${intensity}, Status: ${damageReport}`);

    // Only notify for DAMAGE or high intensity reports
    if (damageReport !== 'DAMAGE' && intensity < 7) {
      console.log('[notify-quake-damage] Skipping notification - not severe enough');
      return new Response(
        JSON.stringify({ success: true, notified: 0, reason: 'Not severe enough' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get users within radius using existing database function
    const { data: nearbyUsers, error: usersError } = await supabase
      .rpc('get_users_within_radius', {
        center_lat: lat,
        center_lng: lng,
        radius_meters: radiusMeters
      });

    if (usersError) {
      console.error('[notify-quake-damage] Error getting nearby users:', usersError);
      throw usersError;
    }

    console.log(`[notify-quake-damage] Found ${nearbyUsers?.length || 0} users within ${radiusMeters}m`);

    // Filter out the creator
    const usersToNotify = (nearbyUsers || []).filter(
      (u: { user_id: string }) => u.user_id !== creatorId
    );

    if (usersToNotify.length === 0) {
      console.log('[notify-quake-damage] No users to notify');
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create urgency message based on damage type
    const urgencyEmoji = damageReport === 'DAMAGE' ? '🆘' : '⚠️';
    const title = `${urgencyEmoji} Daños reportados - Sismo M${magnitude.toFixed(1)}`;
    const message = `Alguien cerca reportó ${damageReport === 'DAMAGE' ? 'daños/ayuda necesaria' : 'intensidad ${intensity}/10'}. ${place}`;

    // Create in-app notifications for all nearby users
    const notifications = usersToNotify.map((user: { user_id: string; distance_meters: number }) => ({
      user_id: user.user_id,
      type: 'quake_damage',
      title: title,
      message: `${message} (a ${(user.distance_meters / 1000).toFixed(1)}km de ti)`,
      read: false
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('[notify-quake-damage] Error inserting notifications:', insertError);
      throw insertError;
    }

    console.log(`[notify-quake-damage] Created ${notifications.length} in-app notifications`);

    // Also get push subscriptions for nearby users to send web push
    const userIds = usersToNotify.map((u: { user_id: string }) => u.user_id);
    
    const { data: pushSubs, error: pushError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds);

    if (pushError) {
      console.error('[notify-quake-damage] Error fetching push subscriptions:', pushError);
    } else if (pushSubs && pushSubs.length > 0) {
      console.log(`[notify-quake-damage] Found ${pushSubs.length} push subscriptions to notify`);
      // Note: Actual web push sending would require VAPID keys
      // For now, we log this for future implementation
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: notifications.length,
        pushSubscriptions: pushSubs?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[notify-quake-damage] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
