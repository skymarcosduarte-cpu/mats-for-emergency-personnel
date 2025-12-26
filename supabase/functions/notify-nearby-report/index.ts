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

    const { reportId, lat, lng, title, category, creatorId, radiusMeters = 5000 } = await req.json();

    console.log(`Notifying users within ${radiusMeters}m of report at ${lat}, ${lng}`);

    // Get users within radius using existing database function
    const { data: nearbyUsers, error: usersError } = await supabase
      .rpc('get_users_within_radius', {
        center_lat: lat,
        center_lng: lng,
        radius_meters: radiusMeters
      });

    if (usersError) {
      console.error('Error getting nearby users:', usersError);
      throw usersError;
    }

    console.log(`Found ${nearbyUsers?.length || 0} users within radius`);

    // Filter out the creator and create notifications
    const usersToNotify = (nearbyUsers || []).filter(
      (u: { user_id: string }) => u.user_id !== creatorId
    );

    if (usersToNotify.length === 0) {
      console.log('No users to notify');
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Category labels for notification message
    const categoryLabels: Record<string, string> = {
      'BLOCKADE': '🚧 Bloqueo',
      'ACCIDENT': '🚨 Accidente',
      'PROTEST': '📢 Manifestación',
      'HAZARD': '⚠️ Peligro',
      'OTHER': '📍 Incidente'
    };

    const categoryLabel = categoryLabels[category] || categoryLabels['OTHER'];

    // Create notifications for all nearby users
    const notifications = usersToNotify.map((user: { user_id: string; distance_meters: number }) => ({
      user_id: user.user_id,
      type: 'road_report',
      title: `${categoryLabel} cerca de ti`,
      message: `${title} (a ${Math.round(user.distance_meters)}m de tu ubicación)`,
      read: false
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Error inserting notifications:', insertError);
      throw insertError;
    }

    console.log(`Successfully notified ${notifications.length} users`);

    return new Response(
      JSON.stringify({ success: true, notified: notifications.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in notify-nearby-report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
