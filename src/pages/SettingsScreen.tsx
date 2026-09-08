// Settings Screen for COMUNIDAD EX SOS
// Invitations, Version, Logout

import React, { useState, useCallback, useEffect } from 'react';
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
  MapPin,
  FileText,
  Database,
  FileDown,
  GraduationCap,
  Users,
  BookOpen,
  Radio,
  Mic,
  MicOff
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { MatsLogo } from '@/components/MatsLogo';
import { EmergencyContactsManager } from '@/components/EmergencyContactsManager';
import { MyEmergencyRecordings } from '@/components/MyEmergencyRecordings';
import { AppFooter } from '@/components/AppFooter';
import { ConnectionStatusIndicator } from '@/components/ConnectionStatusIndicator';
import { AdminPanel } from '@/components/AdminPanel';
import { APP_VERSION, BUILD_TIME, getFullVersionString } from '@/lib/versionCheck';
import { useAuth } from '@/hooks/useAuth';
import { UpdateButton, InstallButton } from '@/components/UpdatePrompt';
import { isNative } from '@/lib/capacitor';

import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useWebPushSubscription } from '@/hooks/useWebPushSubscription';
import { useAlertSettings } from '@/hooks/useAlertSettings';
import { playSubtleAlert, playUrgentAlert } from '@/lib/alertSound';
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { useUserDataExport } from '@/hooks/useUserDataExport';
import { Badge } from '@/components/ui/badge';
import { ComprehensiveTutorial } from '@/components/ComprehensiveTutorial';
import { UserGuideStepByStep } from '@/components/UserGuideStepByStep';
import { Clave100DrillScheduler } from '@/components/Clave100DrillScheduler';
import { ProfileEditDialog } from '@/components/ProfileEditDialog';
import QRCode from 'qrcode';
import { toast } from 'sonner';

