// Status Check-in Timer Hook for COMUNIDAD EX SOS
// Prompts users to confirm safety after earthquakes

import { useState, useEffect, useCallback, useRef } from 'react';
import { get, set, createStore } from 'idb-keyval';

const CHECKIN_STORE = createStore('exsos-checkin', 'status');
const LAST_EARTHQUAKE_KEY = 'last_earthquake_alert';
const LAST_CHECKIN_KEY = 'last_checkin';
const CHECKIN_PROMPT_DISMISSED_KEY = 'checkin_dismissed';

// Time to wait before prompting for check-in (5 minutes after earthquake alert)
const CHECKIN_DELAY_MS = 5 * 60 * 1000;
// Prompt expiry (30 minutes - after this, stop showing prompt)
const PROMPT_EXPIRY_MS = 30 * 60 * 1000;

interface CheckinState {
  shouldPrompt: boolean;
  earthquakeTime: number | null;
  earthquakeId: string | null;
  lastCheckinTime: number | null;
}

export function useStatusCheckin() {
  const [state, setState] = useState<CheckinState>({
    shouldPrompt: false,
    earthquakeTime: null,
    earthquakeId: null,
    lastCheckinTime: null,
  });
  
  const timerRef = useRef<number | null>(null);

  // Load state from IndexedDB
  const loadState = useCallback(async () => {
    try {
      const lastEarthquake = await get<{ time: number; id: string }>(LAST_EARTHQUAKE_KEY, CHECKIN_STORE);
      const lastCheckin = await get<number>(LAST_CHECKIN_KEY, CHECKIN_STORE);
      const dismissed = await get<string>(CHECKIN_PROMPT_DISMISSED_KEY, CHECKIN_STORE);

      if (!lastEarthquake) {
        setState(prev => ({ ...prev, shouldPrompt: false }));
        return;
      }

      const now = Date.now();
      const timeSinceEarthquake = now - lastEarthquake.time;

      // Check if we should show prompt
      const isWithinPromptWindow = timeSinceEarthquake < PROMPT_EXPIRY_MS;
      const hasPassedDelay = timeSinceEarthquake >= CHECKIN_DELAY_MS;
      const hasNotCheckedInSince = !lastCheckin || lastCheckin < lastEarthquake.time;
      const notDismissed = dismissed !== lastEarthquake.id;

      const shouldPrompt = isWithinPromptWindow && hasPassedDelay && hasNotCheckedInSince && notDismissed;

      setState({
        shouldPrompt,
        earthquakeTime: lastEarthquake.time,
        earthquakeId: lastEarthquake.id,
        lastCheckinTime: lastCheckin || null,
      });

      // If we should prompt but delay hasn't passed, set a timer
      if (isWithinPromptWindow && !hasPassedDelay && hasNotCheckedInSince && notDismissed) {
        const remainingDelay = CHECKIN_DELAY_MS - timeSinceEarthquake;
        timerRef.current = window.setTimeout(() => {
          setState(prev => ({ ...prev, shouldPrompt: true }));
        }, remainingDelay);
      }
    } catch (error) {
      console.error('Error loading checkin state:', error);
    }
  }, []);

  useEffect(() => {
    loadState();
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [loadState]);

  // Record an earthquake alert to trigger future check-in prompt
  const recordEarthquakeAlert = useCallback(async (earthquakeId: string) => {
    const now = Date.now();
    await set(LAST_EARTHQUAKE_KEY, { time: now, id: earthquakeId }, CHECKIN_STORE);
    
    setState(prev => ({
      ...prev,
      earthquakeTime: now,
      earthquakeId,
    }));

    // Set timer for prompt
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    timerRef.current = window.setTimeout(() => {
      setState(prev => ({ ...prev, shouldPrompt: true }));
    }, CHECKIN_DELAY_MS);
  }, []);

  // User confirms they are OK
  const confirmSafe = useCallback(async () => {
    const now = Date.now();
    await set(LAST_CHECKIN_KEY, now, CHECKIN_STORE);
    
    setState(prev => ({
      ...prev,
      shouldPrompt: false,
      lastCheckinTime: now,
    }));
  }, []);

  // User dismisses the prompt (will show again if they reopen app)
  const dismissPrompt = useCallback(async () => {
    if (state.earthquakeId) {
      await set(CHECKIN_PROMPT_DISMISSED_KEY, state.earthquakeId, CHECKIN_STORE);
    }
    setState(prev => ({ ...prev, shouldPrompt: false }));
  }, [state.earthquakeId]);

  // Get time since earthquake in a readable format
  const getTimeSinceEarthquake = useCallback((): string => {
    if (!state.earthquakeTime) return '';
    
    const minutes = Math.floor((Date.now() - state.earthquakeTime) / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}min`;
  }, [state.earthquakeTime]);

  return {
    shouldPrompt: state.shouldPrompt,
    earthquakeTime: state.earthquakeTime,
    lastCheckinTime: state.lastCheckinTime,
    recordEarthquakeAlert,
    confirmSafe,
    dismissPrompt,
    getTimeSinceEarthquake,
  };
}
