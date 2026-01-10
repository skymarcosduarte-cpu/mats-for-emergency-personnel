import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

interface IncompleteUser {
  id: string;
  email: string;
  created_at: string;
}

async function sendReminderEmail(to: string, hoursAgo: number): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[remind-incomplete-profiles] RESEND_API_KEY not configured');
    return false;
  }

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Completa tu perfil en M.A.T.S.</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a1a2e; color: #ffffff; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #16213e; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #f59e0b; margin: 0; font-size: 36px;">🛡️ M.A.T.S.</h1>
      <p style="color: #60a5fa; margin-top: 8px; font-size: 14px; letter-spacing: 1px;">MONITOREO ACTIVO DE TRÁNSITO Y SEGURIDAD</p>
    </div>
    
    <!-- Reminder Message -->
    <div style="background: linear-gradient(135deg, #1f2937, #374151); border-radius: 12px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #fbbf24;">
      <h2 style="color: #fbbf24; margin-top: 0; font-size: 22px;">👋 ¡Te estamos esperando!</h2>
      <p style="color: #e5e7eb; line-height: 1.6; font-size: 16px; margin-bottom: 0;">
        Notamos que creaste tu cuenta hace <strong style="color: #60a5fa;">${Math.round(hoursAgo)} horas</strong> pero aún no has completado tu perfil.
      </p>
    </div>
    
    <!-- Why Complete Profile -->
    <div style="background-color: #1f2937; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h3 style="color: #f59e0b; margin-top: 0; font-size: 18px;">¿Por qué completar tu perfil?</h3>
      <ul style="color: #e5e7eb; margin: 0; padding-left: 20px; line-height: 2;">
        <li>🆘 Podrás usar el <strong>botón de pánico</strong> en emergencias</li>
        <li>🚗 Registrar tus <strong>viajes</strong> para que te monitoreen</li>
        <li>🗺️ Ver el <strong>mapa en tiempo real</strong> de la comunidad</li>
        <li>⚠️ Reportar y recibir <strong>alertas de peligros</strong></li>
        <li>💬 Comunicarte con otros <strong>miembros</strong></li>
      </ul>
    </div>

    <!-- Steps -->
    <div style="background-color: #1f2937; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h3 style="color: #34d399; margin-top: 0; font-size: 18px;">Solo necesitas 2 minutos:</h3>
      <ol style="color: #e5e7eb; margin: 0; padding-left: 20px; line-height: 2;">
        <li>Abre la app o haz clic en el botón de abajo</li>
        <li>Inicia sesión con este email</li>
        <li>Completa tu nombre y teléfono</li>
        <li>¡Listo! Ya serás parte de la comunidad</li>
      </ol>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="https://mats.lovable.app" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); color: #000000; font-weight: bold; text-decoration: none; padding: 18px 48px; border-radius: 12px; font-size: 18px; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);">
        ✅ Completar mi Perfil
      </a>
    </div>
    
    <!-- Footer -->
    <hr style="border: none; border-top: 1px solid #374151; margin: 24px 0;">
    
    <div style="text-align: center;">
      <p style="color: #9ca3af; font-size: 14px; margin-bottom: 8px;">
        <strong style="color: #f59e0b;">Recuerda:</strong> En M.A.T.S. nos cuidamos entre todos.
      </p>
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        Este es un recordatorio automático. Solo lo enviamos una vez.<br>
        Si ya completaste tu perfil, ignora este mensaje.
      </p>
    </div>
    
  </div>
