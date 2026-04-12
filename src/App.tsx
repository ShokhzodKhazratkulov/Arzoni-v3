import React, { useState, useEffect, useMemo, ErrorInfo, ReactNode } from 'react';
import { supabase } from './supabase';
import { seedDatabase } from './seed';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { computeDishStats } from './lib/stats';
import AddReviewPage from './components/AddReviewPage';
import RestaurantDetailPage from './components/RestaurantDetailPage';
import { DishStats, Restaurant, Review, Banner, SortOption } from './types';
import { PRICE_RANGES, CLOTHING_PRICE_RANGES } from './constants';
import Navbar from './components/Navbar';
import FilterBar from './components/FilterBar';
import RestaurantList from './components/RestaurantList';
import MapContainer from './components/MapContainer';
import AddRestaurantModal from './components/AddRestaurantModal';
import AdminDashboard from './components/AdminDashboard';
import './i18n';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Map as MapIcon, LayoutList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const [showAdmin, setShowAdmin] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [isBannerPaused, setIsBannerPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'food' | 'clothes'>('food');
  const [selectedDish, setSelectedDish] = useState<string>('Osh');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [sortOption, setSortOption] = useState<SortOption>('price_asc');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [isAddRestaurantOpen, setIsAddRestaurantOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    seedDatabase();

    const fetchData = async () => {
      // Fetch Restaurants
      const { data: restData, error: restError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('category', selectedCategory);

      if (restError) console.error('Error fetching restaurants:', restError);
      
      // Fetch Reviews
      const { data: revData, error: revError } = await supabase
        .from('reviews')
        .select('*');

      if (revError) console.error('Error fetching reviews:', revError);

      if (restData) {
        const mappedRest = restData.map(r => ({
          ...r,
          avgPrice: r.avg_price,
          avgRating: r.avg_rating,
          reviewCount: r.review_count,
          photoUrl: r.photo_url,
          createdAt: r.created_at,
          location: r.location,
        }));
        setRestaurants(mappedRest as Restaurant[]);
      }

      if (revData) {
        const mappedRev = revData.map(r => ({
          ...r,
          priceSpent: r.price_spent,
          dishId: r.dish_id,
          createdAt: r.created_at,
          restaurantId: r.restaurant_id,
        }));
        setAllReviews(mappedRev as Review[]);
      }

      setLoading(false);
    };

    fetchData();

    // Banners
    const fetchBanners = async () => {
      const { data, error } = await supabase
        .from('banners')
        .select('*, restaurants(name, category)')
        .gte('expiry_date', new Date().toISOString());

      if (error) console.error('Error fetching banners:', error);
      else {
        setBanners((data || []).map((b: any) => ({
          ...b,
          restaurant_name: b.restaurants?.name,
          category: b.restaurants?.category
        })) as Banner[]);
      }
    };
    fetchBanners();
  }, [selectedCategory]);

  const restaurantStatsMap = useMemo(() => {
    const statsMap: { [restaurantId: string]: DishStats[] } = {};
    restaurants.forEach(r => {
      if (r.id) {
        const restaurantReviews = allReviews.filter(rev => rev.restaurantId === r.id);
        statsMap[r.id] = computeDishStats(restaurantReviews);
      }
    });
    return statsMap;
  }, [restaurants, allReviews]);

  const filteredRestaurants = useMemo(() => {
    return restaurants.filter(restaurant => {
      if (!restaurant.id) return false;
      const stats = restaurantStatsMap[restaurant.id] || [];
      const dishStats = stats.find(s => s.name === selectedDish);
      
      // Restaurants with zero reviews for that dish must not appear in the list
      if (!dishStats) return false;

      // Price filter
      let matchesPrice = true;
      if (selectedPriceRange !== 'all') {
        const ranges = selectedCategory === 'food' ? PRICE_RANGES : CLOTHING_PRICE_RANGES;
        const range = ranges.find(r => r.id === selectedPriceRange);
        if (range) {
          matchesPrice = dishStats.avgPrice >= range.min && dishStats.avgPrice <= range.max;
        } else if (selectedPriceRange === 'custom') {
          matchesPrice = customPrice === 0 || dishStats.avgPrice <= customPrice;
        }
      }

      return matchesPrice;
    }).sort((a, b) => {
      if (!a.id || !b.id) return 0;
      const statsA = (restaurantStatsMap[a.id] || []).find(s => s.name === selectedDish);
      const statsB = (restaurantStatsMap[b.id] || []).find(s => s.name === selectedDish);

      if (!statsA || !statsB) return 0;

      if (sortOption === 'price_asc') return statsA.avgPrice - statsB.avgPrice;
      if (sortOption === 'price_desc') return statsB.avgPrice - statsA.avgPrice;
      if (sortOption === 'rating') return statsB.avgRating - statsA.avgRating;
      return 0;
    });
  }, [restaurants, restaurantStatsMap, selectedDish, selectedPriceRange, customPrice, sortOption, selectedCategory]);

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

  const handleBannerClick = (banner: Banner) => {
    navigate(`/restaurants/${banner.restaurant_id}`);
  };

  const handleAddRestaurant = async (data: any) => {
    const { photoFile, ...rest } = data;
    let photoUrl = '';

    if (photoFile) {
      const fileName = `${Date.now()}-${photoFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('restaurant-photos')
        .upload(fileName, photoFile);

      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('restaurant-photos')
        .getPublicUrl(fileName);
      photoUrl = publicUrl;
    }

    const { error } = await supabase.from('restaurants').insert([{
      ...rest,
      photo_url: photoUrl,
      avg_price: rest.price,
      avg_rating: 0,
      review_count: 0
    }]);

    if (error) throw error;
    window.location.reload();
  };

  const handleAddReview = async (restaurantId: string, reviewData: any) => {
    const { photoFiles, ...rest } = reviewData;
    const photoUrls: string[] = [];

    if (photoFiles && photoFiles.length > 0) {
      for (const file of photoFiles) {
        const fileName = `${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('review-photos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from('review-photos')
          .getPublicUrl(fileName);
        photoUrls.push(publicUrl);
      }
    }

    const { error } = await supabase.from('reviews').insert([{
      ...rest,
      restaurant_id: restaurantId,
      photo_urls: photoUrls,
      price_spent: rest.priceSpent,
      dish_id: rest.dishId
    }]);

    if (error) throw error;
    window.location.reload();
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
        
        <Routes>
          <Route path="/" element={
            <main className="flex-1 flex flex-col">
              {/* Banner Section */}
              {filteredBanners.length > 0 && (
                <div className="w-full bg-white border-b border-gray-100 pt-1 pb-2 overflow-hidden">
                  <div className="max-w-[1600px] mx-auto px-2 sm:px-4">
                    <div className="lg:hidden relative h-[140px] sm:h-[160px] w-full overflow-hidden rounded-3xl shadow-xl shadow-gray-200/50">
                      <AnimatePresence mode="wait">
                        {filteredBanners[activeBannerIndex] && (
                          <motion.div 
                            key={filteredBanners[activeBannerIndex].id}
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            className="absolute inset-0"
                            onClick={() => handleBannerClick(filteredBanners[activeBannerIndex])}
                          >
                            <img 
                              src={getBannerImage(filteredBanners[activeBannerIndex])} 
                              alt="Banner" 
                              className="w-full h-full object-cover" 
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="hidden lg:grid grid-cols-3 gap-4">
                      {filteredBanners.slice(0, 3).map((banner) => (
                        <div 
                          key={banner.id}
                          onClick={() => handleBannerClick(banner)}
                          className="relative h-[130px] rounded-2xl overflow-hidden shadow-lg border border-gray-100 cursor-pointer"
                        >
                          <img src={getBannerImage(banner)} alt="Banner" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <FilterBar 
                selectedCategory={selectedCategory}
                setSelectedCategory={(cat) => {
                  setSelectedCategory(cat);
                  setSelectedDish(cat === 'food' ? 'Osh' : 'T-shirt');
                  setSelectedPriceRange('all');
                }}
                selectedDishes={[selectedDish]}
                setSelectedDishes={(dishes) => setSelectedDish(dishes[0] || (selectedCategory === 'food' ? 'Osh' : 'T-shirt'))}
                selectedPriceRange={selectedPriceRange}
                setSelectedPriceRange={setSelectedPriceRange}
                customPrice={customPrice}
                setCustomPrice={setCustomPrice}
                customDish={''}
                setCustomDish={() => {}}
              />

              {/* View Mode Toggle */}
              <div className="max-w-7xl mx-auto px-4 py-2 flex justify-end">
                <div className="bg-white rounded-xl border border-gray-100 p-1 flex shadow-sm">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === 'list' ? 'bg-[#1D9E75] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <LayoutList size={14} />
                    {t('listView') || 'List'}
                  </button>
                  <button
                    onClick={() => setViewMode('map')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === 'map' ? 'bg-[#1D9E75] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <MapIcon size={14} />
                    {t('mapView') || 'Map'}
                  </button>
                </div>
              </div>

              {viewMode === 'map' ? (
                <div className="max-w-7xl mx-auto px-4 py-4 w-full">
                  <MapContainer 
                    restaurants={filteredRestaurants}
                    onAddRestaurant={() => setIsAddRestaurantOpen(true)}
                    selectedDishes={[selectedDish]}
                    selectedCategory={selectedCategory}
                  />
                </div>
              ) : (
                <RestaurantList 
                  restaurants={filteredRestaurants}
                  sortOption={sortOption}
                  setSortOption={setSortOption}
                  onAddReview={(r) => navigate(`/restaurants/${r.id}/review`)}
                  selectedDishes={[selectedDish]}
                  selectedCategory={selectedCategory}
                  restaurantStatsMap={restaurantStatsMap}
                />
              )}
            </main>
          } />
          <Route path="/restaurants/:id" element={<RestaurantDetailPage />} />
          <Route path="/restaurants/:id/review" element={<AddReviewPage />} />
        </Routes>

        <AddRestaurantModal 
          isOpen={isAddRestaurantOpen}
          onClose={() => setIsAddRestaurantOpen(false)}
          onSubmit={handleAddRestaurant}
          onAddReview={handleAddReview}
          selectedCategory={selectedCategory}
        />

        {loading && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[200] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 w-full max-w-xs px-6">
              <div className="w-12 h-12 border-4 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
              <p className="text-[#1D9E75] font-bold animate-pulse">{t('loading')}</p>
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
