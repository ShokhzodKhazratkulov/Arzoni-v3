import { useEffect } from 'react';
import OneSignal from 'react-onesignal';
import { useAuth } from '../lib/AuthContext';

export const NotificationHandler = () => {
  const { user } = useAuth();

  useEffect(() => {
    let isInitialized = false;

    const initOneSignal = async () => {
      const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
      if (!appId) {
        console.warn('OneSignal App ID is missing. Push notifications will not work.');
        return;
      }

      // Check if OneSignal script is blocked by ad-blocker
      const isBlocked = !window.location.host.includes('localhost') && 
                        !document.querySelector('script[src*="onesignal"]');
      
      // We'll try to init anyway, but catch the specific error
      
      // Check if already initialized to prevent the "SDK already initialized" error
      if ((window as any).OneSignal?.initialized || isInitialized) {
        if (user && (window as any).OneSignal) {
          await (window as any).OneSignal.login(user.id);
        }
        return;
      }

      try {
        await OneSignal.init({
          appId: appId,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: {
            enable: true,
          } as any,
        });
        
        isInitialized = true;

        if (user) {
          await OneSignal.login(user.id);
          console.log('OneSignal initialized and user logged in:', user.id);
        }
      } catch (error: any) {
        // Ignore "SDK already initialized" errors
        if (error?.message?.includes('already initialized')) return;
        
        // Handle ad-blocker errors
        if (error?.message?.includes('blocked by client') || error?.name === 'TypeError') {
          console.warn('OneSignal was blocked by an ad-blocker or failed to load. Please disable your ad-blocker to receive notifications.');
          return;
        }

        // Handle domain mismatch error specifically
        if (error?.message?.includes('Can only be used on')) {
          console.warn('OneSignal Domain Mismatch: The App ID is configured for a different domain. ' +
            'To fix this, go to OneSignal Dashboard -> Settings -> Platforms -> Web Push and update the Site URL to: ' + 
            window.location.origin);
          return;
        }
        
        console.error('Error initializing OneSignal:', error);
      }
    };

    initOneSignal();
  }, [user]);

  return null;
};
