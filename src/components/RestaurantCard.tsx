import { Star, MapPin, Navigation, MessageSquare } from 'lucide-react';
import { DishStats } from '../types';
import { useTranslation } from 'react-i18next';

type RestaurantCardProps = {
  restaurantId: string;
  name: string;
  area: string;          // "Iftikhor street, Tashkent"
  selectedDish: string;  // "Osh"
  dishStatsForSelected: DishStats | null;
  allDishStats: DishStats[];
  distanceKm?: number;
  durationMin?: number;
  onViewReviews?: (id: string) => void;
  onGetDirections?: (id: string) => void;
};

export default function RestaurantCard({
  restaurantId,
  name,
  area,
  selectedDish,
  dishStatsForSelected,
  allDishStats,
  distanceKm,
  durationMin,
  onViewReviews,
  onGetDirections,
}: RestaurantCardProps) {
  const { t } = useTranslation();
  const popularityPercent = dishStatsForSelected ? Math.round(dishStatsForSelected.popularity * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col">
        <h3 className="text-xl font-black text-gray-900 leading-tight">{name}</h3>
        <div className="flex items-center gap-1.5 text-gray-400 text-xs mt-1">
          <MapPin size={12} className="text-[#1D9E75]" />
          <span className="line-clamp-1">{area}</span>
        </div>
      </div>

      {/* Main Stats Line */}
      <div className="flex justify-between items-center py-2 border-y border-gray-50">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {t('formPrice')} ({t(`dishes.${selectedDish.toLowerCase()}`, t(`clothes.${selectedDish.toLowerCase()}`, selectedDish))})
          </span>
          <span className="text-lg font-black text-[#1D9E75]">
            {dishStatsForSelected?.avgPrice.toLocaleString() || '0'} {t('som')}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1">
            <Star size={16} className="text-yellow-400 fill-yellow-400" />
            <span className="text-lg font-black text-gray-900">
              {dishStatsForSelected?.avgRating || '0.0'}
            </span>
          </div>
          <span className="text-[10px] font-bold text-gray-400">
            ({dishStatsForSelected?.reviewCount || 0} {t('reviewsCount')})
          </span>
        </div>
      </div>

      {/* Popularity Line */}
      <div className="bg-gray-50 rounded-xl px-3 py-2">
        <p className="text-xs font-medium text-gray-600">
          <span className="font-black text-[#1D9E75]">{popularityPercent}%</span> {t('popularity')} <span className="font-black">{t(`dishes.${selectedDish.toLowerCase()}`, t(`clothes.${selectedDish.toLowerCase()}`, selectedDish))}</span>
        </p>
      </div>

      {/* Dish Chips */}
      <div className="flex flex-wrap gap-2">
        {allDishStats.map((stats) => (
          <span
            key={stats.name}
            className={`px-3 py-1 rounded-full text-[10px] font-black transition-colors ${
              stats.name === selectedDish
                ? 'bg-[#1D9E75] text-white'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {t(`dishes.${stats.name.toLowerCase()}`, t(`clothes.${stats.name.toLowerCase()}`, stats.name))}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <div className="flex items-center gap-2 text-gray-400 text-xs font-bold">
          {distanceKm !== undefined && (
            <>
              <span>{distanceKm} km</span>
              <span>·</span>
              <span>{durationMin} min</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewReviews?.(restaurantId)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-black text-gray-600 hover:text-[#1D9E75] transition-colors"
          >
            <MessageSquare size={14} />
            {t('reviews')}
          </button>
          <button
            onClick={() => onGetDirections?.(restaurantId)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1D9E75] text-white rounded-xl text-xs font-black shadow-sm hover:bg-[#168a65] transition-colors"
          >
            <Navigation size={14} />
            {t('getDirections')}
          </button>
        </div>
      </div>
    </div>
  );
}
