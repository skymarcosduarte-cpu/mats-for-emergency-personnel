// Home Dashboard Screen for M.A.T.S.
// Welcome screen with user greeting, online users count, and main section icons

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Map, 
  Activity, 
  Car, 
  HeartPulse, 
  Users, 
  Settings,
  ChevronRight,
  AlertTriangle,
  MapPin,
  Navigation,
  X,
  MapPinned
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from '@/hooks/useLocation';
import { useCurrentWeather } from '@/hooks/useCurrentWeather';
import { supabase } from '@/integrations/supabase/client';
import type { TabId } from '@/components/BottomNavigation';
import { Button } from '@/components/ui/button';

interface HomeScreenProps {
  onNavigate: (tab: TabId) => void;
}

interface SectionItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
  gradient: string;
  iconBg: string;
}

const SECTIONS: SectionItem[] = [
  { 
    id: 'map', 
    label: 'Mapa', 
    icon: <Map className="w-12 h-12" strokeWidth={2.5} />,
    description: 'Ver ubicaciones en tiempo real',
    gradient: 'bg-card section-card-map',
    iconBg: 'section-icon-map'
  },
  { 
    id: 'alerts', 
    label: 'Sismos', 
    icon: <Activity className="w-12 h-12" strokeWidth={2.5} />,
    description: 'Alertas sísmicas y reportes',
    gradient: 'bg-card section-card-alerts',
    iconBg: 'section-icon-alerts'
  },
  { 
    id: 'transit', 
    label: 'Tránsito Seguro', 
    icon: <Car className="w-12 h-12" strokeWidth={2.5} />,
    description: 'Registrar y monitorear viajes',
    gradient: 'bg-card section-card-transit',
    iconBg: 'section-icon-transit'
  },
  { 
    id: 'resources', 
    label: 'RecurSOS', 
    icon: <HeartPulse className="w-12 h-12" strokeWidth={2.5} />,
    description: 'Recursos de emergencia',
    gradient: 'bg-card section-card-resources',
    iconBg: 'section-icon-resources'
  },
  { 
    id: 'community', 
    label: 'Comunidad', 
    icon: <Users className="w-12 h-12" strokeWidth={2.5} />,
    description: 'Tablero y noticias',
    gradient: 'bg-card section-card-community',
    iconBg: 'section-icon-community'
  },
  { 
    id: 'settings', 
    label: 'Ajustes', 
    icon: <Settings className="w-12 h-12" strokeWidth={2.5} />,
    description: 'Configuración y perfil',
    gradient: 'bg-card section-card-settings',
    iconBg: 'section-icon-settings'
  },
];

// Types for emergency alerts
interface EmergencyAlert {
  id: string;
  type: 'panic' | 'help';
  panicType?: string;
  helpKind?: string;
  lat: number;
  lng: number;
  message?: string;
  creatorName: string;
  createdAt: Date;
}

const PANIC_LABELS: Record<string, { label: string; emoji: string }> = {
  medical: { label: 'Emergencia Médica', emoji: '🏥' },
  fire: { label: 'Incendio', emoji: '🔥' },
  assault: { label: 'Asalto', emoji: '🚨' },
  accident: { label: 'Accidente', emoji: '💥' },
  natural: { label: 'Desastre Natural', emoji: '🌊' },
  other: { label: 'Emergencia', emoji: '⚠️' },
};

