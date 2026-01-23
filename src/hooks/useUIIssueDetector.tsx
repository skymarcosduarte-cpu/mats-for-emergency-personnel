// Hook to detect UI issues like rage clicks, stuck dialogs, unresponsive buttons
import React, { useEffect, useRef, useCallback, useState, createContext, useContext, ReactNode } from 'react';
import { diagLog } from '@/lib/diagnosticLogger';

interface ClickRecord {
  timestamp: number;
  target: string;
  x: number;
  y: number;
}

interface UIIssue {
  type: 'rage_click' | 'stuck_dialog' | 'repeated_action' | 'long_press';
  message: string;
  details: string;
  timestamp: Date;
}

const RAGE_CLICK_THRESHOLD = 4; // Number of clicks in quick succession
const RAGE_CLICK_WINDOW_MS = 2000; // Time window for rage clicks
const RAGE_CLICK_DISTANCE = 50; // Max distance in pixels between clicks
const STUCK_DIALOG_THRESHOLD_MS = 60000; // 1 minute without closing a dialog
const REPEATED_ACTION_THRESHOLD = 5; // Same action repeated multiple times

export const useUIIssueDetector = () => {
  const [detectedIssue, setDetectedIssue] = useState<UIIssue | null>(null);
  const [showReportPrompt, setShowReportPrompt] = useState(false);
  
  const clickHistory = useRef<ClickRecord[]>([]);
  const dialogOpenTime = useRef<Map<string, number>>(new Map());
  const actionHistory = useRef<Map<string, number[]>>(new Map());
  const issueReportedAt = useRef<number>(0);
  
  // Cooldown to avoid spamming the user with prompts
  const ISSUE_COOLDOWN_MS = 120000; // 2 minutes between prompts

  // Detect rage clicks (rapid clicks in same area)
  const detectRageClicks = useCallback((e: MouseEvent) => {
    const now = Date.now();
    
    // Clean old clicks
    clickHistory.current = clickHistory.current.filter(
      c => now - c.timestamp < RAGE_CLICK_WINDOW_MS
    );
    
    // Get target identifier
    const target = e.target as HTMLElement;
    const targetId = target.id || target.className?.toString().slice(0, 50) || target.tagName;
    
    // Add new click
    clickHistory.current.push({
      timestamp: now,
      target: targetId,
      x: e.clientX,
      y: e.clientY,
    });
    
    // Check for rage clicks (multiple clicks in same area)
    if (clickHistory.current.length >= RAGE_CLICK_THRESHOLD) {
      const recentClicks = clickHistory.current.slice(-RAGE_CLICK_THRESHOLD);
      const firstClick = recentClicks[0];
      const lastClick = recentClicks[recentClicks.length - 1];
      
      // Check if all clicks are close together
      const allClose = recentClicks.every(click => {
        const dx = Math.abs(click.x - firstClick.x);
        const dy = Math.abs(click.y - firstClick.y);
        return Math.sqrt(dx * dx + dy * dy) < RAGE_CLICK_DISTANCE;
      });
      
      if (allClose && (now - issueReportedAt.current > ISSUE_COOLDOWN_MS)) {
        const issue: UIIssue = {
          type: 'rage_click',
          message: '¿Algo no responde?',
          details: `Detectamos múltiples clics rápidos en "${targetId}". ¿Necesitas ayuda?`,
          timestamp: new Date(),
        };
        
        diagLog.warn('UIIssueDetector', 'Rage clicks detected', {
          clicks: RAGE_CLICK_THRESHOLD,
          target: targetId,
          area: `${firstClick.x},${firstClick.y}`,
        });
        
        setDetectedIssue(issue);
        setShowReportPrompt(true);
        issueReportedAt.current = now;
        clickHistory.current = []; // Reset after detection
      }
    }
  }, []);

  // Track dialog open times
  const trackDialogOpen = useCallback((dialogName: string) => {
    dialogOpenTime.current.set(dialogName, Date.now());
    
    // Set timeout to check if dialog is stuck
    setTimeout(() => {
      const openTime = dialogOpenTime.current.get(dialogName);
      if (openTime && Date.now() - openTime >= STUCK_DIALOG_THRESHOLD_MS) {
        if (Date.now() - issueReportedAt.current > ISSUE_COOLDOWN_MS) {
          const issue: UIIssue = {
            type: 'stuck_dialog',
            message: '¿Problemas con esta ventana?',
            details: `La ventana "${dialogName}" ha estado abierta por más de 1 minuto. ¿Hay algún problema?`,
            timestamp: new Date(),
          };
          
          diagLog.warn('UIIssueDetector', 'Stuck dialog detected', {
            dialog: dialogName,
            openDuration: STUCK_DIALOG_THRESHOLD_MS,
          });
          
          setDetectedIssue(issue);
          setShowReportPrompt(true);
          issueReportedAt.current = Date.now();
        }
      }
    }, STUCK_DIALOG_THRESHOLD_MS);
  }, []);

  const trackDialogClose = useCallback((dialogName: string) => {
    dialogOpenTime.current.delete(dialogName);
  }, []);

  // Track repeated actions (same button clicked many times)
  const trackAction = useCallback((actionId: string) => {
    const now = Date.now();
    const actionTimes = actionHistory.current.get(actionId) || [];
    
    // Clean old actions (older than 30 seconds)
    const recentActions = actionTimes.filter(t => now - t < 30000);
    recentActions.push(now);
    actionHistory.current.set(actionId, recentActions);
    
    if (recentActions.length >= REPEATED_ACTION_THRESHOLD) {
      if (now - issueReportedAt.current > ISSUE_COOLDOWN_MS) {
        const issue: UIIssue = {
          type: 'repeated_action',
          message: '¿Esta acción no funciona?',
          details: `Has intentado "${actionId}" ${recentActions.length} veces. ¿Necesitas reportar un problema?`,
          timestamp: new Date(),
        };
        
        diagLog.warn('UIIssueDetector', 'Repeated action detected', {
          action: actionId,
          count: recentActions.length,
          windowSeconds: 30,
        });
        
        setDetectedIssue(issue);
        setShowReportPrompt(true);
        issueReportedAt.current = now;
        actionHistory.current.set(actionId, []); // Reset
      }
    }
  }, []);

  // Dismiss the report prompt
  const dismissPrompt = useCallback(() => {
    setShowReportPrompt(false);
    diagLog.action('UIIssueDetector', 'User dismissed issue prompt');
  }, []);

  // Clear detected issue
  const clearIssue = useCallback(() => {
    setDetectedIssue(null);
    setShowReportPrompt(false);
  }, []);

  // Set up global click listener for rage click detection
  useEffect(() => {
    document.addEventListener('click', detectRageClicks, true);
    
    return () => {
      document.removeEventListener('click', detectRageClicks, true);
    };
  }, [detectRageClicks]);

  // Expose functions and state
  return {
    detectedIssue,
    showReportPrompt,
    trackDialogOpen,
    trackDialogClose,
    trackAction,
    dismissPrompt,
    clearIssue,
  };
};

// Context for the detector
interface UIIssueDetectorContextType {
  detectedIssue: UIIssue | null;
  showReportPrompt: boolean;
  trackDialogOpen: (dialogName: string) => void;
  trackDialogClose: (dialogName: string) => void;
  trackAction: (actionId: string) => void;
  dismissPrompt: () => void;
  clearIssue: () => void;
}

const UIIssueDetectorContext = createContext<UIIssueDetectorContextType | null>(null);

export const UIIssueDetectorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const detector = useUIIssueDetector();
  
  return (
    <UIIssueDetectorContext.Provider value={detector}>
      {children}
    </UIIssueDetectorContext.Provider>
  );
};

export const useUIIssueContext = () => {
  const context = useContext(UIIssueDetectorContext);
  if (!context) {
    throw new Error('useUIIssueContext must be used within UIIssueDetectorProvider');
  }
  return context;
};

export type { UIIssue };
