import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[send-welcome-email] RESEND_API_KEY not configured');
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
      console.error('[send-welcome-email] Resend API error:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('[send-welcome-email] Email sent:', result);
    return true;
  } catch (error) {
    console.error('[send-welcome-email] Error sending email:', error);
    return false;
  }
}

function generateWelcomeEmailHtml(nickname: string, fullName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a M.A.T.S.</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #1a1a2e; color: #ffffff; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #16213e; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #f59e0b; margin: 0; font-size: 36px;">🛡️ M.A.T.S.</h1>
      <p style="color: #60a5fa; margin-top: 8px; font-size: 14px; letter-spacing: 1px;">MONITOREO ACTIVO DE TRÁNSITO Y SEGURIDAD</p>
    </div>
    
    <!-- Welcome Message -->
    <div style="background: linear-gradient(135deg, #1f2937, #374151); border-radius: 12px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
      <h2 style="color: #fbbf24; margin-top: 0; font-size: 24px;">¡Bienvenido, ${fullName || nickname}!</h2>
      <p style="color: #e5e7eb; line-height: 1.6; font-size: 16px; margin-bottom: 0;">
        Ya eres parte de una <strong style="color: #60a5fa;">comunidad de cuidado mutuo</strong> dedicada a protegernos unos a otros. 
        Aquí la seguridad es tarea de todos.
      </p>
    </div>
    
    <!-- Tutorial CTA -->
    <div style="text-align: center; margin-bottom: 32px;">
      <p style="color: #9ca3af; font-size: 14px; margin-bottom: 16px;">Te recomendamos ver nuestro tutorial de instalación:</p>
      <a href="https://safe-guard-link.lovable.app/install" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); color: #000000; font-weight: bold; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-size: 18px; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);">
        📲 Instalar M.A.T.S.
      </a>
    </div>
    
    <!-- Features Section -->
    <h3 style="color: #f59e0b; font-size: 18px; margin-bottom: 20px; text-align: center;">🚀 ¿Qué puedes hacer en M.A.T.S.?</h3>
    
    <div style="display: block;">
      
      <!-- Feature 1: Panic Button -->
      <div style="background-color: #1f2937; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; align-items: flex-start;">
          <span style="font-size: 28px; margin-right: 12px;">🆘</span>
          <div>
            <h4 style="color: #f87171; margin: 0 0 4px 0; font-size: 16px;">Botón de Pánico</h4>
            <p style="color: #9ca3af; margin: 0; font-size: 14px; line-height: 1.5;">
              En una emergencia, presiona el botón de pánico y la comunidad recibirá tu ubicación en tiempo real para ayudarte.
            </p>
          </div>
        </div>
      </div>
      
      <!-- Feature 2: Transit Trips -->
      <div style="background-color: #1f2937; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; align-items: flex-start;">
          <span style="font-size: 28px; margin-right: 12px;">🚗</span>
          <div>
            <h4 style="color: #60a5fa; margin: 0 0 4px 0; font-size: 16px;">Viajes Seguros</h4>
            <p style="color: #9ca3af; margin: 0; font-size: 14px; line-height: 1.5;">
              Registra tus viajes y la comunidad te monitoreará. Si no llegas a tiempo, recibirás alertas automáticas.
            </p>
          </div>
        </div>
      </div>
      
      <!-- Feature 3: Road Reports -->
      <div style="background-color: #1f2937; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; align-items: flex-start;">
          <span style="font-size: 28px; margin-right: 12px;">⚠️</span>
          <div>
            <h4 style="color: #fbbf24; margin: 0 0 4px 0; font-size: 16px;">Reportes de Carretera</h4>
            <p style="color: #9ca3af; margin: 0; font-size: 14px; line-height: 1.5;">
              Reporta accidentes, bloqueos, retenes y más. Ayuda a otros a viajar seguro.
            </p>
          </div>
        </div>
      </div>
      
      <!-- Feature 4: Seismic Alerts -->
      <div style="background-color: #1f2937; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; align-items: flex-start;">
          <span style="font-size: 28px; margin-right: 12px;">🌎</span>
          <div>
            <h4 style="color: #a78bfa; margin: 0 0 4px 0; font-size: 16px;">Alertas Sísmicas</h4>
            <p style="color: #9ca3af; margin: 0; font-size: 14px; line-height: 1.5;">
              Recibe alertas de sismos en tiempo real y reporta tu estado con un solo toque.
            </p>
          </div>
        </div>
      </div>
      
      <!-- Feature 5: Emergency Contacts -->
      <div style="background-color: #1f2937; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; align-items: flex-start;">
          <span style="font-size: 28px; margin-right: 12px;">👨‍👩‍👧‍👦</span>
          <div>
            <h4 style="color: #34d399; margin: 0 0 4px 0; font-size: 16px;">Contactos de Emergencia</h4>
            <p style="color: #9ca3af; margin: 0; font-size: 14px; line-height: 1.5;">
              Configura a tus familiares para que sean notificados automáticamente en caso de emergencia.
            </p>
          </div>
        </div>
      </div>
      
      <!-- Feature 6: Community Map -->
      <div style="background-color: #1f2937; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; align-items: flex-start;">
          <span style="font-size: 28px; margin-right: 12px;">🗺️</span>
          <div>
            <h4 style="color: #38bdf8; margin: 0 0 4px 0; font-size: 16px;">Mapa Comunitario</h4>
            <p style="color: #9ca3af; margin: 0; font-size: 14px; line-height: 1.5;">
              Visualiza en tiempo real a los miembros de la comunidad, reportes activos y rutas de viajes.
            </p>
          </div>
        </div>
      </div>
      
      <!-- Feature 7: Resources -->
      <div style="background-color: #1f2937; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; align-items: flex-start;">
          <span style="font-size: 28px; margin-right: 12px;">📦</span>
          <div>
            <h4 style="color: #fb923c; margin: 0 0 4px 0; font-size: 16px;">Recursos de Emergencia</h4>
            <p style="color: #9ca3af; margin: 0; font-size: 14px; line-height: 1.5;">
              Encuentra hospitales, gasolineras, refugios y más recursos cercanos cuando los necesites.
            </p>
          </div>
        </div>
      </div>
      
      <!-- Feature 8: Internal Messaging -->
      <div style="background-color: #1f2937; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; align-items: flex-start;">
          <span style="font-size: 28px; margin-right: 12px;">💬</span>
          <div>
            <h4 style="color: #ec4899; margin: 0 0 4px 0; font-size: 16px;">Mensajería Interna</h4>
            <p style="color: #9ca3af; margin: 0; font-size: 14px; line-height: 1.5;">
              Comunícate de forma privada con otros miembros de la comunidad.
            </p>
          </div>
        </div>
      </div>
      
    </div>
    
    <!-- Tips Section -->
    <div style="background-color: #1f2937; border-radius: 12px; padding: 20px; margin-top: 24px; margin-bottom: 24px;">
      <h4 style="color: #fbbf24; margin-top: 0; font-size: 16px;">💡 Tips para empezar:</h4>
      <ul style="color: #e5e7eb; margin: 0; padding-left: 20px; line-height: 2;">
        <li>Completa tu perfil con tu información médica (opcional pero útil)</li>
        <li>Agrega al menos 2 contactos de emergencia</li>
        <li>Activa las notificaciones para recibir alertas</li>
        <li>Comparte tu ubicación cuando viajes</li>
      </ul>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="https://safe-guard-link.lovable.app" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #ffffff; font-weight: bold; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
        🚀 Abrir M.A.T.S.
      </a>
    </div>
    
    <!-- Footer -->
    <hr style="border: none; border-top: 1px solid #374151; margin: 24px 0;">
    
    <div style="text-align: center;">
      <p style="color: #9ca3af; font-size: 14px; margin-bottom: 8px;">
        <strong style="color: #f59e0b;">Recuerda:</strong> En M.A.T.S. nos cuidamos entre todos.
      </p>
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        Si tienes dudas, usa el botón de ayuda (?) dentro de la aplicación.<br>
        Este correo fue enviado automáticamente al registrarte en M.A.T.S.
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

    // Parse request body
    const { user_id, email, nickname, full_name } = await req.json();

    if (!email) {
      console.error('[send-welcome-email] Missing email');
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-welcome-email] Sending welcome email to ${email} (${nickname})`);

    const emailHtml = generateWelcomeEmailHtml(nickname || 'Usuario', full_name || nickname || 'Usuario');
    
    const sent = await sendEmail(
      email,
      '🛡️ ¡Bienvenido a M.A.T.S.! - Tu guía para empezar',
      emailHtml
    );

    if (sent && user_id) {
      // Track that we sent the welcome email
      await supabase.from('notifications').insert({
        user_id,
        type: 'welcome_email',
        title: '📧 Email de bienvenida enviado',
        message: `Se envió el email de bienvenida a ${email}`,
        read: true
      });
    }

    return new Response(
      JSON.stringify({ success: sent, email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-welcome-email] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
