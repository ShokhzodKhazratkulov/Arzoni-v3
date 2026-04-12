import { supabase } from '../supabase';
import { Restaurant, Banner } from '../types';

export const fetchListings = async (): Promise<Restaurant[]> => {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(r => ({
    ...r,
    avgPrice: r.avg_price,
    avgRating: r.avg_rating,
    reviewCount: r.review_count,
    photoUrl: r.photo_url,
    isSponsored: r.is_sponsored,
    isVerified: r.is_verified,
    sponsoredExpiry: r.sponsored_expiry,
    verifiedExpiry: r.verified_expiry
  })) as Restaurant[];
};

export const updateListing = async (listingId: string, data: Partial<Restaurant>) => {
  const mappedData: any = { ...data };
  if (data.avgPrice !== undefined) mappedData.avg_price = data.avgPrice;
  if (data.avgRating !== undefined) mappedData.avg_rating = data.avgRating;
  if (data.reviewCount !== undefined) mappedData.review_count = data.reviewCount;
  if (data.photoUrl !== undefined) mappedData.photo_url = data.photoUrl;
  if (data.isSponsored !== undefined) mappedData.is_sponsored = data.isSponsored;
  if (data.isVerified !== undefined) mappedData.is_verified = data.isVerified;
  if (data.sponsoredExpiry !== undefined) mappedData.sponsored_expiry = data.sponsoredExpiry;
  if (data.verifiedExpiry !== undefined) mappedData.verified_expiry = data.verifiedExpiry;

  // Remove the camelCase versions to avoid Supabase errors
  delete mappedData.avgPrice;
  delete mappedData.avgRating;
  delete mappedData.reviewCount;
  delete mappedData.photoUrl;
  delete mappedData.isSponsored;
  delete mappedData.isVerified;
  delete mappedData.sponsoredExpiry;
  delete mappedData.verifiedExpiry;

  const { error } = await supabase
    .from('restaurants')
    .update(mappedData)
    .eq('id', listingId);

  if (error) throw error;
};

export const deleteListing = async (listingId: string) => {
  const { error } = await supabase
    .from('restaurants')
    .delete()
    .eq('id', listingId);

  if (error) throw error;
};

export const fetchBanners = async (): Promise<Banner[]> => {
  const { data, error } = await supabase
    .from('banners')
    .select(`
      *,
      restaurants (
        name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(b => ({
    ...b,
    restaurant_name: b.restaurants?.name,
    category: b.category
  })) as Banner[];
};

export const createBanner = async (data: any) => {
  const { error } = await supabase
    .from('banners')
    .insert(data);

  if (error) throw error;
};

export const updateBanner = async (bannerId: string, data: any) => {
  const { error } = await supabase
    .from('banners')
    .update(data)
    .eq('id', bannerId);

  if (error) throw error;
};

export const deleteBanner = async (bannerId: string) => {
  const { error } = await supabase
    .from('banners')
    .delete()
    .eq('id', bannerId);

  if (error) throw error;
};

export const verifyListing = async (listingId: string) => {
  const { error } = await supabase
    .from('restaurants')
    .update({ 
      is_verified: true,
      verified_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    })
    .eq('id', listingId);

  if (error) throw error;
};

export const toggleSponsored = async (listingId: string, sponsored: boolean) => {
  const { error } = await supabase
    .from('restaurants')
    .update({ 
      is_sponsored: sponsored,
      sponsored_expiry: sponsored ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null
    })
    .eq('id', listingId);

  if (error) throw error;
};
