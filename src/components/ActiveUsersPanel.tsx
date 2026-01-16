// Active Users Panel Component
// Shows a list of active users without PII, with buttons to center on each and message

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Users, MapPin, ChevronRight, Clock, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export interface UserLocationSummary {
  user_id: string;
  lat: number;
  lng: number;
  role: 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR' | null;
  is_in_transit: boolean;
  transit_destination: string | null;
  updated_at: string | null;
  display_name?: string | null;
  show_name_on_map?: boolean | null;
  can_provide_medical_assistance?: boolean | null;
  has_first_aid_kit?: boolean | null;
}

interface ActiveUsersPanelProps {
  users: UserLocationSummary[];
  onCenterOnUser: (lat: number, lng: number) => void;
  onMessageUser?: (userId: string, displayName: string | null) => void;
  onOpenChange?: (isOpen: boolean) => void;
  forceCloseSignal?: number; // Incremented to force close when map is tapped
  defaultOpen?: boolean; // If true, panel opens automatically on mount
  className?: string;
}

export const ActiveUsersPanel: React.FC<ActiveUsersPanelProps> = ({
  users,
  onCenterOnUser,
  onMessageUser,
  onOpenChange,
  forceCloseSignal = 0,
  defaultOpen = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { user: currentUser } = useAuth();

  // Swipe gesture state
  const panelRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchCurrentX = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  // Force close when the map is tapped
  useEffect(() => {
    if (forceCloseSignal > 0) {
      handleClose();
    }
  }, [forceCloseSignal, handleClose]);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onOpenChange?.(newState);
  };

  // Swipe handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    // Only allow swiping to the right (positive diff)
    if (diff > 0) {
      setSwipeOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    const SWIPE_THRESHOLD = 80; // pixels needed to trigger close
    if (swipeOffset > SWIPE_THRESHOLD) {
      handleClose();
    }
    // Reset swipe state
    touchStartX.current = null;
    touchCurrentX.current = null;
    setSwipeOffset(0);
  };

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

  const getRoleBadge = (role: 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR' | null, isInTransit: boolean) => {
    if (isInTransit) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white">
          🚗 TRÁNSITO
        </span>
      );
    }
    if (role === 'SOS_ACTIVO') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-mats-green text-white">
          ☆ SOS ACTIVO
        </span>
      );
    }
    if (role === 'EX_SOS') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary text-white">
          🎖️ EX-SOS
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
        FAMILIAR
      </span>
    );
  };

  const getRoleIcon = (role: 'SOS_ACTIVO' | 'EX_SOS' | 'FAMILIAR' | null, isInTransit: boolean) => {
    if (isInTransit) return '🚗';
    if (role === 'SOS_ACTIVO') return '☆';
    if (role === 'EX_SOS') return '🎖️';
    return '👤';
  };

  // Filter out stale locations (older than 10 minutes)
  const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
  const now = Date.now();
  const activeUsers = users.filter(u => {
    if (!u.updated_at) return false;
    const updatedMs = new Date(u.updated_at).getTime();
    return (now - updatedMs) < STALE_THRESHOLD_MS;
  });

  // Sort: SOS Activo first, then EX-SOS, then transit, then familiar
  const sortedUsers = [...activeUsers].sort((a, b) => {
    const getPriority = (u: UserLocationSummary) => {
      if (u.role === 'SOS_ACTIVO') return 0;
      if (u.role === 'EX_SOS') return 1;
      if (u.is_in_transit) return 2;
      return 3;
    };
    return getPriority(a) - getPriority(b);
  });

  const sosActivoCount = activeUsers.filter(u => u.role === 'SOS_ACTIVO').length;
  const exSosCount = activeUsers.filter(u => u.role === 'EX_SOS').length;
  const transitCount = activeUsers.filter(u => u.is_in_transit).length;
  const familiarCount = activeUsers.filter(u => u.role === 'FAMILIAR' && !u.is_in_transit).length;

  return (
    <div className={cn('fixed top-[calc(var(--app-header-height)+58px)] right-4 z-[1000] flex', className)}>
      {/* Toggle Button */}
      <button
        onClick={handleToggle}
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
        ref={panelRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: isOpen ? `translateX(${swipeOffset}px)` : undefined,
          opacity: isOpen ? Math.max(0.3, 1 - swipeOffset / 200) : 0,
        }}
        className={cn(
          'bg-card/95 backdrop-blur-sm border border-l-0 border-border rounded-r-lg shadow-lg transition-all overflow-hidden',
          isOpen ? 'w-64' : 'w-0',
          swipeOffset === 0 && 'duration-300'
        )}
      >
        {isOpen && (
          <div className="flex flex-col h-full max-h-[60vh]">
            {/* Header with Welcome Message */}
            <div className="p-3 border-b border-border">
              {/* Welcome message - personalized */}
              {(() => {
                const currentUserData = users.find(u => u.user_id === currentUser?.id);
                const userName = currentUserData?.show_name_on_map && currentUserData?.display_name 
                  ? currentUserData.display_name.split(' ')[0] // First name only
                  : null;
                
                return (
                  <div className="bg-gradient-to-r from-primary/10 to-safe/10 rounded-lg p-2 mb-3">
                    <p className="text-xs font-medium text-center">
                      👋 ¡Hola{userName ? `, ${userName}` : ''}! Bienvenido a M.A.T.S.
                    </p>
                    <p className="text-[11px] text-muted-foreground text-center mt-1">
                      {activeUsers.length === 0 
                        ? 'No hay otros usuarios activos en este momento'
                        : activeUsers.length === 1 
                          ? '1 miembro de la comunidad está activo'
                          : `${activeUsers.length} miembros activos ahora`
                      }
                    </p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center mt-1.5">
                      💡 Recuerda: Forzar Actualización en Ajustes
                    </p>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-safe" />
                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-safe animate-ping opacity-75" />
                  </div>
                  <span className="font-semibold text-sm">{activeUsers.length} activos</span>
                </div>
                {/* Close Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 -mr-1 hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleClose}
                  aria-label="Cerrar panel"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-mats-green" />
                  {sosActivoCount} SOS
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  {exSosCount} EX-SOS
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
              {/* Swipe hint for mobile */}
              <p className="text-[10px] text-muted-foreground mt-2 md:hidden text-center">
                ← Desliza para cerrar
              </p>
            </div>

            {/* User List */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {sortedUsers.map((user, index) => (
                  <div
                    key={user.user_id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 active:bg-accent/70 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-lg flex-shrink-0">
                        {getRoleIcon(user.role, user.is_in_transit)}
                      </span>
                      <div className="min-w-0 flex-1">
                        {/* Show name if allowed */}
                        {user.show_name_on_map && user.display_name && (
                          <div className="text-xs font-medium text-foreground truncate max-w-[100px]">
                            {user.display_name}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          {getRoleBadge(user.role, user.is_in_transit)}
                        </div>
                        {user.is_in_transit && user.transit_destination && (
                          <div className="text-[10px] text-amber-500 truncate max-w-[100px] mt-0.5" title={user.transit_destination}>
                            → {user.transit_destination}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          <span>{getTimeAgo(user.updated_at) || '?'}</span>
                        </div>
                      </div>
                    </div>
                    {/* Action buttons - always visible on mobile */}
                    <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                      {onMessageUser && user.user_id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 touch-manipulation"
                          onClick={() => onMessageUser(user.user_id, user.show_name_on_map ? user.display_name || null : null)}
                          aria-label="Enviar mensaje"
                        >
                          <MessageCircle className="w-4 h-4 text-muted-foreground hover:text-primary" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 touch-manipulation"
                        onClick={() => onCenterOnUser(user.lat, user.lng)}
                        aria-label="Centrar en usuario"
                      >
                        <MapPin className="w-4 h-4 text-primary" />
                      </Button>
                    </div>
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
