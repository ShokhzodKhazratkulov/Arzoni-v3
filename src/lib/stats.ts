import { Review, DishStats } from '../types';

export function computeDishStats(reviews: Review[]): DishStats[] {
  const totalReviews = reviews.length;
  if (totalReviews === 0) return [];

  const dishMap: { [key: string]: { totalPrice: number; totalRating: number; count: number } } = {};

  reviews.forEach((review) => {
    const dish = review.dishId || 'Unknown';
    if (!dishMap[dish]) {
      dishMap[dish] = { totalPrice: 0, totalRating: 0, count: 0 };
    }
    dishMap[dish].totalPrice += review.priceSpent || 0;
    dishMap[dish].totalRating += review.rating || 0;
    dishMap[dish].count += 1;
  });

  return Object.entries(dishMap).map(([name, stats]) => ({
    name,
    avgPrice: Math.round(stats.totalPrice / stats.count),
    avgRating: Number((stats.totalRating / stats.count).toFixed(1)),
    reviewCount: stats.count,
    popularity: stats.count / totalReviews,
  }));
}

export function filterReviewsByDishAndSort(
  reviews: Review[],
  selectedDish: string,
  sortKey: 'recent' | 'cheapest' | 'highest_rating'
): Review[] {
  let filtered = reviews;
  if (selectedDish !== 'All') {
    filtered = reviews.filter((r) => r.dishId === selectedDish);
  }

  return [...filtered].sort((a, b) => {
    if (sortKey === 'recent') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortKey === 'cheapest') {
      return (a.priceSpent || 0) - (b.priceSpent || 0);
    }
    if (sortKey === 'highest_rating') {
      return b.rating - a.rating;
    }
    return 0;
  });
}
