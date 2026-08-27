'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { useAuth } from '@/lib/auth';
import { hasRouteAccess } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/client';
import { useNotify } from '@/lib/modal-service';
import {
  GraduationCap,
  Users,
  Building2,
  AlertTriangle,
  Boxes,
  Truck,
  Sparkles,
  UserPlus,
  ClipboardList,
  ArrowRight,
  TrendingUp,
  PackageCheck,
  CalendarDays,
  Clock,
  CheckCircle2,
  Send,
  UserCheck,
  DoorClosed,
  Layers,
  ArrowUpRight,
  ShoppingBag,
  Megaphone,
  Pin,
  Plus,
  X,
  MessageSquare,
  Share2,
  FileText,
  Check,
  Copy,
  Info
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { resolveTeacherScope, ResolvedTeacherScope } from '@/lib/teacher-resolver';

export default function DashboardPage() {
  const { t, dir } = useI18n();
  const { settings } = useSettings();
  const { profile, user } = useAuth();
  const notify = useNotify();

  const isStaffManager = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN' || profile?.role === 'SUPERVISOR';
  const isTeacher = profile?.role === 'TEACHER';

  const [teacherScope, setTeacherScope] = useState<ResolvedTeacherScope | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<any[]>([]);
  const [teacherTotalStudents, setTeacherTotalStudents] = useState<number>(0);

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [selectedAnn, setSelectedAnn] = useState<any | null>(null);
  const [showQuickPublishModal, setShowQuickPublishModal] = useState(false);
  const [publishingAnn, setPublishingAnn] = useState(false);
  const [quickAnnForm, setQuickAnnForm] = useState({
    title: '',
    content: '',
    target_audience: 'ALL',
    priority: 'IMPORTANT',
    is_pinned: false,
  });

  const [stats, setStats] = useState({
    studentsCount: 0,
    teachersCount: 0,
    classesCount: 0,
    roomsCount: 0,
    suppliersCount: 0,
    totalStockArticles: 0,
    totalStockUnits: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    stockValuation: 0,
    dispatchesCount: 0,
    substitutionsCount: 0,
    attendanceRate: 100,
  });

  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [recentStudents, setRecentStudents] = useState<any[]>([]);
  const [cycleDistribution, setCycleDistribution] = useState<Array<{ name: string; value: number; color: string }>>([
    { name: t('maternelle'), value: 0, color: '#38bdf8' },
    { name: t('primaire'), value: 0, color: '#2563eb' },
    { name: t('college'), value: 0, color: '#f97316' },
    { name: t('lycee'), value: 0, color: '#8b5cf6' },
  ]);

  const [attendanceData, setAttendanceData] = useState<Array<{ day: string; presents: number; absents: number }>>([
    { day: dir === 'rtl' ? 'الإثنين' : 'Lun', presents: 100, absents: 0 },
    { day: dir === 'rtl' ? 'الثلاثاء' : 'Mar', presents: 100, absents: 0 },
    { day: dir === 'rtl' ? 'الأربعاء' : 'Mer', presents: 100, absents: 0 },
    { day: dir === 'rtl' ? 'الخميس' : 'Jeu', presents: 100, absents: 0 },
    { day: dir === 'rtl' ? 'الجمعة' : 'Ven', presents: 100, absents: 0 },
    { day: dir === 'rtl' ? 'السبت' : 'Sam', presents: 100, absents: 0 },
  ]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAllLiveStats() {
      try {
        setLoading(true);
        const supabase = createClient();

        // 0. If TEACHER, load teacher-scoped classes and student metrics
        if (profile?.role === 'TEACHER') {
          const scope = await resolveTeacherScope(profile);
          setTeacherScope(scope);
          if (scope.allowedClassIds.length > 0) {
            const [{ data: scopedClasses }, { data: scopedStudents }] = await Promise.all([
              supabase.from('classes').select('*').in('id', scope.allowedClassIds).order('name'),
              supabase.from('students').select('id, class_id').in('class_id', scope.allowedClassIds),
            ]);
            setTeacherClasses(scopedClasses || []);
            setTeacherTotalStudents((scopedStudents || []).length);
          }
        }

        // 1. Current Week Dates (Monday to Saturday)
        const now = new Date();
        const currentDay = now.getDay(); // 0 is Sunday
        const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const monday = new Date(now);
        monday.setDate(now.getDate() + distanceToMonday);

        const weekDays = [
          { key: 0, labelFr: 'Lun', labelAr: 'الإثنين' },
          { key: 1, labelFr: 'Mar', labelAr: 'الثلاثاء' },
          { key: 2, labelFr: 'Mer', labelAr: 'الأربعاء' },
          { key: 3, labelFr: 'Jeu', labelAr: 'الخميس' },
          { key: 4, labelFr: 'Ven', labelAr: 'الجمعة' },
          { key: 5, labelFr: 'Sam', labelAr: 'السبت' },
        ];

        const weekDatesMap = weekDays.map((w) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + w.key);
          const dateStr = d.toISOString().split('T')[0];
          return {
            day: dir === 'rtl' ? w.labelAr : w.labelFr,
            dateStr,
          };
        });
        const weekDatesList = weekDatesMap.map((w) => w.dateStr);

        const [
          { count: studentsCount, data: studentsData },
          { count: teachersCount },
          { count: classesCount },
          { count: roomsCount },
          { count: suppliersCount },
          { data: stockProducts },
          { data: stockMovements },
          { count: subsCount },
          { data: attendanceLogs },
        ] = await Promise.all([
          supabase.from('students').select('*, class:classes(name, level)', { count: 'exact' }).order('created_at', { ascending: false }),
          supabase.from('teachers').select('*', { count: 'exact', head: true }),
          supabase.from('classes').select('*', { count: 'exact', head: true }),
          supabase.from('rooms').select('*', { count: 'exact', head: true }),
          supabase.from('suppliers').select('*', { count: 'exact', head: true }),
          supabase.from('stock_products').select('quantity, minimum_quantity, purchase_price, value_price, name'),
          supabase.from('stock_movements').select('*, product:stock_products(name, unit)').order('created_at', { ascending: false }).limit(6),
          supabase.from('substitution_requests').select('*', { count: 'exact', head: true }),
          supabase.from('student_attendance').select('date, status').in('date', weekDatesList),
        ]);

        let effectiveProducts = stockProducts;
        if (!effectiveProducts || effectiveProducts.length === 0) {
          if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('gm_stock_products_v2');
            if (saved) {
              try {
                effectiveProducts = JSON.parse(saved);
              } catch {
                effectiveProducts = null;
              }
            }
          }
        }

        let totalArticles = effectiveProducts ? effectiveProducts.length : 0;
        let totalUnits = effectiveProducts ? effectiveProducts.reduce((sum: number, p: any) => sum + (Number(p.quantity) || 0), 0) : 0;
        let lowStock = effectiveProducts ? effectiveProducts.filter((p: any) => p.quantity > 0 && p.quantity <= (p.minimum_quantity || 5)).length : 0;
        let outOfStock = effectiveProducts ? effectiveProducts.filter((p: any) => p.quantity <= 0).length : 0;
        let stockVal = effectiveProducts ? effectiveProducts.reduce((sum: number, p: any) => sum + ((Number(p.quantity) || 0) * (Number(p.purchase_price || p.value_price) || 0)), 0) : 0;

        let effectiveMovements = stockMovements;
        if (!effectiveMovements || effectiveMovements.length === 0) {
          if (typeof window !== 'undefined') {
            const savedMovs = localStorage.getItem('gm_stock_movements_v2');
            if (savedMovs) {
              try {
                effectiveMovements = JSON.parse(savedMovs);
              } catch {
                effectiveMovements = null;
              }
            }
          }
        }

        let outMovements = effectiveMovements ? effectiveMovements.length : 0;
        const liveTotalStudents = studentsCount ?? (studentsData ? studentsData.length : 0);

        if (effectiveMovements) {
          setRecentMovements(effectiveMovements);
        }

        if (studentsData) {
          setRecentStudents(studentsData.slice(0, 4));

          // Compute Real Cycle Distribution
          let matCount = 0;
          let primCount = 0;
          let colCount = 0;
          let lycCount = 0;

          studentsData.forEach((st: any) => {
            const lvl = ((st.class?.level || '') + ' ' + (st.class?.name || '')).toUpperCase();
            if (['TPS', 'PS', 'MS', 'GS'].some((k) => lvl.includes(k))) matCount++;
            else if (['CP', 'CE1', 'CE2', 'CM1', 'CM2', 'CE6', '1AP', '2AP', '3AP', '4AP', '5AP', '6AP'].some((k) => lvl.includes(k))) primCount++;
            else if (['1AC', '2AC', '3AC'].some((k) => lvl.includes(k))) colCount++;
            else if (['TC', '1BAC', '2BAC'].some((k) => lvl.includes(k))) lycCount++;
            else primCount++;
          });

          setCycleDistribution([
            { name: t('maternelle'), value: matCount, color: '#38bdf8' },
            { name: t('primaire'), value: primCount, color: '#2563eb' },
            { name: t('college'), value: colCount, color: '#f97316' },
            { name: t('lycee'), value: lycCount, color: '#8b5cf6' },
          ]);
        }

        // Compute Real Weekly Attendance from Supabase Logs
        let totalWeeklyPresentsPercent = 0;
        let measuredDaysCount = 0;

        const computedAttendanceData = weekDatesMap.map((w) => {
          const dayLogs = (attendanceLogs || []).filter((log: any) => log.date === w.dateStr);
          const absentCount = dayLogs.filter((log: any) => log.status === 'ABSENT' || log.status === 'UNEXCUSED').length;

          if (liveTotalStudents > 0) {
            const presentCount = Math.max(0, liveTotalStudents - absentCount);
            const percent = Math.round((presentCount / liveTotalStudents) * 100);
            totalWeeklyPresentsPercent += percent;
            measuredDaysCount++;
            return {
              day: w.day,
              presents: percent,
              absents: Math.round((absentCount / liveTotalStudents) * 100),
            };
          } else {
            totalWeeklyPresentsPercent += 100;
            measuredDaysCount++;
            return {
              day: w.day,
              presents: 100,
              absents: 0,
            };
          }
        });

        // Load live announcements from Supabase
        const { data: annData } = await supabase
          .from('announcements')
          .select('*')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(6);

        if (annData && annData.length > 0) {
          setAnnouncements(annData);
        }

        setAttendanceData(computedAttendanceData);
        const avgAttendanceRate = measuredDaysCount > 0 ? Math.round((totalWeeklyPresentsPercent / measuredDaysCount) * 10) / 10 : 100;

        setStats({
          studentsCount: liveTotalStudents,
          teachersCount: teachersCount ?? 0,
          classesCount: classesCount ?? 0,
          roomsCount: roomsCount ?? 0,
          suppliersCount: suppliersCount ?? 0,
          totalStockArticles: totalArticles,
          totalStockUnits: totalUnits,
          lowStockCount: lowStock,
          outOfStockCount: outOfStock,
          stockValuation: stockVal,
          dispatchesCount: outMovements,
          substitutionsCount: subsCount ?? 0,
          attendanceRate: avgAttendanceRate,
        });
      } catch (err) {
        console.error('Error synchronizing dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAllLiveStats();
  }, [t, dir, profile]);

  const handleQuickPublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAnnForm.title.trim() || !quickAnnForm.content.trim()) return;

    setPublishingAnn(true);
    try {
      const supabase = createClient();
      const author = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || (dir === 'rtl' ? 'إدارة المؤسسة' : 'Direction GM');
      const payload = {
        title: quickAnnForm.title.trim(),
        content: quickAnnForm.content.trim(),
        target_audience: quickAnnForm.target_audience,
        priority: quickAnnForm.priority,
        is_pinned: quickAnnForm.is_pinned,
        author_name: author,
      };

      const { data, error } = await supabase.from('announcements').insert([payload]).select().single();
      if (error) throw error;

      if (data) {
        setAnnouncements((prev) => [data, ...prev]);
      }

      setShowQuickPublishModal(false);
      setQuickAnnForm({
        title: '',
        content: '',
        target_audience: 'ALL',
        priority: 'IMPORTANT',
        is_pinned: false,
      });

      notify({
        title: dir === 'rtl' ? 'تم نشر الإعلان بنجاح' : 'Annonce Publiée avec Succès',
        message: dir === 'rtl' ? 'تم تعميم الإخبار على كافة الأطر في المنصة.' : 'L\'avis a été diffusé à tous les collaborateurs de l\'établissement.',
        type: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      notify({
        title: 'Erreur',
        message: msg,
        type: 'danger',
      });
    } finally {
      setPublishingAnn(false);
    }
  };

  const greetingName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : user?.email?.split('@')[0] || t('admin');

  return (
    <DashboardLayout>
      <div className="space-y-7">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-[#0a1832] to-slate-950 border border-sky-500/25 p-5 sm:p-7 md:p-8 text-white shadow-2xl shadow-sky-950/40">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4 sm:space-y-5">
            {/* Top row: Logo + Header info */}
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white p-2 shadow-2xl shadow-sky-500/30 ring-2 ring-sky-400/60 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="GM School Logo"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sky-300 text-xs sm:text-sm font-semibold mb-1">
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                  <span className="leading-tight">
                    {t('academic_year')} {settings.academic_year || '2025-2026'} &bull; {settings.current_term ? `${t('term')} ${settings.current_term.replace(/[^0-9]/g, '') || '1'}` : `${t('term')} 1`} &bull; {t('synchronized_system')}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white leading-tight">
                  {t('hello')}, {greetingName}
                </h1>
                <p className="text-slate-300 text-xs sm:text-sm mt-1 font-medium tracking-wide">
                  {dir === 'rtl' ? (settings.school_name_ar || t('school_name')) : (settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES')}
                </p>
              </div>
            </div>

            {/* Bottom row: Action Buttons (Filtered by role access) */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {hasRouteAccess(profile?.role, '/announcements') && (
                <Link
                  href="/announcements"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-300 font-bold text-xs shadow-sm transition-all hover:scale-[1.02]"
                >
                  <Megaphone className="w-4 h-4 text-amber-400" />
                  <span>{dir === 'rtl' ? 'الإعلانات و WhatsApp' : 'Annonces & WhatsApp 📲'}</span>
                </Link>
              )}

              {hasRouteAccess(profile?.role, '/attendance/students') && !hasRouteAccess(profile?.role, '/attendance/staff') && (
                <Link
                  href="/attendance/students"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-300 font-bold text-xs shadow-sm transition-all hover:scale-[1.02]"
                >
                  <ClipboardList className="w-4 h-4 text-sky-400" />
                  <span>{t('student_attendance')}</span>
                </Link>
              )}

              {hasRouteAccess(profile?.role, '/stock') && (
                <Link
                  href="/stock"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs shadow-sm transition-all hover:scale-[1.02]"
                >
                  <Boxes className="w-4 h-4 text-slate-300" />
                  <span>{t('stock')}</span>
                </Link>
              )}

              {hasRouteAccess(profile?.role, '/attendance/staff') && (
                <Link
                  href="/attendance/staff"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-300 font-bold text-xs shadow-sm transition-all hover:scale-[1.02]"
                >
                  <UserCheck className="w-4 h-4 text-sky-400" />
                  <span>{t('teacher_attendance')}</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* 1. TOP URGENT / PINNED ANNOUNCEMENT ALERT BANNER */}
        {announcements.find((a) => a.is_pinned || a.priority === 'URGENT') && (
          (() => {
            const pinAnn = announcements.find((a) => a.is_pinned || a.priority === 'URGENT');
            const isUrgent = pinAnn?.priority === 'URGENT';
            return (
              <div
                className={`relative overflow-hidden rounded-3xl p-4 sm:p-5 border transition-all shadow-md animate-in fade-in ${
                  isUrgent
                    ? 'bg-gradient-to-r from-rose-950/80 via-rose-900/60 to-slate-900 text-white border-rose-500/40 shadow-rose-950/30'
                    : 'bg-gradient-to-r from-amber-950/80 via-amber-900/50 to-slate-900 text-white border-amber-500/40 shadow-amber-950/30'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div
                      className={`p-2.5 rounded-2xl shrink-0 ${
                        isUrgent
                          ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 animate-pulse'
                          : 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                      }`}
                    >
                      {isUrgent ? <AlertTriangle className="w-5 h-5" /> : <Pin className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isUrgent ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50' : 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                          }`}
                        >
                          {isUrgent ? (dir === 'rtl' ? 'إعلان عاجل' : 'Avis Urgent') : (dir === 'rtl' ? 'مذكرة مثبتة' : 'Note Épinglée')}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(pinAnn?.created_at).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR')} &bull; {pinAnn?.author_name || (dir === 'rtl' ? 'الإدارة العامة' : 'Direction')}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-sm sm:text-base text-white mt-1 truncate">
                        {pinAnn?.title}
                      </h3>
                      <p className="text-xs text-slate-300 line-clamp-1 mt-0.5">
                        {pinAnn?.content}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setSelectedAnn(pinAnn)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-950 hover:bg-slate-100 shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{dir === 'rtl' ? 'قراءة الإعلان كاملاً' : 'Lire le Communiqué'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        )}

        {/* TEACHER-SPECIFIC DASHBOARD VIEW */}
        {isTeacher ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* 4 Teacher KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 items-stretch">
              <Link href="/attendance/students" className="block group h-full">
                <StatCard
                  title={dir === 'rtl' ? 'أقسامي المسندة' : 'Mes Classes Assignées'}
                  value={loading ? '...' : `${teacherClasses.length} ${dir === 'rtl' ? 'أقسام' : 'Classes'}`}
                  subtitle={dir === 'rtl' ? 'جدول الحصص المعتمد' : 'Classes de votre planning'}
                  icon={GraduationCap}
                  color="cyan"
                />
              </Link>

              <Link href="/students" className="block group h-full">
                <StatCard
                  title={dir === 'rtl' ? 'مجموع تلاميذي' : 'Effectif de Mes Classes'}
                  value={loading ? '...' : `${teacherTotalStudents} ${dir === 'rtl' ? 'تلميذ' : 'Élèves'}`}
                  subtitle={dir === 'rtl' ? 'في الأقسام المسندة إليك' : 'Élèves sous votre suivi'}
                  icon={Users}
                  color="blue"
                />
              </Link>

              <Link href="/attendance/students" className="block group h-full">
                <StatCard
                  title={dir === 'rtl' ? 'ورقة الحضور اليومية' : 'Pointage Présence'}
                  value={dir === 'rtl' ? 'تسجيل الغياب' : "Faire l'Appel"}
                  subtitle={dir === 'rtl' ? 'متابعة حضور الحصص' : 'Suivi en temps réel'}
                  icon={ClipboardList}
                  color="emerald"
                />
              </Link>

              <Link href="/timetable" className="block group h-full">
                <StatCard
                  title={dir === 'rtl' ? 'جدول حصصي' : 'Emploi du Temps'}
                  value={dir === 'rtl' ? 'استعراض الحصص' : 'Consulter Planning'}
                  subtitle={dir === 'rtl' ? 'القاعات والتوقيت' : 'Salles et horaires'}
                  icon={CalendarDays}
                  color="orange"
                />
              </Link>
            </div>

            {/* Teacher Classes Grid */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                      {dir === 'rtl' ? 'الأقسام والمجموعات المسندة إليك' : 'Mes Classes & Groupes Pédagogiques'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {dir === 'rtl' ? 'الوصول السريع لتسجيل الغياب وتصفح لوائح التلاميذ' : 'Accès rapide au pointage des présences et consultation des effectifs'}
                    </p>
                  </div>
                </div>
              </div>

              {teacherClasses.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  {dir === 'rtl' ? 'لم يتم العثور على أقسام مسندة لحسابك بعد في جدول الحصص.' : 'Aucune classe ne vous a encore été assignée dans l\'emploi du temps.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {teacherClasses.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-black text-base text-slate-900 dark:text-white">
                            {c.name}
                          </div>
                          <div className="text-xs text-slate-400 font-semibold">
                            {c.level} &bull; {c.group_name || 'Groupe Global'}
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300">
                          {c.capacity ? `${c.capacity} places` : 'Actif'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <Link
                          href={`/attendance/students`}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs text-center transition-colors shadow-xs"
                        >
                          {dir === 'rtl' ? 'تسجيل الغياب' : 'Faire l\'Appel'}
                        </Link>
                        <Link
                          href={`/students`}
                          className="py-1.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs text-center transition-colors"
                        >
                          {dir === 'rtl' ? 'اللائحة' : 'Liste'}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ADMINISTRATIVE FULL DASHBOARD VIEW (ADMIN / SUPER_ADMIN) */
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 items-stretch">
              <Link href="/students" className="block group h-full">
                <StatCard
                  title={t('total_students_card')}
                  value={loading ? '...' : `${stats.studentsCount} ${t('student')}`}
                  subtitle={t('active_enrolled')}
                  icon={GraduationCap}
                  color="cyan"
                  trend={{ value: '+8.5%', isPositive: true }}
                />
              </Link>

              <Link href="/teachers" className="block group h-full">
                <StatCard
                  title={t('teaching_staff')}
                  value={loading ? '...' : `${stats.teachersCount} ${t('profs')}`}
                  subtitle={t('teachers_collaborators')}
                  icon={Users}
                  color="blue"
                />
              </Link>

              <Link href="/classes" className="block group h-full">
                <StatCard
                  title={t('classes_rooms')}
                  value={loading ? '...' : `${stats.classesCount} ${t('classes_unit')} / ${stats.roomsCount} ${t('rooms_unit')}`}
                  subtitle={t('divisions_locaux')}
                  icon={Building2}
                  color="orange"
                />
              </Link>

              <Link href="/stock" className="block group h-full">
                <StatCard
                  title={t('stock_equipment')}
                  value={loading ? '...' : `${stats.totalStockUnits} ${t('units')}`}
                  subtitle={stats.lowStockCount + stats.outOfStockCount > 0 ? `${stats.lowStockCount + stats.outOfStockCount} ${t('low_stock_items')}` : t('stock_provisioned')}
                  icon={AlertTriangle}
                  color={stats.lowStockCount + stats.outOfStockCount > 0 ? 'gold' : 'cyan'}
                />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 items-stretch">
              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full min-h-[220px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">{t('economat_logistics')}</h3>
                      <p className="text-[10px] text-slate-400 leading-tight">{t('store_suppliers')}</p>
                    </div>
                  </div>
                  <Link href="/stock" className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline shrink-0">
                    {t('manage')} &rarr;
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-2.5 py-3">
                  <div className="h-[74px] p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-center">
                    <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide leading-tight">{t('articles_referenced')}</div>
                    <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-1 leading-tight">
                      {stats.totalStockArticles} {t('articles_unit')}
                    </div>
                  </div>

                  <div className="h-[74px] p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-center">
                    <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide leading-tight">{t('supplier_partners')}</div>
                    <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-1 leading-tight">
                      {stats.suppliersCount} {t('partners_unit')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">{t('dispatches_out')}:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 shrink-0">{stats.dispatchesCount} {t('dispatches_unit')}</span>
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full min-h-[220px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">{t('attendance_tracking')}</h3>
                      <p className="text-[10px] text-slate-400 leading-tight">{t('collaborators_staff')}</p>
                    </div>
                  </div>
                  <Link href="/attendance/staff" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0">
                    {t('timesheet')} &rarr;
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-2.5 py-3">
                  <div className="h-[74px] p-2.5 sm:p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex flex-col justify-center">
                    <div className="text-[9.5px] font-bold text-emerald-600 uppercase tracking-wide leading-tight">{t('attendance_rate')}</div>
                    <div className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-300 mt-1 leading-tight">
                      {stats.attendanceRate}%
                    </div>
                  </div>

                  <div className="h-[74px] p-2.5 sm:p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 flex flex-col justify-center">
                    <div className="text-[9.5px] font-bold text-blue-600 uppercase tracking-wide leading-tight">{t('active_workforce')}</div>
                    <div className="text-sm sm:text-base font-black text-blue-700 dark:text-blue-300 mt-1 leading-tight">
                      {stats.teachersCount} {t('members')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">{t('active_substitutions')}:</span>
                  <span className="font-black text-purple-600 dark:text-purple-400 shrink-0">{stats.substitutionsCount} {t('substitutions_unit')}</span>
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full min-h-[220px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 shrink-0">
                      <DoorClosed className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">{t('premises_rooms')}</h3>
                      <p className="text-[10px] text-slate-400 leading-tight">{t('salles_labs')}</p>
                    </div>
                  </div>
                  <Link href="/rooms" className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline shrink-0">
                    {t('see')} &rarr;
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-2.5 py-3">
                  <div className="h-[74px] p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-center">
                    <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide leading-tight">{t('classrooms')}</div>
                    <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-1 leading-tight">
                      {stats.roomsCount} {t('rooms_unit')}
                    </div>
                  </div>

                  <div className="h-[74px] p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-center">
                    <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide leading-tight">{t('classes_levels')}</div>
                    <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-1 leading-tight">
                      {stats.classesCount} {t('classes_unit')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">{t('occupancy_rate')}:</span>
                  <span className="font-black text-sky-600 dark:text-sky-400 shrink-0">{t('optimized')} (100%)</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between min-h-[380px]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      {t('weekly_attendance_chart')}
                    </h3>
                    <p className="text-xs text-slate-500">{t('synced_attendance_sheet')}</p>
                  </div>
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-300/40 shrink-0">
                    {stats.attendanceRate}% {t('weekly_average')}
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderRadius: '12px',
                          color: '#fff',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="presents" fill="#0284c7" radius={[8, 8, 0, 0]} name={dir === 'rtl' ? 'الحضور (%)' : 'Présents (%)'} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between min-h-[380px]">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      {t('headcount_by_cycle')}
                    </h3>
                    <GraduationCap className="w-4 h-4 text-sky-500" />
                  </div>
                  <p className="text-xs text-slate-500">{t('real_student_distribution')}</p>

                  <div className="h-44 w-full my-2">
                    <ResponsiveContainer width="100%" height="100%">
                      {stats.studentsCount > 0 ? (
                        <PieChart>
                          <Pie
                            data={cycleDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {cycleDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(val: unknown) => `${Number(val || 0)} ${t('student')}`}
                            contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', border: '1px solid rgba(56, 189, 248, 0.2)' }}
                          />
                        </PieChart>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                          {dir === 'rtl' ? 'لا يوجد تلاميذ مسجلين حالياً' : 'Aucun élève inscrit actuellement'}
                        </div>
                      )}
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2 mt-2">
                    {cycleDistribution.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-slate-600 dark:text-slate-300 font-medium truncate">{item.name}</span>
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white shrink-0">
                          {item.value} {t('student')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">{t('total_students')}:</span>
                  <span className="font-black text-sky-600 dark:text-sky-400">{stats.studentsCount} {t('student')}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full min-h-[340px] space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{t('recent_stock_dispatches')}</h3>
                      <p className="text-[11px] text-slate-400 truncate">{t('supplies_consumables')}</p>
                    </div>
                  </div>
                  <Link href="/stock" className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline shrink-0">
                    {t('stock_journal')} &rarr;
                  </Link>
                </div>

                <div className="space-y-2.5 flex-1 flex flex-col justify-start">
                  {recentMovements.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 my-auto">
                      {t('no_recent_outflow')}
                    </div>
                  ) : (
                    recentMovements.slice(0, 4).map((mov) => (
                      <div
                        key={mov.id}
                        className="h-[58px] p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 font-bold flex items-center justify-center text-xs shrink-0">
                            -
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {mov.product?.name || (dir === 'rtl' ? 'مستلزمات عامة' : 'Article divers')}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {mov.destination || (dir === 'rtl' ? 'استخدام داخلي' : 'Usage interne')}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-black text-rose-600 dark:text-rose-400">
                            -{mov.quantity} {mov.product?.unit || 'U'}
                          </span>
                          <div className="text-[10px] text-slate-400">
                            {new Date(mov.created_at).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR')}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between h-full min-h-[340px] space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 shrink-0">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">{t('recent_student_registrations')}</h3>
                      <p className="text-[11px] text-slate-400 truncate">{t('students_page_title')}</p>
                    </div>
                  </div>
                  <Link href="/students" className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline shrink-0">
                    {t('all_students')} &rarr;
                  </Link>
                </div>

                <div className="space-y-2.5 flex-1 flex flex-col justify-start">
                  {recentStudents.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 my-auto">
                      {t('no_recent_students')}
                    </div>
                  ) : (
                    recentStudents.map((st) => (
                      <div
                        key={st.id}
                        className="h-[58px] p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                            {st.first_name?.[0] || 'E'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {st.first_name} {st.last_name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {st.class?.name || (dir === 'rtl' ? 'قسم عام' : 'Classe standard')}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>{t('active')}</span>
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(st.created_at || Date.now()).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR')}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* 5. LIVE ANNOUNCEMENTS & OFFICIAL NOTICES BOARD */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                  {dir === 'rtl' ? 'لوحة الإعلانات والمذكرات الإدارية الرسمية' : 'Avis Officiels, Mémos & Notes de Service'}
                </h3>
                <p className="text-xs text-slate-400 leading-tight mt-0.5">
                  {dir === 'rtl' ? 'إعلانات وتوجيهات الإدارة لجميع الأطر والأساتذة' : 'Communications et directives de la Direction à l\'ensemble des équipes'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isStaffManager && (
                <button
                  type="button"
                  onClick={() => setShowQuickPublishModal(true)}
                  className="px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{dir === 'rtl' ? 'نشر إعلان جديد' : 'Publier un Avis'}</span>
                </button>
              )}

              <Link
                href="/announcements"
                className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all flex items-center gap-1.5"
              >
                <span>{dir === 'rtl' ? 'الكل و WhatsApp 📲' : 'Toutes les Annonces'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Announcements Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {announcements.length === 0 ? (
              <div className="col-span-full py-8 text-center text-xs text-slate-400">
                {dir === 'rtl' ? 'لا توجد إعلانات منشورة حالياً.' : 'Aucune annonce publiée pour le moment.'}
              </div>
            ) : (
              announcements.slice(0, 3).map((ann) => {
                const isUrgent = ann.priority === 'URGENT';
                const isImportant = ann.priority === 'IMPORTANT';
                const isEvent = ann.priority === 'EVENT';

                const targetLabel =
                  ann.target_audience === 'TEACHERS'
                    ? (dir === 'rtl' ? 'الأساتذة' : 'Enseignants')
                    : ann.target_audience === 'ADMIN'
                    ? (dir === 'rtl' ? 'الإدارة' : 'Administration')
                    : ann.target_audience === 'SUPERVISORS'
                    ? (dir === 'rtl' ? 'الحراسة العامة' : 'Surveillants')
                    : (dir === 'rtl' ? 'كافة الأطر' : 'Tous les collaborateurs');

                return (
                  <div
                    key={ann.id}
                    onClick={() => setSelectedAnn(ann)}
                    className={`p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.01] hover:shadow-md cursor-pointer flex flex-col justify-between space-y-3 ${
                      isUrgent
                        ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                        : isImportant
                        ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                        : 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/60'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase ${
                              isUrgent
                                ? 'bg-rose-600 text-white'
                                : isImportant
                                ? 'bg-amber-500 text-slate-950'
                                : isEvent
                                ? 'bg-purple-600 text-white'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            {ann.priority || 'INFO'}
                          </span>

                          <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {targetLabel}
                          </span>

                          {ann.is_pinned && (
                            <span className="p-0.5 text-amber-500" title="Épinglé">
                              <Pin className="w-3 h-3" />
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(ann.created_at).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR')}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug">
                        {ann.title}
                      </h4>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {ann.content}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="truncate font-semibold text-slate-700 dark:text-slate-300">
                        {ann.author_name || (dir === 'rtl' ? 'الإدارة' : 'Direction')}
                      </span>
                      <span className="font-bold text-sky-600 dark:text-sky-400 hover:underline">
                        {dir === 'rtl' ? 'عرض الإعلان ←' : 'Lire la suite →'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 6. QUICK ACTIONS SHORTCUTS GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 items-stretch">
          {isTeacher ? (
            <>
              <Link
                href="/attendance/students"
                className="h-[105px] p-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:shadow-lg transition-all text-center group flex flex-col items-center justify-center gap-2"
              >
                <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs shrink-0">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white truncate w-full px-1">
                  {dir === 'rtl' ? 'ورقة الغياب' : "Feuille d'Appel"}
                </div>
              </Link>

              <Link
                href="/students"
                className="h-[105px] p-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500 hover:shadow-lg transition-all text-center group flex flex-col items-center justify-center gap-2"
              >
                <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:scale-110 group-hover:bg-sky-500 group-hover:text-white transition-all shadow-xs shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white truncate w-full px-1">
                  {dir === 'rtl' ? 'لوائح التلاميذ' : 'Mes Élèves'}
                </div>
              </Link>

              <Link
                href="/timetable"
                className="h-[105px] p-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-orange-500 hover:shadow-lg transition-all text-center group flex flex-col items-center justify-center gap-2"
              >
                <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 group-hover:scale-110 group-hover:bg-orange-500 group-hover:text-white transition-all shadow-xs shrink-0">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white truncate w-full px-1">
                  {dir === 'rtl' ? 'جدول الحصص' : 'Emploi du Temps'}
                </div>
              </Link>

              <Link
                href="/announcements"
                className="h-[105px] p-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 hover:shadow-lg transition-all text-center group flex flex-col items-center justify-center gap-2"
              >
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-xs shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white truncate w-full px-1">
                  {dir === 'rtl' ? 'الإعلانات' : 'Annonces'}
                </div>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/students"
                className="h-[105px] p-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500 hover:shadow-lg transition-all text-center group flex flex-col items-center justify-center gap-2"
              >
                <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:scale-110 group-hover:bg-sky-500 group-hover:text-white transition-all shadow-xs shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white truncate w-full px-1">
                  {dir === 'rtl' ? 'تسجيل تلميذ' : 'Inscrire Élève'}
                </div>
              </Link>

              <Link
                href="/attendance/students"
                className="h-[105px] p-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:shadow-lg transition-all text-center group flex flex-col items-center justify-center gap-2"
              >
                <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs shrink-0">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white truncate w-full px-1">
                  {dir === 'rtl' ? 'ورقة الغياب' : "Feuille d'Appel"}
                </div>
              </Link>

              <Link
                href="/attendance/staff"
                className="h-[105px] p-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:shadow-lg transition-all text-center group flex flex-col items-center justify-center gap-2"
              >
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white truncate w-full px-1">
                  {dir === 'rtl' ? 'حضور الأطر' : 'Pointage Staff'}
                </div>
              </Link>

              <Link
                href="/stock"
                className="h-[105px] p-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 hover:shadow-lg transition-all text-center group flex flex-col items-center justify-center gap-2"
              >
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-xs shrink-0">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white truncate w-full px-1">
                  {dir === 'rtl' ? 'تسليم مخزون' : 'Sortie Stock'}
                </div>
              </Link>

              <Link
                href="/suppliers"
                className="h-[105px] p-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:shadow-lg transition-all text-center group flex flex-col items-center justify-center gap-2"
              >
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-xs shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white truncate w-full px-1">
                  {dir === 'rtl' ? 'الموردون' : 'Fournisseurs ICE'}
                </div>
              </Link>

              <Link
                href="/substitutions"
                className="h-[105px] p-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500 hover:shadow-lg transition-all text-center group flex flex-col items-center justify-center gap-2"
              >
                <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-xs shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-slate-900 dark:text-white truncate w-full px-1">
                  {dir === 'rtl' ? 'التعويضات' : 'Remplacements'}
                </div>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* MODAL 1: VIEW FULL ANNOUNCEMENT DETAILS */}
      {selectedAnn && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      selectedAnn.priority === 'URGENT'
                        ? 'bg-rose-600 text-white'
                        : selectedAnn.priority === 'IMPORTANT'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {selectedAnn.priority}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(selectedAnn.created_at).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {selectedAnn.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAnn(null)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                {selectedAnn.content}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              <div>
                <span>{dir === 'rtl' ? 'جهة الإصدار : ' : 'Émis par : '}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedAnn.author_name || 'Direction GM'}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`📢 ${selectedAnn.title}\n\n${selectedAnn.content}\n\n— ${selectedAnn.author_name || 'Direction GM'}`);
                    notify({ title: 'Copié', message: 'Texte copié dans le presse-papier !', type: 'info' });
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs cursor-pointer flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{dir === 'rtl' ? 'نسخ' : 'Copier'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedAnn(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 cursor-pointer"
                >
                  {dir === 'rtl' ? 'إغلاق' : 'Fermer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: QUICK PUBLISH ANNOUNCEMENT (FOR ADMIN & SUPERVISOR) */}
      {showQuickPublishModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {dir === 'rtl' ? 'نشر إعلان رسمي لكافة الأطر' : 'Publier une Annonce / Note Officielle'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {dir === 'rtl' ? 'سيظهر الإشعار لجميع الموظفين فوراً' : 'L\'avis sera visible par tous les collaborateurs'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowQuickPublishModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickPublishAnnouncement} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {dir === 'rtl' ? 'عنوان الإعلان أو المذكرة *' : 'Titre de l\'annonce / Objet *'}
                </label>
                <input
                  type="text"
                  required
                  value={quickAnnForm.title}
                  onChange={(e) => setQuickAnnForm({ ...quickAnnForm, title: e.target.value })}
                  placeholder={dir === 'rtl' ? 'مثال: اجتماع طارئ، مذكرة تنظيمية، عطلة...' : 'Ex: Réunion pédagogique, Note de service...'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {dir === 'rtl' ? 'الفئة المستهدفة' : 'Destinataires'}
                  </label>
                  <select
                    value={quickAnnForm.target_audience}
                    onChange={(e) => setQuickAnnForm({ ...quickAnnForm, target_audience: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="ALL">{dir === 'rtl' ? 'كافة الأطر (الجميع)' : 'Tous les collaborateurs'}</option>
                    <option value="TEACHERS">{dir === 'rtl' ? 'هيئة التدريس (الأساتذة)' : 'Corps enseignant'}</option>
                    <option value="ADMIN">{dir === 'rtl' ? 'الأطر الإدارية' : 'Administration'}</option>
                    <option value="SUPERVISORS">{dir === 'rtl' ? 'الحراسة العامة' : 'Surveillants'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {dir === 'rtl' ? 'درجة الأهمية' : 'Priorité'}
                  </label>
                  <select
                    value={quickAnnForm.priority}
                    onChange={(e) => setQuickAnnForm({ ...quickAnnForm, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="IMPORTANT">🟡 IMPORTANT (مهم)</option>
                    <option value="URGENT">🔴 URGENT (عاجل)</option>
                    <option value="INFO">🔵 INFO (إخباري)</option>
                    <option value="EVENT">🟣 EVENT (نشاط / مناسبة)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {dir === 'rtl' ? 'نص وتفاصيل الإعلان *' : 'Contenu du message *'}
                </label>
                <textarea
                  required
                  rows={4}
                  value={quickAnnForm.content}
                  onChange={(e) => setQuickAnnForm({ ...quickAnnForm, content: e.target.value })}
                  placeholder={dir === 'rtl' ? 'اكتب نص المذكرة أو التوجيهات بالتفصيل...' : 'Rédigez le texte du communiqué...'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pin-ann"
                  checked={quickAnnForm.is_pinned}
                  onChange={(e) => setQuickAnnForm({ ...quickAnnForm, is_pinned: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="pin-ann" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  {dir === 'rtl' ? 'تثبيت الإعلان في أعلى الصفحة الرئيسية كشريط تنبيه عاجل' : 'Épingler en bannière d\'alerte sur le tableau de bord'}
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowQuickPublishModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  {dir === 'rtl' ? 'إلغاء' : 'Annuler'}
                </button>

                <button
                  type="submit"
                  disabled={publishingAnn}
                  className="px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-xl shadow-md shadow-amber-500/25 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Megaphone className="w-4 h-4" />
                  <span>{publishingAnn ? (dir === 'rtl' ? 'جاري النشر...' : 'Publication...') : (dir === 'rtl' ? 'نشر وتعميم الآن' : 'Diffuser l\'Avis')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
