// Active Users Indicator Component
// Shows the count of online users who can receive alerts in real-time

import React, { useState } from 'react';
import { Users, Radio, Clock, MessageCircle, Stethoscope, Cross, Ambulance } from 'lucide-react';
import { useUserLocations } from '@/hooks/useRealtime';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { InternalMessaging } from '@/components/InternalMessaging';

interface ActiveUsersIndicatorProps {
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
  variant?: 'default' | 'prominent';
}

export const ActiveUsersIndicator: React.FC<ActiveUsersIndicatorProps> = ({
  className,
  showIcon = true,
  compact = false,
  variant = 'default',
}) => {
  const { locations } = useUserLocations();
  const { user: currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messageUserId, setMessageUserId] = useState<string | null>(null);
  const [messageUserName, setMessageUserName] = useState<string | null>(null);
  
  // Filter out stale locations (older than 10 minutes)
  const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
  const now = Date.now();
  const activeUsers = locations.filter(loc => {
    if (!loc.updated_at) return false;
    const updatedMs = new Date(loc.updated_at).getTime();
    return (now - updatedMs) < STALE_THRESHOLD_MS;
  });

  const activeCount = activeUsers.length;

  // Sort: SOS Activo first, then EX-SOS, then transit, then familiar
  const sortedUsers = [...activeUsers].sort((a, b) => {
    const getPriority = (u: typeof activeUsers[0]) => {
      if (u.role === 'SOS_ACTIVO') return 0;
      if (u.role === 'EX_SOS') return 1;
      if (u.is_in_transit) return 2;
      return 3;
    };
    return getPriority(a) - getPriority(b);
  });

  const getTimeAgo = (updatedAt: string | null): string => {
    if (!updatedAt) return '';
    const updatedDate = new Date(updatedAt);
    const diffMs = now - updatedDate.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);

    if (diffSec < 60) return `${diffSec}s`;
    if (diffMin < 60) return `${diffMin}m`;
    return `${diffHrs}h`;
  };

  const getRoleIcon = (role: string | null, isInTransit: boolean) => {
    if (isInTransit) return '🚗';
    if (role === 'SOS_ACTIVO') return '☆';
    if (role === 'EX_SOS') return '🎖️';
    return '👤';
  };

  const getRoleBadge = (role: string | null, isInTransit: boolean) => {
    if (isInTransit) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white">
          🚗 TRÁNSITO
        </span>
      );
    }
    if (role === 'SOS_ACTIVO') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-safe text-white">
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

  const handleMessageUser = (userId: string, displayName: string | null) => {
    setMessageUserId(userId);
    setMessageUserName(displayName);
    setIsOpen(false);
  };

  const sosActivoCount = activeUsers.filter(u => u.role === 'SOS_ACTIVO').length;
  const exSosCount = activeUsers.filter(u => u.role === 'EX_SOS').length;
  const transitCount = activeUsers.filter(u => u.is_in_transit).length;
  const familiarCount = activeUsers.filter(u => u.role === 'FAMILIAR' && !u.is_in_transit).length;

  if (variant === 'prominent') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            'flex items-center justify-center gap-3 bg-gradient-to-r from-safe/20 via-safe/10 to-safe/20 backdrop-blur-md rounded-full px-5 py-2.5 shadow-lg border border-safe/30 cursor-pointer hover:from-safe/30 hover:via-safe/20 hover:to-safe/30 transition-all active:scale-95',
            className
          )}
        >
          {/* Animated broadcast icon */}
          <div className="relative">
            <Radio className="w-5 h-5 text-safe" />
            <div className="absolute inset-0 animate-ping">
              <Radio className="w-5 h-5 text-safe opacity-50" />
            </div>
          </div>
          
          {/* Count with larger text */}
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-safe">{activeCount}</span>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-medium text-foreground">usuarios</span>
              <span className="text-xs text-muted-foreground">en línea</span>
            </div>
          </div>

          {/* Pulsing dot */}
          <div className="relative ml-1">
            <div className="w-3 h-3 rounded-full bg-safe" />
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-safe animate-ping opacity-60" />
          </div>
        </button>

        {/* Users Sheet */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
            <SheetHeader className="pb-4 border-b border-border">
              <SheetTitle className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-safe" />
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-safe animate-ping opacity-75" />
                </div>
                {activeCount} usuarios en línea
              </SheetTitle>
              <div className="flex gap-3 text-xs text-muted-foreground flex-wrap pt-2">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-safe" />
                  {sosActivoCount} SOS Activo
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
            </SheetHeader>

            <ScrollArea className="h-[calc(70vh-120px)] mt-4">
              <div className="space-y-2 pr-4">
                {sortedUsers.map((user) => (
                  <div
                    key={user.user_id}
                    className="flex items-center justify-between p-3 rounded-xl bg-card/50 border border-border hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl flex-shrink-0">
                        {getRoleIcon(user.role, user.is_in_transit)}
                      </span>
                      <div className="min-w-0 flex-1">
                        {user.show_name_on_map && user.display_name && (
                          <div className="text-sm font-medium text-foreground truncate max-w-[180px]">
                            {user.display_name}
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          {getRoleBadge(user.role, user.is_in_transit)}
                        </div>
                        
                        {/* Medical capabilities indicators */}
                        {(user.can_provide_medical_assistance || user.has_first_aid_kit || user.has_ambulance) && (
                          <div className="flex items-center gap-2 mt-1.5">
                            {user.can_provide_medical_assistance && (
                              <div className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">
                                <Stethoscope className="w-3 h-3" />
                                <span className="hidden sm:inline">Médico</span>
                              </div>
                            )}
                            {user.has_first_aid_kit && (
                              <div className="flex items-center gap-1 text-xs text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded">
                                <Cross className="w-3 h-3" />
                                <span className="hidden sm:inline">Botiquín</span>
                              </div>
                            )}
                            {user.has_ambulance && (
                              <div className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                                <Ambulance className="w-3 h-3" />
                                <span className="hidden sm:inline">Ambulancia</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {user.is_in_transit && user.transit_destination && (
                          <div className="text-xs text-amber-500 truncate mt-1">
                            → {user.transit_destination}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3" />
                          <span>hace {getTimeAgo(user.updated_at) || '?'}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Message button - only for other users */}
                    {user.user_id !== currentUser?.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2 flex-shrink-0"
                        onClick={() => handleMessageUser(user.user_id, user.show_name_on_map ? user.display_name || null : null)}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">Mensaje</span>
                      </Button>
                    )}
                  </div>
                ))}

                {activeCount === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No hay usuarios activos</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* Internal Messages Modal */}
        <InternalMessaging
          isOpen={!!messageUserId}
          onClose={() => {
            setMessageUserId(null);
            setMessageUserName(null);
          }}
          initialUserId={messageUserId}
          initialUserName={messageUserName}
        />
      </>
    );
  }

  return (
    <button
      onClick={() => setIsOpen(true)}
      className={cn(
        'flex items-center gap-2 bg-card/95 backdrop-blur-sm rounded-lg shadow-lg border border-border cursor-pointer hover:bg-accent/50 transition-colors',
        compact ? 'px-2 py-1.5' : 'px-3 py-2',
        className
      )}
    >
      {/* Pulsing green indicator */}
      <div className="relative">
        <div className="w-2.5 h-2.5 rounded-full bg-safe" />
        <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-safe animate-ping opacity-75" />
      </div>
      
      {showIcon && <Users className="w-4 h-4 text-muted-foreground" />}
      
      <span className={cn(
        'font-medium text-foreground',
        compact ? 'text-xs' : 'text-sm'
      )}>
        {activeCount} {!compact && (activeCount === 1 ? 'activo' : 'activos')}
      </span>
    </button>
  );
};

export default ActiveUsersIndicator;
