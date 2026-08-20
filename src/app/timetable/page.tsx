'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { ClassEntity, Teacher, Room, Subject, TimetableSlot } from '@/types/database';
import { useNotify } from '@/lib/modal-service';
import { useSettings } from '@/lib/settings';
import {
  CalendarDays,
  Sparkles,
  Plus,
  Trash2,
  Building2,
  Clock,
  Printer,
  X,
  AlertTriangle,
  RotateCcw,
  User,
  GraduationCap,
  Download,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ChevronDown,
  GripVertical,
  Move,
  AlertCircle,
  Zap,
  HelpCircle
} from 'lucide-react';

interface SchoolDay {
  id: number;
  name: string;
  short: string;
  isHalfDay?: boolean;
}

const MOROCCAN_SCHOOL_DAYS: SchoolDay[] = [
  { id: 1, name: 'Lundi', short: 'Lun' },
  { id: 2, name: 'Mardi', short: 'Mar' },
  { id: 3, name: 'Mercredi', short: 'Mer' },
  { id: 4, name: 'Jeudi', short: 'Jeu' },
  { id: 5, name: 'Vendredi', short: 'Ven', isHalfDay: true },
];

interface PeriodSlot {
  id: string;
  start: string;
  end: string;
  label: string;
  sessionName: string;
  periodNumber: number;
  tag: string;
  isAfternoon?: boolean;
  notOnFriday?: boolean;
}

const MOROCCAN_55MIN_PERIODS: PeriodSlot[] = [
  {
    id: 'P1',
    start: '08:30',
    end: '09:25',
    label: '08h30 — 09h25',
    sessionName: 'Séance 1 (55 min)',
    periodNumber: 1,
    tag: 'Matinée',
  },
  {
    id: 'P2',
    start: '09:25',
    end: '10:20',
    label: '09h25 — 10h20',
    sessionName: 'Séance 2 (55 min)',
    periodNumber: 2,
    tag: 'Matinée',
  },
  {
    id: 'P3',
    start: '10:30',
    end: '11:25',
    label: '10h30 — 11h25',
    sessionName: 'Séance 3 (55 min)',
    periodNumber: 3,
    tag: 'Matinée',
  },
  {
    id: 'P4',
    start: '11:25',
    end: '12:20',
    label: '11h25 — 12h20',
    sessionName: 'Séance 4 (55 min)',
    periodNumber: 4,
    tag: 'Matinée',
  },
  {
    id: 'P5',
    start: '13:00',
    end: '13:55',
    label: '13h00 — 13h55',
    sessionName: 'Séance 5 (55 min)',
    periodNumber: 5,
    tag: 'Après-midi',
    isAfternoon: true,
    notOnFriday: true,
  },
  {
    id: 'P6',
    start: '14:00',
    end: '14:55',
    label: '14h00 — 14h55',
    sessionName: 'Séance 6 (55 min)',
    periodNumber: 6,
    tag: 'Après-midi',
    isAfternoon: true,
    notOnFriday: true,
  },
  {
    id: 'P7',
    start: '15:05',
    end: '16:00',
    label: '15h05 — 16h00',
    sessionName: 'Séance 7 (55 min)',
    periodNumber: 7,
    tag: 'Après-midi',
    isAfternoon: true,
    notOnFriday: true,
  },
];

