import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MatsLogo } from '@/components/MatsLogo';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [noSession, setNoSession] = useState(false);

  // Listen for the PASSWORD_RECOVERY event that fires when user clicks the email link
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[ResetPassword] Auth event:', event);
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setSessionReady(true);
      }
    });

    // Also check if we already have a session (user might have been redirected with token in URL)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      } else {
        // Give a few seconds for the token exchange to complete
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            if (s) {
              setSessionReady(true);
            } else {
              setNoSession(true);
            }
          });
        }, 3000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    setError(null);

    if (!password.trim()) {
      setError('Ingresa tu nueva contraseña');
      return;
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        if (updateError.message.includes('same')) {
          setError('La nueva contraseña debe ser diferente a la anterior');
        } else {
          setError(updateError.message);
        }
      } else {
        setSuccess(true);
        toast({
          title: '¡Contraseña actualizada!',
          description: 'Ya puedes iniciar sesión con tu nueva contraseña.',
        });
        // Redirect to home after a moment
        setTimeout(() => navigate('/', { replace: true }), 2500);
      }
    } catch (err) {
      setError('Error al actualizar la contraseña. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Helmet>
        <title>Restablecer contraseña | M.A.T.S. for Emergency Personnel</title>
        <meta name="description" content="Crea una nueva contraseña para tu cuenta de M.A.T.S. for Emergency Personnel (M.A.T.S.)." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <MatsLogo size={48} showText />
          <h1 className="text-xl font-bold text-foreground">Restablecer contraseña</h1>
        </div>

        {success ? (
          <div className="bg-safe/10 border border-safe/30 rounded-lg p-6 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-safe mx-auto" />
            <p className="font-medium text-foreground">¡Contraseña actualizada!</p>
            <p className="text-sm text-muted-foreground">Redirigiendo a la app...</p>
          </div>
        ) : noSession ? (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 text-center space-y-3">
            <p className="font-medium text-foreground">Enlace expirado o inválido</p>
            <p className="text-sm text-muted-foreground">
              El enlace de recuperación ya fue usado o expiró. Solicita uno nuevo desde la pantalla de inicio de sesión.
            </p>
            <Button onClick={() => navigate('/', { replace: true })} className="w-full">
              Ir al inicio de sesión
            </Button>
          </div>
        ) : !sessionReady ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verificando enlace...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div>
              <Label>Nueva contraseña</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
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

            <div>
              <Label>Confirmar contraseña</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading || !password || !confirmPassword}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Guardar nueva contraseña
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
