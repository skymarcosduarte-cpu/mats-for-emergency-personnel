// Floating banner for user's active panic alerts
// Shows when user has an unresolved panic event and allows instant cancellation

import React, { useState, useEffect, useCallback } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ActivePanicEvent {
  id: string;
  panic_type: string;
  created_at: string;
}

const PANIC_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  'AMBULANCIA_PROPIA': { label: 'Ambulancia', emoji: '🚑' },
  'AMBULANCIA_TERCERO': { label: 'Ambulancia', emoji: '🚑' },
  'PATRULLA': { label: 'Patrulla', emoji: '🚔' },
  'MECANICO': { label: 'Mecánico', emoji: '🔧' },
  'PROTECCION_CIVIL': { label: 'Protección Civil', emoji: '🆘' },
};

export const ActiveAlertBanner: React.FC = () => {
  const { user } = useAuth();
  const [activeAlert, setActiveAlert] = useState<ActivePanicEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Fetch user's active panic events
  const fetchActiveAlert = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('panic_events')
        .select('id, panic_type, created_at')
        .eq('user_id', user.id)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('[ActiveAlertBanner] Error fetching:', error);
      }

      setActiveAlert(data || null);
    } catch (err) {
      console.error('[ActiveAlertBanner] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Cancel/resolve the active alert
  const handleCancelAlert = async () => {
    if (!activeAlert) return;

    console.log('[ActiveAlertBanner] Cancelling alert:', activeAlert.id);
    setCancelling(true);

    try {
      const { error } = await supabase
        .from('panic_events')
        .update({ 
          resolved: true, 
          resolved_at: new Date().toISOString() 
        })
        .eq('id', activeAlert.id);

      if (error) {
        console.error('[ActiveAlertBanner] Cancel error:', error);
        toast.error('Error al cancelar la alerta');
        // Error sound
        try {
          const errorAudio = new Audio('/alert-sound.mp3');
          errorAudio.volume = 0.3;
          errorAudio.playbackRate = 0.7;
          errorAudio.play().catch(() => {});
        } catch {}
        return;
      }

      toast.success('Alerta cancelada correctamente');
      setActiveAlert(null);
      
      // Success sound - a quick confirmation beep
      try {
        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = 880; // A5 note
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        oscillator.stop(audioCtx.currentTime + 0.15);
        
        // Second beep (higher)
        setTimeout(() => {
          const osc2 = audioCtx.createOscillator();
          const gain2 = audioCtx.createGain();
          osc2.connect(gain2);
          gain2.connect(audioCtx.destination);
          osc2.frequency.value = 1318; // E6 note
          osc2.type = 'sine';
          gain2.gain.value = 0.3;
          osc2.start();
          gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
          osc2.stop(audioCtx.currentTime + 0.2);
        }, 100);
      } catch {
        // Fallback: ignore audio errors
      }
      
      // Vibrate to confirm
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 50, 50]);
      }
    } catch (err) {
      console.error('[ActiveAlertBanner] Cancel exception:', err);
      toast.error('Error inesperado al cancelar');
    } finally {
      setCancelling(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetchActiveAlert();
  }, [fetchActiveAlert]);

  // Subscribe to real-time updates for user's panic events
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user-panic-events-${user.id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'panic_events',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          console.log('[ActiveAlertBanner] Panic event change detected');
          fetchActiveAlert();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchActiveAlert]);

  // Don't show if no active alert or still loading
  if (loading || !activeAlert) return null;

  const typeInfo = PANIC_TYPE_LABELS[activeAlert.panic_type] || { label: 'Emergencia', emoji: '🆘' };
  const createdAt = new Date(activeAlert.created_at);
  const timeAgo = Math.round((Date.now() - createdAt.getTime()) / 60000); // minutes

  return (
    <div 
      className={cn(
        "fixed top-16 left-2 right-2 z-[9999]",
        "bg-destructive text-destructive-foreground",
        "rounded-lg shadow-lg border border-destructive/50",
        "p-3 flex items-center gap-3",
        "animate-in slide-in-from-top-2 duration-300",
        "touch-manipulation"
      )}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Pulsing indicator */}
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 bg-destructive-foreground/30 rounded-full animate-ping" />
        <div className="relative w-10 h-10 bg-destructive-foreground/20 rounded-full flex items-center justify-center">
          <span className="text-xl">{typeInfo.emoji}</span>
        </div>
      </div>

      {/* Alert info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold truncate">Tu alerta activa</span>
        </div>
        <p className="text-sm opacity-90 truncate">
          {typeInfo.label} • hace {timeAgo} min
        </p>
      </div>

      {/* Cancel button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleCancelAlert}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleCancelAlert();
        }}
        disabled={cancelling}
        className={cn(
          "flex-shrink-0 bg-destructive-foreground text-destructive",
          "hover:bg-destructive-foreground/90",
          "font-semibold px-4",
          "touch-manipulation"
        )}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {cancelling ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <X className="w-4 h-4 mr-1" />
            Cancelar
          </>
        )}
      </Button>
    </div>
  );
};
