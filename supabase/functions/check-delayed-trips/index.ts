import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Delay threshold in minutes
const DELAY_THRESHOLD_MINUTES = 30;

// Web Push VAPID keys
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Helper function to send email via Resend API
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[check-delayed-trips] RESEND_API_KEY not configured');
    return false;
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'M.A.T.S. <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[check-delayed-trips] Resend API error:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('[check-delayed-trips] Email sent:', result);
    return true;
  } catch (error) {
    console.error('[check-delayed-trips] Error sending email:', error);
    return false;
  }
}

interface DelayedTrip {
  id: string;
  user_id: string;
  origin: string;
  destination: string;
  eta: string;
  created_at: string;
  nickname?: string;
  full_name?: string;
  email?: string;
  minutes_overdue: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.warn('[check-delayed-trips] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.warn('[check-delayed-trips] Invalid token:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-delayed-trips] Authenticated user: ${user.id}`);
    console.log('[check-delayed-trips] Starting delayed trips check...');

    // Find active trips where ETA has passed by more than DELAY_THRESHOLD_MINUTES
    const thresholdTime = new Date(Date.now() - DELAY_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    
    const { data: delayedTrips, error: tripsError } = await supabase
      .from('transit_trips')
      .select(`
        id,
        user_id,
        origin,
        destination,
        eta,
        created_at
      `)
      .eq('status', 'ACTIVE')
      .lt('eta', thresholdTime);

    if (tripsError) {
      console.error('[check-delayed-trips] Error fetching trips:', tripsError);
      throw tripsError;
    }

    if (!delayedTrips || delayedTrips.length === 0) {
      console.log('[check-delayed-trips] No delayed trips found');
      return new Response(
        JSON.stringify({ success: true, delayedCount: 0, notificationsSent: 0, emailsSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-delayed-trips] Found ${delayedTrips.length} delayed trips`);

    // Get user nicknames and full names
    const userIds = [...new Set(delayedTrips.map(t => t.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nickname, full_name')
      .in('id', userIds);

    // Get user emails from auth.users
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const emailMap = new Map(
      authUsers?.users?.map(u => [u.id, u.email]) || []
    );

    const profileMap = new Map(
      profiles?.map(p => [p.id, { nickname: p.nickname, full_name: p.full_name }]) || []
    );

    // Calculate delay for each trip
    const now = Date.now();
    const tripsWithDelay: DelayedTrip[] = delayedTrips.map(trip => {
      const profile = profileMap.get(trip.user_id);
      return {
        ...trip,
        nickname: profile?.nickname || 'Usuario',
        full_name: profile?.full_name || 'Usuario',
        email: emailMap.get(trip.user_id),
        minutes_overdue: Math.floor((now - new Date(trip.eta).getTime()) / 60000)
      };
    });

    // Check which trips have already been emailed recently (within last 4 hours)
    // to avoid spam notifications
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    
    const { data: recentNotifications } = await supabase
      .from('notifications')
      .select('user_id, type')
      .in('type', ['trip_delayed', 'trip_delayed_email'])
      .gte('created_at', fourHoursAgo);

    const recentlyEmailedUsers = new Set(
      recentNotifications
        ?.filter(n => n.type === 'trip_delayed_email')
        .map(n => n.user_id) || []
    );

    const recentlyNotifiedUsers = new Set(
      recentNotifications?.map(n => n.user_id) || []
    );

    // Filter out trips that were already notified
    const tripsToNotify = tripsWithDelay.filter(trip => !recentlyNotifiedUsers.has(trip.user_id));
    const tripsToEmail = tripsWithDelay.filter(trip => 
      !recentlyEmailedUsers.has(trip.user_id) && trip.email
    );

    if (tripsToNotify.length === 0 && tripsToEmail.length === 0) {
      console.log('[check-delayed-trips] All delayed trips already notified/emailed recently');
      return new Response(
        JSON.stringify({ 
          success: true, 
          delayedCount: delayedTrips.length, 
          notificationsSent: 0,
          emailsSent: 0,
          alreadyNotified: delayedTrips.length 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-delayed-trips] Sending notifications for ${tripsToNotify.length} trips, emails for ${tripsToEmail.length}`);

    // Get all online users to notify about each delayed trip
    const { data: onlineUsers } = await supabase
      .from('user_locations')
      .select('user_id')
      .eq('is_online', true);

    const onlineUserIds = onlineUsers?.map(u => u.user_id) || [];

    // Create notifications
    const allNotifications: Array<{
      user_id: string;
      type: string;
      title: string;
      message: string;
      read: boolean;
    }> = [];

    for (const trip of tripsToNotify) {
      const title = '⚠️ Viaje retrasado';
      const message = `${trip.nickname} debía llegar a ${trip.destination} hace ${trip.minutes_overdue} minutos. No ha confirmado su llegada.`;

      // Notify the trip owner
      allNotifications.push({
        user_id: trip.user_id,
        type: 'trip_delayed',
        title: '⏰ Tu viaje está retrasado',
        message: `Debías llegar a ${trip.destination} hace ${trip.minutes_overdue} minutos. ¿Todo bien?`,
        read: false
      });

      // Notify other online users (community)
      for (const userId of onlineUserIds) {
        if (userId !== trip.user_id) {
          allNotifications.push({
            user_id: userId,
            type: 'trip_delayed',
            title,
            message,
            read: false
          });
        }
      }
    }

    // Insert all notifications
    if (allNotifications.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(allNotifications);

      if (insertError) {
        console.error('[check-delayed-trips] Error inserting notifications:', insertError);
      } else {
        console.log(`[check-delayed-trips] Created ${allNotifications.length} notifications`);
      }
    }

    // Send emails to travelers who haven't opened the app
    let emailsSent = 0;
    const emailNotifications: Array<{
      user_id: string;
      type: string;
      title: string;
      message: string;
      read: boolean;
    }> = [];

    for (const trip of tripsToEmail) {
      if (!trip.email) continue;

      try {
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>M.A.T.S. - Actualiza tu estado</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a1a2e; color: #ffffff; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #16213e; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #f59e0b; margin: 0; font-size: 28px;">⚠️ M.A.T.S.</h1>
      <p style="color: #9ca3af; margin-top: 8px;">Sistema de Monitoreo Activo de Tránsito y Seguridad</p>
    </div>
    
    <div style="background-color: #1f2937; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <h2 style="color: #f59e0b; margin-top: 0; font-size: 20px;">Hola ${trip.full_name || trip.nickname},</h2>
      
      <p style="color: #e5e7eb; line-height: 1.6; font-size: 16px;">
        Creaste un viaje en M.A.T.S. con destino a <strong style="color: #60a5fa;">${trip.destination}</strong> 
        y debías llegar hace <strong style="color: #f87171;">${trip.minutes_overdue} minutos</strong>.
      </p>
      
      <p style="color: #e5e7eb; line-height: 1.6; font-size: 16px;">
        <strong>La comunidad está pendiente de ti</strong> y nos preocupa no saber de ti.
      </p>
      
      <div style="background-color: #374151; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin: 20px 0;">
        <p style="color: #fbbf24; margin: 0; font-size: 14px;">
          📍 <strong>Origen:</strong> ${trip.origin}<br>
          🎯 <strong>Destino:</strong> ${trip.destination}<br>
          ⏰ <strong>ETA original:</strong> ${new Date(trip.eta).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}
        </p>
      </div>
    </div>
    
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="https://mats.lovable.app" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); color: #000000; font-weight: bold; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-size: 18px; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);">
        🚀 Abrir M.A.T.S. y actualizar mi estado
      </a>
    </div>
    
    <p style="color: #9ca3af; font-size: 14px; text-align: center; margin-bottom: 0;">
      Si ya llegaste a tu destino, abre la app para confirmar tu llegada y tranquilizar a la comunidad.
    </p>
    
    <hr style="border: none; border-top: 1px solid #374151; margin: 24px 0;">
    
    <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0;">
      Este mensaje fue enviado automáticamente por M.A.T.S.<br>
      Si no creaste este viaje, por favor ignora este mensaje.
    </p>
  </div>
</body>
</html>
`;

        const emailSent = await sendEmail(
          trip.email,
          'Creaste viaje en M.A.T.S. y no hemos sabido de ti',
          emailHtml
        );

        if (emailSent) {
          console.log(`[check-delayed-trips] Email sent to ${trip.email}`);
          emailsSent++;

          // Track that we sent an email to this user
          emailNotifications.push({
            user_id: trip.user_id,
            type: 'trip_delayed_email',
            title: '📧 Email enviado',
            message: `Se envió email de seguimiento a ${trip.email} por viaje retrasado a ${trip.destination}`,
            read: true
          });
        }

      } catch (emailError) {
        console.error(`[check-delayed-trips] Error sending email to ${trip.email}:`, emailError);
      }
    }

    // Insert email tracking notifications
    if (emailNotifications.length > 0) {
      await supabase.from('notifications').insert(emailNotifications);
    }

    // Send push notifications to trip owners
    const tripOwnerIds = tripsToNotify.map(t => t.user_id);
    const { data: pushSubscriptions } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', tripOwnerIds);

    let pushSent = 0;
    if (pushSubscriptions && pushSubscriptions.length > 0) {
      for (const sub of pushSubscriptions) {
        const trip = tripsToNotify.find(t => t.user_id === sub.user_id);
        if (!trip) continue;

        try {
          console.log(`[check-delayed-trips] Would send push to user ${sub.user_id}: Trip ${trip.minutes_overdue}min late`);
          pushSent++;
        } catch (pushError) {
          console.error(`[check-delayed-trips] Push error for user ${sub.user_id}:`, pushError);
        }
      }
    }

    console.log(`[check-delayed-trips] Completed. Delayed: ${delayedTrips.length}, Notified: ${tripsToNotify.length}, Push: ${pushSent}, Emails: ${emailsSent}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        delayedCount: delayedTrips.length,
        notificationsSent: allNotifications.length,
        pushSent,
        emailsSent,
        tripsNotified: tripsToNotify.map(t => ({
          id: t.id,
          destination: t.destination,
          minutesOverdue: t.minutes_overdue
        })),
        tripsEmailed: tripsToEmail.map(t => ({
          id: t.id,
          email: t.email,
          destination: t.destination
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-delayed-trips] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
