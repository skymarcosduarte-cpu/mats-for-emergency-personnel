// Alert Settings Hook for COMUNIDAD EX SOS
// Manages user preferences for alert sounds stored in localStorage

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'mats-alert-settings';

const DEFAULT_EARTHQUAKE_RADIUS_MILES = 30;

interface AlertSettings {
  helpRequestSounds: boolean;
  earthquakeSounds: boolean;
  earthquakeRadiusMiles: number;
  internationalRedAlerts: boolean;
}

const DEFAULT_SETTINGS: AlertSettings = {
  helpRequestSounds: true,
  earthquakeSounds: true,
  earthquakeRadiusMiles: DEFAULT_EARTHQUAKE_RADIUS_MILES,
  internationalRedAlerts: true,
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

  const setEarthquakeRadiusMiles = useCallback((radius: number) => {
    // Clamp between 10 and 100 miles
    const clampedRadius = Math.max(10, Math.min(100, radius));
    saveSettings({ earthquakeRadiusMiles: clampedRadius });
  }, [saveSettings]);

  const setInternationalRedAlerts = useCallback((enabled: boolean) => {
    saveSettings({ internationalRedAlerts: enabled });
  }, [saveSettings]);

  return {
    ...settings,
    loaded,
    setHelpRequestSounds,
    setEarthquakeSounds,
    setEarthquakeRadiusMiles,
    setInternationalRedAlerts,
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

// Standalone function to check if international red alerts are enabled
export function areInternationalRedAlertsEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.internationalRedAlerts ?? true;
    }
  } catch (e) {
    // Ignore
  }
  return true;
}

// Standalone function to get earthquake radius in miles
export function getEarthquakeRadiusMiles(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.earthquakeRadiusMiles ?? DEFAULT_EARTHQUAKE_RADIUS_MILES;
    }
  } catch (e) {
    // Ignore
  }
  return DEFAULT_EARTHQUAKE_RADIUS_MILES;
}

// Get earthquake radius in kilometers
export function getEarthquakeRadiusKm(): number {
  return getEarthquakeRadiusMiles() * 1.60934;
}
