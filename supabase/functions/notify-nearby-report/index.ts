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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // SECURITY: Validate authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[notify-nearby-report] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated client to verify user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error('[notify-nearby-report] Invalid authentication:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { reportId, lat, lng, title, category, creatorId, radiusMeters = 5000 } = await req.json();

    // SECURITY: Verify the creatorId matches the authenticated user
    if (creatorId !== user.id) {
      console.error('[notify-nearby-report] Creator ID mismatch - potential spoofing attempt');
      return new Response(
        JSON.stringify({ error: 'Permission denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[notify-nearby-report] User ${user.id} notifying users within ${radiusMeters}m of report at ${lat}, ${lng}`);

    // Get users within radius using existing database function
    const { data: nearbyUsers, error: usersError } = await supabase
      .rpc('get_users_within_radius', {
        center_lat: lat,
        center_lng: lng,
        radius_meters: radiusMeters
      });

    if (usersError) {
      console.error('[notify-nearby-report] Error getting nearby users:', usersError);
      throw usersError;
    }

    console.log(`[notify-nearby-report] Found ${nearbyUsers?.length || 0} users within radius`);

    // Filter out the creator and create notifications
    const usersToNotify = (nearbyUsers || []).filter(
      (u: { user_id: string }) => u.user_id !== creatorId
    );

    if (usersToNotify.length === 0) {
      console.log('[notify-nearby-report] No users to notify');
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
      console.error('[notify-nearby-report] Error inserting notifications:', insertError);
      throw insertError;
    }

    console.log(`[notify-nearby-report] Successfully notified ${notifications.length} users`);

    return new Response(
      JSON.stringify({ success: true, notified: notifications.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[notify-nearby-report] Error:', error);
    // SECURITY: Don't expose internal error details
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
