import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  InfoWindow, 
  useMap,
  Pin
} from '@vis.gl/react-google-maps';
import { useTranslation } from 'react-i18next';
import { Restaurant } from '../types';
import { TASHKENT_CENTER, DISH_TYPES } from '../constants';
import { Navigation, Star, MapPin, Crosshair, Info, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import RestaurantDetailsModal from './RestaurantDetailsModal';
import DirectionsPicker from './DirectionsPicker';

interface MapContainerProps {
  restaurants: Restaurant[];
  onAddRestaurant: () => void;
  selectedDishes?: string[];
  customDish?: string;
  selectedCategory: 'food' | 'clothes';
}

const MapContent = ({ restaurants, onAddRestaurant, selectedDishes = [], customDish, selectedCategory }: MapContainerProps) => {
  const { t } = useTranslation();
  const map = useMap();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDirectionsOpen, setIsDirectionsOpen] = useState(false);

  const selectedRestaurant = restaurants.find(r => r.id === selectedId);

  // Calculate info for selected restaurant
  const activeDishId = useMemo(() => {
    if (!selectedRestaurant || selectedDishes.length === 0) return null;
    
    if (selectedDishes.includes('custom') && customDish) {
      const normalizedSearch = customDish.toLowerCase();
      const matchingKey = Object.keys(selectedRestaurant.dishStats || {}).find(k => k.toLowerCase() === normalizedSearch);
      return matchingKey || customDish;
    }
    
    return selectedDishes.find(id => selectedRestaurant.dishStats?.[id]?.bestComment) || selectedDishes[0];
  }, [selectedRestaurant, selectedDishes, customDish]);

  const displayPrice = selectedRestaurant 
    ? (activeDishId && selectedRestaurant.dishStats?.[activeDishId] 
        ? selectedRestaurant.dishStats[activeDishId].avgPrice 
        : selectedRestaurant.price)
    : 0;

  const displayDescription = selectedRestaurant
    ? (activeDishId && selectedRestaurant.dishStats?.[activeDishId]?.bestComment
        ? `"${selectedRestaurant.dishStats[activeDishId].bestComment}"`
        : selectedRestaurant.description)
    : '';

  const isReview = !!(selectedRestaurant && activeDishId && selectedRestaurant.dishStats?.[activeDishId]?.bestComment);

  const handleFindMe = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(pos);
          map?.panTo(pos);
          map?.setZoom(15);
        },
        () => {
          console.error("Error: The Geolocation service failed.");
        }
      );
    }
  }, [map]);

  const getPinColor = (price: number) => {
    if (selectedCategory === 'clothes') {
      if (price < 100000) return '#1D9E75'; // Green
      if (price <= 170000) return '#F59E0B'; // Amber
      return '#EF4444'; // Red
    }
    if (price < 40000) return '#1D9E75'; // Green
    if (price <= 70000) return '#F59E0B'; // Amber
    return '#EF4444'; // Red
  };

  return (
    <div className="relative w-full h-[400px] sm:h-[500px] rounded-2xl overflow-hidden shadow-inner border border-gray-100">
      <Map
        defaultCenter={TASHKENT_CENTER}
        defaultZoom={13}
        mapId="ARZONI_MAP_ID"
        disableDefaultUI={true}
        zoomControl={true}
        gestureHandling={'greedy'}
      >
        {restaurants.map((restaurant) => {
          // Find the most relevant dish to display info for (same logic as RestaurantCard)
          const activeDishId = (() => {
            if (selectedDishes.length === 0) return null;
            
            if (selectedDishes.includes('custom') && customDish) {
              const normalizedSearch = customDish.toLowerCase();
              const matchingKey = Object.keys(restaurant.dishStats || {}).find(k => k.toLowerCase() === normalizedSearch);
              return matchingKey || customDish;
            }
            
            // Find the first selected dish that has a comment, or just the first selected dish
            // We also need to handle case-insensitivity here for consistency
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

          const displayPrice = activeDishId && restaurant.dishStats?.[activeDishId] 
            ? restaurant.dishStats[activeDishId].avgPrice 
            : (restaurant.avgPrice || restaurant.price);

          const dishStats = activeDishId && restaurant.dishStats?.[activeDishId];
          const rating = dishStats ? dishStats.avgRating : (restaurant.avgRating || 0);
          const reviewCount = dishStats ? dishStats.reviewCount : (restaurant.reviewCount || 0);
          const shortPrice = displayPrice >= 1000 ? `${Math.round(displayPrice / 1000)}k` : displayPrice;
          const dishLabel = activeDishId ? t(`dishes.${activeDishId.toLowerCase()}`, t(`clothes.${activeDishId.toLowerCase()}`, activeDishId)) : '';

          return (
            <AdvancedMarker
              key={restaurant.id}
              position={restaurant.location}
              onClick={() => setSelectedId(restaurant.id || null)}
            >
              <div className="relative group">
                <Pin 
                  background={getPinColor(displayPrice)} 
                  borderColor={'#ffffff'} 
                  glyphColor={'#ffffff'}
                  scale={1.2}
                />
                {/* Short info badge above pin */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white px-2 py-0.5 rounded-full shadow-md border border-gray-100 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[9px] font-black text-gray-800">
                    {shortPrice} {dishLabel ? `(${dishLabel})` : ''}
                  </p>
                </div>
              </div>
            </AdvancedMarker>
          );
        })}

        {userLocation && (
          <AdvancedMarker position={userLocation}>
            <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse" />
          </AdvancedMarker>
        )}

        {selectedRestaurant && (
          <InfoWindow
            position={selectedRestaurant.location}
            onCloseClick={() => setSelectedId(null)}
          >
            <div className="p-2 w-[220px] flex flex-col gap-2">
              <div className="flex flex-col">
                <h3 
                  className="font-black text-sm text-gray-900 cursor-pointer hover:text-[#1D9E75] transition-colors leading-tight"
                  onClick={() => setIsDetailsOpen(true)}
                >
                  {selectedRestaurant.name}
                </h3>
                <p className="text-[10px] text-gray-400 font-bold mt-0.5 line-clamp-1">
                  {selectedRestaurant.address}
                </p>
                {selectedRestaurant.workingHours && (
                  <p className="text-[9px] text-gray-500 mt-0.5">
                    {t('workingHours')}: {selectedRestaurant.workingHours}
                  </p>
                )}
              </div>

              {selectedRestaurant.photoUrl && (
                <div 
                  className="w-full h-24 rounded-xl overflow-hidden cursor-pointer relative group"
                  onClick={() => setIsDetailsOpen(true)}
                >
                  <img src={selectedRestaurant.photoUrl} alt={selectedRestaurant.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <Info size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              )}

              {/* Stats Line */}
              {activeDishId && selectedRestaurant.dishStats?.[activeDishId] ? (
                <div className="flex justify-between items-center py-1.5 border-y border-gray-50">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-bold text-gray-400 uppercase">
                      {t(`dishes.${activeDishId.toLowerCase()}`, t(`clothes.${activeDishId.toLowerCase()}`, activeDishId))}
                    </span>
                    <span className="text-xs font-black text-[#1D9E75]">
                      {selectedRestaurant.dishStats[activeDishId].avgPrice.toLocaleString()} {t('som')}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-0.5">
                      <Star size={10} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-xs font-black text-gray-900">
                        {selectedRestaurant.dishStats[activeDishId].avgRating.toFixed(1)}
                      </span>
                    </div>
                    <span className="text-[8px] font-bold text-gray-400">
                      ({selectedRestaurant.dishStats[activeDishId].reviewCount})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-1.5 border-y border-gray-50">
                  <p className="text-[10px] text-gray-500 font-bold italic">
                    {t('noReviewsHint')}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 mt-1">
                <button 
                  onClick={() => setIsDetailsOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-black text-[#1D9E75] border-2 border-[#1D9E75] rounded-lg hover:bg-[#1D9E75] hover:text-white transition-all"
                >
                  <MessageSquare size={10} />
                  {t('reviews')}
                </button>
                <button 
                  onClick={() => {
                    if (selectedRestaurant) {
                      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                      if (isIOS) {
                        setIsDirectionsOpen(true);
                      } else {
                        const url = `geo:${selectedRestaurant.location.lat},${selectedRestaurant.location.lng}?q=${selectedRestaurant.location.lat},${selectedRestaurant.location.lng}(${encodeURIComponent(selectedRestaurant.name)})`;
                        window.location.href = url;
                      }
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-[#1D9E75] text-white rounded-lg text-[10px] font-black shadow-md hover:bg-[#168a65] transition-all border-2 border-[#1D9E75]"
                >
                  <Navigation size={10} />
                  {t('getDirections')}
                </button>
              </div>
            </div>
          </InfoWindow>
        )}
      </Map>

      {/* Floating Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2" style={{ marginRight: '-12px', marginTop: '222px' }}>
        <button
          onClick={handleFindMe}
          className="p-3 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-all text-[#1D9E75] border border-gray-100"
          title={selectedCategory === 'food' ? t('findNearMe') : t('findNearMeClothes')}
        >
          <Crosshair size={20} />
        </button>
      </div>

      {selectedRestaurant && (
        <RestaurantDetailsModal 
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          restaurant={selectedRestaurant}
          selectedDishes={selectedDishes}
          customDish={customDish}
          selectedCategory={selectedCategory}
        />
      )}

      {selectedRestaurant && (
        <DirectionsPicker 
          isOpen={isDirectionsOpen}
          onClose={() => setIsDirectionsOpen(false)}
          location={selectedRestaurant.location}
          name={selectedRestaurant.name}
        />
      )}
    </div>
  );
};

export default function MapContainer(props: MapContainerProps) {
  const apiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '';

  return (
    <APIProvider apiKey={apiKey}>
      <MapContent {...props} />
    </APIProvider>
  );
}
