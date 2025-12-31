import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Alert type labels
const ALERT_LABELS: Record<string, { emoji: string; label: string }> = {
  'AMBULANCE': { emoji: '🚑', label: 'Emergencia Médica' },
  'TRAPPED': { emoji: '🆘', label: 'Persona Atrapada' },
  'SOS': { emoji: '🆘', label: 'SOS' },
  'PATROL': { emoji: '🚔', label: 'Patrulla' },
  'panic': { emoji: '🚨', label: 'Alerta de Pánico' },
  'medical': { emoji: '🚑', label: 'Emergencia Médica' },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate JWT and get authenticated user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[notify-alert-resolved] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth context to validate JWT
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error('[notify-alert-resolved] Invalid authentication:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      alertId, 
      alertType, // 'panic' or 'help_request'
      alertKind, // specific type like 'AMBULANCE', 'PATROL', etc.
      lat, 
      lng, 
      resolvedByUserId,
      creatorUserId,
      radiusMeters = 10000 // 10km radius
    } = await req.json();

    // Permission validation: caller must be either the resolver or the creator
    if (resolvedByUserId !== user.id && creatorUserId !== user.id) {
      console.error('[notify-alert-resolved] Permission denied: caller is neither resolver nor creator', {
        userId: user.id,
        resolvedByUserId,
        creatorUserId
      });
      return new Response(
        JSON.stringify({ error: 'Permission denied: only resolver or creator can send resolution notifications' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[notify-alert-resolved] Alert ${alertId} (${alertType}/${alertKind}) resolved at ${lat}, ${lng}`, {
      authenticatedUser: user.id
    });

    // Get resolver's name
    let resolverName = 'la comunidad';
    if (resolvedByUserId) {
      const { data: resolverProfile } = await supabase
        .from('profiles')
        .select('nickname, full_name')
        .eq('id', resolvedByUserId)
        .maybeSingle();
      
      resolverName = resolverProfile?.nickname || resolverProfile?.full_name || 'un rescatista';
    }

    // Get users within radius who were notified about this alert
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

    console.log(`Found ${nearbyUsers?.length || 0} users within ${radiusMeters}m radius`);

    // Filter out the creator and resolver
    const usersToNotify = (nearbyUsers || []).filter(
      (u: { user_id: string }) => 
        u.user_id !== creatorUserId && 
        u.user_id !== resolvedByUserId
    );

    if (usersToNotify.length === 0) {
      console.log('No users to notify about resolution');
      return new Response(
        JSON.stringify({ success: true, notified: 0, pushSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get alert label
    const alertInfo = ALERT_LABELS[alertKind] || ALERT_LABELS[alertType] || { emoji: '✅', label: 'Alerta' };

    // Create in-app notifications for all nearby users
    const notifications = usersToNotify.map((user: { user_id: string; distance_meters: number }) => ({
      user_id: user.user_id,
      type: 'alert_resolved_nearby',
      title: `${alertInfo.emoji} Alerta resuelta cerca de ti`,
      message: `La ${alertInfo.label.toLowerCase()} a ${Math.round(user.distance_meters)}m fue atendida por ${resolverName}`,
      read: false
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Error inserting notifications:', insertError);
    }

    // Send push notifications via Supabase Realtime broadcast
    let pushSent = 0;
    for (const u of usersToNotify) {
      try {
        // Broadcast to user's notification channel
        const channel = supabase.channel(`user-notifications:${u.user_id}`);
        await channel.send({
          type: 'broadcast',
          event: 'notification',
          payload: {
            title: `${alertInfo.emoji} Alerta resuelta`,
            body: `${alertInfo.label} cercana fue atendida exitosamente`,
            alertType: 'RESOLVED',
            data: {
              alertId,
              alertType,
              alertKind,
              distanceMeters: u.distance_meters
            }
          }
        });
        await supabase.removeChannel(channel);
        pushSent++;
      } catch (e) {
        console.error(`Error broadcasting to user ${u.user_id}:`, e);
      }
    }

    console.log(`[notify-alert-resolved] Created ${notifications.length} notifications, broadcast to ${pushSent} users`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: notifications.length,
        pushSent,
        resolverName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in notify-alert-resolved:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
