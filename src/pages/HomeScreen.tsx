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
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { TabId } from '@/components/BottomNavigation';

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
    icon: <Map className="w-8 h-8" />,
    description: 'Ver ubicaciones y usuarios en línea en tiempo real',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    iconBg: 'bg-blue-500/20 text-blue-400'
  },
  { 
    id: 'alerts', 
    label: 'Sismos', 
    icon: <Activity className="w-8 h-8" />,
    description: 'Alertas sísmicas y reportes',
    gradient: 'from-orange-500/20 to-red-500/20',
    iconBg: 'bg-orange-500/20 text-orange-400'
  },
  { 
    id: 'transit', 
    label: 'Tránsito Seguro', 
    icon: <Car className="w-8 h-8" />,
    description: 'Registrar y monitorear viajes',
    gradient: 'from-green-500/20 to-emerald-500/20',
    iconBg: 'bg-green-500/20 text-green-400'
  },
  { 
    id: 'resources', 
    label: 'RecurSOS', 
    icon: <HeartPulse className="w-8 h-8" />,
    description: 'Recursos de emergencia',
    gradient: 'from-red-500/20 to-rose-500/20',
    iconBg: 'bg-red-500/20 text-red-400'
  },
  { 
    id: 'community', 
    label: 'Comunidad', 
    icon: <Users className="w-8 h-8" />,
    description: 'Tablero, noticias y marketplace',
    gradient: 'from-pink-500/20 to-rose-500/20',
    iconBg: 'bg-pink-500/20 text-pink-400'
  },
  { 
    id: 'settings', 
    label: 'Ajustes', 
    icon: <Settings className="w-8 h-8" />,
    description: 'Configuración y perfil',
    gradient: 'from-slate-500/20 to-gray-500/20',
    iconBg: 'bg-slate-500/20 text-slate-400'
  },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const [onlineCount, setOnlineCount] = useState<number>(0);

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

  useEffect(() => {
    fetchOnlineCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchOnlineCount, 30000);
    return () => clearInterval(interval);
  }, [fetchOnlineCount]);

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

  return (
    <div className="flex-1 overflow-auto pb-20">
      <div className="px-4 pt-4 space-y-6">
        {/* Welcome Section */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-primary">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{todayDate}</p>
        </div>

        {/* Online Users Indicator */}
        <div className="bg-card/50 border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-4 h-4 rounded-full bg-safe" />
              <div className="absolute inset-0 w-4 h-4 rounded-full bg-safe animate-ping opacity-60" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold text-safe">{onlineCount} usuarios conectados</p>
              <p className="text-xs text-muted-foreground">Miembros activos en la comunidad</p>
            </div>
          </div>
        </div>

        {/* Sections Grid */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Secciones
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => onNavigate(section.id)}
                className={cn(
                  "relative overflow-hidden rounded-xl p-4 text-left transition-all duration-200",
                  "bg-gradient-to-br border border-border/50",
                  "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
                  section.gradient
                )}
              >
                <div className="space-y-3">
                  {/* Icon */}
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center",
                    section.iconBg
                  )}>
                    {section.icon}
                  </div>
                  
                  {/* Label */}
                  <div>
                    <h3 className="font-semibold text-foreground text-base">
                      {section.label}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {section.description}
                    </p>
                  </div>
                </div>

                {/* Chevron indicator */}
                <ChevronRight className="absolute top-4 right-3 w-5 h-5 text-muted-foreground/50" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
