// Clave 100 Drill Scheduler Component
// Only accessible by authorized users (Zombie and El Lagarto)

import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  AlertTriangle, 
  Users, 
  Check, 
  Loader2,
  Bell,
  Trash2,
  Info
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, addHours, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Authorized user IDs
const AUTHORIZED_USER_IDS = [
  '7c823685-369d-4f62-8459-80486832ba1a', // Zombie
  '0e0d5ee7-628d-4a98-af26-b60ede2536ce', // El Lagarto
];

interface ScheduledDrill {
  id: string;
  scheduled_at: string;
  created_at: string;
  status: string;
  notified_users: number | null;
  creator_id: string;
}

interface Clave100DrillSchedulerProps {
  open: boolean;
  onClose: () => void;
}

export const Clave100DrillScheduler: React.FC<Clave100DrillSchedulerProps> = ({
  open,
  onClose,
}) => {
  const { user, profile } = useAuth();
  const [step, setStep] = useState<'list' | 'schedule' | 'confirm'>('list');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState('12:00');
  const [scheduledDrills, setScheduledDrills] = useState<ScheduledDrill[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [activeUsersCount, setActiveUsersCount] = useState(0);

  const isAuthorized = user && AUTHORIZED_USER_IDS.includes(user.id);

  // Fetch scheduled drills
  useEffect(() => {
    if (open && isAuthorized) {
      fetchDrills();
      fetchActiveUsersCount();
    }
  }, [open, isAuthorized]);

  const fetchDrills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clave100_drills')
        .select('*')
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      setScheduledDrills((data || []) as ScheduledDrill[]);
    } catch (error) {
      console.error('[Clave100DrillScheduler] Error fetching drills:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveUsersCount = async () => {
    try {
      const { count } = await supabase
        .from('user_locations')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      setActiveUsersCount(count || 0);
    } catch (error) {
      console.error('[Clave100DrillScheduler] Error fetching active users:', error);
    }
  };

  const handleScheduleDrill = async () => {
    if (!selectedDate || !user) return;

    // Combine date and time
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(hours, minutes, 0, 0);

    // Validate 6 hours in advance
    const minScheduleTime = addHours(new Date(), 6);
    if (isBefore(scheduledAt, minScheduleTime)) {
      toast.error('El simulacro debe programarse con al menos 6 horas de anticipación');
      return;
    }

    setScheduling(true);
    try {
      // Insert the drill
      const { data: drill, error: insertError } = await supabase
        .from('clave100_drills')
        .insert({
          creator_id: user.id,
          scheduled_at: scheduledAt.toISOString(),
          status: 'scheduled'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Trigger email notifications
      const { error: notifyError } = await supabase.functions.invoke('send-drill-notifications', {
        body: {
          drill_id: drill.id,
          scheduled_at: scheduledAt.toISOString(),
          creator_id: user.id
        }
      });

      if (notifyError) {
        console.error('[Clave100DrillScheduler] Error sending notifications:', notifyError);
        toast.warning('Simulacro programado, pero hubo un error enviando notificaciones');
      } else {
        toast.success('¡Simulacro programado exitosamente!', {
          description: `Se notificará a todos los usuarios por email y mensaje interno.`
        });
      }

      // Refresh list and go back
      await fetchDrills();
      setStep('list');
      setSelectedDate(undefined);
      setSelectedTime('12:00');

    } catch (error) {
      console.error('[Clave100DrillScheduler] Error scheduling drill:', error);
      toast.error('Error al programar el simulacro');
    } finally {
      setScheduling(false);
    }
  };

  const handleCancelDrill = async (drillId: string) => {
    try {
      const { error } = await supabase
        .from('clave100_drills')
        .update({ status: 'cancelled' })
        .eq('id', drillId);

      if (error) throw error;

      toast.success('Simulacro cancelado');
      await fetchDrills();
    } catch (error) {
      console.error('[Clave100DrillScheduler] Error cancelling drill:', error);
      toast.error('Error al cancelar el simulacro');
    }
  };

  const handleClose = () => {
    setStep('list');
    setSelectedDate(undefined);
    setSelectedTime('12:00');
    onClose();
  };

  if (!isAuthorized) {
    return null;
  }

  const upcomingDrills = scheduledDrills.filter(d => 
    d.status === 'scheduled' && isAfter(new Date(d.scheduled_at), new Date())
  );
  const pastDrills = scheduledDrills.filter(d => 
    d.status !== 'scheduled' || isBefore(new Date(d.scheduled_at), new Date())
  );

  return (
    <Dialog
      open={open}
      modal={false}
      onOpenChange={(isOpen) => !isOpen && handleClose()}
    >
      <DialogContent
        className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto"
        // Evita que el diálogo se cierre/robe el foco al interactuar con el calendario
        onPointerDownOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500">
            <Bell className="w-5 h-5" />
            Simulacro Clave 100
          </DialogTitle>
          <DialogDescription>
            Programa simulacros de emergencia para la comunidad
          </DialogDescription>
        </DialogHeader>

        {step === 'list' && (
          <div className="space-y-4">
            {/* Info Card */}
            <Card className="bg-amber-500/10 border-amber-500/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-200">
                    <p className="font-medium mb-1">Información</p>
                    <ul className="list-disc list-inside space-y-1 text-amber-200/80">
                      <li>Los simulacros deben programarse con 6+ horas de anticipación</li>
                      <li>Todos los usuarios recibirán un email y mensaje interno</li>
                      <li>Durante el simulacro, aparecerá un banner especial</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Users Count */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Usuarios activos (7 días)</span>
              </div>
              <Badge variant="secondary">{activeUsersCount}</Badge>
            </div>

            {/* Upcoming Drills */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Simulacros Programados</h3>
              {loading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : upcomingDrills.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay simulacros programados
                </p>
              ) : (
                upcomingDrills.map(drill => (
                  <Card key={drill.id} className="bg-muted/30">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-amber-400">
                            {format(new Date(drill.scheduled_at), "PPP 'a las' HH:mm", { locale: es })}
                          </p>
                          {drill.notified_users && (
                            <p className="text-xs text-muted-foreground">
                              {drill.notified_users} emails enviados
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleCancelDrill(drill.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Past Drills */}
            {pastDrills.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Historial</h3>
                {pastDrills.slice(0, 5).map(drill => (
                  <Card key={drill.id} className="bg-muted/20 opacity-60">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm">
                            {format(new Date(drill.scheduled_at), "PPP HH:mm", { locale: es })}
                          </p>
                          <Badge 
                            variant={drill.status === 'completed' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {drill.status === 'completed' ? 'Completado' : 
                             drill.status === 'cancelled' ? 'Cancelado' : 'Pasado'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Schedule Button */}
            <Button
              className="w-full bg-amber-600 hover:bg-amber-700"
              onClick={() => setStep('schedule')}
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Programar Nuevo Simulacro
            </Button>
          </div>
        )}

        {step === 'schedule' && (
          <div className="space-y-4">
            {/* Date Picker */}
            <div className="space-y-2">
              <Label>Fecha del simulacro</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? (
                      format(selectedDate, "PPP", { locale: es })
                    ) : (
                      "Seleccionar fecha"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 z-[10050] bg-popover border border-border"
                  style={{ zIndex: 10050 }}
                  align="start"
                  sideOffset={4}
                >
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => {
                      const startOfToday = new Date();
                      startOfToday.setHours(0, 0, 0, 0);
                      return isBefore(date, startOfToday);
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time Picker */}
            <div className="space-y-2">
              <Label>Hora del simulacro</Label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Preview */}
            {selectedDate && (
              <Card className="bg-amber-500/10 border-amber-500/30">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Simulacro programado para:</p>
                  <p className="text-lg font-bold text-amber-400">
                    {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                  <p className="text-2xl font-bold text-amber-500">{selectedTime}</p>
                </CardContent>
              </Card>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('list')}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => setStep('confirm')}
                disabled={!selectedDate}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                Continuar
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'confirm' && selectedDate && (
          <div className="space-y-4">
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive mb-2">Confirmar Simulacro</p>
                    <p className="text-muted-foreground">
                      Estás a punto de programar un simulacro de Clave 100 para:
                    </p>
                    <p className="font-bold text-amber-400 mt-2">
                      {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })} a las {selectedTime}
                    </p>
                    <p className="text-muted-foreground mt-2">
                      Esto enviará un email y mensaje interno a <strong>{activeUsersCount}</strong> usuarios activos.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('schedule')}
                disabled={scheduling}
                className="flex-1"
              >
                Volver
              </Button>
              <Button
                onClick={handleScheduleDrill}
                disabled={scheduling}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                {scheduling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Programando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Confirmar Simulacro
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Clave100DrillScheduler;
