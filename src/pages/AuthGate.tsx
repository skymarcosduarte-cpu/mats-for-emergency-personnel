// Auth Gate Screen for COMUNIDAD EX SOS
// Email/Password Auth + Invite Code + Profile Setup

import React, { useState, useEffect } from 'react';
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, UserPlus, LogIn } from 'lucide-react';
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
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type AuthStep = 'auth' | 'profile';

const SPECIALTIES = [
  'Paramédico',
  'EMT',
  'Médico',
  'Enfermero/a',
  'Bombero',
  'Protección Civil',
  'Cruz Roja',
  'Rescatista',
  'Otro',
];

interface AuthGateProps {
  onAuthComplete?: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthComplete }) => {
  const [step, setStep] = useState<AuthStep>('auth');
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Auth form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    nickname: '',
    specialty: '',
    phone: '',
    role: 'RESCATISTA' as 'RESCATISTA' | 'FAMILIAR',
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

  // Handle login
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Ingresa email y contraseña');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await signIn(email, password);
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

    if (!inviteCode.trim()) {
      setError('Ingresa tu código de invitación');
      return;
    }

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

      // Create account
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

  // Handle profile creation
  const handleProfileSubmit = async () => {
    if (!profileForm.fullName.trim() || !profileForm.nickname.trim() || !profileForm.phone.trim()) {
      setError('Completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: profileError } = await createProfile({
        full_name: profileForm.fullName,
        nickname: profileForm.nickname,
        specialty: profileForm.specialty || null,
        phone: profileForm.phone,
        role: profileForm.role,
      });

      if (profileError) {
        setError(profileError.message);
        return;
      }

      // Update invite used_count
      if (inviteCode) {
        await supabase
          .from('invites')
          .update({ used_count: (await supabase.from('invites').select('used_count').eq('code', inviteCode.toUpperCase()).single()).data?.used_count + 1 || 1 })
          .eq('code', inviteCode.toUpperCase());
      }

      onAuthComplete?.();
    } catch (err) {
      setError('Error al crear perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
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

                <Button onClick={handleLogin} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                  Iniciar Sesión
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 mt-4">
                <div>
                  <Label>Código de invitación *</Label>
                  <Input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="EXS-XXXXXX"
                    className="font-mono"
                    maxLength={10}
                  />
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
                <Label>Apodo (nombre para radio) *</Label>
                <Input
                  value={profileForm.nickname}
                  onChange={(e) => setProfileForm({ ...profileForm, nickname: e.target.value })}
                  placeholder="JP23"
                />
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
                <Label>Especialidad</Label>
                <Select
                  value={profileForm.specialty}
                  onValueChange={(v) => setProfileForm({ ...profileForm, specialty: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona especialidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map((spec) => (
                      <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tipo de usuario *</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    onClick={() => setProfileForm({ ...profileForm, role: 'RESCATISTA' })}
                    className={cn(
                      'p-3 rounded-lg border-2 text-center transition-all',
                      profileForm.role === 'RESCATISTA'
                        ? 'border-mats-green bg-mats-green/10'
                        : 'border-border hover:border-mats-green/50'
                    )}
                  >
                    <div className="text-2xl mb-1">🏥</div>
                    <div className={cn('font-medium text-sm', profileForm.role === 'RESCATISTA' ? 'text-mats-green' : 'text-foreground')}>
                      Rescatista
                    </div>
                    <div className="text-xs text-muted-foreground">Paramédico / Ex-paramédico</div>
                  </button>
                  <button
                    onClick={() => setProfileForm({ ...profileForm, role: 'FAMILIAR' })}
                    className={cn(
                      'p-3 rounded-lg border-2 text-center transition-all',
                      profileForm.role === 'FAMILIAR'
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:border-accent/50'
                    )}
                  >
                    <div className="text-2xl mb-1">👨‍👩‍👧</div>
                    <div className={cn('font-medium text-sm', profileForm.role === 'FAMILIAR' ? 'text-accent' : 'text-foreground')}>
                      Familiar
                    </div>
                    <div className="text-xs text-muted-foreground">Funciones básicas</div>
                  </button>
                </div>
              </div>

              <Button
                onClick={handleProfileSubmit}
                disabled={loading || !profileForm.fullName || !profileForm.nickname || !profileForm.phone}
                className="w-full"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                Completar Registro
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 text-center text-xs text-muted-foreground">
        COMUNIDAD EX SOS • M.A.T.S.
      </div>
    </div>
  );
};

export default AuthGate;
