import { useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../supabase';
import { requestForToken, onMessageListener } from '../firebase';

export const NotificationHandler = () => {
  const { user } = useAuth();

  useEffect(() => {
    const setupNotifications = async () => {
      if (!user) return;

      const token = await requestForToken();
      if (token) {
        // Save token to Supabase
        const { error } = await supabase
          .from('user_tokens')
          .upsert({ 
            user_id: user.id, 
            fcm_token: token 
          }, { onConflict: 'fcm_token' });

        if (error) {
          console.error('Error saving FCM token to Supabase:', error);
        }
      }
    };

    setupNotifications();
  }, [user]);

  useEffect(() => {
    const unsubscribe = onMessageListener((payload) => {
      console.log('Notification received in foreground:', payload);
      if (Notification.permission === 'granted') {
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: '/logo192.png'
        });
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  return null;
};