interface SettingsScreenProps {
  onLogout?: () => void;
  onGoHome?: () => void;
}

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

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onLogout
}) => {
  const { user, profile, role, signOut, updateProfile, updateRole, deleteAccount } = useAuth();
  const { permission, isSupported, requestPermission, showEarthquakeNotification } = usePushNotifications();
  const { isSupported: webPushSupported, isSubscribed: webPushSubscribed, subscribe: subscribeToPush } = useWebPushSubscription();
  const { helpRequestSounds, earthquakeSounds, earthquakeRadiusKm, internationalRedAlerts, ssnNationalAlertMagnitude, skyAlertSounds, arrivalRadiusMeters, setArrivalRadiusMeters, setHelpRequestSounds, setEarthquakeSounds, setEarthquakeRadiusKm, setInternationalRedAlerts, setSsnNationalAlertMagnitude, setSkyAlertSounds } = useAlertSettings();
  const { loading: loadingDataExport, data: userDataExport, fetchAllUserData, downloadAsJson } = useUserDataExport();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showDataExportDialog, setShowDataExportDialog] = useState(false);
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
  const [passwordFlow, setPasswordFlow] = useState<'change' | 'recovery'>('change');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showMedicalDialog, setShowMedicalDialog] = useState(false);
  const [savingMedicalData, setSavingMedicalData] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [shareLocation, setShareLocation] = useState(profile?.share_location ?? false);
  const [shareMedicalInfo, setShareMedicalInfo] = useState(profile?.share_medical_info ?? false);
  const [pendingMedicalDisable, setPendingMedicalDisable] = useState<'has_first_aid_kit' | 'has_ambulance' | 'has_rescue_unit' | 'has_k9_unit' | null>(null);
  const [hasRescueUnit, setHasRescueUnit] = useState(
    profile?.has_rescue_unit ?? false
  );
  const [hasK9Unit, setHasK9Unit] = useState(
    profile?.has_k9_unit ?? false
  );
  const [medicalForm, setMedicalForm] = useState({
    blood_type: profile?.blood_type || '',
    allergies: profile?.allergies || '',
    medical_conditions: profile?.medical_conditions || '',
    current_medications: profile?.current_medications || '',
    emergency_medical_notes: profile?.emergency_medical_notes || '',
  });
  const [showSpecialtiesDialog, setShowSpecialtiesDialog] = useState(false);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(
    Array.isArray(profile?.specialty) ? profile.specialty : []
  );
  const [savingSpecialties, setSavingSpecialties] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showDrillScheduler, setShowDrillScheduler] = useState(false);
  const [showProfileEditDialog, setShowProfileEditDialog] = useState(false);




  const handleRequestPermission = async () => {
    setRequestingPermission(true);
    const granted = await requestPermission();
    // If permission granted, also subscribe to web push
    if (granted && webPushSupported && !webPushSubscribed) {
      await subscribeToPush();
    }
    setRequestingPermission(false);
  };

  const handleEnableBackgroundNotifications = async () => {
    setRequestingPermission(true);
    try {
      // First ensure we have permission
      if (permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          toast.error('Se requiere permiso de notificaciones');
          setRequestingPermission(false);
          return;
        }
      }
      // Then subscribe to web push
      if (webPushSupported) {
        const success = await subscribeToPush();
        if (success) {
          toast.success('Notificaciones en segundo plano activadas', {
            description: 'Recibirás alertas y mensajes aunque la app esté cerrada.',
          });
        } else {
          toast.error('No se pudo activar', {
            description: 'Intenta cerrar y volver a abrir la app.',
          });
        }
      }
    } catch (error) {
      console.error('Error enabling background notifications:', error);
      toast.error('Error al activar notificaciones');
    }
    setRequestingPermission(false);
  };

  // Test notification
  const handleTestNotification = () => {
    // First, play a sound so user always gets feedback
    playSubtleAlert();

    // Check if notifications are supported
    if (!isSupported) {
      toast.info('Tu navegador no soporta notificaciones nativas', {
        description: 'Recibirás alertas visuales y sonoras dentro de la app.',
      });
      return;
    }

    // Check permission status
    if (permission !== 'granted') {
      toast.warning('Permisos de notificación no concedidos', {
        description: 'Activa las notificaciones arriba para recibir alertas.',
        action: {
          label: 'Activar',
          onClick: handleRequestPermission,
        },
      });
      return;
    }

    const testQuake = {
      id: 'test-123',
      type: 'Feature' as const,
      properties: {
        mag: 5.2,
        place: '10km NE de Ciudad de Prueba (TEST)',
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
        title: 'M 5.2 - 10km NE de Ciudad de Prueba'
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [-99.1332, 19.4326, 10] as [number, number, number]
      }
    };

    const sent = showEarthquakeNotification(testQuake, 15);
    if (sent) {
      toast.success('Notificación de prueba enviada', {
        description: 'Deberías verla en tu dispositivo.',
      });
    } else {
      toast.error('No se pudo enviar la notificación', {
        description: 'Revisa los permisos del navegador.',
      });
    }
  };

  // Medical assistance state
  const [canProvideMedical, setCanProvideMedical] = useState(
    profile?.can_provide_medical_assistance ?? false
  );
  const [hasFirstAidKit, setHasFirstAidKit] = useState(
    profile?.has_first_aid_kit ?? false
  );
  const [hasAmbulance, setHasAmbulance] = useState(
    profile?.has_ambulance ?? false
  );

  // Sync state when profile loads
  React.useEffect(() => {
    if (profile) {
      setCanProvideMedical(profile.can_provide_medical_assistance ?? false);
      setHasFirstAidKit(profile.has_first_aid_kit ?? false);
      setHasAmbulance(profile.has_ambulance ?? false);
      setHasRescueUnit(profile.has_rescue_unit ?? false);
      setHasK9Unit((profile as any).has_k9_unit ?? false);
      setShareLocation(profile.share_location ?? false);
      setShareMedicalInfo(profile.share_medical_info ?? false);
      setMedicalForm({
        blood_type: profile.blood_type || '',
        allergies: profile.allergies || '',
        medical_conditions: profile.medical_conditions || '',
        current_medications: profile.current_medications || '',
        emergency_medical_notes: profile.emergency_medical_notes || '',
      });
      setSelectedSpecialties(Array.isArray(profile.specialty) ? profile.specialty : []);
    }
  }, [profile]);



  // If user arrived via password recovery link, open password dialog automatically
  useEffect(() => {
    const hash = window.location.hash || '';
    if (!hash) return;

    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const type = params.get('type');

    if (type === 'recovery') {
      setPasswordFlow('recovery');
      setShowPasswordDialog(true);

      toast.info('Restablece tu contraseña', {
        description: 'Crea una nueva contraseña para que ya puedas iniciar sesión normalmente.',
      });

      // Remove tokens from URL after the auth client has time to read them
      window.setTimeout(() => {
        try {
          window.history.replaceState(
            null,
            document.title,
            window.location.pathname + window.location.search
          );
        } catch {
          // ignore
        }
      }, 1200);
    }
  }, []);


  // Handle specialty toggle
  const handleSpecialtyToggle = (specialty: string) => {
    setSelectedSpecialties(prev => 
      prev.includes(specialty)
        ? prev.filter(s => s !== specialty)
        : [...prev, specialty]
    );
  };

  // Save specialties
  const handleSaveSpecialties = async () => {
    setSavingSpecialties(true);
    try {
      await updateProfile({ 
        specialty: selectedSpecialties.length > 0 ? selectedSpecialties : null 
      } as any);
      setShowSpecialtiesDialog(false);
    } catch (error) {
      console.error('Error saving specialties:', error);
    } finally {
      setSavingSpecialties(false);
    }
  };

  // Handle privacy toggle
  const handlePrivacyToggle = async (field: 'share_location' | 'share_medical_info', value: boolean) => {
    setSavingPrivacy(true);
    
    if (field === 'share_location') {
      setShareLocation(value);
    } else {
      setShareMedicalInfo(value);
    }

    try {
      const updates: Record<string, unknown> = { [field]: value };
      
      // Set consent timestamp if enabling for first time
      if (value && field === 'share_location' && !profile?.privacy_consent_at) {
        updates.privacy_consent_at = new Date().toISOString();
        updates.terms_accepted_at = new Date().toISOString();
      }
      
      await updateProfile(updates);
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      // Revert on error
      if (field === 'share_location') {
        setShareLocation(!value);
      } else {
        setShareMedicalInfo(!value);
      }
    } finally {
      setSavingPrivacy(false);
    }
  };

  // Update medical assistance settings
  const handleMedicalToggle = async (field: 'can_provide_medical_assistance' | 'has_first_aid_kit' | 'has_ambulance' | 'has_rescue_unit' | 'has_k9_unit', value: boolean) => {
    setSavingMedical(true);
    
    if (field === 'can_provide_medical_assistance') {
      setCanProvideMedical(value);
    } else if (field === 'has_first_aid_kit') {
      setHasFirstAidKit(value);
    } else if (field === 'has_ambulance') {
      setHasAmbulance(value);
    } else if (field === 'has_rescue_unit') {
      setHasRescueUnit(value);
    } else if (field === 'has_k9_unit') {
      setHasK9Unit(value);
    }

    try {
      await updateProfile({ [field]: value });
    } catch (error) {
      console.error('Error updating medical settings:', error);
      // Revert on error
      if (field === 'can_provide_medical_assistance') {
        setCanProvideMedical(!value);
      } else if (field === 'has_first_aid_kit') {
        setHasFirstAidKit(!value);
      } else if (field === 'has_ambulance') {
        setHasAmbulance(!value);
      } else if (field === 'has_rescue_unit') {
        setHasRescueUnit(!value);
      } else if (field === 'has_k9_unit') {
        setHasK9Unit(!value);
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

    if (newPassword.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres');
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

        if (passwordFlow === 'recovery') {
          toast.success('Contraseña establecida', {
            description: 'Ya puedes iniciar sesión con tu nueva contraseña.',
          });
        } else {
          toast.success('Contraseña actualizada correctamente');
        }

        setPasswordFlow('change');

        // Clean URL hash if still present (recovery links include tokens)
        if (window.location.hash) {
          try {
            window.history.replaceState(
              null,
              document.title,
              window.location.pathname + window.location.search
            );
          } catch {
            // ignore
          }
        }
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
                {profile?.phone && (
                  <p className="text-xs text-muted-foreground">{profile.phone}</p>
                )}
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProfileEditDialog(true)}
                className="flex-shrink-0"
              >
                <UserCog className="w-4 h-4 mr-1" />
                Editar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Force Update - Top priority */}
        <Card className="bg-card border-border border-primary/30">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">Forzar Actualización</p>
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                    v{APP_VERSION}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Limpia caché y recarga la app
                </p>
              </div>
            </div>
            <UpdateButton />
          </CardContent>
        </Card>

        {/* Ayuda: tutorial + guía */}
        <Card className="bg-card border-border border-safe/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="w-5 h-5 text-safe" />
              Ayuda para usar la app
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowTutorial(true)}
              className="justify-start h-14 text-base border-safe/30 text-safe hover:bg-safe/10"
            >
              <GraduationCap className="w-5 h-5 mr-2" />
              Ver tutorial
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowUserGuide(true)}
              className="justify-start h-14 text-base border-primary/30 text-primary hover:bg-primary/10"
            >
              <BookOpen className="w-5 h-5 mr-2" />
              Guía paso a paso
            </Button>
          </CardContent>
        </Card>


        {/* Admin Panel - Only for SOS_ACTIVO */}
        {role === 'SOS_ACTIVO' && (
          <Card className="bg-card border-border border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Panel de Administración</p>
                    <p className="text-xs text-muted-foreground">
                      Ver usuarios registrados y códigos de invitación
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdminPanel(true)}
                  className="border-primary/30 text-primary hover:bg-primary/10"
                >
                  Abrir
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Simulacro Clave 100 - Only for Zombie and El Lagarto */}
        {user && ['7c823685-369d-4f62-8459-80486832ba1a', '0e0d5ee7-628d-4a98-af26-b60ede2536ce'].includes(user.id) && (
          <Card className="bg-card border-border border-amber-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Simulacro Clave 100</p>
                    <p className="text-xs text-muted-foreground">
                      Programar simulacros de emergencia
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDrillScheduler(true)}
                  className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                >
                  Programar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connection Status */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
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
                  onClick={() => {
                    setPasswordFlow('change');
                    setShowPasswordDialog(true);
                  }}
                >
                  Cambiar
                </Button>
              </div>
            </div>

            {/* Birthday */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg">🎂</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Fecha de nacimiento</p>
                    <p className="text-xs text-muted-foreground">
                      {profile?.birthday
                        ? new Date(profile.birthday + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
                        : 'No registrada'}
                    </p>
                  </div>
                </div>
                <input
                  type="date"
                  value={profile?.birthday || ''}
                  onChange={async (e) => {
                    const value = e.target.value;
                    try {
                      await updateProfile({ birthday: value || null } as any);
                      toast.success('Fecha de nacimiento actualizada');
                    } catch {
                      toast.error('Error al guardar');
                    }
                  }}
                  className="bg-muted border border-border rounded-md px-2 py-1 text-sm"
                />
              </div>
            </div>

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

        {/* Privacy Settings Card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-5 h-5 text-primary" />
              Privacidad y Compartir Datos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Controla qué información compartes con la comunidad. Esta información es voluntaria 
              y se utiliza exclusivamente para emergencias.
            </p>

            {/* Location Sharing Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  shareLocation ? "bg-primary/10" : "bg-muted"
                )}>
                  <MapPin className={cn(
                    "w-5 h-5",
                    shareLocation ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <Label htmlFor="share-location" className="text-foreground font-medium">
                    Compartir ubicación en tiempo real
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Otros miembros verán tu ubicación en el mapa
                  </p>
                </div>
              </div>
              <Switch
                id="share-location"
                checked={shareLocation}
                onCheckedChange={(value) => handlePrivacyToggle('share_location', value)}
                disabled={savingPrivacy}
              />
            </div>

            {/* Medical Info Sharing Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  shareMedicalInfo ? "bg-safe/10" : "bg-muted"
                )}>
                  <HeartPulse className={cn(
                    "w-5 h-5",
                    shareMedicalInfo ? "text-safe" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <Label htmlFor="share-medical" className="text-foreground font-medium">
                    Compartir info médica con rescatistas
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Visible cuando solicites ayuda de emergencia
                  </p>
                </div>
              </div>
              <Switch
                id="share-medical"
                checked={shareMedicalInfo}
                onCheckedChange={(value) => handlePrivacyToggle('share_medical_info', value)}
                disabled={savingPrivacy}
              />
            </div>

            {/* Privacy Status */}
            {(shareLocation || shareMedicalInfo) && profile?.privacy_consent_at && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-xs text-primary flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Términos aceptados el {new Date(profile.privacy_consent_at).toLocaleDateString('es-MX')}
                </p>
              </div>
            )}

            {/* View Terms Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowPrivacyDialog(true)}
            >
              <FileText className="w-4 h-4 mr-2" />
              Ver Aviso de Privacidad y Términos
            </Button>
          </CardContent>
        </Card>

        {/* ARCO Rights - Data Export Card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="w-5 h-5 text-primary" />
              Mis Datos Personales (ARCO)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tienes derecho a Acceder, Rectificar, Cancelar y Oponerte al uso de tus datos personales. 
              Aquí puedes ver y descargar toda la información que tenemos almacenada sobre ti.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  await fetchAllUserData();
                  setShowDataExportDialog(true);
                }}
                disabled={loadingDataExport}
              >
                {loadingDataExport ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4 mr-2" />
                )}
                Ver Datos
              </Button>
              <Button
                variant="outline"
                onClick={downloadAsJson}
                disabled={loadingDataExport}
              >
                {loadingDataExport ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 mr-2" />
                )}
                Exportar JSON
              </Button>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Rectificación:</strong> Puedes editar tus datos desde las secciones de Perfil y Datos Médicos.
                <br />
                <strong>Cancelación:</strong> Puedes eliminar tu cuenta desde "Eliminar cuenta" en Configuración de Cuenta.
              </p>
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
                <div className="flex items-center gap-2">
                  {hasFirstAidKit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => setPendingMedicalDisable('has_first_aid_kit')}
                      disabled={savingMedical}
                      title="Ya no tengo botiquín disponible"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Switch
                    id="kit-toggle"
                    checked={hasFirstAidKit}
                    onCheckedChange={(value) => handleMedicalToggle('has_first_aid_kit', value)}
                    disabled={savingMedical}
                  />
                </div>
              </div>

              {/* Ambulance toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <span className="text-lg">🚑</span>
                  </div>
                  <div>
                    <Label htmlFor="ambulance-toggle" className="text-foreground font-medium">
                      Tengo ambulancia disponible
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Cuento con ambulancia o vehículo de emergencia
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasAmbulance && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => setPendingMedicalDisable('has_ambulance')}
                      disabled={savingMedical}
                      title="Ya no tengo ambulancia disponible"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Switch
                    id="ambulance-toggle"
                    checked={hasAmbulance}
                    onCheckedChange={(value) => handleMedicalToggle('has_ambulance', value)}
                    disabled={savingMedical}
                  />
                </div>
              </div>

              {/* Rescue Unit toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg">🚒</span>
                  </div>
                  <div>
                    <Label htmlFor="rescue-unit-toggle" className="text-foreground font-medium">
                      Tengo unidad de rescate disponible
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Cuento con vehículo o equipo especializado de rescate
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasRescueUnit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => setPendingMedicalDisable('has_rescue_unit')}
                      disabled={savingMedical}
                      title="Ya no tengo unidad de rescate disponible"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Switch
                    id="rescue-unit-toggle"
                    checked={hasRescueUnit}
                    onCheckedChange={(value) => handleMedicalToggle('has_rescue_unit', value)}
                    disabled={savingMedical}
                  />
                </div>
              </div>

              {/* K9 Unit toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <span className="text-lg">🐕</span>
                  </div>
                  <div>
                    <Label htmlFor="k9-unit-toggle" className="text-foreground font-medium">
                      Tengo binomio canino (K9) disponible
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Cuento con perro de búsqueda y rescate certificado
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasK9Unit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => setPendingMedicalDisable('has_k9_unit')}
                      disabled={savingMedical}
                      title="Ya no tengo binomio canino disponible"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Switch
                    id="k9-unit-toggle"
                    checked={hasK9Unit}
                    onCheckedChange={(value) => handleMedicalToggle('has_k9_unit', value)}
                    disabled={savingMedical}
                  />
                </div>
              </div>
            </div>

            {(canProvideMedical || hasFirstAidKit || hasAmbulance || hasRescueUnit || hasK9Unit) && (
              <div className="mt-4 p-3 bg-safe/10 rounded-lg border border-safe/20">
                <p className="text-xs text-safe flex items-center gap-2">
                  <HeartPulse className="w-4 h-4" />
                  Tu icono en el mapa mostrará que puedes asistir
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Specialties */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-lg">📋</span>
              Especialidades
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Indica tus especialidades para que otros miembros sepan cómo puedes ayudar en emergencias.
            </p>
            
            {/* Current specialties display */}
            <div className="p-3 rounded-lg bg-muted/50">
              {Array.isArray(profile?.specialty) && profile.specialty.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.specialty.map((spec: string) => (
                    <Badge key={spec} variant="secondary" className="text-xs">
                      {spec}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No hay especialidades configuradas
                </p>
              )}
            </div>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSelectedSpecialties(Array.isArray(profile?.specialty) ? profile.specialty : []);
                setShowSpecialtiesDialog(true);
              }}
            >
              <span className="mr-2">📋</span>
              {Array.isArray(profile?.specialty) && profile.specialty.length > 0 
                ? 'Editar Especialidades' 
                : 'Agregar Especialidades'}
            </Button>
          </CardContent>
        </Card>
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
              {/* Push Status Badge - Prominent display */}
              {webPushSupported && (
                <Badge 
                  variant={webPushSubscribed ? "default" : "destructive"}
                  className={cn(
                    "ml-auto text-xs font-bold animate-pulse",
                    webPushSubscribed 
                      ? "bg-safe text-safe-foreground" 
                      : "bg-destructive text-destructive-foreground"
                  )}
                >
                  {webPushSubscribed ? '🔔 PUSH ACTIVO' : '🔕 PUSH NO ACTIVO'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Critical Push Status Banner */}
            {webPushSupported && !webPushSubscribed && (
              <div className="p-4 rounded-lg bg-destructive/20 border-2 border-destructive animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-destructive/30 flex items-center justify-center">
                    <BellOff className="w-6 h-6 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-destructive text-lg">
                      ⚠️ Push NO Activo
                    </p>
                    <p className="text-sm text-destructive/80">
                      No recibirás alertas de emergencia si cierras la app
                    </p>
                  </div>
                </div>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleEnableBackgroundNotifications}
                  disabled={requestingPermission}
                  className="w-full font-bold text-base"
                >
                  {requestingPermission ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Activando...
                    </>
                  ) : (
                    <>
                      <Bell className="w-5 h-5 mr-2" />
                      ACTIVAR PUSH AHORA
                    </>
                  )}
                </Button>
                <p className="text-xs text-destructive/70 mt-2 text-center">
                  Por seguridad, es crítico activar las notificaciones push para emergencias
                </p>
              </div>
            )}

            {/* Push Active Success Banner */}
            {webPushSupported && webPushSubscribed && (
              <div className="p-4 rounded-lg bg-safe/20 border-2 border-safe">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-safe/30 flex items-center justify-center">
                    <Bell className="w-6 h-6 text-safe" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-safe text-lg">
                      ✅ Push Activo
                    </p>
                    <p className="text-sm text-safe/80">
                      Recibirás alertas de emergencia aunque la app esté cerrada
                    </p>
                  </div>
                </div>
              </div>
            )}

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
                        ? 'Permisos concedidos' 
                        : permission === 'denied' 
                          ? 'Bloqueadas' 
                          : 'Sin configurar'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {!isSupported 
                      ? 'Tu navegador no soporta notificaciones'
                      : permission === 'granted' 
                        ? 'Permisos de notificación activos' 
                        : permission === 'denied' 
                          ? 'Habilita en configuración del navegador' 
                          : 'Activa los permisos para alertas'}
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




            </div>
          </CardContent>
        </Card>

        {/* Invite Member section removed - invitations now managed centrally */}

        {/* Emergency Contacts Section */}
        <EmergencyContactsManager />

        {/* My Emergency Recordings Section */}
        <MyEmergencyRecordings />

        {/* Application (Install + Version) */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="w-5 h-5" />
              Aplicación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Install section (solo en navegador; en la app nativa no aplica) */}
            {!isNative() ? (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Instala la app para acceder más rápido y recibir notificaciones.
                </p>
                <InstallButton />
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">
                  Estás usando la app nativa instalada en tu dispositivo. No necesitas instalarla de nuevo.
                </p>
              </div>
            )}


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

      {/* Invite Dialog removed - invitations now managed centrally */}

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
          setPasswordFlow('change');
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
              {passwordFlow === 'recovery' ? 'Establecer nueva contraseña' : 'Cambiar Contraseña'}
            </DialogTitle>
            <DialogDescription>
              {passwordFlow === 'recovery'
                ? 'Por seguridad, define una nueva contraseña para tu cuenta (mínimo 6 caracteres).'
                : 'Ingresa tu nueva contraseña. Debe tener al menos 6 caracteres.'}
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

      {/* Privacy Terms Dialog */}
      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Aviso de Privacidad y Términos de Uso
            </DialogTitle>
            <DialogDescription>Información sobre el uso de tus datos</DialogDescription>
          </DialogHeader>

          <div
            className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6 overscroll-contain touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="space-y-4 text-sm pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              {/* Main Notice */}
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Propósito de la Plataforma
                </h3>
                <p className="text-muted-foreground">
                  Comunidad SOS es una plataforma de apoyo voluntario para emergencias.
                  Su objetivo es facilitar la comunicación y coordinación entre miembros de la
                  comunidad durante situaciones de emergencia, sismos y desastres naturales.
                </p>
              </div>

              {/* Location Sharing */}
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Compartir Ubicación en Tiempo Real
                </h3>
                <p className="text-muted-foreground mb-3">
                  Al activar esta opción, tu ubicación será visible para otros miembros
                  verificados de la comunidad. Esta información se utiliza exclusivamente para:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                  <li>Facilitar la asistencia en caso de emergencia</li>
                  <li>Permitir que rescatistas te localicen si solicitas ayuda</li>
                  <li>Coordinar respuestas comunitarias ante desastres</li>
                </ul>
              </div>

              {/* Medical Info Sharing */}
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-safe" />
                  Compartir Información Médica de Emergencia
                </h3>
                <p className="text-muted-foreground mb-3">
                  Al activar esta opción, tu información médica (tipo de sangre, alergias,
                  condiciones médicas) será accesible para rescatistas verificados cuando
                  solicites ayuda. Esto permite:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                  <li>Atención médica más rápida y segura</li>
                  <li>Evitar administración de medicamentos que te afecten</li>
                  <li>Comunicar tu información vital a servicios de emergencia</li>
                </ul>
              </div>

              {/* Disclaimer */}
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Deslinde de Responsabilidad
                </h3>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  La plataforma Comunidad SOS y sus creadores no se hacen responsables por:
                </p>
                <ul className="list-disc list-inside text-muted-foreground text-xs space-y-1 ml-2 mt-2">
                  <li>El mal uso de la información compartida por terceros</li>
                  <li>La precisión o veracidad de la información proporcionada por los usuarios</li>
                  <li>Daños derivados de la respuesta o falta de respuesta ante emergencias</li>
                  <li>La disponibilidad o funcionamiento continuo de la plataforma</li>
                  <li>Las acciones u omisiones de otros miembros de la comunidad</li>
                </ul>
                <p className="text-muted-foreground text-xs mt-3">
                  <strong>Al usar esta plataforma, reconoces que:</strong>
                </p>
                <ul className="list-disc list-inside text-muted-foreground text-xs space-y-1 ml-2 mt-1">
                  <li>
                    Proporcionas tu información de forma <strong>voluntaria</strong>
                  </li>
                  <li>
                    La ayuda proporcionada es <strong>voluntaria y sin garantías</strong>
                  </li>
                  <li>Eres responsable de mantener tu información actualizada</li>
                  <li>Puedes desactivar el compartir en cualquier momento desde Configuración</li>
                </ul>
              </div>

              {/* Data Protection */}
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <h3 className="font-semibold text-foreground mb-2">Protección de Datos</h3>
                <p className="text-muted-foreground text-xs">
                  Tu información es almacenada de forma segura y solo es accesible para
                  usuarios autenticados de la comunidad. No vendemos ni compartimos tu
                  información con terceros externos. Puedes solicitar la eliminación de
                  tu cuenta y todos tus datos en cualquier momento desde la sección de
                  Configuración.
                </p>
              </div>
            </div>
          </div>


          <DialogFooter className="flex-shrink-0 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <Button onClick={() => setShowPrivacyDialog(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Data Export Dialog */}
      <Dialog open={showDataExportDialog} onOpenChange={setShowDataExportDialog}>
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Mis Datos Personales
            </DialogTitle>
            <DialogDescription>
              Información almacenada en tu cuenta
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 max-h-[60vh] pr-4">
            {userDataExport ? (
              <div className="space-y-4 text-sm">
                {/* Profile Data */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Perfil
                  </h3>
                  {userDataExport.profile ? (
                    <div className="space-y-1 text-xs">
                      <p><strong>Nombre:</strong> {(userDataExport.profile as Record<string, unknown>).full_name as string}</p>
                      <p><strong>Apodo:</strong> {(userDataExport.profile as Record<string, unknown>).nickname as string}</p>
                      <p><strong>Teléfono:</strong> {(userDataExport.profile as Record<string, unknown>).phone as string}</p>
                      <p><strong>Especialidades:</strong> {Array.isArray((userDataExport.profile as Record<string, unknown>).specialty) ? ((userDataExport.profile as Record<string, unknown>).specialty as string[]).join(', ') : 'No especificadas'}</p>
                      <p><strong>Cumpleaños:</strong> {(userDataExport.profile as Record<string, unknown>).birthday as string || 'No especificado'}</p>
                      <p><strong>Rol:</strong> {userDataExport.role || 'No asignado'}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Sin datos de perfil</p>
                  )}
                </div>

                {/* Medical Data */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <HeartPulse className="w-4 h-4 text-safe" />
                    Datos Médicos
                  </h3>
                  {userDataExport.profile && ((userDataExport.profile as Record<string, unknown>).blood_type || (userDataExport.profile as Record<string, unknown>).allergies) ? (
                    <div className="space-y-1 text-xs">
                      <p><strong>Tipo de sangre:</strong> {(userDataExport.profile as Record<string, unknown>).blood_type as string || 'No especificado'}</p>
                      <p><strong>Alergias:</strong> {(userDataExport.profile as Record<string, unknown>).allergies as string || 'Ninguna'}</p>
                      <p><strong>Condiciones médicas:</strong> {(userDataExport.profile as Record<string, unknown>).medical_conditions as string || 'Ninguna'}</p>
                      <p><strong>Medicamentos actuales:</strong> {(userDataExport.profile as Record<string, unknown>).current_medications as string || 'Ninguno'}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Sin datos médicos</p>
                  )}
                </div>

                {/* Emergency Contacts */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-warning" />
                    Contactos de Emergencia
                    <Badge variant="secondary" className="text-xs">{userDataExport.emergencyContacts.length}</Badge>
                  </h3>
                  {userDataExport.emergencyContacts.length > 0 ? (
                    <div className="space-y-2">
                      {userDataExport.emergencyContacts.map((contact, i) => (
                        <div key={i} className="text-xs p-2 bg-background rounded">
                          <p><strong>{contact.name as string}</strong> - {contact.phone as string}</p>
                          <p className="text-muted-foreground">{contact.relationship as string}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Sin contactos de emergencia</p>
                  )}
                </div>

                {/* Location Data */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Ubicación Actual
                  </h3>
                  {userDataExport.userLocation ? (
                    <div className="space-y-1 text-xs">
                      <p><strong>Latitud:</strong> {(userDataExport.userLocation as Record<string, unknown>).lat as number}</p>
                      <p><strong>Longitud:</strong> {(userDataExport.userLocation as Record<string, unknown>).lng as number}</p>
                      <p><strong>Última actualización:</strong> {new Date((userDataExport.userLocation as Record<string, unknown>).updated_at as string).toLocaleString('es-MX')}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Sin datos de ubicación</p>
                  )}
                </div>

                {/* Activity Summary */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Resumen de Actividad
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-background rounded text-center">
                      <p className="text-lg font-bold text-primary">{userDataExport.helpRequests.length}</p>
                      <p className="text-muted-foreground">Solicitudes de ayuda</p>
                    </div>
                    <div className="p-2 bg-background rounded text-center">
                      <p className="text-lg font-bold text-warning">{userDataExport.panicEvents.length}</p>
                      <p className="text-muted-foreground">Alertas de pánico</p>
                    </div>
                    <div className="p-2 bg-background rounded text-center">
                      <p className="text-lg font-bold text-safe">{userDataExport.roadReports.length}</p>
                      <p className="text-muted-foreground">Reportes viales</p>
                    </div>
                    <div className="p-2 bg-background rounded text-center">
                      <p className="text-lg font-bold text-muted-foreground">{userDataExport.transitTrips.length}</p>
                      <p className="text-muted-foreground">Viajes registrados</p>
                    </div>
                    <div className="p-2 bg-background rounded text-center">
                      <p className="text-lg font-bold text-muted-foreground">{userDataExport.statusMessages.length}</p>
                      <p className="text-muted-foreground">Mensajes de estado</p>
                    </div>
                    <div className="p-2 bg-background rounded text-center">
                      <p className="text-lg font-bold text-muted-foreground">{userDataExport.internalMessages.length}</p>
                      <p className="text-muted-foreground">Mensajes internos</p>
                    </div>
                  </div>
                </div>

                {/* Export Info */}
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="text-xs text-primary">
                    Datos exportados el {new Date(userDataExport.exportedAt).toLocaleString('es-MX')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={downloadAsJson}
              disabled={loadingDataExport}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Descargar JSON
            </Button>
            <Button onClick={() => setShowDataExportDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Specialties Dialog */}
      <Dialog open={showSpecialtiesDialog} onOpenChange={setShowSpecialtiesDialog}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              Editar Especialidades
            </DialogTitle>
            <DialogDescription>
              Selecciona todas las especialidades que apliquen a tu perfil
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="grid grid-cols-1 gap-2">
              {SPECIALTIES.map((spec) => {
                const isSelected = selectedSpecialties.includes(spec);
                return (
                  <label
                    key={spec}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSpecialtyToggle(spec)}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <span className={cn(
                      "text-sm",
                      isSelected ? "text-primary font-medium" : "text-foreground"
                    )}>
                      {spec}
                    </span>
                  </label>
                );
              })}
            </div>
          </ScrollArea>

          {selectedSpecialties.length > 0 && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-xs text-primary">
                {selectedSpecialties.length} especialidad{selectedSpecialties.length !== 1 ? 'es' : ''} seleccionada{selectedSpecialties.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSpecialtiesDialog(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveSpecialties}
              disabled={savingSpecialties}
              className="flex-1"
            >
              {savingSpecialties ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm disable medical resource dialog */}
      <Dialog open={!!pendingMedicalDisable} onOpenChange={(open) => !open && setPendingMedicalDisable(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              {pendingMedicalDisable === 'has_first_aid_kit' 
                ? '¿Desactivar botiquín?' 
                : '¿Desactivar ambulancia?'}
            </DialogTitle>
            <DialogDescription>
              {pendingMedicalDisable === 'has_first_aid_kit' 
                ? 'Tu icono en el mapa dejará de mostrar que tienes botiquín disponible. ¿Estás seguro?' 
                : 'Tu icono en el mapa dejará de mostrar que tienes ambulancia disponible. ¿Estás seguro?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setPendingMedicalDisable(null)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (pendingMedicalDisable) {
                  await handleMedicalToggle(pendingMedicalDisable, false);
                  setPendingMedicalDisable(null);
                }
              }}
              disabled={savingMedical}
              className="flex-1"
            >
              {savingMedical ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Sí, desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comprehensive Tutorial */}
      {showTutorial && (
        <ComprehensiveTutorial
          onComplete={() => setShowTutorial(false)}
          onClose={() => setShowTutorial(false)}
        />
      )}

      {/* User Guide Step by Step */}
      {showUserGuide && (
        <UserGuideStepByStep onClose={() => setShowUserGuide(false)} />
      )}

      <AdminPanel
        open={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
      />

      {/* Clave 100 Drill Scheduler - Only for authorized users */}
      <Clave100DrillScheduler
        open={showDrillScheduler}
        onClose={() => setShowDrillScheduler(false)}
      />

      {/* Profile Edit Dialog */}
      <ProfileEditDialog
        open={showProfileEditDialog}
        onClose={() => setShowProfileEditDialog(false)}
        profile={profile}
        onSave={updateProfile}
      />
    </div>
  );
};

export default SettingsScreen;
