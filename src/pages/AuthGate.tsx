// Auth Gate Screen for COMUNIDAD EX SOS
// Phone OTP + Invite Code

import React, { useState } from 'react';
import { Phone, Key, ArrowRight, Loader2, QrCode, Camera } from 'lucide-react';
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
import { MatsLogo } from '@/components/MatsLogo';
import { useAuth } from '@/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';

type AuthStep = 'invite' | 'phone' | 'otp' | 'profile';

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
  const [step, setStep] = useState<AuthStep>('invite');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [inviteCode, setInviteCode] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    nickname: '',
    specialty: '',
    role: 'RESCATISTA' as UserRole,
  });

  const { signInWithOTP, verifyOTP, createProfile } = useAuth();

  // Validate invite code
  const handleInviteSubmit = async () => {
    if (!inviteCode.trim()) {
      setError('Ingresa un código de invitación');
      return;
    }

    // Validate format
    if (!inviteCode.match(/^EXS-[A-Z0-9]{6}$/i)) {
      setError('Código de invitación inválido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // In production, validate against backend
      console.log('Validating invite:', inviteCode);
      
      // For demo, accept any valid-format code
      setStep('phone');
    } catch (err) {
      setError('Código de invitación no válido o expirado');
    } finally {
      setLoading(false);
    }
  };

  // Send OTP
  const handlePhoneSubmit = async () => {
    if (!phone.trim() || phone.length < 10) {
      setError('Ingresa un número de teléfono válido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isSupabaseConfigured()) {
        const { error: otpError } = await signInWithOTP(`+52${phone}`);
        if (otpError) throw otpError;
      }
      setStep('otp');
    } catch (err) {
      setError('Error al enviar código. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleOtpSubmit = async () => {
    if (!otp.trim() || otp.length !== 6) {
      setError('Ingresa el código de 6 dígitos');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isSupabaseConfigured()) {
        const { error: verifyError } = await verifyOTP(`+52${phone}`, otp);
        if (verifyError) throw verifyError;
      }
      setStep('profile');
    } catch (err) {
      setError('Código incorrecto. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Create profile
  const handleProfileSubmit = async () => {
    if (!profileForm.fullName.trim() || !profileForm.nickname.trim()) {
      setError('Completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isSupabaseConfigured()) {
        const { error: profileError } = await createProfile({
          full_name: profileForm.fullName,
          nickname: profileForm.nickname,
          specialty: profileForm.specialty || null,
          phone: `+52${phone}`,
          role: profileForm.role,
        });
        if (profileError) throw profileError;
      }
      onAuthComplete?.();
    } catch (err) {
      setError('Error al crear perfil. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Demo mode bypass
  const handleDemoMode = () => {
    onAuthComplete?.();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <MatsLogo size={80} showText className="mb-8" />

        <div className="w-full max-w-sm space-y-6">
          {/* Error Display */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Step: Invite Code */}
          {step === 'invite' && (
            <div className="space-y-4">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground">Bienvenido</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Ingresa tu código de invitación
                </p>
              </div>

              <div>
                <Label>Código de invitación</Label>
                <Input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="EXS-XXXXXX"
                  className="font-mono text-center text-lg"
                  maxLength={10}
                />
              </div>

              <Button
                onClick={handleInviteSubmit}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Key className="w-4 h-4 mr-2" />
                )}
                Validar Código
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">o</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                disabled
              >
                <QrCode className="w-4 h-4 mr-2" />
                Escanear QR
              </Button>

              {/* Demo Mode */}
              {!isSupabaseConfigured() && (
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={handleDemoMode}
                >
                  Entrar en modo demo
                </Button>
              )}
            </div>
          )}

          {/* Step: Phone Number */}
          {step === 'phone' && (
            <div className="space-y-4">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground">Tu Teléfono</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Te enviaremos un código de verificación
                </p>
              </div>

              <div>
                <Label>Número de teléfono</Label>
                <div className="flex gap-2">
                  <div className="w-20">
                    <Input value="+52" disabled className="text-center" />
                  </div>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="55 1234 5678"
                    maxLength={10}
                    className="flex-1"
                  />
                </div>
              </div>

              <Button
                onClick={handlePhoneSubmit}
                disabled={loading || phone.length < 10}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Phone className="w-4 h-4 mr-2" />
                )}
                Enviar Código
              </Button>
            </div>
          )}

          {/* Step: OTP Verification */}
          {step === 'otp' && (
            <div className="space-y-4">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground">Verificación</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Ingresa el código de 6 dígitos enviado a +52 {phone}
                </p>
              </div>

              <div>
                <Input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  maxLength={6}
                  className="font-mono text-center text-2xl tracking-widest"
                />
              </div>

              <Button
                onClick={handleOtpSubmit}
                disabled={loading || otp.length !== 6}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                Verificar
              </Button>

              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => setStep('phone')}
              >
                Usar otro número
              </Button>
            </div>
          )}

          {/* Step: Profile Setup */}
          {step === 'profile' && (
            <div className="space-y-4">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground">Tu Perfil</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Completa tu información
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

              <div>
                <Label>Apodo (nombre para radio) *</Label>
                <Input
                  value={profileForm.nickname}
                  onChange={(e) => setProfileForm({ ...profileForm, nickname: e.target.value })}
                  placeholder="JP23"
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
                      <SelectItem key={spec} value={spec}>
                        {spec}
                      </SelectItem>
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
                    <div className={cn(
                      'font-medium text-sm',
                      profileForm.role === 'RESCATISTA' ? 'text-mats-green' : 'text-foreground'
                    )}>
                      Rescatista
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Paramédico / Ex-paramédico
                    </div>
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
                    <div className={cn(
                      'font-medium text-sm',
                      profileForm.role === 'FAMILIAR' ? 'text-accent' : 'text-foreground'
                    )}>
                      Familiar
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Funciones básicas
                    </div>
                  </button>
                </div>
              </div>

              <Button
                onClick={handleProfileSubmit}
                disabled={loading || !profileForm.fullName || !profileForm.nickname}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                Completar Registro
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-xs text-muted-foreground">
        COMUNIDAD EX SOS • M.A.T.S.
      </div>
    </div>
  );
};

export default AuthGate;
