/**
 * Service Worker Registration
 *
 * Handles service worker lifecycle:
 * - Registration on page load
 * - Update detection and notification
 * - Manual update trigger
 * - Graceful error handling
 *
 * Used by: main.tsx
 */

// @ts-ignore - Virtual module from vite-plugin-pwa
import { useRegisterSW } from 'virtual:pwa-register/react';

export interface ServiceWorkerUpdateHandler {
  needRefresh: boolean;
  offlineReady: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

/**
 * Hook to register service worker and handle updates
 *
 * Features:
 * - Automatic registration on mount
 * - Detects when new version is available
 * - Provides manual update function
 * - Notifies when app is ready for offline use
 *
 * @param onNeedRefresh - Callback when update is available
 * @param onOfflineReady - Callback when app is cached and ready for offline use
 * @returns Update handler with state and update function
 */
export function useServiceWorkerRegistration(
  onNeedRefresh?: () => void,
  onOfflineReady?: () => void
): ServiceWorkerUpdateHandler {
  const {
    needRefresh,
    offlineReady,
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(swUrl: string, registration: ServiceWorkerRegistration | undefined) {
      console.log('[SW] Service worker registered:', swUrl);

      // Check for updates every hour
      if (registration) {
        setInterval(() => {
          console.log('[SW] Checking for updates...');
          registration.update();
        }, 60 * 60 * 1000); // 1 hour
      }
    },
    onRegisterError(error: Error) {
      console.error('[SW] Service worker registration failed:', error);
    },
    onNeedRefresh() {
      console.log('[SW] New version available');
      onNeedRefresh?.();
    },
    onOfflineReady() {
      console.log('[SW] App ready for offline use');
      onOfflineReady?.();
    },
  });

  return {
    needRefresh,
    offlineReady,
    updateServiceWorker,
  };
}

/**
 * Manually register service worker
 * Use this if not using the React hook
 */
export async function registerServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[SW] Service worker registered:', registration.scope);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] New version available, please refresh');
            // Emit custom event for UI to listen to
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      });

      // Check for updates every hour
      setInterval(() => {
        console.log('[SW] Checking for updates...');
        registration.update();
      }, 60 * 60 * 1000);

      return;
    } catch (error) {
      console.error('[SW] Service worker registration failed:', error);
    }
  } else {
    console.warn('[SW] Service workers not supported');
  }
}

/**
 * Unregister service worker (for cleanup/debugging)
 */
export async function unregisterServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      console.log('[SW] Service worker unregistered');
    }
  }
}

/**
 * Check if service worker is registered and active
 */
export function isServiceWorkerActive(): boolean {
  return !!(
    'serviceWorker' in navigator &&
    navigator.serviceWorker.controller
  );
}

/**
 * Get service worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration ?? null;
  }
  return null;
}
