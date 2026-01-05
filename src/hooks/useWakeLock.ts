// Wake Lock Hook for MATS
// Prevents screen from sleeping during critical operations
// - Web: Screen Wake Lock API (with iOS video fallback)
// - iOS/Android (native): Capacitor KeepAwake plugin

import { useState, useCallback, useEffect, useRef } from 'react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { isNative } from '@/lib/capacitor';

interface WakeLockState {
  isSupported: boolean;
  isActive: boolean;
  error: string | null;
}

// Base64 encoded tiny silent MP4 video for iOS Safari wake lock workaround
// iOS Safari doesn't support Wake Lock API, so we use a looping video trick
const SILENT_VIDEO_BASE64 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAu1tZGF0AAACrQYF//+p3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1MiByMjg1NCBlOWE1OTAzIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTMgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTI1IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAD2WIhAA3//728P4FNjuZQQAAAu5tb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAZAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACGHRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAZAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAgAAAAIAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAAGQAAAAAAAEAAAAAAZBtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAACgAAAAEAFXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAE7bWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAA+3N0YmwAAACXc3RzZAAAAAAAAAABAAAAh2F2YzEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAgACAEgAAABIAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY//8AAAAxYXZjQwFkAAr/4QAYZ2QACqzZX4iIhAAAAwAEAAADAFA8SJZYAQAGaOvjyyLAAAAAGHN0dHMAAAAAAAAAAQAAAAEAAAQAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAAQAAABRzdHN6AAAAAAAAAsUAAAABAAAAFHN0Y28AAAAAAAAAAQAAADAAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjU3LjgzLjEwMA==';

// Detect iOS Safari (not in native app)
function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isWebKit = /WebKit/i.test(ua);
  const isChrome = /CriOS/i.test(ua);
  const isFirefox = /FxiOS/i.test(ua);
  // iOS Safari is WebKit but not Chrome or Firefox
  return isIOS && isWebKit && !isChrome && !isFirefox;
}

/**
 * Hook to manage keeping the screen awake.
 * - Native: Uses Capacitor KeepAwake plugin
 * - iOS Safari PWA: Uses silent video loop workaround
 * - Other browsers: Uses Screen Wake Lock API
 */
