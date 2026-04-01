import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to generate a unique request ID for tracing
const generateRequestId = () => crypto.randomUUID().slice(0, 8);

// Helper to hash email for privacy-safe logging
const hashEmail = async (email: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
};

interface Invite {
  id: string;
  code: string;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  created_by: string;
}

serve(async (req) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  console.log(`[${requestId}] register-with-invite: Request received at ${new Date().toISOString()}`);
  console.log(`[${requestId}] Method: ${req.method}, URL: ${req.url}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] CORS preflight handled`);
    return new Response(null, { headers: corsHeaders });
  }

  // deno-lint-ignore no-explicit-any
  let supabase: any = null;
  let emailHash = 'unknown';
  let inviteCodeForLog: string | null = null;

  // Helper to log registration attempts to database
  const logAttempt = async (entry: {
    email_hash: string;
    invite_code: string | null;
    status: string;
    error_message?: string;
    error_code?: string;
    // deno-lint-ignore no-explicit-any
    client_info?: Record<string, any>;
  }) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('registration_logs')
        .insert({
          email_hash: entry.email_hash,
          invite_code: entry.invite_code,
          status: entry.status,
          error_message: entry.error_message || null,
          error_code: entry.error_code || null,
          client_info: entry.client_info || null,
        });
      if (error) {
        console.error(`[${requestId}] Failed to log registration attempt:`, error.message);
      } else {
        console.log(`[${requestId}] Logged registration attempt: ${entry.status}`);
      }
    } catch (e) {
      console.error(`[${requestId}] Error logging attempt:`, e);
    }
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`[${requestId}] CRITICAL: Missing environment variables`);
      console.error(`[${requestId}] SUPABASE_URL present: ${!!supabaseUrl}`);
      console.error(`[${requestId}] SUPABASE_SERVICE_ROLE_KEY present: ${!!supabaseServiceKey}`);
      return new Response(
        JSON.stringify({ error: 'Error de configuración del servidor. Contacta soporte.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use service role to create users and validate invites
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });

    // Extract client info for logging
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const clientInfo = {
      user_agent: userAgent.substring(0, 200),
      request_id: requestId,
      timestamp: new Date().toISOString(),
    };

    let body;
    try {
      const rawBody = await req.text();
      console.log(`[${requestId}] Raw body length: ${rawBody.length}`);
      
      if (!rawBody || rawBody.trim() === '') {
        console.error(`[${requestId}] Empty request body received`);
        return new Response(
          JSON.stringify({ error: 'Solicitud vacía. Intenta de nuevo.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      body = JSON.parse(rawBody);
      console.log(`[${requestId}] Body parsed successfully. Keys: ${Object.keys(body).join(', ')}`);
    } catch (parseError) {
      console.error(`[${requestId}] JSON parse error:`, parseError);
      return new Response(
        JSON.stringify({ error: 'Datos de solicitud inválidos. Verifica los campos.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password, inviteCode } = body;
    
    // Log what we received (masked for privacy)
    console.log(`[${requestId}] Received fields:`);
    console.log(`[${requestId}]   - email: ${email ? `${email.substring(0, 3)}***@${email.split('@')[1] || 'missing-domain'}` : 'MISSING'}`);
    console.log(`[${requestId}]   - password: ${password ? `[${password.length} chars]` : 'MISSING'}`);
    console.log(`[${requestId}]   - inviteCode: ${inviteCode || 'MISSING'}`);

    // Generate email hash for logging
    if (email && typeof email === 'string') {
      emailHash = await hashEmail(email);
    }
    inviteCodeForLog = inviteCode?.trim()?.toUpperCase() || null;

    // Log start of registration
    await logAttempt({
      email_hash: emailHash,
      invite_code: inviteCodeForLog,
      status: 'started',
      client_info: clientInfo,
    });

    // Input validation with detailed error messages
    if (!email || typeof email !== 'string') {
      console.log(`[${requestId}] VALIDATION_FAILED: email missing or invalid type`);
      await logAttempt({
        email_hash: emailHash,
        invite_code: inviteCodeForLog,
        status: 'failed',
        error_code: 'EMAIL_MISSING',
        error_message: 'Email no proporcionado',
        client_info: clientInfo,
      });
      return new Response(
        JSON.stringify({ error: 'Email es requerido', code: 'EMAIL_MISSING' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailTrimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      console.log(`[${requestId}] VALIDATION_FAILED: invalid email format - "${emailTrimmed}"`);
      await logAttempt({
        email_hash: emailHash,
        invite_code: inviteCodeForLog,
        status: 'failed',
        error_code: 'EMAIL_INVALID_FORMAT',
        error_message: `Formato inválido: ${emailTrimmed}`,
        client_info: clientInfo,
      });
      return new Response(
        JSON.stringify({ error: 'Formato de email inválido (ej: usuario@dominio.com)', code: 'EMAIL_INVALID_FORMAT' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!password || typeof password !== 'string') {
      console.log(`[${requestId}] VALIDATION_FAILED: password missing`);
      await logAttempt({
        email_hash: emailHash,
        invite_code: inviteCodeForLog,
        status: 'failed',
        error_code: 'PASSWORD_MISSING',
        error_message: 'Contraseña no proporcionada',
        client_info: clientInfo,
      });
      return new Response(
        JSON.stringify({ error: 'Contraseña es requerida', code: 'PASSWORD_MISSING' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 8) {
      console.log(`[${requestId}] VALIDATION_FAILED: password too short (${password.length} chars)`);
      await logAttempt({
        email_hash: emailHash,
        invite_code: inviteCodeForLog,
        status: 'failed',
        error_code: 'PASSWORD_TOO_SHORT',
        error_message: `Contraseña muy corta: ${password.length} caracteres`,
        client_info: clientInfo,
      });
      return new Response(
        JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres', code: 'PASSWORD_TOO_SHORT' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.trim().length === 0) {
      console.log(`[${requestId}] VALIDATION_FAILED: invite code missing`);
      await logAttempt({
        email_hash: emailHash,
        invite_code: inviteCodeForLog,
        status: 'failed',
        error_code: 'INVITE_CODE_MISSING',
        error_message: 'Código de invitación no proporcionado',
        client_info: clientInfo,
      });
      return new Response(
        JSON.stringify({ error: 'Se requiere código de invitación', code: 'INVITE_CODE_MISSING' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedCode = inviteCode.trim().toUpperCase();
    console.log(`[${requestId}] Validating invite code: ${normalizedCode}`);

    // Step 1: Validate invite code exists and is usable
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('code', normalizedCode)
      .maybeSingle() as { data: Invite | null; error: Error | null };

    if (inviteError) {
      console.error(`[${requestId}] DATABASE_ERROR fetching invite:`, inviteError);
      await logAttempt({
        email_hash: emailHash,
        invite_code: normalizedCode,
        status: 'failed',
        error_code: 'DB_INVITE_FETCH_ERROR',
        error_message: inviteError.message,
        client_info: clientInfo,
      });
      return new Response(
        JSON.stringify({ error: 'Error al validar código. Intenta de nuevo.', code: 'DB_INVITE_FETCH_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!invite) {
      console.log(`[${requestId}] INVITE_NOT_FOUND: ${normalizedCode}`);
      await logAttempt({
        email_hash: emailHash,
        invite_code: normalizedCode,
        status: 'failed',
        error_code: 'INVITE_NOT_FOUND',
        error_message: `Código no encontrado: ${normalizedCode}`,
        client_info: clientInfo,
      });
      return new Response(
        JSON.stringify({ error: 'Código de invitación no encontrado. Verifica que lo hayas escrito correctamente.', code: 'INVITE_NOT_FOUND' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] Invite found: expires_at=${invite.expires_at}, max_uses=${invite.max_uses}, used_count=${invite.used_count}`);

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      console.log(`[${requestId}] INVITE_EXPIRED: ${normalizedCode}`);
      await logAttempt({
        email_hash: emailHash,
        invite_code: normalizedCode,
        status: 'failed',
        error_code: 'INVITE_EXPIRED',
        error_message: `Código expirado: ${invite.expires_at}`,
        client_info: clientInfo,
      });
      return new Response(
        JSON.stringify({ error: 'Este código de invitación ha expirado. Solicita uno nuevo.', code: 'INVITE_EXPIRED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if max uses reached
    if (invite.max_uses !== null && invite.used_count >= invite.max_uses) {
      console.log(`[${requestId}] INVITE_MAX_USES: ${normalizedCode} (${invite.used_count}/${invite.max_uses})`);
      await logAttempt({
        email_hash: emailHash,
        invite_code: normalizedCode,
        status: 'failed',
        error_code: 'INVITE_MAX_USES',
        error_message: `Límite alcanzado: ${invite.used_count}/${invite.max_uses}`,
        client_info: clientInfo,
      });
      return new Response(
        JSON.stringify({ error: 'Este código ha alcanzado su límite de usos. Solicita uno nuevo.', code: 'INVITE_MAX_USES' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] ✓ Invite code validated successfully`);
    await logAttempt({
      email_hash: emailHash,
      invite_code: normalizedCode,
      status: 'invite_validated',
      client_info: clientInfo,
    });

    // Step 2: Check if email already exists BEFORE consuming invite
    console.log(`[${requestId}] Checking if email already exists...`);
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (!listError && existingUsers?.users) {
      const emailExists = existingUsers.users.some(
        (u: { email?: string }) => u.email?.toLowerCase() === emailTrimmed
      );
      if (emailExists) {
        console.log(`[${requestId}] EMAIL_EXISTS: ${emailTrimmed} already registered`);
        await logAttempt({
          email_hash: emailHash,
          invite_code: normalizedCode,
          status: 'failed',
          error_code: 'EMAIL_EXISTS',
          error_message: 'Email ya registrado (pre-check)',
          client_info: clientInfo,
        });
        return new Response(
          JSON.stringify({ error: 'Este email ya está registrado. Intenta iniciar sesión o recuperar tu contraseña.', code: 'EMAIL_EXISTS' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Step 3: Use the invite code atomically BEFORE creating user
    console.log(`[${requestId}] Consuming invite code...`);
    const { data: useResult, error: useError } = await supabase.rpc('use_invite_code', { 
      invite_code: normalizedCode 
    });

    if (useError || !useResult) {
      console.error(`[${requestId}] INVITE_CONSUME_FAILED:`, useError);
      await logAttempt({
        email_hash: emailHash,
        invite_code: normalizedCode,
        status: 'failed',
        error_code: 'INVITE_CONSUME_FAILED',
        error_message: useError?.message || 'use_invite_code returned false',
        client_info: clientInfo,
      });
      return new Response(
        JSON.stringify({ error: 'El código ya no está disponible. Puede que otro usuario lo haya usado.', code: 'INVITE_CONSUME_FAILED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] ✓ Invite code consumed, creating user account...`);

    // Step 4: Create the user using Admin API (auto-confirms email)
    console.log(`[${requestId}] Calling supabase.auth.admin.createUser...`);
    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email: emailTrimmed,
      password,
      email_confirm: true,
      user_metadata: {
        invite_code: normalizedCode,
      }
    });

    if (createError) {
      console.error(`[${requestId}] USER_CREATE_ERROR:`, {
        message: createError.message,
        code: createError.code,
        status: createError.status,
      });
      
      // Rollback: decrement invite used_count since user wasn't created
      console.log(`[${requestId}] Rolling back invite code usage...`);
      await supabase
        .from('invites')
        .update({ used_count: invite.used_count + 1 - 1 })
        .eq('code', normalizedCode);
      // Alternative: decrement via raw update
      await supabase.rpc('use_invite_code', { invite_code: '__noop__' }).catch(() => {});
      // Direct decrement
      const { error: rollbackErr } = await supabase
        .from('invites')
        .update({ used_count: invite.used_count })
        .eq('code', normalizedCode);
      if (rollbackErr) {
        console.error(`[${requestId}] Rollback failed:`, rollbackErr.message);
      } else {
        console.log(`[${requestId}] ✓ Invite code usage rolled back`);
      }
      
      let errorCode = 'USER_CREATE_FAILED';
      let errorMessage = 'Error al crear cuenta. Intenta de nuevo en unos momentos.';
      
      if (createError.message?.includes('already registered') || 
          createError.code === 'email_exists' ||
          createError.message?.includes('email_exists') ||
          createError.message?.includes('already been registered')) {
        errorCode = 'EMAIL_EXISTS';
        errorMessage = 'Este email ya está registrado. Intenta iniciar sesión o recuperar tu contraseña.';
      } else if (createError.message?.includes('weak password')) {
        errorCode = 'WEAK_PASSWORD';
        errorMessage = 'La contraseña es muy débil. Usa una combinación de letras y números.';
      } else if (createError.message?.includes('rate limit')) {
        errorCode = 'RATE_LIMITED';
        errorMessage = 'Demasiados intentos. Espera unos minutos antes de intentar de nuevo.';
      }
      
      await logAttempt({
        email_hash: emailHash,
        invite_code: normalizedCode,
        status: 'failed',
        error_code: errorCode,
        error_message: createError.message,
        client_info: clientInfo,
      });
      
      return new Response(
        JSON.stringify({ error: errorMessage, code: errorCode }),
        { status: errorCode === 'RATE_LIMITED' ? 429 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authData.user) {
      console.error(`[${requestId}] USER_CREATE_NO_USER: User creation returned no user object`);
      await logAttempt({
        email_hash: emailHash,
        invite_code: normalizedCode,
        status: 'failed',
        error_code: 'USER_CREATE_NO_USER',
        error_message: 'createUser returned null user',
        client_info: clientInfo,
      });
      return new Response(
        JSON.stringify({ error: 'Error inesperado al crear cuenta. Intenta de nuevo.', code: 'USER_CREATE_NO_USER' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] ✓ User created successfully: ${authData.user.id}`);
    await logAttempt({
      email_hash: emailHash,
      invite_code: normalizedCode,
      status: 'user_created',
      client_info: { ...clientInfo, user_id: authData.user.id },
    });

    // Step 4: Update profile with the invite code used (profile is created by trigger)
    console.log(`[${requestId}] Waiting for profile trigger...`);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ invite_code_used: normalizedCode })
      .eq('id', authData.user.id);

    if (updateError) {
      console.log(`[${requestId}] Note: Could not update profile with invite code (non-critical):`, updateError.message);
    } else {
      console.log(`[${requestId}] ✓ Profile updated with invite code`);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[${requestId}] ✓ REGISTRATION COMPLETED in ${elapsed}ms for user ${authData.user.id}`);
    
    await logAttempt({
      email_hash: emailHash,
      invite_code: normalizedCode,
      status: 'completed',
      client_info: { ...clientInfo, user_id: authData.user.id, elapsed_ms: elapsed },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Cuenta creada exitosamente',
        userId: authData.user.id,
        email: authData.user.email
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[${requestId}] UNEXPECTED_ERROR:`, error);
    console.error(`[${requestId}] Error stack:`, error instanceof Error ? error.stack : 'no stack');
    
    // Try to log the error
    if (supabase) {
      try {
        await supabase
          .from('registration_logs')
          .insert({
            email_hash: emailHash,
            invite_code: inviteCodeForLog,
            status: 'failed',
            error_code: 'UNEXPECTED_ERROR',
            error_message: error instanceof Error ? error.message : String(error),
            client_info: { request_id: requestId },
          });
      } catch (logError) {
        console.error(`[${requestId}] Failed to log error:`, logError);
      }
    }
    
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor. Intenta de nuevo.', code: 'UNEXPECTED_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
