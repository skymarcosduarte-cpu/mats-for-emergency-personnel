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
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';
import QRCode from 'qrcode';

interface SettingsScreenProps {
  onLogout?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onLogout
}) => {
  const { profile, role, signOut } = useAuth();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

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

        {/* Invite Section */}
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
