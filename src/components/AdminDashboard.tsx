import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  LayoutDashboard, 
  Store, 
  Image as ImageIcon, 
  Bell, 
  TrendingUp, 
  ArrowLeft,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AdminOverviewPage } from './admin/AdminOverviewPage';
import { AdminListingsPage } from './admin/AdminListingsPage';
import { AdminBannersPage } from './admin/AdminBannersPage';

interface AdminDashboardProps {
  onBack: () => void;
}

type AdminTab = 'overview' | 'restaurants' | 'banners' | 'notifications';

export default function AdminDashboard({ onBack }: AdminDashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [listingsFilter, setListingsFilter] = useState<string>('all');
  
  // Notification State (Placeholder)
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleNavigate = (tab: 'restaurants' | 'banners', filter?: string) => {
    if (tab === 'restaurants') {
      setListingsFilter(filter || 'all');
      setActiveTab('restaurants');
    } else {
      setActiveTab('banners');
    }
  };

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
            onClick={() => {
              setListingsFilter('all');
              setActiveTab('restaurants');
            }}
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
              <AdminOverviewPage key="overview" onNavigate={handleNavigate} />
            )}

            {activeTab === 'restaurants' && (
              <AdminListingsPage key="restaurants" initialFilter={listingsFilter} />
            )}

            {activeTab === 'banners' && (
              <AdminBannersPage key="banners" />
            )}

            {activeTab === 'notifications' && (
              <motion.div 
                key="notifications"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl mx-auto"
              >
                <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-8 space-y-6">
                  <div className="flex items-center gap-3 text-amber-600">
                    <Bell size={24} />
                    <h2 className="text-xl font-black">Push Notifications</h2>
                  </div>
                  <p className="text-gray-500 text-sm">Send a broadcast message to all users who have enabled notifications.</p>
                  
                  <form onSubmit={sendNotification} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Notification Title</label>
                      <input 
                        type="text"
                        value={notificationTitle}
                        onChange={(e) => setNotificationTitle(e.target.value)}
                        placeholder="e.g. New Discounts Available!"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Message Body</label>
                      <textarea 
                        value={notificationBody}
                        onChange={(e) => setNotificationBody(e.target.value)}
                        placeholder="Tell your users something interesting..."
                        rows={4}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isSending || !notificationTitle || !notificationBody}
                      className="w-full bg-amber-500 text-white py-4 rounded-2xl text-sm font-black shadow-xl shadow-amber-500/20 hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSending ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send size={18} />
                      )}
                      Send Broadcast
                    </button>
                  </form>

                  {sendResult && (
                    <div className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-3 ${
                      sendResult.success ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {sendResult.success ? <TrendingUp size={18} /> : <Bell size={18} />}
                      {sendResult.message}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
