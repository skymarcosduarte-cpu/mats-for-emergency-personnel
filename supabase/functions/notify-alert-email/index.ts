// Edge function to send email notifications to alert recipients when panic events or help requests are created
// This provides a "virtual guard" system that notifies designated people 24/7

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PANIC_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  'AMBULANCIA_PROPIA': { label: 'Ambulancia solicitada', emoji: '🚑' },
  'AMBULANCIA_TERCERO': { label: 'Ambulancia para tercero', emoji: '🚑' },
  'PATRULLA': { label: 'Patrulla solicitada', emoji: '🚔' },
  'MECANICO': { label: 'Mecánico solicitado', emoji: '🔧' },
  'PROTECCION_CIVIL': { label: 'Protección Civil', emoji: '🆘' },
};

const HELP_KIND_LABELS: Record<string, { label: string; emoji: string }> = {
  'MEDICAL': { label: 'Asistencia Médica', emoji: '🏥' },
  'RESCUE': { label: 'Rescate', emoji: '🦺' },
  'SUPPLIES': { label: 'Suministros', emoji: '📦' },
  'TRANSPORT': { label: 'Transporte', emoji: '🚗' },
  'SHELTER': { label: 'Refugio', emoji: '🏠' },
  'OTHER': { label: 'Otro', emoji: '❓' },
};

interface AlertPayload {
  alertType: 'PANIC' | 'HELP_REQUEST';
  alertId: string;
  panicType?: string;
  helpKind?: string;
  creatorName: string;
  message?: string;
  lat: number;
  lng: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('[notify-alert-email] RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('[notify-alert-email] Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error('[notify-alert-email] Invalid authentication:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: AlertPayload = await req.json();
    console.log('[notify-alert-email] Received payload:', payload);

    if (!payload.alertType || !payload.alertId) {
      return new Response(
        JSON.stringify({ error: 'alertType and alertId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to access recipients
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get active email recipients based on alert type
    const filterColumn = payload.alertType === 'PANIC' ? 'notify_panic' : 'notify_help_request';
    const { data: recipients, error: recipientsError } = await supabase
      .from('alert_email_recipients')
      .select('email, name')
      .eq('is_active', true)
      .eq(filterColumn, true);

    if (recipientsError) {
      console.error('[notify-alert-email] Error fetching recipients:', recipientsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch recipients' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!recipients || recipients.length === 0) {
      console.log('[notify-alert-email] No recipients configured');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No recipients configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build email content
    const now = new Date();
    const timestamp = now.toLocaleString('es-MX', { 
      timeZone: 'America/Mexico_City',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const mapsUrl = `https://www.google.com/maps?q=${payload.lat},${payload.lng}`;
    
    let alertLabel: string;
    let alertEmoji: string;
    let alertColor: string;

    if (payload.alertType === 'PANIC') {
      const panicInfo = PANIC_TYPE_LABELS[payload.panicType || ''] || { label: 'Alerta de Pánico', emoji: '🚨' };
      alertLabel = panicInfo.label;
      alertEmoji = panicInfo.emoji;
      alertColor = '#DC2626'; // Red
    } else {
      const helpInfo = HELP_KIND_LABELS[payload.helpKind || ''] || { label: 'Solicitud de Ayuda', emoji: '🆘' };
      alertLabel = helpInfo.label;
      alertEmoji = helpInfo.emoji;
      alertColor = '#F59E0B'; // Amber
    }

    const subject = `${alertEmoji} ALERTA MATS: ${alertLabel} - ${payload.creatorName}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background-color: ${alertColor}; color: white; padding: 24px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 8px;">${alertEmoji}</div>
      <h1 style="margin: 0; font-size: 24px; font-weight: bold;">ALERTA DE EMERGENCIA</h1>
      <p style="margin: 8px 0 0; opacity: 0.9;">${alertLabel}</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e5e5;">
            <strong style="color: #6b7280;">Solicitante:</strong>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">
            <strong style="color: #111827;">${payload.creatorName}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e5e5;">
            <strong style="color: #6b7280;">Hora:</strong>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">
            ${timestamp}
          </td>
        </tr>
        ${payload.message ? `
        <tr>
          <td colspan="2" style="padding: 12px 0; border-bottom: 1px solid #e5e5e5;">
            <strong style="color: #6b7280;">Mensaje:</strong>
            <p style="margin: 8px 0 0; color: #374151;">${payload.message}</p>
          </td>
        </tr>
        ` : ''}
      </table>
      
      <!-- Map Link -->
      <div style="margin-top: 24px; text-align: center;">
        <a href="${mapsUrl}" style="display: inline-block; background-color: ${alertColor}; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 16px;">
          📍 Ver Ubicación en Mapa
        </a>
      </div>
      
      <p style="margin-top: 24px; text-align: center; color: #6b7280; font-size: 14px;">
        Coordenadas: ${payload.lat.toFixed(6)}, ${payload.lng.toFixed(6)}
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e5e5;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        Este correo fue enviado automáticamente por MATS (Sistema de Alertas de Tránsito Seguro)
      </p>
    </div>
    
  </div>
</body>
</html>
`;

    // Send emails using Resend API directly
    const emailAddresses = recipients.map(r => r.email);
    console.log(`[notify-alert-email] Sending to ${emailAddresses.length} recipients:`, emailAddresses);

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'M.A.T.S. Alertas <noreply@mats-app.com>',
          to: emailAddresses,
          subject: subject,
          html: htmlContent,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[notify-alert-email] Resend API error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to send emails', details: errorText }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const emailResponse = await response.json();
      console.log('[notify-alert-email] Email sent successfully:', emailResponse);

      return new Response(
        JSON.stringify({ 
          success: true, 
          sent: emailAddresses.length,
          messageId: emailResponse?.id 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (sendError) {
      console.error('[notify-alert-email] Error sending email:', sendError);
      return new Response(
        JSON.stringify({ error: 'Email send failed', details: String(sendError) }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('[notify-alert-email] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
