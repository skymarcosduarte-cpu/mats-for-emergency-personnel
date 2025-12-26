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
  VolumeX,
  Radar,
  UserCog,
  Trash2,
  AlertTriangle,
  KeyRound,
  Eye,
  EyeOff,
  Droplets,
  Pill,
  FileHeart,
  Wifi,
  FlaskConical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { MatsLogo } from '@/components/MatsLogo';
import { EmergencyContactsManager } from '@/components/EmergencyContactsManager';
import { AppFooter } from '@/components/AppFooter';
import { ConnectionStatusIndicator } from '@/components/ConnectionStatusIndicator';
import { APP_VERSION, BUILD_TIME, getFullVersionString } from '@/lib/versionCheck';
import { useAuth } from '@/hooks/useAuth';
import { UpdateButton, InstallButton } from '@/components/UpdatePrompt';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAlertSettings } from '@/hooks/useAlertSettings';
import { playSubtleAlert, playUrgentAlert } from '@/lib/alertSound';
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';
import QRCode from 'qrcode';

interface SettingsScreenProps {
  onLogout?: () => void;
  onSimulatePanicAlert?: (type: string) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onLogout,
  onSimulatePanicAlert
}) => {
  const { profile, role, signOut, updateProfile, updateRole, deleteAccount } = useAuth();
  const { permission, isSupported, requestPermission, showEarthquakeNotification } = usePushNotifications();
  const { helpRequestSounds, earthquakeSounds, earthquakeRadiusMiles, setHelpRequestSounds, setEarthquakeSounds, setEarthquakeRadiusMiles } = useAlertSettings();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingMedical, setSavingMedical] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [changingRole, setChangingRole] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showMedicalDialog, setShowMedicalDialog] = useState(false);
  const [savingMedicalData, setSavingMedicalData] = useState(false);
  const [showAlertTypeDrawer, setShowAlertTypeDrawer] = useState(false);
  const [selectedAlertType, setSelectedAlertType] = useState('AMBULANCIA_PROPIA');
  const [medicalForm, setMedicalForm] = useState({
    blood_type: profile?.blood_type || '',
    allergies: profile?.allergies || '',
    medical_conditions: profile?.medical_conditions || '',
    current_medications: profile?.current_medications || '',
    emergency_medical_notes: profile?.emergency_medical_notes || '',
  });

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
      setMedicalForm({
        blood_type: profile.blood_type || '',
        allergies: profile.allergies || '',
        medical_conditions: profile.medical_conditions || '',
        current_medications: profile.current_medications || '',
        emergency_medical_notes: profile.emergency_medical_notes || '',
      });
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

  // Handle role change
  const handleRoleChange = async (newRole: 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR') => {
    setChangingRole(true);
    try {
      const { error } = await updateRole(newRole);
      if (error) {
        console.error('Error changing role:', error);
        alert('Error al cambiar el rol. Intenta de nuevo.');
      } else {
        setShowRoleDialog(false);
      }
    } finally {
      setChangingRole(false);
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'ELIMINAR') return;
    
    setDeletingAccount(true);
    try {
      const { error } = await deleteAccount();
      if (error) {
        console.error('Error deleting account:', error);
        alert('Error al eliminar la cuenta. Intenta de nuevo.');
      } else {
        onLogout?.();
      }
    } finally {
      setDeletingAccount(false);
      setShowDeleteDialog(false);
      setDeleteConfirmText('');
    }
  };

  // Handle password change
  const handlePasswordChange = async () => {
    setPasswordError('');
    
    if (newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) {
        console.error('Error changing password:', error);
        setPasswordError(error.message);
      } else {
        setShowPasswordDialog(false);
        setNewPassword('');
        setConfirmPassword('');
        alert('Contraseña actualizada correctamente');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  // Save medical data
  const handleSaveMedicalData = async () => {
    setSavingMedicalData(true);
    try {
      const { error } = await updateProfile({
        blood_type: medicalForm.blood_type || null,
        allergies: medicalForm.allergies || null,
        medical_conditions: medicalForm.medical_conditions || null,
        current_medications: medicalForm.current_medications || null,
        emergency_medical_notes: medicalForm.emergency_medical_notes || null,
      });
      
      if (error) {
        console.error('Error saving medical data:', error);
        alert('Error al guardar. Intenta de nuevo.');
      } else {
        setShowMedicalDialog(false);
      }
    } finally {
      setSavingMedicalData(false);
    }
  };

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
                  role === 'SOS_ACTIVO'
                    ? 'bg-mats-green/20 text-mats-green'
                    : role === 'EX_SOS'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {role === 'SOS_ACTIVO' ? 'SOS Activo' : role === 'EX_SOS' ? 'EX-SOS' : 'Familiar'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connection Status */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wifi className="w-5 h-5" />
              Estado de Conexión
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectionStatusIndicator />
          </CardContent>
        </Card>

        {/* Account Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="w-5 h-5" />
              Configuración de Cuenta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Role Change */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  role === 'SOS_ACTIVO' ? "bg-mats-green/10" : role === 'EX_SOS' ? "bg-primary/10" : "bg-muted"
                )}>
                  <Shield className={cn(
                    "w-5 h-5",
                    role === 'SOS_ACTIVO' ? "text-mats-green" : role === 'EX_SOS' ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <p className="font-medium text-foreground">Tipo de usuario</p>
                  <p className="text-xs text-muted-foreground">
                    {role === 'SOS_ACTIVO' 
                      ? 'Acceso completo a todas las funciones' 
                      : role === 'EX_SOS'
                      ? 'Acceso completo como ex-paramédico'
                      : 'Acceso limitado a funciones básicas'}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRoleDialog(true)}
              >
                Cambiar
              </Button>
            </div>

            {/* Password Change */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <KeyRound className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Cambiar contraseña</p>
                    <p className="text-xs text-muted-foreground">
                      Actualiza tu contraseña de acceso
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasswordDialog(true)}
                >
                  Cambiar
                </Button>
              </div>
            </div>

            {/* Delete Account */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Eliminar cuenta</p>
                    <p className="text-xs text-muted-foreground">
                      Esta acción es permanente e irreversible
                    </p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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

        {/* Medical Emergency Data */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileHeart className="w-5 h-5 text-destructive" />
              Datos Médicos de Emergencia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Información médica importante que puede ayudar a los rescatistas en caso de emergencia.
            </p>
            
            {/* Quick view of medical data */}
            <div className="space-y-2 p-3 rounded-lg bg-muted/50">
              {profile?.blood_type ? (
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-medium">Tipo de sangre:</span>
                  <span className="text-sm text-muted-foreground">{profile.blood_type}</span>
                </div>
              ) : null}
              
              {profile?.allergies ? (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
                  <span className="text-sm font-medium">Alergias:</span>
                  <span className="text-sm text-muted-foreground flex-1">{profile.allergies}</span>
                </div>
              ) : null}
              
              {profile?.medical_conditions ? (
                <div className="flex items-start gap-2">
                  <HeartPulse className="w-4 h-4 text-safe mt-0.5" />
                  <span className="text-sm font-medium">Condiciones:</span>
                  <span className="text-sm text-muted-foreground flex-1">{profile.medical_conditions}</span>
                </div>
              ) : null}
              
              {profile?.current_medications ? (
                <div className="flex items-start gap-2">
                  <Pill className="w-4 h-4 text-primary mt-0.5" />
                  <span className="text-sm font-medium">Medicamentos:</span>
                  <span className="text-sm text-muted-foreground flex-1">{profile.current_medications}</span>
                </div>
              ) : null}
              
              {!profile?.blood_type && !profile?.allergies && !profile?.medical_conditions && !profile?.current_medications && (
                <p className="text-xs text-muted-foreground italic">
                  No hay datos médicos configurados
                </p>
              )}
            </div>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowMedicalDialog(true)}
            >
              <FileHeart className="w-4 h-4 mr-2" />
              {profile?.blood_type || profile?.allergies ? 'Editar Datos Médicos' : 'Agregar Datos Médicos'}
            </Button>
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

              {/* Earthquake radius slider */}
              <div className="space-y-3 p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                    <Radar className="w-5 h-5 text-warning" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-foreground font-medium">
                      Radio de detección
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Distancia para alertas sísmicas
                    </p>
                  </div>
                  <span className="text-lg font-bold text-warning">
                    {earthquakeRadiusMiles} mi
                  </span>
                </div>
                <Slider
                  value={[earthquakeRadiusMiles]}
                  onValueChange={(v) => setEarthquakeRadiusMiles(v[0])}
                  min={10}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  <span>10 millas</span>
                  <span>100 millas</span>
                </div>
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

        {/* Emergency Contacts Section */}
        <EmergencyContactsManager />

        {/* Application (Install + Version + Update) */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="w-5 h-5" />
              Aplicación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Install section */}
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Instala la app para acceder más rápido y recibir notificaciones.
              </p>
              <InstallButton />
            </div>

            {/* Version info */}
            <div className="border-t border-border pt-4 space-y-2">
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
            </div>
            
            {/* Update Button */}
            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground mb-2">
                Busca actualizaciones o limpia caché si tienes problemas.
              </p>
              <UpdateButton />
            </div>

            {/* Branding */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-center gap-2 text-mats-green">
                <MatsLogo size={24} />
                <span className="font-bold">COMUNIDAD SOS</span>
              </div>
              <p className="text-xs text-center text-muted-foreground mt-2">
                M.A.T.S. - Sistema de Respuesta a Emergencias
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-5 h-5" />
              Privacidad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Show name on map toggle */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  profile?.show_name_on_map ? "bg-primary/10" : "bg-muted"
                )}>
                  {profile?.show_name_on_map ? (
                    <Eye className="w-5 h-5 text-primary" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <Label htmlFor="show-name-map" className="text-foreground font-medium">
                    Mostrar nombre en el mapa
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {profile?.show_name_on_map 
                      ? 'Tu apodo es visible para otros usuarios'
                      : 'Solo se ve tu icono, sin nombre'}
                  </p>
                </div>
              </div>
              <Switch
                id="show-name-map"
                checked={profile?.show_name_on_map ?? true}
                onCheckedChange={async (checked) => {
                  await updateProfile({ show_name_on_map: checked });
                }}
              />
            </div>

            <div className="p-3 rounded-lg bg-muted/30 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Shield className="w-4 h-4 text-primary" />
                Ubicación siempre activa
              </div>
              <p className="text-xs text-muted-foreground">
                Tu ubicación se comparte en tiempo real con la red M.A.T.S. para tu seguridad. 
                Esto permite que la comunidad pueda localizarte en caso de emergencia y protegerte 
                de situaciones de riesgo como secuestros.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Developer Test Mode */}
        <Card className="bg-card border-border border-dashed border-warning/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-warning">
              <FlaskConical className="w-5 h-5" />
              Modo de Prueba
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Simula una alerta de pánico para probar el flujo de cancelación sin enviar una alerta real a la comunidad.
            </p>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 justify-between"
                onClick={() => setShowAlertTypeDrawer(true)}
              >
                <span>
                  {selectedAlertType === 'AMBULANCIA_PROPIA' && '🚑 Ambulancia'}
                  {selectedAlertType === 'PATRULLA' && '🚔 Patrulla'}
                  {selectedAlertType === 'MECANICO' && '🔧 Mecánico'}
                  {selectedAlertType === 'PROTECCION_CIVIL' && '🆘 Protección Civil'}
                </span>
                <FlaskConical className="w-4 h-4 opacity-50" />
              </Button>
              <Button
                variant="outline"
                className="border-warning text-warning hover:bg-warning/10"
                onClick={() => onSimulatePanicAlert?.(selectedAlertType)}
              >
                <FlaskConical className="w-4 h-4 mr-2" />
                Simular
              </Button>
            </div>

            {/* Alert Type Drawer */}
            <Drawer open={showAlertTypeDrawer} onOpenChange={setShowAlertTypeDrawer}>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle className="text-center">Selecciona tipo de alerta</DrawerTitle>
                </DrawerHeader>
                <div className="px-4 pb-6 space-y-2">
                  {[
                    { value: 'AMBULANCIA_PROPIA', label: '🚑 Ambulancia', description: 'Emergencia médica' },
                    { value: 'PATRULLA', label: '🚔 Patrulla', description: 'Seguridad' },
                    { value: 'MECANICO', label: '🔧 Mecánico', description: 'Falla vehicular' },
                    { value: 'PROTECCION_CIVIL', label: '🆘 Protección Civil', description: 'Desastre natural' },
                  ].map((option) => (
                    <DrawerClose asChild key={option.value}>
                      <Button
                        variant={selectedAlertType === option.value ? 'default' : 'outline'}
                        className="w-full h-14 justify-start gap-3 text-left"
                        onClick={() => {
                          setSelectedAlertType(option.value);
                          setShowAlertTypeDrawer(false);
                        }}
                      >
                        <span className="text-xl">{option.label.split(' ')[0]}</span>
                        <div className="flex flex-col items-start">
                          <span className="font-semibold">{option.label.split(' ').slice(1).join(' ')}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        </div>
                      </Button>
                    </DrawerClose>
                  ))}
                </div>
              </DrawerContent>
            </Drawer>

            <p className="text-xs text-muted-foreground italic">
              La alerta de prueba aparecerá en la parte superior de la pantalla. Usa el botón "Cancelar" para probar el flujo de cancelación.
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

      {/* Role Change Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Cambiar Tipo de Usuario
            </DialogTitle>
            <DialogDescription>
              Selecciona tu nuevo rol en la comunidad.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Button
              variant={role === 'SOS_ACTIVO' ? 'default' : 'outline'}
              className="w-full justify-start gap-3 h-auto py-4"
              onClick={() => handleRoleChange('SOS_ACTIVO')}
              disabled={changingRole || role === 'SOS_ACTIVO'}
            >
              <div className="w-10 h-10 rounded-full bg-mats-green/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-mats-green" />
              </div>
              <div className="text-left">
                <p className="font-medium">SOS ACTIVO</p>
                <p className="text-xs text-muted-foreground">
                  Acceso completo: invitaciones, marketplace, responder alertas
                </p>
              </div>
              {changingRole && role !== 'SOS_ACTIVO' && (
                <Loader2 className="w-4 h-4 animate-spin ml-auto" />
              )}
            </Button>

            <Button
              variant={role === 'EX_SOS' ? 'default' : 'outline'}
              className="w-full justify-start gap-3 h-auto py-4"
              onClick={() => handleRoleChange('EX_SOS')}
              disabled={changingRole || role === 'EX_SOS'}
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium">EX-SOS</p>
                <p className="text-xs text-muted-foreground">
                  Acceso completo como ex-paramédico
                </p>
              </div>
              {changingRole && role !== 'EX_SOS' && (
                <Loader2 className="w-4 h-4 animate-spin ml-auto" />
              )}
            </Button>

            <Button
              variant={role === 'FAMILIAR' ? 'default' : 'outline'}
              className="w-full justify-start gap-3 h-auto py-4"
              onClick={() => handleRoleChange('FAMILIAR')}
              disabled={changingRole || role === 'FAMILIAR'}
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="text-left">
                <p className="font-medium">FAMILIAR</p>
                <p className="text-xs text-muted-foreground">
                  Funciones básicas: pánico, tránsito, reportes de sismos
                </p>
              </div>
              {changingRole && role !== 'FAMILIAR' && (
                <Loader2 className="w-4 h-4 animate-spin ml-auto" />
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) setDeleteConfirmText('');
      }}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Eliminar Cuenta
            </DialogTitle>
            <DialogDescription>
              Esta acción es permanente e irreversible. Se eliminarán todos tus datos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="text-sm text-destructive">
                ⚠️ Al eliminar tu cuenta:
              </p>
              <ul className="text-xs text-destructive/80 mt-2 space-y-1 list-disc list-inside">
                <li>Tu perfil será eliminado permanentemente</li>
                <li>Tus contactos de emergencia serán eliminados</li>
                <li>No podrás recuperar tu cuenta</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-confirm" className="text-sm text-foreground">
                Escribe <span className="font-bold text-destructive">ELIMINAR</span> para confirmar
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                placeholder="ELIMINAR"
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText('');
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'ELIMINAR' || deletingAccount}
            >
              {deletingAccount ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar Cuenta
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => {
        setShowPasswordDialog(open);
        if (!open) {
          setNewPassword('');
          setConfirmPassword('');
          setPasswordError('');
          setShowNewPassword(false);
          setShowConfirmPassword(false);
        }
      }}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Cambiar Contraseña
            </DialogTitle>
            <DialogDescription>
              Ingresa tu nueva contraseña. Debe tener al menos 6 caracteres.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm text-foreground">
                Nueva contraseña
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm text-foreground">
                Confirmar contraseña
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false);
                setNewPassword('');
                setConfirmPassword('');
                setPasswordError('');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePasswordChange}
              disabled={!newPassword || !confirmPassword || changingPassword}
            >
              {changingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Medical Data Dialog */}
      <Dialog open={showMedicalDialog} onOpenChange={setShowMedicalDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileHeart className="w-5 h-5 text-destructive" />
              Datos Médicos de Emergencia
            </DialogTitle>
            <DialogDescription>
              Esta información puede ser vital para los rescatistas en caso de emergencia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="blood-type" className="text-sm text-foreground flex items-center gap-2">
                <Droplets className="w-4 h-4 text-destructive" />
                Tipo de Sangre
              </Label>
              <select
                id="blood-type"
                value={medicalForm.blood_type}
                onChange={(e) => setMedicalForm(prev => ({ ...prev, blood_type: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Seleccionar...</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="allergies" className="text-sm text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                Alergias
              </Label>
              <Input
                id="allergies"
                value={medicalForm.allergies}
                onChange={(e) => setMedicalForm(prev => ({ ...prev, allergies: e.target.value }))}
                placeholder="Penicilina, mariscos, polen..."
              />
              <p className="text-xs text-muted-foreground">
                Alergias a medicamentos, alimentos u otros
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conditions" className="text-sm text-foreground flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-safe" />
                Condiciones Médicas
              </Label>
              <Input
                id="conditions"
                value={medicalForm.medical_conditions}
                onChange={(e) => setMedicalForm(prev => ({ ...prev, medical_conditions: e.target.value }))}
                placeholder="Diabetes, hipertensión, asma..."
              />
              <p className="text-xs text-muted-foreground">
                Enfermedades crónicas o condiciones importantes
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="medications" className="text-sm text-foreground flex items-center gap-2">
                <Pill className="w-4 h-4 text-primary" />
                Medicamentos Actuales
              </Label>
              <Input
                id="medications"
                value={medicalForm.current_medications}
                onChange={(e) => setMedicalForm(prev => ({ ...prev, current_medications: e.target.value }))}
                placeholder="Metformina, losartán..."
              />
              <p className="text-xs text-muted-foreground">
                Medicamentos que tomas regularmente
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm text-foreground flex items-center gap-2">
                <FileHeart className="w-4 h-4 text-muted-foreground" />
                Notas Adicionales
              </Label>
              <textarea
                id="notes"
                value={medicalForm.emergency_medical_notes}
                onChange={(e) => setMedicalForm(prev => ({ ...prev, emergency_medical_notes: e.target.value }))}
                placeholder="Información adicional importante..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <p className="text-xs text-muted-foreground">
                Ej: Marcapasos, prótesis, instrucciones especiales
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowMedicalDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveMedicalData}
              disabled={savingMedicalData}
            >
              {savingMedicalData ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <FileHeart className="w-4 h-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsScreen;
