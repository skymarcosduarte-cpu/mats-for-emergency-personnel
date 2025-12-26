// Test Mode Hook for Development & Testing
// Provides simulated panic alerts without saving to database

import { useState, useCallback } from 'react';

export interface TestPanicAlert {
  id: string;
  panic_type: string;
  created_at: string;
  isTest: true;
}

export function useTestMode() {
  const [testAlert, setTestAlert] = useState<TestPanicAlert | null>(null);

  const simulatePanicAlert = useCallback((type: string = 'AMBULANCIA_PROPIA') => {
    const alert: TestPanicAlert = {
      id: `test-${Date.now()}`,
      panic_type: type,
      created_at: new Date().toISOString(),
      isTest: true,
    };
    setTestAlert(alert);
    
    // Vibrate to simulate real alert
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  }, []);

  const clearTestAlert = useCallback(() => {
    setTestAlert(null);
    
    // Success vibration
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 50, 50]);
    }
  }, []);

  return {
    testAlert,
    simulatePanicAlert,
    clearTestAlert,
    isTestMode: testAlert !== null,
  };
}
