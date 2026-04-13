import { supabase } from '../supabase';
import { v4 as uuidv4 } from 'uuid';

export const trackVisit = async () => {
  const SESSION_KEY = 'arzoni_session_id';
  let sessionId = localStorage.getItem(SESSION_KEY);
  const now = new Date().toISOString();

  if (!sessionId) {
    sessionId = uuidv4();
    localStorage.setItem(SESSION_KEY, sessionId);

    const { error } = await supabase
      .from('app_analytics')
      .insert([{
        session_id: sessionId,
        first_seen_at: now,
        last_seen_at: now,
        visit_count: 1,
        user_agent: navigator.userAgent,
        device_type: 'web'
      }]);
    
    if (error) {
      if (error.code === '406' || error.message?.includes('406')) return;
      console.warn('Analytics tracking failed (non-critical):', error.message);
    }
  } else {
    // We need to find the row with this session_id and update it
    const { data, error: fetchError } = await supabase
      .from('app_analytics')
      .select('id, visit_count')
      .eq('session_id', sessionId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      if (fetchError.code === '406' || fetchError.message?.includes('406')) return;
      console.warn('Analytics fetch failed (non-critical):', fetchError.message);
      return;
    }

    if (data) {
      const { error: updateError } = await supabase
        .from('app_analytics')
        .update({
          last_seen_at: now,
          visit_count: data.visit_count + 1
        })
        .eq('id', data.id);
      
      if (updateError) {
        if (updateError.code === '406' || updateError.message?.includes('406')) return;
        console.warn('Analytics update failed (non-critical):', updateError.message);
      }
    } else {
      // If session_id exists in localStorage but not in DB
      const { error: insertError } = await supabase
        .from('app_analytics')
        .insert([{
          session_id: sessionId,
          first_seen_at: now,
          last_seen_at: now,
          visit_count: 1,
          user_agent: navigator.userAgent,
          device_type: 'web'
        }]);
      
      if (insertError && !(insertError.code === '406' || insertError.message?.includes('406'))) {
        console.warn('Analytics fallback insert failed (non-critical):', insertError.message);
      }
    }
  }
};
