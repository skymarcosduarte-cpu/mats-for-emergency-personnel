import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// Authorized users who can trigger mass emails
const AUTHORIZED_USER_IDS = [
  '7c823685-369d-4f62-8459-80486832ba1a', // Zombie
  '0e0d5ee7-628d-4a98-af26-b60ede2536ce', // El Lagarto
];

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[force-update-email] RESEND_API_KEY not configured');
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
      console.error(`[force-update-email] Resend API error for ${to}:`, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[force-update-email] Error sending to ${to}:`, error);
    return false;
  }
}

function generateUpdateEmailHtml(version: string, message: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Actualización Urgente - M.A.T.S.</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a1a2e; color: #ffffff; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #16213e; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #ef4444; margin: 0; font-size: 32px;">🔄 ACTUALIZACIÓN REQUERIDA</h1>
      <p style="color: #fbbf24; margin-top: 8px; font-size: 18px;">Versión ${version}</p>
    </div>
    
    <!-- Alert Box -->
    <div style="background: linear-gradient(135deg, #7f1d1d, #991b1b); border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 2px solid #ef4444; text-align: center;">
      <p style="color: #fecaca; font-size: 16px; font-weight: bold; margin: 0;">
        ⚠️ ${message}
      </p>
    </div>
    
    <!-- Instructions -->
    <div style="background-color: #1f2937; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
      <h3 style="color: #60a5fa; margin: 0 0 12px 0; font-size: 16px;">📋 Cómo actualizar:</h3>
      <ol style="color: #e5e7eb; margin: 0; padding-left: 20px; line-height: 1.8;">
        <li>Abre la aplicación M.A.T.S.</li>
        <li>Si ves un banner de actualización, haz clic en "Actualizar"</li>
        <li>Si no ves el banner, cierra la app completamente y vuelve a abrirla</li>
        <li>En iPhone/iPad: desliza hacia arriba para cerrar y vuelve a abrir</li>
        <li>En Android: cierra la app desde recientes y vuelve a abrir</li>
      </ol>
    </div>

    <!-- Alternative -->
    <div style="background-color: #1f2937; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h3 style="color: #fbbf24; margin: 0 0 12px 0; font-size: 16px;">💡 Si sigues teniendo problemas:</h3>
      <p style="color: #9ca3af; margin: 0; line-height: 1.6;">
        Borra el caché de la aplicación o reinstálala desde 
        <a href="https://mats-app.com" style="color: #60a5fa; text-decoration: underline;">mats-app.com</a>
      </p>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="https://mats-app.com" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #ffffff; font-weight: bold; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
        🛡️ Abrir M.A.T.S.
      </a>
    </div>
    
    <!-- Footer -->
    <hr style="border: none; border-top: 1px solid #374151; margin: 24px 0;">
    
    <div style="text-align: center;">
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { version, message, requesterId } = await req.json();

    console.log(`[force-update-email] Starting mass email for version ${version}`);
    console.log(`[force-update-email] Requester: ${requesterId}`);

    // Verify requester is authorized
    if (!requesterId || !AUTHORIZED_USER_IDS.includes(requesterId)) {
      console.error('[force-update-email] Unauthorized requester:', requesterId);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all users from auth
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('[force-update-email] Error fetching users:', authError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const users = authData?.users || [];
    console.log(`[force-update-email] Found ${users.length} registered users`);

    const emailHtml = generateUpdateEmailHtml(version, message);
    let sent = 0;
    let failed = 0;

    // Send emails in batches with delay to avoid rate limiting
    for (const user of users) {
      if (user.email) {
        const success = await sendEmail(
          user.email,
          `🔄 ACTUALIZACIÓN URGENTE M.A.T.S. v${version}`,
          emailHtml
        );
        if (success) {
          sent++;
        } else {
          failed++;
        }
        // Delay between emails to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
      }
    }

    console.log(`[force-update-email] Done. Sent: ${sent}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        total: users.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[force-update-email] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
