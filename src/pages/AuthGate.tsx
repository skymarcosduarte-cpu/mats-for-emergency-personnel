// M.A.T.S. authentication and profile setup

import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, Eye, EyeOff, UserPlus, LogIn, Mail } from 'lucide-react';
// BirthdayPicker removed - birthday is now captured in Settings
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
  onAuthComplete?: () => void | Promise<void>;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthComplete }) => {
  const [step, setStep] = useState<AuthStep>('auth');
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailExistsError, setEmailExistsError] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [showRecoverySuggestion, setShowRecoverySuggestion] = useState(false);
  
  // Magic Link state
  const [loginMethod, setLoginMethod] = useState<'magic-link' | 'password'>('password');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  
  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const { signUp, signIn, createProfile, user, isProfileComplete, needsProfileCompletion, refetchProfile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (needsProfileCompletion) {
      console.log('[AuthGate] User needs profile completion - redirecting to profile form');
      setStep('profile');
      // Show a friendly message explaining what happened
      if (!error) {
        toast({
          title: '¡Hola! Tu cuenta existe',
          description: 'Por favor completa tu perfil para continuar.',
        });
      }
    } else if (user && isProfileComplete) {
      onAuthComplete?.();
    }
  }, [user, isProfileComplete, needsProfileCompletion, onAuthComplete, error]);

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

  const normalizeUsername = (value: string) =>
    value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');

  const usernameToEmail = (value: string) => `${normalizeUsername(value)}@mats.app`;

  const normalizePassword = (value: string) => {
    const trimmed = value.trim();
    return {
      trimmed,
      hadOuterWhitespace: value !== trimmed,
    };
  };

  // Detect if user is pasting a recovery token instead of their password
  // Recovery tokens typically look like: xxxxx-xxxxxx-xxxxxx (groups of 5-6 chars with dashes)
  const looksLikeRecoveryToken = (value: string): boolean => {
    const trimmed = value.trim().toLowerCase();
    // Match patterns like: saqdop-xekvl0-cotcyq (typical supabase recovery token format)
    const recoveryTokenPattern = /^[a-z0-9]{5,6}-[a-z0-9]{5,6}-[a-z0-9]{5,6}$/;
    return recoveryTokenPattern.test(trimmed);
  };
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
          redirectTo: `${window.location.origin}/reset-password`,
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

  // Handle Magic Link login
  const handleMagicLink = async () => {
    setError(null);

    if (!email.trim()) {
      setError('Ingresa tu nombre de usuario');
      return;
    }

    const loginIdentifier = email.includes('@')
      ? email.trim().toLowerCase()
      : usernameToEmail(email);

    if (!email.includes('@') && normalizeUsername(email).length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres');
      return;
    }

    setMagicLinkLoading(true);

    try {
      const { error: magicLinkError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (magicLinkError) {
        if (magicLinkError.message.includes('rate limit')) {
          setError('Demasiados intentos. Espera unos minutos.');
        } else if (magicLinkError.message.includes('not found') || magicLinkError.message.includes('not registered')) {
          setError('Este email no está registrado. ¿Quieres registrarte?');
        } else {
          setError('Error al enviar el enlace. Intenta de nuevo.');
        }
      } else {
        setMagicLinkSent(true);
        toast({
          title: '¡Enlace enviado!',
          description: 'Revisa tu correo y haz clic en el enlace para iniciar sesión.',
        });
      }
    } catch (err) {
      console.error('[AuthGate] Magic link error:', err);
      setError('Error de conexión. Verifica tu internet.');
    } finally {
      setMagicLinkLoading(false);
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

    const { trimmed: sanitizedPassword, hadOuterWhitespace } = normalizePassword(password);

    if (!sanitizedPassword) {
      setError('Ingresa tu contraseña');
      return;
    }

    if (hadOuterWhitespace) {
      toast({
        title: 'Ajustamos tu contraseña',
        description:
          'Detectamos espacios al inicio o al final (a veces pasa con autocompletar). Los quitamos automáticamente.',
      });
      setPassword(sanitizedPassword);
    }

    setLoading(true);

    try {
      const { error: signInError } = await signIn(
        loginIdentifier,
        sanitizedPassword,
        rememberMe
      );
      if (signInError) {
        let errorMessage = 'Error al iniciar sesión. Intenta de nuevo.';
        let errorTitle = 'Error de inicio de sesión';

        const isCredentialError = signInError.message.includes('Invalid login credentials');

        if (isCredentialError) {
          // Check if user might be pasting a recovery token as password
          if (looksLikeRecoveryToken(sanitizedPassword)) {
            errorMessage = 'Parece que pegaste un código del correo de recuperación. Ese código NO es tu contraseña. Haz clic en el ENLACE del correo para restablecer tu contraseña.';
            errorTitle = '¿Usaste el enlace del correo?';
            setShowRecoverySuggestion(true);
          } else {
            errorMessage = 'Usuario o contraseña incorrectos. Verifica tus datos.';
            errorTitle = 'Credenciales inválidas';

            // Track failed attempts for credential errors
            const newAttempts = loginAttempts + 1;
            setLoginAttempts(newAttempts);

            // Show recovery suggestion after 2 failed attempts
            if (newAttempts >= 2) {
              setShowRecoverySuggestion(true);
            }
          }
        } else if (signInError.message.includes('Email not confirmed')) {
          errorMessage = 'Tu email no ha sido confirmado. Revisa tu bandeja de entrada.';
          errorTitle = 'Email no confirmado';
        } else if (signInError.message.includes('rate limit')) {
          errorMessage = 'Demasiados intentos. Espera unos minutos antes de intentar de nuevo.';
          errorTitle = 'Límite de intentos';
          setShowRecoverySuggestion(true);
        }

        setError(errorMessage);
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: 'destructive',
        });
      } else {
        // Reset attempts on successful login
        setLoginAttempts(0);
        setShowRecoverySuggestion(false);
      }
    } catch (err) {
      console.error('[AuthGate] Login error:', err);
      const errorMessage = 'Error de conexión. Verifica tu internet e intenta de nuevo.';
      setError(errorMessage);
      toast({
        title: 'Error de conexión',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Open registration using a synthetic email derived from the username.
  const handleSignup = async () => {
    setError(null);
    setEmailExistsError(false);

    const normalizedUsername = normalizeUsername(email);
    if (!normalizedUsername) {
      setError('Ingresa un nombre de usuario');
      return;
    }

    if (normalizedUsername.length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres');
      return;
    }

    if (normalizedUsername !== email.trim().toLowerCase()) {
      setError('Usa solo letras, números, punto, guion o guion bajo');
      return;
    }

    const { trimmed: sanitizedPassword, hadOuterWhitespace } = normalizePassword(password);

    if (!sanitizedPassword) {
      setError('Ingresa una contraseña');
      return;
    }

    if (sanitizedPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (hadOuterWhitespace) {
      toast({
        title: 'Ajustamos tu contraseña',
        description:
          'Detectamos espacios al inicio o al final (a veces pasa con autocompletar). Los quitamos automáticamente.',
      });
      setPassword(sanitizedPassword);
    }

    setLoading(true);
    try {
      const syntheticEmail = usernameToEmail(normalizedUsername);
      const { error: signUpError } = await signUp(syntheticEmail, sanitizedPassword);

      if (signUpError) {
        const alreadyExists = signUpError.message.includes('already registered') ||
          signUpError.message.includes('already been registered') ||
          signUpError.message.includes('User already registered');
        if (alreadyExists) {
          setEmailExistsError(true);
          setError('Este nombre de usuario ya está registrado.');
        } else {
          setError(signUpError.message || 'No se pudo crear la cuenta. Intenta de nuevo.');
        }
        return;
      }

      setProfileForm(current => ({
        ...current,
        fullName: current.fullName || normalizedUsername,
        nickname: normalizedUsername,
      }));
      toast({ title: '¡Cuenta creada!', description: 'Completa tus datos para continuar.' });
    } catch (err) {
      console.error('[AuthGate] Signup error:', err);
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
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
    if (!profileForm.fullName.trim() || !profileForm.role) {
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

    // Retry logic for profile creation
    const maxRetries = 2;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[AuthGate] Profile creation retry ${attempt}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        // Check if profile already exists (edge case: user refreshed mid-registration)
        const { data: existingProfile, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user?.id)
          .maybeSingle();

        if (checkError) {
          console.error('[AuthGate] Error checking existing profile:', checkError);
          // On network error, retry
          if (checkError.message?.includes('fetch') || checkError.message?.includes('network')) {
            if (attempt < maxRetries) continue;
          }
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
            // On network error, retry
            if (updateError.message?.includes('fetch') || updateError.message?.includes('network')) {
              if (attempt < maxRetries) continue;
            }
          }

          // Force refetch profile to update auth state
          await refetchProfile();
          
          // Close dialog and complete
          setShowPrivacyConsent(false);
          setLoading(false);
          await onAuthComplete?.();
          return;
        }

        console.log('[AuthGate] Creating new profile...');
        const nickname = profileForm.nickname.trim() || profileForm.fullName.split(' ')[0];
        
        const { error: profileError } = await createProfile({
          full_name: profileForm.fullName,
          nickname,
          specialty: profileForm.specialties.length > 0 ? profileForm.specialties : null,
          phone: profileForm.phone,
          birthday: profileForm.birthday || null,
          role: profileForm.role,
          can_provide_medical_assistance: profileForm.canProvideMedicalAssistance,
          has_first_aid_kit: profileForm.hasFirstAidKit,
          has_ambulance: profileForm.hasAmbulance,
          has_rescue_unit: profileForm.hasRescueUnit,
          has_k9_unit: profileForm.hasK9Unit,
        });

        if (profileError) {
          console.error('[AuthGate] Profile creation error:', profileError);
          // On network error, retry
          if (profileError.message?.includes('fetch') || profileError.message?.includes('network')) {
            if (attempt < maxRetries) continue;
          }
          setShowPrivacyConsent(false);
          setError(translateError(profileError.message));
          setLoading(false);
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
        setLoading(false);
        await onAuthComplete?.();
        return;
        
      } catch (err) {
        console.error('[AuthGate] Unexpected error during profile creation:', err);
        if (attempt < maxRetries) continue;
        
        setShowPrivacyConsent(false);
        setError('Error al crear perfil. Verifica tu conexión e intenta de nuevo.');
        setLoading(false);
        return;
      }
    }
    
    // All retries failed
    setShowPrivacyConsent(false);
    setError('No se pudo crear el perfil. Verifica tu conexión e intenta de nuevo.');
    setLoading(false);
  };

  // iOS-specific touch event handling for buttons
  const handleButtonTouchEnd = (e: React.TouchEvent, callback: () => void) => {
    e.preventDefault();
    callback();
  };

  return (
    <div 
      className="min-h-screen bg-background text-foreground flex flex-col overflow-y-auto" 
      style={{ minHeight: '100dvh', WebkitOverflowScrolling: 'touch' }}
    >
      {/* Privacy Consent Dialog */}
      <PrivacyConsentDialog
        open={showPrivacyConsent}
        onAccept={handlePrivacyAccept}
        onDecline={() => setShowPrivacyConsent(false)}
      />
      
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <MatsLogo size={80} showText className="mb-8" />

        <div className="w-full max-w-sm space-y-6">
          {step === 'auth' && (
            <header className="text-center space-y-1">
              <h1 className="text-2xl font-bold text-foreground">
                M.A.T.S. for Emergency Personnel — Acceso al Sistema
              </h1>
              <p className="text-sm text-muted-foreground">
                Inicia sesión o regístrate para coordinar respuesta a emergencias.
              </p>
            </header>
          )}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive space-y-2">
              <p>{error}</p>
            </div>
          )}

          {step === 'auth' && (
            <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as 'login' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="signup">Registrarse</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4 mt-4">
                {/* Magic Link Success State */}
                {magicLinkSent ? (
                  <div className="space-y-4 text-center py-4">
                    <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                      <Mail className="w-8 h-8 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-lg">¡Revisa tu correo!</h3>
                      <p className="text-sm text-muted-foreground">
                        Enviamos un enlace a <strong>{email}</strong>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Haz clic en el enlace del correo para iniciar sesión automáticamente.
                      </p>
                    </div>
                    <div className="pt-2 space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMagicLinkSent(false);
                          handleMagicLink();
                        }}
                        disabled={magicLinkLoading}
                      >
                        {magicLinkLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Reenviar enlace
                      </Button>
                      <button
                        type="button"
                        onClick={() => {
                          setMagicLinkSent(false);
                          setEmail('');
                        }}
                        className="block w-full text-xs text-muted-foreground hover:text-primary"
                      >
                        Usar otro email
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label>Nombre de usuario</Label>
                      <Input
                        type="text"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setError(null);
                        }}
                        placeholder="Tu usuario"
                        autoComplete="username"
                      />
                    </div>

                    {/* Magic links remain unavailable for username-only accounts. */}
                    {false && loginMethod === 'magic-link' && (
                      <>
                        <Button 
                          onClick={handleMagicLink} 
                          disabled={magicLinkLoading || !email.trim()} 
                          className="w-full"
                        >
                          {magicLinkLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Enviando enlace...
                            </>
                          ) : (
                            <>
                              <Mail className="w-4 h-4 mr-2" />
                              Enviar enlace al correo
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                          Te enviaremos un enlace seguro. Solo haz clic para entrar.
                        </p>
                        <button
                          type="button"
                          onClick={() => setLoginMethod('password')}
                          className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          Prefiero usar contraseña
                        </button>
                      </>
                    )}

                    {/* Password Method */}
                    {loginMethod === 'password' && (
                      <>
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
                              onKeyDown={(e) => {
                                setCapsLockOn(e.getModifierState('CapsLock'));
                                if (e.key === 'Enter' && !loading) handleLogin();
                              }}
                              onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
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
                          {capsLockOn && !showPassword && (
                            <p className="text-xs text-warning mt-1 flex items-center gap-1">
                              ⬆️ Bloq Mayús activado
                            </p>
                          )}
                        </div>

                        <div className="space-y-1">
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
                          <p className="text-xs text-muted-foreground/80 pl-6">
                            💡 Marca esta opción para no tener que ingresar tu contraseña cada vez que visites la app
                          </p>
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

                        {showRecoverySuggestion && (
                          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg space-y-2">
                            <p className="text-sm text-warning-foreground">
                              <span className="font-medium">¿Problemas para ingresar?</span>
                              {' '}Usa el enlace por correo, es más fácil.
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full border-warning text-warning hover:bg-warning/20"
                              onClick={() => setLoginMethod('magic-link')}
                            >
                              <Mail className="w-4 h-4 mr-2" />
                              Usar enlace por correo
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 mt-4">
                <div>
                  <Label>Nombre de usuario *</Label>
                  <Input
                    type="text"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                      setEmailExistsError(false);
                    }}
                    placeholder="Tu usuario"
                    autoComplete="username"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Usa letras, números, punto, guion o guion bajo.</p>
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
                      onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                      placeholder="Mínimo 8 caracteres"
                      className={password && password.length < 8 ? 'border-warning' : ''}
                      autoComplete="new-password"
                      onKeyDown={(e) => {
                        setCapsLockOn(e.getModifierState('CapsLock'));
                        if (e.key === 'Enter' && !loading) handleSignup();
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {capsLockOn && !showPassword && (
                    <p className="text-xs text-warning mt-1 flex items-center gap-1">
                      ⬆️ Bloq Mayús activado
                    </p>
                  )}
                  {password && password.length < 8 && (
                    <p className="text-xs text-warning mt-1">
                      {8 - password.length} caracteres más requeridos
                    </p>
                  )}
                  {password && password.length >= 8 && (
                    <p className="text-xs text-safe mt-1">✓ Contraseña válida</p>
                  )}
                </div>

                {/* Email exists error with action buttons */}
                {emailExistsError && (
                  <div className="p-4 rounded-lg bg-warning/10 border border-warning space-y-3">
                    <p className="text-sm text-warning font-medium">
                      ⚠️ Este nombre de usuario ya está registrado
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button 
                        variant="default"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setAuthTab('login');
                          setEmailExistsError(false);
                          setError(null);
                        }}
                      >
                        <LogIn className="w-4 h-4 mr-2" />
                        Ir a Iniciar Sesión
                      </Button>
                      <Button 
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setForgotPasswordEmail(email);
                          setForgotPasswordSuccess(false);
                          setEmailExistsError(false);
                          setError(null);
                        }}
                      >
                        ¿Olvidaste tu contraseña?
                      </Button>
                    </div>
                  </div>
                )}

                <Button onClick={handleSignup} disabled={loading || emailExistsError} className="w-full">
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
              {/* Special message for users with account but no profile */}
              {needsProfileCompletion && (
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center space-y-2">
                  <div className="text-2xl">👋</div>
                  <h2 className="font-semibold text-primary">¡Bienvenido/a de nuevo!</h2>
                  <p className="text-sm text-muted-foreground">
                    Tu cuenta está activa pero falta completar tu perfil para acceder a la app.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Email: <span className="font-medium">{user?.email}</span>
                  </p>
                </div>
              )}
              
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground">Tu Perfil</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {needsProfileCompletion 
                    ? 'Completa los siguientes datos para continuar' 
                    : 'Completa tu información'}
                </p>
              </div>

              <div>
                <Label>Nombre completo *</Label>
                <Input
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  placeholder="Juan Pérez García"
                />
              </div>

              <p className="text-sm text-muted-foreground bg-muted/50 border border-border rounded-lg p-3">
                Con tu nombre es suficiente para empezar. Más adelante, en Ajustes,
                puedes agregar tu teléfono, tu apodo, tus especialidades y los recursos
                con los que cuentas.
              </p>


              <Button
                onClick={handleProfileSubmit}
                onTouchEnd={(e) => {
                  if (!loading && profileForm.fullName.trim() && profileForm.role) {
                    handleButtonTouchEnd(e, handleProfileSubmit);
                  }
                }}
                disabled={loading || !profileForm.fullName.trim() || !profileForm.role}
                className="w-full touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                Completar Registro
              </Button>

              {/* Emergency update / cache reset */}
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  try {
                    // Unregister service workers
                    if ('serviceWorker' in navigator) {
                      const regs = await navigator.serviceWorker.getRegistrations();
                      await Promise.all(regs.map((reg) => reg.unregister()));
                    }

                    // Clear caches
                    if ('caches' in window) {
                      const names = await caches.keys();
                      await Promise.all(names.map((name) => caches.delete(name)));
                    }
                  } finally {
                    // Force reload with cache-busting param
                    window.location.href = window.location.href.split('?')[0] + '?t=' + Date.now();
                  }
                }}
                className="w-full"
              >
                Forzar actualización (limpiar caché)
              </Button>

              {/* Emergency exit button */}
              <Button
                variant="ghost"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.reload();
                }}
                className="w-full text-muted-foreground"
              >
                Cerrar sesión y salir
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
              Ingresa tu email y te enviaremos un enlace. Al abrirlo, podrás definir una nueva contraseña en Configuración.
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
                  Revisa tu bandeja de entrada (y spam). Al abrir el enlace, te llevaremos a Configuración para crear tu nueva contraseña.
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
