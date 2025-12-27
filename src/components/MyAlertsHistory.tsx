// My Alerts History Component for COMUNIDAD SOS
// Shows user's created help requests with status and details

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, MapPin, CheckCircle2, Loader2, Users, ChevronRight, ExternalLink, Navigation } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getGoogleMapsLink } from '@/hooks/useLocation';
import { AlertDetailModal } from '@/components/AlertDetailModal';

interface MyHelpRequest {
  id: string;
  kind: string;
  lat: number;
  lng: number;
  message: string | null;
  audio_url: string | null;
  audio_duration_ms: number | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  responding_by: string | null;
  responding_started_at: string | null;
  arrived_at: string | null;
  created_at: string;
}

interface ResponderInfo {
  request_id: string;
  count: number;
}

// Map kind to readable label
const KIND_LABELS: Record<string, string> = {
  'AMBULANCIA_PROPIA': 'Ambulancia para mí',
  'AMBULANCIA_TERCERO': 'Ambulancia Tercero',
  'PATRULLA': 'Patrulla',
  'MECANICO': 'Mecánico',
  'PROTECCION_CIVIL': 'Protección Civil',
  'SISMO_AYUDA_14': 'Ayuda por Sismo',
};

const KIND_ICONS: Record<string, string> = {
  'AMBULANCIA_PROPIA': '🚑',
  'AMBULANCIA_TERCERO': '🚑',
  'PATRULLA': '🚔',
  'MECANICO': '🔧',
  'PROTECCION_CIVIL': '🪖',
  'SISMO_AYUDA_14': '🏚️',
};

interface MyAlertsHistoryProps {
  onOpenMessaging?: (userId: string, displayName: string | null) => void;
}

