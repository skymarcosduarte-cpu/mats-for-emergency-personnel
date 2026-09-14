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
  MapPinned,
  Radio,
  Radar
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
import { motion } from 'framer-motion';

interface HomeScreenProps {
  onNavigate: (tab: TabId) => void;
}

interface SectionItem {
  id: TabId;
  nav?: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
  gradient: string;
  iconBg: string;
}

// New order: Left column (Sismos, Recursos, Comunidad) | Right column (Mapa, Tránsito, Ajustes)
const SECTIONS: SectionItem[] = [
  { 
    id: 'alerts', 
    label: 'Sismos', 
    icon: <Activity className="w-10 h-10" strokeWidth={2.5} />,
    description: 'Alertas sísmicas y reportes',
    gradient: 'home-section-alerts',
    iconBg: 'home-section-icon-alerts'
  },
  { 
    id: 'map', 
    label: 'Mapa', 
    icon: <Map className="w-10 h-10" strokeWidth={2.5} />,
    description: 'Ver ubicaciones en tiempo real',
    gradient: 'home-section-map',
    iconBg: 'home-section-icon-map'
  },
  { 
    id: 'resources', 
    label: 'RecurSOS', 
    icon: <HeartPulse className="w-10 h-10" strokeWidth={2.5} />,
    description: 'Recursos de emergencia',
    gradient: 'home-section-resources',
    iconBg: 'home-section-icon-resources'
  },
  { 
    id: 'transit', 
    label: 'Tránsito Seguro', 
    icon: <Car className="w-10 h-10" strokeWidth={2.5} />,
    description: 'Registrar y monitorear viajes',
    gradient: 'home-section-transit',
    iconBg: 'home-section-icon-transit'
  },
  { 
    id: 'community', 
    label: 'Comunidad', 
    icon: <Users className="w-10 h-10" strokeWidth={2.5} />,
    description: 'AviSOS, Noticias, Marketplace, Galería y Bolsa de Trabajo',
    gradient: 'home-section-community',
    iconBg: 'home-section-icon-community'
  },
  { 
    id: 'settings', 
    label: 'Ajustes', 
    icon: <Settings className="w-10 h-10" strokeWidth={2.5} />,
    description: 'Configuración y perfil',
    gradient: 'home-section-settings',
    iconBg: 'home-section-icon-settings'
  },
];

// "Red Mesh" incluye la Red Malla Bluetooth y el test mensual: debe ser
// alcanzable desde el inicio (no tiene pestaña propia en la barra inferior).
SECTIONS.push({
  id: 'status',
  label: 'Red Mesh',
  icon: <Radio className="w-10 h-10" strokeWidth={2.5} />,
  description: 'Red Malla Bluetooth y test mensual',
  gradient: 'home-section-mesh',
  iconBg: 'home-section-icon-mesh',
});

