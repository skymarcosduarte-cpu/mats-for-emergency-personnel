// Edge function to broadcast push notifications to ALL subscribed users when a panic event is created
// This ensures the community is immediately alerted about active emergencies

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

const PANIC_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  'AMBULANCIA_PROPIA': { label: 'Ambulancia solicitada', emoji: '🚑' },
  'AMBULANCIA_TERCERO': { label: 'Ambulancia para tercero', emoji: '🚑' },
  'PATRULLA': { label: 'Patrulla solicitada', emoji: '🚔' },
  'MECANICO': { label: 'Mecánico solicitado', emoji: '🔧' },
  'PROTECCION_CIVIL': { label: 'Protección Civil', emoji: '🆘' },
};

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400',
        'Urgency': 'high', // Emergency alerts are always high urgency
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[notify-panic-broadcast] Push failed: ${response.status} - ${errorText}`);
      return { success: false, status: response.status, error: errorText };
    }

    return { success: true, status: response.status };
  } catch (error) {
    console.error('[notify-panic-broadcast] Error:', error);
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[notify-panic-broadcast] Missing authorization header');
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
      console.error('[notify-panic-broadcast] Invalid authentication:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[notify-panic-broadcast] Authenticated user: ${user.id}`);

    const { 
      panicEventId,
      panicType,
      creatorName,
      message,
      lat,
      lng
    } = await req.json();

    if (!panicEventId || !panicType) {
      return new Response(
        JSON.stringify({ error: 'panicEventId and panicType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to access all subscriptions
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get ALL push subscriptions EXCEPT the creator's own subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .neq('user_id', user.id); // Don't notify the creator

    if (subError) {
      console.error('[notify-panic-broadcast] Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[notify-panic-broadcast] No subscriptions found');
      return new Response(
        JSON.stringify({ success: true, sent: 0, total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[notify-panic-broadcast] Found ${subscriptions.length} subscriptions to notify`);

    // Build notification content
    const typeInfo = PANIC_TYPE_LABELS[panicType] || { label: 'Emergencia', emoji: '🆘' };
    const displayName = creatorName || 'Un miembro';
    
    const title = `${typeInfo.emoji} ¡EMERGENCIA ACTIVA!`;
    const body = message 
      ? `${displayName}: ${message.slice(0, 100)}${message.length > 100 ? '...' : ''}`
      : `${displayName} necesita ${typeInfo.label.toLowerCase()}. ¡Abre M.A.T.S. para ayudar!`;

    const payload: PushPayload = {
      title,
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `panic-${panicEventId}`,
      alertType: 'PANIC',
      data: { 
        alertType: 'PANIC',
        panicEventId,
        panicType,
        lat,
        lng,
        url: '/' // Open main map screen
      },
    };

    // Send to all subscriptions in parallel (batch of 50 at a time to avoid overwhelming)
    const BATCH_SIZE = 50;
    let successCount = 0;
    let failCount = 0;
    const subscriptionsToRemove: string[] = [];

    for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
      const batch = subscriptions.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.all(
        batch.map(async (sub) => {
          const result = await sendPushNotification(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            payload
          );

          // Mark invalid subscriptions for removal
          if (!result.success && (result.status === 404 || result.status === 410)) {
            subscriptionsToRemove.push(sub.id);
          }

          return result;
        })
      );

      successCount += results.filter(r => r.success).length;
      failCount += results.filter(r => !r.success).length;
    }

    // Clean up invalid subscriptions
    if (subscriptionsToRemove.length > 0) {
      console.log(`[notify-panic-broadcast] Removing ${subscriptionsToRemove.length} invalid subscriptions`);
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', subscriptionsToRemove);
    }

    console.log(`[notify-panic-broadcast] Sent ${successCount}/${subscriptions.length} notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount, 
        total: subscriptions.length,
        failed: failCount,
        removed: subscriptionsToRemove.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[notify-panic-broadcast] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
