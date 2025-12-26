import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ConnectionStatus {
  isConnected: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  error: string | null;
}

const CHECK_TIMEOUT_MS = 8000;
const RETRY_INTERVAL_MS = 30000;
const INITIAL_CHECK_DELAY_MS = 2000;

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>({
    isConnected: navigator.onLine,
    isChecking: false,
    lastChecked: null,
    error: null,
  });
  
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const checkConnection = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        isChecking: false,
        error: 'Sin conexión a internet',
        lastChecked: new Date(),
      }));
      return false;
    }

    setStatus(prev => ({ ...prev, isChecking: true, error: null }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    try {
      // Simple lightweight query to check server connectivity
      const { error } = await supabase
        .from('app_state')
        .select('id')
        .limit(1)
        .abortSignal(controller.signal)
        .single();

      clearTimeout(timeoutId);

      if (!isMountedRef.current) return false;

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is fine
        setStatus({
          isConnected: false,
          isChecking: false,
          error: 'No se pudo conectar al servidor',
          lastChecked: new Date(),
        });
        return false;
      }

      setStatus({
        isConnected: true,
        isChecking: false,
        error: null,
        lastChecked: new Date(),
      });
      return true;
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (!isMountedRef.current) return false;

      const errorMessage = err instanceof Error && err.name === 'AbortError'
        ? 'Tiempo de espera agotado'
        : 'Error de conexión';

      setStatus({
        isConnected: false,
        isChecking: false,
        error: errorMessage,
        lastChecked: new Date(),
      });
      return false;
    }
  }, []);

  const scheduleRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    retryTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !status.isConnected) {
        checkConnection();
      }
    }, RETRY_INTERVAL_MS);
  }, [checkConnection, status.isConnected]);

  // Initial check after mount
  useEffect(() => {
    isMountedRef.current = true;
    
    const initialCheckTimeout = setTimeout(() => {
      checkConnection();
    }, INITIAL_CHECK_DELAY_MS);

    return () => {
      isMountedRef.current = false;
      clearTimeout(initialCheckTimeout);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [checkConnection]);

  // Schedule retry when disconnected
  useEffect(() => {
    if (!status.isConnected && !status.isChecking && status.lastChecked) {
      scheduleRetry();
    }
    
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [status.isConnected, status.isChecking, status.lastChecked, scheduleRetry]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      checkConnection();
    };

    const handleOffline = () => {
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        error: 'Sin conexión a internet',
        lastChecked: new Date(),
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkConnection]);

  return {
    ...status,
    retry: checkConnection,
  };
}
