// Settings Screen for COMUNIDAD EX SOS
// Invitations, Version, Logout

import React, { useState, useCallback } from 'react';
import { 
  User, 
  QrCode, 
  Copy, 
  Check, 
  LogOut, 
  Info, 
  RefreshCw,
  ExternalLink,
  Shield,
  Download,
  HeartPulse,
  Cross,
  Loader2,
  Bell,
  BellOff,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MatsLogo } from '@/components/MatsLogo';
import { AppFooter } from '@/components/AppFooter';
import { APP_VERSION, BUILD_TIME, getFullVersionString } from '@/lib/versionCheck';
import { useAuth } from '@/hooks/useAuth';
import { UpdateButton } from '@/components/UpdatePrompt';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAlertSettings } from '@/hooks/useAlertSettings';
import { playSubtleAlert, playUrgentAlert } from '@/lib/alertSound';
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';
import QRCode from 'qrcode';

interface SettingsScreenProps {
  onLogout?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onLogout
}) => {
  const { profile, role, signOut, updateProfile } = useAuth();
  const { permission, isSupported, requestPermission, showEarthquakeNotification } = usePushNotifications();
  const { helpRequestSounds, earthquakeSounds, setHelpRequestSounds, setEarthquakeSounds } = useAlertSettings();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingMedical, setSavingMedical] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);

  // Handle notification permission request
  const handleRequestPermission = async () => {
    setRequestingPermission(true);
    await requestPermission();
    setRequestingPermission(false);
  };

  // Test notification
  const handleTestNotification = () => {
    const testQuake = {
      id: 'test-123',
      type: 'Feature' as const,
      properties: {
        mag: 5.2,
        place: '10km NE of Test City (PRUEBA)',
        time: Date.now(),
        updated: Date.now(),
        tz: null,
        url: '',
        detail: '',
        felt: null,
        cdi: null,
        mmi: null,
        alert: null,
        status: 'automatic',
        tsunami: 0,
        sig: 500,
        net: 'test',
        code: 'test123',
        ids: ',test123,',
        sources: ',test,',
        types: ',origin,',
        nst: null,
        dmin: null,
        rms: 0.5,
        gap: null,
        magType: 'ml',
        type: 'earthquake',
        title: 'M 5.2 - 10km NE of Test City'
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [-99.1332, 19.4326, 10] as [number, number, number]
      }
    };
    showEarthquakeNotification(testQuake, 15);
  };

  // Medical assistance state
  const [canProvideMedical, setCanProvideMedical] = useState(
    profile?.can_provide_medical_assistance ?? false
  );
  const [hasFirstAidKit, setHasFirstAidKit] = useState(
    profile?.has_first_aid_kit ?? false
  );

  // Sync state when profile loads
  React.useEffect(() => {
    if (profile) {
      setCanProvideMedical(profile.can_provide_medical_assistance ?? false);
      setHasFirstAidKit(profile.has_first_aid_kit ?? false);
    }
  }, [profile]);

  // Update medical assistance settings
  const handleMedicalToggle = async (field: 'can_provide_medical_assistance' | 'has_first_aid_kit', value: boolean) => {
    setSavingMedical(true);
    
    if (field === 'can_provide_medical_assistance') {
      setCanProvideMedical(value);
    } else {
      setHasFirstAidKit(value);
    }

    try {
      await updateProfile({ [field]: value });
    } catch (error) {
      console.error('Error updating medical settings:', error);
      // Revert on error
      if (field === 'can_provide_medical_assistance') {
        setCanProvideMedical(!value);
      } else {
        setHasFirstAidKit(!value);
      }
    } finally {
      setSavingMedical(false);
    }
  };

  // Generate invite code
  const generateInviteCode = useCallback(async () => {
    setGenerating(true);
    try {
      // Generate random code
      const code = `EXS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      setInviteCode(code);

      // Generate QR code
      const qrPayload = JSON.stringify({ t: 'invite', c: code });
      const dataUrl = await QRCode.toDataURL(qrPayload, {
        width: 256,
        margin: 2,
        color: {
          dark: '#ffffff',
          light: '#0a0a0a',
        },
      });
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error('Error generating invite:', error);
    } finally {
      setGenerating(false);
    }
  }, []);

  // Copy invite code
  const copyInviteCode = useCallback(() => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteCode]);

  // Handle logout
  const handleLogout = async () => {
    if (confirm('¿Seguro que deseas cerrar sesión?')) {
      await signOut();
      onLogout?.();
    }
  };

  return (
    <div className="flex-1 overflow-auto pb-20 scrollbar-thin">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
        <h1 className="text-xl font-bold text-foreground">Configuración</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Profile Card */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <MatsLogo size={40} />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-foreground">
                  {profile?.full_name || 'Usuario'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  @{profile?.nickname || 'usuario'}
                </p>
                <span className={cn(
                  'inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium',
                  role === 'RESCATISTA'
                    ? 'bg-mats-green/20 text-mats-green'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {role || 'RESCATISTA'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medical Assistance Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="w-5 h-5 text-safe" />
              Asistencia Médica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Indica si puedes brindar asistencia médica en emergencias. Tu ubicación se mostrará con un icono especial (sin tu nombre).
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-safe/10 flex items-center justify-center">
                    <HeartPulse className="w-5 h-5 text-safe" />
                  </div>
                  <div>
                    <Label htmlFor="medical-toggle" className="text-foreground font-medium">
                      Puedo dar asistencia médica
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Tengo conocimientos médicos o paramédicos
                    </p>
                  </div>
                </div>
                <Switch
                  id="medical-toggle"
                  checked={canProvideMedical}
                  onCheckedChange={(value) => handleMedicalToggle('can_provide_medical_assistance', value)}
                  disabled={savingMedical}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-safe/10 flex items-center justify-center">
                    <Cross className="w-5 h-5 text-safe" />
                  </div>
                  <div>
                    <Label htmlFor="kit-toggle" className="text-foreground font-medium">
                      Tengo botiquín disponible
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Cuento con kit de primeros auxilios
                    </p>
                  </div>
                </div>
                <Switch
                  id="kit-toggle"
                  checked={hasFirstAidKit}
                  onCheckedChange={(value) => handleMedicalToggle('has_first_aid_kit', value)}
                  disabled={savingMedical}
                />
              </div>
            </div>

            {(canProvideMedical || hasFirstAidKit) && (
              <div className="mt-4 p-3 bg-safe/10 rounded-lg border border-safe/20">
                <p className="text-xs text-safe flex items-center gap-2">
                  <HeartPulse className="w-4 h-4" />
                  Tu icono en el mapa mostrará que puedes asistir
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="w-5 h-5" />
              Notificaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Recibe alertas de sismos cercanos incluso cuando la app está en segundo plano.
            </p>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                {permission === 'granted' ? (
                  <div className="w-10 h-10 rounded-full bg-safe/10 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-safe" />
                  </div>
                ) : permission === 'denied' ? (
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <BellOff className="w-5 h-5 text-destructive" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-foreground">
                    {!isSupported 
                      ? 'No soportado'
                      : permission === 'granted' 
                        ? 'Activadas' 
                        : permission === 'denied' 
                          ? 'Bloqueadas' 
                          : 'Sin configurar'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {!isSupported 
                      ? 'Tu navegador no soporta notificaciones'
                      : permission === 'granted' 
                        ? 'Recibirás alertas de sismos' 
                        : permission === 'denied' 
                          ? 'Habilita en configuración del navegador' 
                          : 'Activa las notificaciones para alertas'}
                  </p>
                </div>
              </div>
              
              {isSupported && permission !== 'granted' && permission !== 'denied' && (
                <Button
                  size="sm"
                  onClick={handleRequestPermission}
                  disabled={requestingPermission}
                >
                  {requestingPermission ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Activar'
                  )}
                </Button>
              )}
            </div>

            {permission === 'denied' && (
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-xs text-destructive">
                  Las notificaciones fueron bloqueadas. Para activarlas, ve a la configuración de tu navegador y permite notificaciones para este sitio.
                </p>
              </div>
            )}

            {permission === 'granted' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestNotification}
                className="w-full"
              >
                <Bell className="w-4 h-4 mr-2" />
                Probar Notificación
              </Button>
            )}

            {/* Sound toggles */}
            <div className="border-t border-border pt-4 mt-4 space-y-4">
              <p className="text-sm font-medium text-foreground">Sonidos de alerta</p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    earthquakeSounds ? "bg-warning/10" : "bg-muted"
                  )}>
                    {earthquakeSounds ? (
                      <Volume2 className="w-5 h-5 text-warning" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <Label htmlFor="earthquake-sounds" className="text-foreground font-medium">
                      Alertas sísmicas
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Sonido al detectar sismos cercanos
                    </p>
                  </div>
                </div>
                <Switch
                  id="earthquake-sounds"
                  checked={earthquakeSounds}
                  onCheckedChange={setEarthquakeSounds}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    helpRequestSounds ? "bg-destructive/10" : "bg-muted"
                  )}>
                    {helpRequestSounds ? (
                      <Volume2 className="w-5 h-5 text-destructive" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <Label htmlFor="help-sounds" className="text-foreground font-medium">
                      Solicitudes de ayuda
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Sonido cuando alguien pide ayuda
                    </p>
                  </div>
                </div>
                <Switch
                  id="help-sounds"
                  checked={helpRequestSounds}
                  onCheckedChange={setHelpRequestSounds}
                />
              </div>

              {/* Test sound buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => playSubtleAlert()}
                  className="flex-1"
                  disabled={!helpRequestSounds}
                >
                  <Volume2 className="w-4 h-4 mr-2" />
                  Sonido lejano
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => playUrgentAlert()}
                  className="flex-1"
                  disabled={!helpRequestSounds}
                >
                  <Volume2 className="w-4 h-4 mr-2" />
                  Sonido cercano
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="w-5 h-5" />
              Invitar Miembro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Genera un código de invitación para agregar nuevos miembros a la comunidad.
            </p>
            <Button
              onClick={() => {
                setShowInviteDialog(true);
                if (!inviteCode) generateInviteCode();
              }}
              className="w-full"
            >
              <QrCode className="w-4 h-4 mr-2" />
              Generar Invitación
            </Button>
          </CardContent>
        </Card>

        {/* Version Info */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="w-5 h-5" />
              Información de la App
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Versión</span>
              <span className="font-mono text-sm text-foreground">
                {getFullVersionString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Build</span>
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(BUILD_TIME).toLocaleDateString()}
              </span>
            </div>
            
            {/* Update Button */}
            <div className="border-t border-border pt-3 mt-3">
              <UpdateButton />
            </div>

            <div className="border-t border-border pt-3 mt-3">
              <div className="flex items-center justify-center gap-2 text-mats-green">
                <MatsLogo size={24} />
                <span className="font-bold">COMUNIDAD EX SOS</span>
              </div>
              <p className="text-xs text-center text-muted-foreground mt-2">
                M.A.T.S. - Sistema de Respuesta a Emergencias
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security Info */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-5 h-5" />
              Privacidad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Tu información personal (nombre, teléfono, apodo) nunca se muestra en el 
              mapa ni es visible para otros usuarios. Solo se muestra tu icono M.A.T.S. 
              sin identificadores personales.
            </p>
          </CardContent>
        </Card>

        {/* Logout Button */}
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar Sesión
        </Button>

        {/* Footer */}
        <AppFooter />
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Código de Invitación
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {generating ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* QR Code */}
                {qrDataUrl && (
                  <div className="flex justify-center">
                    <img 
                      src={qrDataUrl} 
                      alt="QR Code de invitación" 
                      className="rounded-lg"
                    />
                  </div>
                )}

                {/* Code Display */}
                <div className="flex items-center gap-2">
                  <Input
                    value={inviteCode}
                    readOnly
                    className="font-mono text-center text-lg"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyInviteCode}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-safe" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  Comparte este código o QR con el nuevo miembro. 
                  Lo necesitará para registrarse.
                </p>

                {/* Regenerate Button */}
                <Button
                  variant="outline"
                  onClick={generateInviteCode}
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generar Nuevo Código
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsScreen;
