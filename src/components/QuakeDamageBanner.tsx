import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, MapPin, ExternalLink, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface QuakeDamageNotification {
  id: string;
  title: string;
  message: string | null;
  created_at: string;
}

export const QuakeDamageBanner: React.FC = () => {
  const { notifications, markAsRead } = useNotifications();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter for quake damage priority notifications that haven't been dismissed
  const quakeDamageNotifications = notifications.filter(
    (n) => 
      (n.type === 'quake_damage_priority' || n.type === 'quake_damage') && 
      !n.read && 
      !dismissedIds.has(n.id)
  ) as QuakeDamageNotification[];

  // Get the most recent notification
  const latestNotification = quakeDamageNotifications[0];

  // Auto-expand when a new notification arrives
  useEffect(() => {
    if (latestNotification) {
      setIsExpanded(true);
    }
  }, [latestNotification?.id]);

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
    markAsRead(id);
  };

  const handleDismissAll = () => {
    quakeDamageNotifications.forEach(n => {
      setDismissedIds(prev => new Set([...prev, n.id]));
      markAsRead(n.id);
    });
    setIsExpanded(false);
  };

  // Extract location from message (Google Maps link)
  const extractLocation = (message: string | null) => {
    if (!message) return null;
    const match = message.match(/https:\/\/www\.google\.com\/maps\?q=([\d.-]+),([\d.-]+)/);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]), url: match[0] };
    }
    return null;
  };

  if (quakeDamageNotifications.length === 0) {
    return null;
  }

  const location = extractLocation(latestNotification?.message);

  return (
    <div className="relative z-50">
      {/* Main Banner */}
      <div 
        className={cn(
          "bg-destructive text-destructive-foreground px-4 py-3 shadow-lg",
          "animate-pulse-slow border-b-2 border-destructive/50"
        )}
      >
        <div className="flex items-center gap-3">
          {/* Animated alert icon */}
          <div className="relative flex-shrink-0">
            <AlertTriangle className="w-6 h-6 animate-bounce" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">
              🚨 ALERTA MÁXIMA PRIORIDAD
            </p>
            {latestNotification && (
              <p className="text-xs opacity-90 truncate">
                {latestNotification.title.replace('🚨 ', '')}
              </p>
            )}
          </div>

          {/* Badge for multiple alerts */}
          {quakeDamageNotifications.length > 1 && (
            <div className="flex-shrink-0 bg-white/20 text-white text-xs font-bold px-2 py-1 rounded-full">
              +{quakeDamageNotifications.length - 1}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {location && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-destructive-foreground hover:bg-white/20"
                onClick={() => window.open(location.url, '_blank')}
              >
                <MapPin className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Ver</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive-foreground hover:bg-white/20"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Bell className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive-foreground hover:bg-white/20"
              onClick={handleDismissAll}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded panel with all notifications */}
      {isExpanded && quakeDamageNotifications.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-card border-b border-border shadow-lg max-h-64 overflow-y-auto z-50">
          {quakeDamageNotifications.map((notification) => {
            const notifLocation = extractLocation(notification.message);
            return (
              <div 
                key={notification.id}
                className="p-3 border-b border-border last:border-b-0 bg-destructive/5 hover:bg-destructive/10 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {notification.title}
                    </p>
                    {notification.message && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message.replace(/https:\/\/www\.google\.com\/maps\?q=[\d.-]+,[\d.-]+/, '').trim()}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { 
                        addSuffix: true,
                        locale: es 
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {notifLocation && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => window.open(notifLocation.url, '_blank')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Mapa
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleDismiss(notification.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QuakeDamageBanner;
