import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function is called by a cron job to trigger scheduled drills
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[trigger-drill-alert] Checking for scheduled drills...');

    // Find drills that should be triggered now (within 1 minute window)
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneMinuteAhead = new Date(now.getTime() + 60 * 1000);

    const { data: drills, error } = await supabase
      .from('clave100_drills')
      .select('*')
      .eq('status', 'scheduled')
      .gte('scheduled_at', oneMinuteAgo.toISOString())
      .lte('scheduled_at', oneMinuteAhead.toISOString());

    if (error) {
      console.error('[trigger-drill-alert] Error fetching drills:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch drills' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!drills || drills.length === 0) {
      console.log('[trigger-drill-alert] No drills to trigger');
      return new Response(
        JSON.stringify({ message: 'No drills to trigger' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[trigger-drill-alert] Found ${drills.length} drill(s) to trigger`);

    for (const drill of drills) {
      // Mark drill as active
      await supabase
        .from('clave100_drills')
        .update({ status: 'active' })
        .eq('id', drill.id);

      // Get creator name
      const { data: creator } = await supabase
        .from('profiles')
        .select('nickname, full_name')
        .eq('id', drill.creator_id)
        .single();

      const creatorName = creator?.nickname || creator?.full_name || 'Coordinador';

      // Get all active users
      const { data: activeLocations } = await supabase
        .from('user_locations')
        .select('user_id')
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (activeLocations && activeLocations.length > 0) {
        const drillMessage = `🔔 SIMULACRO CLAVE 100 🔔\n\n⚠️ ESTO ES UN SIMULACRO, NO ES UNA EMERGENCIA REAL ⚠️\n\nEste es un ejercicio de práctica para familiarizarte con las alertas de emergencia.\n\nOrganizado por: ${creatorName}`;

        // Create drill alert messages for all active users
        const messages = activeLocations.map(loc => ({
          sender_id: drill.creator_id,
          receiver_id: loc.user_id,
          content: drillMessage,
          is_read: false,
          is_clave100: true // Special flag for drill alerts
        }));

        // Insert messages in batches
        const BATCH_SIZE = 50;
        for (let i = 0; i < messages.length; i += BATCH_SIZE) {
          const batch = messages.slice(i, i + BATCH_SIZE);
          await supabase.from('internal_messages').insert(batch);
        }

        console.log(`[trigger-drill-alert] Sent drill alert to ${messages.length} users`);
      }

      // Mark drill as completed after 5 minutes
      setTimeout(async () => {
        await supabase
          .from('clave100_drills')
          .update({ status: 'completed' })
          .eq('id', drill.id);
      }, 5 * 60 * 1000);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        drills_triggered: drills.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[trigger-drill-alert] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
