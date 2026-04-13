import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Star, Navigation, MessageSquare, TrendingUp, DollarSign, Globe } from 'lucide-react';
import { Review, Listing, DishStats } from '../types';
import { computeDishStats, filterReviewsByDishAndSort } from '../lib/stats';
import { useTranslation } from 'react-i18next';
import { translateBatch } from '../services/translationService';
import { getListingById } from '../services/listings';
import { getReviewsByListingId } from '../services/reviews';

export default function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [selectedDish, setSelectedDish] = useState<string>('All');
  const [sortKey, setSortKey] = useState<'recent' | 'cheapest' | 'highest_rating'>('recent');
  const [restaurant, setRestaurant] = useState<Listing | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [translatedReviews, setTranslatedReviews] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);

      try {
        const [restData, revData] = await Promise.all([
          getListingById(id),
          getReviewsByListingId(id)
        ]);

        if (restData) {
          setRestaurant(restData);
        }

        if (revData) {
          setReviews(revData);
        }
      } catch (error) {
        console.error('Error fetching restaurant details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  useEffect(() => {
    const translateReviews = async () => {
      if (reviews.length === 0) return;
      
      setIsTranslating(true);
      const comments = reviews.map(r => r.text || '');
      try {
        const translated = await translateBatch(comments, i18n.language);
        const newTranslations: Record<string, string> = {};
        reviews.forEach((r, i) => {
          if (r.id) newTranslations[r.id] = translated[i];
        });
        setTranslatedReviews(newTranslations);
      } catch (error) {
        console.error("Translation error:", error);
      } finally {
        setIsTranslating(false);
      }
    };

    translateReviews();
  }, [reviews, i18n.language]);

  const dishStats = useMemo(() => computeDishStats(reviews), [reviews]);
  const filteredReviews = useMemo(() => 
    filterReviewsByDishAndSort(reviews, selectedDish, sortKey), 
    [reviews, selectedDish, sortKey]
  );

  const selectedDishStats = useMemo(() => 
    dishStats.find(s => s.name === selectedDish) || null,
    [dishStats, selectedDish]
  );

  const cheapestDish = useMemo(() => {
    if (dishStats.length === 0) return null;
    return [...dishStats].sort((a, b) => a.avgPrice - b.avgPrice)[0];
  }, [dishStats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#1D9E75] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Restaurant not found</h2>
        <button onClick={() => navigate('/')} className="text-[#1D9E75] font-bold underline">Go back home</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900 leading-tight">{restaurant.name}</h1>
            <div className="flex flex-col">
              <p className="text-xs text-gray-400 font-bold">{restaurant.address}</p>
              <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                {t('workingHours')}: {restaurant.working_hours || t('noDataHours')}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate(`/restaurants/${id}/review`)}
          className="bg-[#1D9E75] text-white px-4 py-2 rounded-xl text-xs font-black shadow-md hover:bg-[#168a65] transition-all"
        >
          {t('addReview')}
        </button>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Dish Filter Chips */}
        <section className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedDish('All')}
            className={`px-4 py-2 rounded-full text-xs font-black transition-all ${
              selectedDish === 'All'
                ? 'bg-[#1D9E75] text-white shadow-md'
                : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
            }`}
          >
            {t('allPrices')} ({reviews.length})
          </button>
          {dishStats.map((stats) => (
            <button
              key={stats.name}
              onClick={() => setSelectedDish(stats.name)}
              className={`px-4 py-2 rounded-full text-xs font-black transition-all ${
                selectedDish === stats.name
                  ? 'bg-[#1D9E75] text-white shadow-md'
                  : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
              }`}
            >
              {stats.name === 'All' ? t('allPrices') : t(`dishes.${stats.name.toLowerCase()}`, t(`clothes.${stats.name.toLowerCase()}`, stats.name))} ({stats.reviewCount})
            </button>
          ))}
        </section>

        {/* Stats Panel */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          {selectedDish === 'All' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-50 rounded-xl">
                  <TrendingUp className="text-[#1D9E75]" size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">{t('mostPopular')}</h3>
                  <p className="text-xs text-gray-500 font-bold">
                    {t('cheapestMeal')}: <span className="text-[#1D9E75]">{cheapestDish?.avgPrice.toLocaleString()} {t('som')}</span> ({t(`dishes.${cheapestDish?.name.toLowerCase()}`, t(`clothes.${cheapestDish?.name.toLowerCase()}`, cheapestDish?.name))})
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-50">
                <div className="text-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase">{t('rating')}</p>
                  <p className="text-lg font-black text-gray-900">{(restaurant.totalAvgRating || 0).toFixed(1)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase">{t('reviews')}</p>
                  <p className="text-lg font-black text-gray-900">{reviews.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase">{t('dishes')}</p>
                  <p className="text-lg font-black text-gray-900">{dishStats.length}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black text-gray-900">{t(`dishes.${selectedDish.toLowerCase()}`, t(`clothes.${selectedDish.toLowerCase()}`, selectedDish))} {t('popularity')}</h3>
                  <p className="text-sm text-gray-500 font-bold">{t('by')} {selectedDishStats?.reviewCount} {t('reviewsCount')}</p>
                </div>
                <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-lg border border-yellow-100">
                  <Star size={16} className="text-yellow-400 fill-yellow-400" />
                  <span className="text-lg font-black text-yellow-700">{selectedDishStats?.avgRating}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign size={14} className="text-[#1D9E75]" />
                    <span className="text-[10px] font-black text-gray-400 uppercase">{t('formPrice')}</span>
                  </div>
                  <p className="text-xl font-black text-[#1D9E75]">{selectedDishStats?.avgPrice.toLocaleString()} {t('som')}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={14} className="text-[#1D9E75]" />
                    <span className="text-[10px] font-black text-gray-400 uppercase">{t('popularity')}</span>
                  </div>
                  <p className="text-xl font-black text-gray-900">{Math.round((selectedDishStats?.popularity || 0) * 100)}%</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Trust Note */}
        <div className="px-2">
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest text-center">
            {t('trustNoteDetail')}
          </p>
        </div>

        {/* Reviews List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-900">{t('communityReviews')}</h3>
            <div className="flex items-center gap-4">
              {isTranslating && (
                <div className="flex items-center gap-1 text-[10px] font-bold text-[#1D9E75] animate-pulse">
                  <Globe size={12} />
                  {t('loading')}
                </div>
              )}
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as any)}
                className="bg-transparent text-xs font-black text-[#1D9E75] focus:outline-none cursor-pointer"
              >
                <option value="recent">{t('price_asc')}</option>
                <option value="cheapest">{t('price_desc')}</option>
                <option value="highest_rating">{t('rating')}</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredReviews.map((review) => (
              <div key={review.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                      <MessageSquare size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900">{review.submitter_name || t('anonymous')}</p>
                      <p className="text-[10px] text-gray-400 font-bold">{new Date(review.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-xs font-black text-gray-900">{review.rating}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-green-50 text-[#1D9E75] text-[10px] font-black rounded-md uppercase">
                    {t(`dishes.${review.dish_name.toLowerCase()}`, t(`clothes.${review.dish_name.toLowerCase()}`, review.dish_name))}
                  </span>
                  <span className="text-xs font-black text-gray-900">
                    {review.price_paid.toLocaleString()} {t('som')}
                  </span>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed italic">
                  "{translatedReviews[review.id!] || review.text}"
                </p>

                {review.photo_urls && review.photo_urls.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {review.photo_urls.map((url, idx) => (
                      <img 
                        key={idx} 
                        src={url} 
                        alt="Review" 
                        className="w-24 h-24 object-cover rounded-xl border border-gray-100 flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ))}
                  </div>
                )}

                {review.tags && review.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {review.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-bold text-gray-400">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer Actions */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex gap-4">
        <button 
          onClick={() => {
            const url = `geo:${restaurant.latitude},${restaurant.longitude}?q=${restaurant.latitude},${restaurant.longitude}(${encodeURIComponent(restaurant.name)})`;
            window.location.href = url;
          }}
          className="flex-1 bg-gray-100 text-gray-900 p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-gray-200 transition-all"
        >
          <Navigation size={18} />
          {t('getDirections')}
        </button>
      </footer>
    </div>
  );
}
