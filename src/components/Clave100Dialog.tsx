import React, { useState } from 'react';
import { AlertTriangle, Send, Shield, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Clave100DialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Clave100Dialog: React.FC<Clave100DialogProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'initial' | 'compose' | 'sending'>('initial');
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [activeUsersCount, setActiveUsersCount] = useState<number | null>(null);

  // Fetch active users count when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      fetchActiveUsersCount();
      setStep('initial');
      setMessage('');
      setConfirmed(false);
      setDisclosureOpen(false);
    }
  }, [isOpen]);

  const fetchActiveUsersCount = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('user_locations')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', true)
        .gte('updated_at', fiveMinutesAgo);

      if (!error) {
        setActiveUsersCount(count || 0);
      }
    } catch (err) {
      console.error('Error fetching active users count:', err);
    }
  };

  const handleConfirmEmergency = () => {
    if (!confirmed) {
      toast.error('Debes confirmar que es una emergencia real');
      return;
    }
    setStep('compose');
  };

  const handleSendBroadcast = async () => {
    if (!user?.id || !message.trim()) {
      toast.error('Escribe un mensaje para enviar');
      return;
    }

    setStep('sending');

    try {
      // Get all active users (excluding current user)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: activeUsers, error: usersError } = await supabase
        .from('user_locations')
        .select('user_id')
        .eq('is_online', true)
        .gte('updated_at', fiveMinutesAgo)
        .neq('user_id', user.id);

      if (usersError) throw usersError;

      if (!activeUsers || activeUsers.length === 0) {
        toast.error('No hay usuarios activos para notificar');
        setStep('compose');
        return;
      }

      // Create messages for all active users
      const broadcastMessage = `🚨 CLAVE 100 - EMERGENCIA MÁXIMA 🚨\n\n${message.trim()}`;
      
      const messagesToInsert = activeUsers.map(u => ({
        sender_id: user.id,
        receiver_id: u.user_id,
        message: broadcastMessage,
        read: false
      }));

      const { error: insertError } = await supabase
        .from('internal_messages')
        .insert(messagesToInsert);

      if (insertError) throw insertError;

      toast.success(`Mensaje Clave 100 enviado a ${activeUsers.length} usuarios`);
      onClose();
    } catch (error) {
      console.error('Error sending Clave 100 broadcast:', error);
      toast.error('Error al enviar el mensaje');
      setStep('compose');
    }
  };

  const handleClose = () => {
    setStep('initial');
    setMessage('');
    setConfirmed(false);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-6 h-6" />
              CLAVE 100
            </AlertDialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <AlertDialogDescription className="text-left">
            Emergencia Máxima - Mensaje a todos los usuarios activos
          </AlertDialogDescription>
        </AlertDialogHeader>

        {step === 'initial' && (
          <div className="space-y-4">
            {/* Disclosure */}
            <Collapsible open={disclosureOpen} onOpenChange={setDisclosureOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>Información importante</span>
                  </div>
                  <span className="text-xs">{disclosureOpen ? '▲' : '▼'}</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm space-y-2">
                  <p className="font-semibold text-destructive">⚠️ ADVERTENCIA</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Esta función es <strong>ÚNICAMENTE</strong> para casos de <strong>verdadera emergencia</strong>.</li>
                    <li>El mensaje será enviado a <strong>TODOS</strong> los usuarios activos en la comunidad.</li>
                    <li>El uso indebido de esta función puede resultar en la suspensión de tu cuenta.</li>
                    <li>Solo utilízala cuando necesites ayuda urgente o alertar sobre una situación de peligro real.</li>
                  </ul>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Active users indicator */}
            {activeUsersCount !== null && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Users className="w-5 h-5 text-primary" />
                <span className="text-sm">
                  <strong>{activeUsersCount}</strong> usuarios activos recibirán tu mensaje
                </span>
              </div>
            )}

            {/* Confirmation checkbox */}
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Checkbox
                id="confirm-emergency"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
                className="mt-0.5"
              />
              <label 
                htmlFor="confirm-emergency" 
                className="text-sm cursor-pointer select-none"
              >
                Confirmo que esta es una <strong>EMERGENCIA REAL</strong> y entiendo que mi mensaje será enviado a todos los usuarios activos de la comunidad.
              </label>
            </div>

            <Button
              onClick={handleConfirmEmergency}
              disabled={!confirmed}
              className={cn(
                "w-full",
                confirmed 
                  ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" 
                  : "bg-muted text-muted-foreground"
              )}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Confirmar Emergencia
            </Button>
          </div>
        )}

        {step === 'compose' && (
          <div className="space-y-4">
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Tu mensaje será enviado como CLAVE 100
              </p>
            </div>

            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe la emergencia: ¿Qué sucede? ¿Dónde estás? ¿Qué ayuda necesitas?"
              className="min-h-[120px] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length}/500 caracteres
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('initial')}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSendBroadcast}
                disabled={!message.trim()}
                className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                <Send className="w-4 h-4 mr-2" />
                Enviar Clave 100
              </Button>
            </div>
          </div>
        )}

        {step === 'sending' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-12 h-12 border-4 border-destructive border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">
              Enviando mensaje a todos los usuarios...
            </p>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};
