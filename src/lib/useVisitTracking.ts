import { useEffect } from 'react';
import { trackVisit } from '../services/visits';

export const useVisitTracking = () => {
  useEffect(() => {
    const track = async () => {
      try {
        await trackVisit();
      } catch (error) {
        console.error('Visit tracking failed:', error);
      }
    };
    track();
  }, []);
};
