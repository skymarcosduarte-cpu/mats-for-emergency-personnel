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
    } = await req.json();

    console.log(`[notify-quake-damage] ALERTA MÁXIMA PRIORIDAD - Daño por sismo reportado`);
    console.log(`[notify-quake-damage] Ubicación: ${lat}, ${lng}`);
    console.log(`[notify-quake-damage] Magnitud: ${magnitude}, Intensidad: ${intensity}, Estado: ${damageReport}`);

    // For earthquake damage reports, we notify ALL users regardless of distance
    // This is a maximum priority alert
    
    // Get ALL users with locations (they are active users)
    const { data: allUsers, error: usersError } = await supabase
      .from('user_locations')
      .select('user_id')
      .eq('is_online', true);

    if (usersError) {
      console.error('[notify-quake-damage] Error getting users:', usersError);
      throw usersError;
    }

    // Also get users who may not have updated location recently but have profiles
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id');

    if (profilesError) {
      console.error('[notify-quake-damage] Error getting profiles:', profilesError);
    }

    // Combine both lists and deduplicate
    const onlineUserIds = new Set((allUsers || []).map((u: { user_id: string }) => u.user_id));
    const profileUserIds = new Set((allProfiles || []).map((p: { id: string }) => p.id));
    const allUserIds = new Set([...onlineUserIds, ...profileUserIds]);

    // Filter out the creator
    allUserIds.delete(creatorId);

    const usersToNotify = Array.from(allUserIds);

    console.log(`[notify-quake-damage] Notificando a TODOS los usuarios: ${usersToNotify.length}`);

    if (usersToNotify.length === 0) {
      console.log('[notify-quake-damage] No hay usuarios para notificar');
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create HIGH PRIORITY urgency message for earthquake damage
    const title = `🚨 ALERTA MÁXIMA: Daños por Sismo M${magnitude.toFixed(1)}`;
    const message = `Se reportaron daños en ${place}. Alguien necesita ayuda. Ubicación: https://www.google.com/maps?q=${lat},${lng}`;

    // Create in-app notifications for ALL users
    const notifications = usersToNotify.map((userId: string) => ({
      user_id: userId,
      type: 'quake_damage_priority',
      title: title,
      message: message,
      read: false
    }));

    // Insert in batches to avoid timeout
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(batch);

      if (insertError) {
        console.error(`[notify-quake-damage] Error inserting batch ${i}:`, insertError);
      } else {
        insertedCount += batch.length;
      }
    }

    console.log(`[notify-quake-damage] Creadas ${insertedCount} notificaciones de máxima prioridad`);

    // Get push subscriptions for ALL users to send web push
    const { data: pushSubs, error: pushError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', usersToNotify.slice(0, 1000)); // Limit to first 1000 for performance

    if (pushError) {
      console.error('[notify-quake-damage] Error fetching push subscriptions:', pushError);
    } else if (pushSubs && pushSubs.length > 0) {
      console.log(`[notify-quake-damage] Found ${pushSubs.length} push subscriptions for priority notification`);
      // Note: Actual web push sending would require VAPID keys
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: insertedCount,
        totalUsers: usersToNotify.length,
        pushSubscriptions: pushSubs?.length || 0,
        priority: 'MAXIMUM'
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
