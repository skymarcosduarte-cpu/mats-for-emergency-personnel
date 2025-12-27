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
    const { receiverId, senderName, messagePreview } = await req.json();

    if (!receiverId || !senderName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    const payload = JSON.stringify({
      title: `💬 Mensaje de ${senderName}`,
      body: messagePreview || 'Tienes un nuevo mensaje',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `message-${receiverId}`,
      data: {
        type: 'internal_message',
        senderId: receiverId,
      }
    });

    // Send push notification using Web Push protocol
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          // Use simple fetch to the push endpoint
          const response = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'TTL': '86400',
            },
            body: payload,
          });

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
    console.log(`Sent ${successCount}/${subscriptions.length} push notifications`);

    return new Response(
      JSON.stringify({ success: true, sent: successCount, total: subscriptions.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-message-push:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