</body>
</html>
`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'M.A.T.S. <noreply@mats-app.com>',
        to: [to],
        subject: '👋 ¡Completa tu perfil en M.A.T.S.!',
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[remind-incomplete-profiles] Resend API error:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('[remind-incomplete-profiles] Reminder sent:', result);
    return true;
  } catch (error) {
    console.error('[remind-incomplete-profiles] Error sending email:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[remind-incomplete-profiles][${requestId}] Starting job...`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find users who:
    // 1. Have an account (exist in auth.users)
    // 2. Don't have a profile (not in profiles table)
    // 3. Created their account between 24-48 hours ago (only send once)
    // 4. Haven't already received a reminder (check notifications)
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    console.log(`[remind-incomplete-profiles][${requestId}] Looking for users created between ${fortyEightHoursAgo} and ${twentyFourHoursAgo}`);

    // Get all users from auth.users created in the window
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authError) {
      console.error(`[remind-incomplete-profiles][${requestId}] Error listing auth users:`, authError);
      throw authError;
    }

    // Filter users created in the 24-48 hour window
    const usersInWindow = authUsers.users.filter(user => {
      const createdAt = new Date(user.created_at);
      const twentyFourHoursAgoDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const fortyEightHoursAgoDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
      return createdAt <= twentyFourHoursAgoDate && createdAt >= fortyEightHoursAgoDate;
    });

    console.log(`[remind-incomplete-profiles][${requestId}] Found ${usersInWindow.length} users in the 24-48h window`);

    if (usersInWindow.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No users to remind',
          usersChecked: authUsers.users.length,
          remindersCount: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing profiles for these users
    const userIds = usersInWindow.map(u => u.id);
    const { data: existingProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .in('id', userIds);

    if (profilesError) {
      console.error(`[remind-incomplete-profiles][${requestId}] Error fetching profiles:`, profilesError);
      throw profilesError;
    }

    const profileIds = new Set((existingProfiles || []).map(p => p.id));
    const usersWithoutProfiles = usersInWindow.filter(u => !profileIds.has(u.id));

    console.log(`[remind-incomplete-profiles][${requestId}] Users without profiles: ${usersWithoutProfiles.length}`);

    if (usersWithoutProfiles.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All users have profiles',
          usersChecked: usersInWindow.length,
          remindersCount: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we already sent reminders to these users
    const { data: sentReminders, error: remindersError } = await supabase
      .from('notifications')
      .select('user_id')
      .eq('type', 'profile_reminder')
      .in('user_id', usersWithoutProfiles.map(u => u.id));

    if (remindersError) {
      console.error(`[remind-incomplete-profiles][${requestId}] Error checking reminders:`, remindersError);
      // Continue anyway, worst case we send a duplicate
    }

    const alreadySentIds = new Set((sentReminders || []).map(r => r.user_id));
    const usersToRemind = usersWithoutProfiles.filter(u => !alreadySentIds.has(u.id));

    console.log(`[remind-incomplete-profiles][${requestId}] Users to send reminders to: ${usersToRemind.length}`);

    let remindersSent = 0;
    const results: Array<{ email: string; success: boolean; error?: string }> = [];

    for (const user of usersToRemind) {
      if (!user.email) {
        console.log(`[remind-incomplete-profiles][${requestId}] Skipping user ${user.id} - no email`);
        continue;
      }

      const hoursAgo = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60);
      console.log(`[remind-incomplete-profiles][${requestId}] Sending reminder to ${user.email} (created ${Math.round(hoursAgo)}h ago)`);

      const sent = await sendReminderEmail(user.email, hoursAgo);
      
      if (sent) {
        remindersSent++;
        
        // Track that we sent the reminder
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'profile_reminder',
          title: '📧 Recordatorio enviado',
          message: `Se envió recordatorio para completar perfil a ${user.email}`,
          read: true
        });

        results.push({ email: user.email, success: true });
      } else {
        results.push({ email: user.email, success: false, error: 'Failed to send' });
      }

      // Small delay between emails to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[remind-incomplete-profiles][${requestId}] Job complete. Sent ${remindersSent} reminders`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        remindersCount: remindersSent,
        usersChecked: usersInWindow.length,
        usersWithoutProfiles: usersWithoutProfiles.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[remind-incomplete-profiles][${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
