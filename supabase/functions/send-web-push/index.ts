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
        'Urgency': payload.alertType === 'SEISMIC' || payload.alertType === 'PANIC' ? 'high' : 'normal',
      },
      body: JSON.stringify(payload),
    });

    console.log(`[send-web-push] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[send-web-push] Failed: ${response.status} - ${errorText}`);
      return { success: false, status: response.status, error: errorText };
    }

    return { success: true, status: response.status };
  } catch (error) {
    console.error('[send-web-push] Error:', error);
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

    // SECURITY: Validate authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[send-web-push] Missing authorization header');
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
      console.error('[send-web-push] Invalid authentication:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-web-push] Authenticated user: ${user.id}`);

    const { 
      userIds, 
      title, 
      body, 
      alertType = 'GENERAL',
      data = {} 
    } = await req.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'userIds array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'title and body are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-web-push] Sending to ${userIds.length} users, alertType: ${alertType}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all push subscriptions for the target users
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds);

    if (subError) {
      console.error('[send-web-push] Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[send-web-push] No subscriptions found for users');
      return new Response(
        JSON.stringify({ success: true, sent: 0, total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: PushPayload = {
      title,
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `${alertType.toLowerCase()}-${Date.now()}`,
      alertType,
      data: { ...data, alertType },
    };

    // Send to all subscriptions
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const result = await sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload
        );

        // Remove invalid subscriptions
        if (!result.success && (result.status === 404 || result.status === 410)) {
          console.log('[send-web-push] Removing invalid subscription:', sub.id);
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }

        return result;
      })
    );

    const successCount = results.filter(r => r.success).length;
    console.log(`[send-web-push] Sent ${successCount}/${subscriptions.length} notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount, 
        total: subscriptions.length,
        failed: subscriptions.length - successCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[send-web-push] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
