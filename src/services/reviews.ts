import { supabase } from '../supabase';
import { Review } from '../types';

export const createReview = async (data: Partial<Review>) => {
  const { data: result, error } = await supabase
    .from('reviews')
    .insert([data])
    .select();
  if (error) throw error;
  return result[0];
};

export const getReviewsByListingId = async (listingId: string) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Review[];
};