// Detector de Señales: feature más de la cuadrícula (abajo a la derecha),
// navega a Red Mesh donde vive el módulo.
SECTIONS.push({
  id: 'status',
  nav: 'status',
  label: 'Detector de Señales',
  icon: <Radar className="w-10 h-10" strokeWidth={2.5} />,
  description: 'Busca celulares encendidos entre escombros',
  gradient: 'home-section-detector',
  iconBg: 'home-section-icon-detector',
});

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
  AMBULANCIA: { label: 'Ambulancia', emoji: '🚑' },
  AMBULANCIA_TERCERO: { label: 'Ambulancia para Tercero', emoji: '🚑' },
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
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('user_locations')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', true)
        .gte('updated_at', thirtyMinutesAgo);
      
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
      
      // Use simple queries without FK joins - profiles_public doesn't have FK relationship
      const [panicResult, helpResult] = await Promise.all([
        supabase
          .from('panic_events')
          .select('id, panic_type, lat, lng, message, created_at, user_id')
          .eq('resolved', false)
          .gte('created_at', twoHoursAgo)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('help_requests')
          .select('id, kind, lat, lng, message, created_at, user_id')
          .eq('resolved', false)
          .gte('created_at', twoHoursAgo)
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      if (panicResult.error) {
        console.error('[HomeScreen] Panic query error:', panicResult.error);
      }
      if (helpResult.error) {
        console.error('[HomeScreen] Help query error:', helpResult.error);
      }

      // Collect all unique user IDs to fetch nicknames
      const userIds = new Set<string>();
      panicResult.data?.forEach(e => userIds.add(e.user_id));
      helpResult.data?.forEach(r => userIds.add(r.user_id));

      // Fetch profiles in a separate query
      let profilesMap: Record<string, string> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('user_id, nickname')
          .in('user_id', Array.from(userIds));
        
        if (profiles) {
          profiles.forEach(p => {
            profilesMap[p.user_id] = p.nickname || 'Usuario';
          });
        }
      }

      const alerts: EmergencyAlert[] = [];

      // Process panic events
      if (panicResult.data) {
        for (const event of panicResult.data) {
          // Skip own alerts
          if (event.user_id === user?.id) continue;
          
          alerts.push({
            id: `panic-${event.id}`,
            type: 'panic',
            panicType: event.panic_type,
            lat: event.lat,
            lng: event.lng,
            message: event.message || undefined,
            creatorName: profilesMap[event.user_id] || 'Usuario',
            createdAt: new Date(event.created_at!),
          });
        }
      }

      // Process help requests
      if (helpResult.data) {
        for (const req of helpResult.data) {
          // Skip own alerts
          if (req.user_id === user?.id) continue;
          
          alerts.push({
            id: `help-${req.id}`,
            type: 'help',
            helpKind: req.kind,
            lat: req.lat,
            lng: req.lng,
            message: req.message || undefined,
            creatorName: profilesMap[req.user_id] || 'Usuario',
            createdAt: new Date(req.created_at!),
          });
        }
      }

      // Sort by most recent
      alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      console.log('[HomeScreen] Loaded emergency alerts:', alerts.length);
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
        {/* Welcome Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-[hsl(210,80%,30%)]">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-base text-muted-foreground capitalize">{todayDate}</p>
        </div>

        {/* Emergency Alerts Banner - Prominent position right after greeting */}
        {activeAlerts.length > 0 && (
          <motion.div 
            className="space-y-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header */}
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive animate-pulse" />
              <span className="text-sm font-bold text-destructive uppercase tracking-wide">
                {activeAlerts.length === 1 ? 'Emergencia Activa' : `${activeAlerts.length} Emergencias Activas`}
              </span>
            </div>

            {activeAlerts.slice(0, 3).map((alert, index) => {
              const info = getAlertInfo(alert);
              return (
                <motion.div 
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className={cn(
                    "relative rounded-xl p-4 border-2 shadow-md",
                    info.isPanic 
                      ? "bg-destructive/15 border-destructive" 
                      : "bg-orange-500/15 border-orange-500"
                  )}
                >
                  {/* Pulsing indicator */}
                  <div className="absolute top-3 right-3">
                    <span className="relative flex h-3 w-3">
                      <span className={cn(
                        "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                        info.isPanic ? "bg-destructive" : "bg-orange-500"
                      )} />
                      <span className={cn(
                        "relative inline-flex rounded-full h-3 w-3",
                        info.isPanic ? "bg-destructive" : "bg-orange-500"
                      )} />
                    </span>
                  </div>

                  <div className="flex items-start gap-3">
                    {/* Alert Icon */}
                    <div className={cn(
                      "flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center",
                      info.isPanic ? "bg-destructive/30" : "bg-orange-500/30"
                    )}>
                      <span className="text-2xl">{info.emoji}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "text-sm font-bold",
                          info.isPanic ? "text-destructive" : "text-orange-600 dark:text-orange-400"
                        )}>
                          {info.isPanic ? '🚨 ALERTA' : '🆘 AYUDA'}
                        </span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {formatDistanceToNow(alert.createdAt, { addSuffix: true, locale: es })}
                        </span>
                      </div>
                      <p className="text-base font-semibold text-foreground mt-1">
                        {info.label}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        por <span className="font-medium text-foreground">{alert.creatorName}</span>
                      </p>
                      {alert.message && (
                        <p className="text-sm text-muted-foreground italic mt-1 line-clamp-2">
                          "{alert.message}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions - More prominent */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => onNavigate('map')}
                    >
                      <MapPin className="w-4 h-4" />
                      Ver en Mapa
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => navigateToLocation(alert.lat, alert.lng)}
                    >
                      <Navigation className="w-4 h-4" />
                      Cómo llegar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => handleDismissAlert(alert.id)}
                      title="Descartar"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
            
            {/* Show more indicator */}
            {activeAlerts.length > 3 && (
              <button
                onClick={() => onNavigate('map')}
                className="w-full text-center text-sm font-medium text-primary hover:text-primary/80 py-2 bg-primary/10 rounded-lg"
              >
                +{activeAlerts.length - 3} alertas más · Ver todas en Mapa →
              </button>
            )}
          </motion.div>
        )}

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

        {/* Online Users Indicator - Clickable to navigate to Map */}
        <button
          onClick={() => onNavigate('map')}
          className="w-full bg-card border-2 border-border rounded-2xl p-5 shadow-sm hover:bg-muted/50 active:scale-[0.98] transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-5 h-5 rounded-full bg-safe" />
              <div className="absolute inset-0 w-5 h-5 rounded-full bg-safe animate-ping opacity-60" />
            </div>
            <div className="flex-1">
              <p className="text-xl font-bold text-safe">{onlineCount} usuarios conectados</p>
              <p className="text-base text-muted-foreground">Miembros activos en la comunidad</p>
            </div>
            <ChevronRight className="w-6 h-6 text-muted-foreground" />
          </div>
        </button>

        {/* Sections Grid */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-muted-foreground uppercase tracking-wider">
            Secciones
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {SECTIONS.map((section, index) => (
              <motion.button
                key={`${section.id}-${index}`}
                onClick={() => onNavigate(section.nav ?? section.id)}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  duration: 0.4, 
                  delay: index * 0.08,
                  ease: [0.25, 0.46, 0.45, 0.94]
                }}
                whileHover={{ 
                  scale: 1.04, 
                  y: -4,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ 
                  scale: 0.97,
                  transition: { duration: 0.1 }
                }}
                className={cn(
                  "relative overflow-hidden rounded-2xl p-5 text-left",
                  "border-2 shadow-sm",
                  section.gradient
                )}
              >
                <div className="space-y-4">
                  {/* Icon - Animated container with colored icon */}
                  <motion.div 
                    className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center shadow-md",
                      section.iconBg
                    )}
                    whileHover={{ 
                      scale: 1.1, 
                      rotate: [0, -5, 5, 0],
                      transition: { duration: 0.4 }
                    }}
                  >
                    {section.icon}
                  </motion.div>
                  
                  {/* Label - inherits text color from gradient class (white default, navy for transit) */}
                  <div>
                    <h3 className={cn(
                      "font-bold text-xl leading-tight drop-shadow-sm",
                      section.id === 'transit' ? '' : 'text-white'
                    )}>
                      {section.label}
                    </h3>
                    <p className={cn(
                      "text-sm line-clamp-2 mt-1 leading-relaxed",
                      section.id === 'transit' ? 'opacity-80' : 'text-white/90'
                    )}>
                      {section.description}
                    </p>
                  </div>
                </div>

                {/* Animated chevron */}
                <motion.div
                  className="absolute top-5 right-4"
                  initial={{ x: 0 }}
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className={cn(
                    "w-7 h-7",
                    section.id === 'transit' ? 'opacity-50' : 'text-white/60'
                  )} />
                </motion.div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
