import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, LogIn, LogOut, ShieldCheck, ChevronDown, Globe } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import LoginModal from './LoginModal';
import { motion, AnimatePresence } from 'motion/react';

interface NavbarProps {
  onAdminClick?: () => void;
}

export default function Navbar({ onAdminClick }: NavbarProps) {
  const { t, i18n } = useTranslation();
  const { user, isAdmin, signOut } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setIsLangOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const languages = [
    { code: 'uz', label: 'O\'zbekcha' },
    { code: 'ru', label: 'Русский' },
    { code: 'en', label: 'English' }
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm px-3 sm:px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo - Left aligned */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 bg-[#1D9E75] rounded-lg flex items-center justify-center text-white shadow-md shrink-0">
            <MapPin size={24} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center">
              <div className="flex flex-col items-center mr-2 leading-none">
                <span className="text-[10px] font-bold text-gray-900 leading-none">{t('categoryFood')}</span>
                <div className="w-full border-t border-gray-900 my-px" />
                <span className="text-[10px] font-bold text-gray-900 leading-none">{t('categoryClothes')}</span>
              </div>
              <h1 className="text-[26px] font-black text-gray-900 leading-none tracking-tighter">
                {t('appName')}
              </h1>
            </div>
            {/* Tagline */}
            <div className="flex items-center gap-1 text-[11px] text-gray-500 font-medium mt-0.5">
              <span className="whitespace-nowrap">{t('taglinePart1')}</span>
              <span className="font-bold text-gray-700">
                {t('foodItem')}/{t('clothesItem')}
              </span>
              <span className="whitespace-nowrap">{t('taglinePart2')}</span>
            </div>
          </div>
        </div>

        {/* Right side: Admin, Auth, and Language */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Admin Dashboard Link (Visible only to Admin) */}
          {isAdmin && (
            <button 
              onClick={onAdminClick}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 text-[10px] font-black uppercase tracking-wider hover:bg-amber-100 transition-colors"
            >
              <ShieldCheck size={14} />
              {t('adminDashboard')}
            </button>
          )}

          {/* Auth Button */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col items-end leading-tight">
                  <span className="text-[10px] font-bold text-gray-900 line-clamp-1">{user.user_metadata?.full_name || user.email}</span>
                  {isAdmin && <span className="text-[8px] font-black text-amber-600 uppercase tracking-tighter">Admin</span>}
                </div>
                <button 
                  onClick={() => signOut()}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title={t('logout')}
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsLoginOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-wider hover:bg-gray-100 transition-colors"
              >
                <LogIn size={14} />
                <span className="hidden sm:inline">{t('login')}</span>
              </button>
            )}
          </div>

          {/* Language Selector Dropdown */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-gray-50 text-gray-600 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-wider hover:bg-gray-100 transition-colors"
            >
              <Globe size={14} />
              <span>{i18n.language.toUpperCase()}</span>
              <ChevronDown size={12} className={`transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isLangOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-[60]"
                >
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className={`w-full px-4 py-2 text-left text-[10px] font-bold transition-colors hover:bg-gray-50 ${
                        i18n.language === lang.code ? 'text-[#1D9E75]' : 'text-gray-600'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile Admin Icon */}
          {isAdmin && (
            <button 
              onClick={onAdminClick}
              className="sm:hidden p-2 text-amber-600 hover:bg-amber-50 rounded-full transition-colors"
            >
              <ShieldCheck size={20} />
            </button>
          )}
        </div>
      </div>

      <LoginModal 
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
      />
    </nav>
  );
}
