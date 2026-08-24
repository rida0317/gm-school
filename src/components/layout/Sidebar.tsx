'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
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
  UserX,
  UserCheck,
  Repeat,
  Boxes,
  Truck,
  ShoppingCart,
  Wallet,
  FileBarChart,
  History,
  ShieldCheck,
  Settings,
  Clock,
  Briefcase,
  Shield,
  X,
  LogOut,
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
}

interface NavGroup {
  title: string;
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
  const { t, dir } = useI18n();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const [pendingCount, setPendingCount] = useState<number>(0);

  const currentRole = profile?.role || 'SUPER_ADMIN';
  const roleConfig = ROLE_CONFIGS[currentRole as keyof typeof ROLE_CONFIGS] || ROLE_CONFIGS.SUPER_ADMIN;

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

  const rawNavigationGroups: NavGroup[] = [
    {
      title: t('group_main'),
      items: [
        { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
        { href: '/students', label: t('students'), icon: GraduationCap },
        { href: '/teachers', label: t('teachers'), icon: Users },
      ],
    },
    {
      title: t('group_structure'),
      items: [
        { href: '/classes', label: t('classes'), icon: Building2 },
        { href: '/subjects', label: t('subjects'), icon: BookOpen },
        { href: '/rooms', label: t('rooms'), icon: DoorClosed },
        { href: '/timetable', label: t('timetable'), icon: CalendarDays },
        { href: '/timetable/generator', label: t('timetable_generator'), icon: Sparkles, highlight: true },
      ],
    },
    {
      title: t('group_attendance'),
      items: [
        { href: '/attendance/students', label: t('student_attendance'), icon: ClipboardCheck },
        { href: '/attendance/staff', label: t('teacher_attendance'), icon: Clock },
        { href: '/gardes', label: t('gardes_planning'), icon: Shield, badge: 'Auto', highlight: true },
        { href: '/substitutions', label: t('substitutions'), icon: Repeat, badge: t('smart') },
      ],
    },
    {
      title: t('group_logistics'),
      items: [
        { href: '/stock', label: t('stock'), icon: Boxes },
        { href: '/suppliers', label: t('suppliers'), icon: Truck },
      ],
    },
    {
      title: t('group_admin'),
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
  ];

  // Dynamic filter according to user role permissions
  const navigationGroups: NavGroup[] = rawNavigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasRouteAccess(currentRole, item.href)),
    }))
    .filter((group) => group.items.length > 0);

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
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-thin scrollbar-thumb-sky-900/50">
          {navigationGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              <div className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-sky-400/80 mb-2">
                {group.title}
              </div>
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-sky-500/25 font-bold'
                        : item.highlight
                        ? 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          isActive ? 'text-white' : item.highlight ? 'text-amber-400' : 'text-slate-400'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-orange-500/20 text-orange-300 border border-orange-500/30">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer Academic Info & Logout */}
        <div className="p-4 border-t border-sky-900/30 bg-slate-950/60 space-y-2">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-br from-sky-950/50 to-slate-900/80 border border-sky-500/20 shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0 ring-2 ring-emerald-400/30" />
            <div className="text-xs min-w-0">
              <div className="text-white font-bold truncate">
                {t('academic_year')} {settings.academic_year || '2025-2026'}
              </div>
              <div className="text-sky-300 text-[11px] font-medium truncate">
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
