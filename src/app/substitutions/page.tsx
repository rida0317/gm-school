'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { Teacher, TimetableSlot } from '@/types/database';
import { useNotify } from '@/lib/modal-service';
import { useSettings } from '@/lib/settings';
import {
  Repeat,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  Calendar,
  Clock,
  Award,
  Printer,
  RotateCcw,
  FileSpreadsheet,
  Trash2,
  X,
  UserX,
  Layers,
  BookOpen,
  CheckSquare,
  Square,
  Info
} from 'lucide-react';

interface ScoredCandidate {
  teacher: Teacher;
  isSameSubject: boolean;
  isSameLevel: boolean;
  isVacataire: boolean;
  dailyHours: number;
  isConflict: boolean;
  score: number;
  rankLabel: string;
}

function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const normAStart = (startA || '').slice(0, 5);
  const normAEnd = (endA || '').slice(0, 5);
  const normBStart = (startB || '').slice(0, 5);
  const normBEnd = (endB || '').slice(0, 5);
  return normAStart < normBEnd && normAEnd > normBStart;
}

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export default function SubstitutionsPage() {
  const { t, dir } = useI18n();
  const { settings } = useSettings();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [absentTeacherId, setAbsentTeacherId] = useState<string>('');
  const [absenceDate, setAbsenceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{
    slot: TimetableSlot;
    availableCandidates: ScoredCandidate[];
    selectedTeacherId?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const notify = useNotify();

  async function loadData() {
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: tch }, { data: slts }] = await Promise.all([
        supabase.from('teachers').select('*').order('last_name'),
        supabase
          .from('timetable_slots')
          .select('*, class:classes(*), teacher:teachers(*), subject:subjects(*), room:rooms(*)'),
      ]);

      if (tch) {
        setTeachers(tch);
        if (tch.length > 0 && !absentTeacherId) {
          setAbsentTeacherId(tch[0].id);
        }
      }
      if (slts) setSlots(slts);
    } catch (err) {
      console.error('Error loading substitutions data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Compute the day of the week and the scheduled slots of the selected teacher for that date
  const { dayOfWeek, dayName, teacherDaySlots } = useMemo(() => {
    if (!absenceDate) {
      return { dayOfWeek: 1, dayName: 'Lundi', teacherDaySlots: [] };
    }
    const [y, m, d] = absenceDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeekNum = dateObj.getDay() === 0 ? 7 : dateObj.getDay();
    const dayNameStr = DAY_NAMES[dateObj.getDay()];

    const scheduled = slots
      .filter((s) => s.teacher_id === absentTeacherId && s.day_of_week === dayOfWeekNum)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

    return {
      dayOfWeek: dayOfWeekNum,
      dayName: dayNameStr,
      teacherDaySlots: scheduled,
    };
  }, [absenceDate, absentTeacherId, slots]);

  // Auto-select all scheduled slots of the absent teacher when teacher or date changes
  useEffect(() => {
    setSelectedSlotIds(teacherDaySlots.map((s) => s.id));
    setSuggestions([]);
    setProcessed(false);
  }, [teacherDaySlots]);

  const toggleSlotSelection = (slotId: string) => {
    setSelectedSlotIds((prev) =>
      prev.includes(slotId) ? prev.filter((id) => id !== slotId) : [...prev, slotId]
    );
  };

  const selectAllSlots = () => {
    setSelectedSlotIds(teacherDaySlots.map((s) => s.id));
  };

  /**
   * SMART REPLACEMENT ENGINE:
   * 1. Replaces ONLY the specific scheduled sessions/hours of the absent teacher.
   * 2. Evaluates all Titular / Permanent teachers (Vacataires strictly excluded).
   * 3. Ranks titular teachers by same subject, same level, and lowest daily load.
   */
  const handleFindReplacements = async () => {
    if (!absentTeacherId) return;

    const slotsToReplace = teacherDaySlots.filter((s) => selectedSlotIds.includes(s.id));

    if (slotsToReplace.length === 0) {
      notify({
        title: 'Aucune Séance Sélectionnée',
        message: teacherDaySlots.length === 0
          ? `Cet enseignant n'a aucun cours programmé le ${dayName} (${absenceDate}).`
          : 'Veuillez cocher au moins une séance à remplacer dans l\'emploi du temps de l\'enseignant.',
        type: 'warning',
      });
      return;
    }

    setIsSearching(true);

    try {
      const assignedCountInBatch: Record<string, number> = {};

      const result = slotsToReplace.map((slot) => {
        const clsLevel = (slot.class?.level || '').toUpperCase().trim();
        const subjName = (slot.subject?.name || '').toLowerCase().trim();

        const allCandidates: ScoredCandidate[] = [];

        teachers.forEach((t) => {
          if (t.id === absentTeacherId) return;

          // RULE: STRICTLY EXCLUDE VACATAIRES (Vacataires ne font JAMAIS de remplacement)
          const isVacataire = Boolean(
            (t.contract_type || '').toUpperCase().includes('VACAT')
          );
          if (isVacataire) return;

          // Check if teacher has another class at this exact time
          const isConflict = slots.some(
            (s) =>
              s.teacher_id === t.id &&
              s.day_of_week === dayOfWeek &&
              timesOverlap(s.start_time, s.end_time, slot.start_time, slot.end_time)
          );

          // Calculate daily hours on this day
          const currentDailyHours = slots.filter(
            (s) => s.teacher_id === t.id && s.day_of_week === dayOfWeek
          ).length;

          // Subject matching
          const tSpec = (t.specialization || '').toLowerCase().trim();
          const isSameSubject = Boolean(
            subjName && (tSpec === subjName || tSpec.includes(subjName) || subjName.includes(tSpec))
          );

          // Level matching
          const isSameLevel = Boolean(
            Array.isArray(t.teaching_levels) &&
              t.teaching_levels.some((lvl) => lvl.toUpperCase().trim() === clsLevel)
          );

          // Compute score
          let score = 100;
          if (isConflict) {
            score -= 1000;
          } else {
            if (isSameSubject) score += 120;
            if (isSameLevel) score += 50;
            score -= currentDailyHours * 10;
          }

          let rankLabel = '';
          if (isConflict) {
            rankLabel = `⚠️ En cours à cette heure (${currentDailyHours}h)`;
          } else if (isSameSubject && isSameLevel) {
            rankLabel = `⭐ Même Matière & Niveau (${currentDailyHours}h)`;
          } else if (isSameSubject) {
            rankLabel = `⭐ Même Matière (${currentDailyHours}h)`;
          } else if (isSameLevel) {
            rankLabel = `👍 Même Niveau (${currentDailyHours}h)`;
          } else {
            rankLabel = `⏱️ Disponible (${currentDailyHours}h aujourd'hui)`;
          }

          allCandidates.push({
            teacher: t,
            isSameSubject,
            isSameLevel,
            isVacataire: false,
            dailyHours: currentDailyHours,
            isConflict,
            score,
            rankLabel,
          });
        });

        // Sort candidates: Non-conflicted candidates first, highest score first
        allCandidates.sort((a, b) => {
          if (a.isConflict !== b.isConflict) {
            return a.isConflict ? 1 : -1;
          }
          return b.score - a.score;
        });

        // Auto-select the best free candidate (considering batch balance)
        const freeCandidates = allCandidates.filter((c) => !c.isConflict);

        let bestCandidate = freeCandidates.find((c) => (assignedCountInBatch[c.teacher.id] || 0) === 0);
        if (!bestCandidate && freeCandidates.length > 0) {
          bestCandidate = freeCandidates[0];
        }

        if (bestCandidate) {
          assignedCountInBatch[bestCandidate.teacher.id] = (assignedCountInBatch[bestCandidate.teacher.id] || 0) + 1;
        }

        return {
          slot,
          availableCandidates: allCandidates,
          selectedTeacherId: bestCandidate?.teacher.id || undefined,
        };
      });

      setSuggestions(result);
      setProcessed(false);

      notify({
        title: 'Remplaçants Optimaux Affectés !',
        message: `${result.length} séance(s) de cours de l'enseignant analysée(s) &bull; Seuls les enseignants titulaires disponibles sont proposés.`,
        type: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmSubstitutions = async () => {
    try {
      const supabase = createClient();
      const requests = suggestions
        .filter((s) => s.selectedTeacherId)
        .map((s) => ({
          absent_teacher_id: absentTeacherId,
          replacement_teacher_id: s.selectedTeacherId,
          timetable_slot_id: s.slot.id,
          date: absenceDate,
          status: 'ACCEPTED',
          notes: `Remplacement de la séance ${s.slot.start_time}-${s.slot.end_time} pour la classe ${s.slot.class?.name || ''}`,
        }));

      if (requests.length === 0) {
        notify({
          title: 'Aucun Remplaçant Assigné',
          message: 'Veuillez assigner au moins un enseignant titulaire avant de valider.',
          type: 'warning',
        });
        return;
      }

      const { error } = await supabase.from('substitution_requests').insert(requests);
      if (error) {
        notify({ title: 'Erreur', message: error.message, type: 'danger' });
        return;
      }

      setProcessed(true);
      notify({
        title: 'Remplacements Validés avec Succès !',
        message: `${requests.length} séance(s) de remplacement enregistrée(s) dans le système.`,
        type: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const handleClearSubstitutions = async () => {
    setSuggestions([]);
    setProcessed(false);
    setShowClearModal(false);
    notify({
      title: 'Remplacements Réinitialisés',
      message: 'La liste des propositions de remplacement a été vidée.',
      type: 'info',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (suggestions.length === 0) return;

    const absentTeacher = teachers.find((t) => t.id === absentTeacherId);
    const headers = ['Horaire', 'Classe', 'Niveau', 'Matiere', 'Salle', 'Enseignant Absent', 'Enseignant Remplacant Titulaire', 'Statut'];
    const rows = suggestions.map((s) => {
      const rep = teachers.find((t) => t.id === s.selectedTeacherId);
      return [
        `"${s.slot.start_time} - ${s.slot.end_time}"`,
        `"${s.slot.class?.name || ''}"`,
        `"${s.slot.class?.level || ''}"`,
        `"${s.slot.subject?.name || ''}"`,
        `"${s.slot.room?.name || ''}"`,
        `"${absentTeacher ? `${absentTeacher.first_name} ${absentTeacher.last_name}` : ''}"`,
        `"${rep ? `${rep.first_name} ${rep.last_name}` : 'Non assigne'}"`,
        `"${processed ? 'VALIDE' : 'PROPOSE'}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Remplacements_${absenceDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notify({
      title: 'Fichier Exporté !',
      message: `Le fichier Remplacements_${absenceDate}.csv a été téléchargé.`,
      type: 'success',
    });
  };

  const absentTeacher = teachers.find((t) => t.id === absentTeacherId);

  return (
    <DashboardLayout>
      {/* Print Stylesheet for Official Substitution Sheet */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 10mm 12mm !important;
          }
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
          }
          header, aside, nav, .print\\:hidden {
            display: none !important;
          }
          .print-substitution-sheet {
            display: block !important;
            width: 100% !important;
          }
        }
      `}</style>

      <div className="space-y-6">
        {/* Top Header - Hide in print */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              <Repeat className="w-4 h-4" />
              <span>{t('substitutions')}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('substitutions_page_title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {dir === 'rtl' ? 'خوارزمية ذكية لاقتراح الأساتذة المعوضين حسب التخصص، جدول الحصص والأقسام.' : "Remplacement uniquement sur les heures réelles du professeur \u2022 0 Vacataire (Réservé aux Titulaires) \u2022 Priorisation par matière."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowClearModal(true)}
              disabled={suggestions.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{dir === 'rtl' ? 'مسح التعويضات' : 'Vider les Remplacements'}</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={suggestions.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-sky-500" />
              <span>{dir === 'rtl' ? 'تصدير PDF / طباعة' : 'Exporter PDF / Imprimer'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={suggestions.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>{dir === 'rtl' ? 'تصدير CSV' : 'Exporter CSV'}</span>
            </button>
          </div>
        </div>

        {/* Rule Indicators Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-xs">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Heures Réelles Seules</div>
              <div className="text-[10px] text-slate-400">Séances du professeur absent uniquement</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-xs">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">0 Vacataire (Exclus)</div>
              <div className="text-[10px] text-slate-400">Remplacement réservé aux titulaires</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-xs">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">1. Même Matière</div>
              <div className="text-[10px] text-slate-400">Priorité à la même discipline</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-xs">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">2. Même Niveau</div>
              <div className="text-[10px] text-slate-400">Conformité pédagogique cycle</div>
            </div>
          </div>
        </div>

        {/* Absence Declaration Card */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 print:hidden">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Déclarer une Absence &bull; Sélection des Heures Travaillées
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Enseignant Absent
              </label>
              <select
                value={absentTeacherId}
                onChange={(e) => setAbsentTeacherId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.first_name} {t.last_name} ({t.specialization || 'Prof'} &bull; {t.contract_type || 'Titulaire'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date de l&apos;Absence
              </label>
              <input
                type="date"
                value={absenceDate}
                onChange={(e) => setAbsenceDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <button
                onClick={handleFindReplacements}
                disabled={loading || isSearching || teacherDaySlots.length === 0}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? (
                  <>Recherche en cours...</>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    Trouver les Remplaçants ({selectedSlotIds.length} séance(s))
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Live Scheduled Hours Box for this Teacher & Day */}
          <div className="pt-2">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Emploi du temps de {absentTeacher?.first_name} {absentTeacher?.last_name} le {dayName} ({absenceDate}) :
                  </span>
                </div>

                {teacherDaySlots.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAllSlots}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Tout sélectionner ({teacherDaySlots.length} séance{teacherDaySlots.length > 1 ? 's' : ''})
                  </button>
                )}
              </div>

              {teacherDaySlots.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>
                    Cet enseignant n&apos;a aucun cours programmé dans l&apos;emploi du temps le <strong>{dayName}</strong>. Aucun remplacement n&apos;est nécessaire pour ce jour.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {teacherDaySlots.map((slot) => {
                    const isSelected = selectedSlotIds.includes(slot.id);
                    return (
                      <div
                        key={slot.id}
                        onClick={() => toggleSlotSelection(slot.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-black text-indigo-700 dark:text-indigo-300">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{slot.start_time} &mdash; {slot.end_time}</span>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            {slot.class?.name} ({slot.class?.level}) &bull; {slot.subject?.name}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            Salle : {slot.room?.name || slot.room?.room_number || 'N/A'}
                          </div>
                        </div>

                        <div>
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Printable Official Substitution Sheet */}
        {suggestions.length > 0 && (
          <div className="hidden print:block print-substitution-sheet">
            <div className="border-b-2 border-slate-900 pb-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <img
                    src="/logo.png"
                    alt="Logo GM"
                    className="w-14 h-14 object-contain shrink-0"
                  />
                  <div>
                    <h1 className="text-base font-black uppercase text-slate-900 leading-tight">
                      {settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES'}
                    </h1>
                    <p className="text-[10pt] font-bold text-slate-700 mt-0.5">
                      FICHE OFFICIELLE D&apos;AFFECTATION DES REMPLACEMENTS
                    </p>
                    <p className="text-[8pt] text-slate-600">
                      Année Scolaire : {settings.academic_year || '2025-2026'} &bull; Ordre de Mission Pédagogique (Enseignants Titulaires)
                    </p>
                  </div>
                </div>

                <div className="text-right border border-slate-400 p-2 rounded">
                  <div className="text-[9pt] font-black">Date d&apos;Absence : {absenceDate} ({dayName})</div>
                  <div className="text-[8pt] text-slate-700 font-bold">
                    Enseignant Absent : {absentTeacher?.first_name} {absentTeacher?.last_name?.toUpperCase()}
                  </div>
                  <div className="text-[7.5pt] text-slate-500">Matière : {absentTeacher?.specialization}</div>
                </div>
              </div>
            </div>

            <table className="w-full text-left border-collapse text-[8.5pt] mb-6">
              <thead>
                <tr className="bg-slate-100 border border-slate-400 font-bold">
                  <th className="p-2 border border-slate-400">Horaire Séance</th>
                  <th className="p-2 border border-slate-400">Classe</th>
                  <th className="p-2 border border-slate-400">Matière</th>
                  <th className="p-2 border border-slate-400">Salle</th>
                  <th className="p-2 border border-slate-400">Enseignant Remplaçant Titulaire</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((item, idx) => {
                  const rep = teachers.find((t) => t.id === item.selectedTeacherId);
                  return (
                    <tr key={idx} className="border border-slate-400">
                      <td className="p-2 border border-slate-400 font-mono font-bold">
                        {item.slot.start_time} &mdash; {item.slot.end_time}
                      </td>
                      <td className="p-2 border border-slate-400 font-bold">{item.slot.class?.name}</td>
                      <td className="p-2 border border-slate-400">{item.slot.subject?.name}</td>
                      <td className="p-2 border border-slate-400 font-bold">
                        {item.slot.room?.name || item.slot.room?.room_number}
                      </td>
                      <td className="p-2 border border-slate-400 font-black">
                        {rep ? `${rep.first_name} ${rep.last_name?.toUpperCase()} (${rep.specialization || 'Titulaire'})` : 'Non assigné'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex justify-between items-center text-[8pt] pt-8 border-t border-slate-300 mt-8">
              <div>
                <p className="font-bold">Visa &amp; Cachet de la Direction</p>
                <div className="h-16"></div>
              </div>
              <div className="text-right">
                <p className="font-bold">Signature du Directeur Pédagogique</p>
                <div className="h-16"></div>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Suggestions List */}
        {suggestions.length > 0 && (
          <div className="space-y-4 animate-in fade-in duration-300 print:hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-500" />
                Séances Affectées &amp; Remplaçants Titulaires ({suggestions.length} séance{suggestions.length > 1 ? 's' : ''})
              </h3>

              {!processed && (
                <button
                  onClick={handleConfirmSubstitutions}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-500/30 transition-all flex items-center gap-2 cursor-pointer hover:scale-105"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Valider Tous les Remplacements
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {suggestions.map((item, idx) => {
                const availableCount = item.availableCandidates.filter((c) => !c.isConflict).length;

                return (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-sky-500" />
                        <span>Séance : {item.slot.start_time} &mdash; {item.slot.end_time}</span>
                        <span>&bull;</span>
                        <span>Salle : {item.slot.room?.name || item.slot.room?.room_number || 'N/A'}</span>
                        <span>&bull;</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {availableCount} titulaire(s) libre(s)
                        </span>
                      </div>

                      <div className="text-sm font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                        <span>Classe :</span>
                        <span className="px-2 py-0.5 rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 font-extrabold text-xs">
                          {item.slot.class?.name} ({item.slot.class?.level})
                        </span>
                        <span>&bull;</span>
                        <span
                          className="px-2 py-0.5 rounded-lg text-white font-bold text-xs"
                          style={{ backgroundColor: item.slot.subject?.color_code || '#0284c7' }}
                        >
                          {item.slot.subject?.name}
                        </span>
                      </div>

                      <div className="text-xs text-rose-500 font-semibold flex items-center gap-1.5">
                        <UserX className="w-3.5 h-3.5" />
                        <span>Professeur Absent : {item.slot.teacher?.first_name} {item.slot.teacher?.last_name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-full lg:w-80">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Remplaçant Titulaire :
                        </label>

                        <select
                          value={item.selectedTeacherId || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSuggestions((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, selectedTeacherId: val } : s))
                            );
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/40 text-xs font-bold text-emerald-900 dark:text-emerald-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">-- Aucun remplaçant sélectionné --</option>

                          {/* Optgroup for free titular candidates */}
                          <optgroup label="✅ Titulaires Disponibles (Classés par pertinence)">
                            {item.availableCandidates
                              .filter((c) => !c.isConflict)
                              .map((cand) => (
                                <option key={cand.teacher.id} value={cand.teacher.id}>
                                  {cand.teacher.first_name} {cand.teacher.last_name} ({cand.teacher.specialization || 'Titulaire'}) &bull; {cand.rankLabel}
                                </option>
                              ))}
                          </optgroup>

                          {/* Optgroup for candidates currently in class */}
                          {item.availableCandidates.some((c) => c.isConflict) && (
                            <optgroup label="⚠️ Titulaires Déjà en Cours à Cette Heure">
                              {item.availableCandidates
                                .filter((c) => c.isConflict)
                                .map((cand) => (
                                  <option key={cand.teacher.id} value={cand.teacher.id} className="text-slate-400">
                                    {cand.teacher.first_name} {cand.teacher.last_name} ({cand.teacher.specialization || 'Titulaire'}) &bull; {cand.rankLabel}
                                  </option>
                                ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Clear Confirmation Modal */}
        {showClearModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in print:hidden">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-rose-200 dark:border-rose-500/30 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <div className="p-2 rounded-xl bg-rose-500/15">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Vider les Remplacements
                  </h3>
                </div>
                <button
                  onClick={() => setShowClearModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
                Êtes-vous sûr de vouloir réinitialiser et vider la liste actuelle des propositions de remplacement ?
              </p>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setShowClearModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  onClick={handleClearSubstitutions}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-lg shadow-rose-600/25 transition-all cursor-pointer"
                >
                  Confirmer et Vider
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
