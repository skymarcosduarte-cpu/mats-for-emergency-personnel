// Active Users Indicator Component
// Shows the count of online users who can receive alerts in real-time

import React from 'react';
import { Users, Radio } from 'lucide-react';
import { useUserLocations } from '@/hooks/useRealtime';
import { cn } from '@/lib/utils';

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
  
  // Filter out stale locations (older than 10 minutes)
  const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
  const now = Date.now();
  const activeCount = locations.filter(loc => {
    if (!loc.updated_at) return false;
    const updatedMs = new Date(loc.updated_at).getTime();
    return (now - updatedMs) < STALE_THRESHOLD_MS;
  }).length;

  if (variant === 'prominent') {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-3 bg-gradient-to-r from-safe/20 via-safe/10 to-safe/20 backdrop-blur-md rounded-full px-5 py-2.5 shadow-lg border border-safe/30',
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
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 bg-card/95 backdrop-blur-sm rounded-lg shadow-lg border border-border',
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
    </div>
  );
};

export default ActiveUsersIndicator;
