import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  LayoutDashboard, 
  Store, 
  Image as ImageIcon, 
  Bell, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  Search,
  MoreVertical,
  ArrowLeft,
  Star,
  MapPin,
  ExternalLink,
  Plus,
  Trash2,
  Calendar,
  Upload,
  X,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { Restaurant, Banner } from '../types';
import imageCompression from 'browser-image-compression';

interface AdminDashboardProps {
  onBack: () => void;
}

type AdminTab = 'overview' | 'restaurants' | 'banners' | 'notifications';

export default function AdminDashboard({ onBack }: AdminDashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [listingCategory, setListingCategory] = useState<'all' | 'food' | 'clothes'>('all');
  
  // Banner Form State
  const [isAddingBanner, setIsAddingBanner] = useState(false);
  const [bannerImages, setBannerImages] = useState<{ [key: string]: File }>({});
  const [bannerPreviews, setBannerPreviews] = useState<{ [key: string]: string }>({});
  const [activeBannerLang, setActiveBannerLang] = useState<'uz' | 'ru' | 'en'>('uz');
  const [bannerCategory, setBannerCategory] = useState<'food' | 'clothes'>('food');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Notification State
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const sendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationTitle || !notificationBody) return;

    setIsSending(true);
    setSendResult(null);

    try {
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: notificationTitle,
          body: notificationBody
        }),
      });

      let result;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        result = { message: text || `Server responded with status ${response.status}` };
      }

      setSendResult({
        success: response.ok,
        message: result.message || (response.ok ? 'Notification sent successfully!' : 'Failed to send notification.')
      });

      if (response.ok) {
        setNotificationTitle('');
        setNotificationBody('');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      setSendResult({ 
        success: false, 
        message: 'An error occurred while sending. If you are on a static host (like Hostinger Shared Hosting), the backend API might not be running.' 
      });
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
    fetchBanners();
  }, []);

  const fetchRestaurants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching restaurants:', error);
    } else {
      const mappedData = (data || []).map(r => ({
        ...r,
        avgPrice: r.avg_price,
        avgRating: r.avg_rating,
        reviewCount: r.review_count,
        photoUrl: r.photo_url,
        isSponsored: r.is_sponsored,
        isVerified: r.is_verified,
        sponsoredExpiry: r.sponsored_expiry,
        verifiedExpiry: r.verified_expiry
      }));
      setRestaurants(mappedData as Restaurant[]);
    }
    setLoading(false);
  };

  const fetchBanners = async () => {
    const { data, error } = await supabase
      .from('banners')
      .select(`
        *,
        restaurants (
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching banners:', error);
    } else {
      const mappedBanners = (data || []).map(b => ({
        ...b,
        restaurant_name: b.restaurants?.name,
        category: b.category
      }));
      setBanners(mappedBanners as Banner[]);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1200,
          useWebWorker: true
        };
        const compressedFile = await imageCompression(file, options);
        setBannerImages(prev => ({ ...prev, [activeBannerLang]: compressedFile }));
        setBannerPreviews(prev => ({ ...prev, [activeBannerLang]: URL.createObjectURL(compressedFile) }));
      } catch (error) {
        console.error('Error compressing image:', error);
      }
    }
  };

  const addBanner = async () => {
    if (Object.keys(bannerImages).length === 0 || !selectedRestaurantId || !expiryDate) return;

    setIsUploading(true);
    try {
      const urls: { [key: string]: string } = {};

      // Upload all images
      for (const lang of ['uz', 'ru', 'en']) {
        const image = bannerImages[lang];
        if (image) {
          const fileExt = image.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `banners/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('restaurant-photos')
            .upload(filePath, image);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('restaurant-photos')
            .getPublicUrl(filePath);
          
          urls[`image_url_${lang}`] = publicUrl;
        }
      }

      // 2. Create Banner Record
      const { error: dbError } = await supabase
        .from('banners')
        .insert({
          image_url: urls.image_url_uz || urls.image_url_ru || urls.image_url_en || '',
          image_url_uz: urls.image_url_uz || null,
          image_url_ru: urls.image_url_ru || null,
          image_url_en: urls.image_url_en || null,
          restaurant_id: selectedRestaurantId,
          expiry_date: expiryDate,
          category: bannerCategory
        });

      if (dbError) throw dbError;

      // Reset form and refresh
      setIsAddingBanner(false);
      setBannerImages({});
      setBannerPreviews({});
      setSelectedRestaurantId('');
      setExpiryDate('');
      fetchBanners();
    } catch (error) {
      console.error('Error adding banner:', error);
      alert('Failed to add banner. Make sure the "banners" table exists in Supabase.');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteBanner = async (id: string) => {
    const { error } = await supabase
      .from('banners')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting banner:', error);
    } else {
      setBanners(prev => prev.filter(b => b.id !== id));
    }
  };

  const toggleSponsored = async (id: string, currentStatus: boolean, expiryDate?: string) => {
    const { error } = await supabase
      .from('restaurants')
      .update({ 
        is_sponsored: !currentStatus,
        sponsored_expiry: !currentStatus ? (expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()) : null
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating sponsored status:', error);
    } else {
      setRestaurants(prev => prev.map(r => r.id === id ? { 
        ...r, 
        isSponsored: !currentStatus,
        sponsoredExpiry: !currentStatus ? (expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()) : undefined
      } : r));
    }
  };

  const toggleVerified = async (id: string, currentStatus: boolean, expiryDate?: string) => {
    const { error } = await supabase
      .from('restaurants')
      .update({ 
        is_verified: !currentStatus,
        verified_expiry: !currentStatus ? (expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()) : null
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating verified status:', error);
    } else {
      setRestaurants(prev => prev.map(r => r.id === id ? { 
        ...r, 
        isVerified: !currentStatus,
        verifiedExpiry: !currentStatus ? (expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()) : undefined
      } : r));
    }
  };

  const updateExpiry = async (id: string, type: 'sponsored' | 'verified', date: string) => {
    const field = type === 'sponsored' ? 'sponsored_expiry' : 'verified_expiry';
    const { error } = await supabase
      .from('restaurants')
      .update({ [field]: date })
      .eq('id', id);

    if (error) {
      console.error(`Error updating ${type} expiry:`, error);
    } else {
      setRestaurants(prev => prev.map(r => r.id === id ? { 
        ...r, 
        [type === 'sponsored' ? 'sponsoredExpiry' : 'verifiedExpiry']: date 
      } : r));
    }
  };

  const filteredRestaurants = restaurants.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = listingCategory === 'all' || r.category === listingCategory;
    return matchesSearch && matchesCategory;
  });

  const stats = {
    total: restaurants.length,
    sponsored: restaurants.filter(r => r.isSponsored).length,
    verified: restaurants.filter(r => r.isVerified).length,
    food: restaurants.filter(r => r.category === 'food').length,
    clothes: restaurants.filter(r => r.category === 'clothes').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Admin Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <LayoutDashboard className="text-amber-500" size={24} />
                {t('adminDashboard')}
              </h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Management Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col items-end leading-none mr-2">
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">System Administrator</span>
              <span className="text-[9px] font-bold text-gray-400">Live Control</span>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100">
              <TrendingUp size={20} />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col md:flex-row">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 p-6 space-y-2 border-r border-gray-100 bg-white/50">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'overview' ? 'bg-amber-50 text-amber-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <LayoutDashboard size={18} />
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('restaurants')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'restaurants' ? 'bg-amber-50 text-amber-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Store size={18} />
            Restaurants & Shops
          </button>
          <button 
            onClick={() => setActiveTab('banners')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'banners' ? 'bg-amber-50 text-amber-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <ImageIcon size={18} />
            Ad Banners
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'notifications' ? 'bg-amber-50 text-amber-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Bell size={18} />
            Push Notifications
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Listings</p>
                    <p className="text-3xl font-black text-gray-900">{stats.total}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">Sponsored</p>
                    <p className="text-3xl font-black text-gray-900">{stats.sponsored}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">Verified</p>
                    <p className="text-3xl font-black text-gray-900">{stats.verified}</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-2">Food/Clothes</p>
                    <p className="text-3xl font-black text-gray-900">{stats.food}/{stats.clothes}</p>
                  </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mx-auto">
                    <TrendingUp size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Welcome to your Admin Center</h3>
                  <p className="text-gray-500 max-w-md mx-auto text-sm">
                    From here you can manage your advertising revenue, verify high-quality locations, and communicate with your users.
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'restaurants' && (
              <motion.div 
                key="restaurants"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black text-gray-900">Manage Listings</h2>
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                      <button 
                        onClick={() => setListingCategory('all')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          listingCategory === 'all' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        All
                      </button>
                      <button 
                        onClick={() => setListingCategory('food')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          listingCategory === 'food' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        Food
                      </button>
                      <button 
                        onClick={() => setListingCategory('clothes')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          listingCategory === 'clothes' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        Clothes
                      </button>
                    </div>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="text"
                      placeholder="Search restaurants..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Listing</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Sponsored</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Verified</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {loading ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center">
                              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            </td>
                          </tr>
                        ) : filteredRestaurants.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm italic">
                              No listings found matching your search.
                            </td>
                          </tr>
                        ) : (
                          filteredRestaurants.map(r => (
                            <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 shrink-0">
                                    <img src={r.photoUrl || 'https://picsum.photos/seed/food/100/100'} alt={r.name} className="w-full h-full object-cover" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-900">{r.name}</p>
                                    <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                      <MapPin size={10} />
                                      {r.address}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col items-center gap-2">
                                  <button 
                                    onClick={() => toggleSponsored(r.id!, r.isSponsored || false)}
                                    className={`p-2 rounded-xl transition-all ${
                                      r.isSponsored 
                                        ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                                        : 'bg-gray-50 text-gray-300 border border-gray-100 hover:text-amber-400'
                                    }`}
                                    title={r.isSponsored ? "Remove Promotion" : "Promote to Top"}
                                  >
                                    <Star size={18} className={r.isSponsored ? "fill-amber-500" : ""} />
                                  </button>
                                  {r.isSponsored && (
                                    <input 
                                      type="date" 
                                      value={r.sponsoredExpiry ? new Date(r.sponsoredExpiry).toISOString().split('T')[0] : ''}
                                      onChange={(e) => updateExpiry(r.id!, 'sponsored', new Date(e.target.value).toISOString())}
                                      className="text-[9px] font-bold bg-transparent border-none focus:ring-0 p-0 text-amber-600 w-24 text-center"
                                    />
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col items-center gap-2">
                                  <button 
                                    onClick={() => toggleVerified(r.id!, r.isVerified || false)}
                                    className={`p-2 rounded-xl transition-all ${
                                      r.isVerified 
                                        ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                                        : 'bg-gray-50 text-gray-300 border border-gray-100 hover:text-blue-400'
                                    }`}
                                    title={r.isVerified ? "Unverify" : "Mark as Verified"}
                                  >
                                    <CheckCircle2 size={18} />
                                  </button>
                                  {r.isVerified && (
                                    <input 
                                      type="date" 
                                      value={r.verifiedExpiry ? new Date(r.verifiedExpiry).toISOString().split('T')[0] : ''}
                                      onChange={(e) => updateExpiry(r.id!, 'verified', new Date(e.target.value).toISOString())}
                                      className="text-[9px] font-bold bg-transparent border-none focus:ring-0 p-0 text-blue-600 w-24 text-center"
                                    />
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button className="p-2 text-gray-300 hover:text-gray-600 transition-colors">
                                  <MoreVertical size={18} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'banners' && (
              <motion.div 
                key="banners"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div>
                    <h2 className="text-xl font-black text-gray-900">Ad Banners</h2>
                    <p className="text-xs text-gray-500">Manage billboard ads shown at the top of the home screen.</p>
                  </div>
                  <button 
                    onClick={() => setIsAddingBanner(true)}
                    className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all"
                  >
                    <Plus size={18} />
                    Add Banner
                  </button>
                </div>

                {/* Banner List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {banners.length === 0 ? (
                    <div className="col-span-full bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center">
                      <ImageIcon className="mx-auto text-gray-200 mb-4" size={48} />
                      <p className="text-gray-400 font-medium">No active banners found.</p>
                      <p className="text-xs text-gray-400">Add a banner to promote a restaurant on the home screen.</p>
                    </div>
                  ) : (
                    banners.map(banner => (
                      <div key={banner.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden group">
                        <div className="aspect-[21/9] relative overflow-hidden">
                          <img 
                            src={banner.image_url} 
                            alt="Banner" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                            <button 
                              onClick={() => deleteBanner(banner.id)}
                              className="bg-red-500 text-white p-2 rounded-xl hover:bg-red-600 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                        <div className="p-4 flex justify-between items-center">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{banner.restaurant_name || 'Unknown Restaurant'}</p>
                            <div className="flex gap-1 mt-1 mb-1">
                              {banner.image_url_uz && <span className="px-1.5 py-0.5 bg-green-50 text-[8px] font-black rounded text-green-600">UZ</span>}
                              {banner.image_url_ru && <span className="px-1.5 py-0.5 bg-blue-50 text-[8px] font-black rounded text-blue-600">RU</span>}
                              {banner.image_url_en && <span className="px-1.5 py-0.5 bg-amber-50 text-[8px] font-black rounded text-amber-600">EN</span>}
                            </div>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Calendar size={10} />
                              Expires: {new Date(banner.expiry_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-black rounded-lg uppercase tracking-tighter">
                            Active
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Banner Modal */}
                <AnimatePresence>
                  {isAddingBanner && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsAddingBanner(false)}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                      />
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                      >
                        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                          <h3 className="text-xl font-black text-gray-900">Add New Banner</h3>
                          <div className="flex items-center gap-2">
                            <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
                              {(['en', 'uz', 'ru'] as const).map((lang) => (
                                <button
                                  key={lang}
                                  onClick={() => setActiveBannerLang(lang)}
                                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                    activeBannerLang === lang ? 'bg-white text-[#1D9E75] shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                  }`}
                                >
                                  {lang}
                                </button>
                              ))}
                            </div>
                            <button onClick={() => setIsAddingBanner(false)} className="p-2 hover:bg-gray-50 rounded-xl text-gray-400">
                              <X size={20} />
                            </button>
                          </div>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto">
                          {/* Image Upload */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              Banner Image ({activeBannerLang.toUpperCase()})
                            </label>
                            <div 
                              onClick={() => document.getElementById('banner-upload')?.click()}
                              className={`aspect-[21/9] rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-2 overflow-hidden relative ${
                                bannerPreviews[activeBannerLang] ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-amber-300 hover:bg-gray-50'
                              }`}
                            >
                              {bannerPreviews[activeBannerLang] ? (
                                <img src={bannerPreviews[activeBannerLang]} alt="Preview" className="w-full h-full object-cover" />
                              ) : (
                                <>
                                  <Upload className="text-gray-300" size={32} />
                                  <p className="text-xs text-gray-400 font-bold">Click to upload {activeBannerLang.toUpperCase()} image</p>
                                </>
                              )}
                              <input 
                                id="banner-upload"
                                type="file" 
                                accept="image/*" 
                                onChange={handleImageChange} 
                                className="hidden" 
                              />
                            </div>
                          </div>

                          {/* Category Selection */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Banner Category</label>
                            <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-100">
                              <button 
                                onClick={() => {
                                  setBannerCategory('food');
                                  setSelectedRestaurantId('');
                                }}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                  bannerCategory === 'food' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                }`}
                              >
                                Food
                              </button>
                              <button 
                                onClick={() => {
                                  setBannerCategory('clothes');
                                  setSelectedRestaurantId('');
                                }}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                  bannerCategory === 'clothes' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                }`}
                              >
                                Clothes
                              </button>
                            </div>
                          </div>

                          {/* Restaurant Selection */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              Link to {bannerCategory === 'food' ? 'Restaurant' : 'Shop'}
                            </label>
                            <select 
                              value={selectedRestaurantId}
                              onChange={(e) => setSelectedRestaurantId(e.target.value)}
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            >
                              <option value="">Select a {bannerCategory === 'food' ? 'restaurant' : 'shop'}...</option>
                              {restaurants
                                .filter(r => r.category === bannerCategory)
                                .map(r => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))
                              }
                            </select>
                          </div>

                          {/* Expiry Date */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Expiry Date</label>
                            <input 
                              type="date"
                              value={expiryDate}
                              onChange={(e) => setExpiryDate(e.target.value)}
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            />
                          </div>
                        </div>

                        <div className="p-6 bg-gray-50/50 border-t border-gray-50">
                          <button 
                            onClick={addBanner}
                            disabled={isUploading || Object.keys(bannerImages).length === 0 || !selectedRestaurantId || !expiryDate}
                            className={`w-full py-4 rounded-2xl font-black text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                              isUploading || Object.keys(bannerImages).length === 0 || !selectedRestaurantId || !expiryDate
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-amber-500 text-white shadow-amber-500/20 hover:bg-amber-600'
                            }`}
                          >
                            {isUploading ? (
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <Plus size={18} />
                                Create Banner
                              </>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {activeTab === 'notifications' && (
              <motion.div 
                key="notifications"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
                      <Bell size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-gray-900">Push Notification Center</h2>
                      <p className="text-xs text-gray-500">Send a broadcast message to all users who have enabled notifications.</p>
                    </div>
                  </div>

                  <form onSubmit={sendNotification} className="space-y-6 max-w-2xl">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Notification Title</label>
                      <input 
                        type="text" 
                        value={notificationTitle}
                        onChange={(e) => setNotificationTitle(e.target.value)}
                        placeholder="e.g., New Restaurant Added!"
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500/20 transition-all"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Message Body</label>
                      <textarea 
                        value={notificationBody}
                        onChange={(e) => setNotificationBody(e.target.value)}
                        placeholder="e.g., Check out the new Milliy Taomlar in Shaykhantakhur district..."
                        rows={4}
                        className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500/20 transition-all resize-none"
                        required
                      />
                    </div>

                    {sendResult && (
                      <div className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-3 ${sendResult.success ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {sendResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        {sendResult.message}
                      </div>
                    )}

                    <button 
                      type="submit"
                      disabled={isSending}
                      className="w-full bg-amber-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-amber-500/20 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      {isSending ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send size={18} />
                          Send Broadcast
                        </>
                      )}
                    </button>
                  </form>
                </div>

                <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100">
                  <h4 className="text-sm font-black text-amber-900 mb-2 flex items-center gap-2">
                    <AlertCircle size={16} />
                    Important Note
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Notifications are sent to all users who have granted permission in their browser. 
                    This action cannot be undone. Please double-check your message before sending.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
