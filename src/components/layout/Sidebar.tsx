'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useI18n, TranslationKey } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  Building2,
  BookOpen,
  DoorClosed,
  CalendarDays,
  Sparkles,
  ClipboardCheck,
  UserCheck,
  Repeat,
  Boxes,
  Truck,
  CreditCard,
  History,
  Settings,
  Clock,
  Briefcase,
  Shield,
  X,
  LogOut,
  ChevronDown,
  Palette,
  Layers,
  Award,
  type LucideIcon
} from 'lucide-react';

import { useAuth } from '@/lib/auth';
import { hasRouteAccess, ROLE_CONFIGS } from '@/lib/permissions';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  highlight?: boolean;
  badge?: string;
  badgeColor?: string;
  iconColor?: string;
}

interface NavGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  badge?: string;
  items: NavItem[];
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
}

export function Sidebar({ isOpen, onClose, isCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [cycleQuery, setCycleQuery] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setCycleQuery(params.get('cycle'));
    }
  }, [pathname]);

  const { t, dir } = useI18n();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const [pendingCount, setPendingCount] = useState<number>(0);

  const currentRole = profile?.role || 'SUPER_ADMIN';
  const roleConfig = ROLE_CONFIGS[currentRole as keyof typeof ROLE_CONFIGS] || ROLE_CONFIGS.SUPER_ADMIN;

  // Track collapsed state of each group
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    cycles: true,
    students_teachers: true,
    finance: true,
    structure: false,
    attendance: false,
    logistics: false,
    admin: false,
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  useEffect(() => {
    async function getPendingCount() {
      try {
        const supabase = createClient();
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', false);
        if (count !== null && count !== undefined) {
          setPendingCount(count);
        }
      } catch {
        // ignore
      }
    }
    getPendingCount();
  }, [pathname]);

  async function handleLogout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    router.push('/login');
  }

  const roleKeys: Record<string, TranslationKey> = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    TEACHER: 'teacher',
    SUPERVISOR: 'supervisor',
    STOCK_MANAGER: 'stock_manager',
  };
  const roleDisplay = t(roleKeys[currentRole] || 'super_admin');

  // Navigation Groups with Dedicated Cycles Rubrique
  const rawNavigationGroups: NavGroup[] = useMemo(() => [
    {
      id: 'cycles',
      title: dir === 'rtl' ? 'الأسلاك التعليمية والشعب' : 'Cycles d\'Enseignement',
      icon: Layers,
      items: [
        {
          href: '/classes?cycle=Maternelle',
          label: dir === 'rtl' ? 'التعليم الأولي (Maternelle)' : 'Cycle Maternelle',
          icon: Palette,
          badge: 'TPS - GS',
          badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
          iconColor: 'text-sky-400',
        },
        {
          href: '/classes?cycle=Primaire',
          label: dir === 'rtl' ? 'التعليم الابتدائي (Primaire)' : 'Cycle Primaire',
          icon: BookOpen,
          badge: 'CP - CE6',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          iconColor: 'text-emerald-400',
        },
        {
          href: '/classes?cycle=College',
          label: dir === 'rtl' ? 'التعليم الإعدادي (Collège)' : 'Cycle Collège',
          icon: Sparkles,
          badge: '1AC - 3AC',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          iconColor: 'text-amber-400',
        },
        {
          href: '/classes?cycle=Lycee',
          label: dir === 'rtl' ? 'التعليم الثانوي (Lycée)' : 'Cycle Lycée & Bac',
          icon: Award,
          badge: 'TC - 2BAC',
          badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
          iconColor: 'text-purple-400',
        },
        {
          href: '/classes',
          label: dir === 'rtl' ? 'جميع الأقسام والفصول' : 'Toutes les Classes',
          icon: Building2,
          iconColor: 'text-slate-400',
        },
      ],
    },
    {
      id: 'students_teachers',
      title: dir === 'rtl' ? 'التلاميذ والأساتذة' : 'Élèves & Enseignants',
      icon: Users,
      items: [
        { href: '/students', label: t('students'), icon: GraduationCap, iconColor: 'text-sky-400' },
        { href: '/teachers', label: t('teachers'), icon: Users, iconColor: 'text-indigo-400' },
      ],
    },
    {
      id: 'finance',
      title: t('group_finance'),
      icon: CreditCard,
      items: [
        {
          href: '/tuition',
          label: t('tuition'),
          icon: CreditCard,
          highlight: true,
          badge: 'WhatsApp 📲',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        },
      ],
    },
    {
      id: 'structure',
      title: t('group_structure'),
      icon: Building2,
      items: [
        { href: '/subjects', label: t('subjects'), icon: BookOpen },
        { href: '/rooms', label: t('rooms'), icon: DoorClosed },
        { href: '/timetable', label: t('timetable'), icon: CalendarDays },
        { href: '/timetable/generator', label: t('timetable_generator'), icon: Sparkles, highlight: true, badge: 'IA' },
      ],
    },
    {
      id: 'attendance',
      title: t('group_attendance'),
      icon: ClipboardCheck,
      items: [
        { href: '/attendance/students', label: t('student_attendance'), icon: ClipboardCheck },
        { href: '/attendance/staff', label: t('teacher_attendance'), icon: Clock },
        { href: '/gardes', label: t('gardes_planning'), icon: Shield, badge: 'Auto', highlight: true },
        { href: '/substitutions', label: t('substitutions'), icon: Repeat, badge: t('smart') },
      ],
    },
    {
      id: 'logistics',
      title: t('group_logistics'),
      icon: Boxes,
      items: [
        { href: '/stock', label: t('stock'), icon: Boxes },
        { href: '/suppliers', label: t('suppliers'), icon: Truck },
      ],
    },
    {
      id: 'admin',
      title: t('group_admin'),
      icon: Settings,
      items: [
        { href: '/staff', label: t('staff'), icon: Briefcase },
        {
          href: '/users',
          label: t('users'),
          icon: UserCheck,
          badge: pendingCount > 0 ? `${pendingCount} new` : undefined,
          highlight: pendingCount > 0,
        },
        { href: '/audit-logs', label: t('audit_logs'), icon: History },
        { href: '/settings', label: t('settings'), icon: Settings },
      ],
    },
  ], [t, dir, pendingCount]);

  // Dynamic filter according to user role permissions
  const navigationGroups: NavGroup[] = useMemo(() => {
    return rawNavigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => hasRouteAccess(currentRole, item.href)),
      }))
      .filter((group) => group.items.length > 0);
  }, [currentRole, rawNavigationGroups]);

  // Check if an item is active
  const isItemActive = (item: NavItem) => {
    const [itemPath, itemQuery] = item.href.split('?');
    if (pathname !== itemPath) return false;

    if (itemQuery) {
      const paramValue = new URLSearchParams(itemQuery).get('cycle');
      return cycleQuery?.toLowerCase() === paramValue?.toLowerCase();
    }

    if (item.href === '/classes') {
      return pathname === '/classes' && !cycleQuery;
    }

    return true;
  };

  // Automatically keep group open when navigating to a new route
  useEffect(() => {
    navigationGroups.forEach((group) => {
      const hasActive = group.items.some(isItemActive);
      if (hasActive) {
        setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
      }
    });
  }, [pathname]);

  const isDashboardActive = pathname === '/dashboard';

  const handleMobileNavClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden transition-opacity animate-in fade-in"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 z-50 lg:z-30 flex flex-col w-72 bg-gradient-to-b from-slate-950 via-[#0a1426] to-slate-950 text-slate-100 shadow-2xl transition-all duration-300 ease-in-out print:hidden ${
          dir === 'rtl'
            ? `right-0 border-l border-sky-900/30 ${
                isCollapsed
                  ? 'translate-x-full pointer-events-none'
                  : isOpen
                  ? 'translate-x-0'
                  : 'translate-x-full lg:translate-x-0'
              }`
            : `left-0 border-r border-sky-900/30 ${
                isCollapsed
                  ? '-translate-x-full pointer-events-none'
                  : isOpen
                  ? 'translate-x-0'
                  : '-translate-x-full lg:translate-x-0'
              }`
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-20 px-5 border-b border-sky-900/30 bg-slate-950/80 backdrop-blur-md">
          <Link href="/dashboard" className="flex items-center gap-3 group overflow-hidden">
            <div className="relative shrink-0 w-11 h-11 rounded-2xl bg-white p-1 shadow-lg shadow-sky-500/25 ring-2 ring-sky-400/60 group-hover:scale-105 group-hover:ring-orange-400 transition-all duration-300 flex items-center justify-center">
              <img
                src={settings.logo_url || '/logo.png'}
                alt="GM School"
                className="w-9 h-9 object-contain"
              />
            </div>
            <div className="min-w-0">
              <span
                suppressHydrationWarning
                className="font-extrabold tracking-tight text-white block text-xs leading-tight truncate uppercase group-hover:text-sky-300 transition-colors"
              >
                {dir === 'rtl' ? (settings.school_name_ar || t('school_name')) : (settings.school_name || 'GÉNÉRATIONS MONTANTES')}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-sky-400 font-semibold truncate">{t('portal')}</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 truncate">
                  {roleDisplay}
                </span>
              </div>
            </div>
          </Link>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3.5 scrollbar-thin scrollbar-thumb-sky-900/50">
          {/* 1. Direct Dashboard Link */}
          <div>
            <Link
              href="/dashboard"
              onClick={handleMobileNavClick}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isDashboardActive
                  ? 'bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-sky-500/25'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className={`w-4 h-4 ${isDashboardActive ? 'text-white' : 'text-sky-400'}`} />
                <span>{t('dashboard')}</span>
              </div>
            </Link>
          </div>

          {/* 2. Accordion Navigation Groups */}
          {navigationGroups.map((group) => {
            const isOpen = openGroups[group.id] ?? false;
            const GroupIcon = group.icon;
            const hasActiveChild = group.items.some(isItemActive);

            return (
              <div key={group.id} className="rounded-2xl bg-slate-900/40 border border-sky-950/40 overflow-hidden">
                {/* Rubrique Header / Accordion Trigger */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleGroup(group.id);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-extrabold transition-all cursor-pointer select-none ${
                    hasActiveChild
                      ? 'text-sky-300 bg-sky-950/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <GroupIcon className={`w-4 h-4 shrink-0 ${hasActiveChild ? 'text-sky-400' : 'text-slate-500'}`} />
                    <span className="truncate uppercase tracking-wider text-[11px]">{group.title}</span>
                    {hasActiveChild && (
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0 ring-2 ring-sky-400/30" />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {group.badge && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300">
                        {group.badge}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isOpen ? 'rotate-0 text-sky-400' : '-rotate-90 text-slate-500'
                      }`}
                    />
                  </div>
                </button>

                {/* Sub-items list with collapsible animation */}
                {isOpen && (
                  <div className="px-1.5 pb-2 pt-1 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    {group.items.map((item) => {
                      const active = isItemActive(item);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={handleMobileNavClick}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                            active
                              ? 'bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white shadow-md shadow-sky-500/20 font-bold'
                              : item.highlight
                              ? 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30'
                              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                                active ? 'text-white' : item.iconColor || 'text-slate-400'
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>

                          {item.badge && (
                            <span
                              className={`px-1.5 py-0.5 text-[9px] font-black rounded-md shrink-0 border ${
                                item.badgeColor || 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Academic Info & Logout */}
        <div className="p-3.5 border-t border-sky-900/30 bg-slate-950/70 space-y-2">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-gradient-to-br from-sky-950/50 to-slate-900/80 border border-sky-500/20 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0 ring-2 ring-emerald-400/30" />
            <div className="text-xs min-w-0">
              <div className="text-white font-bold truncate text-[11px]">
                {t('academic_year')} {settings.academic_year || '2025-2026'}
              </div>
              <div className="text-sky-300 text-[10px] font-medium truncate">
                {settings.current_term ? `${t('term')} ${settings.current_term.replace(/[^0-9]/g, '') || '1'}` : `${t('term')} 1`} &bull; {t('in_progress')}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-600/20 border border-rose-500/20 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
