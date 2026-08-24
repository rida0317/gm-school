'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { hasRouteAccess } from '@/lib/permissions';
import { UserRole } from '@/types/database';
import { LanguageSwitcher } from './LanguageSwitcher';
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
  PanelLeftOpen
} from 'lucide-react';

interface TopbarProps {
  onOpenSidebar: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
}

export function Topbar({ onOpenSidebar, isSidebarCollapsed = false, onToggleSidebarCollapse }: TopbarProps) {
  const { t, dir } = useI18n();
  const { user, profile, signOut, switchRole } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
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
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-3 sm:px-4 md:px-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors print:hidden">
      {/* Left section: Hamburger & Search */}
      <div className="flex items-center gap-2 sm:gap-4 flex-1 max-w-xl">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onOpenSidebar}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
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
          <img src="/logo.png" alt="Logo GM" className="w-8 h-8 object-contain rounded-lg" />
          <span className="font-bold text-xs text-slate-900 dark:text-white tracking-tight hidden xs:inline">GM School</span>
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

        {/* Notification Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
          </button>

          {showNotifications && (
            <div className={`absolute ${dir === 'rtl' ? 'left-0' : 'right-0'} mt-2 w-[calc(100vw-2rem)] max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 z-50 animate-in fade-in zoom-in-95`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Notifications Récentes
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-semibold">
                  Opérationnel
                </span>
              </div>
              <div className="mt-3 space-y-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
                  <div className="font-semibold text-blue-800 dark:text-blue-300">
                    Système Opérationnel
                  </div>
                  <p className="text-blue-700 dark:text-blue-400 text-[11px] mt-0.5">
                    Groupe Scolaire Des Générations Montantes — Prêt.
                  </p>
                </div>
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
