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
      .from('visits')
      .insert([{
        session_id: sessionId,
        first_seen_at: now,
        last_seen_at: now,
        visit_count: 1,
        user_agent: navigator.userAgent,
        device_type: 'web'
      }]);
    
    if (error) console.error('Error tracking new visit:', error);
  } else {
    // We need to find the row with this session_id and update it
    // Note: In a real app, we might want to handle multiple rows per session if we track daily visits
    // but for simplicity, we'll just update the existing row or create a new one if not found
    
    const { data, error: fetchError } = await supabase
      .from('visits')
      .select('id, visit_count')
      .eq('session_id', sessionId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error fetching visit record:', fetchError);
      return;
    }

    if (data) {
      const { error: updateError } = await supabase
        .from('visits')
        .update({
          last_seen_at: now,
          visit_count: data.visit_count + 1
        })
        .eq('id', data.id);
      
      if (updateError) console.error('Error updating visit:', updateError);
    } else {
      // If session_id exists in localStorage but not in DB (e.g. DB reset)
      await supabase
        .from('visits')
        .insert([{
          session_id: sessionId,
          first_seen_at: now,
          last_seen_at: now,
          visit_count: 1,
          user_agent: navigator.userAgent,
          device_type: 'web'
        }]);
    }
  }
};
