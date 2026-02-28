import React, { useState, useEffect } from 'react';
import { User, Save, Loader2, Phone, Calendar, AtSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ProfileData {
  full_name: string;
  nickname: string;
  phone: string | null;
  birthday: string | null;
}

interface ProfileEditDialogProps {
  open: boolean;
  onClose: () => void;
  profile: ProfileData | null;
  onSave: (updates: Partial<ProfileData>) => Promise<{ error?: any }>;
}

export const ProfileEditDialog: React.FC<ProfileEditDialogProps> = ({
  open,
  onClose,
  profile,
  onSave,
}) => {
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');

  useEffect(() => {
    if (open && profile) {
      setFullName(profile.full_name || '');
      setNickname(profile.nickname || '');
      setPhone(profile.phone || '');
      setBirthday(profile.birthday || '');
    }
  }, [open, profile]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error('El nombre completo es obligatorio');
      return;
    }
    if (!nickname.trim()) {
      toast.error('El apodo es obligatorio');
      return;
    }

    setSaving(true);
    try {
      const updates: Partial<ProfileData> = {
        full_name: fullName.trim(),
        nickname: nickname.trim(),
        phone: phone.trim() || null,
        birthday: birthday || null,
      };

      const result = await onSave(updates);
      if (result?.error) {
        console.error('Error updating profile:', result.error);
        toast.error('Error al actualizar perfil');
      } else {
        toast.success('Perfil actualizado correctamente');
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Editar Perfil
          </DialogTitle>
          <DialogDescription>
            Modifica tus datos personales.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Full Name */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Nombre completo
            </Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre completo"
              maxLength={100}
              autoComplete="name"
            />
          </div>

          {/* Nickname */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <AtSign className="w-4 h-4" />
              Apodo / Indicativo
            </Label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Tu apodo o indicativo"
              maxLength={50}
              autoComplete="off"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Teléfono
            </Label>
            <Input
              value={phone}
              onChange={(e) =>
                setPhone(
                  e.target.value
                    .replace(/[^\d+]/g, '')
                    .replace(/(?!^)\+/g, '')
                )
              }
              placeholder="+34612345678"
              maxLength={15}
              inputMode="tel"
              autoComplete="tel"
            />
            <p className="text-xs text-muted-foreground">
              Incluye código de país, ej: +34 (España), +52 (México)
            </p>
          </div>

          {/* Birthday */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Fecha de nacimiento
            </Label>
            <Input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
