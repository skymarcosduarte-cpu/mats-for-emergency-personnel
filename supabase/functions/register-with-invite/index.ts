import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to generate a unique request ID for tracing
const generateRequestId = () => crypto.randomUUID().slice(0, 8);

serve(async (req) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  console.log(`[${requestId}] register-with-invite: Request received at ${new Date().toISOString()}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] CORS preflight handled`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to create users and validate invites
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error(`[${requestId}] JSON parse error:`, parseError);
      return new Response(
        JSON.stringify({ error: 'Datos de solicitud inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password, inviteCode } = body;
    
    console.log(`[${requestId}] Processing registration for email: ${email ? email.substring(0, 3) + '***' : 'missing'}`);

    // Input validation with detailed error messages
    if (!email || typeof email !== 'string') {
      console.log(`[${requestId}] Validation failed: email missing or invalid type`);
      return new Response(
        JSON.stringify({ error: 'Email es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailTrimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      console.log(`[${requestId}] Validation failed: invalid email format`);
      return new Response(
        JSON.stringify({ error: 'Formato de email inválido (ej: usuario@dominio.com)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!password || typeof password !== 'string') {
      console.log(`[${requestId}] Validation failed: password missing`);
      return new Response(
        JSON.stringify({ error: 'Contraseña es requerida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      console.log(`[${requestId}] Validation failed: password too short`);
      return new Response(
        JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.trim().length === 0) {
      console.log(`[${requestId}] Validation failed: invite code missing`);
      return new Response(
        JSON.stringify({ error: 'Se requiere código de invitación' }),
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
      .maybeSingle();

    if (inviteError) {
      console.error(`[${requestId}] Database error fetching invite:`, inviteError);
      return new Response(
        JSON.stringify({ error: 'Error al validar código. Intenta de nuevo.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!invite) {
      console.log(`[${requestId}] Invite code not found: ${normalizedCode}`);
      return new Response(
        JSON.stringify({ error: 'Código de invitación no encontrado. Verifica que lo hayas escrito correctamente.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      console.log(`[${requestId}] Invite code expired: ${normalizedCode}`);
      return new Response(
        JSON.stringify({ error: 'Este código de invitación ha expirado. Solicita uno nuevo.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if max uses reached
    if (invite.max_uses !== null && invite.used_count >= invite.max_uses) {
      console.log(`[${requestId}] Invite code max uses reached: ${normalizedCode}`);
      return new Response(
        JSON.stringify({ error: 'Este código ha alcanzado su límite de usos. Solicita uno nuevo.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] Invite code validated successfully`);

    // Step 2: Check if email already exists
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error(`[${requestId}] Error listing users:`, listError);
      return new Response(
        JSON.stringify({ error: 'Error al verificar disponibilidad del email. Intenta de nuevo.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailExists = existingUsers?.users?.some(
      u => u.email?.toLowerCase() === emailTrimmed
    );

    if (emailExists) {
      console.log(`[${requestId}] Email already registered: ${emailTrimmed.substring(0, 3)}***`);
      return new Response(
        JSON.stringify({ error: 'Este email ya está registrado. Intenta iniciar sesión o recuperar tu contraseña.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] Email available, proceeding with registration`);

    // Step 3: Use the invite code atomically (increment counter)
    const { data: useResult, error: useError } = await supabase.rpc('use_invite_code', { 
      invite_code: normalizedCode 
    });

    if (useError || !useResult) {
      console.error(`[${requestId}] Failed to use invite code:`, useError);
      return new Response(
        JSON.stringify({ error: 'El código ya no está disponible. Puede que otro usuario lo haya usado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] Invite code consumed, creating user account`);

    // Step 4: Create the user using Admin API (auto-confirms email)
    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email: emailTrimmed,
      password,
      email_confirm: true, // Auto-confirm since we validated invite
      user_metadata: {
        invite_code: normalizedCode,
      }
    });

    if (createError) {
      console.error(`[${requestId}] Error creating user:`, createError);
      
      // Try to provide a helpful error message
      let errorMessage = 'Error al crear cuenta. ';
      if (createError.message.includes('already registered')) {
        errorMessage = 'Este email ya está registrado. Intenta iniciar sesión.';
      } else if (createError.message.includes('weak password')) {
        errorMessage = 'La contraseña es muy débil. Usa una combinación de letras y números.';
      } else if (createError.message.includes('rate limit')) {
        errorMessage = 'Demasiados intentos. Espera unos minutos antes de intentar de nuevo.';
      } else {
        errorMessage += 'Intenta de nuevo en unos momentos.';
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authData.user) {
      console.error(`[${requestId}] User creation returned no user object`);
      return new Response(
        JSON.stringify({ error: 'Error inesperado al crear cuenta. Intenta de nuevo.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] User created successfully: ${authData.user.id}`);

    // Step 5: Update profile with the invite code used (profile is created by trigger)
    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ invite_code_used: normalizedCode })
      .eq('id', authData.user.id);

    if (updateError) {
      console.log(`[${requestId}] Note: Could not update profile with invite code (non-critical):`, updateError.message);
      // Non-critical error, continue
    }

    const elapsed = Date.now() - startTime;
    console.log(`[${requestId}] Registration completed successfully in ${elapsed}ms`);

    // Return success - frontend will handle login
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
    console.error(`[${requestId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor. Intenta de nuevo.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});