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

    // Validate JWT and get authenticated user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[send-message-push] No authorization header');
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
      console.error('[send-message-push] Invalid authentication:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { receiverId, senderName, messagePreview, senderId, alertType } = await req.json();

    if (!receiverId || !senderName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Permission validation: senderId (if provided) must match authenticated user
    if (senderId && senderId !== user.id) {
      console.error('[send-message-push] Permission denied: cannot send push as another user', {
        userId: user.id,
        senderId
      });
      return new Response(
        JSON.stringify({ error: 'Permission denied: cannot send push notifications as another user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-message-push] Sending push to ${receiverId} from ${user.id}`);

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get push subscriptions for the receiver
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', receiverId);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for user:', receiverId);
      return new Response(
        JSON.stringify({ success: true, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pushPayload = {
      title: `💬 Mensaje de ${senderName}`,
      body: messagePreview || 'Tienes un nuevo mensaje',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `message-${Date.now()}`,
      alertType: alertType || 'MESSAGE',
      data: {
        type: 'internal_message',
        senderId: user.id,
        alertType: alertType || 'MESSAGE',
      }
    };

    // Send push notifications (simple JSON POST - works with many browsers)
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          const response = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'TTL': '86400',
              'Urgency': alertType === 'SEISMIC' || alertType === 'PANIC' ? 'high' : 'normal',
            },
            body: JSON.stringify(pushPayload),
          });

          console.log(`[send-message-push] Push response for ${sub.id}:`, response.status);

          if (!response.ok) {
            // If subscription is invalid, remove it
            if (response.status === 404 || response.status === 410) {
              console.log('Removing invalid subscription:', sub.id);
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('id', sub.id);
            }
            return { success: false, status: response.status };
          }

          return { success: true };
        } catch (error: unknown) {
          console.error('Error sending push:', error);
          return { success: false, error: String(error) };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    console.log(`[send-message-push] Sent ${successCount}/${subscriptions.length} push notifications`);

    return new Response(
      JSON.stringify({ success: true, sent: successCount, total: subscriptions.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-message-push:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
