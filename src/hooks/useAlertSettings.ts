// Alert Settings Hook for COMUNIDAD EX SOS
// Manages user preferences for alert sounds stored in localStorage

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'mats-alert-settings';

const DEFAULT_EARTHQUAKE_RADIUS_KM = 50;
const DEFAULT_SSN_NATIONAL_ALERT_MAGNITUDE = 6.0;
const DEFAULT_ARRIVAL_RADIUS_M = 300;

interface AlertSettings {
  helpRequestSounds: boolean;
  earthquakeSounds: boolean;
  earthquakeRadiusKm: number;
  internationalRedAlerts: boolean;
  ssnNationalAlertMagnitude: number;
  skyAlertSounds: boolean;
  arrivalRadiusMeters: number;
}

const DEFAULT_SETTINGS: AlertSettings = {
  helpRequestSounds: true,
  earthquakeSounds: true,
  earthquakeRadiusKm: DEFAULT_EARTHQUAKE_RADIUS_KM,
  internationalRedAlerts: true,
  ssnNationalAlertMagnitude: DEFAULT_SSN_NATIONAL_ALERT_MAGNITUDE,
  skyAlertSounds: true,
  arrivalRadiusMeters: DEFAULT_ARRIVAL_RADIUS_M,
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

  const setEarthquakeRadiusKm = useCallback((radius: number) => {
    // Clamp between 20 and 400 km
    const clampedRadius = Math.max(20, Math.min(400, radius));
    saveSettings({ earthquakeRadiusKm: clampedRadius });
  }, [saveSettings]);

  const setInternationalRedAlerts = useCallback((enabled: boolean) => {
    saveSettings({ internationalRedAlerts: enabled });
  }, [saveSettings]);

  const setSsnNationalAlertMagnitude = useCallback((magnitude: number) => {
    // Clamp between 5.0 and 8.0
    const clampedMagnitude = Math.max(5.0, Math.min(8.0, magnitude));
    saveSettings({ ssnNationalAlertMagnitude: clampedMagnitude });
  }, [saveSettings]);

  const setArrivalRadiusMeters = useCallback((meters: number) => {
    // Clamp between 100 and 500 meters
    const clamped = Math.max(100, Math.min(500, Math.round(meters)));
    saveSettings({ arrivalRadiusMeters: clamped });
  }, [saveSettings]);

  const setSkyAlertSounds = useCallback((enabled: boolean) => {
    saveSettings({ skyAlertSounds: enabled });
  }, [saveSettings]);

  return {
    ...settings,
    loaded,
    setHelpRequestSounds,
    setEarthquakeSounds,
    setEarthquakeRadiusKm,
    setInternationalRedAlerts,
    setSsnNationalAlertMagnitude,
    setSkyAlertSounds,
    setArrivalRadiusMeters,
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

// Standalone function to get earthquake radius in kilometers
export function getEarthquakeRadiusKm(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.earthquakeRadiusKm ?? DEFAULT_EARTHQUAKE_RADIUS_KM;
    }
  } catch (e) {
    // Ignore
  }
  return DEFAULT_EARTHQUAKE_RADIUS_KM;
}

// Standalone function to get SSN national alert magnitude threshold
export function getSsnNationalAlertMagnitude(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.ssnNationalAlertMagnitude ?? DEFAULT_SSN_NATIONAL_ALERT_MAGNITUDE;
    }
  } catch (e) {
    // Ignore
  }
  return DEFAULT_SSN_NATIONAL_ALERT_MAGNITUDE;
}

// Standalone function to check if SkyAlert sounds are enabled
export function areSkyAlertSoundsEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.skyAlertSounds ?? true;
    }
  } catch (e) {
    // Ignore
  }
  return true;
}

// Standalone function to get arrival detection radius in meters
export function getArrivalRadiusMeters(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const value = parsed.arrivalRadiusMeters;
      if (typeof value === 'number' && isFinite(value)) {
        return Math.max(100, Math.min(500, value));
      }
    }
  } catch (e) {
    // Ignore
  }
  return DEFAULT_ARRIVAL_RADIUS_M;
}