export function useWakeLock() {
  const native = isNative();
  const isIOSWebRef = useRef(!native && isIOSSafari());

  // "Desired" keeps track of whether the app *wants* the screen to stay awake,
  // even if the OS releases it and we need to re-acquire.
  const desiredRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [state, setState] = useState<WakeLockState>({
    isSupported: native || isIOSWebRef.current || (typeof navigator !== 'undefined' && 'wakeLock' in navigator),
    isActive: false,
    error: null,
  });

  // Native support check (plugin may not be available on all platforms)
  useEffect(() => {
    if (!native) return;

    let cancelled = false;
    (async () => {
      try {
        const { isSupported } = await KeepAwake.isSupported();
        if (!cancelled) {
          setState(prev => ({ ...prev, isSupported }));
        }
      } catch (err) {
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            isSupported: false,
            error: 'KeepAwake no disponible en este dispositivo',
          }));
        }
        console.warn('[WakeLock] KeepAwake.isSupported failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [native]);

  // Create iOS video element for wake lock workaround
  const createIOSVideo = useCallback(() => {
    if (videoRef.current) return videoRef.current;

    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('loop', '');
    video.muted = true;
    video.loop = true;
    video.src = SILENT_VIDEO_BASE64;
    
    // Hide video but keep it in DOM
    Object.assign(video.style, {
      position: 'fixed',
      left: '-9999px',
      top: '-9999px',
      width: '1px',
      height: '1px',
      opacity: '0.01',
      pointerEvents: 'none',
      zIndex: '-1',
    });

    document.body.appendChild(video);
    videoRef.current = video;
    console.log('[WakeLock] Created iOS video element for wake lock');
    return video;
  }, []);

  // Remove iOS video element
  const removeIOSVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.remove();
      videoRef.current = null;
      console.log('[WakeLock] Removed iOS video element');
    }
  }, []);

  // Request wake lock / keep awake
  const requestWakeLock = useCallback(async () => {
    desiredRef.current = true;

    // Native (iOS/Android via Capacitor)
    if (native) {
      if (!state.isSupported) {
        setState(prev => ({ ...prev, error: 'Mantener pantalla activa no soportado' }));
        return false;
      }

      try {
        await KeepAwake.keepAwake();
        setState(prev => ({ ...prev, isActive: true, error: null }));
        console.log('[WakeLock] KeepAwake activated (native)');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al activar KeepAwake';
        setState(prev => ({ ...prev, error: message, isActive: false }));
        console.warn('[WakeLock] KeepAwake.keepAwake failed:', err);
        return false;
      }
    }

    // iOS Safari PWA - use video workaround
    if (isIOSWebRef.current) {
      try {
        const video = createIOSVideo();
        await video.play();
        setState(prev => ({ ...prev, isActive: true, error: null }));
        console.log('[WakeLock] iOS video wake lock activated');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al activar wake lock iOS';
        setState(prev => ({ ...prev, error: message, isActive: false }));
        console.warn('[WakeLock] iOS video play failed:', err);
        return false;
      }
    }

    // Web - use Screen Wake Lock API
    const webSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
    if (!webSupported) {
      setState(prev => ({ ...prev, error: 'Wake Lock no soportado' }));
      return false;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');

      wakeLockRef.current.addEventListener('release', () => {
        // OS released it (e.g. tab hidden). Auto re-acquire is handled by useAutoWakeLock
        // and by the visibilitychange listener below.
        setState(prev => ({ ...prev, isActive: false }));
      });

      setState(prev => ({ ...prev, isActive: true, error: null }));
      console.log('[WakeLock] Screen wake lock activated (web)');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al activar wake lock';
      setState(prev => ({ ...prev, error: message, isActive: false }));
      console.warn('[WakeLock] Failed to activate (web):', err);
      return false;
    }
  }, [native, state.isSupported, createIOSVideo]);

  // Release wake lock
  const releaseWakeLock = useCallback(async () => {
    desiredRef.current = false;

    if (native) {
      try {
        await KeepAwake.allowSleep();
        setState(prev => ({ ...prev, isActive: false }));
        console.log('[WakeLock] KeepAwake released (native)');
      } catch (err) {
        console.warn('[WakeLock] KeepAwake.allowSleep failed:', err);
      }
      return;
    }

    // iOS Safari - remove video
    if (isIOSWebRef.current) {
      removeIOSVideo();
      setState(prev => ({ ...prev, isActive: false }));
      console.log('[WakeLock] iOS video wake lock released');
      return;
    }

    // Web
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setState(prev => ({ ...prev, isActive: false }));
        console.log('[WakeLock] Screen wake lock released (web)');
      } catch (err) {
        console.warn('[WakeLock] Error releasing (web):', err);
      }
    }
  }, [native, removeIOSVideo]);

  // Re-acquire when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!desiredRef.current) return;

      if (native) {
        try {
          await KeepAwake.keepAwake();
          setState(prev => ({ ...prev, isActive: true, error: null }));
        } catch {
          // ignore
        }
        return;
      }

      // iOS Safari - resume video
      if (isIOSWebRef.current && videoRef.current) {
        try {
          await videoRef.current.play();
          setState(prev => ({ ...prev, isActive: true, error: null }));
          console.log('[WakeLock] iOS video resumed on visibility change');
        } catch (err) {
          console.warn('[WakeLock] Could not resume iOS video:', err);
        }
        return;
      }

      // Web
      if (!wakeLockRef.current) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          wakeLockRef.current.addEventListener('release', () => {
            setState(prev => ({ ...prev, isActive: false }));
          });
          setState(prev => ({ ...prev, isActive: true, error: null }));
          console.log('[WakeLock] Re-acquired wake lock on visibility change');
        } catch (err) {
          console.warn('[WakeLock] Could not re-acquire wake lock:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [native]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      desiredRef.current = false;

      if (native) {
        KeepAwake.allowSleep().catch(() => {});
        return;
      }

      // iOS Safari cleanup
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.remove();
        videoRef.current = null;
      }

      if (wakeLockRef.current) {
        wakeLockRef.current.release();
      }
    };
  }, [native]);

  return {
    ...state,
    requestWakeLock,
    releaseWakeLock,
  };
}

/**
 * Hook that automatically manages wake lock for a component
 * @param shouldLock - Whether to keep wake lock active
 */
export function useAutoWakeLock(shouldLock: boolean) {
  const { isSupported, isActive, error, requestWakeLock, releaseWakeLock } = useWakeLock();

  useEffect(() => {
    if (shouldLock && isSupported) {
      requestWakeLock();
    } else if (!shouldLock && isActive) {
      releaseWakeLock();
    }
  }, [shouldLock, isSupported, isActive, requestWakeLock, releaseWakeLock]);

  return { isSupported, isActive, error };
}
