import { useEffect } from 'react';

/**
 * Hook to handle iOS keyboard issues with fixed bottom navigation.
 * When the keyboard opens on iOS, it can cause the viewport to resize
 * and push the bottom nav up. This hook prevents that behavior.
 */
export const useIOSKeyboardFix = () => {
  useEffect(() => {
    // Only apply on iOS devices
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (!isIOS) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        // Add class to body when keyboard opens
        document.body.classList.add('keyboard-open');
        
        // Store the current scroll position
        const scrollY = window.scrollY;
        document.body.style.setProperty('--scroll-position', `-${scrollY}px`);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      // Small delay to allow for focus changes between inputs
      setTimeout(() => {
        const activeElement = document.activeElement as HTMLElement;
        if (
          !activeElement ||
          (activeElement.tagName !== 'INPUT' &&
            activeElement.tagName !== 'TEXTAREA' &&
            activeElement.tagName !== 'SELECT' &&
            !activeElement.isContentEditable)
        ) {
          // Remove class when keyboard closes
          document.body.classList.remove('keyboard-open');
        }
      }, 100);
    };

    // Use Visual Viewport API if available (modern iOS)
    if (window.visualViewport) {
      const handleViewportResize = () => {
        const bottomNav = document.querySelector('.bottom-nav') as HTMLElement;
        if (!bottomNav) return;

        // Calculate the offset from the visual viewport
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const windowHeight = window.innerHeight;
        const keyboardHeight = windowHeight - viewportHeight;

        const activeElement = document.activeElement as HTMLElement | null;
        const isEditable =
          !!activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.isContentEditable);

        // Only treat a viewport resize as “keyboard open” when an input is focused.
        // This prevents false positives from Safari UI (address bar) resize events
        // that can happen while scrolling (often noticed around images).
        if (isEditable && keyboardHeight > 120) {
          document.body.classList.add('keyboard-open');
        } else {
          document.body.classList.remove('keyboard-open');
        }
      };

      window.visualViewport.addEventListener('resize', handleViewportResize);
      window.visualViewport.addEventListener('scroll', handleViewportResize);

      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);

      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportResize);
        window.visualViewport?.removeEventListener('scroll', handleViewportResize);
        document.removeEventListener('focusin', handleFocusIn);
        document.removeEventListener('focusout', handleFocusOut);
      };
    } else {
      // Fallback for older iOS
      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);

      return () => {
        document.removeEventListener('focusin', handleFocusIn);
        document.removeEventListener('focusout', handleFocusOut);
      };
    }
  }, []);
};

export default useIOSKeyboardFix;
