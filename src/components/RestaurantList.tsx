import { useTranslation } from 'react-i18next';
import { Restaurant, SortOption, DishStats } from '../types';
import RestaurantCard from './RestaurantCard';
import { ArrowUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RestaurantListProps {
  restaurants: Restaurant[];
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;
  onAddReview: (restaurant: Restaurant) => void;
  onAddRestaurantClick: () => void;
  selectedDishes: string[];
  selectedCategory: 'food' | 'clothes';
  restaurantStatsMap: { [restaurantId: string]: DishStats[] };
}

export default function RestaurantList({ 
  restaurants, 
  sortOption, 
  setSortOption, 
  onAddReview, 
  onAddRestaurantClick,
  selectedDishes, 
  selectedCategory,
  restaurantStatsMap
}: RestaurantListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const selectedDish = selectedDishes[0] || 'Osh';

  const getSortClarification = () => {
    const dishName = t(`dishes.${selectedDish.toLowerCase()}`, t(`clothes.${selectedDish.toLowerCase()}`, selectedDish));
    
    if (selectedDishes.length > 0 && selectedDish !== 'All') {
      return t(`sort_${sortOption}`, { dish: dishName });
    }
    
    return t(`sort_default_${selectedCategory}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            {selectedCategory === 'food' ? t('totalRestaurants') : t('totalShops')}
            <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs">
              {restaurants.length}
            </span>
          </h2>

          <div className="flex items-center gap-2">
            <ArrowUpDown size={16} className="text-gray-400" />
            <select 
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-transparent text-xs font-bold text-gray-600 focus:outline-none cursor-pointer"
            >
              <option value="price_asc">{t('price_asc')}</option>
              <option value="price_desc">{t('price_desc')}</option>
              <option value="rating">{t('rating')}</option>
              <option value="distance">{t('distance')}</option>
            </select>
          </div>
        </div>
        
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {getSortClarification()}
        </p>
      </div>

      {restaurants.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center gap-4">
          <div className="p-4 bg-gray-50 rounded-full">
            <ArrowUpDown size={32} className="text-gray-300" />
          </div>
          <div className="space-y-1">
            <p className="text-gray-900 font-black">
              {t('noResultsDetailed')}
            </p>
            <p className="text-sm text-gray-400 font-medium">
              {selectedCategory === 'food' ? t('noResults') : t('noResultsClothes')}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {restaurants.map(restaurant => {
            const stats = restaurantStatsMap[restaurant.id!] || [];
            const dishStatsForSelected = stats.find(s => s.name === selectedDish) || null;
            
            return (
              <RestaurantCard 
                key={restaurant.id} 
                restaurantId={restaurant.id!}
                name={restaurant.name}
                area={restaurant.address}
                workingHours={restaurant.workingHours}
                selectedDish={selectedDish}
                dishStatsForSelected={dishStatsForSelected}
                allDishStats={stats}
                onViewReviews={(id) => navigate(`/restaurants/${id}`)}
                onGetDirections={(id) => {
                  const url = `geo:${restaurant.location.lat},${restaurant.location.lng}?q=${restaurant.location.lat},${restaurant.location.lng}(${encodeURIComponent(restaurant.name)})`;
                  window.location.href = url;
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
