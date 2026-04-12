export type Language = 'en' | 'uz' | 'ru';

export interface Location {
  lat: number;
  lng: number;
}

export interface Restaurant {
  id?: string;
  name: string;
  address: string;
  category: 'food' | 'clothes';
  dishes: string[];
  price: number; // This will be the initial price or the computed avgPrice
  avgPrice?: number;
  rating: number; // This will be the computed avgRating
  avgRating?: number;
  reviewCount: number;
  totalReviews?: number;
  description: string;
  submitter?: string;
  location: Location;
  workingHours?: string;
  createdAt: string;
  photoUrl?: string;
  likes: number;
  dislikes: number;
  dishScore?: { [dishId: string]: number };
  dishPrices?: { [dishId: string]: number };
  dishStats?: {
    [dishId: string]: {
      avgPrice: number;
      reviewCount: number;
      bestComment?: string;
      displayName?: string;
    }
  };
  isSponsored?: boolean;
  isVerified?: boolean;
  sponsoredExpiry?: string;
  verifiedExpiry?: string;
}

export interface Review {
  id?: string;
  restaurantId: string;
  rating: number;
  comment: string;
  submitter: string;
  createdAt: string;
  photoUrl?: string;
  photoUrls?: string[];
  likes: number;
  dislikes: number;
  priceSpent: number;
  dishId: string;
  tags: string[];
}

export const DISH_TYPES = ['Osh', 'Somsa', 'Shashlik', 'Manti', 'Norin', 'Plov', 'Lagman', 'Chuchvara', 'Shorva', 'Dimlama'];
export const CLOTHING_TYPES = ['T-shirt', 'Jeans', 'Dress', 'Shoes', 'Jacket', 'Shirt', 'Skirt', 'Pants', 'Sweater', 'Coat'];

export interface Banner {
  id: string;
  image_url: string;
  image_url_uz?: string;
  image_url_ru?: string;
  image_url_en?: string;
  restaurant_id: string;
  expiry_date: string;
  created_at: string;
  restaurant_name?: string; // For display in admin
  category?: 'food' | 'clothes';
}

export type DishStats = {
  name: string;          // "Osh"
  avgPrice: number;      // 31250
  avgRating: number;     // 4.0
  reviewCount: number;   // 4
  popularity: number;    // 0.8  (80%)
};

export type AddReviewFormState = {
  dish: string;            // "Osh" / "Somsa" / "Custom"
  customDishName: string;
  pricePaid: string;       // input value
  rating: number;          // 1..5
  visitDate: string;       // ISO date
  priceFeeling: 'cheap' | 'fair' | 'expensive' | '';
  portionSize: 'small' | 'normal' | 'big' | '';
  title: string;
  text: string;
  tags: string[];          // ["students", "big_portion"]
};

export type SortOption = 'price_asc' | 'price_desc' | 'rating' | 'distance';
