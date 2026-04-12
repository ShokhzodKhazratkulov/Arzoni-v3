import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Star, ChevronLeft, Calendar, Tag, MessageSquare, DollarSign, Info, Camera, X } from 'lucide-react';
import { AddReviewFormState } from '../types';
import { DISH_TYPES, CLOTHING_TYPES } from '../constants';
import { supabase } from '../supabase';
import imageCompression from 'browser-image-compression';
import { useTranslation } from 'react-i18next';

export default function AddReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [form, setForm] = useState<AddReviewFormState>({
    dish: 'Osh',
    customDishName: '',
    pricePaid: '',
    rating: 5,
    visitDate: new Date().toISOString().split('T')[0],
    priceFeeling: '',
    portionSize: '',
    title: '',
    text: '',
    tags: [],
  });

  const handleRatingChange = (rating: number) => {
    setForm((prev) => ({ ...prev, rating }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setPhotoFiles((prev) => [...prev, ...files]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImage = async (file: File, path: string) => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };

    let fileToUpload = file;
    try {
      fileToUpload = await imageCompression(file, options);
    } catch (error) {
      console.error('Compression failed, uploading original:', error);
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${path}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filePath, fileToUpload);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const recalculateRestaurantMetrics = async (restaurantId: string) => {
    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .select('price, category, dishes')
      .eq('id', restaurantId)
      .single();

    if (restError) throw restError;

    const { data: reviews, error: revError } = await supabase
      .from('reviews')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (revError) throw revError;

    if (!reviews || reviews.length === 0) return;

    const reviewCount = reviews.length;
    const totalRating = reviews.reduce((acc, curr) => acc + curr.rating, 0);
    const avgRating = totalRating / reviewCount;
    
    const totalPrice = reviews.reduce((acc, curr) => acc + (curr.price_spent || 0), 0) + (restaurant.price || 0);
    const avgPrice = Math.round(totalPrice / (reviewCount + 1));

    const dishCounts: { [dishId: string]: number } = {};
    const dishGroupedPrices: { [dishId: string]: number[] } = {};
    
    reviews.forEach(review => {
      if (review.dish_id && review.price_spent > 0) {
        const dishId = review.dish_id;
        dishCounts[dishId] = (dishCounts[dishId] || 0) + 1;
        if (!dishGroupedPrices[dishId]) dishGroupedPrices[dishId] = [];
        dishGroupedPrices[dishId].push(review.price_spent);
      }
    });

    const dishScore: { [dishId: string]: number } = {};
    const dishStats: { [dishId: string]: any } = {};
    
    Object.keys(dishCounts).forEach(dishId => {
      dishScore[dishId] = dishCounts[dishId] / reviewCount;
      const prices = dishGroupedPrices[dishId];
      const avgDishPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      
      // Calculate avg rating for this dish
      const dishReviews = reviews.filter(r => r.dish_id === dishId);
      const avgDishRating = Number((dishReviews.reduce((acc, curr) => acc + curr.rating, 0) / dishReviews.length).toFixed(1));
      
      dishStats[dishId] = {
        avgPrice: avgDishPrice,
        avgRating: avgDishRating,
        reviewCount: dishCounts[dishId],
      };
    });

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError(null);

    // Validation
    const dishName = form.dish === 'Custom' ? form.customDishName : form.dish;
    if (!dishName.trim()) {
      setError('Please enter a dish name.');
      return;
    }
    if (!form.pricePaid || isNaN(Number(form.pricePaid))) {
      setError('Please enter a valid price paid.');
      return;
    }

    setIsSubmitting(true);
    try {
      let photoUrls: string[] = [];
      if (photoFiles.length > 0) {
        const uploadPromises = photoFiles.map((file) => 
          uploadImage(file, `reviews/${id}`)
        );
        photoUrls = await Promise.all(uploadPromises);
      }

      const { error: reviewError } = await supabase
        .from('reviews')
        .insert([{
          restaurant_id: id,
          rating: form.rating,
          comment: form.text,
          title: form.title,
          price_spent: Number(form.pricePaid),
          dish_id: dishName,
          tags: form.tags,
          photo_urls: photoUrls,
          visit_date: form.visitDate,
          price_feeling: form.priceFeeling,
          portion_size: form.portionSize,
          created_at: new Date().toISOString(),
        }]);

      if (reviewError) throw reviewError;

      await recalculateRestaurantMetrics(id);
      
      navigate(`/restaurants/${id}`);
    } catch (err: any) {
      console.error('Error submitting review:', err);
      setError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 p-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-black text-gray-900">{t('addReview')}</h1>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm font-bold">
              {error}
            </div>
          )}

          {/* Dish Selection */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <label className="flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-wider">
              <Info size={16} className="text-[#1D9E75]" />
              {t('whatDidYouEat')} *
            </label>
            <select
              name="dish"
              value={form.dish}
              onChange={handleInputChange}
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D9E75] font-bold text-gray-900"
            >
              {DISH_TYPES.map(d => (
                <option key={d.id} value={d.id}>{t(d.label)}</option>
              ))}
              <option value="Custom">{t('otherDish')}</option>
            </select>

            {form.dish === 'Custom' && (
              <input
                type="text"
                name="customDishName"
                placeholder={t('customDishPlaceholder')}
                value={form.customDishName}
                onChange={handleInputChange}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D9E75] font-bold text-gray-900"
              />
            )}
          </section>

          {/* Photos */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <label className="flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-wider">
              <Camera size={16} className="text-[#1D9E75]" />
              {t('addPhoto')}
            </label>
            <div className="flex flex-wrap gap-4">
              {photoFiles.map((file, index) => (
                <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-100">
                  <img src={URL.createObjectURL(file)} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors cursor-pointer">
                <Camera size={24} />
                <span className="text-[10px] font-bold uppercase mt-1">{t('change')}</span>
                <input type="file" accept="image/*" multiple onChange={handlePhotoChange} className="hidden" />
              </label>
            </div>
          </section>

          {/* Price & Rating */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <label className="flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-wider">
                <DollarSign size={16} className="text-[#1D9E75]" />
                {t('priceSpent')} *
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="pricePaid"
                  placeholder="e.g. 35000"
                  value={form.pricePaid}
                  onChange={handleInputChange}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D9E75] font-bold text-gray-900 pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{t('som')}</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <label className="flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-wider">
                <Star size={16} className="text-[#1D9E75]" />
                {t('yourRating')} *
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleRatingChange(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      size={32}
                      className={`${
                        star <= form.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Optional Details */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-wider">
                <Calendar size={16} className="text-[#1D9E75]" />
                {t('formVisitDate')}
              </label>
              <input
                type="date"
                name="visitDate"
                value={form.visitDate}
                onChange={handleInputChange}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D9E75] font-bold text-gray-900"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider">{t('customPrice')}</label>
                <div className="flex flex-wrap gap-2">
                  {['cheap', 'fair', 'expensive'].map((feeling) => (
                    <button
                      key={feeling}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, priceFeeling: feeling as any }))}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                        form.priceFeeling === feeling
                          ? 'bg-[#1D9E75] text-white shadow-md'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {feeling.charAt(0).toUpperCase() + feeling.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-black text-gray-400 uppercase tracking-wider">{t('popularity')}</label>
                <div className="flex flex-wrap gap-2">
                  {['small', 'normal', 'big'].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, portionSize: size as any }))}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                        form.portionSize === size
                          ? 'bg-[#1D9E75] text-white shadow-md'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-wider">
                <MessageSquare size={16} className="text-[#1D9E75]" />
                {t('yourComment')}
              </label>
              <input
                type="text"
                name="title"
                placeholder={t('formDescription')}
                value={form.title}
                onChange={handleInputChange}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D9E75] font-bold text-gray-900"
              />
              <textarea
                name="text"
                rows={4}
                placeholder={t('commentPlaceholder')}
                value={form.text}
                onChange={handleInputChange}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D9E75] font-bold text-gray-900 resize-none"
              />
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-wider">
                <Tag size={16} className="text-[#1D9E75]" />
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {['students', 'big_portion', 'clean', 'fast_service', 'family_friendly'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                      form.tags.includes(tag)
                        ? 'bg-[#1D9E75] text-white shadow-md'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    #{tag.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full p-5 bg-[#1D9E75] text-white rounded-2xl font-black text-lg shadow-xl hover:bg-[#168a65] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              t('submit')
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
