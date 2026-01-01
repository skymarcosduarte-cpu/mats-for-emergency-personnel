// Auth Gate Screen for COMUNIDAD EX SOS
// Email/Password Auth + Invite Code + Profile Setup

import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, Eye, EyeOff, UserPlus, LogIn, Mail } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AppFooter } from '@/components/AppFooter';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MatsLogo } from '@/components/MatsLogo';
import { PrivacyConsentDialog } from '@/components/PrivacyConsentDialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type AuthStep = 'auth' | 'profile';

const SPECIALTIES = [
  'Bombero',
  'Rescatista urbano',
  'Paramédico',
  'Técnico en Urgencias Médicas (TUM)',
  'Enfermera/Enfermero',
  'Médico',
  'Rescatista de alta montaña',
  'Rescatista acuático',
  'Buzo',
  'Radioaficionado',
  'Especialista en telecomunicaciones',
  'Policía',
  'Electricista',
  'Plomero',
  'Ingeniero civil',
  'Psicólogo',
  'Operador de maquinaria pesada',
  'Conductor de ambulancia',
  'Cocinero/preparación de alimentos',
  'Coordinador de albergues',
  'Traductor',
  'Veterinario',
  'Prensa',
  'Sacerdote',
];

interface AuthGateProps {
  onAuthComplete?: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthComplete }) => {
  const [step, setStep] = useState<AuthStep>('auth');
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    nickname: '',
    specialties: [] as string[],
    phone: '',
    birthday: '',
    role: 'SOS_ACTIVO' as 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR',
    canProvideMedicalAssistance: false,
    hasFirstAidKit: false,
    hasAmbulance: false,
    hasRescueUnit: false,
    hasK9Unit: false,
  });
  
  // Privacy consent state
  const [showPrivacyConsent, setShowPrivacyConsent] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    shareLocation: true,
    shareMedicalInfo: true,
  });

  const { signUp, signIn, createProfile, user, isProfileComplete, refetchProfile } = useAuth();

  // Check if user needs to complete profile
  useEffect(() => {
    if (user && !isProfileComplete) {
      setStep('profile');
    } else if (user && isProfileComplete) {
      onAuthComplete?.();
    }
  }, [user, isProfileComplete, onAuthComplete]);

  // Email validation helper with detailed feedback
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const getEmailError = (emailValue: string): string | null => {
    if (!emailValue.trim()) return null;
    if (!emailValue.includes('@')) return 'El email debe contener @';
    if (!isValidEmail(emailValue)) return 'Formato de email inválido (ej: usuario@dominio.com)';
    return null;
  };

  const emailError = getEmailError(email);
  const forgotPasswordEmailError = getEmailError(forgotPasswordEmail);

  // Handle forgot password
  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail.trim()) {
      setError('Ingresa tu email');
      return;
    }

    if (!isValidEmail(forgotPasswordEmail)) {
      setError('El formato del email no es válido');
      return;
    }

    setForgotPasswordLoading(true);
    setError(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        forgotPasswordEmail,
        {
          redirectTo: `${window.location.origin}/settings`,
        }
      );
      
      if (resetError) {
        if (resetError.message.includes('rate limit')) {
          setError('Demasiados intentos. Espera unos minutos.');
        } else {
          setError('Error al enviar el email. Verifica tu dirección.');
        }
      } else {
        setForgotPasswordSuccess(true);
      }
    } catch (err) {
      setError('Error al enviar el email de recuperación');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  // Handle login with improved validation
  const handleLogin = async () => {
    // Clear previous errors
    setError(null);

    if (!email.trim()) {
      setError('Ingresa tu email');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Formato de email inválido');
      return;
    }

    if (!password.trim()) {
      setError('Ingresa tu contraseña');
      return;
    }

    setLoading(true);

    try {
      const { error: signInError } = await signIn(email.trim().toLowerCase(), password, rememberMe);
      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Email o contraseña incorrectos. Verifica tus datos.');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Tu email no ha sido confirmado. Revisa tu bandeja de entrada.');
        } else if (signInError.message.includes('rate limit')) {
          setError('Demasiados intentos. Espera unos minutos.');
        } else {
          setError('Error al iniciar sesión. Intenta de nuevo.');
        }
      }
    } catch (err) {
      console.error('[AuthGate] Login error:', err);
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Handle signup - 100% server-side registration with improved error handling
  const handleSignup = async () => {
    // Clear previous errors
    setError(null);

    // Validate invite code first (most common user issue)
    if (!inviteCode.trim()) {
      setError('Se requiere un código de invitación para registrarse');
      return;
    }

    // Accept EXS-XXXXXX format or any alphanumeric code for flexibility
    const trimmedCode = inviteCode.trim().toUpperCase();
    if (!trimmedCode.match(/^(EXS-[A-Z0-9]{6}|[A-Z0-9-]{4,20})$/)) {
      setError('Formato de código inválido. Verifica que lo hayas escrito correctamente.');
      return;
    }

    if (!email.trim()) {
      setError('Ingresa tu email');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Formato de email inválido (ej: usuario@dominio.com)');
      return;
    }

    if (!password.trim()) {
      setError('Ingresa una contraseña');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    // Retry logic for transient network errors
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[AuthGate] Retry attempt ${attempt}/${maxRetries}`);
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        // Call server-side registration endpoint
        const response = await supabase.functions.invoke('register-with-invite', {
          body: {
            email: email.trim().toLowerCase(),
            password,
            inviteCode: trimmedCode,
          }
        });

        // Check for network-level errors (fetch failed, timeout, etc.)
        if (response.error) {
          console.error('[AuthGate] Network/fetch error:', response.error);
          lastError = response.error;
          
          // Only retry on network/timeout errors
          if (response.error.message?.includes('network') || 
              response.error.message?.includes('timeout') ||
              response.error.message?.includes('fetch') ||
              response.error.message?.includes('Failed to fetch')) {
            if (attempt < maxRetries) continue;
          }
          
          // Check if the error contains the actual response from the server
          // supabase.functions.invoke puts server error responses in response.error for non-2xx status
          const serverMessage = response.error?.message || '';
          if (serverMessage.includes('email ya está registrado') || 
              serverMessage.includes('ya registrado')) {
            setError('Este email ya está registrado. Intenta iniciar sesión o recuperar tu contraseña.');
            setLoading(false);
            return;
          }
          
          setError('Error de conexión. Verifica tu internet e intenta de nuevo.');
          setLoading(false);
          return;
        }

        const result = response.data;

        // Server returned an error in the body (for 400 responses that still return JSON)
        if (!result || !result.success) {
          const errorMsg = result?.error || 'Error desconocido al crear cuenta';
          console.log('[AuthGate] Server error:', errorMsg);
          
          // Show the specific error message from the server
          setError(errorMsg);
          setLoading(false);
          return;
        }

        // Success! Now sign in the user
        console.log('[AuthGate] User created successfully, signing in...');
        
        const { error: signInError } = await signIn(
          email.trim().toLowerCase(), 
          password, 
          rememberMe
        );
        
        if (signInError) {
          // User was created but sign-in failed - they can try logging in manually
          console.log('[AuthGate] Sign-in after registration failed:', signInError);
          toast({
            title: '¡Cuenta creada!',
            description: 'Ahora inicia sesión con tus credenciales.',
          });
          setAuthTab('login');
          // Clear password for security when switching to login tab
          setPassword('');
        } else {
          // Sign-in succeeded, show success toast
          toast({
            title: '¡Bienvenido/a!',
            description: 'Tu cuenta ha sido creada exitosamente.',
          });
        }
        // If sign-in succeeded, the auth state listener will handle navigation
        
        setLoading(false);
        return; // Exit retry loop on success
        
      } catch (err) {
        console.error('[AuthGate] Unexpected signup error:', err);
        lastError = err as Error;
        
        // Only retry on unexpected errors that might be transient
        if (attempt < maxRetries) continue;
      }
    }

    // All retries failed
    console.error('[AuthGate] All signup attempts failed:', lastError);
    setError('Error de conexión. Por favor verifica tu internet e intenta de nuevo.');
    setLoading(false);
  };

  // Translate common database errors to Spanish
  const translateError = (errorMessage: string): string => {
    if (errorMessage.includes('duplicate key value violates unique constraint')) {
      if (errorMessage.includes('profiles_pkey')) {
        return 'Ya existe un perfil para esta cuenta. Intenta cerrar sesión y volver a iniciar.';
      }
      return 'Este registro ya existe en el sistema.';
    }
    if (errorMessage.includes('violates foreign key constraint')) {
      return 'Error de referencia en la base de datos. Contacta soporte.';
    }
    if (errorMessage.includes('null value in column')) {
      return 'Faltan campos obligatorios. Por favor completa toda la información.';
    }
    return errorMessage;
  };

  // Handle profile creation - show privacy consent first
  const handleProfileSubmit = async () => {
    if (!profileForm.fullName.trim() || !profileForm.phone.trim() || !profileForm.birthday) {
      setError('Completa todos los campos obligatorios');
      return;
    }
    
    // Show privacy consent dialog
    setShowPrivacyConsent(true);
  };

  // Handle privacy consent and complete profile creation
  const handlePrivacyAccept = async (shareLocation: boolean, shareMedicalInfo: boolean) => {
    console.log('[AuthGate] Privacy accepted, creating profile...');
    
    // Keep dialog open until we're done, just disable interaction
    setLoading(true);
    setError(null);
    setPrivacySettings({ shareLocation, shareMedicalInfo });

    try {
      // Check if profile already exists (edge case: user refreshed mid-registration)
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user?.id)
        .maybeSingle();

      if (checkError) {
        console.error('[AuthGate] Error checking existing profile:', checkError);
      }

      if (existingProfile) {
        console.log('[AuthGate] Profile already exists, updating privacy settings and completing...');
        // Profile exists - just update privacy settings
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            share_location: shareLocation,
            share_medical_info: shareMedicalInfo,
            privacy_consent_at: new Date().toISOString(),
            terms_accepted_at: new Date().toISOString(),
          })
          .eq('id', user?.id);

        if (updateError) {
          console.error('[AuthGate] Error updating privacy settings:', updateError);
        }

        // Force refetch profile to update auth state
        await refetchProfile();
        
        // Close dialog and complete
        setShowPrivacyConsent(false);
        onAuthComplete?.();
        return;
      }

      console.log('[AuthGate] Creating new profile...');
      const nickname = profileForm.nickname.trim() || profileForm.fullName.split(' ')[0];
      
      const { error: profileError } = await createProfile({
        full_name: profileForm.fullName,
        nickname,
        specialty: profileForm.specialties.length > 0 ? profileForm.specialties : null,
        phone: profileForm.phone,
        birthday: profileForm.birthday,
        role: profileForm.role,
        can_provide_medical_assistance: profileForm.canProvideMedicalAssistance,
        has_first_aid_kit: profileForm.hasFirstAidKit,
        has_ambulance: profileForm.hasAmbulance,
        has_rescue_unit: profileForm.hasRescueUnit,
        has_k9_unit: profileForm.hasK9Unit,
      });

      if (profileError) {
        console.error('[AuthGate] Profile creation error:', profileError);
        setShowPrivacyConsent(false);
        setError(translateError(profileError.message));
        return;
      }

      console.log('[AuthGate] Profile created, updating privacy settings...');
      // Update privacy settings
      const { error: privacyError } = await supabase
        .from('profiles')
        .update({
          share_location: shareLocation,
          share_medical_info: shareMedicalInfo,
          privacy_consent_at: new Date().toISOString(),
          terms_accepted_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (privacyError) {
        console.error('[AuthGate] Privacy settings update error:', privacyError);
        // Non-critical, continue
      }

      // Force refetch profile to update auth state before completing
      console.log('[AuthGate] Refetching profile to update auth state...');
      await refetchProfile();

      console.log('[AuthGate] Registration complete!');
      toast({
        title: '¡Registro completado!',
        description: 'Tu perfil ha sido creado exitosamente. ¡Bienvenido/a a la comunidad!',
      });
      setShowPrivacyConsent(false);
      onAuthComplete?.();
    } catch (err) {
      console.error('[AuthGate] Unexpected error during profile creation:', err);
      setShowPrivacyConsent(false);
      setError('Error al crear perfil. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" style={{ minHeight: '100vh' }}>
      {/* Privacy Consent Dialog */}
      <PrivacyConsentDialog
        open={showPrivacyConsent}
        onAccept={handlePrivacyAccept}
        onDecline={() => setShowPrivacyConsent(false)}
      />
      
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <MatsLogo size={80} showText className="mb-8" />

        <div className="w-full max-w-sm space-y-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {step === 'auth' && (
            <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as 'login' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="signup">Registrarse</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4 mt-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    placeholder="tu@email.com"
                    className={emailError ? 'border-destructive' : ''}
                    autoComplete="email"
                  />
                  {emailError && (
                    <p className="text-xs text-destructive mt-1">{emailError}</p>
                  )}
                </div>

                <div>
                  <Label>Contraseña</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                  />
                  <label
                    htmlFor="remember-me"
                    className="text-sm text-muted-foreground cursor-pointer select-none"
                  >
                    Mantener sesión iniciada
                  </label>
                </div>

                <Button onClick={handleLogin} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Iniciando sesión...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 mr-2" />
                      Iniciar Sesión
                    </>
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setForgotPasswordEmail(email);
                    setForgotPasswordSuccess(false);
                    setError(null);
                  }}
                  className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 mt-4">
                <div>
                  <Label>Código de invitación *</Label>
                  <Input
                    value={inviteCode}
                    onChange={(e) => {
                      setInviteCode(e.target.value.toUpperCase());
                      setError(null);
                    }}
                    placeholder="EXS-XXXXXX"
                    className={cn(
                      "font-mono",
                      inviteCode.trim() && !inviteCode.match(/^(EXS-[A-Z0-9]{6}|[A-Z0-9-]{4,20})$/) 
                        ? 'border-warning' 
                        : inviteCode.trim() 
                          ? 'border-safe' 
                          : ''
                    )}
                    maxLength={20}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Solicita tu código a un miembro de la comunidad
                  </p>
                </div>

                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    placeholder="tu@email.com"
                    className={emailError ? 'border-destructive' : ''}
                    autoComplete="email"
                  />
                  {emailError && (
                    <p className="text-xs text-destructive mt-1">{emailError}</p>
                  )}
                </div>

                <div>
                  <Label>Contraseña *</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder="Mínimo 6 caracteres"
                      className={password && password.length < 6 ? 'border-warning' : ''}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && password.length < 6 && (
                    <p className="text-xs text-warning mt-1">
                      {6 - password.length} caracteres más requeridos
                    </p>
                  )}
                  {password && password.length >= 6 && (
                    <p className="text-xs text-safe mt-1">✓ Contraseña válida</p>
                  )}
                </div>

                <Button onClick={handleSignup} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creando cuenta...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Crear Cuenta
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          )}

          {step === 'profile' && (
            <div className="space-y-4">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground">Tu Perfil</h1>
                <p className="text-sm text-muted-foreground mt-1">Completa tu información</p>
              </div>

              <div>
                <Label>Nombre completo *</Label>
                <Input
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  placeholder="Juan Pérez García"
                />
              </div>

              <div>
                <Label>Apodo (nombre para radio)</Label>
                <Input
                  value={profileForm.nickname}
                  onChange={(e) => setProfileForm({ ...profileForm, nickname: e.target.value })}
                  placeholder="JP23 (opcional)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Nombre corto para identificarte por radio
                </p>
              </div>

              <div>
                <Label>Teléfono *</Label>
                <Input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value.replace(/\D/g, '') })}
                  placeholder="5512345678"
                  maxLength={10}
                />
              </div>

              <div>
                <Label>Fecha de nacimiento *</Label>
                <Input
                  type="date"
                  value={profileForm.birthday}
                  onChange={(e) => setProfileForm({ ...profileForm, birthday: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tu cumpleaños aparecerá en el tablero de la comunidad
                </p>
              </div>

              <div>
                <Label>Especialidades (selecciona todas las que apliquen)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-64 overflow-y-auto p-1">
                  {SPECIALTIES.map((spec) => {
                    const isSelected = profileForm.specialties.includes(spec);
                    return (
                      <label
                        key={spec}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm min-w-0 overflow-hidden",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setProfileForm({
                                ...profileForm,
                                specialties: [...profileForm.specialties, spec],
                              });
                            } else {
                              setProfileForm({
                                ...profileForm,
                                specialties: profileForm.specialties.filter((s) => s !== spec),
                              });
                            }
                          }}
                          className="w-4 h-4 rounded accent-primary flex-shrink-0"
                        />
                        <span className="break-words leading-tight">{spec}</span>
                      </label>
                    );
                  })}
                </div>
                {profileForm.specialties.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {profileForm.specialties.length} especialidad{profileForm.specialties.length !== 1 ? 'es' : ''} seleccionada{profileForm.specialties.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              <div>
                <Label>Tipo de perfil *</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Todos los perfiles tienen acceso completo y pueden atender alertas y emergencias.
                </p>
                <div className="grid grid-cols-1 gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setProfileForm({ ...profileForm, role: 'SOS_ACTIVO' })}
                    className={cn(
                      'p-4 rounded-lg border-2 text-left transition-all',
                      profileForm.role === 'SOS_ACTIVO'
                        ? 'border-mats-green bg-mats-green/10'
                        : 'border-border hover:border-mats-green/50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">🏥</div>
                      <div className="flex-1">
                        <div className={cn('font-medium', profileForm.role === 'SOS_ACTIVO' ? 'text-mats-green' : 'text-foreground')}>
                          SOS Activo
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Paramédico, bombero o rescatista actualmente en servicio
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileForm({ ...profileForm, role: 'EX_SOS' })}
                    className={cn(
                      'p-4 rounded-lg border-2 text-left transition-all',
                      profileForm.role === 'EX_SOS'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">🎖️</div>
                      <div className="flex-1">
                        <div className={cn('font-medium', profileForm.role === 'EX_SOS' ? 'text-primary' : 'text-foreground')}>
                          EX-SOS
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Ex-paramédico, ex-bombero o rescatista retirado con experiencia
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileForm({ ...profileForm, role: 'FAMILIAR' })}
                    className={cn(
                      'p-4 rounded-lg border-2 text-left transition-all',
                      profileForm.role === 'FAMILIAR'
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:border-accent/50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">👨‍👩‍👧</div>
                      <div className="flex-1">
                        <div className={cn('font-medium', profileForm.role === 'FAMILIAR' ? 'text-accent' : 'text-foreground')}>
                          Familiar / Ciudadano
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Miembro de la comunidad sin experiencia formal en rescate
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Medical Assistance Section */}
              <div className="space-y-4 p-4 rounded-lg bg-muted/50 border border-border">
                <div>
                  <Label className="flex items-center gap-2 text-base font-semibold">
                    <span>🩺</span> Capacidad de asistencia médica
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Esta información ayuda a coordinar mejor las emergencias
                  </p>
                </div>
                
                <div className="space-y-3">
                  <label 
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                      profileForm.canProvideMedicalAssistance
                        ? "border-safe bg-safe/10"
                        : "border-border hover:border-safe/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={profileForm.canProvideMedicalAssistance}
                      onChange={(e) => setProfileForm({ ...profileForm, canProvideMedicalAssistance: e.target.checked })}
                      className="w-5 h-5 rounded accent-safe"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">Puedo brindar asistencia médica</div>
                      <div className="text-xs text-muted-foreground">
                        Tengo conocimientos de primeros auxilios o medicina
                      </div>
                    </div>
                  </label>
                  
                  <label 
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                      profileForm.hasFirstAidKit
                        ? "border-safe bg-safe/10"
                        : "border-border hover:border-safe/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={profileForm.hasFirstAidKit}
                      onChange={(e) => setProfileForm({ ...profileForm, hasFirstAidKit: e.target.checked })}
                      className="w-5 h-5 rounded accent-safe"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">Tengo botiquín disponible</div>
                      <div className="text-xs text-muted-foreground">
                        Cuento con equipo de primeros auxilios en mi ubicación
                      </div>
                    </div>
                  </label>

                  <label 
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                      profileForm.hasAmbulance
                        ? "border-destructive bg-destructive/10"
                        : "border-border hover:border-destructive/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={profileForm.hasAmbulance}
                      onChange={(e) => setProfileForm({ ...profileForm, hasAmbulance: e.target.checked })}
                      className="w-5 h-5 rounded accent-destructive"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">Tengo ambulancia disponible</div>
                      <div className="text-xs text-muted-foreground">
                        Cuento con ambulancia o vehículo de emergencia
                      </div>
                    </div>
                  </label>

                  <label 
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                      profileForm.hasRescueUnit
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={profileForm.hasRescueUnit}
                      onChange={(e) => setProfileForm({ ...profileForm, hasRescueUnit: e.target.checked })}
                      className="w-5 h-5 rounded accent-primary"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">Tengo unidad de rescate disponible</div>
                      <div className="text-xs text-muted-foreground">
                        Cuento con vehículo o equipo especializado de rescate
                      </div>
                    </div>
                  </label>

                  <label 
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                      profileForm.hasK9Unit
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-border hover:border-amber-500/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={profileForm.hasK9Unit}
                      onChange={(e) => setProfileForm({ ...profileForm, hasK9Unit: e.target.checked })}
                      className="w-5 h-5 rounded accent-amber-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">Tengo binomio canino (K9) disponible</div>
                      <div className="text-xs text-muted-foreground">
                        Cuento con perro de búsqueda y rescate certificado
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <Button
                onClick={handleProfileSubmit}
                disabled={loading || !profileForm.fullName || !profileForm.phone || !profileForm.birthday}
                className="w-full"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                Completar Registro
              </Button>
            </div>
          )}
        </div>
      </div>

      <AppFooter />

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar contraseña</DialogTitle>
            <DialogDescription>
              Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
            </DialogDescription>
          </DialogHeader>
          
          {forgotPasswordSuccess ? (
            <div className="space-y-4">
              <div className="bg-safe/10 border border-safe/30 rounded-lg p-4 text-sm text-safe">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  <span className="font-medium">¡Email enviado!</span>
                </div>
                <p className="mt-2 text-muted-foreground">
                  Revisa tu bandeja de entrada (y spam) para el enlace de recuperación.
                </p>
              </div>
              <Button 
                onClick={() => setShowForgotPassword(false)} 
                className="w-full"
              >
                Entendido
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  placeholder="tu@email.com"
                  onKeyDown={(e) => e.key === 'Enter' && !forgotPasswordEmailError && handleForgotPassword()}
                  className={forgotPasswordEmailError ? 'border-destructive' : ''}
                />
                {forgotPasswordEmailError && (
                  <p className="text-xs text-destructive mt-1">{forgotPasswordEmailError}</p>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleForgotPassword} 
                  disabled={forgotPasswordLoading || !!forgotPasswordEmailError || !forgotPasswordEmail.trim()}
                  className="flex-1"
                >
                  {forgotPasswordLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  Enviar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuthGate;
