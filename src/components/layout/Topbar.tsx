'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { useAuth } from '@/lib/auth';
import { hasRouteAccess } from '@/lib/permissions';
import { UserRole } from '@/types/database';
import { LanguageSwitcher } from './LanguageSwitcher';
import { createClient } from '@/lib/supabase/client';
import {
  Menu,
  Bell,
  Search,
  User,
  Shield,
  Sparkles,
  LogOut,
  Settings,
  UserCheck,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Megaphone,
  Pin,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

interface TopbarProps {
  onOpenSidebar: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
}

export function Topbar({ onOpenSidebar, isSidebarCollapsed = false, onToggleSidebarCollapse }: TopbarProps) {
  const { t, dir } = useI18n();
  const { settings } = useSettings();
  const { user, profile, signOut, switchRole } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [latestAnnouncements, setLatestAnnouncements] = useState<any[]>([]);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Load latest announcements for staff notifications
  useEffect(() => {
    async function loadAnnouncements() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('announcements')
          .select('*')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5);

        if (data && data.length > 0) {
          setLatestAnnouncements(data);
        }
      } catch (err) {
        console.warn('Could not load announcements in topbar:', err);
      }
    }
    loadAnnouncements();
  }, []);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const displayName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
    : user?.email?.split('@')[0] || 'Admin Principal';

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: 'Super Administrateur',
    ADMIN: 'Directeur',
    TEACHER: 'Enseignant',
    SUPERVISOR: 'Surveillant Général',
    STOCK_MANAGER: 'Gestionnaire Stock',
  };

  const userRole = profile?.role || 'SUPER_ADMIN';
  const roleLabel = roleLabels[userRole] || userRole;

  const initials = profile
    ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase() || 'U'
    : user?.email?.[0]?.toUpperCase() || 'A';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between min-h-[4rem] h-auto pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-2 px-3.5 sm:px-5 md:px-8 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 transition-colors print:hidden shadow-xs">
      {/* Left section: Hamburger & Search */}
      <div className="flex items-center gap-2.5 sm:gap-4 flex-1 max-w-xl">
        {/* Mobile menu button with 44x44px touch target, prominent background and ring */}
        <button
          type="button"
          onClick={onOpenSidebar}
          className="lg:hidden flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] text-slate-800 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-90 rounded-2xl shadow-xs border border-slate-300/80 dark:border-slate-700 transition-all cursor-pointer shrink-0"
          aria-label="Toggle sidebar"
          title={dir === 'rtl' ? 'فتح القائمة الجانبية' : 'Ouvrir le menu'}
        >
          <Menu className="w-5 h-5 text-sky-600 dark:text-sky-400" />
        </button>

        {/* Desktop Collapse Toggle for Full Screen Table space */}
        {onToggleSidebarCollapse && (
          <button
            type="button"
            onClick={onToggleSidebarCollapse}
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100/90 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer border border-slate-200/60 dark:border-slate-700 shrink-0"
            title={
              isSidebarCollapsed
                ? dir === 'rtl'
                  ? 'إظهار القائمة الجانبية'
                  : 'Afficher la barre latérale'
                : dir === 'rtl'
                ? 'إخفاء القائمة الجانبية (شاشة عريضة للجداول)'
                : 'Masquer la barre latérale (Mode plein écran)'
            }
          >
            {isSidebarCollapsed ? (
              <>
                <PanelLeftOpen className="w-4 h-4 text-sky-500" />
                <span className="hidden xl:inline">{dir === 'rtl' ? 'القائمة' : 'Menu'}</span>
              </>
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 text-slate-500" />
                <span className="hidden xl:inline">{dir === 'rtl' ? 'شاشة كاملة' : 'Plein Écran'}</span>
              </>
            )}
          </button>
        )}

        <div className="flex items-center gap-2 lg:hidden">
          <img src={settings.logo_url || '/logo.png'} alt="Logo GM" className="w-8 h-8 object-contain rounded-xl ring-1 ring-sky-500/30" />
          <span className="font-extrabold text-xs text-slate-900 dark:text-white tracking-tight hidden xs:inline">GM School</span>
        </div>

        <div className="relative w-full hidden sm:block">
          <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
          <input
            type="text"
            placeholder={t('search')}
            className={`w-full ${dir === 'rtl' ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 text-sm bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 text-slate-800 dark:text-slate-200 transition-all placeholder:text-slate-400`}
          />
        </div>
      </div>

      {/* Right section: Language Switcher, Notifications, User Badge */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
        <LanguageSwitcher />

        {/* Notification Bell with Announcement Center */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title={dir === 'rtl' ? 'الإشعارات والإعلانات' : 'Notifications & Annonces'}
          >
            <Bell className="w-5 h-5" />
            {latestAnnouncements.length > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className={`absolute ${dir === 'rtl' ? 'left-0' : 'right-0'} mt-2 w-[calc(100vw-2rem)] sm:w-96 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50 animate-in fade-in zoom-in-95 space-y-3`}>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    {dir === 'rtl' ? 'الإعلانات والمذكرات الإدارية' : 'Annonces & Notes de Service'}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-extrabold">
                  {latestAnnouncements.length} {dir === 'rtl' ? 'إعلان' : 'récent(s)'}
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {latestAnnouncements.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    {dir === 'rtl' ? 'لا توجد إعلانات جديدة حالياً' : 'Aucune nouvelle annonce'}
                  </div>
                ) : (
                  latestAnnouncements.map((ann) => {
                    const isUrgent = ann.priority === 'URGENT';
                    const isImportant = ann.priority === 'IMPORTANT';
                    return (
                      <Link
                        key={ann.id}
                        href="/announcements"
                        onClick={() => setShowNotifications(false)}
                        className={`block p-2.5 rounded-2xl border transition-all hover:scale-[1.01] ${
                          isUrgent
                            ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                            : isImportant
                            ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                              isUrgent
                                ? 'bg-rose-600 text-white'
                                : isImportant
                                ? 'bg-amber-600 text-white'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
                            }`}
                          >
                            {isUrgent ? 'URGENT' : isImportant ? 'IMPORTANT' : 'INFO'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(ann.created_at).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR')}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">
                          {ann.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                          {ann.content}
                        </p>
                      </Link>
                    );
                  })
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                <Link
                  href="/announcements"
                  onClick={() => setShowNotifications(false)}
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-black text-sky-600 dark:text-sky-400 hover:underline w-full py-1"
                >
                  <span>{dir === 'rtl' ? 'عرض جميع الإعلانات والتواصل عبر WhatsApp' : 'Centre d\'annonces & WhatsApp'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User profile dropdown pill */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 sm:gap-3 pl-1.5 sm:pl-2 py-1 pr-1.5 sm:pr-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent hover:border-slate-200 dark:hover:border-slate-700/60 transition-all cursor-pointer"
          >
            <div suppressHydrationWarning className="flex items-center justify-center w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white font-bold text-xs shadow-md shadow-sky-500/20 shrink-0">
              {initials}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                <span suppressHydrationWarning className="max-w-[130px] truncate">{displayName}</span>
                <Shield className="w-3 h-3 text-sky-500 shrink-0" />
              </div>
              <div suppressHydrationWarning className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate max-w-[130px]">
                {userRole}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
          </button>

          {/* User dropdown menu */}
          {showUserMenu && (
            <div className={`absolute ${dir === 'rtl' ? 'left-0' : 'right-0'} mt-2 w-[calc(100vw-2rem)] max-w-xs bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2.5 z-50 animate-in fade-in zoom-in-95 space-y-2`}>
              {/* Account summary header */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {displayName}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {profile?.email || user?.email || 'compte@gm-school.ma'}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 text-[10px] font-bold border border-sky-300/50">
                    <Shield className="w-2.5 h-2.5" />
                    <span>{roleLabel}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                {hasRouteAccess(userRole, '/users') && (
                  <Link
                    href="/users"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <UserCheck className="w-4 h-4 text-sky-500" />
                    <span>Gestion des Utilisateurs</span>
                  </Link>
                )}

                {hasRouteAccess(userRole, '/settings') && (
                  <Link
                    href="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Paramètres du Système</span>
                  </Link>
                )}
              </div>

              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Se Déconnecter</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
