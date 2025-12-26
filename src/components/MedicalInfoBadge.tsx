// Medical Info Badge Component
// Shows medical emergency data for a user (visible only to rescatistas)

import React, { useState, useEffect } from 'react';
import { Heart, Droplet, AlertCircle, Pill, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

interface MedicalData {
  blood_type: string | null;
  allergies: string | null;
  medical_conditions: string | null;
  current_medications: string | null;
  emergency_medical_notes: string | null;
}

interface MedicalInfoBadgeProps {
  userId: string;
  isRescatista: boolean;
}

export const MedicalInfoBadge: React.FC<MedicalInfoBadgeProps> = ({
  userId,
  isRescatista,
}) => {
  const [medicalData, setMedicalData] = useState<MedicalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen && isRescatista && !medicalData) {
      fetchMedicalData();
    }
  }, [isOpen, isRescatista, userId]);

  const fetchMedicalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('blood_type, allergies, medical_conditions, current_medications, emergency_medical_notes')
        .eq('id', userId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching medical data:', fetchError);
        setError('No se pudo cargar la información médica');
      } else {
        setMedicalData(data);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  // Only show to rescatistas
  if (!isRescatista) {
    return null;
  }

  const hasMedicalData = medicalData && (
    medicalData.blood_type ||
    medicalData.allergies ||
    medicalData.medical_conditions ||
    medicalData.current_medications ||
    medicalData.emergency_medical_notes
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 border-red-500/50 text-red-500 hover:bg-red-500/10"
        >
          <Heart className="w-3 h-3" />
          Info Médica
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            Información Médica de Emergencia
          </DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : !hasMedicalData ? (
          <div className="text-center py-6">
            <Heart className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Este usuario no ha registrado información médica de emergencia.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {medicalData.blood_type && (
              <div className="flex items-start gap-3 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <Droplet className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Tipo de Sangre</p>
                  <Badge variant="destructive" className="mt-1 text-base font-bold">
                    {medicalData.blood_type}
                  </Badge>
                </div>
              </div>
            )}

            {medicalData.allergies && (
              <div className="flex items-start gap-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Alergias</p>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {medicalData.allergies}
                  </p>
                </div>
              </div>
            )}

            {medicalData.medical_conditions && (
              <div className="flex items-start gap-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <FileText className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Condiciones Médicas</p>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {medicalData.medical_conditions}
                  </p>
                </div>
              </div>
            )}

            {medicalData.current_medications && (
              <div className="flex items-start gap-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <Pill className="w-5 h-5 text-purple-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Medicamentos Actuales</p>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {medicalData.current_medications}
                  </p>
                </div>
              </div>
            )}

            {medicalData.emergency_medical_notes && (
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg border border-border">
                <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Notas Adicionales</p>
                  <p className="text-sm text-foreground mt-1">
                    {medicalData.emergency_medical_notes}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MedicalInfoBadge;
