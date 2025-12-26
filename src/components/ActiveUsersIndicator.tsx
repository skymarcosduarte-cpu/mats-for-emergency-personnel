// Active Users Indicator Component
// Shows the count of online users who can receive alerts in real-time

import React from 'react';
import { Users } from 'lucide-react';
import { useUserLocations } from '@/hooks/useRealtime';
import { cn } from '@/lib/utils';

interface ActiveUsersIndicatorProps {
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}

export const ActiveUsersIndicator: React.FC<ActiveUsersIndicatorProps> = ({
  className,
  showIcon = true,
  compact = false,
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