export default function TimetablePage() {
  const { t, dir } = useI18n();
  const { settings } = useSettings();
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  
  // View mode: 'CLASS' vs 'TEACHER'
  const [viewMode, setViewMode] = useState<'CLASS' | 'TEACHER'>('CLASS');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Drag and Drop States
  const [draggedSlot, setDraggedSlot] = useState<TimetableSlot | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ day: number; start: string } | null>(null);

  // Vacataire Non-Availability Warning Modal State
  const [vacataireWarning, setVacataireWarning] = useState<{
    show: boolean;
    teacherName: string;
    dayName: string;
    timeLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // PDF Export Mode: 'CURRENT' | 'ALL_CLASSES' | 'ALL_TEACHERS'
  const [printMode, setPrintMode] = useState<'CURRENT' | 'ALL_CLASSES' | 'ALL_TEACHERS'>('CURRENT');
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // Add Slot Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSlot, setNewSlot] = useState({
    day_of_week: 1,
    start_time: '08:30',
    end_time: '09:25',
    subject_id: '',
    teacher_id: '',
    room_id: '',
  });

  // Secure Clear Timetable Modal
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearScope, setClearScope] = useState<'CURRENT_CLASS' | 'ALL_CLASSES'>('CURRENT_CLASS');
  const [confirmKeyword, setConfirmKeyword] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  const notify = useNotify();

  async function loadData() {
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: cls }, { data: tch }, { data: rm }, { data: sbj }, { data: slt }] =
        await Promise.all([
          supabase.from('classes').select('*').order('name'),
          supabase.from('teachers').select('*').order('last_name'),
          supabase.from('rooms').select('*').order('room_number'),
          supabase.from('subjects').select('*').order('name'),
          supabase
            .from('timetable_slots')
            .select('*, teacher:teachers(*), room:rooms(*), subject:subjects(*), class:classes(*)'),
        ]);

      if (cls && cls.length > 0) {
        setClasses(cls);
        if (!selectedClassId) setSelectedClassId(cls[0].id);
      }
      if (tch && tch.length > 0) {
        setTeachers(tch);
        if (!selectedTeacherId) setSelectedTeacherId(tch[0].id);
      }
      if (rm) setRooms(rm);
      if (sbj) setSubjects(sbj);
      if (slt) setSlots(slt);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Helper to check if a vacataire is present on a given slot
  const isVacataireAvailable = (
    teacher: Teacher | undefined,
    dayId: number,
    periodId: string,
    periodStart: string
  ): boolean => {
    if (!teacher || teacher.contract_type !== 'VACATAIRE') return true;
    if (!Array.isArray(teacher.availability) || teacher.availability.length === 0) return false;
    return teacher.availability.some(
      (slot) =>
        Number(slot.day_of_week) === dayId &&
        (slot.period_id === periodId || slot.start_time?.slice(0, 5) === periodStart.slice(0, 5))
    );
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, slot: TimetableSlot) => {
    setDraggedSlot(slot);
    e.dataTransfer.setData('text/plain', slot.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, dayId: number, start: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragOverCell || dragOverCell.day !== dayId || dragOverCell.start !== start) {
      setDragOverCell({ day: dayId, start });
    }
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  // Execute database move / swap
  const executeMoveOrSwap = async (
    currentDragged: TimetableSlot,
    targetDayId: number,
    targetPeriod: PeriodSlot,
    targetSlot: TimetableSlot | undefined
  ) => {
    try {
      const supabase = createClient();

      if (targetSlot) {
        // SWAP: Exchange draggedSlot and targetSlot
        const origDay = currentDragged.day_of_week;
        const origStart = currentDragged.start_time;
        const origEnd = currentDragged.end_time;

        await Promise.all([
          supabase
            .from('timetable_slots')
            .update({
              day_of_week: targetDayId,
              start_time: targetPeriod.start,
              end_time: targetPeriod.end,
            })
            .eq('id', currentDragged.id),
          supabase
            .from('timetable_slots')
            .update({
              day_of_week: origDay,
              start_time: origStart,
              end_time: origEnd,
            })
            .eq('id', targetSlot.id),
        ]);

        notify({
          title: 'Séances Échangées (Swap) !',
          message: `${currentDragged.subject?.name} ⇄ ${targetSlot.subject?.name} permutées avec succès.`,
          type: 'success',
        });
      } else {
        // MOVE: Move draggedSlot to empty slot
        const { error } = await supabase
          .from('timetable_slots')
          .update({
            day_of_week: targetDayId,
            start_time: targetPeriod.start,
            end_time: targetPeriod.end,
          })
          .eq('id', currentDragged.id);

        if (error) throw error;

        notify({
          title: 'Séance Déplacée !',
          message: `${currentDragged.subject?.name} déplacé au ${MOROCCAN_SCHOOL_DAYS.find((d) => d.id === targetDayId)?.name} à ${targetPeriod.start}.`,
          type: 'success',
        });
      }

      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du déplacement';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    } finally {
      setDraggedSlot(null);
      setVacataireWarning(null);
    }
  };

  const handleDropOnCell = async (
    e: React.DragEvent,
    targetDayId: number,
    targetPeriod: PeriodSlot,
    targetSlot: TimetableSlot | undefined
  ) => {
    e.preventDefault();
    setDragOverCell(null);

    if (!draggedSlot) return;

    // Friday afternoon check
    if (targetDayId === 5 && targetPeriod.isAfternoon) {
      notify({
        title: 'Horaire Non Autorisé',
        message: 'Le Vendredi après-midi (13h00 — 16h00) est réservé à la Prière du Vendredi.',
        type: 'warning',
      });
      setDraggedSlot(null);
      return;
    }

    // Dropping on the exact same position
    if (
      draggedSlot.day_of_week === targetDayId &&
      draggedSlot.start_time.slice(0, 5) === targetPeriod.start
    ) {
      setDraggedSlot(null);
      return;
    }

    // Resolve the actual target slot of the CLASS at this time (vital for Teacher view & Class view)
    const classTargetSlot = slots.find(
      (s) =>
        s.class_id === draggedSlot.class_id &&
        s.day_of_week === targetDayId &&
        s.start_time.slice(0, 5) === targetPeriod.start
    );

    const resolvedTargetSlot = targetSlot || classTargetSlot;

    // Check teacher conflict on the swapped session:
    if (resolvedTargetSlot && resolvedTargetSlot.id !== draggedSlot.id) {
      const swappedTeacherConflict = slots.find(
        (s) =>
          s.id !== draggedSlot.id &&
          s.id !== resolvedTargetSlot.id &&
          s.teacher_id === resolvedTargetSlot.teacher_id &&
          s.day_of_week === draggedSlot.day_of_week &&
          s.start_time.slice(0, 5) === draggedSlot.start_time.slice(0, 5)
      );

      if (swappedTeacherConflict) {
        notify({
          title: 'Conflit Détecté lors de l\'Échange !',
          message: `L'enseignant ${resolvedTargetSlot.teacher?.first_name} ${resolvedTargetSlot.teacher?.last_name} enseigne déjà dans la classe ${swappedTeacherConflict.class?.name} sur le créneau d'origine.`,
          type: 'warning',
        });
        setDraggedSlot(null);
        return;
      }
    }

    // 1. Check if the dragged teacher is a Vacataire and is NOT available during this target slot
    const draggedTeacher = teachers.find((t) => t.id === draggedSlot.teacher_id) || draggedSlot.teacher;
    const isDraggedAvailable = isVacataireAvailable(draggedTeacher, targetDayId, targetPeriod.id, targetPeriod.start);

    // 2. Check if swapping a vacataire into draggedSlot's original time
    const targetTeacher = resolvedTargetSlot ? (teachers.find((t) => t.id === resolvedTargetSlot.teacher_id) || resolvedTargetSlot.teacher) : undefined;
    const origPeriod = MOROCCAN_55MIN_PERIODS.find((p) => p.start === draggedSlot.start_time.slice(0, 5)) || MOROCCAN_55MIN_PERIODS[0];
    const isTargetAvailable = resolvedTargetSlot ? isVacataireAvailable(targetTeacher, draggedSlot.day_of_week, origPeriod.id, origPeriod.start) : true;

    if (!isDraggedAvailable || !isTargetAvailable) {
      // Show Vacataire Non-Availability Warning Modal!
      const unavailTeacher = !isDraggedAvailable ? draggedTeacher : targetTeacher;
      const targetDayName = MOROCCAN_SCHOOL_DAYS.find((d) => d.id === (!isDraggedAvailable ? targetDayId : draggedSlot.day_of_week))?.name || 'Jour';
      const targetTimeStr = !isDraggedAvailable ? targetPeriod.label : origPeriod.label;

      const currentDraggedCopy = draggedSlot;
      setVacataireWarning({
        show: true,
        teacherName: unavailTeacher ? `${unavailTeacher.first_name} ${unavailTeacher.last_name}` : 'Enseignant Vacataire',
        dayName: targetDayName,
        timeLabel: targetTimeStr,
        onConfirm: async () => {
          await executeMoveOrSwap(currentDraggedCopy, targetDayId, targetPeriod, resolvedTargetSlot);
        },
      });
      return;
    }

    // If fully available, execute move/swap directly
    await executeMoveOrSwap(draggedSlot, targetDayId, targetPeriod, resolvedTargetSlot);
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();

    if (Number(newSlot.day_of_week) === 5 && (newSlot.start_time.startsWith('13:') || newSlot.start_time.startsWith('14:') || newSlot.start_time.startsWith('15:'))) {
      notify({
        title: 'Horaire Non Autorisé',
        message: 'Le Vendredi après-midi (13h00 — 16h00) est libre (Prière du Vendredi).',
        type: 'warning',
      });
      return;
    }

    try {
      const supabase = createClient();
      const targetClass = viewMode === 'CLASS' ? selectedClassId : (classes[0]?.id || '');
      const targetTeacher = viewMode === 'TEACHER' ? selectedTeacherId : (newSlot.teacher_id || teachers[0]?.id);

      const conflictSlot = slots.find(
        (s) =>
          s.day_of_week === Number(newSlot.day_of_week) &&
          s.start_time.slice(0, 5) === newSlot.start_time.slice(0, 5) &&
          (s.teacher_id === targetTeacher || s.room_id === newSlot.room_id)
      );

      if (conflictSlot) {
        notify({
          title: 'Conflit Détecté !',
          message: `L'enseignant ou la salle est déjà occupé(e) le même jour sur ce créneau de 55 min.`,
          type: 'warning',
        });
        return;
      }

      let timetableId: string;
      const { data: tt } = await supabase.from('timetables').select('id').limit(1);
      if (tt && tt.length > 0) {
        timetableId = tt[0].id;
      } else {
        const { data: newTT } = await supabase
          .from('timetables')
          .insert([{ name: 'Emploi du Temps Principal 2025-2026', status: 'PUBLISHED' }])
          .select('id')
          .single();
        timetableId = newTT?.id;
      }

      const { error } = await supabase.from('timetable_slots').insert([
        {
          timetable_id: timetableId,
          class_id: targetClass,
          teacher_id: targetTeacher,
          subject_id: newSlot.subject_id || subjects[0]?.id,
          room_id: newSlot.room_id || rooms[0]?.id,
          day_of_week: Number(newSlot.day_of_week),
          start_time: newSlot.start_time,
          end_time: newSlot.end_time,
        },
      ]);

      if (error) {
        notify({ title: 'Erreur', message: error.message, type: 'danger' });
        return;
      }

      setShowAddModal(false);
      notify({ title: 'Succès', message: 'Séance ajoutée avec succès !', type: 'success' });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      const supabase = createClient();
      await supabase.from('timetable_slots').delete().eq('id', slotId);
      notify({ title: 'Supprimé', message: 'Séance retirée de l\'emploi du temps.', type: 'info' });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExecuteClear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmKeyword.trim().toUpperCase() !== 'SUPPRIMER') {
      notify({
        title: 'Mot de Sécurité Incorrect',
        message: 'Veuillez taper exactement "SUPPRIMER" pour confirmer l\'effacement.',
        type: 'warning',
      });
      return;
    }

    setIsClearing(true);
    try {
      const supabase = createClient();

      if (clearScope === 'CURRENT_CLASS') {
        const { error } = await supabase.from('timetable_slots').delete().eq('class_id', selectedClassId);
        if (error) throw error;
        notify({
          title: 'Emploi du Temps Vidé',
          message: `Les séances de la classe "${selectedClass?.name}" ont été supprimées.`,
          type: 'success',
        });
      } else {
        const { error } = await supabase.from('timetable_slots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        notify({
          title: 'Emploi du Temps Général Réinitialisé',
          message: 'Toutes les séances de toutes les classes ont été effacées.',
          type: 'success',
        });
      }

      setShowClearModal(false);
      setConfirmKeyword('');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'effacement';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    } finally {
      setIsClearing(false);
    }
  };

  const triggerPrint = (mode: 'CURRENT' | 'ALL_CLASSES' | 'ALL_TEACHERS') => {
    setPrintMode(mode);
    setShowExportDropdown(false);

    const originalTitle = document.title;
    let exportFileName = 'Emploi_du_Temps_GM';
    if (mode === 'CURRENT') {
      if (viewMode === 'CLASS') {
        exportFileName = `Emploi_du_Temps_${selectedClass?.name || 'Classe'}_2025-2026`;
      } else {
        exportFileName = `Planning_Service_${selectedTeacher?.first_name || ''}_${selectedTeacher?.last_name || 'Enseignant'}_2025-2026`;
      }
    } else if (mode === 'ALL_CLASSES') {
      exportFileName = `Livret_Complet_Emplois_du_Temps_Toutes_Classes_2025-2026`;
    } else {
      exportFileName = `Plannings_Service_Tous_Enseignants_2025-2026`;
    }

    document.title = exportFileName;

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = originalTitle;
      }, 1500);
    }, 200);
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  const activeSlots = viewMode === 'CLASS'
    ? slots.filter((s) => s.class_id === selectedClassId)
    : slots.filter((s) => s.teacher_id === selectedTeacherId);

  return (
    <DashboardLayout>
      {/* GLOBAL PRINT STYLESHEET */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape !important;
            margin: 4mm 6mm 4mm 6mm !important;
          }
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, aside, nav, [role="navigation"], .print\\:hidden {
            display: none !important;
          }
          .print-full-container {
            width: 100% !important;
            max-width: 100% !important;
            height: 194mm !important;
            max-height: 194mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-page-break {
            page-break-after: always !important;
            break-after: page !important;
            height: 194mm !important;
            max-height: 194mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: hidden !important;
          }
          .print-header-block {
            margin-bottom: 5px !important;
            padding-bottom: 5px !important;
            border-bottom: 2px solid #0f172a !important;
          }
          .print-table {
            width: 100% !important;
            height: 100% !important;
            flex: 1 !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }
          .print-table th {
            padding: 4px 4px !important;
            font-size: 9pt !important;
          }
          .print-table td {
            padding: 2.5px 3.5px !important;
            vertical-align: middle !important;
          }
          .print-card-slot {
            padding: 3px 4px !important;
            min-height: 48px !important;
            max-height: 52px !important;
            border-radius: 6px !important;
            box-shadow: none !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            overflow: hidden !important;
          }
          .print-empty-slot {
            height: 48px !important;
            border-radius: 6px !important;
            font-size: 9pt !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
          }
          .print-card-subject {
            font-size: 9.5pt !important;
            font-weight: 900 !important;
            line-height: 1.15 !important;
            text-align: center !important;
            width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }
          .print-card-details {
            font-size: 7.5pt !important;
            line-height: 1.1 !important;
            text-align: center !important;
            width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }
          .print-recess-row {
            padding: 3px !important;
            font-size: 8pt !important;
            font-weight: 800 !important;
          }
          .print-signature-footer {
            margin-top: 6px !important;
            padding-top: 6px !important;
            border-top: 1.5px solid #94a3b8 !important;
            font-size: 8pt !important;
          }
        }
      `}</style>

      <div className="space-y-6 print:space-y-0">
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-3xl bg-sky-500/15 text-sky-600 dark:text-sky-400 shrink-0 flex items-center justify-center shadow-xs">
              <CalendarDays className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                <span>{t('timetable')}</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {t('timetable_page_title')}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {dir === 'rtl' ? 'تنظيم الحصص الأسبوعية، جداول الفصول والأساتذة، مع السحب والإفلات التفاعلي.' : "Glissez et déposez les séances \u2022 Alerte automatique si un vacataire n'est pas disponible sur le créneau."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Switcher */}
            <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('CLASS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'CLASS'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>{dir === 'rtl' ? 'حسب القسم' : 'Par Classe'}</span>
              </button>

              <button
                onClick={() => setViewMode('TEACHER')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'TEACHER'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{dir === 'rtl' ? 'حسب الأستاذ' : 'Par Enseignant'}</span>
              </button>
            </div>

            {/* Export PDF Button */}
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-sky-500" />
                <span>{dir === 'rtl' ? 'تصدير PDF' : 'Exporter PDF'}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
              </button>

              {showExportDropdown && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Options d&apos;Impression PDF
                  </div>

                  <button
                    onClick={() => triggerPrint('CURRENT')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-sky-500" />
                    <div>
                      <div>Imprimer la Vue Actuelle</div>
                      <div className="text-[10px] font-normal text-slate-400">
                        {viewMode === 'CLASS' ? `Classe : ${selectedClass?.name}` : `Prof : ${selectedTeacher?.last_name}`}
                      </div>
                    </div>
                  </button>

                  <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1" />

                  <button
                    onClick={() => triggerPrint('ALL_CLASSES')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-orange-500" />
                    <div>
                      <div className="text-orange-600 dark:text-orange-400 font-extrabold">Exporter TOUTES les Classes</div>
                      <div className="text-[10px] font-normal text-slate-400">Livret complet ({classes.length} classes)</div>
                    </div>
                  </button>

                  <button
                    onClick={() => triggerPrint('ALL_TEACHERS')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                  >
                    <User className="w-4 h-4 text-emerald-500" />
                    <div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-extrabold">Exporter TOUS les Enseignants</div>
                      <div className="text-[10px] font-normal text-slate-400">Plannings des {teachers.length} professeurs</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Clear Timetable Secure Button */}
            <button
              onClick={() => {
                setConfirmKeyword('');
                setShowClearModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Vider l&apos;Emploi du Temps</span>
            </button>

            <Link
              href="/timetable/generator"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-lg shadow-orange-500/25 transition-all hover:scale-105"
            >
              <Sparkles className="w-4 h-4 text-yellow-200" />
              Générateur IA
            </Link>

            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all hover:scale-105 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Ajouter une Séance
            </button>
          </div>
        </div>

        {/* Dynamic Dropdown Selector Bar */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${viewMode === 'CLASS' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'} shrink-0`}>
              {viewMode === 'CLASS' ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 dark:text-white">
                {viewMode === 'CLASS' ? 'Classe Affichée' : 'Enseignant Affiché'}
              </div>
              <div className="text-[11px] text-slate-400">
                {viewMode === 'CLASS'
                  ? 'Sélectionnez la division pour consulter ou modifier son planning'
                  : 'Sélectionnez un enseignant pour afficher son emploi du temps individuel'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {viewMode === 'CLASS' ? (
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full sm:min-w-[280px] px-4 py-2.5 rounded-2xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 cursor-pointer shadow-xs"
              >
                {classes.map((cls) => {
                  const classSlotsCount = slots.filter((s) => s.class_id === cls.id).length;
                  return (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.level}) &bull; {classSlotsCount} séances
                    </option>
                  );
                })}
              </select>
            ) : (
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full sm:min-w-[320px] px-4 py-2.5 rounded-2xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
              >
                {teachers.map((tch) => {
                  const teacherSlotCount = slots.filter((s) => s.teacher_id === tch.id).length;
                  return (
                    <option key={tch.id} value={tch.id}>
                      {tch.first_name} {tch.last_name} — {tch.specialization || 'Enseignant'} ({teacherSlotCount}h / sem.)
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        </div>

        {/* 1. SINGLE VIEW DISPLAY (Visible in Browser & When printMode === 'CURRENT') */}
        <div className={printMode !== 'CURRENT' ? 'print:hidden' : ''}>
          <div className="print-full-container">
            {/* Printable Header */}
            <div className="hidden print:block print-header-block">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src="/logo.png"
                    alt="Logo GM"
                    className="w-12 h-12 object-contain shrink-0"
                  />
                  <div>
                    <h1 className="text-sm font-black uppercase text-slate-900 leading-tight">
                      {settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES'}
                    </h1>
                    <p className="text-[9px] text-slate-600 font-semibold">
                      Année Scolaire : {settings.academic_year || '2025-2026'} &bull; {settings.current_term || 'Semestre 1'} &bull; Horaires Officiels (55 min / Séance)
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="px-3 py-1 rounded-lg bg-slate-900 text-white font-black text-xs inline-block">
                    {viewMode === 'CLASS'
                      ? `CLASSE : ${selectedClass?.name} (${selectedClass?.level})`
                      : `ENSEIGNANT : ${selectedTeacher?.first_name} ${selectedTeacher?.last_name?.toUpperCase()} (${selectedTeacher?.specialization})`}
                  </span>
                  <p className="text-[8px] text-slate-500 mt-0.5 font-bold">
                    {viewMode === 'CLASS' ? 'Emploi du Temps Officiel de la Classe' : `Planning de Service (${activeSlots.length}h / semaine)`}
                  </p>
                </div>
              </div>
            </div>

            {/* Timetable Table with Drag & Drop */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden print:border print:border-slate-300 print:shadow-none print:rounded-lg">
              <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 shrink-0 flex items-center justify-center">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <span>
                      {viewMode === 'CLASS' ? 'Emploi du temps de la classe :' : 'Emploi du temps de l\'enseignant :'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 font-extrabold text-sm">
                      {viewMode === 'CLASS' ? selectedClass?.name : `${selectedTeacher?.first_name} ${selectedTeacher?.last_name}`}
                    </span>
                    {viewMode === 'TEACHER' && selectedTeacher?.specialization && (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold">
                        {selectedTeacher.specialization} &bull; {selectedTeacher.contract_type}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 border border-sky-200 dark:border-sky-800">
                    <Move className="w-3 h-3" />
                    Glisser-déposer pour permuter / déplacer
                  </span>
                  <span className="text-xs text-slate-500 font-bold">
                    {activeSlots.length} séances planifiées
                  </span>
                </div>
              </div>

              <div className="w-full overflow-hidden print:overflow-visible">
                <table className="w-full table-fixed text-center border-collapse print:table-fixed print-table">
                  <thead>
                    <tr className="bg-slate-100/80 dark:bg-slate-800/50 print:bg-slate-100 text-[11px] print:text-[8pt] font-bold text-slate-700 dark:text-slate-300 print:text-black border-b border-slate-200 dark:border-slate-800 print:border-slate-400">
                      <th className="p-2 sm:p-3 print:p-1 text-left w-[14%] sm:w-[13%] border-r border-slate-200 dark:border-slate-800 print:border-slate-300">
                        <span className="hidden sm:inline">Horaire (55 min)</span>
                        <span className="sm:hidden">Horaire</span>
                      </th>
                      {MOROCCAN_SCHOOL_DAYS.map((day) => (
                        <th key={day.id} className="p-2 sm:p-3 print:p-1 w-[17.2%] sm:w-[17.4%] border-r border-slate-200 dark:border-slate-800 print:border-slate-300 last:border-r-0">
                          <div className="font-extrabold text-slate-900 dark:text-white print:text-black text-[11px] sm:text-xs lg:text-sm print:text-[8.5pt]">{day.name}</div>
                          {day.isHalfDay && (
                            <span className="text-[9px] sm:text-[10px] print:text-[7pt] text-orange-600 dark:text-orange-400 print:text-slate-600 font-normal block truncate">
                              Matinée (Fin 12h20)
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-300 text-xs">
                    {MOROCCAN_55MIN_PERIODS.map((period) => {
                      const isRecessAfterP2 = period.id === 'P2';
                      const isLunchBreakAfterP4 = period.id === 'P4';
                      const isRecessAfterP6 = period.id === 'P6';

                      return (
                        <React.Fragment key={period.id}>
                          <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            {/* Period Column */}
                            <td className="p-1.5 sm:p-2.5 print:p-1 text-left font-mono font-bold text-slate-700 dark:text-slate-300 print:text-black bg-slate-50/60 dark:bg-slate-900/50 print:bg-slate-50 border-r border-slate-200 dark:border-slate-800 print:border-slate-300">
                              <div className="text-[10px] sm:text-xs font-black text-sky-600 dark:text-sky-400 print:text-black leading-tight">{period.label}</div>
                              <div className="text-[9px] sm:text-[10px] print:text-[6.5pt] text-slate-400 print:text-slate-500 font-sans font-normal truncate">{period.sessionName}</div>
                            </td>

                            {/* Day Columns */}
                            {MOROCCAN_SCHOOL_DAYS.map((day) => {
                              // Friday Afternoon check
                              if (day.id === 5 && period.isAfternoon) {
                                if (period.id === 'P5') {
                                  return (
                                    <td
                                      key={day.id}
                                      rowSpan={3}
                                      className="p-2 print:p-1 bg-slate-100/70 dark:bg-slate-950/60 print:bg-slate-100 border-r border-slate-200 dark:border-slate-800 print:border-slate-300 align-middle text-center"
                                    >
                                      <div className="py-4 print:py-2 px-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 print:text-slate-700">
                                        <span className="font-bold text-[10px] sm:text-xs print:text-[8pt] text-slate-700 dark:text-slate-300 print:text-black">
                                          🕌 Après-midi Libre
                                        </span>
                                        <span className="text-[9px] sm:text-[10px] print:text-[7pt] text-slate-400 print:text-slate-600">Prière du Vendredi</span>
                                      </div>
                                    </td>
                                  );
                                }
                                return null;
                              }

                              const slot = activeSlots.find(
                                (s) =>
                                  s.day_of_week === day.id &&
                                  s.start_time.slice(0, 5) === period.start
                              );

                              const isDragOver =
                                dragOverCell?.day === day.id &&
                                dragOverCell?.start === period.start;

                              return (
                                <td
                                  key={day.id}
                                  onDragOver={(e) => handleDragOver(e, day.id, period.start)}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleDropOnCell(e, day.id, period, slot)}
                                  className={`p-1 sm:p-1.5 print:p-0.5 border-r border-slate-200 dark:border-slate-800 print:border-slate-300 last:border-r-0 align-middle transition-all ${
                                    isDragOver
                                      ? 'bg-sky-100/70 dark:bg-sky-900/40 ring-2 ring-sky-500 ring-inset scale-[1.01]'
                                      : ''
                                  }`}
                                >
                                  {slot ? (
                                    <div
                                      draggable={true}
                                      onDragStart={(e) => handleDragStart(e, slot)}
                                      onDragEnd={() => {
                                        setDraggedSlot(null);
                                        setDragOverCell(null);
                                      }}
                                      className={`w-full p-1 sm:p-1.5 lg:p-2 rounded-xl sm:rounded-2xl print:rounded text-white shadow-xs relative group transition-all flex flex-col items-center justify-center text-center min-h-[58px] sm:min-h-[66px] lg:min-h-[74px] print:min-h-[48px] print:max-h-[52px] print-card-slot cursor-grab active:cursor-grabbing hover:shadow-md overflow-hidden ${
                                        draggedSlot?.id === slot.id
                                          ? 'opacity-40 ring-2 ring-white scale-95'
                                          : 'hover:scale-[1.01]'
                                      }`}
                                      style={{
                                        backgroundColor: slot.subject?.color_code || '#0284c7',
                                      }}
                                    >
                                      {/* Drag grip icon on top left hover */}
                                      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-75 transition-opacity print:hidden pointer-events-none">
                                        <GripVertical className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                                      </div>

                                      {/* Delete button on top right hover */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteSlot(slot.id);
                                        }}
                                        title="Supprimer la séance"
                                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 hover:text-rose-200 transition-opacity p-0.5 print:hidden cursor-pointer"
                                      >
                                        <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                                      </button>

                                      {/* Centered text content */}
                                      <div className="w-full flex flex-col items-center justify-center text-center overflow-hidden">
                                        <div className="font-black text-[10px] sm:text-xs lg:text-[13px] tracking-wide text-white text-center leading-tight truncate w-full px-0.5 print-card-subject">
                                          {slot.subject?.name || 'Matière'}
                                        </div>

                                        <div className="text-[8.5px] sm:text-[9.5px] lg:text-[10.5px] print:text-[7.5pt] text-white/95 font-medium text-center truncate w-full mt-0.5 print-card-details">
                                          {viewMode === 'CLASS'
                                            ? slot.teacher
                                              ? `${slot.teacher.first_name} ${slot.teacher.last_name}`
                                              : 'Prof non assigné'
                                            : slot.class
                                              ? `Classe : ${slot.class.name} (${slot.class.level})`
                                              : 'Classe'}
                                        </div>

                                        <div className="text-[7.5px] sm:text-[8.5px] lg:text-[9px] print:text-[7pt] text-white/90 font-bold bg-black/25 print:bg-transparent px-1.5 py-0.5 rounded text-center inline-block mt-0.5 sm:mt-1 print:mt-0 truncate max-w-[95%] print-card-details">
                                          S: {slot.room?.name || slot.room?.room_number || 'N/A'}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      className={`w-full min-h-[54px] sm:min-h-[62px] lg:min-h-[68px] print:h-12 print-empty-slot rounded-xl sm:rounded-2xl print:rounded border-2 border-dashed transition-all flex items-center justify-center text-[10px] sm:text-[11px] print:text-[8pt] font-medium ${
                                        isDragOver
                                          ? 'border-sky-500 bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold scale-102'
                                          : 'border-slate-200 dark:border-slate-800 print:border-slate-300 text-slate-300 dark:text-slate-700 print:text-slate-400'
                                      }`}
                                    >
                                      {isDragOver ? '+ Déposer' : '—'}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>

                          {/* Recess & Lunch breaks */}
                          {isRecessAfterP2 && (
                            <tr className="bg-amber-500/10 dark:bg-amber-950/30 print:bg-amber-100/50 text-amber-800 dark:text-amber-300 print:text-amber-900 text-[11px] print:text-[7pt] font-bold print-recess-row">
                              <td colSpan={6} className="py-1.5 print:py-0.5 px-4 text-center tracking-wider">
                                🔔 Récréation du Matin (10 min) &bull; 10h20 &mdash; 10h30
                              </td>
                            </tr>
                          )}

                          {isLunchBreakAfterP4 && (
                            <tr className="bg-gradient-to-r from-orange-500/15 via-amber-500/20 to-orange-500/15 print:bg-orange-100 text-orange-900 dark:text-orange-200 print:text-orange-950 text-xs print:text-[7.5pt] font-black print-recess-row">
                              <td colSpan={6} className="py-2.5 print:py-0.5 px-4 text-center tracking-wider border-y border-orange-500/30 print:border-orange-300">
                                🍽️ Pause Déjeuner &amp; Prière (40 min) &bull; 12h20 &mdash; 13h00
                              </td>
                            </tr>
                          )}

                          {isRecessAfterP6 && (
                            <tr className="bg-amber-500/10 dark:bg-amber-950/30 print:bg-amber-100/50 text-amber-800 dark:text-amber-300 print:text-amber-900 text-[11px] print:text-[7pt] font-bold print-recess-row">
                              <td colSpan={6} className="py-1.5 print:py-0.5 px-4 text-center tracking-wider">
                                🔔 Pause de l&apos;Après-midi (10 min) &bull; 14h55 &mdash; 15h05 (Lundi au Jeudi)
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Printable Signature Footer */}
            <div className="hidden print:flex justify-between items-center print-signature-footer text-[7.5pt]">
              <div>
                <p className="font-bold text-slate-800">Cachet de l&apos;Établissement</p>
              </div>
              <div className="text-center text-[7pt] text-slate-500 font-medium">
                Document officiel généré par GM School Management System
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-800">Signature du Directeur Pédagogique</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. BATCH PRINT: ALL CLASSES */}
        {printMode === 'ALL_CLASSES' && (
          <div className="hidden print:block space-y-0">
            {classes.map((cls, cIdx) => {
              const cSlots = slots.filter((s) => s.class_id === cls.id);
              return (
                <div key={cls.id} className={`print-page-break ${cIdx === classes.length - 1 ? 'print:break-after-auto' : ''}`}>
                  <div className="print-header-block">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src="/logo.png"
                          alt="Logo GM"
                          className="w-12 h-12 object-contain shrink-0"
                        />
                        <div>
                          <h1 className="text-sm font-black uppercase text-slate-900 leading-tight">
                            {settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES'}
                          </h1>
                          <p className="text-[9px] text-slate-600 font-semibold">
                            Année Scolaire : {settings.academic_year || '2025-2026'} &bull; {settings.current_term || 'Semestre 1'} &bull; Horaires Officiels (55 min / Séance)
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="px-3 py-1 rounded-lg bg-slate-900 text-white font-black text-xs inline-block">
                          CLASSE : {cls.name} ({cls.level})
                        </span>
                        <p className="text-[8px] text-slate-500 mt-0.5 font-bold">
                          Emploi du Temps Officiel Hebdomadaire ({cSlots.length} séances)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-300 overflow-hidden">
                    <table className="w-full text-center border-collapse print-table">
                      <thead>
                        <tr className="bg-slate-100 text-[8pt] font-bold text-black border-b border-slate-400">
                          <th className="p-1 text-left w-24 border-r border-slate-300">Horaire (55 min)</th>
                          {MOROCCAN_SCHOOL_DAYS.map((d) => (
                            <th key={d.id} className="p-1 border-r border-slate-300 last:border-r-0">
                              <div className="font-extrabold text-[8.5pt]">{d.name}</div>
                              {d.isHalfDay && <span className="text-[7pt] text-slate-600 block">Matinée</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300 text-xs">
                        {MOROCCAN_55MIN_PERIODS.map((period) => {
                          const isRecessAfterP2 = period.id === 'P2';
                          const isLunchBreakAfterP4 = period.id === 'P4';
                          const isRecessAfterP6 = period.id === 'P6';

                          return (
                            <React.Fragment key={period.id}>
                              <tr>
                                <td className="p-1 text-left font-mono font-bold text-black bg-slate-50 border-r border-slate-300">
                                  <div className="text-[8pt] font-black">{period.label}</div>
                                  <div className="text-[6.5pt] text-slate-500 font-sans font-normal">{period.sessionName}</div>
                                </td>

                                {MOROCCAN_SCHOOL_DAYS.map((day) => {
                                  if (day.id === 5 && period.isAfternoon) {
                                    if (period.id === 'P5') {
                                      return (
                                        <td key={day.id} rowSpan={3} className="p-1 bg-slate-100 border-r border-slate-300 align-middle text-center">
                                          <div className="py-2 text-[8pt] font-bold text-black">🕌 Après-midi Libre</div>
                                        </td>
                                      );
                                    }
                                    return null;
                                  }

                                  const slot = cSlots.find((s) => s.day_of_week === day.id && s.start_time.slice(0, 5) === period.start);
                                  return (
                                    <td key={day.id} className="p-0.5 border-r border-slate-300 last:border-r-0 align-middle">
                                      {slot ? (
                                        <div
                                          className="p-1 rounded text-white print-card-slot"
                                          style={{ backgroundColor: slot.subject?.color_code || '#0284c7' }}
                                        >
                                          <div className="w-full flex flex-col items-center justify-center text-center overflow-hidden">
                                            <div className="font-black text-[9pt] print-card-subject">{slot.subject?.name}</div>
                                            <div className="text-[7.5pt] opacity-90 truncate mt-0.5 print-card-details">
                                              {slot.teacher ? `${slot.teacher.first_name} ${slot.teacher.last_name}` : 'Prof non assigné'}
                                            </div>
                                            <div className="text-[6.5pt] opacity-80 pt-0 print-card-details">
                                              S: {slot.room?.name || slot.room?.room_number || 'N/A'}
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="h-12 print-empty-slot rounded border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[8pt]">
                                          —
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>

                              {isRecessAfterP2 && (
                                <tr className="bg-amber-100/50 text-amber-900 text-[7pt] font-bold print-recess-row">
                                  <td colSpan={6} className="py-0.5 px-4 text-center">🔔 Récréation du Matin (10 min) &bull; 10h20 &mdash; 10h30</td>
                                </tr>
                              )}
                              {isLunchBreakAfterP4 && (
                                <tr className="bg-orange-100 text-orange-950 text-[7.5pt] font-black print-recess-row">
                                  <td colSpan={6} className="py-0.5 px-4 text-center border-y border-orange-300">🍽️ Pause Déjeuner &amp; Prière (40 min) &bull; 12h20 &mdash; 13h00</td>
                                </tr>
                              )}
                              {isRecessAfterP6 && (
                                <tr className="bg-amber-100/50 text-amber-900 text-[7pt] font-bold print-recess-row">
                                  <td colSpan={6} className="py-0.5 px-4 text-center">🔔 Pause de l&apos;Après-midi (10 min) &bull; 14h55 &mdash; 15h05</td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center print-signature-footer text-[7.5pt]">
                    <div><p className="font-bold text-slate-800">Cachet de l&apos;Établissement</p></div>
                    <div className="text-[7pt] text-slate-500 font-medium">Document officiel généré par GM School Management System</div>
                    <div><p className="font-bold text-slate-800">Signature de la Direction</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. BATCH PRINT: ALL TEACHERS */}
        {printMode === 'ALL_TEACHERS' && (
          <div className="hidden print:block space-y-0">
            {teachers.map((tch, tIdx) => {
              const tSlots = slots.filter((s) => s.teacher_id === tch.id);
              return (
                <div key={tch.id} className={`print-page-break ${tIdx === teachers.length - 1 ? 'print:break-after-auto' : ''}`}>
                  <div className="print-header-block">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src="/logo.png"
                          alt="Logo GM"
                          className="w-12 h-12 object-contain shrink-0"
                        />
                        <div>
                          <h1 className="text-sm font-black uppercase text-slate-900 leading-tight">
                            {settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES'}
                          </h1>
                          <p className="text-[9px] text-slate-600 font-semibold">
                            Année Scolaire : {settings.academic_year || '2025-2026'} &bull; Planning de Service Individuel Enseignant
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="px-3 py-1 rounded-lg bg-emerald-950 text-white font-black text-xs inline-block">
                          PROFESSEUR : {tch.first_name} {tch.last_name?.toUpperCase()}
                        </span>
                        <p className="text-[8px] text-slate-500 mt-0.5 font-bold">
                          Spécialité : {tch.specialization || 'Générale'} &bull; Volume : {tSlots.length}h / semaine
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-300 overflow-hidden">
                    <table className="w-full text-center border-collapse print-table">
                      <thead>
                        <tr className="bg-slate-100 text-[8pt] font-bold text-black border-b border-slate-400">
                          <th className="p-1 text-left w-24 border-r border-slate-300">Horaire (55 min)</th>
                          {MOROCCAN_SCHOOL_DAYS.map((d) => (
                            <th key={d.id} className="p-1 border-r border-slate-300 last:border-r-0">
                              <div className="font-extrabold text-[8.5pt]">{d.name}</div>
                              {d.isHalfDay && <span className="text-[7pt] text-slate-600 block">Matinée</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300 text-xs">
                        {MOROCCAN_55MIN_PERIODS.map((period) => {
                          const isRecessAfterP2 = period.id === 'P2';
                          const isLunchBreakAfterP4 = period.id === 'P4';
                          const isRecessAfterP6 = period.id === 'P6';

                          return (
                            <React.Fragment key={period.id}>
                              <tr>
                                <td className="p-1 text-left font-mono font-bold text-black bg-slate-50 border-r border-slate-300">
                                  <div className="text-[8pt] font-black">{period.label}</div>
                                  <div className="text-[6.5pt] text-slate-500 font-sans font-normal">{period.sessionName}</div>
                                </td>

                                {MOROCCAN_SCHOOL_DAYS.map((day) => {
                                  if (day.id === 5 && period.isAfternoon) {
                                    if (period.id === 'P5') {
                                      return (
                                        <td key={day.id} rowSpan={3} className="p-1 bg-slate-100 border-r border-slate-300 align-middle text-center">
                                          <div className="py-2 text-[8pt] font-bold text-black">🕌 Après-midi Libre</div>
                                        </td>
                                      );
                                    }
                                    return null;
                                  }

                                  const slot = tSlots.find((s) => s.day_of_week === day.id && s.start_time.slice(0, 5) === period.start);
                                  return (
                                    <td key={day.id} className="p-0.5 border-r border-slate-300 last:border-r-0 align-middle">
                                      {slot ? (
                                        <div
                                          className="p-1 rounded text-white print-card-slot"
                                          style={{ backgroundColor: slot.subject?.color_code || '#059669' }}
                                        >
                                          <div className="w-full flex flex-col items-center justify-center text-center overflow-hidden">
                                            <div className="font-black text-[9pt] print-card-subject">{slot.subject?.name}</div>
                                            <div className="text-[7.5pt] opacity-90 truncate mt-0.5 print-card-details font-bold">
                                              Classe : {slot.class ? `${slot.class.name} (${slot.class.level})` : 'Classe'}
                                            </div>
                                            <div className="text-[6.5pt] opacity-80 pt-0 print-card-details">
                                              S: {slot.room?.name || slot.room?.room_number || 'N/A'}
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="h-12 print-empty-slot rounded border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[8pt]">
                                          —
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>

                              {isRecessAfterP2 && (
                                <tr className="bg-amber-100/50 text-amber-900 text-[7pt] font-bold print-recess-row">
                                  <td colSpan={6} className="py-0.5 px-4 text-center">🔔 Récréation du Matin (10 min) &bull; 10h20 &mdash; 10h30</td>
                                </tr>
                              )}
                              {isLunchBreakAfterP4 && (
                                <tr className="bg-orange-100 text-orange-950 text-[7.5pt] font-black print-recess-row">
                                  <td colSpan={6} className="py-0.5 px-4 text-center border-y border-orange-300">🍽️ Pause Déjeuner &amp; Prière (40 min) &bull; 12h20 &mdash; 13h00</td>
                                </tr>
                              )}
                              {isRecessAfterP6 && (
                                <tr className="bg-amber-100/50 text-amber-900 text-[7pt] font-bold print-recess-row">
                                  <td colSpan={6} className="py-0.5 px-4 text-center">🔔 Pause de l&apos;Après-midi (10 min) &bull; 14h55 &mdash; 15h05</td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center print-signature-footer text-[7.5pt]">
                    <div><p className="font-bold text-slate-800">Émargement de l&apos;Enseignant</p></div>
                    <div className="text-[7pt] text-slate-500 font-medium">Document officiel &bull; GM School Management System</div>
                    <div><p className="font-bold text-slate-800">Signature de la Direction</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal 1: Add Slot */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in print:hidden">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-sky-500/20 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sky-500/15 text-sky-500">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Ajouter une Séance (55 min)
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddSlot} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Jour de la Semaine
                    </label>
                    <select
                      value={newSlot.day_of_week}
                      onChange={(e) => setNewSlot({ ...newSlot, day_of_week: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      {MOROCCAN_SCHOOL_DAYS.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.isHalfDay ? '(Fin à 12h20)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Créneau (55 minutes)
                    </label>
                    <select
                      value={newSlot.start_time}
                      onChange={(e) => {
                        const start = e.target.value;
                        const period = MOROCCAN_55MIN_PERIODS.find((p) => p.start === start);
                        setNewSlot({
                          ...newSlot,
                          start_time: start,
                          end_time: period ? period.end : '09:25',
                        });
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      {MOROCCAN_55MIN_PERIODS.map((p) => (
                        <option
                          key={p.id}
                          value={p.start}
                          disabled={Number(newSlot.day_of_week) === 5 && p.notOnFriday}
                        >
                          {p.label} &mdash; {p.sessionName} {Number(newSlot.day_of_week) === 5 && p.notOnFriday ? '(Non dispo Vendredi)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Matière
                    </label>
                    <select
                      required
                      value={newSlot.subject_id}
                      onChange={(e) => setNewSlot({ ...newSlot, subject_id: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      <option value="">-- Choisir --</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Enseignant
                    </label>
                    <select
                      required
                      value={newSlot.teacher_id}
                      onChange={(e) => setNewSlot({ ...newSlot, teacher_id: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      <option value="">-- Choisir --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.first_name} {t.last_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Salle
                    </label>
                    <select
                      required
                      value={newSlot.room_id}
                      onChange={(e) => setNewSlot({ ...newSlot, room_id: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      <option value="">-- Choisir --</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.room_number})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 rounded-xl shadow-lg shadow-sky-500/25 transition-all cursor-pointer"
                  >
                    Enregistrer la Séance
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Secure Clear Confirmation Widget */}
        {showClearModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in print:hidden">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-rose-200 dark:border-rose-500/30 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <div className="p-2 rounded-xl bg-rose-500/15">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Vider l&apos;Emploi du Temps
                  </h3>
                </div>
                <button
                  onClick={() => setShowClearModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleExecuteClear} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Sélectionnez ce que vous souhaitez effacer :
                  </label>
                  <div className="space-y-2">
                    <label
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                        clearScope === 'CURRENT_CLASS'
                          ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="clearScope"
                        checked={clearScope === 'CURRENT_CLASS'}
                        onChange={() => setClearScope('CURRENT_CLASS')}
                        className="accent-rose-500"
                      />
                      <div className="text-xs">
                        <span className="font-bold block">
                          Uniquement la classe sélectionnée ({selectedClass?.name})
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Supprime les {activeSlots.length} séances de cette classe.
                        </span>
                      </div>
                    </label>

                    <label
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                        clearScope === 'ALL_CLASSES'
                          ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="clearScope"
                        checked={clearScope === 'ALL_CLASSES'}
                        onChange={() => setClearScope('ALL_CLASSES')}
                        className="accent-rose-500"
                      />
                      <div className="text-xs">
                        <span className="font-bold block">
                          TOUTES les classes de l&apos;école ({slots.length} séances au total)
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Réinitialise complètement l&apos;emploi du temps global.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                    <span>Confirmation de Sécurité Obligatoire</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">
                    Pour éviter toute suppression accidentelle, tapez le mot{' '}
                    <strong className="text-rose-600 dark:text-rose-400 font-mono font-black">
                      SUPPRIMER
                    </strong>{' '}
                    ci-dessous :
                  </p>
                  <input
                    type="text"
                    required
                    placeholder="Tapez SUPPRIMER"
                    value={confirmKeyword}
                    onChange={(e) => setConfirmKeyword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 uppercase tracking-widest text-center"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowClearModal(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={confirmKeyword.trim().toUpperCase() !== 'SUPPRIMER' || isClearing}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-rose-600/25 transition-all cursor-pointer"
                  >
                    {isClearing ? 'Effacement en cours...' : 'Confirmer et Vider'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 3: Vacataire Non-Availability Warning Modal (Warranty / Avertissement) */}
        {vacataireWarning && vacataireWarning.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in print:hidden">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border-2 border-amber-500 dark:border-amber-500/50 animate-in zoom-in-95">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 text-amber-600 dark:text-amber-400">
                <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Avertissement de Disponibilité Vacataire
                  </h3>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                    Créneau Hors Présence Déclarée
                  </p>
                </div>
              </div>

              <div className="space-y-3 mt-4 text-xs">
                <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-slate-700 dark:text-slate-300 leading-relaxed">
                  <p className="font-medium">
                    L&apos;enseignant vacataire <strong className="text-slate-900 dark:text-white font-bold">{vacataireWarning.teacherName}</strong> n&apos;a pas coché ce créneau dans sa fiche de présence à l&apos;établissement :
                  </p>
                  <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/80 font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>{vacataireWarning.dayName} &bull; {vacataireWarning.timeLabel}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Souhaitez-vous quand même forcer le déplacement de cette séance sur ce créneau ?
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setVacataireWarning(null);
                    setDraggedSlot(null);
                  }}
                  className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler le Déplacement
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (vacataireWarning.onConfirm) {
                      await vacataireWarning.onConfirm();
                    }
                  }}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-xl shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                >
                  Confirmer Malgré Tout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
