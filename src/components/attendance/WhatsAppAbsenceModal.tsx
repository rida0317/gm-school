'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Phone,
  User,
  Edit3,
  Search,
  CheckCheck,
  Smartphone,
  ExternalLink,
  GraduationCap,
  Sparkles,
  Info
} from 'lucide-react';
import { Student, AttendanceStatus, StudentAttendance } from '@/types/database';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import {
  buildAbsenceMessage,
  normalizeMoroccanPhone,
  openWhatsAppChat,
  formatWhatsAppDate
} from '@/lib/whatsapp';
import { createClient } from '@/lib/supabase/client';
import { useNotify } from '@/lib/modal-service';

interface WhatsAppAbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  students: Student[];
  attendanceRecords: StudentAttendance[];
  onStudentUpdated?: (updatedStudent: Student) => void;
}

export function WhatsAppAbsenceModal({
  isOpen,
  onClose,
  selectedDate,
  students,
  attendanceRecords,
  onStudentUpdated,
}: WhatsAppAbsenceModalProps) {
  const { t, dir, locale } = useI18n();
  const { settings } = useSettings();
  const notify = useNotify();

  const schoolName =
    locale === 'ar'
      ? settings.school_name_ar || 'مجموعة مدارس الأجيال الصاعدة'
      : settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ABSENT' | 'LATE' | 'NOT_SENT'>('ALL');
  
  // Track sent status during current session
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
    record: StudentAttendance;
    phone: string;
    message: string;
  } | null>(null);

  // Map today's records
  const dailyRecordMap = useMemo(() => {
    const map: Record<string, StudentAttendance> = {};
    attendanceRecords
      .filter((r) => r.date === selectedDate)
      .forEach((r) => {
        map[r.student_id] = r;
      });
    return map;
  }, [attendanceRecords, selectedDate]);

  // List of students with absence or late for the selected date
  const targetedStudents = useMemo(() => {
    return students
      .map((stud) => {
        const rec = dailyRecordMap[stud.id];
        return {
          student: stud,
          record: rec,
          status: (rec?.status as AttendanceStatus) || 'PRESENT',
          lateMinutes: rec?.late_minutes || 0,
          isJustified: rec?.is_justified || false,
        };
      })
      .filter((item) => item.status === 'ABSENT' || item.status === 'EXCUSED' || item.status === 'LATE');
  }, [students, dailyRecordMap]);

  // Filtered list based on search and status
  const filteredList = useMemo(() => {
    return targetedStudents.filter(({ student, status }) => {
      // Status filter
      if (statusFilter === 'ABSENT' && status !== 'ABSENT' && status !== 'EXCUSED') return false;
      if (statusFilter === 'LATE' && status !== 'LATE') return false;
      if (statusFilter === 'NOT_SENT' && sentStudentIds[student.id]) return false;

      // Search
      if (searchQuery.trim() === '') return true;
      const q = searchQuery.toLowerCase();
      const sName = `${student.first_name} ${student.last_name} ${student.student_code} ${student.class?.name || ''} ${student.guardian_name || ''} ${student.guardian_phone || ''}`.toLowerCase();
      return sName.includes(q);
    });
  }, [targetedStudents, statusFilter, sentStudentIds, searchQuery]);

  // Count metrics
  const totalTargeted = targetedStudents.length;
  const countWithPhone = targetedStudents.filter((s) => Boolean(normalizeMoroccanPhone(s.student.guardian_phone || s.student.phone))).length;
  const countSent = Object.values(sentStudentIds).filter(Boolean).length;

  // Handler: generate message for student
  const generateMessageForStudent = (student: Student, record?: StudentAttendance) => {
    const isLate = record?.status === 'LATE';
    const lateMinutes = record?.late_minutes || 15;
    const template = isLate
      ? locale === 'ar'
        ? settings?.whatsapp_late_template_ar
        : settings?.whatsapp_late_template_fr
      : locale === 'ar'
      ? settings?.whatsapp_absence_template_ar
      : settings?.whatsapp_absence_template_fr;

    const schoolName = locale === 'ar' ? settings?.school_name_ar || settings?.school_name : settings?.school_name;

    return buildAbsenceMessage({
      studentName: `${student.first_name} ${student.last_name}`,
      guardianName: student.guardian_name || '',
      className: student.class?.name || 'Classe',
      date: selectedDate,
      schoolName: schoolName || 'GM School',
      isLate,
      lateMinutes,
      customTemplate: template,
      locale: locale as 'fr' | 'ar',
    });
  };

  // Handler: Quick Send 1-Click
  const handleQuickSend = (student: Student, record?: StudentAttendance) => {
    const rawPhone = student.guardian_phone || student.phone;
    const normalized = normalizeMoroccanPhone(rawPhone);

    if (!normalized) {
      // Open phone edit modal
      setEditingPhoneStudent({
        student,
        phone: rawPhone || '',
        guardianName: student.guardian_name || '',
      });
      return;
    }

    const message = generateMessageForStudent(student, record);
    const success = openWhatsAppChat(normalized, message);

    if (success) {
      setSentStudentIds((prev) => ({ ...prev, [student.id]: true }));
      notify({
        title: dir === 'rtl' ? 'تم فتح محادثة واتساب' : 'WhatsApp Ouvert',
        message: dir === 'rtl'
          ? `تم تجهيز رسالة غياب التلميذ ${student.first_name} ${student.last_name} بنجاح.`
          : `Message WhatsApp préparé pour ${student.first_name} ${student.last_name}.`,
        type: 'success',
      });
    }
  };

  // Handler: Open Preview Modal
  const handleOpenPreview = (student: Student, record: StudentAttendance) => {
    const rawPhone = student.guardian_phone || student.phone || '';
    const msg = generateMessageForStudent(student, record);
    setPreviewModal({
      student,
      record,
      phone: rawPhone,
      message: msg,
    });
  };

  // Handler: Save phone to Supabase
  const handleSavePhone = async () => {
    if (!editingPhoneStudent) return;
    setSavingPhone(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('students')
        .update({
          guardian_phone: editingPhoneStudent.phone.trim(),
          guardian_name: editingPhoneStudent.guardianName.trim() || undefined,
        })
        .eq('id', editingPhoneStudent.student.id);

      if (error) throw error;

      const updated = {
        ...editingPhoneStudent.student,
        guardian_phone: editingPhoneStudent.phone.trim(),
        guardian_name: editingPhoneStudent.guardianName.trim(),
      };

      if (onStudentUpdated) {
        onStudentUpdated(updated);
      }

      notify({
        title: dir === 'rtl' ? 'تم حفظ رقم الهاتف' : 'Numéro Enregistré',
        message: dir === 'rtl' ? 'تم تحديث رقم هاتف ولي الأمر بنجاح.' : 'Numéro du tuteur mis à jour avec succès.',
        type: 'success',
      });

      setEditingPhoneStudent(null);
    } catch (err: any) {
      console.error('Error updating guardian phone:', err);
      notify({
        title: 'Erreur',
        message: err.message || 'Impossible d\'enregistrer le numéro',
        type: 'danger',
      });
    } finally {
      setSavingPhone(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md text-white shadow-inner">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  {dir === 'rtl' ? 'مركز إرسال إشعارات الغياب عبر واتساب' : 'Centre d\'Envoi WhatsApp — Absences & Retards'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-white/25 text-[11px] font-extrabold backdrop-blur-xs">
                  {formatWhatsAppDate(selectedDate, locale as 'fr' | 'ar')}
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                {dir === 'rtl'
                  ? 'إرسال مباشر بنقرة واحدة لرسائل مخصصة لولياء أمور التلاميذ الغائبين والمتأخرين.'
                  : 'Envoi direct 1-clic avec messages pré-remplis aux parents d\'élèves.'}
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
                {dir === 'rtl' ? 'إجمالي الغائبين / المتأخرين' : 'Total Absents / Retards'}
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-white">
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
                {dir === 'rtl' ? 'هواتف متوفرة' : 'Numéros Disponibles'}
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

        {/* Toolbar: Search + Filter Tabs */}
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
              { key: 'ALL', label: dir === 'rtl' ? `الكل (${totalTargeted})` : `Tous (${totalTargeted})` },
              { key: 'ABSENT', label: dir === 'rtl' ? 'الغياب فقط' : 'Absents' },
              { key: 'LATE', label: dir === 'rtl' ? 'التأخر فقط' : 'Retards' },
              { key: 'NOT_SENT', label: dir === 'rtl' ? 'غير مرسل بعد' : 'Non envoyés' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key as any)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* List of Targeted Students */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 divide-y divide-slate-100 dark:divide-slate-800">
          {filteredList.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="font-bold text-sm">
                {dir === 'rtl' ? 'لا يوجد أي تلميذ يطابق هذا الاختيار.' : 'Aucun élève trouvé pour cette sélection.'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {dir === 'rtl' ? 'تأكد من تسجيل الحضور أو تغيير فلاتر البحث.' : 'Vérifiez le pointage ou modifiez vos filtres.'}
              </p>
            </div>
          ) : (
            filteredList.map(({ student, record, status, lateMinutes, isJustified }) => {
              const isLate = status === 'LATE';
              const rawPhone = student.guardian_phone || student.phone;
              const normalized = normalizeMoroccanPhone(rawPhone);
              const isSent = Boolean(sentStudentIds[student.id]);

              return (
                <div
                  key={student.id}
                  className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 rounded-2xl transition-colors"
                >
                  {/* Student Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-sm shrink-0">
                      {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {student.first_name} {student.last_name}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          #{student.student_code}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                          {student.class?.name || 'Classe'}
                        </span>

                        {isLate ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                            🟡 Retard ({lateMinutes} min)
                          </span>
                        ) : isJustified || status === 'EXCUSED' ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                            🟢 Absence Justifiée
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold text-[10px]">
                            🔴 Absent Non Justifié
                          </span>
                        )}

                        {/* Guardian Phone Info */}
                        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {normalized ? (
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                              +{normalized}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setEditingPhoneStudent({
                                  student,
                                  phone: rawPhone || '',
                                  guardianName: student.guardian_name || '',
                                })
                              }
                              className="text-amber-600 dark:text-amber-400 font-bold underline cursor-pointer hover:text-amber-700"
                            >
                              {dir === 'rtl' ? 'إضافة رقم الولي' : '+ Ajouter Tél Parent'}
                            </button>
                          )}
                          {student.guardian_name && (
                            <span className="text-slate-400">({student.guardian_name})</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions & WhatsApp Button */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* Status indicator */}
                    {isSent ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{dir === 'rtl' ? 'تم الإرسال' : 'Envoyé'}</span>
                      </span>
                    ) : null}

                    {/* Preview / Edit Custom Message Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenPreview(student, record || dailyRecordMap[student.id])}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      title={dir === 'rtl' ? 'معاينة وتعديل نص الرسالة' : 'Aperçu et personnalisation'}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Quick Send Button */}
                    <button
                      type="button"
                      onClick={() => handleQuickSend(student, record)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer transform active:scale-95 ${
                        normalized
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-600/20'
                          : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-600/20'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {normalized
                          ? dir === 'rtl'
                            ? 'إرسال واتساب'
                            : 'Envoyer WhatsApp'
                          : dir === 'rtl'
                          ? 'تحديد الرقم'
                          : 'Définir Tél'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Info className="w-4 h-4 text-emerald-500" />
            <span>
              {dir === 'rtl'
                ? 'النقر على إرسال يفتح المحادثة فوراً في WhatsApp Web أو التطبيق والرسالة جاهزة للإرسال.'
                : 'Le clic ouvre directement WhatsApp Web ou l\'application avec le message pré-rempli.'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold transition-colors cursor-pointer"
          >
            {dir === 'rtl' ? 'إغلاق' : 'Fermer'}
          </button>
        </div>
      </div>

      {/* Mini Modal 1: Edit Parent Phone Number */}
      {editingPhoneStudent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Smartphone className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {dir === 'rtl' ? 'رقم هاتف ولي الأمر' : 'Numéro WhatsApp du Tuteur'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPhoneStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs space-y-1">
              <div className="font-bold text-slate-900 dark:text-white">
                {editingPhoneStudent.student.first_name} {editingPhoneStudent.student.last_name}
              </div>
              <div className="text-slate-400">
                Classe : {editingPhoneStudent.student.class?.name || '-'} &bull; #{editingPhoneStudent.student.student_code}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {dir === 'rtl' ? 'اسم ولي الأمر / الوالد' : 'Nom du Tuteur / Parent'}
                </label>
                <input
                  type="text"
                  value={editingPhoneStudent.guardianName}
                  onChange={(e) =>
                    setEditingPhoneStudent({
                      ...editingPhoneStudent,
                      guardianName: e.target.value,
                    })
                  }
                  placeholder="Ex: Mohamed Alami"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {dir === 'rtl' ? 'رقم الهاتف (واتساب)' : 'Numéro de Téléphone (WhatsApp)'}
                </label>
                <input
                  type="tel"
                  value={editingPhoneStudent.phone}
                  onChange={(e) =>
                    setEditingPhoneStudent({
                      ...editingPhoneStudent,
                      phone: e.target.value,
                    })
                  }
                  placeholder="0612345678 ou +212612345678"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {dir === 'rtl'
                    ? 'يقبل التنسيقات المغربية المعتادة (06XXXXXX, 07XXXXXX, +2126...).'
                    : 'Formats marocains acceptés (06XXXXXX, 07XXXXXX, +2126...).'}
                </p>
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
                  {dir === 'rtl' ? 'معاينة رسالة واتساب' : 'Aperçu du Message WhatsApp'}
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
                    {dir === 'rtl' ? 'نص الرسالة (يمكنك تعديله قبل الإرسال)' : 'Contenu du Message (modifiable)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const schoolHeader = `*${schoolName}*\n----------------------------------------\n`;
                      setPreviewModal((prev) => {
                        if (!prev) return null;
                        if (prev.message.startsWith(`*${schoolName}*`)) return prev;
                        return { ...prev, message: `${schoolHeader}${prev.message}` };
                      });
                    }}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
                  >
                    + {dir === 'rtl' ? 'إضافة اسم وشعار المؤسسة' : 'Ajouter En-tête École'}
                  </button>
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
                <span>{dir === 'rtl' ? 'فتح في واتساب الآن' : 'Ouvrir dans WhatsApp'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
