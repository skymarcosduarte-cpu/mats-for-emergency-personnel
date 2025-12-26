// ETA Countdown component for help request cards
// Shows real-time countdown for responder arrival

import React, { useState, useEffect } from 'react';
import { Clock, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResponderEtaCountdownProps {
  etaMinutes: number | null;
  distanceKm: number;
  speed: number | null; // m/s
  respondingStartedAt: string;
  className?: string;
}

export const ResponderEtaCountdown: React.FC<ResponderEtaCountdownProps> = ({
  etaMinutes,
  distanceKm,
  speed,
  respondingStartedAt,
  className,
}) => {
  const [displayTime, setDisplayTime] = useState<string>('');
  const [isVeryClose, setIsVeryClose] = useState(false);

  useEffect(() => {
    const updateDisplay = () => {
      if (etaMinutes === null || etaMinutes <= 0) {
        setDisplayTime('Llegando...');
        setIsVeryClose(true);
        return;
      }

      if (etaMinutes < 1) {
        setDisplayTime('< 1 min');
        setIsVeryClose(true);
      } else if (etaMinutes < 60) {
        const mins = Math.round(etaMinutes);
        setDisplayTime(`~${mins} min`);
        setIsVeryClose(etaMinutes < 5);
      } else {
        const hours = Math.floor(etaMinutes / 60);
        const mins = Math.round(etaMinutes % 60);
        setDisplayTime(`~${hours}h ${mins}m`);
        setIsVeryClose(false);
      }
    };

    updateDisplay();
    
    // Update every 10 seconds for countdown effect
    const interval = setInterval(updateDisplay, 10000);
    return () => clearInterval(interval);
  }, [etaMinutes]);

  const speedKmh = speed ? Math.round(speed * 3.6) : null;

  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg",
      isVeryClose 
        ? "bg-success/10 border border-success/30" 
        : "bg-primary/10 border border-primary/30",
      className
    )}>
      <div className={cn(
        "flex items-center justify-center w-8 h-8 rounded-full",
        isVeryClose ? "bg-success/20" : "bg-primary/20"
      )}>
        <Clock className={cn(
          "w-4 h-4",
          isVeryClose ? "text-success animate-pulse" : "text-primary"
        )} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-bold text-sm",
            isVeryClose ? "text-success" : "text-primary"
          )}>
            {displayTime}
          </span>
          <span className="text-xs text-muted-foreground">
            • {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Navigation className="w-3 h-3" />
          <span>
            {speedKmh !== null ? `${speedKmh} km/h` : 'En camino'}
          </span>
        </div>
      </div>
    </div>
  );
};
