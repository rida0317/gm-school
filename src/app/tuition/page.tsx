'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { createClient } from '@/lib/supabase/client';
import { useNotify } from '@/lib/modal-service';
import { Student, ClassEntity } from '@/types/database';
import { PaymentModal, TuitionPaymentRecord } from '@/components/tuition/PaymentModal';
import { PaymentReceiptModal } from '@/components/tuition/PaymentReceiptModal';
import { WhatsAppPaymentModal } from '@/components/tuition/WhatsAppPaymentModal';
import {
  normalizeMoroccanPhone,
  buildPaymentReminderMessage,
  openWhatsAppChat
} from '@/lib/whatsapp';
import {
  CreditCard,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  MessageSquare,
  Search,
  Filter,
  Users,
  ChevronDown,
  RefreshCw,
  Send,
  Receipt,
  CheckCheck,
  TrendingUp,
  Percent,
  Plus,
  Bus,
  Coins
} from 'lucide-react';

const MONTHS_CONFIG = [
  { key: 'SEPTEMBER', fr: 'Septembre', ar: 'شتنبر', number: 9 },
  { key: 'OCTOBER', fr: 'Octobre', ar: 'أكتوبر', number: 10 },
  { key: 'NOVEMBER', fr: 'Novembre', ar: 'نونبر', number: 11 },
  { key: 'DECEMBER', fr: 'Décembre', ar: 'دجنبر', number: 12 },
  { key: 'JANUARY', fr: 'Janvier', ar: 'يناير', number: 1 },
  { key: 'FEBRUARY', fr: 'Février', ar: 'فبراير', number: 2 },
  { key: 'MARCH', fr: 'Mars', ar: 'مارس', number: 3 },
  { key: 'APRIL', fr: 'Avril', ar: 'أبريل', number: 4 },
  { key: 'MAY', fr: 'Mai', ar: 'ماي', number: 5 },
  { key: 'JUNE', fr: 'Juin', ar: 'يونيو', number: 6 },
];

