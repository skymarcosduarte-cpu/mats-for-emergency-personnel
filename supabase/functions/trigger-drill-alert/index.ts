import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  alertType?: string;
  data?: Record<string, unknown>;
}

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<{ success: boolean; status?: number }> {
  try {
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400',
        'Urgency': 'high',
      },
      body: JSON.stringify(payload),
    });

    return { success: response.ok, status: response.status };
  } catch (error) {
    console.error('[trigger-drill-alert] Push error:', error);
    return { success: false };
  }
}

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

      // Get users who have opted out of drills
      const { data: optedOutProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('opt_out_drills', true);
      
      const optedOutUserIds = new Set((optedOutProfiles || []).map(p => p.id));

      // Get all active users (active in last 24 hours)
      const { data: activeLocations } = await supabase
        .from('user_locations')
        .select('user_id')
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Filter out opted-out users
      const eligibleUsers = (activeLocations || []).filter(loc => !optedOutUserIds.has(loc.user_id));

      if (eligibleUsers.length > 0) {
        const drillMessage = `🔔 SIMULACRO CLAVE 100 🔔\n\n⚠️ ESTO ES UN SIMULACRO, NO ES UNA EMERGENCIA REAL ⚠️\n\nEste es un ejercicio de práctica para familiarizarte con las alertas de emergencia.\n\nOrganizado por: ${creatorName}`;

        // Create drill alert messages for all eligible users
        const messages = eligibleUsers.map(loc => ({
          sender_id: drill.creator_id,
          receiver_id: loc.user_id,
          message: drillMessage,
          read: false
        }));

        // Insert messages in batches
        const BATCH_SIZE = 50;
        for (let i = 0; i < messages.length; i += BATCH_SIZE) {
          const batch = messages.slice(i, i + BATCH_SIZE);
          await supabase.from('internal_messages').insert(batch);
        }

        console.log(`[trigger-drill-alert] Sent drill alert to ${messages.length} users`);

        // Send Web Push notifications to ALL users with push subscriptions (except opted-out)
        const userIds = eligibleUsers.map(loc => loc.user_id);
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .in('user_id', userIds);

        if (subscriptions && subscriptions.length > 0) {
          const pushPayload: PushPayload = {
            title: '🔔 SIMULACRO CLAVE 100',
            body: '⚠️ ESTO ES UN SIMULACRO, NO ES UNA EMERGENCIA REAL ⚠️',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `drill-${drill.id}`,
            alertType: 'DRILL',
            data: { drillId: drill.id, type: 'drill' },
          };

          let pushSent = 0;
          for (const sub of subscriptions) {
            const result = await sendPushNotification(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              pushPayload
            );
            if (result.success) pushSent++;
            
            // Remove invalid subscriptions
            if (!result.success && (result.status === 404 || result.status === 410)) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            }
          }
          
          console.log(`[trigger-drill-alert] Sent ${pushSent}/${subscriptions.length} push notifications`);
        }
      }

      // Note: setTimeout doesn't work reliably in edge functions
      // The drill will remain active and front-end can check status
      // We'll mark it as completed after 30 minutes via another check
      console.log(`[trigger-drill-alert] Drill ${drill.id} is now active`);
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
