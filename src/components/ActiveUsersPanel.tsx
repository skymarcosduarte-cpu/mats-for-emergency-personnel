// Active Users Panel Component
// Shows a list of active users without PII, with buttons to center on each

import React, { useState } from 'react';
import { Users, MapPin, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface UserLocationSummary {
  user_id: string;
  lat: number;
  lng: number;
  role: 'RESCATISTA' | 'FAMILIAR' | null;
  is_in_transit: boolean;
  transit_destination: string | null;
  updated_at: string | null;
  display_name?: string | null;
  show_name_on_map?: boolean | null;
}

interface ActiveUsersPanelProps {
  users: UserLocationSummary[];
  onCenterOnUser: (lat: number, lng: number) => void;
  className?: string;
}

export const ActiveUsersPanel: React.FC<ActiveUsersPanelProps> = ({
  users,
  onCenterOnUser,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const getTimeAgo = (updatedAt: string | null): string => {
    if (!updatedAt) return '';
    const updatedDate = new Date(updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - updatedDate.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);

    if (diffSec < 60) return `${diffSec}s`;
    if (diffMin < 60) return `${diffMin}m`;
    return `${diffHrs}h`;
  };

  const getRoleBadge = (role: 'RESCATISTA' | 'FAMILIAR' | null, isInTransit: boolean) => {
    if (isInTransit) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white">
          🚗 TRÁNSITO
        </span>
      );
    }
    if (role === 'RESCATISTA') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-white">
          ☆ RESCATISTA
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
        FAMILIAR
      </span>
    );
  };

  const getRoleIcon = (role: 'RESCATISTA' | 'FAMILIAR' | null, isInTransit: boolean) => {
    if (isInTransit) return '🚗';
    if (role === 'RESCATISTA') return '☆';
    return '👤';
  };

  // Sort: Rescatistas first, then transit, then familiar
  const sortedUsers = [...users].sort((a, b) => {
    const getPriority = (u: UserLocationSummary) => {
      if (u.role === 'RESCATISTA') return 0;
      if (u.is_in_transit) return 1;
      return 2;
    };
    return getPriority(a) - getPriority(b);
  });

  const rescatistaCount = users.filter(u => u.role === 'RESCATISTA').length;
  const transitCount = users.filter(u => u.is_in_transit).length;
  const familiarCount = users.filter(u => u.role === 'FAMILIAR' && !u.is_in_transit).length;

  return (
    <div className={cn('absolute top-20 right-4 z-[1000] flex', className)}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 bg-card/95 backdrop-blur-sm border border-border rounded-l-lg shadow-lg hover:bg-accent transition-colors"
        aria-label={isOpen ? 'Cerrar panel' : 'Abrir panel de usuarios'}
      >
        {isOpen ? (
          <ChevronRight className="w-5 h-5 text-foreground" />
        ) : (
          <div className="relative">
            <Users className="w-5 h-5 text-foreground" />
            <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {users.length}
            </span>
          </div>
        )}
      </button>

      {/* Panel */}
      <div
        className={cn(
          'bg-card/95 backdrop-blur-sm border border-l-0 border-border rounded-r-lg shadow-lg transition-all duration-300 overflow-hidden',
          isOpen ? 'w-64 opacity-100' : 'w-0 opacity-0'
        )}
      >
        {isOpen && (
          <div className="flex flex-col h-full max-h-[60vh]">
            {/* Header */}
            <div className="p-3 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-safe" />
                  <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-safe animate-ping opacity-75" />
                </div>
                <span className="font-semibold text-sm">{users.length} usuarios activos</span>
              </div>
              <div className="flex gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  {rescatistaCount} Rescatistas
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {transitCount} Tránsito
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  {familiarCount} Familiar
                </span>
              </div>
            </div>

            {/* User List */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {sortedUsers.map((user, index) => (
                  <div
                    key={user.user_id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg flex-shrink-0">
                        {getRoleIcon(user.role, user.is_in_transit)}
                      </span>
                      <div className="min-w-0">
                        {/* Show name if allowed */}
                        {user.show_name_on_map && user.display_name && (
                          <div className="text-xs font-medium text-foreground truncate max-w-[120px]">
                            {user.display_name}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          {getRoleBadge(user.role, user.is_in_transit)}
                        </div>
                        {user.is_in_transit && user.transit_destination && (
                          <div className="text-[10px] text-amber-500 truncate mt-0.5">
                            → {user.transit_destination}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{getTimeAgo(user.updated_at) || '?'}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onCenterOnUser(user.lat, user.lng)}
                      aria-label="Centrar en usuario"
                    >
                      <MapPin className="w-4 h-4 text-primary" />
                    </Button>
                  </div>
                ))}

                {users.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No hay usuarios activos
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveUsersPanel;
