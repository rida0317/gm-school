'use client';

import React, { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { Student } from '@/types/database';
import { TuitionPaymentRecord } from './PaymentModal';
import { createClient } from '@/lib/supabase/client';
import { useNotify } from '@/lib/modal-service';
import {
  normalizeMoroccanPhone,
  buildPaymentReminderMessage,
  openWhatsAppChat
} from '@/lib/whatsapp';
import {
  X,
  Search,
  Send,
  CheckCheck,
  Smartphone,
  Edit2,
  Filter,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Sparkles,
  PhoneCall,
  User,
  CreditCard
} from 'lucide-react';

interface WhatsAppPaymentModalProps {
  students: Student[];
  paymentRecords: TuitionPaymentRecord[];
  selectedMonth: string;
  monthName: string;
  defaultMonthlyFee?: number;
  onClose: () => void;
  onRefreshData?: () => Promise<void>;
}

export function WhatsAppPaymentModal({
  students,
  paymentRecords,
  selectedMonth,
  monthName,
  defaultMonthlyFee = 1500,
  onClose,
  onRefreshData,
}: WhatsAppPaymentModalProps) {
  const { t, dir, locale } = useI18n();
  const { settings } = useSettings();
  const notify = useNotify();

  const schoolName =
    locale === 'ar'
      ? settings.school_name_ar || 'مجموعة مدارس الأجيال الصاعدة'
      : settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCycle, setSelectedCycle] = useState<string>('ALL');
  const [sentStudentIds, setSentStudentIds] = useState<Record<string, boolean>>({});

  // Quick edit phone modal state
  const [editingPhoneStudent, setEditingPhoneStudent] = useState<{
    student: Student;
    phone: string;
    guardianName: string;
  } | null>(null);
  const [savingPhone, setSavingPhone] = useState(false);

  // Message preview / custom send state
  const [previewModal, setPreviewModal] = useState<{
    student: Student;
    dueAmount: number;
    phone: string;
    message: string;
  } | null>(null);

  // Map of payments for selected month
  const paymentMap = useMemo(() => {
    const map: Record<string, TuitionPaymentRecord> = {};
    paymentRecords
      .filter((r) => r.month === selectedMonth)
      .forEach((r) => {
        map[r.student_id] = r;
      });
    return map;
  }, [paymentRecords, selectedMonth]);

  // List of unpaid or partially paid students
  const unpaidStudents = useMemo(() => {
    return students
      .map((student) => {
        const payment = paymentMap[student.id];

        const baseTuition =
          student.custom_tuition_fee !== undefined && student.custom_tuition_fee !== null && Number(student.custom_tuition_fee) > 0
            ? Number(student.custom_tuition_fee)
            : (() => {
                const lvl = ((student.class?.level || '') + ' ' + (student.class?.name || '')).toUpperCase();
                if (['TPS', 'PS', 'MS', 'GS'].some(k => lvl.includes(k))) return Number(settings.tuition_fee_maternelle || 1300);
                if (['CP', 'CE1', 'CE2', 'CM1', 'CM2', '1AP', '2AP', '3AP', '4AP', '5AP', '6AP'].some(k => lvl.includes(k))) return Number(settings.tuition_fee_primaire || 1500);
                if (['1AC', '2AC', '3AC'].some(k => lvl.includes(k))) return Number(settings.tuition_fee_college || 1800);
                if (['TC', '1BAC', '2BAC'].some(k => lvl.includes(k))) return Number(settings.tuition_fee_lycee || 2200);
                return Number(settings.tuition_fee_primaire || 1500);
              })();

        const transportFee = student.has_transport
          ? student.transport_fee !== undefined && student.transport_fee !== null
            ? Number(student.transport_fee)
            : Number(settings.default_transport_fee || 400)
          : 0;

        const totalFee = payment?.amount !== undefined ? payment.amount : (baseTuition + transportFee);
        const paidAmount = payment?.paid_amount || 0;
        const dueAmount = totalFee - paidAmount;
        const isPaid = payment?.status === 'PAID' || (paidAmount >= totalFee && totalFee > 0);

        return {
          student,
          payment,
          baseTuition,
          transportFee,
          totalFee,
          paidAmount,
          dueAmount,
          isPaid,
          guardianPhone: student.guardian_phone || student.phone || '',
        };
      })
      .filter((item) => {
        if (item.isPaid || item.dueAmount <= 0) return false;

        if (selectedCycle !== 'ALL') {
          const lvl = ((item.student.class?.level || '') + ' ' + (item.student.class?.name || '')).toUpperCase();
          let itemCycle = 'PRIMAIRE';
          if (['TPS', 'PS', 'MS', 'GS'].some(k => lvl.includes(k))) itemCycle = 'MATERNELLE';
          else if (['CP', 'CE1', 'CE2', 'CM1', 'CM2', '1AP', '2AP', '3AP', '4AP', '5AP', '6AP'].some(k => lvl.includes(k))) itemCycle = 'PRIMAIRE';
          else if (['1AC', '2AC', '3AC'].some(k => lvl.includes(k))) itemCycle = 'COLLEGE';
          else if (['TC', '1BAC', '2BAC'].some(k => lvl.includes(k))) itemCycle = 'LYCEE';

          if (itemCycle !== selectedCycle) return false;
        }

        if (searchQuery.trim() === '') return true;
        const query = searchQuery.toLowerCase();
        return (
          `${item.student.first_name} ${item.student.last_name}`.toLowerCase().includes(query) ||
          (item.student.student_code && item.student.student_code.toLowerCase().includes(query)) ||
          (item.student.class?.name && item.student.class.name.toLowerCase().includes(query)) ||
          item.guardianPhone.includes(query)
        );
      });
  }, [students, paymentMap, defaultMonthlyFee, selectedCycle, searchQuery]);

  const totalTargeted = unpaidStudents.length;
  const countWithPhone = unpaidStudents.filter((item) => Boolean(normalizeMoroccanPhone(item.guardianPhone))).length;
  const countSent = unpaidStudents.filter((item) => sentStudentIds[item.student.id]).length;

  const handleSendQuick = (item: (typeof unpaidStudents)[0]) => {
    const normalized = normalizeMoroccanPhone(item.guardianPhone);
    if (!normalized) {
      setEditingPhoneStudent({
        student: item.student,
        phone: item.guardianPhone,
        guardianName: item.student.guardian_name || '',
      });
      return;
    }

    const customTemplate =
      locale === 'ar'
        ? settings.whatsapp_payment_template_ar
        : settings.whatsapp_payment_template_fr;

    const message = buildPaymentReminderMessage({
      studentName: `${item.student.first_name} ${item.student.last_name}`,
      guardianName: item.student.guardian_name || '',
      className: item.student.class?.name || '',
      month: monthName,
      amount: item.dueAmount,
      schoolName: schoolName,
      customTemplate: customTemplate,
      locale: locale as 'fr' | 'ar',
    });

    openWhatsAppChat(normalized, message);
    setSentStudentIds((prev) => ({ ...prev, [item.student.id]: true }));
  };

  const handleOpenPreview = (item: (typeof unpaidStudents)[0]) => {
    const customTemplate =
      locale === 'ar'
        ? settings.whatsapp_payment_template_ar
        : settings.whatsapp_payment_template_fr;

    const message = buildPaymentReminderMessage({
      studentName: `${item.student.first_name} ${item.student.last_name}`,
      guardianName: item.student.guardian_name || '',
      className: item.student.class?.name || '',
      month: monthName,
      amount: item.dueAmount,
      schoolName: schoolName,
      customTemplate: customTemplate,
      locale: locale as 'fr' | 'ar',
    });

    setPreviewModal({
      student: item.student,
      dueAmount: item.dueAmount,
      phone: item.guardianPhone,
      message,
    });
  };

  const handleSavePhone = async () => {
    if (!editingPhoneStudent) return;
    setSavingPhone(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('students')
        .update({
          guardian_phone: editingPhoneStudent.phone.trim(),
          guardian_name: editingPhoneStudent.guardianName.trim() || null,
        })
        .eq('id', editingPhoneStudent.student.id);

      if (error) throw error;

      editingPhoneStudent.student.guardian_phone = editingPhoneStudent.phone.trim();
      editingPhoneStudent.student.guardian_name = editingPhoneStudent.guardianName.trim();

      notify({
        title: 'Téléphone Enregistré',
        message: 'Le numéro de téléphone a été mis à jour avec succès.',
        type: 'success',
      });

      if (onRefreshData) {
        await onRefreshData();
      }

      setEditingPhoneStudent(null);
    } catch (err: any) {
      notify({
        title: 'Erreur',
        message: err.message || 'Impossible d\'enregistrer le numéro.',
        type: 'danger',
      });
    } finally {
      setSavingPhone(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden"
        dir={dir}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/15 backdrop-blur-xs text-white">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  {dir === 'rtl' ? 'مركز تذكير أولياء الأمور بالواجبات الشهرية' : 'Centre de Rappels WhatsApp — Frais de Scolarité'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-white/25 text-[11px] font-extrabold backdrop-blur-xs">
                  {monthName}
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                {dir === 'rtl'
                  ? 'إرسال مباشر بنقرة واحدة لرسائل التذكير المخصصة لأولياء الأمور غير المؤدين للواجب.'
                  : 'Envoi direct 1-clic avec messages pré-remplis pour les frais impayés.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metrics Summary Strip */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 shrink-0">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
            <div className="p-2 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-slate-400 truncate">
                {dir === 'rtl' ? 'إجمالي غير المؤدين' : 'Total Impayés'}
              </div>
              <div className="text-sm font-black text-rose-600 dark:text-rose-400">
                {totalTargeted} {dir === 'rtl' ? 'تلميذ' : 'élève(s)'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-slate-400 truncate">
                {dir === 'rtl' ? 'أرقام هواتف متوفرة' : 'Numéros Disponibles'}
              </div>
              <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {countWithPhone} / {totalTargeted}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
            <div className="p-2 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <CheckCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-slate-400 truncate">
                {dir === 'rtl' ? 'تم الإرسال (هذه الجلسة)' : 'Envoyés en session'}
              </div>
              <div className="text-sm font-black text-blue-600 dark:text-blue-400">
                {countSent} / {totalTargeted}
              </div>
            </div>
          </div>
        </div>

        {/* Search & Cycle Filter */}
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={dir === 'rtl' ? 'بحث بالاسم، القسم، أو رقم الهاتف...' : 'Rechercher élève, classe ou téléphone...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-0.5">
            {[
              { key: 'ALL', label: dir === 'rtl' ? 'جميع الأسلاك' : 'Tous Cycles' },
              { key: 'MATERNELLE', label: 'Maternelle' },
              { key: 'PRIMAIRE', label: 'Primaire' },
              { key: 'COLLEGE', label: 'Collège' },
              { key: 'LYCEE', label: 'Lycée' },
            ].map((cycle) => (
              <button
                key={cycle.key}
                type="button"
                onClick={() => setSelectedCycle(cycle.key)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  selectedCycle === cycle.key
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {cycle.label}
              </button>
            ))}
          </div>
        </div>

        {/* Student List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {unpaidStudents.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="font-bold text-sm text-slate-800 dark:text-white">
                {dir === 'rtl' ? 'رائع! لا يوجد أي واجب غير مؤدى لهذا الشهر.' : 'Excellent ! Aucun impayé trouvé pour ce mois.'}
              </div>
              <p className="text-xs text-slate-400">
                {dir === 'rtl' ? 'جميع التلاميذ قاموا بتسوية واجباتهم بنجاح.' : 'Tous les élèves sont à jour avec leurs règlements.'}
              </p>
            </div>
          ) : (
            unpaidStudents.map((item) => {
              const hasValidPhone = Boolean(normalizeMoroccanPhone(item.guardianPhone));
              const isSent = sentStudentIds[item.student.id];

              return (
                <div
                  key={item.student.id}
                  className={`p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                    isSent ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''
                  }`}
                >
                  {/* Student Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 text-white font-black flex items-center justify-center text-xs shrink-0 shadow-xs">
                      {item.student.first_name?.[0]}
                      {item.student.last_name?.[0]}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {item.student.first_name} {item.student.last_name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {item.student.class?.name || 'Sans Classe'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        <span>{item.student.guardian_name ? `${item.student.guardian_name} :` : 'Tuteur :'}</span>
                        {item.guardianPhone ? (
                          <span className={`font-mono text-xs font-semibold ${hasValidPhone ? 'text-slate-700 dark:text-slate-200' : 'text-rose-500'}`}>
                            {item.guardianPhone}
                          </span>
                        ) : (
                          <span className="text-rose-500 text-[11px] font-semibold italic">
                            (Numéro non renseigné)
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setEditingPhoneStudent({
                              student: item.student,
                              phone: item.guardianPhone,
                              guardianName: item.student.guardian_name || '',
                            })
                          }
                          className="p-1 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Modifier le numéro"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Due Amount & Actions */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Montant Dû</span>
                      <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                        {item.dueAmount.toLocaleString()} MAD
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenPreview(item)}
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer border border-slate-200 dark:border-slate-700"
                        title="Aperçu & Personnalisation"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendQuick(item)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                          isSent
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-600/20 active:scale-95'
                        }`}
                      >
                        {isSent ? (
                          <>
                            <CheckCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>{dir === 'rtl' ? 'أُرسل مجدداً' : 'Renvoyer'}</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>{dir === 'rtl' ? 'تذكير واتساب' : 'Envoyer Rappel'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            {dir === 'rtl'
              ? 'يتم إرسال الرسائل فوراً ومباشرة إلى تطبيق واتساب عند النقر.'
              : 'Les messages s\'ouvrent directement dans WhatsApp avec les détails du règlement.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 font-bold text-slate-800 dark:text-white cursor-pointer"
          >
            {dir === 'rtl' ? 'إغلاق' : 'Fermer'}
          </button>
        </div>
      </div>

      {/* Mini Modal 1: Quick Edit Phone */}
      {editingPhoneStudent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-500" />
                {dir === 'rtl' ? 'تعديل رقم هاتف الولي' : 'Numéro du Tuteur'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingPhoneStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {dir === 'rtl' ? 'اسم الولي' : 'Nom du Tuteur'}
                </label>
                <input
                  type="text"
                  value={editingPhoneStudent.guardianName}
                  onChange={(e) =>
                    setEditingPhoneStudent({ ...editingPhoneStudent, guardianName: e.target.value })
                  }
                  placeholder="Ex: Mohamed Berrada"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {dir === 'rtl' ? 'رقم الهاتف (WhatsApp)' : 'Numéro de Téléphone (WhatsApp)'}
                </label>
                <input
                  type="text"
                  value={editingPhoneStudent.phone}
                  onChange={(e) =>
                    setEditingPhoneStudent({ ...editingPhoneStudent, phone: e.target.value })
                  }
                  placeholder="06XXXXXXXX ou +2126XXXXXXXX"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingPhoneStudent(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                {dir === 'rtl' ? 'إلغاء' : 'Annuler'}
              </button>
              <button
                type="button"
                onClick={handleSavePhone}
                disabled={savingPhone || !editingPhoneStudent.phone.trim()}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                {savingPhone ? 'Enregistrement...' : dir === 'rtl' ? 'حفظ الرقم' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mini Modal 2: Preview & Custom Edit Message before sending */}
      {previewModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <MessageSquare className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {dir === 'rtl' ? 'معاينة رسالة تذكير الواجب الشهري' : 'Aperçu du Rappel de Paiement WhatsApp'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {dir === 'rtl' ? 'المرسل إليه (الهاتف)' : 'Destinataire (Numéro)'}
                </label>
                <input
                  type="text"
                  value={previewModal.phone}
                  onChange={(e) => setPreviewModal({ ...previewModal, phone: e.target.value })}
                  placeholder="06XXXXXXXX"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {dir === 'rtl' ? 'نص الرسالة (قابل للتعديل قبل الإرسال)' : 'Contenu du Message (modifiable)'}
                  </label>
                  {/^\*[^*]+\*[\r\n]+-+\s*[\r\n]*/.test(previewModal.message) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewModal((prev) => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            message: prev.message.replace(/^\*[^*]+\*[\r\n]+-+\s*[\r\n]*/, ''),
                          };
                        });
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 text-[11px] font-bold border border-rose-200 dark:border-rose-900/50 cursor-pointer transition-all"
                    >
                      <span>✕</span>
                      <span>{dir === 'rtl' ? 'حذف اسم وشعار المؤسسة' : 'Retirer En-tête École'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const schoolHeader = `*${schoolName}*\n----------------------------------------\n`;
                        setPreviewModal((prev) => {
                          if (!prev) return null;
                          return { ...prev, message: `${schoolHeader}${prev.message}` };
                        });
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 text-[11px] font-bold border border-emerald-200 dark:border-emerald-900/50 cursor-pointer transition-all"
                    >
                      <span>+</span>
                      <span>{dir === 'rtl' ? 'إضافة اسم وشعار المؤسسة' : 'Ajouter En-tête École'}</span>
                    </button>
                  )}
                </div>
                <textarea
                  rows={8}
                  value={previewModal.message}
                  onChange={(e) => setPreviewModal({ ...previewModal, message: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans leading-relaxed"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                {dir === 'rtl' ? 'إلغاء' : 'Annuler'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const normalized = normalizeMoroccanPhone(previewModal.phone);
                  if (!normalized) {
                    notify({
                      title: 'Numéro Invalide',
                      message: 'Veuillez saisir un numéro de téléphone valide.',
                      type: 'danger',
                    });
                    return;
                  }
                  openWhatsAppChat(normalized, previewModal.message);
                  setSentStudentIds((prev) => ({ ...prev, [previewModal.student.id]: true }));
                  setPreviewModal(null);
                }}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <Send className="w-4 h-4" />
                <span>{dir === 'rtl' ? 'فتح في واتساب' : 'Ouvrir dans WhatsApp'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
