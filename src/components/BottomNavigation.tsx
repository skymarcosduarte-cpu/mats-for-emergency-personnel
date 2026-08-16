// Bottom Navigation Component for COMUNIDAD EX SOS

import React from 'react';
import { 
  Home,
  Map, 
  Car, 
  Activity, 
  Settings,
  Users,
  BookOpen,
  ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateAvailable } from '@/hooks/useUpdateCheck';

export type TabId = 'home' | 'map' | 'transit' | 'alerts' | 'community' | 'resources' | 'status' | 'settings';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  requiresRescatista?: boolean;
  hideInDisaster?: boolean;
}

// Star of Life icon for RESCATISTA users (6-pointed star with rod of asclepius style)
const StarOfLifeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
  >
    {/* 6-pointed star of life */}
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Inicio', icon: <Home className="w-4 h-4" /> },
  { id: 'map', label: 'Mapa', icon: <Map className="w-4 h-4" /> },
  { id: 'alerts', label: 'Sismos', icon: <Activity className="w-4 h-4" /> },
  { id: 'transit', label: 'Tránsito', icon: <Car className="w-4 h-4" /> },
  { id: 'resources', label: 'RecurSOS', icon: <ShieldAlert className="w-4 h-4" /> },
  { id: 'community', label: 'Social', icon: <Users className="w-4 h-4" /> },
  { id: 'settings', label: 'Ajustes', icon: <Settings className="w-4 h-4" /> },
];

interface BottomNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isRescatista?: boolean;
  disasterMode?: boolean;
  alertCount?: number;
  messageCount?: number;
  hasActiveSeismicAlert?: boolean;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
  isRescatista = true,
  disasterMode = false,
  alertCount = 0,
  messageCount = 0,
  hasActiveSeismicAlert = false,
}) => {
  const updateAvailable = useUpdateAvailable();
  
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.requiresRescatista && !isRescatista) return false;
    if (item.hideInDisaster && disasterMode) return false;
    return true;
  });

  return (
    <nav className="bottom-nav">
      <div className="flex items-center justify-around h-14 px-1">
        {visibleItems.map((item) => {
          const isActive = activeTab === item.id;
          const showUpdateBadge = item.id === 'settings' && updateAvailable;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all touch-target',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={cn(
                "relative",
                item.id === 'alerts' && hasActiveSeismicAlert && "animate-pulse text-destructive"
              )}>
                {item.icon}
                
                {/* Alert badge */}
                {item.id === 'alerts' && alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
                
                {/* Message badge on map */}
                {item.id === 'map' && messageCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {messageCount > 9 ? '9+' : messageCount}
                  </span>
                )}
                
                {/* Update available badge on settings */}
                {showUpdateBadge && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
                )}
              </div>
              
              <span className={cn(
                'text-[9px] font-medium leading-tight truncate max-w-full',
                isActive && 'font-semibold'
              )}>
                {item.label}
              </span>
              
              {/* Active indicator */}
              {isActive && (
                <div className="absolute bottom-0 w-12 h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
      
      {/* Disaster mode indicator */}
      {disasterMode && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-destructive animate-pulse" />
      )}
    </nav>
  );
};

export default BottomNavigation;
