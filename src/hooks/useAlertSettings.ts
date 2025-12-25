// Alert Settings Hook for COMUNIDAD EX SOS
// Manages user preferences for alert sounds stored in localStorage

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'mats-alert-settings';

interface AlertSettings {
  helpRequestSounds: boolean;
  earthquakeSounds: boolean;
}

const DEFAULT_SETTINGS: AlertSettings = {
  helpRequestSounds: true,
  earthquakeSounds: true,
};

export function useAlertSettings() {
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (e) {
      console.warn('Error loading alert settings:', e);
    }
    setLoaded(true);
  }, []);

  // Save settings to localStorage
  const saveSettings = useCallback((newSettings: Partial<AlertSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Error saving alert settings:', e);
      }
      return updated;
    });
  }, []);

  const setHelpRequestSounds = useCallback((enabled: boolean) => {
    saveSettings({ helpRequestSounds: enabled });
  }, [saveSettings]);

  const setEarthquakeSounds = useCallback((enabled: boolean) => {
    saveSettings({ earthquakeSounds: enabled });
  }, [saveSettings]);

  return {
    ...settings,
    loaded,
    setHelpRequestSounds,
    setEarthquakeSounds,
  };
}

// Standalone function to check if help sounds are enabled (for use outside React)
export function areHelpSoundsEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.helpRequestSounds ?? true;
    }
  } catch (e) {
    // Ignore
  }
  return true;
}

// Standalone function to check if earthquake sounds are enabled
export function areEarthquakeSoundsEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.earthquakeSounds ?? true;
    }
  } catch (e) {
    // Ignore
  }
  return true;
}
