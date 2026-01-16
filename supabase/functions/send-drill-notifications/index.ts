import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Authorized users who can create drills
const AUTHORIZED_USER_IDS = [
  '7c823685-369d-4f62-8459-80486832ba1a', // Zombie
  '0e0d5ee7-628d-4a98-af26-b60ede2536ce', // El Lagarto
];

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[send-drill-notifications] RESEND_API_KEY not configured');
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
        from: 'M.A.T.S. <noreply@mats-app.com>',
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[send-drill-notifications] Resend API error:', errorText);
      return false;
    }

    console.log(`[send-drill-notifications] Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('[send-drill-notifications] Error sending email:', error);
    return false;
  }
}

function generateDrillEmailHtml(scheduledAt: string, creatorName: string): string {
  const date = new Date(scheduledAt);
  const formattedDate = date.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simulacro Clave 100 Programado</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a1a2e; color: #ffffff; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #16213e; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #fbbf24; margin: 0; font-size: 36px;">🔔 SIMULACRO</h1>
      <p style="color: #f59e0b; margin-top: 8px; font-size: 20px; font-weight: bold;">CLAVE 100</p>
    </div>
    
    <!-- Alert Box -->
    <div style="background: linear-gradient(135deg, #78350f, #92400e); border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 2px solid #fbbf24; text-align: center;">
      <p style="color: #fef3c7; font-size: 18px; font-weight: bold; margin: 0 0 16px 0;">
        ⚠️ PRÓXIMO SIMULACRO PROGRAMADO ⚠️
      </p>
      <p style="color: #ffffff; font-size: 24px; font-weight: bold; margin: 0 0 8px 0;">
        ${formattedDate}
      </p>
      <p style="color: #fbbf24; font-size: 32px; font-weight: bold; margin: 0;">
        🕐 ${formattedTime}
      </p>
    </div>
    
    <!-- Info Box -->
    <div style="background-color: #1f2937; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #60a5fa;">
      <h3 style="color: #60a5fa; margin: 0 0 12px 0; font-size: 16px;">ℹ️ Información Importante</h3>
      <ul style="color: #e5e7eb; margin: 0; padding-left: 20px; line-height: 1.8;">
        <li><strong>Esto es un SIMULACRO</strong>, no una emergencia real</li>
        <li>Recibirás una alerta tipo Clave 100 en la fecha y hora indicadas</li>
        <li>Practica tu respuesta como si fuera una emergencia real</li>
        <li>Organizado por: <strong style="color: #fbbf24;">${creatorName}</strong></li>
      </ul>
    </div>
    
    <!-- What to expect -->
    <div style="background-color: #1f2937; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h3 style="color: #fbbf24; margin: 0 0 12px 0; font-size: 16px;">📋 ¿Qué esperar?</h3>
      <p style="color: #9ca3af; margin: 0; line-height: 1.6;">
        Durante el simulacro, recibirás una notificación especial marcada claramente como 
        <strong style="color: #fbbf24;">"SIMULACRO - NO ES EMERGENCIA REAL"</strong>. 
        Esto te permitirá familiarizarte con el sistema de alertas de emergencia sin generar alarma.
      </p>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="https://mats.lovable.app" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #ffffff; font-weight: bold; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
        🛡️ Abrir M.A.T.S.
      </a>
    </div>
    
    <!-- Footer -->
    <hr style="border: none; border-top: 1px solid #374151; margin: 24px 0;">
    
    <div style="text-align: center;">
      <p style="color: #fbbf24; font-size: 14px; margin-bottom: 8px; font-weight: bold;">
        🔔 RECUERDA: Es un simulacro, no una emergencia real
      </p>
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        Este correo fue enviado automáticamente por M.A.T.S.<br>
        Monitoreo Activo de Tránsito y Seguridad
      </p>
    </div>
    
  </div>
</body>
</html>
`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { drill_id, scheduled_at, creator_id } = await req.json();

    console.log(`[send-drill-notifications] Processing drill ${drill_id}`);

    // Verify creator is authorized
    if (!AUTHORIZED_USER_IDS.includes(creator_id)) {
      console.error('[send-drill-notifications] Unauthorized creator:', creator_id);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get creator profile
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('nickname, full_name')
      .eq('id', creator_id)
      .single();

    const creatorName = creatorProfile?.nickname || creatorProfile?.full_name || 'Coordinador';

    // Get all users with email from auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('[send-drill-notifications] Error fetching users:', authError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get users who have opted out of drills
    const { data: optedOutProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('opt_out_drills', true);
    
    const optedOutUserIds = new Set((optedOutProfiles || []).map(p => p.id));
    console.log(`[send-drill-notifications] ${optedOutUserIds.size} users have opted out of drills`);

    const allUsers = authUsers?.users || [];
    // Filter out opted-out users
    const users = allUsers.filter(u => !optedOutUserIds.has(u.id));
    console.log(`[send-drill-notifications] Found ${users.length} users to notify (${allUsers.length - users.length} opted out)`);

    let emailsSent = 0;
    const emailHtml = generateDrillEmailHtml(scheduled_at, creatorName);

    // Send emails in batches to avoid rate limiting
    for (const user of users) {
      if (user.email) {
        const sent = await sendEmail(
          user.email,
          '🔔 SIMULACRO CLAVE 100 Programado - M.A.T.S.',
          emailHtml
        );
        if (sent) emailsSent++;
        
        // Small delay between emails to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // Update drill with notification count
    await supabase
      .from('clave100_drills')
      .update({ 
        notified_users: emailsSent,
        notification_sent_at: new Date().toISOString()
      })
      .eq('id', drill_id);

    // Create internal messages for all active users (excluding opted-out)
    const { data: activeLocations } = await supabase
      .from('user_locations')
      .select('user_id')
      .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (activeLocations && activeLocations.length > 0) {
      // Filter out opted-out users from internal messages too
      const eligibleLocations = activeLocations.filter(loc => !optedOutUserIds.has(loc.user_id));
      
      const messages = eligibleLocations.map(loc => ({
        sender_id: creator_id,
        receiver_id: loc.user_id,
        content: `🔔 SIMULACRO CLAVE 100 PROGRAMADO\n\n📅 ${new Date(scheduled_at).toLocaleString('es-MX')}\n\n⚠️ Esto es un SIMULACRO, no una emergencia real.\n\nDurante el simulacro recibirás una alerta tipo Clave 100 para practicar tu respuesta.`,
        is_read: false
      }));

      // Insert messages in batches
      const BATCH_SIZE = 50;
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);
        await supabase.from('internal_messages').insert(batch);
      }

      console.log(`[send-drill-notifications] Created ${messages.length} internal messages`);
    }

    const usersNotified = activeLocations ? activeLocations.filter(loc => !optedOutUserIds.has(loc.user_id)).length : 0;
    console.log(`[send-drill-notifications] Done. Emails sent: ${emailsSent}, messages: ${usersNotified}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emails_sent: emailsSent,
        users_notified: usersNotified,
        opted_out: optedOutUserIds.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-drill-notifications] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
