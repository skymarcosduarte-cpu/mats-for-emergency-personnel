// Version Check Utility for COMUNIDAD EX SOS
// Handles version comparison and update prompts

import { supabase, isSupabaseConfigured } from './supabase';
import type { VersionInfo, AppRelease } from '@/types';

// Current app version (set at build time)
export const APP_VERSION = '2.9.5';
// Número de build inyectado en tiempo de compilación (ver vite.config.ts).
// Permite confirmar en el teléfono que se instaló exactamente esta compilación.
// Estos identificadores globales son sustituidos textualmente por Vite `define`
// en tiempo de compilación (ver vite.config.ts). Deben leerse como identificadores
// sueltos, no como propiedades de globalThis.
declare const __BUILD_NUMBER__: string | undefined;
declare const __BUILD_TIME__: string | undefined;
declare const __GIT_SHA__: string | undefined;
declare const __CI_RUN_ID__: string | undefined;

const readInjected = (reader: () => string | undefined): string => {
  try {
    return reader() || '';
  } catch {
    return '';
  }
};

export const BUILD_NUMBER: string = readInjected(() => __BUILD_NUMBER__) || 'dev';
export const BUILD_TIME: string = readInjected(() => __BUILD_TIME__) || new Date().toISOString();
// Commit SHA y run id de CI con los que se compiló esta build (inyectados en vite.config.ts).
export const GIT_SHA: string = readInjected(() => __GIT_SHA__);
export const CI_RUN_ID: string = readInjected(() => __CI_RUN_ID__);
// Repositorio de GitHub usado para verificación automática de la compilación.
export const GITHUB_REPO = 'skymarcosduarte-cpu/safe-guard-link-43a63509';

/**
 * Compare semantic versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  
  const maxLength = Math.max(partsA.length, partsB.length);
  
  for (let i = 0; i < maxLength; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  
  return 0;
}

/**
 * Check if update is required
 */
export function isUpdateRequired(current: string, minSupported: string): boolean {
  return compareVersions(current, minSupported) < 0;
}

/**
 * Check if newer version is available
 */
export function isNewerVersionAvailable(current: string, latest: string): boolean {
  return compareVersions(current, latest) < 0;
}

/**
 * Fetch version info from server
 */
export async function checkForUpdates(): Promise<VersionInfo | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('app_releases')
      .select('*')
      .order('released_at', { ascending: false })
      .limit(1)
      .single();
      
    if (error || !data) {
      console.error('Error checking for updates:', error);
      return null;
    }
    
    const release = data as AppRelease;
    
    return {
      current: APP_VERSION,
      latest: release.version,
      minSupported: release.min_supported,
      mustUpdate: isUpdateRequired(APP_VERSION, release.min_supported),
      releaseNotes: release.release_notes,
    };
  } catch (error) {
    console.error('Error checking for updates:', error);
    return null;
  }
}

/**
 * Force service worker update
 */
export async function forceServiceWorkerUpdate(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      for (const registration of registrations) {
        await registration.update();
      }
      
      console.log('Service worker update triggered');
    } catch (error) {
      console.error('Error updating service worker:', error);
    }
  }
}

/**
 * Reload app to apply update
 */
export function applyUpdate(): void {
  window.location.reload();
}

/**
 * Format version for display
 */
export function formatVersion(version: string): string {
  return `v${version}`;
}

/**
 * Get full version string with build info
 */
export function getFullVersionString(): string {
  return `v${APP_VERSION} (${new Date(BUILD_TIME).toLocaleDateString()})`;
}

/**
 * Check and handle updates on app start
 */
export async function initVersionCheck(): Promise<VersionInfo | null> {
  // Always force SW update check on start
  await forceServiceWorkerUpdate();
  
  // Check server for version info
  const versionInfo = await checkForUpdates();
  
  if (versionInfo?.mustUpdate) {
    console.warn('Critical update required:', versionInfo);
  } else if (versionInfo && isNewerVersionAvailable(versionInfo.current, versionInfo.latest)) {
    console.info('New version available:', versionInfo.latest);
  }
  
  return versionInfo;
}
