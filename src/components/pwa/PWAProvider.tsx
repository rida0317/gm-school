'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Download, Smartphone, X, Check, Share, PlusSquare } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface PWAContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  installPWA: () => Promise<void>;
  showInstallBanner: boolean;
  dismissInstallBanner: () => void;
  openInstallGuide: () => void;
}

const PWAContext = createContext<PWAContextType>({
  isInstallable: false,
  isInstalled: false,
  isIOS: false,
  installPWA: async () => {},
  showInstallBanner: false,
  dismissInstallBanner: () => {},
  openInstallGuide: () => {},
});

export const usePWA = () => useContext(PWAContext);

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const { dir } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('GM School PWA Service Worker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('GM School PWA Service Worker registration failed:', err);
          });
      });
    }

    // 2. Check if already installed / running standalone
    if (typeof window !== 'undefined') {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;

      setIsInstalled(isStandalone);

      // Check for iOS
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIPhoneOrIPad = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isIPhoneOrIPad);

      // Check if user dismissed banner recently
      const dismissedUntil = localStorage.getItem('gm_pwa_banner_dismissed');
      const isDismissed = dismissedUntil && Number(dismissedUntil) > Date.now();

      // 3. Listen for `beforeinstallprompt` (Chrome / Edge / Android)
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setIsInstallable(true);
        if (!isStandalone && !isDismissed) {
          setShowInstallBanner(true);
        }
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // Listen for successful installation
      window.addEventListener('appinstalled', () => {
        setIsInstalled(true);
        setIsInstallable(false);
        setShowInstallBanner(false);
        setDeferredPrompt(null);
        console.log('GM School PWA Installed successfully!');
      });

      // If iOS and not standalone and not dismissed, allow banner
      if (isIPhoneOrIPad && !isStandalone && !isDismissed) {
        setIsInstallable(true);
      }

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const installPWA = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) {
      // Fallback for browsers without prompt event
      setShowIOSModal(true);
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowInstallBanner(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn('PWA Install Error:', err);
    }
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    // Dismiss for 3 days
    localStorage.setItem('gm_pwa_banner_dismissed', String(Date.now() + 3 * 24 * 60 * 60 * 1000));
  };

  const openInstallGuide = () => {
    setShowIOSModal(true);
  };

  return (
    <PWAContext.Provider
      value={{
        isInstallable,
        isInstalled,
        isIOS,
        installPWA,
        showInstallBanner,
        dismissInstallBanner,
        openInstallGuide,
      }}
    >
      {children}

      {/* Floating Bottom Install Banner */}
      {showInstallBanner && !isInstalled && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="p-4 rounded-3xl bg-slate-950/95 backdrop-blur-xl border border-sky-500/30 text-white shadow-2xl shadow-sky-950/60 flex items-center justify-between gap-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-lg shrink-0 flex items-center justify-center ring-2 ring-sky-400/50">
                <img src="/logo.png" alt="GM School" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black truncate text-sky-300">
                  {dir === 'rtl' ? 'تطبيق GM School 📲' : 'Application GM School 📲'}
                </div>
                <div className="text-[11px] text-slate-300 line-clamp-1">
                  {dir === 'rtl' ? 'ثبّت التطبيق على هاتفك لسرعة وسهولة الوصول' : 'Installez l\'app sur votre écran d\'accueil'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={installPWA}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black text-xs shadow-md shadow-sky-500/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{dir === 'rtl' ? 'تثبيت' : 'Installer'}</span>
              </button>
              <button
                onClick={dismissInstallBanner}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS & Manual Installation Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-white p-1 shadow-md shrink-0 flex items-center justify-center ring-2 ring-sky-500/30">
                  <img src="/logo.png" alt="GM School" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {dir === 'rtl' ? 'تثبيت تطبيق GM School' : 'Installer l\'Application GM School'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {dir === 'rtl' ? 'متوافق مع هواتف iPhone و Android والحاسوب' : 'Compatible iPhone, iPad, Android & PC'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {dir === 'rtl'
                  ? 'خطوات التثبيت السريع على الهاتف (iPhone / Android) :'
                  : 'Étapes simples pour ajouter l\'application :'}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {dir === 'rtl' ? 'في متصفح Safari على iPhone أو Chrome على Android :' : 'Sur Safari (iOS) ou Chrome (Android) :'}
                  </span>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {dir === 'rtl'
                      ? 'اضغط على زر المشاركة (Partager / Share)'
                      : 'Appuyez sur le bouton Partager en bas de votre écran'}
                  </p>
                </div>
                <Share className="w-5 h-5 text-sky-500 shrink-0 ml-auto" />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {dir === 'rtl' ? 'إضافة إلى الشاشة الرئيسية :' : 'Sur l\'écran d\'accueil :'}
                  </span>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {dir === 'rtl'
                      ? 'اختر "إضافة إلى الشاشة الرئيسية" (Sur l\'écran d\'accueil)'
                      : 'Faites défiler et sélectionnez "Sur l\'écran d\'accueil"'}
                  </p>
                </div>
                <PlusSquare className="w-5 h-5 text-emerald-500 shrink-0 ml-auto" />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {dir === 'rtl' ? 'تأكيد الإضافة :' : 'Confirmer :'}
                  </span>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {dir === 'rtl'
                      ? 'اضغط "إضافة" (Ajouter) في الأعلى وسيظهر التطبيق على شاشة هاتفك فوراً.'
                      : 'Appuyez sur "Ajouter" en haut à droite. L\'icône apparaîtra sur votre téléphone !'}
                  </p>
                </div>
                <Check className="w-5 h-5 text-amber-500 shrink-0 ml-auto" />
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs transition-colors cursor-pointer"
            >
              {dir === 'rtl' ? 'فهمت، حسناً' : 'J\'ai compris, merci'}
            </button>
          </div>
        </div>
      )}
    </PWAContext.Provider>
  );
}