export const MyAlertsHistory: React.FC<MyAlertsHistoryProps> = ({ onOpenMessaging }) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<MyHelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<MyHelpRequest | null>(null);
  const [responderCounts, setResponderCounts] = useState<Map<string, number>>(new Map());
  const [activeResponders, setActiveResponders] = useState<Array<{
    request_id: string;
    responder_id: string;
    responder_lat: number;
    responder_lng: number;
    emergency_lat: number;
    emergency_lng: number;
    responding_started_at: string;
    speed: number | null;
    distance_km: number;
    eta_minutes: number | null;
    arrived_at: string | null;
    transport_mode: string | null;
  }>>([]);

  // Fetch user's alerts
  useEffect(() => {
    if (!user) return;

    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('help_requests')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error fetching my alerts:', error);
          return;
        }

        setAlerts(data || []);

        // Fetch responder counts and details for active alerts
        if (data && data.length > 0) {
          const activeAlertIds = data.filter(a => !a.resolved).map(a => a.id);
          if (activeAlertIds.length > 0) {
            const { data: responders } = await supabase
              .from('help_request_responders')
              .select('*')
              .in('request_id', activeAlertIds);

            if (responders) {
              const counts = new Map<string, number>();
              const responderDetails: Array<{
                request_id: string;
                responder_id: string;
                responder_lat: number;
                responder_lng: number;
                emergency_lat: number;
                emergency_lng: number;
                responding_started_at: string;
                speed: number | null;
                distance_km: number;
                eta_minutes: number | null;
                arrived_at: string | null;
                transport_mode: string | null;
              }> = [];

              responders.forEach((r: any) => {
                counts.set(r.request_id, (counts.get(r.request_id) || 0) + 1);
                
                // Get the alert for this responder
                const alertData = data.find(a => a.id === r.request_id);
                if (alertData) {
                  responderDetails.push({
                    request_id: r.request_id,
                    responder_id: r.user_id,
                    responder_lat: r.lat || 0,
                    responder_lng: r.lng || 0,
                    emergency_lat: alertData.lat,
                    emergency_lng: alertData.lng,
                    responding_started_at: r.started_at,
                    speed: null,
                    distance_km: 0,
                    eta_minutes: r.estimated_eta_minutes,
                    arrived_at: r.arrived_at,
                    transport_mode: r.transport_mode,
                  });
                }
              });
              setResponderCounts(counts);
              setActiveResponders(responderDetails);
            }
          }
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();

    // Subscribe to changes
    const channel = supabase
      .channel('my-alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'help_requests',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!user) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Inicia sesión para ver tu historial</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No has creado alertas</p>
        <p className="text-sm mt-1">Tus alertas SOS aparecerán aquí</p>
      </div>
    );
  }

  const activeAlerts = alerts.filter(a => !a.resolved);
  const resolvedAlerts = alerts.filter(a => a.resolved);

  return (
    <div className="space-y-4">
      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-panic animate-pulse" />
            Alertas Activas ({activeAlerts.length})
          </h3>
          {activeAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              responderCount={responderCounts.get(alert.id) || 0}
              onClick={() => setSelectedAlert(alert)}
            />
          ))}
        </div>
      )}

      {/* Resolved Alerts */}
      {resolvedAlerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            Resueltas ({resolvedAlerts.length})
          </h3>
          {resolvedAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              responderCount={0}
              onClick={() => setSelectedAlert(alert)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedAlert && (
        <AlertDetailModal
          isOpen={!!selectedAlert}
          onClose={() => setSelectedAlert(null)}
          alert={{
            id: selectedAlert.id,
            user_id: user.id,
            kind: selectedAlert.kind,
            lat: selectedAlert.lat,
            lng: selectedAlert.lng,
            message: selectedAlert.message,
            audio_url: selectedAlert.audio_url,
            audio_duration_ms: selectedAlert.audio_duration_ms,
            resolved: selectedAlert.resolved || false,
            created_at: selectedAlert.created_at,
            responding_by: selectedAlert.responding_by,
            responding_started_at: selectedAlert.responding_started_at,
            arrived_at: selectedAlert.arrived_at,
          }}
          alertType="help"
          onViewLocation={(lat, lng) => {
            window.open(getGoogleMapsLink(lat, lng), '_blank');
          }}
          isOwner={true}
          isRescatista={false}
          currentUserId={user.id}
          responders={activeResponders}
          onOpenMessaging={onOpenMessaging}
          onResolve={async () => {
            const { error } = await supabase
              .from('help_requests')
              .update({ resolved: true, resolved_at: new Date().toISOString() })
              .eq('id', selectedAlert.id);

            if (!error) {
              setAlerts(prev => prev.map(a => 
                a.id === selectedAlert.id 
                  ? { ...a, resolved: true, resolved_at: new Date().toISOString() }
                  : a
              ));
              setSelectedAlert(null);
            }
            return !error;
          }}
        />
      )}
    </div>
  );
};

// Alert Card Component
interface AlertCardProps {
  alert: MyHelpRequest;
  responderCount: number;
  onClick: () => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert, responderCount, onClick }) => {
  const isActive = !alert.resolved;
  const timeAgo = formatDistanceToNow(new Date(alert.created_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <Card
      className={cn(
        "bg-card border-border transition-all cursor-pointer hover:border-primary/30",
        isActive && "border-panic/30 bg-panic/5"
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">
                {KIND_ICONS[alert.kind] || '🆘'}
              </span>
              <span className="font-medium text-foreground truncate">
                {KIND_LABELS[alert.kind] || alert.kind}
              </span>
              {isActive ? (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  Activa
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-success border-success/30">
                  Resuelta
                </Badge>
              )}
            </div>

            {/* Message preview */}
            {alert.message && (
              <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
                {alert.message}
              </p>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo}
              </span>
              
              {isActive && responderCount > 0 && (
                <span className="flex items-center gap-1 text-success">
                  <Users className="w-3 h-3" />
                  {responderCount} en camino
                </span>
              )}

              {alert.resolved_at && (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="w-3 h-3" />
                  Resuelta
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                window.open(getGoogleMapsLink(alert.lat, alert.lng), '_blank');
              }}
            >
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </Button>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MyAlertsHistory;
