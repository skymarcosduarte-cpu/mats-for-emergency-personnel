// Auth Gate Screen for COMUNIDAD EX SOS
// Email/Password Auth + Invite Code + Profile Setup

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
  const [inviteCodeError, setInviteCodeError] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [showRecoverySuggestion, setShowRecoverySuggestion] = useState(false);
  
  // Magic Link state
  const [loginMethod, setLoginMethod] = useState<'magic-link' | 'password'>('magic-link');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  
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

  // Handle Magic Link login
  const handleMagicLink = async () => {
    setError(null);

    if (!email.trim()) {
      setError('Ingresa tu email');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Formato de email inválido');
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
        email.trim().toLowerCase(),
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
            errorMessage = 'Email o contraseña incorrectos. Verifica tus datos.';
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

  // Handle signup - 100% server-side registration with improved error handling
  const handleSignup = async () => {
    // Clear previous errors
    setError(null);
    setEmailExistsError(false);
    setInviteCodeError(false);

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

    const { trimmed: sanitizedPassword, hadOuterWhitespace } = normalizePassword(password);

    if (!sanitizedPassword) {
      setError('Ingresa una contraseña');
      return;
    }

    if (sanitizedPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
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
    const signupStartTime = Date.now();
    const signupId = crypto.randomUUID().slice(0, 8);
    
    console.log(`[AuthGate][${signupId}] ========== STARTING SIGNUP ==========`);
    console.log(`[AuthGate][${signupId}] Email: ${email.trim().substring(0, 3)}***@${email.split('@')[1] || 'unknown'}`);
    console.log(`[AuthGate][${signupId}] Invite code: ${trimmedCode}`);
    console.log(`[AuthGate][${signupId}] Password length: ${sanitizedPassword.length}`);
    console.log(`[AuthGate][${signupId}] User agent: ${navigator.userAgent.substring(0, 100)}`);

    // Retry logic for transient network errors
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[AuthGate][${signupId}] Retry attempt ${attempt}/${maxRetries}`);
          toast({
            title: 'Reintentando...',
            description: `Intento ${attempt + 1} de ${maxRetries + 1}`,
          });
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log(`[AuthGate][${signupId}] Request timeout after 30s`);
          controller.abort();
        }, 30000); // 30 second timeout

        // Call server-side registration endpoint
        console.log(`[AuthGate][${signupId}] Calling register-with-invite function...`);
        const requestStartTime = Date.now();
        
        const response = await supabase.functions.invoke('register-with-invite', {
          body: {
            email: email.trim().toLowerCase(),
            password: sanitizedPassword,
            inviteCode: trimmedCode,
          }
        });

        const requestDuration = Date.now() - requestStartTime;
        clearTimeout(timeoutId);
        
        console.log(`[AuthGate][${signupId}] Function response received in ${requestDuration}ms`);
        console.log(`[AuthGate][${signupId}] Response has error: ${!!response.error}`);
        console.log(`[AuthGate][${signupId}] Response has data: ${!!response.data}`);
        if (response.data) {
          console.log(`[AuthGate][${signupId}] Response data:`, JSON.stringify(response.data).substring(0, 200));
        }
        if (response.error) {
          console.log(`[AuthGate][${signupId}] Response error:`, JSON.stringify(response.error).substring(0, 500));
        }

        // Check for errors - supabase.functions.invoke wraps non-2xx responses in response.error
        // But the actual JSON body might be in response.error.context or we need to parse it
        if (response.error) {
          console.error('[AuthGate] Function error:', response.error);
          lastError = response.error;
          
          // The error message from supabase functions.invoke for 4xx responses
          // is typically the raw error or context contains the parsed body
          let serverMessage = '';
          
          // Try to extract the actual error message from the response
          // Supabase functions.invoke puts the parsed JSON in error.context for 4xx responses
          if (response.error.context?.error) {
            serverMessage = response.error.context.error;
          } else if (typeof response.error.context === 'string') {
            try {
              const parsed = JSON.parse(response.error.context);
              serverMessage = parsed.error || '';
            } catch {
              serverMessage = response.error.context;
            }
          } else if (response.error.message) {
            serverMessage = response.error.message;
          }
          
          console.log('[AuthGate] Extracted server message:', serverMessage);
          
          // Handle specific server errors that should not be retried
          if (serverMessage.includes('email ya está registrado') || 
              serverMessage.includes('ya registrado') ||
              serverMessage.includes('already registered')) {
            setEmailExistsError(true);
            setError('Este email ya está registrado.');
            setLoading(false);
            return;
          }
          
          // Handle invite code errors - check for various phrases
          if (serverMessage.includes('código') || 
              serverMessage.includes('invitación') || 
              serverMessage.includes('invite') ||
              serverMessage.includes('Código') ||
              serverMessage.includes('no encontrado') ||
              serverMessage.includes('expirado') ||
              serverMessage.includes('límite')) {
            setInviteCodeError(true);
            setError(serverMessage);
            toast({
              title: 'Error con código de invitación',
              description: serverMessage,
              variant: 'destructive',
            });
            setLoading(false);
            return;
          }
          
          // If we got a meaningful server message, show it
          if (serverMessage && !serverMessage.includes('FunctionsHttpError') && serverMessage.length < 200) {
            setError(serverMessage);
            toast({
              title: 'Error de registro',
              description: serverMessage,
              variant: 'destructive',
            });
            setLoading(false);
            return;
          }
          
          // Only retry on network/timeout errors
          const rawErrorMsg = response.error.message || '';
          if (rawErrorMsg.includes('network') || 
              rawErrorMsg.includes('timeout') ||
              rawErrorMsg.includes('fetch') ||
              rawErrorMsg.includes('Failed to fetch') ||
              rawErrorMsg.includes('aborted')) {
            if (attempt < maxRetries) {
              console.log('[AuthGate] Network error, will retry...');
              continue;
            }
          }
          
          // Non-retryable error - show generic connection error
          const connectionError = 'Error de conexión. Verifica tu internet e intenta de nuevo.';
          setError(connectionError);
          toast({
            title: 'Error de conexión',
            description: connectionError,
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        const result = response.data;
        console.log('[AuthGate] Function result:', result);

        // Server returned an error in the body (for 400 responses that still return JSON)
        if (!result || !result.success) {
          const errorMsg = result?.error || 'Error desconocido al crear cuenta';
          console.log('[AuthGate] Server error:', errorMsg);
          
          // Check for email exists error in response body
          if (errorMsg.includes('email ya está registrado') || 
              errorMsg.includes('ya registrado') ||
              errorMsg.includes('already registered')) {
            setEmailExistsError(true);
            setError('Este email ya está registrado.');
            setLoading(false);
            return;
          }
          
          // Show the specific error message from the server
          setError(errorMsg);
          toast({
            title: 'Error de registro',
            description: errorMsg,
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        // Success! Now sign in the user
        console.log('[AuthGate] User created successfully, signing in...');
        toast({
          title: '¡Cuenta creada!',
          description: 'Iniciando sesión...',
        });
        
        const { error: signInError } = await signIn(
          email.trim().toLowerCase(), 
          sanitizedPassword, 
          rememberMe
        );
        
        if (signInError) {
          // User was created but sign-in failed - they can try logging in manually
          console.log('[AuthGate] Sign-in after registration failed:', signInError);
          toast({
            title: '¡Cuenta creada!',
            description: 'Tu cuenta fue creada. Ahora inicia sesión con tus credenciales.',
          });
          setAuthTab('login');
          // Clear password for security when switching to login tab
          setPassword('');
        } else {
          // Sign-in succeeded, show success toast
          console.log('[AuthGate] Sign-in successful!');
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
        
        // Check if it's an abort error (timeout)
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('[AuthGate] Request was aborted (timeout)');
          if (attempt < maxRetries) continue;
        }
        
        // Only retry on unexpected errors that might be transient
        if (attempt < maxRetries) continue;
      }
    }

    // All retries failed
    console.error('[AuthGate] All signup attempts failed:', lastError);
    const finalError = 'No pudimos conectar con el servidor. Por favor verifica tu conexión a internet y vuelve a intentar.';
    setError(finalError);
    toast({
      title: 'Error de conexión',
      description: 'Verifica tu internet e intenta de nuevo.',
      variant: 'destructive',
    });
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
    if (!profileForm.fullName.trim() || !profileForm.phone.trim() || !profileForm.role) {
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
      style={{ minHeight: '100vh', WebkitOverflowScrolling: 'touch' }}
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
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive space-y-2">
              <p>{error}</p>
              {inviteCodeError && (
                <p className="text-xs">
                  ¿Necesitas ayuda?{' '}
                  <a 
                    href={`mailto:contacto@latamgrowthoperators.com?subject=Ayuda con código de invitación MATS&body=Hola, necesito ayuda con mi código de invitación.%0A%0AMi email: ${encodeURIComponent(email)}%0ACódigo que usé: ${encodeURIComponent(inviteCode)}`}
                    className="underline font-medium hover:text-destructive/80"
                  >
                    Escríbenos a contacto@latamgrowthoperators.com
                  </a>
                </p>
              )}
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

                    {/* Magic Link Method (Default) */}
                    {loginMethod === 'magic-link' && (
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
                              onKeyDown={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
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

                        <button
                          type="button"
                          onClick={() => setLoginMethod('magic-link')}
                          className="w-full text-center text-sm text-primary hover:underline transition-colors"
                        >
                          ← Volver a enlace por correo
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
                      setEmailExistsError(false);
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
                      onKeyDown={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                      onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
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
                  {capsLockOn && !showPassword && (
                    <p className="text-xs text-warning mt-1 flex items-center gap-1">
                      ⬆️ Bloq Mayús activado
                    </p>
                  )}
                  {password && password.length < 6 && (
                    <p className="text-xs text-warning mt-1">
                      {6 - password.length} caracteres más requeridos
                    </p>
                  )}
                  {password && password.length >= 6 && (
                    <p className="text-xs text-safe mt-1">✓ Contraseña válida</p>
                  )}
                </div>

                {/* Email exists error with action buttons */}
                {emailExistsError && (
                  <div className="p-4 rounded-lg bg-warning/10 border border-warning space-y-3">
                    <p className="text-sm text-warning font-medium">
                      ⚠️ Este email ya está registrado
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

              {/* Birthday is now captured in Settings after registration */}

              <div>
                <Label>Especialidades (selecciona todas las que apliquen)</Label>
                <div 
                  className="grid grid-cols-2 gap-2 mt-2 max-h-64 overflow-y-auto p-1"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {SPECIALTIES.map((spec) => {
                    const isSelected = profileForm.specialties.includes(spec);
                    const toggleSpec = () => {
                      if (isSelected) {
                        setProfileForm({
                          ...profileForm,
                          specialties: profileForm.specialties.filter((s) => s !== spec),
                        });
                      } else {
                        setProfileForm({
                          ...profileForm,
                          specialties: [...profileForm.specialties, spec],
                        });
                      }
                    };
                    return (
                      <button
                        key={spec}
                        type="button"
                        onClick={toggleSpec}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          toggleSpec();
                        }}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg border transition-all text-sm min-w-0 overflow-hidden text-left touch-manipulation",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50"
                        )}
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center",
                          isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                        )}>
                          {isSelected && <span className="text-xs text-primary-foreground">✓</span>}
                        </div>
                        <span className="break-words leading-tight">{spec}</span>
                      </button>
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
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      setProfileForm({ ...profileForm, role: 'SOS_ACTIVO' });
                    }}
                    className={cn(
                      'p-4 rounded-lg border-2 text-left transition-all touch-manipulation',
                      profileForm.role === 'SOS_ACTIVO'
                        ? 'border-mats-green bg-mats-green/10'
                        : 'border-border hover:border-mats-green/50'
                    )}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
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
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      setProfileForm({ ...profileForm, role: 'EX_SOS' });
                    }}
                    className={cn(
                      'p-4 rounded-lg border-2 text-left transition-all touch-manipulation',
                      profileForm.role === 'EX_SOS'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    )}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
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
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      setProfileForm({ ...profileForm, role: 'FAMILIAR' });
                    }}
                    className={cn(
                      'p-4 rounded-lg border-2 text-left transition-all touch-manipulation',
                      profileForm.role === 'FAMILIAR'
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:border-accent/50'
                    )}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
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
                onTouchEnd={(e) => {
                  if (!loading && profileForm.fullName && profileForm.phone && profileForm.role) {
                    handleButtonTouchEnd(e, handleProfileSubmit);
                  }
                }}
                disabled={loading || !profileForm.fullName || !profileForm.phone || !profileForm.role}
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
