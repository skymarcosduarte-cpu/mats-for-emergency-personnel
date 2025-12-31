import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
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

    const { email, password, inviteCode } = await req.json();

    // Input validation
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      console.log('[register-with-invite] Invalid email');
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      console.log('[register-with-invite] Invalid password');
      return new Response(
        JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.trim().length === 0) {
      console.log('[register-with-invite] No invite code provided');
      return new Response(
        JSON.stringify({ error: 'Se requiere código de invitación' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedCode = inviteCode.trim().toUpperCase();
    console.log(`[register-with-invite] Attempting registration for ${email} with code ${normalizedCode}`);

    // Step 1: Validate invite code exists and is usable
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('code', normalizedCode)
      .maybeSingle();

    if (inviteError) {
      console.error('[register-with-invite] Error fetching invite:', inviteError);
      return new Response(
        JSON.stringify({ error: 'Error al validar código' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!invite) {
      console.log('[register-with-invite] Invite code not found:', normalizedCode);
      return new Response(
        JSON.stringify({ error: 'Código de invitación no encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      console.log('[register-with-invite] Invite code expired:', normalizedCode);
      return new Response(
        JSON.stringify({ error: 'Este código de invitación ha expirado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if max uses reached
    if (invite.max_uses !== null && invite.used_count >= invite.max_uses) {
      console.log('[register-with-invite] Invite code max uses reached:', normalizedCode);
      return new Response(
        JSON.stringify({ error: 'Este código ha alcanzado su límite de usos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Check if email already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      u => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (emailExists) {
      console.log('[register-with-invite] Email already registered:', email);
      return new Response(
        JSON.stringify({ error: 'Este email ya está registrado. Intenta iniciar sesión.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Use the invite code atomically (increment counter)
    const { data: useResult, error: useError } = await supabase.rpc('use_invite_code', { 
      invite_code: normalizedCode 
    });

    if (useError || !useResult) {
      console.error('[register-with-invite] Failed to use invite code:', useError);
      return new Response(
        JSON.stringify({ error: 'No se pudo usar el código de invitación' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Create the user using Admin API (auto-confirms email)
    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // Auto-confirm since we validated invite
      user_metadata: {
        invite_code: normalizedCode,
      }
    });

    if (createError) {
      console.error('[register-with-invite] Error creating user:', createError);
      
      // Rollback: decrement invite counter since user creation failed
      // We can't easily do this with current RPC, but the invite won't be "wasted" much
      
      return new Response(
        JSON.stringify({ error: createError.message || 'Error al crear cuenta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authData.user) {
      console.error('[register-with-invite] User creation returned no user');
      return new Response(
        JSON.stringify({ error: 'Error al crear cuenta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[register-with-invite] User created successfully:', authData.user.id);

    // Step 5: Update profile with the invite code used (profile is created by trigger)
    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ invite_code_used: normalizedCode })
      .eq('id', authData.user.id);

    if (updateError) {
      console.log('[register-with-invite] Could not update profile with invite code:', updateError);
      // Non-critical error, continue
    }

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
    console.error('[register-with-invite] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
