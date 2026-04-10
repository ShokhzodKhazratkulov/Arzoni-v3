import { useEffect } from 'react';
import OneSignal from 'react-onesignal';
import { useAuth } from '../lib/AuthContext';

export const NotificationHandler = () => {
  const { user } = useAuth();

  useEffect(() => {
    const initOneSignal = async () => {
      const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
      if (!appId) {
        console.warn('OneSignal App ID is missing. Push notifications will not work.');
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

        // Link OneSignal user to our Supabase user ID for targeted notifications later
        if (user) {
          await OneSignal.login(user.id);
          console.log('OneSignal initialized and user logged in:', user.id);
        }
      } catch (error) {
        console.error('Error initializing OneSignal:', error);
      }
    };

    initOneSignal();
  }, [user]);

  return null;
};
