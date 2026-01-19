// Floating banner for user's active panic alerts and help requests
// Shows when user has an unresolved alert and allows instant cancellation
// Also supports test mode for simulating alerts without database

import React, { useState, useEffect, useCallback } from 'react';
import { X, AlertTriangle, Loader2, FlaskConical, Navigation, Users, MessageCircle, Share2 } from 'lucide-react';
import { ShareToWhatsAppGroupButton } from './ShareToWhatsAppGroupButton';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { TestPanicAlert } from '@/hooks/useTestMode';

interface ActiveAlert {
  id: string;
  type: 'panic' | 'help';
  alert_type: string; // panic_type or kind
  created_at: string;
  lat?: number;
  lng?: number;
  message?: string | null;
}

const PANIC_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  'AMBULANCIA_PROPIA': { label: 'Ambulancia para mí', emoji: '🚑' },
  'AMBULANCIA_TERCERO': { label: 'Ambulancia', emoji: '🚑' },
  'PATRULLA': { label: 'Patrulla', emoji: '🚔' },
  'MECANICO': { label: 'Mecánico', emoji: '🔧' },
  'PROTECCION_CIVIL': { label: 'Protección Civil', emoji: '🆘' },
  'SISMO_AYUDA_14': { label: 'Ayuda por Sismo', emoji: '🏚️' },
};

interface ResponderInfo {
  user_id: string;
  nickname: string;
}

interface ActiveAlertBannerProps {
  testAlert?: TestPanicAlert | null;
  onClearTestAlert?: () => void;
  refreshTrigger?: number; // Trigger refetch when this changes
  responderCount?: number; // Number of responders to user's alert
  onViewResponders?: () => void; // Callback to open responder tracking map
  onMessageResponder?: (userId: string, nickname: string) => void; // Callback to open chat with responder
  responders?: ResponderInfo[]; // List of responders to show chat buttons
}