export default function TuitionPage() {
  const { t, dir, locale } = useI18n();
  const { settings } = useSettings();
  const notify = useNotify();

  const currentAcademicYear = settings.academic_year || '2025-2026';
  const defaultMonthlyFee = 1500; // Default tuition fee in MAD

  // Current month key based on actual calendar month or default to SEPTEMBER
  const defaultMonthKey = useMemo(() => {
    const currentMonthNum = new Date().getMonth() + 1;
    const match = MONTHS_CONFIG.find((m) => m.number === currentMonthNum);
    return match ? match.key : 'OCTOBER';
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonthKey);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<TuitionPaymentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCycle, setSelectedCycle] = useState<string>('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const [transportFilter, setTransportFilter] = useState<'ALL' | 'WITH_TRANSPORT' | 'NO_TRANSPORT'>('ALL');

  // Modals state
  const [paymentModalStudent, setPaymentModalStudent] = useState<Student | null>(null);
  const [receiptModalData, setReceiptModalData] = useState<{
    student: Student;
    record: TuitionPaymentRecord;
  } | null>(null);
  const [showWhatsAppHub, setShowWhatsAppHub] = useState<boolean>(false);

  const activeMonthObj = MONTHS_CONFIG.find((m) => m.key === selectedMonth) || MONTHS_CONFIG[0];
  const activeMonthName = locale === 'ar' ? activeMonthObj.ar : activeMonthObj.fr;

  const schoolName =
    locale === 'ar'
      ? settings.school_name_ar || 'مجموعة مدارس الأجيال الصاعدة'
      : settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES';

  // Helper to compute fee breakdown for any student
  const getStudentFeeBreakdown = (student: Student) => {
    const customTuition =
      student.custom_tuition_fee !== undefined && student.custom_tuition_fee !== null && Number(student.custom_tuition_fee) > 0
        ? Number(student.custom_tuition_fee)
        : null;

    const cycleTuition = (() => {
      const lvl = ((student.class?.level || '') + ' ' + (student.class?.name || '')).toUpperCase();
      if (['TPS', 'PS', 'MS', 'GS'].some((k) => lvl.includes(k))) return Number(settings.tuition_fee_maternelle || 1300);
      if (['CP', 'CE1', 'CE2', 'CM1', 'CM2', '1AP', '2AP', '3AP', '4AP', '5AP', '6AP'].some((k) => lvl.includes(k))) return Number(settings.tuition_fee_primaire || 1500);
      if (['1AC', '2AC', '3AC'].some((k) => lvl.includes(k))) return Number(settings.tuition_fee_college || 1800);
      if (['TC', '1BAC', '2BAC'].some((k) => lvl.includes(k))) return Number(settings.tuition_fee_lycee || 2200);
      return Number(settings.tuition_fee_primaire || 1500);
    })();

    const baseTuition = customTuition !== null ? customTuition : cycleTuition;
    const isCustom = customTuition !== null;

    const hasTransport = Boolean(student.has_transport);
    const transportFee = hasTransport
      ? student.transport_fee !== undefined && student.transport_fee !== null
        ? Number(student.transport_fee)
        : Number(settings.default_transport_fee || 400)
      : 0;

    const totalMonthlyDue = baseTuition + transportFee;

    return {
      baseTuition,
      isCustom,
      hasTransport,
      transportFee,
      totalMonthlyDue,
    };
  };

  // Load students, classes and payment records
  const loadData = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: studsData }, { data: clsData }, { data: paymentsData }] = await Promise.all([
        supabase.from('students').select('*, class:classes(*)').order('last_name'),
        supabase.from('classes').select('*').order('name'),
        supabase.from('student_tuition_payments').select('*').eq('academic_year', currentAcademicYear),
      ]);

      if (studsData) setStudents(studsData as any);
      if (clsData) setClasses(clsData as any);
      if (paymentsData) setPaymentRecords(paymentsData as any);
    } catch (err: any) {
      console.error('Error loading tuition data:', err);
      notify({
        title: 'Erreur',
        message: err.message || 'Impossible de charger les données financières.',
        type: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentAcademicYear]);

  // Map of payments for currently selected month indexed by student_id
  const currentMonthPaymentMap = useMemo(() => {
    const map: Record<string, TuitionPaymentRecord> = {};
    paymentRecords
      .filter((p) => p.month === selectedMonth)
      .forEach((p) => {
        map[p.student_id] = p;
      });
    return map;
  }, [paymentRecords, selectedMonth]);

  // Filtered student list
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // Cycle filter
      if (selectedCycle !== 'ALL') {
        const lvl = ((student.class?.level || '') + ' ' + (student.class?.name || '')).toUpperCase();
        let studentCycle = 'PRIMAIRE';
        if (['TPS', 'PS', 'MS', 'GS'].some((k) => lvl.includes(k))) studentCycle = 'MATERNELLE';
        else if (['CP', 'CE1', 'CE2', 'CM1', 'CM2', '1AP', '2AP', '3AP', '4AP', '5AP', '6AP'].some((k) => lvl.includes(k))) studentCycle = 'PRIMAIRE';
        else if (['1AC', '2AC', '3AC'].some((k) => lvl.includes(k))) studentCycle = 'COLLEGE';
        else if (['TC', '1BAC', '2BAC'].some((k) => lvl.includes(k))) studentCycle = 'LYCEE';

        if (studentCycle !== selectedCycle) return false;
      }

      // Class filter
      if (selectedClassId !== 'ALL' && student.class_id !== selectedClassId) return false;

      // Transport filter
      if (transportFilter === 'WITH_TRANSPORT' && !student.has_transport) return false;
      if (transportFilter === 'NO_TRANSPORT' && student.has_transport) return false;

      // Status filter
      const feeInfo = getStudentFeeBreakdown(student);
      const payment = currentMonthPaymentMap[student.id];
      const totalFee = payment?.amount !== undefined ? payment.amount : feeInfo.totalMonthlyDue;
      const isPaid = payment?.status === 'PAID' || (payment && payment.paid_amount >= totalFee && totalFee > 0);
      if (statusFilter === 'PAID' && !isPaid) return false;
      if (statusFilter === 'UNPAID' && isPaid) return false;

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
        const code = (student.student_code || '').toLowerCase();
        const className = (student.class?.name || '').toLowerCase();
        const phone = student.guardian_phone || student.phone || '';
        return fullName.includes(q) || code.includes(q) || className.includes(q) || phone.includes(q);
      }

      return true;
    });
  }, [students, currentMonthPaymentMap, selectedCycle, selectedClassId, statusFilter, transportFilter, searchQuery, settings]);

  // Financial KPIs for the selected month
  const financialStats = useMemo(() => {
    const totalStudentsCount = students.length;
    let totalForecast = 0;
    let totalCollected = 0;
    let countPaid = 0;
    let countUnpaid = 0;
    let totalTransportCount = 0;

    students.forEach((student) => {
      if (student.has_transport) totalTransportCount++;

      const feeInfo = getStudentFeeBreakdown(student);
      const payment = currentMonthPaymentMap[student.id];
      const fee = payment?.amount !== undefined ? payment.amount : feeInfo.totalMonthlyDue;
      const paid = payment?.paid_amount || 0;

      totalForecast += fee;
      totalCollected += paid;

      if (payment?.status === 'PAID' || (paid >= fee && fee > 0)) {
        countPaid++;
      } else {
        countUnpaid++;
      }
    });

    const totalUnpaid = Math.max(0, totalForecast - totalCollected);
    const recoveryRate = totalForecast > 0 ? Math.round((totalCollected / totalForecast) * 100) : 0;

    return {
      totalStudentsCount,
      totalForecast,
      totalCollected,
      totalUnpaid,
      recoveryRate,
      countPaid,
      countUnpaid,
      totalTransportCount,
    };
  }, [students, currentMonthPaymentMap, settings]);

  // Handle saving payment
  const handleSavePayment = async (record: TuitionPaymentRecord, printImmediately = false) => {
    try {
      const supabase = createClient();
      const payload = {
        student_id: record.student_id,
        class_id: record.class_id || null,
        academic_year: record.academic_year,
        month: record.month,
        amount: record.amount,
        paid_amount: record.paid_amount,
        tuition_amount: record.tuition_amount || null,
        transport_amount: record.transport_amount || 0,
        has_transport: Boolean(record.has_transport),
        status: record.status,
        payment_method: record.payment_method || 'CASH',
        payment_date: record.payment_date || new Date().toISOString().split('T')[0],
        receipt_number: record.receipt_number,
        reference: record.reference || null,
        notes: record.notes || null,
      };

      const { data, error } = await supabase
        .from('student_tuition_payments')
        .upsert(payload, { onConflict: 'student_id,academic_year,month' })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setPaymentRecords((prev) => {
        const filtered = prev.filter(
          (p) => !(p.student_id === record.student_id && p.academic_year === record.academic_year && p.month === record.month)
        );
        return [...filtered, data as any];
      });

      notify({
        title: 'Paiement Enregistré',
        message: `Règlement de ${record.paid_amount} MAD validé avec succès (Reçu N° ${record.receipt_number}).`,
        type: 'success',
      });

      if (printImmediately && paymentModalStudent) {
        setReceiptModalData({
          student: paymentModalStudent,
          record: data as any,
        });
      }
    } catch (err: any) {
      console.error('Save payment error:', err);
      notify({
        title: 'Erreur',
        message: err.message || 'Impossible d\'enregistrer le règlement.',
        type: 'danger',
      });
    }
  };

  // Quick 1-click WhatsApp reminder
  const handleQuickWhatsAppReminder = (student: Student) => {
    const payment = currentMonthPaymentMap[student.id];
    const totalFee = payment?.amount || defaultMonthlyFee;
    const paid = payment?.paid_amount || 0;
    const dueAmount = totalFee - paid;
    const phone = student.guardian_phone || student.phone;

    const normalized = normalizeMoroccanPhone(phone);
    if (!normalized) {
      notify({
        title: 'Téléphone Manquant',
        message: 'Veuillez renseigner le numéro de téléphone du tuteur.',
        type: 'warning',
      });
      return;
    }

    const customTemplate =
      locale === 'ar'
        ? settings.whatsapp_payment_template_ar
        : settings.whatsapp_payment_template_fr;

    const message = buildPaymentReminderMessage({
      studentName: `${student.first_name} ${student.last_name}`,
      guardianName: student.guardian_name || '',
      className: student.class?.name || '',
      month: activeMonthName,
      amount: dueAmount,
      schoolName: schoolName,
      customTemplate: customTemplate,
      locale: locale as 'fr' | 'ar',
    });

    openWhatsAppChat(normalized, message);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full print:p-0" dir={dir}>
        {/* Top Header & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              <CreditCard className="w-4 h-4" />
              <span>{dir === 'rtl' ? 'المالية وتتبع الواجبات الشهرية' : 'Finances & Frais de Scolarité'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {dir === 'rtl' ? 'تتبع أداء الواجبات الشهرية والتذكيرات' : 'Suivi des Règlements & Rappels WhatsApp'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {dir === 'rtl'
                ? `السنة الدراسية : ${currentAcademicYear} • تسجيل المداخيل، طباعة الوصولات، وتذكير أولياء الأمور بنقرة واحدة.`
                : `Année Scolaire : ${currentAcademicYear} • Enregistrez les règlements, imprimez les reçus officiels et envoyez des rappels WhatsApp.`}
            </p>
          </div>

          {/* Top WhatsApp Hub Launcher Button */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowWhatsAppHub(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/25 transition-all transform active:scale-95 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{dir === 'rtl' ? 'مركز تذكير الواتساب' : 'Centre Rappels WhatsApp'}</span>
              {financialStats.countUnpaid > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-white text-emerald-800 text-[10px] font-black shadow-xs">
                  {financialStats.countUnpaid} {dir === 'rtl' ? 'غير مؤدى' : 'impayé(s)'}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer shadow-xs"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:hidden">
          {/* Total Collected */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 dark:from-emerald-950/40 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-900/50 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
              <span className="text-xs font-bold uppercase tracking-wider">
                {dir === 'rtl' ? 'المداخيل المستخلصة' : 'Total Encaissé'}
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Banknote className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white font-mono">
              {financialStats.totalCollected.toLocaleString()} <span className="text-xs font-sans text-emerald-600 font-bold">MAD</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{financialStats.countPaid}</span> {dir === 'rtl' ? 'تلميذ مؤدى' : 'élèves à jour'} ({activeMonthName})
            </div>
          </div>

          {/* Total Unpaid / Overdue */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-rose-500/10 to-amber-500/5 dark:from-rose-950/40 dark:to-slate-900 border border-rose-200/80 dark:border-rose-900/50 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
              <span className="text-xs font-bold uppercase tracking-wider">
                {dir === 'rtl' ? 'المبلغ المتبقي (غير مؤدى)' : 'Reste à Recouvrer'}
              </span>
              <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
              {financialStats.totalUnpaid.toLocaleString()} <span className="text-xs font-sans font-bold">MAD</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-bold text-rose-600">{financialStats.countUnpaid}</span> {dir === 'rtl' ? 'تلميذ في حالة انتظار' : 'élèves en attente / retard'}
            </div>
          </div>

          {/* Forecast */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-sky-700 dark:text-sky-400">
              <span className="text-xs font-bold uppercase tracking-wider">
                {dir === 'rtl' ? 'المبلغ التقديري للشهر' : 'Chiffre Prévisionnel'}
              </span>
              <div className="p-2 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
              {financialStats.totalForecast.toLocaleString()} <span className="text-xs font-sans text-slate-400 font-bold">MAD</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {dir === 'rtl' ? 'مجموع التلاميذ :' : 'Total effectif :'} <span className="font-bold">{financialStats.totalStudentsCount}</span> {dir === 'rtl' ? 'تلميذ' : 'élèves'}
            </div>
          </div>

          {/* Recovery Rate */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400">
              <span className="text-xs font-bold uppercase tracking-wider">
                {dir === 'rtl' ? 'نسبة الاستخلاص' : 'Taux Recouvrement'}
              </span>
              <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {financialStats.recoveryRate}%
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, financialStats.recoveryRate)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Fast Month Selector Pills */}
        <div className="p-2 sm:p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-1.5 overflow-x-auto scrollbar-none print:hidden">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 px-3 shrink-0">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <span>{dir === 'rtl' ? 'الشهر :' : 'Mois :'}</span>
          </div>

          {MONTHS_CONFIG.map((m) => {
            const isSelected = selectedMonth === m.key;
            const label = locale === 'ar' ? m.ar : m.fr;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedMonth(m.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25 scale-102'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Filter Controls */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 print:hidden">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={dir === 'rtl' ? 'بحث باسم التلميذ، رقم التسجيل، القسم أو الهاتف...' : 'Rechercher par élève, matricule, classe ou téléphone...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Cycle, Class & Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Cycle */}
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">{dir === 'rtl' ? 'جميع الأسلاك' : 'Tous les Cycles'}</option>
              <option value="MATERNELLE">{dir === 'rtl' ? 'التعليم الأولي (Maternelle)' : 'Maternelle'}</option>
              <option value="PRIMAIRE">{dir === 'rtl' ? 'التعليم الابتدائي (Primaire)' : 'Primaire'}</option>
              <option value="COLLEGE">{dir === 'rtl' ? 'التعليم الإعدادي (Collège)' : 'Collège'}</option>
              <option value="LYCEE">{dir === 'rtl' ? 'التعليم الثانوي (Lycée)' : 'Lycée'}</option>
            </select>

            {/* Class */}
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">{dir === 'rtl' ? 'جميع الأقسام' : 'Toutes les Classes'}</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>

            {/* Transport Filter */}
            <select
              value={transportFilter}
              onChange={(e) => setTransportFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">{dir === 'rtl' ? '🚌 كل التلاميذ' : '🚌 Tous (Transport + Normal)'}</option>
              <option value="WITH_TRANSPORT">{dir === 'rtl' ? '🚌 بالنقل المدرسي' : '🚌 Avec Transport'}</option>
              <option value="NO_TRANSPORT">{dir === 'rtl' ? 'بدون نقل' : 'Sans Transport'}</option>
            </select>

            {/* Status */}
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-0.5">
              {[
                { key: 'ALL', label: dir === 'rtl' ? 'الكل' : 'Tous' },
                { key: 'PAID', label: dir === 'rtl' ? 'مؤدى 🟢' : 'Réglés 🟢' },
                { key: 'UNPAID', label: dir === 'rtl' ? 'غير مؤدى 🔴' : 'Impayés 🔴' },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatusFilter(s.key as any)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    statusFilter === s.key
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tuition Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase text-[11px] tracking-wider">
                  <th className="py-3.5 px-4 w-36 whitespace-nowrap">{dir === 'rtl' ? 'رقم التسجيل' : 'Matricule'}</th>
                  <th className="py-3.5 px-4 min-w-[220px]">{dir === 'rtl' ? 'التلميذ وولي الأمر' : 'Élève & Tuteur'}</th>
                  <th className="py-3.5 px-4 w-40 whitespace-nowrap">{dir === 'rtl' ? 'القسم والمستوى' : 'Classe & Niveau'}</th>
                  <th className="py-3.5 px-4 min-w-[200px]">{dir === 'rtl' ? 'المبلغ والحالة' : 'Montant & Statut'}</th>
                  <th className="py-3.5 px-4 min-w-[200px]">{dir === 'rtl' ? 'الأداء والتوصيل' : 'Règlement & Reçu'}</th>
                  <th className="py-3.5 px-4 min-w-[190px] text-right whitespace-nowrap">{dir === 'rtl' ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                      {dir === 'rtl' ? 'لا توجد بيانات مطابقة لخيارات البحث.' : 'Aucun élève trouvé pour cette sélection.'}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => {
                    const feeInfo = getStudentFeeBreakdown(student);
                    const payment = currentMonthPaymentMap[student.id];
                    const totalFee = payment?.amount !== undefined ? payment.amount : feeInfo.totalMonthlyDue;
                    const paidAmount = payment?.paid_amount || 0;
                    const dueAmount = totalFee - paidAmount;
                    const isPaid = payment?.status === 'PAID' || (paidAmount >= totalFee && totalFee > 0);
                    const isPartial = paidAmount > 0 && paidAmount < totalFee;
                    const hasPhone = Boolean(student.guardian_phone || student.phone);

                    return (
                      <tr
                        key={student.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* 1. Matricule */}
                        <td className="py-3 px-4 font-mono font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {student.student_code}
                        </td>

                        {/* 2. Élève & Tuteur */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center text-xs shrink-0">
                              {student.first_name?.[0]}
                              {student.last_name?.[0]}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white truncate">
                                {student.first_name} {student.last_name}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                {student.guardian_name ? `${student.guardian_name} ` : ''}
                                {hasPhone && (
                                  <span className="font-mono text-slate-500">
                                    ({student.guardian_phone || student.phone})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Classe & Niveau */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {student.class?.name || 'Non assigné'}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5 uppercase">
                            {student.class?.level || 'Niveau'}
                          </div>
                        </td>

                        {/* 4. Montant & Statut with Breakdown */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{dir === 'rtl' ? 'مؤدى (Payé)' : 'Payé'}</span>
                              </span>
                            ) : isPartial ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>{dir === 'rtl' ? 'أداء جزئي' : 'Partiel'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>{dir === 'rtl' ? 'غير مؤدى' : 'Non Payé'}</span>
                              </span>
                            )}
                          </div>

                          <div className="mt-1 font-mono text-xs font-semibold">
                            {isPaid ? (
                              <span className="text-emerald-600 font-bold">{paidAmount.toLocaleString()} MAD</span>
                            ) : isPartial ? (
                              <span>
                                <span className="text-emerald-600 font-bold">{paidAmount.toLocaleString()}</span> / <span className="text-slate-800 dark:text-slate-200">{totalFee.toLocaleString()} MAD</span>
                              </span>
                            ) : (
                              <span className="text-rose-600 font-bold">{totalFee.toLocaleString()} MAD</span>
                            )}
                          </div>

                          {/* Detail Badges (Custom discount & Transport) */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {feeInfo.isCustom && (
                              <span className="inline-flex items-center text-[10px] text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/50 px-1.5 py-0.2 rounded font-bold">
                                ⭐ {dir === 'rtl' ? 'واجب خاص' : 'Spécial'} ({feeInfo.baseTuition} DH)
                              </span>
                            )}
                            {feeInfo.hasTransport && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-800 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950/50 px-1.5 py-0.2 rounded font-extrabold">
                                <Bus className="w-2.5 h-2.5" />
                                <span>+{feeInfo.transportFee} DH</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Règlement & Reçu */}
                        <td className="py-3 px-4">
                          {payment?.receipt_number ? (
                            <div className="space-y-0.5">
                              <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                {payment.receipt_number}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                <span>{payment.payment_method || 'CASH'}</span>
                                {payment.payment_date && <span>&bull; {payment.payment_date}</span>}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">
                              {dir === 'rtl' ? 'لم يسجل بعد' : 'En attente de paiement'}
                            </span>
                          )}
                        </td>

                        {/* 6. Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Record / Edit Payment button */}
                            <button
                              type="button"
                              onClick={() => setPaymentModalStudent(student)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all cursor-pointer transform active:scale-95"
                              title={dir === 'rtl' ? 'تسجيل الأداء' : 'Enregistrer le règlement'}
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>{isPaid ? (dir === 'rtl' ? 'تعديل' : 'Modifier') : (dir === 'rtl' ? 'تسجيل' : 'Régler')}</span>
                            </button>

                            {/* Print Receipt button (if payment recorded) */}
                            {payment && paidAmount > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setReceiptModalData({
                                    student,
                                    record: payment,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                                title="Imprimer le reçu de paiement"
                              >
                                <Receipt className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                                <span>{dir === 'rtl' ? 'وصل' : 'Reçu'}</span>
                              </button>
                            )}

                            {/* WhatsApp Reminder button (if unpaid or overdue) */}
                            {!isPaid && (
                              <button
                                type="button"
                                onClick={() => handleQuickWhatsAppReminder(student)}
                                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                                title="Envoyer rappel WhatsApp au parent"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                <span>WhatsApp</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payment Recording Modal */}
      {paymentModalStudent && (
        <PaymentModal
          student={paymentModalStudent}
          monthName={activeMonthName}
          monthKey={selectedMonth}
          academicYear={currentAcademicYear}
          existingRecord={currentMonthPaymentMap[paymentModalStudent.id] || null}
          defaultMonthlyFee={defaultMonthlyFee}
          onClose={() => setPaymentModalStudent(null)}
          onSave={handleSavePayment}
        />
      )}

      {/* Official Receipt Printable Modal */}
      {receiptModalData && (
        <PaymentReceiptModal
          student={receiptModalData.student}
          record={receiptModalData.record}
          monthName={activeMonthName}
          onClose={() => setReceiptModalData(null)}
        />
      )}

      {/* WhatsApp Payment Reminders Hub Modal */}
      {showWhatsAppHub && (
        <WhatsAppPaymentModal
          students={students}
          paymentRecords={paymentRecords}
          selectedMonth={selectedMonth}
          monthName={activeMonthName}
          defaultMonthlyFee={defaultMonthlyFee}
          onClose={() => setShowWhatsAppHub(false)}
          onRefreshData={loadData}
        />
      )}
    </DashboardLayout>
  );
}
