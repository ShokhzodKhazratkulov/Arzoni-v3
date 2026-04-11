import React, { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { supabase } from './supabase';
import imageCompression from 'browser-image-compression';
import { seedDatabase } from './seed';
import { Restaurant, SortOption, Review, Banner } from './types';
import { DISH_TYPES, CLOTHING_TYPES, PRICE_RANGES, CLOTHING_PRICE_RANGES } from './constants';
import Navbar from './components/Navbar';
import FilterBar from './components/FilterBar';
import StatsBar from './components/StatsBar';
import MapContainer from './components/MapContainer';
import RestaurantList from './components/RestaurantList';
import AddRestaurantModal from './components/AddRestaurantModal';
import AdminDashboard from './components/AdminDashboard';
import './i18n';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import RestaurantDetailsModal from './components/RestaurantDetailsModal';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { NotificationHandler } from './components/NotificationHandler';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "{}");
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-red-100">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Error</h2>
            <p className="text-gray-600 mb-8">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#1D9E75] text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-[#168a65] transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [isBannerPaused, setIsBannerPaused] = useState(false);
  const [selectedRestaurantForDetails, setSelectedRestaurantForDetails] = useState<Restaurant | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'food' | 'clothes'>('food');
  const [selectedDishes, setSelectedDishes] = useState<string[]>([]);
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [customDish, setCustomDish] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('price_asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialRestaurantForModal, setInitialRestaurantForModal] = useState<Restaurant | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Seed database with sample data if empty
    seedDatabase();

    const fetchRestaurants = async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('category', selectedCategory)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching restaurants:', error);
      } else {
        // Map snake_case from DB to camelCase for the UI
        const mappedData = (data || []).map(r => ({
          ...r,
          avgPrice: r.avg_price,
          avgRating: r.avg_rating,
          reviewCount: r.review_count,
          totalReviews: r.total_reviews,
          photoUrl: r.photo_url,
          createdAt: r.created_at,
          dishScore: r.dish_score,
          dishPrices: r.dish_prices,
          dishStats: r.dish_stats,
          isSponsored: r.is_sponsored,
          isVerified: r.is_verified,
          workingHours: r.working_hours,
          sponsoredExpiry: r.sponsored_expiry,
          verifiedExpiry: r.verified_expiry
        }));
        // Deduplicate by ID
        const uniqueRestaurants = Array.from(
          new Map(mappedData.map(r => [r.id, r])).values()
        );
        setRestaurants(uniqueRestaurants as Restaurant[]);
      }
      setLoading(false);
    };

    fetchRestaurants();

    const fetchBanners = async () => {
      const { data, error } = await supabase
        .from('banners')
        .select('*, restaurants(name, category)')
        .gte('expiry_date', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching banners:', error);
      } else {
        const mappedBanners = (data || []).map((b: any) => ({
          ...b,
          restaurant_name: b.restaurants?.name,
          category: b.restaurants?.category
        }));
        // Deduplicate by ID
        const uniqueBanners = Array.from(
          new Map(mappedBanners.map(b => [b.id, b])).values()
        );
        setBanners(uniqueBanners as Banner[]);
      }
    };

    fetchBanners();

    // Set up real-time subscription
    const channel = supabase
      .channel('restaurants_changes')
      .on('postgres_changes', { 
        event: '*', 
        table: 'restaurants', 
        schema: 'public',
        filter: `category=eq.${selectedCategory}`
      }, () => {
        fetchRestaurants();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCategory]);

  const filteredRestaurants = useMemo(() => {
    // First, filter out duplicates by ID to prevent React key errors
    const idMap = new Map<string, Restaurant>();
    restaurants.forEach(r => {
      if (r.id && !idMap.has(r.id)) {
        idMap.set(r.id, r);
      }
    });
    const uniqueById = Array.from(idMap.values());

    // Then, filter out duplicates by name and address just in case
    const uniqueMap = new Map<string, Restaurant>();
    uniqueById.forEach(r => {
      const compositeId = `${r.name}|${r.address}`.toLowerCase().trim();
      if (!uniqueMap.has(compositeId)) {
        uniqueMap.set(compositeId, r);
      }
    });
    const uniqueRestaurants = Array.from(uniqueMap.values());

    return uniqueRestaurants.filter(restaurant => {
      // Dish filter
      let matchesDishes = selectedDishes.length === 0;
      
      if (selectedDishes.length > 0) {
        matchesDishes = selectedDishes.some(dish => {
          if (dish === 'custom') {
            if (!customDish) return true; // If custom selected but no text, show all (or could show none)
            // Check if any of the restaurant's dishes match the custom string (case-insensitive)
            return restaurant.dishes.some(d => d.toLowerCase().includes(customDish.toLowerCase()));
          }
          return restaurant.dishes.includes(dish);
        });
      }
      
      // Price filter
      let matchesPrice = true;
      
      // Determine the effective price for this restaurant based on selected dishes
      const activeDishId = (() => {
        if (selectedDishes.length === 0) return null;
        
        if (selectedDishes.includes('custom') && customDish) {
          const normalizedSearch = customDish.toLowerCase();
          const matchingKey = Object.keys(restaurant.dishStats || {}).find(k => k.toLowerCase() === normalizedSearch);
          return matchingKey || customDish;
        }
        
        const foundId = selectedDishes.find(id => {
          const normalizedId = id.toLowerCase();
          const matchingKey = Object.keys(restaurant.dishStats || {}).find(k => k.toLowerCase() === normalizedId);
          return matchingKey && restaurant.dishStats[matchingKey]?.bestComment;
        });

        if (foundId) {
          const normalizedId = foundId.toLowerCase();
          return Object.keys(restaurant.dishStats || {}).find(k => k.toLowerCase() === normalizedId) || foundId;
        }

        const firstId = selectedDishes[0];
        const normalizedFirstId = firstId.toLowerCase();
        return Object.keys(restaurant.dishStats || {}).find(k => k.toLowerCase() === normalizedFirstId) || firstId;
      })();

      const effectivePrice = activeDishId && restaurant.dishStats?.[activeDishId] 
        ? restaurant.dishStats[activeDishId].avgPrice 
        : (restaurant.avgPrice || restaurant.price);

      if (selectedPriceRange === 'custom') {
        matchesPrice = customPrice === 0 || effectivePrice <= customPrice;
      } else {
        const ranges = selectedCategory === 'food' ? PRICE_RANGES : CLOTHING_PRICE_RANGES;
        const range = ranges.find(r => r.id === selectedPriceRange);
        if (range) {
          matchesPrice = effectivePrice >= range.min && effectivePrice <= range.max;
        }
      }

      return matchesDishes && matchesPrice;
    }).sort((a, b) => {
      // Priority 1: Sponsored status (check expiry)
      const isASponsored = a.isSponsored && (!a.sponsoredExpiry || new Date(a.sponsoredExpiry) > new Date());
      const isBSponsored = b.isSponsored && (!b.sponsoredExpiry || new Date(b.sponsoredExpiry) > new Date());

      if (isASponsored !== isBSponsored) {
        return isASponsored ? -1 : 1;
      }

      const getEffectivePrice = (r: Restaurant) => {
        const dishId = (() => {
          if (selectedDishes.length === 0) return null;
          if (selectedDishes.includes('custom') && customDish) {
            const normalizedSearch = customDish.toLowerCase();
            const matchingKey = Object.keys(r.dishStats || {}).find(k => k.toLowerCase() === normalizedSearch);
            return matchingKey || customDish;
          }
          const foundId = selectedDishes.find(id => {
            const normalizedId = id.toLowerCase();
            const matchingKey = Object.keys(r.dishStats || {}).find(k => k.toLowerCase() === normalizedId);
            return matchingKey && r.dishStats[matchingKey]?.bestComment;
          });
          if (foundId) {
            const normalizedId = foundId.toLowerCase();
            return Object.keys(r.dishStats || {}).find(k => k.toLowerCase() === normalizedId) || foundId;
          }
          const firstId = selectedDishes[0];
          const normalizedFirstId = firstId.toLowerCase();
          return Object.keys(r.dishStats || {}).find(k => k.toLowerCase() === normalizedFirstId) || firstId;
        })();

        return dishId && r.dishStats?.[dishId] 
          ? r.dishStats[dishId].avgPrice 
          : (r.avgPrice || r.price);
      };

      // If a single dish is selected, sort by dishScore for that dish
      if (selectedDishes.length === 1) {
        let dishId = selectedDishes[0] === 'custom' ? customDish : selectedDishes[0];
        if (dishId) {
          dishId = dishId.toLowerCase(); // Normalize for lookup
          
          // Find the key in dishScore that matches (case-insensitive)
          const scoreKeyA = Object.keys(a.dishScore || {}).find(k => k.toLowerCase() === dishId);
          const scoreKeyB = Object.keys(b.dishScore || {}).find(k => k.toLowerCase() === dishId);
          
          const scoreA = scoreKeyA ? a.dishScore![scoreKeyA] : 0;
          const scoreB = scoreKeyB ? b.dishScore![scoreKeyB] : 0;
          
          if (scoreA !== scoreB) return scoreB - scoreA;
        }
      }

      if (sortOption === 'price_asc') return getEffectivePrice(a) - getEffectivePrice(b);
      if (sortOption === 'price_desc') return getEffectivePrice(b) - getEffectivePrice(a);
      if (sortOption === 'rating') return b.rating - a.rating;
      return 0;
    });
  }, [restaurants, selectedDishes, selectedPriceRange, customPrice, customDish, sortOption, selectedCategory]);

  const handleOpenReviewModal = (restaurant: Restaurant) => {
    setInitialRestaurantForModal(restaurant);
    setIsModalOpen(true);
  };

  const uploadImage = async (file: File, path: string) => {
    console.log(`Starting upload to ${path}...`);
    
    // Image compression options
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    let fileToUpload = file;
    try {
      console.log('Compressing image...');
      fileToUpload = await imageCompression(file, options);
      console.log(`Compression complete. Original size: ${file.size / 1024 / 1024}MB, New size: ${fileToUpload.size / 1024 / 1024}MB`);
    } catch (error) {
      console.error('Compression failed, uploading original:', error);
    }

    setIsUploading(true);
    setUploadProgress(0);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${path}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('photos')
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      setIsUploading(false);
      throw error;
    }

    setIsUploading(false);
    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleAddRestaurant = async (data: any) => {
    try {
      // Check for duplicates first
      const identifier = `${data.name}|${data.address}`.toLowerCase().trim();
      const isDuplicate = restaurants.some(r => `${r.name}|${r.address}`.toLowerCase().trim() === identifier);
      
      if (isDuplicate) {
        console.warn("Restaurant already exists!");
        setIsModalOpen(false);
        return;
      }

      setLoading(true);
      let photoUrl = '';
      if (data.photoFile) {
        photoUrl = await uploadImage(data.photoFile, 'restaurants');
      }

      const { photoFile, ...restData } = data;
      const restaurantData = {
        name: restData.name,
        address: restData.address,
        category: restData.category,
        dishes: restData.dishes,
        price: restData.price,
        photo_url: photoUrl,
        rating: 0,
        avg_rating: 0,
        review_count: 0,
        total_reviews: 0,
        avg_price: data.price,
        likes: 0,
        dislikes: 0,
        dish_score: {},
        description: restData.description,
        working_hours: restData.workingHours,
        submitter: restData.submitter,
        location: restData.location,
        is_sponsored: false,
        is_verified: false,
        created_at: new Date().toISOString()
      };
      
      const { error: error } = await supabase
        .from('restaurants')
        .insert([restaurantData]);

      if (error) throw error;
      console.log('Restaurant added successfully!');
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error adding restaurant:', error);
      throw error; // Re-throw to be caught by the modal
    } finally {
      setLoading(false);
    }
  };

  const recalculateRestaurantMetrics = async (restaurantId: string) => {
    try {
      // Fetch the restaurant to get its initial price, category and current dishes
      const { data: restaurant, error: restFetchError } = await supabase
        .from('restaurants')
        .select('price, category, dishes')
        .eq('id', restaurantId)
        .single();

      if (restFetchError) throw restFetchError;

      const { data: reviewsData, error: fetchError } = await supabase
        .from('reviews')
        .select('*')
        .eq('restaurant_id', restaurantId);

      if (fetchError) throw fetchError;
      
      const reviews = (reviewsData || []).map(r => ({
        ...r,
        priceSpent: r.price_spent,
        dishId: r.dish_id
      }));

      const reviewCount = reviews.length;
      if (reviewCount === 0) return;

      const totalRating = reviews.reduce((acc, curr) => acc + curr.rating, 0);
      const avgRating = totalRating / reviewCount;
      
      const totalPrice = reviews.reduce((acc, curr) => acc + curr.priceSpent, 0) + (restaurant.price || 0);
      const avgPrice = Math.round(totalPrice / (reviewCount + 1));

      const dishCounts: { [dishId: string]: number } = {};
      const dishGroupedPrices: { [dishId: string]: number[] } = {};
      const dishDisplayNames: { [dishId: string]: string } = {}; // Store original casing for display
      
      const currentTypes = restaurant.category === 'food' ? DISH_TYPES : CLOTHING_TYPES;

      reviews.forEach(review => {
        if (review.dishId && review.priceSpent > 0) {
          const isPredefined = currentTypes.some(d => d.id === review.dishId);
          const normalizedId = isPredefined ? review.dishId : review.dishId.toLowerCase();
          
          if (!isPredefined && !dishDisplayNames[normalizedId]) {
            dishDisplayNames[normalizedId] = review.dishId; // Keep the first casing we find
          }

          dishCounts[normalizedId] = (dishCounts[normalizedId] || 0) + 1;
          if (!dishGroupedPrices[normalizedId]) dishGroupedPrices[normalizedId] = [];
          dishGroupedPrices[normalizedId].push(review.priceSpent);
        }
      });

      const dishScore: { [dishId: string]: number } = {};
      const dishStats: { [dishId: string]: { avgPrice: number; reviewCount: number; bestComment?: string; displayName?: string } } = {};
      
      Object.keys(dishCounts).forEach(dishId => {
        dishScore[dishId] = reviewCount > 0 ? dishCounts[dishId] / reviewCount : 0;
        const prices = dishGroupedPrices[dishId];
        const avgDishPrice = prices.length > 0 
          ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
          : 0;
        
        const isPredefined = currentTypes.some(d => d.id === dishId);
        const dishReviews = reviews.filter(r => {
          const rId = isPredefined ? r.dishId : (r.dishId?.toLowerCase());
          return rId === dishId;
        });

        const reviewsWithComments = dishReviews.filter(r => r.comment && r.comment.trim().length > 0);
        const bestReview = reviewsWithComments.length > 0
          ? reviewsWithComments.reduce((prev, curr) => (curr.likes || 0) > (prev.likes || 0) ? curr : prev, reviewsWithComments[0])
          : null;
        
        if (avgDishPrice > 0) {
          dishStats[dishId] = {
            avgPrice: avgDishPrice,
            reviewCount: dishCounts[dishId],
            bestComment: bestReview?.comment,
            displayName: dishDisplayNames[dishId] // Will be undefined for predefined
          };
        }
      });

      // Merge existing dishes with new ones from reviews
      const updatedDishes = Array.from(new Set([...(restaurant.dishes || []), ...(Object.keys(dishCounts))]));

      await supabase
        .from('restaurants')
        .update({
          rating: avgRating,
          avg_rating: avgRating,
          avg_price: avgPrice,
          review_count: reviewCount,
          total_reviews: reviewCount,
          dish_score: dishScore,
          dish_stats: dishStats,
          dishes: updatedDishes
        })
        .eq('id', restaurantId);
    } catch (error) {
      console.error('Error recalculating metrics:', error);
      throw error;
    }
  };

  const handleAddReview = async (restaurantId: string, reviewData: any) => {
    try {
      setLoading(true);
      let photoUrls: string[] = [];
      if (reviewData.photoFiles && reviewData.photoFiles.length > 0) {
        const uploadPromises = reviewData.photoFiles.map((file: File) => 
          uploadImage(file, `reviews/${restaurantId}`)
        );
        photoUrls = await Promise.all(uploadPromises);
      }

      const { photoFiles, ...restReviewData } = reviewData;
      
      // 1. Add review
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert([{
          restaurant_id: restaurantId,
          rating: restReviewData.rating,
          comment: restReviewData.comment,
          submitter: restReviewData.submitter,
          price_spent: restReviewData.priceSpent,
          dish_id: restReviewData.dishId,
          photo_url: photoUrls[0] || null,
          photo_urls: photoUrls,
          created_at: new Date().toISOString(),
          likes: 0,
          dislikes: 0
        }]);

      if (reviewError) throw reviewError;

      // 2. Recalculate all metrics
      await recalculateRestaurantMetrics(restaurantId);

      console.log('Review added and restaurant metrics updated successfully!');
      setIsModalOpen(false);
      setInitialRestaurantForModal(null);
    } catch (error) {
      console.error('Error adding review:', error);
      throw error; // Re-throw to be caught by the modal
    } finally {
      setLoading(false);
    }
  };

  const handleReviewReact = async (reviewId: string, type: 'likes' | 'dislikes') => {
    try {
      // 1. Get the review to find the restaurant_id
      const { data: review, error: fetchError } = await supabase
        .from('reviews')
        .select('restaurant_id')
        .eq('id', reviewId)
        .single();
      
      if (fetchError) throw fetchError;

      // 2. Increment reaction
      const { error: reactError } = await supabase.rpc('increment_review_reaction', {
        review_id: reviewId,
        reaction_type: type
      });
      if (reactError) throw reactError;

      // 3. Recalculate metrics for the restaurant (to update bestComment)
      if (review?.restaurant_id) {
        await recalculateRestaurantMetrics(review.restaurant_id);
      }
    } catch (error) {
      console.error('Error reacting to review:', error);
    }
  };

  const filteredBanners = useMemo(() => {
    return banners.filter(b => b.category === selectedCategory);
  }, [banners, selectedCategory]);

  useEffect(() => {
    if (filteredBanners.length <= 1 || isBannerPaused) return;

    const interval = setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % filteredBanners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [filteredBanners.length, isBannerPaused]);

  // Reset index when category changes
  useEffect(() => {
    setActiveBannerIndex(0);
  }, [selectedCategory]);

  const handleBannerClick = (banner: Banner) => {
    const restaurant = restaurants.find(r => r.id === banner.restaurant_id);
    if (restaurant) {
      setSelectedRestaurantForDetails(restaurant);
      setIsDetailsModalOpen(true);
    }
  };

  const getBannerImage = (banner: Banner) => {
    const lang = i18n.language;
    if (lang === 'uz' && banner.image_url_uz) return banner.image_url_uz;
    if (lang === 'ru' && banner.image_url_ru) return banner.image_url_ru;
    if (lang === 'en' && banner.image_url_en) return banner.image_url_en;
    return banner.image_url;
  };

  if (showAdmin && isAdmin) {
    return <AdminDashboard onBack={() => setShowAdmin(false)} />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <NotificationHandler />
        <Navbar onAdminClick={() => setShowAdmin(true)} />
        
        <main className="flex-1 flex flex-col">
          {/* Banner Section */}
          {filteredBanners.length > 0 && (
            <div className="w-full bg-white border-b border-gray-100 pt-1 pb-2 overflow-hidden">
              <div className="max-w-[1600px] mx-auto px-2 sm:px-4">
                {/* Mobile/Tablet Carousel */}
                <div 
                  className="lg:hidden relative h-[140px] sm:h-[160px] w-full overflow-hidden rounded-3xl shadow-xl shadow-gray-200/50"
                  onMouseEnter={() => setIsBannerPaused(true)}
                  onMouseLeave={() => setIsBannerPaused(false)}
                  onTouchStart={() => setIsBannerPaused(true)}
                  onTouchEnd={() => setIsBannerPaused(false)}
                >
                  <AnimatePresence mode="wait">
                    {filteredBanners[activeBannerIndex] && (
                      <motion.div 
                        key={filteredBanners[activeBannerIndex].id}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        onDragEnd={(_, info) => {
                          if (info.offset.x > 50) {
                            setActiveBannerIndex((prev) => (prev - 1 + filteredBanners.length) % filteredBanners.length);
                          } else if (info.offset.x < -50) {
                            setActiveBannerIndex((prev) => (prev + 1) % filteredBanners.length);
                          }
                        }}
                        className="absolute inset-0 group touch-pan-y"
                      >
                        <img 
                          src={getBannerImage(filteredBanners[activeBannerIndex])} 
                          alt={filteredBanners[activeBannerIndex].restaurant_name || "Ad Banner"} 
                          className="w-full h-full object-cover" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-4 sm:p-6">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBannerClick(filteredBanners[activeBannerIndex]);
                            }}
                            className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/30 hover:bg-white/40 transition-colors cursor-pointer active:scale-95"
                          >
                            <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">
                              {filteredBanners[activeBannerIndex].restaurant_name || t('sponsored')}
                            </span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Indicators */}
                  {filteredBanners.length > 1 && (
                    <div className="absolute bottom-4 right-6 flex gap-1.5 z-10">
                      {filteredBanners.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveBannerIndex(idx);
                          }}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            idx === activeBannerIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Desktop Grid (3 columns) */}
                <div className="hidden lg:grid grid-cols-3 gap-4">
                  {filteredBanners.slice(0, 3).map((banner) => (
                    <motion.div 
                      key={banner.id}
                      whileHover={{ y: -4 }}
                      className="relative h-[130px] rounded-2xl overflow-hidden shadow-lg shadow-gray-200/50 group border border-gray-100"
                    >
                      <img 
                        src={getBannerImage(banner)} 
                        alt={banner.restaurant_name || "Ad Banner"} 
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-4">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBannerClick(banner);
                          }}
                          className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/30 hover:bg-white/40 transition-colors cursor-pointer"
                        >
                          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                          <span className="text-[9px] font-black text-white uppercase tracking-widest">
                            {banner.restaurant_name || t('sponsored')}
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <FilterBar 
            selectedCategory={selectedCategory}
            setSelectedCategory={(cat) => {
              setSelectedCategory(cat);
              setSelectedDishes([]);
              setSelectedPriceRange('all');
              setCustomDish('');
            }}
            selectedDishes={selectedDishes}
            setSelectedDishes={setSelectedDishes}
            selectedPriceRange={selectedPriceRange}
            setSelectedPriceRange={setSelectedPriceRange}
            customPrice={customPrice}
            setCustomPrice={setCustomPrice}
            customDish={customDish}
            setCustomDish={setCustomDish}
          />

          <StatsBar 
            restaurants={filteredRestaurants} 
            selectedCategory={selectedCategory}
          />

          <div className="p-4 max-w-7xl mx-auto w-full space-y-6">
            <MapContainer 
              restaurants={filteredRestaurants} 
              onAddRestaurant={() => setIsModalOpen(true)}
              selectedDishes={selectedDishes}
              customDish={customDish}
              selectedCategory={selectedCategory}
            />

            <RestaurantList 
              restaurants={filteredRestaurants}
              sortOption={sortOption}
              setSortOption={setSortOption}
              onAddReview={handleOpenReviewModal}
              selectedDishes={selectedDishes}
              customDish={customDish}
              selectedCategory={selectedCategory}
            />
          </div>
        </main>

        <AddRestaurantModal 
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setInitialRestaurantForModal(null);
          }}
          onSubmit={handleAddRestaurant}
          onAddReview={handleAddReview}
          initialRestaurant={initialRestaurantForModal}
          selectedCategory={selectedCategory}
        />

        {selectedRestaurantForDetails && (
          <RestaurantDetailsModal 
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false);
              setSelectedRestaurantForDetails(null);
            }}
            restaurant={selectedRestaurantForDetails}
            onAddReview={() => {
              setIsDetailsModalOpen(false);
              handleOpenReviewModal(selectedRestaurantForDetails);
            }}
            selectedCategory={selectedCategory}
          />
        )}

        {loading && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[200] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 w-full max-w-xs px-6">
              <div className="w-12 h-12 border-4 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
              <p className="text-[#1D9E75] font-bold animate-pulse">
                {isUploading ? t('uploading') || 'Uploading...' : t('loading')}
              </p>
              
              {isUploading && (
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    className="bg-[#1D9E75] h-full"
                  />
                </div>
              )}
              
              {isUploading && (
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {Math.round(uploadProgress)}%
                </p>
              )}
            </div>
          </div>
        )}

        <footer className="bg-white border-t border-gray-100 py-8 px-4 mt-12">
          <div className="max-w-7xl mx-auto text-center">
            <div className="flex justify-center gap-0.5 mb-4 items-center">
              <div className="w-8 h-4 bg-[#1D9E75]" title="Green"></div>
              <div className="w-1 h-4 bg-[#CE1126]" title="Red"></div>
              <div className="w-8 h-4 bg-white border border-gray-100" title="White"></div>
              <div className="w-1 h-4 bg-[#CE1126]" title="Red"></div>
              <div className="w-8 h-4 bg-[#0099B5]" title="Blue"></div>
            </div>
            <p className="text-gray-400 text-xs font-medium whitespace-nowrap">
              &copy; {new Date().getFullYear()} Arzoni — {t('taglinePart1')} {t('foodItem')}/{t('clothesItem')} {t('taglinePart2')}
            </p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
