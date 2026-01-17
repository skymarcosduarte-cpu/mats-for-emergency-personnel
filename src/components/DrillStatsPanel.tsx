// Drill Statistics Panel Component
// Shows real-time statistics during Clave 100 drills

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Check, AlertTriangle, Clock, 
  ChevronUp, ChevronDown, Activity
} from 'lucide-react';
import { useClave100Checkins } from '@/hooks/useClave100Checkins';
import { cn } from '@/lib/utils';

interface DrillStatsPanelProps {
  drillId: string;
  drillStartTime?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const DrillStatsPanel: React.FC<DrillStatsPanelProps> = ({
  drillId,
  drillStartTime,
  isExpanded = false,
  onToggleExpand,
}) => {
  const { checkins, stats, loading } = useClave100Checkins(drillId);

  // Calculate average response time
  const avgResponseTime = useMemo(() => {
    if (!drillStartTime || checkins.length === 0) return null;
    
    const drillStart = new Date(drillStartTime).getTime();
    const responseTimes = checkins.map(c => {
      const checkinTime = new Date(c.created_at).getTime();
      return (checkinTime - drillStart) / 1000; // in seconds
    });
    
    const avgSeconds = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    return avgSeconds;
  }, [checkins, drillStartTime]);

  // Format time nicely
  const formatResponseTime = (seconds: number | null): string => {
    if (seconds === null) return '--';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  // Get latest check-ins for the expanded view
  const latestCheckins = useMemo(() => {
    return checkins.slice(0, 5);
  }, [checkins]);

  if (!stats && !loading) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-amber-600/90 backdrop-blur-sm border-t border-amber-400/30"
    >
      {/* Compact Stats Row */}
      <div 
        className="px-4 py-2 flex items-center justify-between cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-4 text-sm">
          {/* Total Check-ins */}
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <span className="font-bold text-white">{stats?.total || 0}</span>
              <span className="text-amber-100 text-xs ml-1">check-ins</span>
            </div>
          </div>

          {/* OK Count */}
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-green-500/80 flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-white">{stats?.ok || 0}</span>
          </div>

          {/* HELP Count */}
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center",
              stats?.help && stats.help > 0 ? "bg-red-500 animate-pulse" : "bg-red-500/50"
            )}>
              <AlertTriangle className="w-3.5 h-3.5 text-white" />
            </div>
            <span className={cn(
              "font-bold",
              stats?.help && stats.help > 0 ? "text-white" : "text-amber-100"
            )}>
              {stats?.help || 0}
            </span>
          </div>

          {/* Average Response Time */}
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <span className="font-bold text-white">{formatResponseTime(avgResponseTime)}</span>
              <span className="text-amber-100 text-xs ml-1 hidden sm:inline">promedio</span>
            </div>
          </div>
        </div>

        {/* Expand Toggle */}
        <button className="p-1 rounded-full hover:bg-white/10 transition-colors">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-white" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white" />
          )}
        </button>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3">
              {/* Progress Bar */}
              <div className="bg-white/10 rounded-full h-2 overflow-hidden">
                {stats && stats.total > 0 && (
                  <div className="h-full flex">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(stats.ok / stats.total) * 100}%` }}
                      className="bg-green-500 h-full"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(stats.help / stats.total) * 100}%` }}
                      className="bg-red-500 h-full"
                    />
                  </div>
                )}
              </div>

              {/* Latest Check-ins */}
              {latestCheckins.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-amber-100">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Últimos reportes</span>
                  </div>
                  <div className="space-y-1">
                    {latestCheckins.map((checkin) => (
                      <motion.div
                        key={checkin.id}
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex items-center gap-2 text-xs"
                      >
                        <div className={cn(
                          "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0",
                          checkin.status === 'OK' ? "bg-green-500" : "bg-red-500"
                        )}>
                          {checkin.status === 'OK' ? (
                            <Check className="w-2.5 h-2.5 text-white" />
                          ) : (
                            <AlertTriangle className="w-2.5 h-2.5 text-white" />
                          )}
                        </div>
                        <span className="text-white font-medium truncate">
                          {checkin.nickname || checkin.full_name || 'Usuario'}
                        </span>
                        <span className="text-amber-200 ml-auto flex-shrink-0">
                          {formatCheckinTime(checkin.created_at)}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Statistics Summary */}
              {stats && stats.total > 0 && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
                  <span className="text-amber-100">
                    {Math.round((stats.ok / stats.total) * 100)}% reportan estar bien
                  </span>
                  {stats.help > 0 && (
                    <span className="text-red-200 font-medium animate-pulse">
                      ⚠️ {stats.help} {stats.help === 1 ? 'persona necesita' : 'personas necesitan'} ayuda
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Helper to format check-in time
function formatCheckinTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  
  if (diffSecs < 60) return 'hace un momento';
  if (diffSecs < 3600) return `hace ${Math.floor(diffSecs / 60)}m`;
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export default DrillStatsPanel;