const HELP_LABELS: Record<string, { label: string; emoji: string }> = {
  medical: { label: 'Ayuda Médica', emoji: '🏥' },
  mechanical: { label: 'Ayuda Mecánica', emoji: '🔧' },
  fuel: { label: 'Sin Combustible', emoji: '⛽' },
  directions: { label: 'Orientación', emoji: '🧭' },
  other: { label: 'Ayuda', emoji: '🆘' },
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const { profile, user } = useAuth();
  const { position } = useLocation();
  const { weather, loading: weatherLoading } = useCurrentWeather(
    position?.lat ?? null,
    position?.lng ?? null
  );
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Fetch online users count
  const fetchOnlineCount = useCallback(async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('user_locations')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', true)
        .gte('updated_at', fiveMinutesAgo);
      
      if (!error && count !== null) {
        setOnlineCount(count);
      }
    } catch (e) {
      console.error('[HomeScreen] Error fetching online count:', e);
    }
  }, []);

  // Fetch active emergency alerts
  const fetchEmergencyAlerts = useCallback(async () => {
    try {
      // Fetch active panic events (not resolved, within last 2 hours)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      
      const [panicResult, helpResult] = await Promise.all([
        supabase
          .from('panic_events')
          .select(`
            id, panic_type, lat, lng, message, created_at, user_id,
            profiles_public!panic_events_user_id_fkey(nickname, full_name)
          `)
          .eq('resolved', false)
          .gte('created_at', twoHoursAgo)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('help_requests')
          .select(`
            id, kind, lat, lng, message, created_at, user_id,
            profiles_public!help_requests_user_id_fkey(nickname, full_name)
          `)
          .eq('resolved', false)
          .gte('created_at', twoHoursAgo)
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      const alerts: EmergencyAlert[] = [];

      // Process panic events
      if (panicResult.data) {
        for (const event of panicResult.data) {
          // Skip own alerts
          if (event.user_id === user?.id) continue;
          
          const profileData = event.profiles_public as any;
          alerts.push({
            id: `panic-${event.id}`,
            type: 'panic',
            panicType: event.panic_type,
            lat: event.lat,
            lng: event.lng,
            message: event.message || undefined,
            creatorName: profileData?.nickname || profileData?.full_name || 'Usuario',
            createdAt: new Date(event.created_at),
          });
        }
      }

      // Process help requests
      if (helpResult.data) {
        for (const req of helpResult.data) {
          // Skip own alerts
          if (req.user_id === user?.id) continue;
          
          const profileData = req.profiles_public as any;
          alerts.push({
            id: `help-${req.id}`,
            type: 'help',
            helpKind: req.kind,
            lat: req.lat,
            lng: req.lng,
            message: req.message || undefined,
            creatorName: profileData?.nickname || profileData?.full_name || 'Usuario',
            createdAt: new Date(req.created_at),
          });
        }
      }

      // Sort by most recent
      alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setEmergencyAlerts(alerts);
    } catch (e) {
      console.error('[HomeScreen] Error fetching emergency alerts:', e);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchOnlineCount();
    fetchEmergencyAlerts();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchOnlineCount();
      fetchEmergencyAlerts();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchOnlineCount, fetchEmergencyAlerts]);

  // Subscribe to realtime updates for panic events and help requests
  useEffect(() => {
    const channel = supabase
      .channel('home-emergency-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'panic_events' }, () => {
        fetchEmergencyAlerts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'help_requests' }, () => {
        fetchEmergencyAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEmergencyAlerts]);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  };

  // Get user's first name
  const firstName = profile?.full_name?.split(' ')[0] || profile?.nickname || 'Usuario';

  // Format today's date
  const todayDate = format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es });

  // Filter out dismissed alerts
  const activeAlerts = emergencyAlerts.filter(a => !dismissedAlerts.has(a.id));

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
  };

  const openGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  const navigateToLocation = (lat: number, lng: number) => {
    // Use Google Maps navigation URL for directions
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank');
  };

  const getAlertInfo = (alert: EmergencyAlert) => {
    if (alert.type === 'panic') {
      const info = PANIC_LABELS[alert.panicType || 'other'] || PANIC_LABELS.other;
      return { ...info, isPanic: true };
    }
    const info = HELP_LABELS[alert.helpKind || 'other'] || HELP_LABELS.other;
    return { ...info, isPanic: false };
  };

  return (
    <div className="flex-1 overflow-auto pb-20">
      <div className="px-4 pt-4 space-y-6">
        {/* Emergency Alerts Banner */}
        {activeAlerts.length > 0 && (
          <div className="space-y-2">
            {activeAlerts.slice(0, 3).map((alert) => {
              const info = getAlertInfo(alert);
              return (
                <div 
                  key={alert.id}
                  className={cn(
                    "relative rounded-xl p-3 border animate-pulse-slow",
                    info.isPanic 
                      ? "bg-destructive/10 border-destructive/50" 
                      : "bg-orange-500/10 border-orange-500/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Alert Icon */}
                    <div className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                      info.isPanic ? "bg-destructive/20" : "bg-orange-500/20"
                    )}>
                      <span className="text-lg">{info.emoji}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-bold",
                          info.isPanic ? "text-destructive" : "text-orange-500"
                        )}>
                          {info.isPanic ? '🚨 ALERTA' : '🆘 AYUDA'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(alert.createdAt, { addSuffix: true, locale: es })}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">
                        {info.label} - {alert.creatorName}
                      </p>
                      {alert.message && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {alert.message}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openGoogleMaps(alert.lat, alert.lng)}
                        title="Ver ubicación"
                      >
                        <MapPin className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary"
                        onClick={() => navigateToLocation(alert.lat, alert.lng)}
                        title="Navegar"
                      >
                        <Navigation className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDismissAlert(alert.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Show more indicator */}
            {activeAlerts.length > 3 && (
              <button
                onClick={() => onNavigate('map')}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1"
              >
                +{activeAlerts.length - 3} alertas más · Ver en Mapa
              </button>
            )}
          </div>
        )}

        {/* Welcome Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-primary">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-base text-muted-foreground capitalize">{todayDate}</p>
        </div>

        {/* Weather Card */}
        {(weather || weatherLoading) && (
          <div className="bg-card border-2 border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <MapPinned className="w-5 h-5 text-muted-foreground shrink-0" />
              <span className="text-base text-muted-foreground truncate font-medium">
                {weather?.locationName || 'Obteniendo ubicación...'}
              </span>
            </div>
            {weather && (
              <div className="flex items-center gap-4 mt-3">
                <span className="text-5xl">{weather.icon}</span>
                <div>
                  <p className="text-4xl font-bold text-foreground">{weather.temperature}°</p>
                  <p className="text-lg text-muted-foreground">{weather.description}</p>
                </div>
              </div>
            )}
            {weatherLoading && !weather && (
              <div className="flex items-center gap-2 mt-3">
                <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                <div className="space-y-2">
                  <div className="w-20 h-8 bg-muted animate-pulse rounded" />
                  <div className="w-28 h-5 bg-muted animate-pulse rounded" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Online Users Indicator */}
        <div className="bg-card border-2 border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-5 h-5 rounded-full bg-safe" />
              <div className="absolute inset-0 w-5 h-5 rounded-full bg-safe animate-ping opacity-60" />
            </div>
            <div className="flex-1">
              <p className="text-xl font-bold text-safe">{onlineCount} usuarios conectados</p>
              <p className="text-base text-muted-foreground">Miembros activos en la comunidad</p>
            </div>
          </div>
        </div>

        {/* Sections Grid */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-muted-foreground uppercase tracking-wider">
            Secciones
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {SECTIONS.map((section, index) => (
              <button
                key={section.id}
                onClick={() => onNavigate(section.id)}
                className={cn(
                  "relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-300",
                  "border-2 shadow-sm",
                  "hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]",
                  "animate-fade-in",
                  section.gradient
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="space-y-4">
                  {/* Icon - Larger with solid color background */}
                  <div className={cn(
                    "w-20 h-20 rounded-2xl flex items-center justify-center shadow-md",
                    "transition-transform duration-300 hover:scale-110",
                    section.iconBg
                  )}>
                    {section.icon}
                  </div>
                  
                  {/* Label - Larger text */}
                  <div>
                    <h3 className="font-bold text-foreground text-xl leading-tight">
                      {section.label}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                      {section.description}
                    </p>
                  </div>
                </div>

                {/* Chevron indicator - Larger */}
                <ChevronRight className="absolute top-5 right-4 w-7 h-7 text-muted-foreground/60" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