export const ActiveAlertBanner: React.FC<ActiveAlertBannerProps> = ({
  testAlert,
  onClearTestAlert,
  refreshTrigger,
  responderCount = 0,
  onViewResponders,
  onMessageResponder,
  responders = [],
}) => {
  const { user } = useAuth();
  const [activeAlert, setActiveAlert] = useState<ActiveAlert | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Fetch user's active panic events AND help requests
  const fetchActiveAlert = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Check panic_events first
      const { data: panicData, error: panicError } = await supabase
        .from('panic_events')
        .select('id, panic_type, created_at, lat, lng, message')
        .eq('user_id', user.id)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (panicError) {
        console.error('[ActiveAlertBanner] Error fetching panic:', panicError);
      }

      if (panicData) {
        setActiveAlert({
          id: panicData.id,
          type: 'panic',
          alert_type: panicData.panic_type,
          created_at: panicData.created_at,
          lat: panicData.lat,
          lng: panicData.lng,
          message: panicData.message,
        });
        return;
      }

      // Check help_requests if no panic event found
      const { data: helpData, error: helpError } = await supabase
        .from('help_requests')
        .select('id, kind, created_at, lat, lng, message')
        .eq('user_id', user.id)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (helpError) {
        console.error('[ActiveAlertBanner] Error fetching help:', helpError);
      }

      if (helpData) {
        setActiveAlert({
          id: helpData.id,
          type: 'help',
          alert_type: helpData.kind,
          created_at: helpData.created_at,
          lat: helpData.lat,
          lng: helpData.lng,
          message: helpData.message,
        });
      } else {
        setActiveAlert(null);
      }
    } catch (err) {
      console.error('[ActiveAlertBanner] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Cancel/resolve the active alert
  const handleCancelAlert = async () => {
    // Handle test alert separately
    if (testAlert) {
      setCancelling(true);
      // Simulate cancellation with sound and vibration
      try {
        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = 880;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        oscillator.stop(audioCtx.currentTime + 0.15);
        
        setTimeout(() => {
          const osc2 = audioCtx.createOscillator();
          const gain2 = audioCtx.createGain();
          osc2.connect(gain2);
          gain2.connect(audioCtx.destination);
          osc2.frequency.value = 1318;
          osc2.type = 'sine';
          gain2.gain.value = 0.3;
          osc2.start();
          gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
          osc2.stop(audioCtx.currentTime + 0.2);
        }, 100);
      } catch {
        // Ignore audio errors
      }
      
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 50, 50]);
      }
      
      toast.success('✅ Alerta de prueba cancelada');
      onClearTestAlert?.();
      setCancelling(false);
      return;
    }

    if (!activeAlert) return;

    console.log('[ActiveAlertBanner] Cancelling alert:', activeAlert.id, activeAlert.type);
    setCancelling(true);

    try {
      // First, get responders to notify them about the cancellation
      let responderIds: string[] = [];
      
      if (activeAlert.type === 'panic') {
        const { data: responders } = await supabase
          .from('panic_event_responders')
          .select('user_id')
          .eq('panic_id', activeAlert.id);
        responderIds = responders?.map(r => r.user_id) || [];
      } else {
        const { data: responders } = await supabase
          .from('help_request_responders')
          .select('user_id')
          .eq('request_id', activeAlert.id);
        responderIds = responders?.map(r => r.user_id) || [];
      }

      // Cancel from the correct table based on alert type
      const { error } = activeAlert.type === 'panic' 
        ? await supabase
            .from('panic_events')
            .update({ resolved: true, resolved_at: new Date().toISOString() })
            .eq('id', activeAlert.id)
        : await supabase
            .from('help_requests')
            .update({ resolved: true, resolved_at: new Date().toISOString() })
            .eq('id', activeAlert.id);

      if (error) {
        console.error('[ActiveAlertBanner] Cancel error:', error);
        toast.error('Error al cancelar la alerta');
        try {
          const errorAudio = new Audio('/alert-sound.mp3');
          errorAudio.volume = 0.3;
          errorAudio.playbackRate = 0.7;
          errorAudio.play().catch(() => {});
        } catch {}
        setCancelling(false);
        return;
      }

      // Notify responders that the alert was cancelled
      if (responderIds.length > 0) {
        supabase.functions.invoke('notify-responder-coming', {
          body: {
            alertId: activeAlert.id,
            alertType: activeAlert.type,
            eventType: 'cancelled',
            targetUserIds: responderIds
          }
        }).catch(err => console.warn('Failed to notify responders of cancellation:', err));
      }

      toast.success('Alerta cancelada correctamente');
      setActiveAlert(null);
      
      // Success sound
      try {
        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = 880;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        oscillator.stop(audioCtx.currentTime + 0.15);
        
        setTimeout(() => {
          const osc2 = audioCtx.createOscillator();
          const gain2 = audioCtx.createGain();
          osc2.connect(gain2);
          gain2.connect(audioCtx.destination);
          osc2.frequency.value = 1318;
          osc2.type = 'sine';
          gain2.gain.value = 0.3;
          osc2.start();
          gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
          osc2.stop(audioCtx.currentTime + 0.2);
        }, 100);
      } catch {
        // Ignore audio errors
      }
      
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

  // Initial fetch and refetch on trigger
  useEffect(() => {
    setLoading(true);
    fetchActiveAlert();
  }, [fetchActiveAlert, refreshTrigger]);

  // Subscribe to real-time updates for user's panic events and help requests
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user-alerts-${user.id}`)
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
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'help_requests',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          console.log('[ActiveAlertBanner] Help request change detected');
          fetchActiveAlert();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchActiveAlert]);

  // Determine which alert to show (test alert takes priority for visibility)
  const displayAlert = testAlert || activeAlert;
  const isTestAlert = !!testAlert;

  // Don't show if no active alert or still loading
  if (loading && !testAlert) return null;
  if (!displayAlert) return null;

  const alertType = isTestAlert ? (testAlert as TestPanicAlert).panic_type : (activeAlert as ActiveAlert).alert_type;
  const typeInfo = PANIC_TYPE_LABELS[alertType] || { label: 'Emergencia', emoji: '🆘' };
  const createdAt = new Date(displayAlert.created_at);
  const timeAgo = Math.round((Date.now() - createdAt.getTime()) / 60000);

  return (
    <div 
      className={cn(
        "fixed top-16 left-2 right-2 z-[9999]",
        isTestAlert 
          ? "bg-warning text-warning-foreground"
          : "bg-destructive text-destructive-foreground",
        "rounded-lg shadow-lg border",
        isTestAlert ? "border-warning/50" : "border-destructive/50",
        "p-3 flex items-center gap-3",
        "animate-in slide-in-from-top-2 duration-300",
        "touch-manipulation"
      )}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Pulsing indicator */}
      <div className="relative flex-shrink-0">
        <div className={cn(
          "absolute inset-0 rounded-full animate-ping",
          isTestAlert ? "bg-warning-foreground/30" : "bg-destructive-foreground/30"
        )} />
        <div className={cn(
          "relative w-10 h-10 rounded-full flex items-center justify-center",
          isTestAlert ? "bg-warning-foreground/20" : "bg-destructive-foreground/20"
        )}>
          {isTestAlert ? (
            <FlaskConical className="w-5 h-5" />
          ) : (
            <span className="text-xl">{typeInfo.emoji}</span>
          )}
        </div>
      </div>

      {/* Alert info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="font-semibold truncate">
            {isTestAlert ? '🧪 PRUEBA - Tu alerta' : 'Tu alerta activa'}
          </span>
        </div>
        <p className="text-sm opacity-90 truncate">
          {typeInfo.label} • hace {timeAgo} min
          {responderCount > 0 && !isTestAlert && (
            <span className="ml-2 font-medium">• {responderCount} rescatista{responderCount > 1 ? 's' : ''} 🚀</span>
          )}
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 flex-shrink-0">
        {/* WhatsApp share button - always show when there's location */}
        {activeAlert?.lat && activeAlert?.lng && !isTestAlert && (
          <ShareToWhatsAppGroupButton
            alertType={activeAlert.alert_type}
            lat={activeAlert.lat}
            lng={activeAlert.lng}
            message={activeAlert.message || undefined}
            size="sm"
            className="px-2"
          />
        )}
        {/* Chat button - only show if there are responders */}
        {responderCount > 0 && onMessageResponder && responders.length > 0 && !isTestAlert && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const firstResponder = responders[0];
              if (firstResponder) {
                onMessageResponder(firstResponder.user_id, firstResponder.nickname);
              }
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              const firstResponder = responders[0];
              if (firstResponder) {
                onMessageResponder(firstResponder.user_id, firstResponder.nickname);
              }
            }}
            className="font-semibold px-3 touch-manipulation border-0 bg-primary text-primary-foreground hover:bg-primary/90"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <MessageCircle className="w-4 h-4" />
          </Button>
        )}

        {/* View responders button - only show if there are responders */}
        {responderCount > 0 && onViewResponders && !isTestAlert && (
          <Button
            variant="outline"
            size="sm"
            onClick={onViewResponders}
            onTouchEnd={(e) => {
              e.preventDefault();
              onViewResponders();
            }}
            className="font-semibold px-3 touch-manipulation border-0 bg-green-600 text-white hover:bg-green-700"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <Users className="w-4 h-4 mr-1" />
            Ver
          </Button>
        )}

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
            "font-semibold px-4 touch-manipulation border-0",
            isTestAlert 
              ? "bg-black text-white hover:bg-black/80"
              : "bg-white text-destructive hover:bg-white/90"
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
    </div>
  );
};
