// Auth Gate Screen for COMUNIDAD EX SOS
// Email/Password Auth + Invite Code + Profile Setup

import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, Eye, EyeOff, UserPlus, LogIn, Mail } from 'lucide-react';
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
  });
  
  // Privacy consent state
  const [showPrivacyConsent, setShowPrivacyConsent] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    shareLocation: true,
    shareMedicalInfo: true,
  });

  const { signUp, signIn, createProfile, user, isProfileComplete } = useAuth();

  // Check if user needs to complete profile
  useEffect(() => {
    if (user && !isProfileComplete) {
      setStep('profile');
    } else if (user && isProfileComplete) {
      onAuthComplete?.();
    }
  }, [user, isProfileComplete, onAuthComplete]);

  // Email validation helper
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const forgotPasswordEmailError = forgotPasswordEmail.trim() && !isValidEmail(forgotPasswordEmail)
    ? 'Ingresa un email válido (ej: usuario@dominio.com)'
    : null;

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

  // Handle login
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Ingresa email y contraseña');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await signIn(email, password, rememberMe);
      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Email o contraseña incorrectos');
        } else {
          setError(signInError.message);
        }
      }
    } catch (err) {
      setError('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  // Handle signup
  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Ingresa email y contraseña');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    // Skip invite code validation during open beta
    // Invite code is optional - if provided, validate it
    if (inviteCode.trim()) {
      // Accept EXS-XXXXXX format or any alphanumeric code for flexibility
      if (!inviteCode.match(/^(EXS-[A-Z0-9]{6}|[A-Z0-9-]{4,20})$/i)) {
        setError('Código de invitación inválido');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Check if invite exists and is valid
        const { data: invite, error: inviteError } = await supabase
          .from('invites')
          .select('*')
          .eq('code', inviteCode.toUpperCase())
          .maybeSingle();

        if (inviteError || !invite) {
          setError('Código de invitación no encontrado');
          setLoading(false);
          return;
        }

        if (invite.used_count >= invite.max_uses) {
          setError('Este código ya fue usado');
          setLoading(false);
          return;
        }

        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
          setError('Este código ha expirado');
          setLoading(false);
          return;
        }
      } catch (err) {
        setError('Error al validar código');
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const { error: signUpError } = await signUp(email, password);
      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('Este email ya está registrado. Intenta iniciar sesión.');
        } else {
          setError(signUpError.message);
        }
      }
    } catch (err) {
      setError('Error al crear cuenta');
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
    if (!profileForm.fullName.trim() || !profileForm.phone.trim() || !profileForm.birthday) {
      setError('Completa todos los campos obligatorios');
      return;
    }
    
    // Show privacy consent dialog
    setShowPrivacyConsent(true);
  };

  // Handle privacy consent and complete profile creation
  const handlePrivacyAccept = async (shareLocation: boolean, shareMedicalInfo: boolean) => {
    setShowPrivacyConsent(false);
    setPrivacySettings({ shareLocation, shareMedicalInfo });
    
    setLoading(true);
    setError(null);

    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user?.id)
        .maybeSingle();

      if (existingProfile) {
        onAuthComplete?.();
        return;
      }

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
      });

      if (profileError) {
        setError(translateError(profileError.message));
        return;
      }

      // Update privacy settings
      await supabase
        .from('profiles')
        .update({
          share_location: shareLocation,
          share_medical_info: shareMedicalInfo,
          privacy_consent_at: new Date().toISOString(),
          terms_accepted_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (inviteCode) {
        await supabase.rpc('use_invite_code', {
          invite_code: inviteCode.toUpperCase()
        });
      }

      onAuthComplete?.();
    } catch (err) {
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
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                  />
                </div>

                <div>
                  <Label>Contraseña</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
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
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                  Iniciar Sesión
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
                  <Label>Código de invitación (opcional)</Label>
                  <Input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="EXS-XXXXXX"
                    className="font-mono"
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Durante la beta abierta, el código es opcional
                  </p>
                </div>

                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                  />
                </div>

                <div>
                  <Label>Contraseña *</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
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

                <Button onClick={handleSignup} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  Crear Cuenta
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
                          "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm",
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
                          className="w-4 h-4 rounded accent-primary"
                        />
                        <span>{spec}</span>
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
