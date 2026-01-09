import React, { useState, useEffect } from 'react';
import { User, Shield, Save, X, Loader2, Stethoscope, Truck, Dog, Heart, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

// List of specialties (same as in AuthGate)
const SPECIALTIES = [
  'Paramédico',
  'TUM',
  'Médico',
  'Enfermero/a',
  'Bombero',
  'Cruz Roja',
  'Protección Civil',
  'Rescatista',
  'Conductor',
  'Mecánico',
  'Electricista',
  'Comunicaciones/Radio',
  'Psicólogo/a',
  'Cocinero/preparación de alimentos',
  'Logística',
  'Traductor',
  'Jurídico',
  'Otro',
];

interface UserProfile {
  id: string;
  full_name: string;
  nickname: string;
  phone: string;
  specialty: string[];
  has_first_aid_kit: boolean;
  has_ambulance: boolean;
  has_rescue_unit: boolean;
  has_k9_unit: boolean;
  can_provide_medical_assistance: boolean;
}

interface UserRole {
  role: 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR' | 'RESCATISTA';
}

interface UserEditDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onUpdated?: () => void;
}

export const UserEditDialog: React.FC<UserEditDialogProps> = ({
  open,
  onClose,
  userId,
  onUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<string>('FAMILIAR');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [hasFirstAidKit, setHasFirstAidKit] = useState(false);
  const [hasAmbulance, setHasAmbulance] = useState(false);
  const [hasRescueUnit, setHasRescueUnit] = useState(false);
  const [hasK9Unit, setHasK9Unit] = useState(false);
  const [canProvideMedicalAssistance, setCanProvideMedicalAssistance] = useState(false);

  useEffect(() => {
    if (open && userId) {
      fetchUserData();
    }
  }, [open, userId]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        toast.error('Error al cargar perfil');
        return;
      }

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Error fetching role:', roleError);
      }

      setProfile(profileData);
      setRole(roleData?.role || 'FAMILIAR');
      setSelectedSpecialties(profileData.specialty || []);
      setHasFirstAidKit(profileData.has_first_aid_kit || false);
      setHasAmbulance(profileData.has_ambulance || false);
      setHasRescueUnit(profileData.has_rescue_unit || false);
      setHasK9Unit(profileData.has_k9_unit || false);
      setCanProvideMedicalAssistance(profileData.can_provide_medical_assistance || false);
    } finally {
      setLoading(false);
    }
  };

  const handleSpecialtyToggle = (specialty: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(specialty)
        ? prev.filter((s) => s !== specialty)
        : [...prev, specialty]
    );
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          specialty: selectedSpecialties,
          has_first_aid_kit: hasFirstAidKit,
          has_ambulance: hasAmbulance,
          has_rescue_unit: hasRescueUnit,
          has_k9_unit: hasK9Unit,
          can_provide_medical_assistance: canProvideMedicalAssistance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        toast.error('Error al actualizar perfil');
        return;
      }

      // Update role - cast to valid role type
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: role as 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR' | 'RESCATISTA' })
        .eq('user_id', userId);

      if (roleError) {
        console.error('Error updating role:', roleError);
        toast.error('Error al actualizar rol');
        return;
      }

      toast.success('Usuario actualizado correctamente');
      onUpdated?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadgeColor = (r: string) => {
    switch (r) {
      case 'SOS_ACTIVO':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'EX_SOS':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'FAMILIAR':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Editar Usuario
          </DialogTitle>
          <DialogDescription>
            Modifica los atributos del usuario seleccionado.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : profile ? (
          <div className="space-y-6 py-4">
            {/* User info header */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{profile.full_name}</h3>
                  <p className="text-sm text-muted-foreground">@{profile.nickname}</p>
                  <p className="text-xs text-muted-foreground">{profile.phone}</p>
                </div>
              </div>
            </div>

            {/* Role selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Rol
              </Label>
              <Select value={role} onValueChange={(value) => setRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SOS_ACTIVO">
                    <span className="flex items-center gap-2">
                      <Badge className={getRoleBadgeColor('SOS_ACTIVO')}>SOS Activo</Badge>
                      <span className="text-xs text-muted-foreground">- Admin</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="EX_SOS">
                    <span className="flex items-center gap-2">
                      <Badge className={getRoleBadgeColor('EX_SOS')}>Ex SOS</Badge>
                      <span className="text-xs text-muted-foreground">- Miembro</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="FAMILIAR">
                    <span className="flex items-center gap-2">
                      <Badge className={getRoleBadgeColor('FAMILIAR')}>Familiar</Badge>
                      <span className="text-xs text-muted-foreground">- Básico</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Specialties */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4" />
                Especialidades
              </Label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg bg-background">
                {SPECIALTIES.map((specialty) => (
                  <Badge
                    key={specialty}
                    variant={selectedSpecialties.includes(specialty) ? 'default' : 'outline'}
                    className="cursor-pointer transition-all"
                    onClick={() => handleSpecialtyToggle(specialty)}
                  >
                    {specialty}
                  </Badge>
                ))}
              </div>
              {selectedSpecialties.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Seleccionadas: {selectedSpecialties.join(', ')}
                </p>
              )}
            </div>

            {/* Equipment & Capabilities */}
            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Equipo y Capacidades
              </Label>

              <div className="space-y-3 pl-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-red-500" />
                    <span className="text-sm">Botiquín de primeros auxilios</span>
                  </div>
                  <Switch
                    checked={hasFirstAidKit}
                    onCheckedChange={setHasFirstAidKit}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Ambulancia</span>
                  </div>
                  <Switch
                    checked={hasAmbulance}
                    onCheckedChange={setHasAmbulance}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-orange-500" />
                    <span className="text-sm">Unidad de rescate</span>
                  </div>
                  <Switch
                    checked={hasRescueUnit}
                    onCheckedChange={setHasRescueUnit}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Dog className="w-4 h-4 text-amber-500" />
                    <span className="text-sm">Unidad K9</span>
                  </div>
                  <Switch
                    checked={hasK9Unit}
                    onCheckedChange={setHasK9Unit}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm">Puede proporcionar asistencia médica</span>
                  </div>
                  <Switch
                    checked={canProvideMedicalAssistance}
                    onCheckedChange={setCanProvideMedicalAssistance}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No se encontró el usuario
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || !profile}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
