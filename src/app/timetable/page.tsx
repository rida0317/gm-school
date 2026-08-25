'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { ClassEntity, Teacher, Room, Subject, TimetableSlot } from '@/types/database';
import { useNotify } from '@/lib/modal-service';
import { useSettings } from '@/lib/settings';
import { logAuditEvent } from '@/lib/audit';
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
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
  SearchCheck,
  Wand2,
  Table,
  LayoutGrid,
  BookOpen,
  Check,
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

export function getSubjectAbbreviation(subject?: { code?: string; name?: string } | null): string {
  if (!subject) return '';
  const code = (subject.code || '').toUpperCase().trim();
  if (code && code !== 'MATIERE' && code !== 'MAT') {
    if (code === 'ISLAM') return 'ISL';
    if (code === 'PHY') return 'PC';
    return code;
  }
  const name = (subject.name || '').toLowerCase();
  if (name.includes('arab')) return 'AR';
  if (name.includes('fran')) return 'FR';
  if (name.includes('angl') || name.includes('eng')) return 'ENG';
  if (name.includes('math')) return 'MATH';
  if (name.includes('terre') || name.includes('svt') || name.includes('scien')) return 'SVT';
  if (name.includes('phys') || name.includes('chim') || name.includes('pc')) return 'PC';
  if (name.includes('hist') || name.includes('géo') || name.includes('geo')) return 'HIST';
  if (name.includes('islam') || name.includes('isl')) return 'ISL';
  if (name.includes('physique') || name.includes('eps') || name.includes('sport') || name.includes('éduc')) return 'EPS';
  if (name.includes('info')) return 'INFO';
  if (name.includes('esp')) return 'ESP';
  if (name.includes('phil')) return 'PHILO';
  if (name.includes('art') || name.includes('dessin')) return 'ARTS';
  if (name.includes('mus')) return 'MUS';
  return (subject.name || '').slice(0, 4).toUpperCase();
}

import { useAuth } from '@/lib/auth';

export default function TimetablePage() {
  const { t, dir } = useI18n();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const isTeacher = profile?.role === 'TEACHER';

  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherName, setTeacherName] = useState<string>('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  
  // View mode: 'CLASS' vs 'TEACHER' vs 'MASTER_GRID'
  const [viewMode, setViewMode] = useState<'CLASS' | 'TEACHER' | 'MASTER_GRID'>('CLASS');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Drag and Drop States
  const [draggedSlot, setDraggedSlot] = useState<TimetableSlot | null>(null);
  const draggedSlotRef = React.useRef<TimetableSlot | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ day: number; start: string } | null>(null);

  // Vacataire Non-Availability Warning Modal State
  const [vacataireWarning, setVacataireWarning] = useState<{
    show: boolean;
    teacherName: string;
    dayName: string;
    timeLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Teacher Already Busy Conflict Modal State (Warranty / Avertissement de Conflit)
  const [teacherConflictModal, setTeacherConflictModal] = useState<{
    show: boolean;
    teacherName: string;
    conflictingClassName: string;
    conflictingSubjectName: string;
    targetClassName: string;
    dayName: string;
    timeLabel: string;
    alternativeSlot?: { dayId: number; period: PeriodSlot };
    onSwapWithConflictingClass?: () => Promise<void>;
  } | null>(null);

  // PDF Export Mode: 'CURRENT' | 'ALL_CLASSES' | 'ALL_TEACHERS' | 'MASTER_GRID'
  const [printMode, setPrintMode] = useState<'CURRENT' | 'ALL_CLASSES' | 'ALL_TEACHERS' | 'MASTER_GRID'>('CURRENT');
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // Add / Edit Slot Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [newSlot, setNewSlot] = useState({
    class_id: '',
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

  // Real-time Schedule Integrity Inspector & Verifier
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  // Pinned / Anchor slots that MUST NOT be reverted or moved by auto-correction
  const [pinnedSlotIds, setPinnedSlotIds] = useState<Set<string>>(new Set());

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

      if (rm) setRooms(rm);
      if (sbj) setSubjects(sbj);
      if (slt) setSlots(slt);

      if (profile?.role === 'TEACHER') {
        // Teacher scoping: scope to current teacher and their taught classes
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('*')
          .or(`profile_id.eq.${profile.id},email.eq.${profile.email}`)
          .maybeSingle();

        if (teacherData) {
          setTeacherName(`${teacherData.first_name} ${teacherData.last_name}`);
          setTeachers([teacherData]);
          setSelectedTeacherId(teacherData.id);
          setViewMode('TEACHER');

          // Find classes taught by this teacher
          const teacherSlotClassIds = new Set<string>();
          (slt || []).forEach((s) => {
            if (s.teacher_id === teacherData.id && s.class_id) {
              teacherSlotClassIds.add(s.class_id);
            }
          });

          const teacherClasses = (cls || []).filter(
            (c) => teacherSlotClassIds.has(c.id) || c.main_teacher_id === teacherData.id
          );
          setClasses(teacherClasses);
          if (teacherClasses.length > 0) {
            setSelectedClassId(teacherClasses[0].id);
          }
        } else {
          setTeachers([]);
          setClasses([]);
        }
      } else {
        if (cls && cls.length > 0) {
          setClasses(cls);
          if (!selectedClassId) setSelectedClassId(cls[0].id);
        }
        if (tch && tch.length > 0) {
          setTeachers(tch);
          if (!selectedTeacherId) setSelectedTeacherId(tch[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [profile]);

  const normalizeTime = (t: string | undefined | null): string => {
    if (!t) return '';
    const clean = t.trim();
    const parts = clean.split(':');
    if (parts.length >= 2) {
      const hh = parts[0].padStart(2, '0');
      const mm = parts[1].padStart(2, '0');
      return `${hh}:${mm}`;
    }
    return clean.slice(0, 5);
  };

  const isSameSlotTime = (slotDay: number | string, slotStart: string, targetDay: number | string, targetStart: string): boolean => {
    return Number(slotDay) === Number(targetDay) && normalizeTime(slotStart) === normalizeTime(targetStart);
  };

  // Helper to check if a vacataire is present on a given slot
  const isVacataireAvailable = (
    teacher: Teacher | undefined,
    dayId: number,
    periodId: string,
    periodStart: string
  ): boolean => {
    if (!teacher || teacher.contract_type !== 'VACATAIRE') return true;
    if (!Array.isArray(teacher.availability) || teacher.availability.length === 0) return true;
    return teacher.availability.some((slot) => {
      const slotDay = Number(slot.day_of_week);
      const slotPeriod = String(slot.period_id || '').toUpperCase();
      const slotStart = String(slot.start_time || '');
      return (
        slotDay === Number(dayId) &&
        (slotPeriod === periodId.toUpperCase() || normalizeTime(slotStart) === normalizeTime(periodStart))
      );
    });
  };

  // Smart Helper to find the absolute CLOSEST open available slot for a class and teacher (a9rab sa3a khawya)
  const findClosestAlternativeSlot = (
    classId: string,
    teacher: Teacher | undefined,
    currentSlots: TimetableSlot[],
    excludeSlotIds: string[],
    preferredDayId: number,
    preferredPeriodStart?: string
  ): { dayId: number; period: PeriodSlot } | null => {
    const preferredPeriodIndex = MOROCCAN_55MIN_PERIODS.findIndex(
      (p) => normalizeTime(p.start) === normalizeTime(preferredPeriodStart)
    );
    const centerPeriodIdx = preferredPeriodIndex >= 0 ? preferredPeriodIndex : 0;

    const candidateSlots: { dayId: number; period: PeriodSlot; score: number }[] = [];

    for (let dayIdx = 0; dayIdx < MOROCCAN_SCHOOL_DAYS.length; dayIdx++) {
      const day = MOROCCAN_SCHOOL_DAYS[dayIdx];
      const dayId = day.id;
      const dayDist = Math.abs(dayId - preferredDayId);

      for (let pIdx = 0; pIdx < MOROCCAN_55MIN_PERIODS.length; pIdx++) {
        const period = MOROCCAN_55MIN_PERIODS[pIdx];

        // Friday afternoon forbidden
        if (dayId === 5 && period.isAfternoon) continue;

        // 1. Class must be free
        const classOccupied = currentSlots.some(
          (s) =>
            !excludeSlotIds.includes(s.id) &&
            s.class_id === classId &&
            isSameSlotTime(s.day_of_week, s.start_time, dayId, period.start)
        );
        if (classOccupied) continue;

        // 2. Teacher must be free
        if (teacher) {
          const teacherOccupied = currentSlots.some(
            (s) =>
              !excludeSlotIds.includes(s.id) &&
              s.teacher_id === teacher.id &&
              isSameSlotTime(s.day_of_week, s.start_time, dayId, period.start)
          );
          if (teacherOccupied) continue;

          // 3. Vacataire availability
          if (!isVacataireAvailable(teacher, dayId, period.id, period.start)) continue;
        }

        // Proximity score: day distance (weight 10) + period distance (weight 1)
        const periodDist = Math.abs(pIdx - centerPeriodIdx);
        const score = dayDist * 10 + periodDist;

        candidateSlots.push({ dayId, period, score });
      }
    }

    // Sort ascending: smallest score = absolute closest slot
    candidateSlots.sort((a, b) => a.score - b.score);

    return candidateSlots.length > 0 ? { dayId: candidateSlots[0].dayId, period: candidateSlots[0].period } : null;
  };

  // Real-Time Schedule Conflict Inspector & Integrity Engine
  interface ConflictReport {
    id: string;
    type: 'TEACHER_DOUBLE_BOOKING' | 'CLASS_DOUBLE_BOOKING' | 'ROOM_DOUBLE_BOOKING' | 'CLASS_SCHEDULE_HOLE' | 'VACATAIRE_UNAVAILABLE_SLOT' | 'EXCESS_DAILY_SUBJECT_HOURS';
    title: string;
    description: string;
    day_of_week: number;
    dayName: string;
    start_time: string;
    timeLabel: string;
    classes: string[];
    teacherName?: string;
    conflictingSlotIds: string[];
  }

  // Standalone Pure Conflict Auditing Engine
  const auditScheduleConflicts = (
    slotsList: TimetableSlot[],
    teachersList: Teacher[],
    classesList: ClassEntity[]
  ): ConflictReport[] => {
    const reports: ConflictReport[] = [];
    const seenPairs = new Set<string>();

    // 0. CLASS DOUBLE BOOKING (Two sessions in the same class at the same time)
    slotsList.forEach((s1) => {
      slotsList.forEach((s2) => {
        if (s1.id !== s2.id && s1.class_id === s2.class_id) {
          if (isSameSlotTime(s1.day_of_week, s1.start_time, s2.day_of_week, s2.start_time)) {
            const pairKey = [s1.id, s2.id].sort().join('___');
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey);
              const className = s1.class?.name || 'Classe';
              const dayName = MOROCCAN_SCHOOL_DAYS.find((d) => d.id === s1.day_of_week)?.name || 'Jour';
              const period = MOROCCAN_55MIN_PERIODS.find((p) => normalizeTime(p.start) === normalizeTime(s1.start_time));
              const timeLabel = period ? period.label : normalizeTime(s1.start_time);
              const subj1 = s1.subject?.name || 'Matière 1';
              const subj2 = s2.subject?.name || 'Matière 2';

              reports.push({
                id: `class_double_${pairKey}`,
                type: 'CLASS_DOUBLE_BOOKING',
                title: `Chevauchement de Cours : ${className}`,
                description: `Deux matières (${subj1} et ${subj2}) sont programmées en même temps dans la classe ${className} le ${dayName} (${timeLabel}).`,
                day_of_week: s1.day_of_week,
                dayName,
                start_time: s1.start_time,
                timeLabel,
                classes: [className],
                conflictingSlotIds: [s1.id, s2.id],
              });
            }
          }
        }
      });
    });

    // 1. TEACHER DOUBLE BOOKING (Teacher assigned in 2 different classes at the same time)
    slotsList.forEach((s1) => {
      if (!s1.teacher_id) return;
      slotsList.forEach((s2) => {
        if (s1.id !== s2.id && s1.teacher_id === s2.teacher_id) {
          if (isSameSlotTime(s1.day_of_week, s1.start_time, s2.day_of_week, s2.start_time)) {
            const pairKey = [s1.id, s2.id].sort().join('___');
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey);
              const teacher = teachersList.find((t) => t.id === s1.teacher_id) || s1.teacher;
              const teacherName = teacher ? `${teacher.first_name} ${teacher.last_name}` : 'Enseignant';
              const dayName = MOROCCAN_SCHOOL_DAYS.find((d) => d.id === s1.day_of_week)?.name || 'Jour';
              const period = MOROCCAN_55MIN_PERIODS.find((p) => normalizeTime(p.start) === normalizeTime(s1.start_time));
              const timeLabel = period ? period.label : normalizeTime(s1.start_time);
              const c1 = s1.class?.name || 'Classe 1';
              const c2 = s2.class?.name || 'Classe 2';

              reports.push({
                id: `teacher_double_${pairKey}`,
                type: 'TEACHER_DOUBLE_BOOKING',
                title: `Double-Séance Enseignant : ${teacherName}`,
                description: `${teacherName} est assigné(e) en même temps dans les classes ${c1} et ${c2}.`,
                day_of_week: s1.day_of_week,
                dayName,
                start_time: s1.start_time,
                timeLabel,
                classes: [c1, c2],
                teacherName,
                conflictingSlotIds: [s1.id, s2.id],
              });
            }
          }
        }
      });
    });

    // 2. ROOM DOUBLE BOOKING (Room occupied by multiple classes simultaneously)
    slotsList.forEach((s1) => {
      if (!s1.room_id) return;
      slotsList.forEach((s2) => {
        if (s1.id !== s2.id && s1.room_id === s2.room_id) {
          if (isSameSlotTime(s1.day_of_week, s1.start_time, s2.day_of_week, s2.start_time)) {
            const pairKey = [s1.id, s2.id].sort().join('___');
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey);
              const roomName = s1.room?.name || s1.room?.room_number || 'Salle';
              const dayName = MOROCCAN_SCHOOL_DAYS.find((d) => d.id === s1.day_of_week)?.name || 'Jour';
              const period = MOROCCAN_55MIN_PERIODS.find((p) => normalizeTime(p.start) === normalizeTime(s1.start_time));
              const timeLabel = period ? period.label : normalizeTime(s1.start_time);
              const c1 = s1.class?.name || 'Classe 1';
              const c2 = s2.class?.name || 'Classe 2';

              reports.push({
                id: `room_double_${pairKey}`,
                type: 'ROOM_DOUBLE_BOOKING',
                title: `Double-Occupation Salle : ${roomName}`,
                description: `La salle ${roomName} est occupée simultanément par ${c1} et ${c2} le ${dayName} (${timeLabel}).`,
                day_of_week: s1.day_of_week,
                dayName,
                start_time: s1.start_time,
                timeLabel,
                classes: [c1, c2],
                conflictingSlotIds: [s1.id, s2.id],
              });
            }
          }
        }
      });
    });

    // 3. EXCEEDING DAILY SUBJECT HOURS (Strict Hard Cap: Max 2 hours per subject per day for any class)
    classesList.forEach((cls) => {
      MOROCCAN_SCHOOL_DAYS.forEach((day) => {
        const classDaySlots = slotsList.filter((s) => s.class_id === cls.id && s.day_of_week === day.id);
        const subjectCountMap = new Map<string, TimetableSlot[]>();

        classDaySlots.forEach((s) => {
          const list = subjectCountMap.get(s.subject_id) || [];
          list.push(s);
          subjectCountMap.set(s.subject_id, list);
        });

        subjectCountMap.forEach((slotsForSubject, subjId) => {
          if (slotsForSubject.length > 2) {
            const subj = slotsForSubject[0].subject || subjects.find((s) => s.id === subjId);
            const subjName = subj?.name || 'Matière';
            reports.push({
              id: `excess_daily_${cls.id}_${day.id}_${subjId}`,
              type: 'EXCESS_DAILY_SUBJECT_HOURS',
              title: `Dépassement Quota Journalier : ${subjName}`,
              description: `La classe ${cls.name} a ${slotsForSubject.length} heures de ${subjName} le ${day.name}. Le maximum pédagogique autorisé est de 2 heures par jour.`,
              day_of_week: day.id,
              dayName: day.name,
              start_time: slotsForSubject[slotsForSubject.length - 1].start_time,
              timeLabel: `${slotsForSubject.length}h / jour (Max: 2h)`,
              classes: [cls.name],
              conflictingSlotIds: slotsForSubject.map((s) => s.id),
            });
          }
        });
      });
    });

    // 4. CLASS SCHEDULE HOLES / GAPS ACROSS FULL DAY (Heures Creuses Isolées dans la journée)
    classesList.forEach((cls) => {
      MOROCCAN_SCHOOL_DAYS.forEach((day) => {
        const classDaySlots = slotsList.filter((s) => s.class_id === cls.id && s.day_of_week === day.id);
        if (classDaySlots.length === 0) return;

        const dayPeriods = day.id === 5 ? MOROCCAN_55MIN_PERIODS.slice(0, 4) : MOROCCAN_55MIN_PERIODS;
        const periodOccupied = dayPeriods.map((p) =>
          classDaySlots.find((s) => normalizeTime(s.start_time) === normalizeTime(p.start))
        );

        const occupiedIndices = periodOccupied
          .map((s, idx) => (s ? idx : -1))
          .filter((idx) => idx !== -1);

        if (occupiedIndices.length > 0) {
          const minIdx = Math.min(...occupiedIndices);
          const maxIdx = Math.max(...occupiedIndices);

          for (let idx = minIdx; idx <= maxIdx; idx++) {
            if (!periodOccupied[idx]) {
              const emptyPeriod = dayPeriods[idx];
              reports.push({
                id: `gap_fullday_${cls.id}_${day.id}_${emptyPeriod.id}`,
                type: 'CLASS_SCHEDULE_HOLE',
                title: `Heure Creuse Isolée : ${cls.name}`,
                description: `La classe ${cls.name} a un créneau vide (${emptyPeriod.label}) le ${day.name} alors que des cours sont dispensés avant et après.`,
                day_of_week: day.id,
                dayName: day.name,
                start_time: emptyPeriod.start,
                timeLabel: emptyPeriod.label,
                classes: [cls.name],
                conflictingSlotIds: classDaySlots.map((s) => s.id),
              });
            }
          }
        }
      });
    });

    // 5. VACATAIRE PRESENCE CHECK
    slotsList.forEach((s) => {
      const teacher = teachersList.find((t) => t.id === s.teacher_id) || s.teacher;
      if (teacher && teacher.contract_type === 'VACATAIRE') {
        const period = MOROCCAN_55MIN_PERIODS.find((p) => normalizeTime(p.start) === normalizeTime(s.start_time));
        const isOk = isVacataireAvailable(teacher, s.day_of_week, period?.id || '', s.start_time);
        if (!isOk) {
          const dayName = MOROCCAN_SCHOOL_DAYS.find((d) => d.id === s.day_of_week)?.name || 'Jour';
          const timeLabel = period ? period.label : normalizeTime(s.start_time);
          reports.push({
            id: `vacataire_unavail_${s.id}`,
            type: 'VACATAIRE_UNAVAILABLE_SLOT',
            title: `Créneau Vacataire Non Déclaré : ${teacher.first_name} ${teacher.last_name}`,
            description: `L'enseignant vacataire ${teacher.first_name} ${teacher.last_name} est programmé le ${dayName} (${timeLabel}) hors de ses disponibilités déclarées.`,
            day_of_week: s.day_of_week,
            dayName,
            start_time: s.start_time,
            timeLabel,
            classes: [s.class?.name || 'Classe'],
            teacherName: `${teacher.first_name} ${teacher.last_name}`,
            conflictingSlotIds: [s.id],
          });
        }
      }
    });

    return reports;
  };

  const detectedConflicts: ConflictReport[] = useMemo(() => {
    return auditScheduleConflicts(slots, teachers, classes);
  }, [slots, teachers, classes]);

  // Robust Multi-Strategy Conflict Resolver (Free Open Slot, 2-Way Swap, 3-Way Cycle, & Global Relocation)
  const findConflictResolution = (
    conflictSlotIdA: string,
    conflictSlotIdB: string,
    currentSlots: TimetableSlot[],
    teachersList: Teacher[],
    pinnedIds: Set<string> = new Set()
  ): {
    slotToUpdate: TimetableSlot;
    newDay: number;
    newStart: string;
    newEnd: string;
    partnerSlotToUpdate?: TimetableSlot;
    partnerNewDay?: number;
    partnerNewStart?: string;
    partnerNewEnd?: string;
    thirdSlotToUpdate?: TimetableSlot;
    thirdNewDay?: number;
    thirdNewStart?: string;
    thirdNewEnd?: string;
  } | null => {
    const isPinnedA = pinnedIds.has(conflictSlotIdA);
    const isPinnedB = pinnedIds.has(conflictSlotIdB);

    // If one is pinned by user, prioritize moving the other!
    let candidateIds: string[];
    if (isPinnedA && !isPinnedB) {
      candidateIds = [conflictSlotIdB];
    } else if (isPinnedB && !isPinnedA) {
      candidateIds = [conflictSlotIdA];
    } else {
      candidateIds = [conflictSlotIdB, conflictSlotIdA];
    }

    const candidates = candidateIds
      .map((id) => currentSlots.find((s) => s.id === id))
      .filter(Boolean) as TimetableSlot[];

    for (const targetSlot of candidates) {
      const teacher = teachersList.find((t) => t.id === targetSlot.teacher_id) || targetSlot.teacher;
      const classId = targetSlot.class_id;

      // Strategy 1: Free open slot in the class schedule
      const freeAlt = findClosestAlternativeSlot(
        classId,
        teacher,
        currentSlots,
        [targetSlot.id],
        targetSlot.day_of_week,
        targetSlot.start_time
      );

      if (freeAlt) {
        return {
          slotToUpdate: targetSlot,
          newDay: freeAlt.dayId,
          newStart: freeAlt.period.start,
          newEnd: freeAlt.period.end,
        };
      }

      // Strategy 2: 1-Swap with another non-pinned slot in the SAME class
      const otherClassSlots = currentSlots.filter(
        (s) =>
          s.class_id === classId &&
          s.id !== targetSlot.id &&
          !pinnedIds.has(s.id) &&
          !(s.day_of_week === 5 && normalizeTime(s.start_time) >= '13:00')
      );

      for (const partnerSlot of otherClassSlots) {
        const partnerTeacher = teachersList.find((t) => t.id === partnerSlot.teacher_id) || partnerSlot.teacher;
        const partnerDay = partnerSlot.day_of_week;
        const partnerStart = partnerSlot.start_time;
        const partnerEnd = partnerSlot.end_time;
        const targetDay = targetSlot.day_of_week;
        const targetStart = targetSlot.start_time;
        const targetEnd = targetSlot.end_time;

        // 1. Is target teacher free at partner's time?
        const isTargetTeacherBusyAtPartnerTime = currentSlots.some(
          (s) =>
            s.id !== targetSlot.id &&
            s.id !== partnerSlot.id &&
            s.teacher_id === targetSlot.teacher_id &&
            isSameSlotTime(s.day_of_week, s.start_time, partnerDay, partnerStart)
        );
        if (isTargetTeacherBusyAtPartnerTime) continue;

        // 2. Is partner teacher free at target's time?
        const isPartnerTeacherBusyAtTargetTime = currentSlots.some(
          (s) =>
            s.id !== targetSlot.id &&
            s.id !== partnerSlot.id &&
            s.teacher_id === partnerSlot.teacher_id &&
            isSameSlotTime(s.day_of_week, s.start_time, targetDay, targetStart)
        );
        if (isPartnerTeacherBusyAtTargetTime) continue;

        // 3. Vacataire checks
        const pPeriod = MOROCCAN_55MIN_PERIODS.find((p) => normalizeTime(p.start) === normalizeTime(partnerStart));
        const tPeriod = MOROCCAN_55MIN_PERIODS.find((p) => normalizeTime(p.start) === normalizeTime(targetStart));
        if (pPeriod && !isVacataireAvailable(teacher, partnerDay, pPeriod.id, pPeriod.start)) continue;
        if (tPeriod && !isVacataireAvailable(partnerTeacher, targetDay, tPeriod.id, tPeriod.start)) continue;

        // Valid 2-Way Swap found!
        return {
          slotToUpdate: targetSlot,
          newDay: partnerDay,
          newStart: partnerStart,
          newEnd: partnerEnd,
          partnerSlotToUpdate: partnerSlot,
          partnerNewDay: targetDay,
          partnerNewStart: targetStart,
          partnerNewEnd: targetEnd,
        };
      }

      // Strategy 3: 3-Way Kempe Permutation Cycle (target -> P1 -> P2 -> target)
      for (const p1 of otherClassSlots) {
        const t1 = teachersList.find((t) => t.id === p1.teacher_id) || p1.teacher;
        const isTargetFreeAtP1 = !currentSlots.some(
          (s) =>
            s.id !== targetSlot.id &&
            s.id !== p1.id &&
            s.teacher_id === targetSlot.teacher_id &&
            isSameSlotTime(s.day_of_week, s.start_time, p1.day_of_week, p1.start_time)
        );
        if (!isTargetFreeAtP1) continue;

        for (const p2 of otherClassSlots) {
          if (p2.id === p1.id) continue;
          const t2 = teachersList.find((t) => t.id === p2.teacher_id) || p2.teacher;

          // t1 must be free at p2's slot
          const isT1FreeAtP2 = !currentSlots.some(
            (s) =>
              s.id !== p1.id &&
              s.id !== p2.id &&
              s.teacher_id === p1.teacher_id &&
              isSameSlotTime(s.day_of_week, s.start_time, p2.day_of_week, p2.start_time)
          );
          if (!isT1FreeAtP2) continue;

          // t2 must be free at target's original slot
          const isT2FreeAtTarget = !currentSlots.some(
            (s) =>
              s.id !== p2.id &&
              s.id !== targetSlot.id &&
              s.teacher_id === p2.teacher_id &&
              isSameSlotTime(s.day_of_week, s.start_time, targetSlot.day_of_week, targetSlot.start_time)
          );
          if (!isT2FreeAtTarget) continue;

          if (!isVacataireAvailable(teacher, p1.day_of_week, '', p1.start_time)) continue;
          if (!isVacataireAvailable(t1, p2.day_of_week, '', p2.start_time)) continue;
          if (!isVacataireAvailable(t2, targetSlot.day_of_week, '', targetSlot.start_time)) continue;

          // 3-Way Cycle Found!
          return {
            slotToUpdate: targetSlot,
            newDay: p1.day_of_week,
            newStart: p1.start_time,
            newEnd: p1.end_time,
            partnerSlotToUpdate: p1,
            partnerNewDay: p2.day_of_week,
            partnerNewStart: p2.start_time,
            partnerNewEnd: p2.end_time,
            thirdSlotToUpdate: p2,
            thirdNewDay: targetSlot.day_of_week,
            thirdNewStart: targetSlot.start_time,
            thirdNewEnd: targetSlot.end_time,
          };
        }
      }

      // Strategy 4: Global Free Slot Cascade Relocation
      // Find ANY day & period across the entire week where targetTeacher is completely free
      for (const day of MOROCCAN_SCHOOL_DAYS) {
        const periods = day.id === 5 ? MOROCCAN_55MIN_PERIODS.slice(0, 4) : MOROCCAN_55MIN_PERIODS;
        for (const p of periods) {
          const isTargetTeacherFree = !currentSlots.some(
            (s) =>
              s.id !== targetSlot.id &&
              s.teacher_id === targetSlot.teacher_id &&
              isSameSlotTime(s.day_of_week, s.start_time, day.id, p.start)
          );
          if (!isTargetTeacherFree) continue;
          if (!isVacataireAvailable(teacher, day.id, p.id, p.start)) continue;

          // Check who is in this class at (day, p.start)
          const occupantInClass = currentSlots.find(
            (s) =>
              s.id !== targetSlot.id &&
              s.class_id === classId &&
              isSameSlotTime(s.day_of_week, s.start_time, day.id, p.start)
          );

          if (!occupantInClass) {
            // Free slot in class!
            return {
              slotToUpdate: targetSlot,
              newDay: day.id,
              newStart: p.start,
              newEnd: p.end,
            };
          }

          if (pinnedIds.has(occupantInClass.id)) continue;
          const occTeacher = teachersList.find((t) => t.id === occupantInClass.teacher_id) || occupantInClass.teacher;

          // Can occupantInClass go to target's slot?
          const isOccFreeAtTarget = !currentSlots.some(
            (s) =>
              s.id !== occupantInClass.id &&
              s.id !== targetSlot.id &&
              s.teacher_id === occupantInClass.teacher_id &&
              isSameSlotTime(s.day_of_week, s.start_time, targetSlot.day_of_week, targetSlot.start_time)
          );

          if (isOccFreeAtTarget && isVacataireAvailable(occTeacher, targetSlot.day_of_week, '', targetSlot.start_time)) {
            return {
              slotToUpdate: targetSlot,
              newDay: day.id,
              newStart: p.start,
              newEnd: p.end,
              partnerSlotToUpdate: occupantInClass,
              partnerNewDay: targetSlot.day_of_week,
              partnerNewStart: targetSlot.start_time,
              partnerNewEnd: targetSlot.end_time,
            };
          }
        }
      }
    }

    return null;
  };

  // Iterative Auto-Conflict Solver (Runs in a loop up to 10 attempts until 0 conflicts remain!)
  const handleAutoFixAllConflicts = async () => {
    if (detectedConflicts.length === 0) return;
    setIsAutoFixing(true);
    try {
      const supabase = createClient();
      let currentSlotsState = [...slots];
      const updatedMap = new Map<string, { id: string; day_of_week: number; start_time: string; end_time: string }>();

      const MAX_ATTEMPTS = 10;
      let attempt = 0;
      let resolvedCleanly = false;

      while (attempt < MAX_ATTEMPTS) {
        attempt++;

        // Audit remaining conflicts at this iteration
        const activeConflicts = auditScheduleConflicts(currentSlotsState, teachers, classes);
        if (activeConflicts.length === 0) {
          resolvedCleanly = true;
          break;
        }

        let changesInThisPass = 0;

        // =========================================================================
        // PASS 0: RESOLVE CLASS DOUBLE BOOKINGS (Same class overlapping at same time)
        // =========================================================================
        const classDoubleBookingConflicts = activeConflicts.filter((c) => c.type === 'CLASS_DOUBLE_BOOKING');
        for (const conflict of classDoubleBookingConflicts) {
          if (conflict.conflictingSlotIds.length >= 2) {
            const slotA = currentSlotsState.find((s) => s.id === conflict.conflictingSlotIds[0]);
            const slotB = currentSlotsState.find((s) => s.id === conflict.conflictingSlotIds[1]);
            if (!slotA || !slotB) continue;

            const isPinnedA = pinnedSlotIds.has(slotA.id);
            const isPinnedB = pinnedSlotIds.has(slotB.id);

            let candidates: TimetableSlot[];
            if (isPinnedA && !isPinnedB) {
              candidates = [slotB];
            } else if (isPinnedB && !isPinnedA) {
              candidates = [slotA];
            } else {
              candidates = [slotB, slotA];
            }

            const classId = slotA.class_id;
            let resolved = false;

            for (const cand of candidates) {
              if (resolved) break;
              const candTeacher = teachers.find((t) => t.id === cand.teacher_id) || cand.teacher;

              // Strategy A: Move into an empty slot (or an existing schedule hole in this class!)
              for (const day of MOROCCAN_SCHOOL_DAYS) {
                if (resolved) break;
                const periods = day.id === 5 ? MOROCCAN_55MIN_PERIODS.slice(0, 4) : MOROCCAN_55MIN_PERIODS;
                for (const p of periods) {
                  const isClassSlotFree = !currentSlotsState.some(
                    (s) =>
                      s.id !== cand.id &&
                      s.class_id === classId &&
                      s.day_of_week === day.id &&
                      normalizeTime(s.start_time) === normalizeTime(p.start)
                  );
                  const isTeacherFree = !currentSlotsState.some(
                    (s) =>
                      s.id !== cand.id &&
                      s.teacher_id === cand.teacher_id &&
                      s.day_of_week === day.id &&
                      normalizeTime(s.start_time) === normalizeTime(p.start)
                  );
                  const isVacOk = candTeacher ? isVacataireAvailable(candTeacher, day.id, p.id, p.start) : true;

                  if (isClassSlotFree && isTeacherFree && isVacOk) {
                    updatedMap.set(cand.id, {
                      id: cand.id,
                      day_of_week: day.id,
                      start_time: p.start,
                      end_time: p.end,
                    });

                    currentSlotsState = currentSlotsState.map((s) =>
                      s.id === cand.id
                        ? { ...s, day_of_week: day.id, start_time: p.start, end_time: p.end }
                        : s
                    );
                    resolved = true;
                    changesInThisPass++;
                    break;
                  }
                }
              }

              // Strategy B: 1-Swap with another non-pinned slot in the SAME class
              if (!resolved) {
                const otherClassSlots = currentSlotsState.filter(
                  (s) =>
                    s.class_id === classId &&
                    s.id !== slotA.id &&
                    s.id !== slotB.id &&
                    !pinnedSlotIds.has(s.id) &&
                    !(s.day_of_week === 5 && normalizeTime(s.start_time) >= '13:00')
                );

                for (const partnerSlot of otherClassSlots) {
                  const partnerTeacher = teachers.find((t) => t.id === partnerSlot.teacher_id) || partnerSlot.teacher;
                  const pDay = partnerSlot.day_of_week;
                  const pStart = partnerSlot.start_time;
                  const pEnd = partnerSlot.end_time;
                  const origDay = cand.day_of_week;
                  const origStart = cand.start_time;
                  const origEnd = cand.end_time;

                  const isCandTeacherFreeAtPartner = !currentSlotsState.some(
                    (s) =>
                      s.id !== cand.id &&
                      s.id !== partnerSlot.id &&
                      s.teacher_id === cand.teacher_id &&
                      s.day_of_week === pDay &&
                      normalizeTime(s.start_time) === normalizeTime(pStart)
                  );

                  const isPartnerTeacherFreeAtOrig = !currentSlotsState.some(
                    (s) =>
                      s.id !== cand.id &&
                      s.id !== partnerSlot.id &&
                      s.teacher_id === partnerSlot.teacher_id &&
                      s.day_of_week === origDay &&
                      normalizeTime(s.start_time) === normalizeTime(origStart)
                  );

                  const isCandVacOk = candTeacher ? isVacataireAvailable(candTeacher, pDay, '', pStart) : true;
                  const isPartnerVacOk = partnerTeacher ? isVacataireAvailable(partnerTeacher, origDay, '', origStart) : true;

                  if (isCandTeacherFreeAtPartner && isPartnerTeacherFreeAtOrig && isCandVacOk && isPartnerVacOk) {
                    updatedMap.set(cand.id, {
                      id: cand.id,
                      day_of_week: pDay,
                      start_time: pStart,
                      end_time: pEnd,
                    });
                    updatedMap.set(partnerSlot.id, {
                      id: partnerSlot.id,
                      day_of_week: origDay,
                      start_time: origStart,
                      end_time: origEnd,
                    });

                    currentSlotsState = currentSlotsState.map((s) => {
                      if (s.id === cand.id) return { ...s, day_of_week: pDay, start_time: pStart, end_time: pEnd };
                      if (s.id === partnerSlot.id) return { ...s, day_of_week: origDay, start_time: origStart, end_time: origEnd };
                      return s;
                    });

                    resolved = true;
                    changesInThisPass++;
                    break;
                  }
                }
              }
            }
          }
        }

        // =========================================================================
        // PASS 1: RESOLVE TEACHER DOUBLE BOOKINGS
        // =========================================================================
        const doubleBookingConflicts = activeConflicts.filter((c) => c.type === 'TEACHER_DOUBLE_BOOKING');
        for (const conflict of doubleBookingConflicts) {
          if (conflict.conflictingSlotIds.length >= 2) {
            const resolution = findConflictResolution(
              conflict.conflictingSlotIds[0],
              conflict.conflictingSlotIds[1],
              currentSlotsState,
              teachers,
              pinnedSlotIds
            );

            if (resolution) {
              updatedMap.set(resolution.slotToUpdate.id, {
                id: resolution.slotToUpdate.id,
                day_of_week: Number(resolution.newDay),
                start_time: resolution.newStart,
                end_time: resolution.newEnd,
              });

              currentSlotsState = currentSlotsState.map((s) =>
                s.id === resolution.slotToUpdate.id
                  ? {
                      ...s,
                      day_of_week: Number(resolution.newDay),
                      start_time: resolution.newStart,
                      end_time: resolution.newEnd,
                    }
                  : s
              );

              if (
                resolution.partnerSlotToUpdate &&
                resolution.partnerNewDay &&
                resolution.partnerNewStart &&
                resolution.partnerNewEnd
              ) {
                updatedMap.set(resolution.partnerSlotToUpdate.id, {
                  id: resolution.partnerSlotToUpdate.id,
                  day_of_week: Number(resolution.partnerNewDay),
                  start_time: resolution.partnerNewStart,
                  end_time: resolution.partnerNewEnd,
                });

                currentSlotsState = currentSlotsState.map((s) =>
                  s.id === resolution.partnerSlotToUpdate!.id
                    ? {
                        ...s,
                        day_of_week: Number(resolution.partnerNewDay),
                        start_time: resolution.partnerNewStart!,
                        end_time: resolution.partnerNewEnd!,
                      }
                    : s
                );
              }

              if (
                resolution.thirdSlotToUpdate &&
                resolution.thirdNewDay &&
                resolution.thirdNewStart &&
                resolution.thirdNewEnd
              ) {
                updatedMap.set(resolution.thirdSlotToUpdate.id, {
                  id: resolution.thirdSlotToUpdate.id,
                  day_of_week: Number(resolution.thirdNewDay),
                  start_time: resolution.thirdNewStart,
                  end_time: resolution.thirdNewEnd,
                });

                currentSlotsState = currentSlotsState.map((s) =>
                  s.id === resolution.thirdSlotToUpdate!.id
                    ? {
                        ...s,
                        day_of_week: Number(resolution.thirdNewDay),
                        start_time: resolution.thirdNewStart!,
                        end_time: resolution.thirdNewEnd!,
                      }
                    : s
                );
              }
              changesInThisPass++;
            } else {
              // Secondary Solver: Try swapping with any non-pinned slot in either conflicting class
              const isPinned0 = pinnedSlotIds.has(conflict.conflictingSlotIds[0]);
              const isPinned1 = pinnedSlotIds.has(conflict.conflictingSlotIds[1]);

              let slotsToTryIds: string[];
              if (isPinned0 && !isPinned1) {
                slotsToTryIds = [conflict.conflictingSlotIds[1]];
              } else if (isPinned1 && !isPinned0) {
                slotsToTryIds = [conflict.conflictingSlotIds[0]];
              } else {
                slotsToTryIds = [conflict.conflictingSlotIds[1], conflict.conflictingSlotIds[0]];
              }

              const slotsToTry = slotsToTryIds
                .map((id) => currentSlotsState.find((s) => s.id === id))
                .filter(Boolean) as TimetableSlot[];

              for (const candSlot of slotsToTry) {
                const candClassId = candSlot.class_id;
                const candTeacher = teachers.find((t) => t.id === candSlot.teacher_id) || candSlot.teacher;

                const otherClassSlots = currentSlotsState.filter(
                  (s) =>
                    s.class_id === candClassId &&
                    s.id !== candSlot.id &&
                    !pinnedSlotIds.has(s.id) &&
                    !(s.day_of_week === 5 && normalizeTime(s.start_time) >= '13:00')
                );

                let swapResolved = false;
                for (const partnerSlot of otherClassSlots) {
                  const partnerTeacher = teachers.find((t) => t.id === partnerSlot.teacher_id) || partnerSlot.teacher;
                  const pDay = partnerSlot.day_of_week;
                  const pStart = partnerSlot.start_time;
                  const pEnd = partnerSlot.end_time;
                  const origDay = candSlot.day_of_week;
                  const origStart = candSlot.start_time;
                  const origEnd = candSlot.end_time;

                  const isCandTeacherFreeAtPartner = !currentSlotsState.some(
                    (s) =>
                      s.id !== candSlot.id &&
                      s.id !== partnerSlot.id &&
                      s.teacher_id === candSlot.teacher_id &&
                      s.day_of_week === pDay &&
                      normalizeTime(s.start_time) === normalizeTime(pStart)
                  );

                  const isPartnerTeacherFreeAtOrig = !currentSlotsState.some(
                    (s) =>
                      s.id !== candSlot.id &&
                      s.id !== partnerSlot.id &&
                      s.teacher_id === partnerSlot.teacher_id &&
                      s.day_of_week === origDay &&
                      normalizeTime(s.start_time) === normalizeTime(origStart)
                  );

                  const isCandVacOk = candTeacher ? isVacataireAvailable(candTeacher, pDay, '', pStart) : true;
                  const isPartnerVacOk = partnerTeacher ? isVacataireAvailable(partnerTeacher, origDay, '', origStart) : true;

                  if (isCandTeacherFreeAtPartner && isPartnerTeacherFreeAtOrig && isCandVacOk && isPartnerVacOk) {
                    updatedMap.set(candSlot.id, {
                      id: candSlot.id,
                      day_of_week: pDay,
                      start_time: pStart,
                      end_time: pEnd,
                    });
                    updatedMap.set(partnerSlot.id, {
                      id: partnerSlot.id,
                      day_of_week: origDay,
                      start_time: origStart,
                      end_time: origEnd,
                    });

                    currentSlotsState = currentSlotsState.map((s) => {
                      if (s.id === candSlot.id) return { ...s, day_of_week: pDay, start_time: pStart, end_time: pEnd };
                      if (s.id === partnerSlot.id) return { ...s, day_of_week: origDay, start_time: origStart, end_time: origEnd };
                      return s;
                    });

                    swapResolved = true;
                    changesInThisPass++;
                    break;
                  }
                }
                if (swapResolved) break;
              }
            }
          }
        }

        // =========================================================================
        // PASS 1.5: RESOLVE EXCESS DAILY SUBJECT HOURS (>2h/day for a single subject)
        // =========================================================================
        const excessDailyConflicts = activeConflicts.filter((c) => c.type === 'EXCESS_DAILY_SUBJECT_HOURS');
        for (const conflict of excessDailyConflicts) {
          const slotToMoveId = conflict.conflictingSlotIds[conflict.conflictingSlotIds.length - 1];
          const targetSlot = currentSlotsState.find((s) => s.id === slotToMoveId && !pinnedSlotIds.has(s.id));
          if (!targetSlot) continue;

          const teacher = teachers.find((t) => t.id === targetSlot.teacher_id) || targetSlot.teacher;
          const classId = targetSlot.class_id;

          // Find candidate slots on other days where subject count < 2
          let candidateTarget: { dayId: number; period: PeriodSlot } | null = null;
          for (let d = 1; d <= 5; d++) {
            if (d === targetSlot.day_of_week) continue;

            const existingCountOnDay = currentSlotsState.filter(
              (s) => s.class_id === classId && s.day_of_week === d && s.subject_id === targetSlot.subject_id
            ).length;
            if (existingCountOnDay >= 2) continue;

            const periodsToCheck = d === 5 ? MOROCCAN_55MIN_PERIODS.slice(0, 4) : MOROCCAN_55MIN_PERIODS;
            for (const period of periodsToCheck) {
              const classFree = !currentSlotsState.some(
                (s) => s.class_id === classId && s.day_of_week === d && normalizeTime(s.start_time) === normalizeTime(period.start)
              );
              if (!classFree) continue;

              const teacherFree = !currentSlotsState.some(
                (s) => s.teacher_id === targetSlot.teacher_id && s.day_of_week === d && normalizeTime(s.start_time) === normalizeTime(period.start)
              );
              if (!teacherFree) continue;

              const vacOk = teacher ? isVacataireAvailable(teacher, d, period.id, period.start) : true;
              if (!vacOk) continue;

              candidateTarget = { dayId: d, period };
              break;
            }
            if (candidateTarget) break;
          }

          if (candidateTarget) {
            updatedMap.set(targetSlot.id, {
              id: targetSlot.id,
              day_of_week: candidateTarget.dayId,
              start_time: candidateTarget.period.start,
              end_time: candidateTarget.period.end,
            });
            currentSlotsState = currentSlotsState.map((s) =>
              s.id === targetSlot.id
                ? { ...s, day_of_week: candidateTarget!.dayId, start_time: candidateTarget!.period.start, end_time: candidateTarget!.period.end }
                : s
            );
            changesInThisPass++;
          }
        }

        // =========================================================================
        // PASS 2: COMPACT & ELIMINATE ALL CLASS SCHEDULE GAPS (Trous / Sawaye3 Khawyin)
        // =========================================================================
        classes.forEach((cls) => {
          MOROCCAN_SCHOOL_DAYS.forEach((day) => {
            // 1. Compact Morning (P1 -> P2 -> P3 -> P4)
            const morningPeriods = MOROCCAN_55MIN_PERIODS.slice(0, 4);
            for (let pIdx = 0; pIdx < morningPeriods.length; pIdx++) {
              const expectedPeriod = morningPeriods[pIdx];
              const slotAtExpected = currentSlotsState.find(
                (s) =>
                  s.class_id === cls.id &&
                  s.day_of_week === day.id &&
                  normalizeTime(s.start_time) === normalizeTime(expectedPeriod.start)
              );

              if (!slotAtExpected) {
                const laterSlot = currentSlotsState.find((s) => {
                  if (s.class_id !== cls.id || s.day_of_week !== day.id) return false;
                  if (pinnedSlotIds.has(s.id)) return false; // Never move a user-pinned slot away!
                  const sIdx = morningPeriods.findIndex(
                    (p) => normalizeTime(p.start) === normalizeTime(s.start_time)
                  );
                  return sIdx > pIdx;
                });

                if (laterSlot) {
                  const teacher = teachers.find((t) => t.id === laterSlot.teacher_id) || laterSlot.teacher;
                  const isTeacherBusyAtExpected = currentSlotsState.some(
                    (s) =>
                      s.id !== laterSlot.id &&
                      s.teacher_id === laterSlot.teacher_id &&
                      s.day_of_week === day.id &&
                      normalizeTime(s.start_time) === normalizeTime(expectedPeriod.start)
                  );
                  const isVacOk = teacher
                    ? isVacataireAvailable(teacher, day.id, expectedPeriod.id, expectedPeriod.start)
                    : true;

                  if (!isTeacherBusyAtExpected && isVacOk) {
                    updatedMap.set(laterSlot.id, {
                      id: laterSlot.id,
                      day_of_week: day.id,
                      start_time: expectedPeriod.start,
                      end_time: expectedPeriod.end,
                    });

                    currentSlotsState = currentSlotsState.map((s) =>
                      s.id === laterSlot.id
                        ? {
                            ...s,
                            day_of_week: day.id,
                            start_time: expectedPeriod.start,
                            end_time: expectedPeriod.end,
                          }
                        : s
                    );

                    changesInThisPass++;
                    continue;
                  }
                }

                const anySwappableSlot = currentSlotsState.find((s) => {
                  if (s.class_id !== cls.id) return false;
                  if (pinnedSlotIds.has(s.id)) return false; // Protect pinned slot
                  const sTeacher = teachers.find((t) => t.id === s.teacher_id) || s.teacher;
                  const isTeacherBusyAtExpected = currentSlotsState.some(
                    (other) =>
                      other.id !== s.id &&
                      other.teacher_id === s.teacher_id &&
                      other.day_of_week === day.id &&
                      normalizeTime(other.start_time) === normalizeTime(expectedPeriod.start)
                  );
                  const isVacOk = sTeacher ? isVacataireAvailable(sTeacher, day.id, expectedPeriod.id, expectedPeriod.start) : true;
                  return !isTeacherBusyAtExpected && isVacOk;
                });

                if (anySwappableSlot && (anySwappableSlot.day_of_week !== day.id || normalizeTime(anySwappableSlot.start_time) !== normalizeTime(expectedPeriod.start))) {
                  updatedMap.set(anySwappableSlot.id, {
                    id: anySwappableSlot.id,
                    day_of_week: day.id,
                    start_time: expectedPeriod.start,
                    end_time: expectedPeriod.end,
                  });

                  currentSlotsState = currentSlotsState.map((s) =>
                    s.id === anySwappableSlot.id
                      ? {
                          ...s,
                          day_of_week: day.id,
                          start_time: expectedPeriod.start,
                          end_time: expectedPeriod.end,
                        }
                      : s
                  );

                  changesInThisPass++;
                }
              }
            }

            // 2. Compact Afternoon (P5 -> P6 -> P7 for Mon-Thu)
            if (day.id !== 5) {
              const afternoonPeriods = MOROCCAN_55MIN_PERIODS.slice(4);
              for (let pIdx = 0; pIdx < afternoonPeriods.length; pIdx++) {
                const expectedPeriod = afternoonPeriods[pIdx];
                const slotAtExpected = currentSlotsState.find(
                  (s) =>
                    s.class_id === cls.id &&
                    s.day_of_week === day.id &&
                    normalizeTime(s.start_time) === normalizeTime(expectedPeriod.start)
                );

                if (!slotAtExpected) {
                  const laterSlot = currentSlotsState.find((s) => {
                    if (s.class_id !== cls.id || s.day_of_week !== day.id) return false;
                    if (pinnedSlotIds.has(s.id)) return false; // Protect pinned slot
                    const sIdx = afternoonPeriods.findIndex(
                      (p) => normalizeTime(p.start) === normalizeTime(s.start_time)
                    );
                    return sIdx > pIdx;
                  });

                  if (laterSlot) {
                    const teacher = teachers.find((t) => t.id === laterSlot.teacher_id) || laterSlot.teacher;
                    const isTeacherBusyAtExpected = currentSlotsState.some(
                      (s) =>
                        s.id !== laterSlot.id &&
                        s.teacher_id === laterSlot.teacher_id &&
                        s.day_of_week === day.id &&
                        normalizeTime(s.start_time) === normalizeTime(expectedPeriod.start)
                    );
                    const isVacOk = teacher
                      ? isVacataireAvailable(teacher, day.id, expectedPeriod.id, expectedPeriod.start)
                      : true;

                    if (!isTeacherBusyAtExpected && isVacOk) {
                      updatedMap.set(laterSlot.id, {
                        id: laterSlot.id,
                        day_of_week: day.id,
                        start_time: expectedPeriod.start,
                        end_time: expectedPeriod.end,
                      });

                      currentSlotsState = currentSlotsState.map((s) =>
                        s.id === laterSlot.id
                          ? {
                              ...s,
                              day_of_week: day.id,
                              start_time: expectedPeriod.start,
                              end_time: expectedPeriod.end,
                            }
                          : s
                      );

                      changesInThisPass++;
                      continue;
                    }
                  }

                  const anyOtherSlot = currentSlotsState.find((s) => {
                    if (s.class_id !== cls.id) return false;
                    if (pinnedSlotIds.has(s.id)) return false; // Protect pinned slot
                    const sTeacher = teachers.find((t) => t.id === s.teacher_id) || s.teacher;
                    const isTeacherBusyAtExpected = currentSlotsState.some(
                      (other) =>
                        other.id !== s.id &&
                        other.teacher_id === s.teacher_id &&
                        other.day_of_week === day.id &&
                        normalizeTime(other.start_time) === normalizeTime(expectedPeriod.start)
                    );
                    const isVacOk = sTeacher ? isVacataireAvailable(sTeacher, day.id, expectedPeriod.id, expectedPeriod.start) : true;
                    return !isTeacherBusyAtExpected && isVacOk;
                  });

                  if (anyOtherSlot && (anyOtherSlot.day_of_week !== day.id || normalizeTime(anyOtherSlot.start_time) !== normalizeTime(expectedPeriod.start))) {
                    updatedMap.set(anyOtherSlot.id, {
                      id: anyOtherSlot.id,
                      day_of_week: day.id,
                      start_time: expectedPeriod.start,
                      end_time: expectedPeriod.end,
                    });

                    currentSlotsState = currentSlotsState.map((s) =>
                      s.id === anyOtherSlot.id
                        ? { ...s, day_of_week: day.id, start_time: expectedPeriod.start, end_time: expectedPeriod.end }
                        : s
                    );

                    changesInThisPass++;
                  }
                }
              }
            }
          });
        });

        // If no changes occurred in this pass and conflicts remain, break to avoid infinite loop
        if (changesInThisPass === 0) {
          break;
        }
      }

      // Check final state
      const finalConflicts = auditScheduleConflicts(currentSlotsState, teachers, classes);
      const updatesToPersist = Array.from(updatedMap.values());

      if (updatesToPersist.length > 0) {
        // Optimistic UI update
        setSlots(currentSlotsState);

        // Batch Persist to Supabase Database
        const results = await Promise.all(
          updatesToPersist.map((u) =>
            supabase
              .from('timetable_slots')
              .update({
                day_of_week: u.day_of_week,
                start_time: u.start_time,
                end_time: u.end_time,
              })
              .eq('id', u.id)
          )
        );

        const hasDbErrors = results.some((r) => r.error);
        if (hasDbErrors) {
          console.warn('Some slot updates returned error, reloading fresh data');
        }

        logAuditEvent({
          action: 'TIMETABLE_AUTO_FIX_APPLIED',
          entity_type: 'timetable_slots',
          details: {
            resolvedCount: updatesToPersist.length,
            attemptsCount: attempt,
            conflictsRemaining: finalConflicts.length,
          },
        });

        if (finalConflicts.length === 0) {
          notify({
            title: 'Emploi du Temps 100% Réorganisé & Sans Aucun Conflit !',
            message: `Résolu avec succès en ${attempt} tentative(s). ${updatesToPersist.length} séance(s) réorganisées. 0 conflit restant.`,
            type: 'success',
          });
        } else {
          notify({
            title: 'Réorganisation Partielle Appliquée',
            message: `${updatesToPersist.length} séance(s) réorganisées en ${attempt} tentative(s). Il reste ${finalConflicts.length} conflit(s) nécessitant un arbitrage manuel.`,
            type: 'info',
          });
        }
      } else {
        notify({
          title: 'Information',
          message: 'Toutes les séances ont déjà été vérifiées et sont conformes.',
          type: 'info',
        });
      }

      await loadData();
      setShowConflictModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la résolution automatique';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
      await loadData();
    } finally {
      setIsAutoFixing(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, slot: TimetableSlot) => {
    draggedSlotRef.current = slot;
    setDraggedSlot(slot);
    try {
      e.dataTransfer.setData('text/plain', slot.id);
      e.dataTransfer.effectAllowed = 'move';
    } catch {
      // ignore
    }
  };

  const handleDragOver = (e: React.DragEvent, dayId: number, start: string) => {
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = 'move';
    } catch {
      // ignore
    }
    if (!dragOverCell || Number(dragOverCell.day) !== Number(dayId) || normalizeTime(dragOverCell.start) !== normalizeTime(start)) {
      setDragOverCell({ day: dayId, start });
    }
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  // Execute database move / swap / smart displacement
  const executeMoveOrSwap = async (
    currentDragged: TimetableSlot,
    targetDayId: number,
    targetPeriod: PeriodSlot,
    targetSlot: TimetableSlot | undefined,
    alternativeTargetSlot?: { dayId: number; period: PeriodSlot }
  ) => {
    const origDay = currentDragged.day_of_week;
    const origStart = currentDragged.start_time;
    const origEnd = currentDragged.end_time;

    // 1. Any slot currently in THIS class at (targetDayId, targetPeriod)
    const slotInThisClassAtTarget = slots.find(
      (s) =>
        s.id !== currentDragged.id &&
        s.class_id === currentDragged.class_id &&
        isSameSlotTime(s.day_of_week, s.start_time, targetDayId, targetPeriod.start)
    );

    // 2. Any slot for currentDragged.teacher in ANOTHER class at (targetDayId, targetPeriod)
    const draggedTeacherConflictInOtherClass = slots.find(
      (s) =>
        s.id !== currentDragged.id &&
        s.teacher_id === currentDragged.teacher_id &&
        s.class_id !== currentDragged.class_id &&
        isSameSlotTime(s.day_of_week, s.start_time, targetDayId, targetPeriod.start)
    );

    // 3. Any slot for displaced target teacher in ANOTHER class at (origDay, origStart)
    const displacedTargetTeacher = slotInThisClassAtTarget
      ? teachers.find((t) => t.id === slotInThisClassAtTarget.teacher_id) || slotInThisClassAtTarget.teacher
      : undefined;

    const displacedTeacherConflictInOtherClass = slotInThisClassAtTarget
      ? slots.find(
          (s) =>
            s.id !== currentDragged.id &&
            s.id !== slotInThisClassAtTarget.id &&
            s.teacher_id === slotInThisClassAtTarget.teacher_id &&
            s.class_id !== slotInThisClassAtTarget.class_id &&
            isSameSlotTime(s.day_of_week, s.start_time, origDay, origStart)
        )
      : undefined;

    const updatesToRun: { id: string; day_of_week: number; start_time: string; end_time: string }[] = [];

    // A. currentDragged moves to (targetDayId, targetPeriod) in THIS class -> Hadi khasha ta3mar!
    updatesToRun.push({
      id: currentDragged.id,
      day_of_week: Number(targetDayId),
      start_time: targetPeriod.start,
      end_time: targetPeriod.end,
    });

    // B. slotInThisClassAtTarget ALWAYS moves to (origDay, origStart) in THIS class -> Hadi ta3mar w ma tb9ach khawya!
    if (slotInThisClassAtTarget) {
      updatesToRun.push({
        id: slotInThisClassAtTarget.id,
        day_of_week: Number(origDay),
        start_time: origStart,
        end_time: origEnd,
      });
    }

    // C. If displaced teacher has a conflict in ANOTHER class at (origDay, origStart) -> sa3a tania f la classe l-okhra hiya litbadel l a9rab sa3a khawya!
    if (displacedTeacherConflictInOtherClass) {
      const altForDisplacedOther = alternativeTargetSlot || findClosestAlternativeSlot(
        displacedTeacherConflictInOtherClass.class_id,
        displacedTargetTeacher,
        slots,
        [currentDragged.id, slotInThisClassAtTarget!.id, displacedTeacherConflictInOtherClass.id],
        origDay,
        origStart
      );

      if (altForDisplacedOther) {
        updatesToRun.push({
          id: displacedTeacherConflictInOtherClass.id,
          day_of_week: Number(altForDisplacedOther.dayId),
          start_time: altForDisplacedOther.period.start,
          end_time: altForDisplacedOther.period.end,
        });
      }
    }

    // D. If dragged teacher has a conflict in ANOTHER class at (targetDayId, targetPeriod) -> sa3a tania f la classe l-okhra hiya litbadel l a9rab sa3a khawya!
    if (draggedTeacherConflictInOtherClass) {
      const altForDraggedOther = alternativeTargetSlot || findClosestAlternativeSlot(
        draggedTeacherConflictInOtherClass.class_id,
        teachers.find((t) => t.id === draggedTeacherConflictInOtherClass.teacher_id),
        slots,
        [currentDragged.id, draggedTeacherConflictInOtherClass.id],
        targetDayId,
        targetPeriod.start
      );

      if (altForDraggedOther) {
        updatesToRun.push({
          id: draggedTeacherConflictInOtherClass.id,
          day_of_week: Number(altForDraggedOther.dayId),
          start_time: altForDraggedOther.period.start,
          end_time: altForDraggedOther.period.end,
        });
      }
    }

    // E. If targetSlot was explicitly passed and not in current class (e.g. from modal swap):
    if (targetSlot && !updatesToRun.some((u) => u.id === targetSlot.id)) {
      if (alternativeTargetSlot) {
        updatesToRun.push({
          id: targetSlot.id,
          day_of_week: Number(alternativeTargetSlot.dayId),
          start_time: alternativeTargetSlot.period.start,
          end_time: alternativeTargetSlot.period.end,
        });
      } else {
        updatesToRun.push({
          id: targetSlot.id,
          day_of_week: Number(origDay),
          start_time: origStart,
          end_time: origEnd,
        });
      }
    }

    // 1. Optimistic Local State Update & Pin the moved slot as user anchor
    setPinnedSlotIds((prev) => new Set([...prev, currentDragged.id]));
    setSlots((prev) =>
      prev.map((s) => {
        const update = updatesToRun.find((u) => u.id === s.id);
        if (update) {
          return {
            ...s,
            day_of_week: update.day_of_week,
            start_time: update.start_time,
            end_time: update.end_time,
          };
        }
        return s;
      })
    );

    try {
      const supabase = createClient();

      await Promise.all(
        updatesToRun.map((u) =>
          supabase
            .from('timetable_slots')
            .update({
              day_of_week: u.day_of_week,
              start_time: u.start_time,
              end_time: u.end_time,
            })
            .eq('id', u.id)
        )
      );

      notify({
        title: 'Séances Déplacées & Réorganisées !',
        message: `${currentDragged.subject?.name} a été placé avec succès et l'emploi du temps a été réorganisé sans aucun créneau vide.`,
        type: 'success',
      });

      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du déplacement';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
      await loadData(); // rollback optimistic update on error
    } finally {
      draggedSlotRef.current = null;
      setDraggedSlot(null);
      setVacataireWarning(null);
      setTeacherConflictModal(null);
      setDragOverCell(null);
    }
  };

  const handleDropOnCell = async (
    e: React.DragEvent,
    targetDayId: number,
    targetPeriod: PeriodSlot,
    cellSlot: TimetableSlot | undefined
  ) => {
    e.preventDefault();
    setDragOverCell(null);

    let slotId = '';
    try {
      slotId = e.dataTransfer.getData('text/plain');
    } catch {
      // ignore
    }

    const currentDragged =
      draggedSlotRef.current || draggedSlot || (slotId ? slots.find((s) => s.id === slotId) : null);

    if (!currentDragged) return;

    // Friday afternoon check
    if (targetDayId === 5 && targetPeriod.isAfternoon) {
      notify({
        title: 'Horaire Non Autorisé',
        message: 'Le Vendredi après-midi (13h00 — 16h00) est réservé à la Prière du Vendredi.',
        type: 'warning',
      });
      draggedSlotRef.current = null;
      setDraggedSlot(null);
      return;
    }

    // Dropping on the exact same position
    if (isSameSlotTime(currentDragged.day_of_week, currentDragged.start_time, targetDayId, targetPeriod.start)) {
      draggedSlotRef.current = null;
      setDraggedSlot(null);
      return;
    }

    // 0. CHECK: Is the dragged teacher ALREADY teaching another class on this exact day & time?
    const draggedTeacher =
      teachers.find((t) => t.id === currentDragged.teacher_id) || currentDragged.teacher;

    const teacherBusyConflict = slots.find(
      (s) =>
        s.id !== currentDragged.id &&
        s.teacher_id === currentDragged.teacher_id &&
        isSameSlotTime(s.day_of_week, s.start_time, targetDayId, targetPeriod.start) &&
        s.class_id !== currentDragged.class_id
    );

    if (teacherBusyConflict) {
      const currentDraggedCopy = currentDragged;
      const targetDayName =
        MOROCCAN_SCHOOL_DAYS.find((d) => d.id === targetDayId)?.name || 'Jour';

      // Find the absolute CLOSEST free slot for that conflicting class & teacher!
      const foundAltForConflicting = findClosestAlternativeSlot(
        teacherBusyConflict.class_id,
        draggedTeacher,
        slots,
        [currentDragged.id, teacherBusyConflict.id],
        targetDayId,
        targetPeriod.start
      );

      setTeacherConflictModal({
        show: true,
        teacherName: draggedTeacher
          ? `${draggedTeacher.first_name} ${draggedTeacher.last_name}`
          : 'Enseignant',
        conflictingClassName: teacherBusyConflict.class?.name || 'Autre Classe',
        conflictingSubjectName: teacherBusyConflict.subject?.name || 'Matière',
        targetClassName: currentDragged.class?.name || 'Cette Classe',
        dayName: targetDayName,
        timeLabel: targetPeriod.label,
        alternativeSlot: foundAltForConflicting || undefined,
        onSwapWithConflictingClass: async () => {
          await executeMoveOrSwap(
            currentDraggedCopy,
            targetDayId,
            targetPeriod,
            teacherBusyConflict,
            foundAltForConflicting || undefined
          );
        },
      });
      return;
    }

    // Identify what exists at the target slot for this Class or Teacher
    const classTargetSlot = slots.find(
      (s) =>
        s.id !== currentDragged.id &&
        s.class_id === currentDragged.class_id &&
        isSameSlotTime(s.day_of_week, s.start_time, targetDayId, targetPeriod.start)
    );

    const teacherTargetSlot = slots.find(
      (s) =>
        s.id !== currentDragged.id &&
        s.teacher_id === currentDragged.teacher_id &&
        isSameSlotTime(s.day_of_week, s.start_time, targetDayId, targetPeriod.start)
    );

    const resolvedTargetSlot = cellSlot || classTargetSlot || teacherTargetSlot;

    let alternativeTargetPlacement: { dayId: number; period: PeriodSlot } | undefined = undefined;

    if (resolvedTargetSlot && resolvedTargetSlot.id !== currentDragged.id) {
      const targetTeacher =
        teachers.find((t) => t.id === resolvedTargetSlot.teacher_id) || resolvedTargetSlot.teacher;

      // 1. Is the displaced teacher already teaching another class at origin time (e.g. Mardi 08:30)?
      const targetTeacherConflictElsewhere = slots.find(
        (s) =>
          s.id !== currentDragged.id &&
          s.id !== resolvedTargetSlot.id &&
          s.teacher_id === resolvedTargetSlot.teacher_id &&
          s.class_id !== resolvedTargetSlot.class_id &&
          isSameSlotTime(s.day_of_week, s.start_time, currentDragged.day_of_week, currentDragged.start_time)
      );

      if (targetTeacherConflictElsewhere) {
        // Find alternative slot for the OTHER class session (sa3a tania)!
        const foundAltForOther = findClosestAlternativeSlot(
          targetTeacherConflictElsewhere.class_id,
          targetTeacher,
          slots,
          [currentDragged.id, resolvedTargetSlot.id, targetTeacherConflictElsewhere.id],
          currentDragged.day_of_week,
          currentDragged.start_time
        );

        const currentDraggedCopy = currentDragged;
        const origDayName =
          MOROCCAN_SCHOOL_DAYS.find((d) => d.id === currentDragged.day_of_week)?.name || 'Jour';
        const origPeriod =
          MOROCCAN_55MIN_PERIODS.find((p) => normalizeTime(p.start) === normalizeTime(currentDragged.start_time)) ||
          MOROCCAN_55MIN_PERIODS[0];

        setTeacherConflictModal({
          show: true,
          teacherName: targetTeacher
            ? `${targetTeacher.first_name} ${targetTeacher.last_name}`
            : 'Enseignant',
          conflictingClassName: targetTeacherConflictElsewhere.class?.name || 'Autre Classe',
          conflictingSubjectName: targetTeacherConflictElsewhere.subject?.name || 'Matière',
          targetClassName: resolvedTargetSlot.class?.name || 'Cette Classe',
          dayName: origDayName,
          timeLabel: origPeriod.label,
          alternativeSlot: foundAltForOther || undefined,
          onSwapWithConflictingClass: async () => {
            await executeMoveOrSwap(
              currentDraggedCopy,
              targetDayId,
              targetPeriod,
              resolvedTargetSlot,
              foundAltForOther || undefined
            );
          },
        });
        return;
      }

      // 2. Check Vacataire availability of displaced teacher on origin slot
      const origPeriod =
        MOROCCAN_55MIN_PERIODS.find((p) => normalizeTime(p.start) === normalizeTime(currentDragged.start_time)) ||
        MOROCCAN_55MIN_PERIODS[0];

      const targetTeacherAvailableOnOrig = isVacataireAvailable(
        targetTeacher,
        currentDragged.day_of_week,
        origPeriod.id,
        origPeriod.start
      );

      if (!targetTeacherAvailableOnOrig) {
        const foundAlt = findClosestAlternativeSlot(
          resolvedTargetSlot.class_id,
          targetTeacher,
          slots,
          [currentDragged.id, resolvedTargetSlot.id],
          currentDragged.day_of_week,
          currentDragged.start_time
        );

        const currentDraggedCopy = currentDragged;
        const origDayName =
          MOROCCAN_SCHOOL_DAYS.find((d) => d.id === currentDragged.day_of_week)?.name || 'Jour';

        setVacataireWarning({
          show: true,
          teacherName: targetTeacher
            ? `${targetTeacher.first_name} ${targetTeacher.last_name}`
            : 'Enseignant Vacataire',
          dayName: origDayName,
          timeLabel: origPeriod.label,
          onConfirm: async () => {
            await executeMoveOrSwap(
              currentDraggedCopy,
              targetDayId,
              targetPeriod,
              resolvedTargetSlot,
              foundAlt || undefined
            );
          },
        });
        return;
      }
    }

    // 1. Check Vacataire Availability for the dragged teacher
    const isDraggedAvailable = isVacataireAvailable(
      draggedTeacher,
      targetDayId,
      targetPeriod.id,
      targetPeriod.start
    );

    if (!isDraggedAvailable) {
      // Show Vacataire Non-Availability Warning Modal with force option
      const currentDraggedCopy = currentDragged;
      const targetDayName =
        MOROCCAN_SCHOOL_DAYS.find((d) => d.id === targetDayId)?.name || 'Jour';

      setVacataireWarning({
        show: true,
        teacherName: draggedTeacher
          ? `${draggedTeacher.first_name} ${draggedTeacher.last_name}`
          : 'Enseignant Vacataire',
        dayName: targetDayName,
        timeLabel: targetPeriod.label,
        onConfirm: async () => {
          await executeMoveOrSwap(
            currentDraggedCopy,
            targetDayId,
            targetPeriod,
            resolvedTargetSlot,
            alternativeTargetPlacement
          );
        },
      });
      return;
    }

    // If fully available, execute move / swap / smart displacement directly
    await executeMoveOrSwap(
      currentDragged,
      targetDayId,
      targetPeriod,
      resolvedTargetSlot,
      alternativeTargetPlacement
    );
  };

  const openSlotEditor = (dayId: number, period: PeriodSlot, slot?: TimetableSlot) => {
    if (slot) {
      setEditingSlotId(slot.id);
      setNewSlot({
        class_id: slot.class_id || selectedClassId || (classes[0]?.id || ''),
        day_of_week: slot.day_of_week,
        start_time: slot.start_time.slice(0, 5),
        end_time: slot.end_time.slice(0, 5),
        subject_id: slot.subject_id || '',
        teacher_id: slot.teacher_id || '',
        room_id: slot.room_id || '',
      });
    } else {
      setEditingSlotId(null);
      const initialSubjectId = subjects[0]?.id || '';
      const initialSubject = subjects[0];
      let initialTeacherId = teachers[0]?.id || '';

      if (initialSubject) {
        const sName = (initialSubject.name || '').toLowerCase();
        const matchingTeacher = teachers.find((t) => {
          const spec = (t.specialization || '').toLowerCase();
          return spec && (sName.includes(spec) || spec.includes(sName));
        });
        if (matchingTeacher) initialTeacherId = matchingTeacher.id;
      }

      setNewSlot({
        class_id: selectedClassId || (classes[0]?.id || ''),
        day_of_week: dayId,
        start_time: period.start,
        end_time: period.end,
        subject_id: initialSubjectId,
        teacher_id: viewMode === 'TEACHER' ? selectedTeacherId : initialTeacherId,
        room_id: rooms[0]?.id || '',
      });
    }
    setShowAddModal(true);
  };

  const handleSubjectChange = (subjectId: string) => {
    const selectedSubj = subjects.find((s) => s.id === subjectId);
    let autoTeacherId = newSlot.teacher_id;
    if (selectedSubj) {
      const sName = selectedSubj.name.toLowerCase();
      const matchingTeacher = teachers.find((t) => {
        const spec = (t.specialization || '').toLowerCase();
        return spec && (sName.includes(spec) || spec.includes(sName));
      });
      if (matchingTeacher) {
        autoTeacherId = matchingTeacher.id;
      }
    }
    setNewSlot((prev) => ({
      ...prev,
      subject_id: subjectId,
      teacher_id: autoTeacherId,
    }));
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
      const targetClass = newSlot.class_id || (viewMode === 'CLASS' ? selectedClassId : (classes[0]?.id || ''));
      const targetTeacher = newSlot.teacher_id || (viewMode === 'TEACHER' ? selectedTeacherId : (teachers[0]?.id || ''));

      // Check conflict with other slots (excluding current editing slot)
      const conflictSlot = slots.find(
        (s) =>
          s.id !== editingSlotId &&
          s.day_of_week === Number(newSlot.day_of_week) &&
          s.start_time.slice(0, 5) === newSlot.start_time.slice(0, 5) &&
          (s.teacher_id === targetTeacher || (newSlot.room_id && s.room_id === newSlot.room_id))
      );

      if (conflictSlot) {
        notify({
          title: 'Conflit Détecté !',
          message: `L'enseignant ou la salle est déjà occupé(e) le même jour sur ce créneau de 55 min.`,
          type: 'warning',
        });
        return;
      }

      if (editingSlotId) {
        // UPDATE EXISTING SLOT
        const { error } = await supabase
          .from('timetable_slots')
          .update({
            class_id: targetClass,
            teacher_id: targetTeacher,
            subject_id: newSlot.subject_id || subjects[0]?.id,
            room_id: newSlot.room_id || rooms[0]?.id,
            day_of_week: Number(newSlot.day_of_week),
            start_time: newSlot.start_time,
            end_time: newSlot.end_time,
          })
          .eq('id', editingSlotId);

        if (error) {
          notify({ title: 'Erreur', message: error.message, type: 'danger' });
          return;
        }

        logAuditEvent({
          action: 'TIMETABLE_SLOT_UPDATED',
          entity_type: 'timetable_slots',
          entity_id: editingSlotId,
          details: {
            class_id: targetClass,
            teacher_id: targetTeacher,
            subject_id: newSlot.subject_id,
            day: newSlot.day_of_week,
            start: newSlot.start_time,
          },
        });
        notify({ title: 'Succès', message: 'Séance et matière modifiées avec succès !', type: 'success' });
      } else {
        // INSERT NEW SLOT
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

        logAuditEvent({
          action: 'TIMETABLE_SLOT_ADDED',
          entity_type: 'timetable_slots',
          details: {
            class_id: targetClass,
            teacher_id: targetTeacher,
            day: newSlot.day_of_week,
            start: newSlot.start_time,
          },
        });
        notify({ title: 'Succès', message: 'Séance ajoutée avec succès !', type: 'success' });
      }

      setShowAddModal(false);
      setEditingSlotId(null);
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
      logAuditEvent({
        action: 'TIMETABLE_SLOT_DELETED',
        entity_type: 'timetable_slots',
        entity_id: slotId,
      });
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

  const triggerPrint = (mode: 'CURRENT' | 'ALL_CLASSES' | 'ALL_TEACHERS' | 'MASTER_GRID') => {
    setPrintMode(mode);
    setShowExportDropdown(false);

    const originalTitle = document.title;
    const yearStr = (settings.academic_year || '2025-2026').trim().replace(/\s+/g, '_');
    
    let exportFileName = `Emploi_du_Temps_${yearStr}`;
    if (mode === 'CURRENT') {
      if (viewMode === 'CLASS') {
        const clsName = (selectedClass?.name || 'Classe').trim().replace(/\s+/g, '_');
        exportFileName = `Emploi_du_Temps_${clsName}_${yearStr}`;
      } else if (viewMode === 'TEACHER') {
        const teacherName = `${selectedTeacher?.first_name || ''}_${selectedTeacher?.last_name || 'Enseignant'}`.trim().replace(/\s+/g, '_');
        exportFileName = `Planning_Service_${teacherName}_${yearStr}`;
      } else {
        exportFileName = `Grille_Service_Globale_Tous_Enseignants_${yearStr}`;
      }
    } else if (mode === 'ALL_CLASSES') {
      exportFileName = `Livret_Complet_Emplois_du_Temps_Toutes_Classes_${yearStr}`;
    } else if (mode === 'ALL_TEACHERS') {
      exportFileName = `Plannings_Service_Tous_Enseignants_${yearStr}`;
    } else {
      exportFileName = `Grille_Service_Globale_Tous_Enseignants_${yearStr}`;
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
            margin: 3mm 5mm 3mm 5mm !important;
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
          .print-master-page {
            width: 100% !important;
            max-width: 100% !important;
            height: 198mm !important;
            max-height: 198mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
          .print-master-table-wrapper {
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            min-height: 0 !important;
            height: 163mm !important;
            max-height: 163mm !important;
            border: 1.5px solid #334155 !important;
            border-radius: 4px !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
          .print-master-table {
            width: 100% !important;
            height: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }
          .print-master-table thead tr {
            height: 9mm !important;
            background-color: #f1f5f9 !important;
          }
          .print-master-table th {
            padding: 1px 1px !important;
            font-size: 6.5pt !important;
            line-height: 1.15 !important;
            background-color: #f1f5f9 !important;
            border-right: 1.6px solid #1e293b !important;
            border-bottom: 2px solid #0f172a !important;
            color: #0f172a !important;
            font-weight: 900 !important;
            vertical-align: middle !important;
          }
          .print-master-table th:last-child {
            border-right: none !important;
          }
          .print-master-table tbody {
            height: 148mm !important;
          }
          .print-master-table tbody tr {
            height: calc(148mm / 32) !important;
          }
          .print-master-table td {
            padding: 1px 1px !important;
            font-size: 6.6pt !important;
            line-height: 1.1 !important;
            text-align: center !important;
            border-right: 1.6px solid #1e293b !important;
            border-bottom: 1px solid #cbd5e1 !important;
            vertical-align: middle !important;
            box-sizing: border-box !important;
          }
          .print-master-table td:last-child {
            border-right: none !important;
          }
          .print-master-table tbody tr.print-master-day-end td {
            border-bottom: 2.2px solid #0f172a !important;
          }
          .print-master-table td.print-master-day-header {
            border-right: 2px solid #0f172a !important;
            border-bottom: 2.2px solid #0f172a !important;
          }
          .print-master-badge {
            padding: 1.5px 1px !important;
            border-radius: 3px !important;
            font-weight: 900 !important;
            font-size: 6.4pt !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            overflow: hidden !important;
            white-space: nowrap !important;
            text-overflow: ellipsis !important;
            line-height: 1.1 !important;
          }
          .print-master-day-header {
            background-color: #e2e8f0 !important;
            font-weight: 900 !important;
            font-size: 7.8pt !important;
            text-align: center !important;
            vertical-align: middle !important;
            border-right: 2px solid #0f172a !important;
            letter-spacing: 0.5px !important;
          }
          .print-master-table tfoot tr {
            height: 6mm !important;
            background-color: #e2e8f0 !important;
          }
          .print-master-table tfoot td {
            font-size: 7pt !important;
            font-weight: 900 !important;
            padding: 1px 1px !important;
            border-right: 1.6px solid #1e293b !important;
            border-top: 2px solid #0f172a !important;
          }
          .print-master-table tfoot td:last-child {
            border-right: none !important;
          }
          .print-full-container,
          .print-page-break {
            width: 100% !important;
            max-width: 100% !important;
            height: 198mm !important;
            max-height: 198mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            box-sizing: border-box !important;
          }
          .print-header-block {
            margin-bottom: 3px !important;
            padding-bottom: 3px !important;
            border-bottom: 2px solid #0f172a !important;
          }
          .print-table-wrapper {
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            min-height: 0 !important;
            height: 164mm !important;
            max-height: 164mm !important;
            border: 1.5px solid #334155 !important;
            border-radius: 6px !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
          .print-table {
            width: 100% !important;
            height: 100% !important;
            flex: 1 !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }
          .print-table thead tr {
            height: 8mm !important;
            background-color: #f1f5f9 !important;
          }
          .print-table thead th {
            padding: 2px 2px !important;
            font-size: 8.5pt !important;
            border-right: 1.5px solid #334155 !important;
            border-bottom: 2px solid #0f172a !important;
            font-weight: 900 !important;
          }
          .print-table thead th:last-child {
            border-right: none !important;
          }
          .print-table tbody {
            height: 156mm !important;
          }
          .print-table tbody tr {
            height: 17.5mm !important;
          }
          .print-table tbody tr.print-recess-row {
            height: 5mm !important;
            padding: 1px !important;
            font-size: 7.2pt !important;
            font-weight: 800 !important;
          }
          .print-table td {
            padding: 1.5px 2px !important;
            vertical-align: middle !important;
            border-right: 1.5px solid #334155 !important;
            border-bottom: 1px solid #cbd5e1 !important;
            box-sizing: border-box !important;
          }
          .print-table td:last-child {
            border-right: none !important;
          }
          .print-card-slot {
            padding: 2.5px 3px !important;
            height: 100% !important;
            min-height: 16mm !important;
            max-height: 17mm !important;
            border-radius: 5px !important;
            box-shadow: none !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
            overflow: hidden !important;
          }
          .print-empty-slot {
            height: 100% !important;
            min-height: 16mm !important;
            max-height: 17mm !important;
            border-radius: 5px !important;
            border: 1.5px dashed #cbd5e1 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            color: #94a3b8 !important;
            font-weight: bold !important;
          }
          .print-card-subject {
            font-size: 8.5pt !important;
            font-weight: 900 !important;
            line-height: 1.1 !important;
          }
          .print-card-details {
            font-size: 7.2pt !important;
            line-height: 1.1 !important;
          }
          .print-signature-footer {
            margin-top: 3px !important;
            padding-top: 3px !important;
            border-top: 1.5px solid #334155 !important;
            font-size: 7.5pt !important;
          }
        }
      `}</style>

      <div className="space-y-6 print:space-y-0">
        {/* Teacher Consultation Banner */}
        {isTeacher && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-300 animate-in fade-in print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="font-bold text-sm">
                  {dir === 'rtl' ? 'فضاء الأستاذ — الإطلاع على استعمال الزمن' : `Espace Enseignant ${teacherName ? `(${teacherName})` : ''}`}
                </div>
                <div className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                  {dir === 'rtl'
                    ? 'يمكنك مشاهدة استعمال الزمن الخاص بك أو للأقسام التي تدرسها فقط. ميزات التعديل والإضافة مقفلة ومخصصة للإدارة.'
                    : 'Consultation exclusive de votre emploi du temps et des classes que vous enseignez. Les modifications sont verrouillées.'}
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
              🔒 {dir === 'rtl' ? 'وضع القراءة فقط' : 'Lecture Seule'}
            </span>
          </div>
        )}

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
                {dir === 'rtl' ? 'تنظيم الحصص الأسبوعية، جداول الفصول والأساتذة.' : "Emploi du temps officiel des classes et plannings des enseignants."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Switcher */}
            <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('TEACHER')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'TEACHER'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{isTeacher ? (dir === 'rtl' ? 'جدولي الخاص' : 'Mon Planning') : (dir === 'rtl' ? 'حسب الأستاذ' : 'Par Enseignant')}</span>
              </button>

              <button
                onClick={() => setViewMode('CLASS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'CLASS'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>{isTeacher ? (dir === 'rtl' ? 'أقسامي' : 'Mes Classes') : (dir === 'rtl' ? 'حسب القسم' : 'Par Classe')}</span>
              </button>

              {!isTeacher && (
                <button
                  onClick={() => setViewMode('MASTER_GRID')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'MASTER_GRID'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>{dir === 'rtl' ? 'الجدول الشامل للأساتذة' : 'Grille Globale Tous Profs'}</span>
                </button>
              )}
            </div>

            {/* Export PDF Button */}
            <div className="relative">
              <button
                onClick={() => {
                  if (isTeacher) {
                    triggerPrint('CURRENT');
                  } else {
                    setShowExportDropdown(!showExportDropdown);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-sky-500" />
                <span>{dir === 'rtl' ? 'طباعة / PDF' : 'Imprimer / PDF'}</span>
                {!isTeacher && <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />}
              </button>

              {!isTeacher && showExportDropdown && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95">
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
                        {viewMode === 'CLASS'
                          ? `Classe : ${selectedClass?.name}`
                          : viewMode === 'TEACHER'
                          ? `Prof : ${selectedTeacher?.last_name}`
                          : 'Grille Globale des Profs'}
                      </div>
                    </div>
                  </button>

                  <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1" />

                  <button
                    onClick={() => triggerPrint('MASTER_GRID')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                  >
                    <Table className="w-4 h-4 text-indigo-500" />
                    <div>
                      <div className="text-indigo-600 dark:text-indigo-400 font-black">Grille de Service Globale (1 Page A4)</div>
                      <div className="text-[10px] font-normal text-slate-400">Tous les {teachers.length} profs &amp; toute la semaine sur 1 seule feuille</div>
                    </div>
                  </button>

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

            {/* Admin-only Timetable Actions */}
            {!isTeacher && (
              <>
                {/* Real-time Schedule Inspector / Conflict Verifier Badge */}
                {detectedConflicts.length > 0 ? (
                  <button
                    onClick={() => setShowConflictModal(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-extrabold text-xs shadow-lg shadow-rose-500/25 transition-all hover:scale-105 animate-pulse cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>{detectedConflicts.length} Conflit{detectedConflicts.length > 1 ? 's' : ''} Détecté{detectedConflicts.length > 1 ? 's' : ''}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setShowConflictModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer"
                    title="Vérifier la conformité de l'emploi du temps"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>0 Conflit • Vérifié</span>
                  </button>
                )}

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
              </>
            )}
          </div>
        </div>

        {/* Dynamic Dropdown Selector Bar */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${
              viewMode === 'CLASS'
                ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                : viewMode === 'TEACHER'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
            } shrink-0`}>
              {viewMode === 'CLASS' ? <Building2 className="w-5 h-5" /> : viewMode === 'TEACHER' ? <User className="w-5 h-5" /> : <Table className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 dark:text-white">
                {viewMode === 'CLASS'
                  ? 'Classe Affichée'
                  : viewMode === 'TEACHER'
                  ? 'Enseignant Affiché'
                  : 'Tableau de Service Global des Enseignants'}
              </div>
              <div className="text-[11px] text-slate-400">
                {viewMode === 'CLASS'
                  ? 'Sélectionnez la division pour consulter ou modifier son planning'
                  : viewMode === 'TEACHER'
                  ? 'Sélectionnez un enseignant pour afficher son emploi du temps individuel'
                  : 'Vue d\'ensemble de tous les créneaux de la semaine pour l\'ensemble des professeurs sur une seule page'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {viewMode === 'CLASS' && (
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
            )}

            {viewMode === 'TEACHER' && (
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

            {viewMode === 'MASTER_GRID' && (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                  {teachers.length} Professeurs &bull; {slots.length} séances
                </span>
                <button
                  onClick={() => triggerPrint('MASTER_GRID')}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/25 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer Grille (1 Page A4)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 1. SINGLE VIEW DISPLAY (Visible in Browser & When printMode === 'CURRENT') */}
        <div className={printMode !== 'CURRENT' && printMode !== 'MASTER_GRID' ? 'print:hidden' : ''}>
          {viewMode === 'MASTER_GRID' ? (
            /* ON-SCREEN MASTER TEACHERS RECAPITULATIVE GRID */
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden print:hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0 flex items-center justify-center">
                    <Table className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Grille Récapitulative Globale de Tous les Enseignants</span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold">
                        {teachers.length} Professeurs
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Vue complète de la semaine : créneaux occupés, matières dispensées et disponibilités.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => triggerPrint('MASTER_GRID')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimer sur 1 Page A4</span>
                  </button>
                </div>
              </div>

              <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                <table className="w-full min-w-[1050px] text-center border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-slate-800 text-[11px] font-black text-slate-800 dark:text-slate-200 border-b-2 border-slate-300 dark:border-slate-600">
                      <th className="p-3 text-center w-20 border-r-2 border-slate-300 dark:border-slate-600">Jour</th>
                      <th className="p-3 text-center w-28 border-r-2 border-slate-300 dark:border-slate-600">Horaire</th>
                      {teachers.map((tch) => {
                        const count = slots.filter((s) => s.teacher_id === tch.id).length;
                        return (
                          <th key={tch.id} className="p-2.5 border-r-2 border-slate-300 dark:border-slate-600 last:border-r-0 text-center min-w-[100px]">
                            <div className="font-black text-slate-900 dark:text-white text-xs leading-tight">
                              {tch.last_name?.toUpperCase()} {tch.first_name}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5">
                              {tch.specialization || 'Enseignant'}
                            </div>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[9.5px] font-bold">
                              {count}h / sem.
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {MOROCCAN_SCHOOL_DAYS.map((day) => {
                      const dayPeriods = day.id === 5 ? MOROCCAN_55MIN_PERIODS.slice(0, 4) : MOROCCAN_55MIN_PERIODS;
                      return dayPeriods.map((period, pIdx) => {
                        const isFirst = pIdx === 0;
                        const rowCount = dayPeriods.length;
                        const isLastPeriodOfDay = pIdx === rowCount - 1;

                        return (
                          <tr
                            key={`${day.id}_${period.id}`}
                            className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors ${
                              isLastPeriodOfDay
                                ? 'border-b-2 border-b-slate-700 dark:border-b-slate-300'
                                : 'border-b border-slate-100 dark:border-slate-800'
                            }`}
                          >
                            {isFirst && (
                              <td
                                rowSpan={rowCount}
                                className={`p-3 font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/80 border-r-2 border-slate-300 dark:border-slate-600 align-middle text-center ${
                                  isLastPeriodOfDay ? 'border-b-2 border-b-slate-700 dark:border-b-slate-300' : ''
                                }`}
                              >
                                <div className="text-xs font-black uppercase tracking-wider">{day.name}</div>
                                {day.isHalfDay && (
                                  <span className="text-[9px] text-orange-600 dark:text-orange-400 font-bold block mt-0.5">
                                    Matinée
                                  </span>
                                )}
                              </td>
                            )}

                            <td className="p-2 font-mono font-bold text-[11px] text-sky-600 dark:text-sky-400 bg-slate-50/50 dark:bg-slate-900/40 border-r-2 border-slate-300 dark:border-slate-600">
                              <div className="font-black leading-tight">{period.label}</div>
                              <div className="text-[9px] text-slate-400 font-sans font-normal">{period.sessionName}</div>
                            </td>

                            {teachers.map((tch) => {
                              const tSlot = slots.find(
                                (s) =>
                                  s.teacher_id === tch.id &&
                                  isSameSlotTime(s.day_of_week, s.start_time, day.id, period.start)
                              );

                              return (
                                <td key={tch.id} className="p-1.5 border-r-2 border-slate-200 dark:border-slate-700 last:border-r-0 align-middle">
                                  {tSlot ? (
                                    <div
                                      onClick={() => openSlotEditor(day.id, period, tSlot)}
                                      className="p-1.5 rounded-xl text-white shadow-2xs flex flex-col items-center justify-center text-center transition-transform hover:scale-105 cursor-pointer hover:ring-2 hover:ring-white/80"
                                      style={{ backgroundColor: tSlot.subject?.color_code || '#0284c7' }}
                                      title={`${tSlot.class?.name || ''} - ${tSlot.subject?.name || ''} (Salle: ${tSlot.room?.name || tSlot.room?.room_number || 'N/A'}) - Cliquer pour modifier`}
                                    >
                                      <span className="text-[11px] font-black leading-tight">{tSlot.class?.name}</span>
                                      <span className="text-[9.5px] font-black opacity-95 uppercase tracking-wide">
                                        {getSubjectAbbreviation(tSlot.subject)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div
                                      onClick={() => {
                                        setSelectedTeacherId(tch.id);
                                        openSlotEditor(day.id, period);
                                      }}
                                      className="py-2 text-slate-300 dark:text-slate-700 hover:text-sky-500 font-bold text-center text-xs hover:bg-sky-50/50 dark:hover:bg-sky-950/30 rounded-lg cursor-pointer transition-colors"
                                      title={dir === 'rtl' ? 'انقر لإسناد حصة لهذا الأستاذ' : 'Cliquer pour assigner une séance à ce professeur'}
                                    >
                                      —
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      });
                    })}
                  </tbody>

                  <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-600">
                      <td colSpan={2} className="p-3 text-center uppercase tracking-wider border-r-2 border-slate-300 dark:border-slate-600">
                        Total Heures / Semaine
                      </td>
                      {teachers.map((tch) => {
                        const count = slots.filter((s) => s.teacher_id === tch.id).length;
                        return (
                          <td key={tch.id} className="p-3 border-r-2 border-slate-300 dark:border-slate-600 last:border-r-0 text-center font-black text-indigo-600 dark:text-indigo-400">
                            {count} séances
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
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
              <div className="print-table-wrapper rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden print:border print:border-slate-300 print:shadow-none print:rounded-lg">
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
                    {isTeacher ? (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800">
                        🔒 {dir === 'rtl' ? 'وضع القراءة فقط للأستاذ' : 'Consultation Enseignant (Lecture seule)'}
                      </span>
                    ) : (
                      <span className="text-[11px] text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 border border-sky-200 dark:border-sky-800">
                        <Move className="w-3 h-3" />
                        Glisser-déposer pour permuter / déplacer
                      </span>
                    )}
                    <span className="text-xs text-slate-500 font-bold">
                      {activeSlots.length} séances planifiées
                    </span>
                  </div>
                </div>

                <div className="w-full overflow-x-auto print:overflow-visible scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                  <table className="w-full min-w-[700px] sm:min-w-full table-fixed text-center border-collapse print:table-fixed print-table">
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

                                const slot = activeSlots.find((s) =>
                                  isSameSlotTime(s.day_of_week, s.start_time, day.id, period.start)
                                );

                                const isDragOver =
                                  !isTeacher &&
                                  dragOverCell?.day === day.id &&
                                  dragOverCell?.start === period.start;

                                return (
                                  <td
                                    key={day.id}
                                    onDragOver={!isTeacher ? (e) => handleDragOver(e, day.id, period.start) : undefined}
                                    onDragLeave={!isTeacher ? handleDragLeave : undefined}
                                    onDrop={!isTeacher ? (e) => handleDropOnCell(e, day.id, period, slot) : undefined}
                                    className={`p-1 sm:p-1.5 print:p-0.5 border-r border-slate-200 dark:border-slate-800 print:border-slate-300 last:border-r-0 align-middle transition-all ${
                                      isDragOver
                                        ? 'bg-sky-100/70 dark:bg-sky-900/40 ring-2 ring-sky-500 ring-inset scale-[1.01]'
                                        : ''
                                    }`}
                                  >
                                    {slot ? (
                                      <div
                                        draggable={!isTeacher}
                                        onClick={() => !isTeacher && openSlotEditor(day.id, period, slot)}
                                        onDragStart={!isTeacher ? (e) => handleDragStart(e, slot) : undefined}
                                        onDragEnd={() => {
                                          setDraggedSlot(null);
                                          setDragOverCell(null);
                                        }}
                                        className={`w-full p-1 sm:p-1.5 lg:p-2 rounded-xl sm:rounded-2xl print:rounded text-white shadow-xs relative group transition-all flex flex-col items-center justify-center text-center min-h-[58px] sm:min-h-[66px] lg:min-h-[74px] print:min-h-[48px] print:max-h-[52px] print-card-slot ${
                                          isTeacher ? 'cursor-default' : 'cursor-pointer active:cursor-grabbing hover:shadow-md hover:ring-2 hover:ring-white/80 hover:scale-[1.01]'
                                        } overflow-hidden ${
                                          draggedSlot?.id === slot.id
                                            ? 'opacity-40 ring-2 ring-white scale-95'
                                            : ''
                                        }`}
                                        style={{
                                          backgroundColor: slot.subject?.color_code || '#0284c7',
                                        }}
                                        title={
                                          isTeacher
                                            ? `${slot.subject?.name || ''} - ${slot.class?.name || ''} - Salle: ${slot.room?.name || slot.room?.room_number || 'N/A'}`
                                            : dir === 'rtl' ? 'انقر لتعديل الحصة والمادة أو الأستاذ' : 'Cliquer pour modifier la matière ou la séance'
                                        }
                                      >
                                        {/* Drag grip icon on top left hover */}
                                        {!isTeacher && (
                                          <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-75 transition-opacity print:hidden pointer-events-none">
                                            <GripVertical className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                                          </div>
                                        )}

                                        {/* Delete button on top right hover */}
                                        {!isTeacher && (
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
                                        )}

                                        {/* Centered text content */}
                                        <div className="w-full flex flex-col items-center justify-center text-center overflow-hidden pointer-events-none">
                                          <div className="font-black text-[10px] sm:text-xs lg:text-[13px] tracking-wide text-white text-center leading-tight truncate w-full px-0.5 print-card-subject">
                                            [{getSubjectAbbreviation(slot.subject)}] {slot.subject?.name || 'Matière'}
                                          </div>

                                          <div className="text-[8.5px] sm:text-[9.5px] lg:text-[10.5px] print:text-[7.5pt] text-white/95 font-medium text-center truncate w-full mt-0.5 print-card-details">
                                            {viewMode === 'CLASS'
                                              ? slot.teacher
                                                ? `${slot.teacher.first_name} ${slot.teacher.last_name}`
                                                : 'Professeur non assigné'
                                              : slot.class?.name || 'Classe'}
                                          </div>

                                          <div className="text-[8px] sm:text-[9px] lg:text-[9.5px] print:text-[6.5pt] text-white/80 font-bold text-center truncate w-full print-card-details">
                                            {slot.room ? `Salle : ${slot.room.name || slot.room.room_number}` : 'Salle Standard'}
                                          </div>
                                        </div>
                                      </div>
                                    ) : isTeacher ? (
                                      <div className="w-full h-full min-h-[58px] sm:min-h-[66px] lg:min-h-[74px] print:min-h-[48px] print:max-h-[52px] print-empty-slot rounded-xl sm:rounded-2xl print:rounded border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-700 text-xs font-bold select-none">
                                        —
                                      </div>
                                    ) : (
                                      <div
                                        onClick={() => openSlotEditor(day.id, period)}
                                        className="w-full h-full min-h-[58px] sm:min-h-[66px] lg:min-h-[74px] print:min-h-[48px] print:max-h-[52px] print-empty-slot rounded-xl sm:rounded-2xl print:rounded border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-500 hover:bg-sky-50/60 dark:hover:bg-sky-950/40 flex flex-col items-center justify-center text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 text-xs font-bold transition-all cursor-pointer group/empty"
                                        title={dir === 'rtl' ? 'انقر لإضافة حصة وتحديد المادة' : 'Cliquer pour choisir la matière de ce créneau'}
                                      >
                                        <Plus className="w-4 h-4 opacity-0 group-hover/empty:opacity-100 transition-opacity mb-0.5" />
                                        <span className="group-hover/empty:hidden">—</span>
                                        <span className="hidden group-hover/empty:inline text-[10px] font-bold">
                                          {dir === 'rtl' ? '+ مادة' : '+ Matière'}
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>

                            {/* Recess & Break rows */}
                            {isRecessAfterP2 && (
                              <tr className="bg-amber-500/10 dark:bg-amber-950/30 print:bg-amber-100/50 text-amber-800 dark:text-amber-300 print:text-amber-900 text-[11px] print:text-[7pt] font-bold print-recess-row">
                                <td colSpan={6} className="py-1.5 print:py-0.5 px-4 text-center tracking-wider">
                                  🔔 Récréation du Matin (10 min) &bull; 10h20 &mdash; 10h30
                                </td>
                              </tr>
                            )}

                            {isLunchBreakAfterP4 && (
                              <tr className="bg-orange-500/15 dark:bg-orange-950/40 print:bg-orange-100 text-orange-900 dark:text-orange-200 print:text-orange-950 text-xs print:text-[7.5pt] font-black print-recess-row">
                                <td colSpan={6} className="py-2 print:py-0.5 px-4 text-center tracking-wider border-y border-orange-200 dark:border-orange-900/50 print:border-orange-300">
                                  🍽️ Pause Déjeuner &amp; Prière (40 min) &bull; 12h20 &mdash; 13h00 (Lundi au Jeudi)
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
          )}
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

                  <div className="print-table-wrapper rounded-lg border border-slate-300 overflow-hidden">
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
                                            <div className="font-black text-[9pt] print-card-subject">[{getSubjectAbbreviation(slot.subject)}] {slot.subject?.name}</div>
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

                  <div className="print-table-wrapper rounded-lg border border-slate-300 overflow-hidden">
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

        {/* 4. MASTER PRINT: ALL TEACHERS GLOBAL GRID ON 1 SINGLE PAGE */}
        {(printMode === 'MASTER_GRID' || (printMode === 'CURRENT' && viewMode === 'MASTER_GRID')) && (
          <div className="hidden print:block space-y-0">
            <div className="print-master-page">
              <div className="print-header-block">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/logo.png"
                      alt="Logo GM"
                      className="w-10 h-10 object-contain shrink-0"
                    />
                    <div>
                      <h1 className="text-xs font-black uppercase text-slate-900 leading-tight">
                        {settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES'}
                      </h1>
                      <p className="text-[7.5pt] text-slate-600 font-semibold">
                        TABLEAU DE SERVICE GÉNÉRAL DES ENSEIGNANTS &bull; Année Scolaire {settings.academic_year || '2025-2026'} &bull; {settings.current_term || 'Semestre 1'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded bg-indigo-950 text-white font-black text-[8pt] inline-block">
                      GRILLE RÉCAPITULATIVE GLOBALE ({teachers.length} ENSEIGNANTS)
                    </span>
                    <p className="text-[6.5pt] text-slate-500 mt-0.5 font-bold">
                      {slots.length} séances hebdomadaires réparties sur 5 jours
                    </p>
                  </div>
                </div>
              </div>

              <div className="print-master-table-wrapper">
                <table className="w-full text-center border-collapse print-master-table">
                  <thead>
                    <tr className="bg-slate-100 text-[6.8pt] font-black text-slate-900 border-b-2 border-slate-900">
                      <th className="p-0.5 text-center w-14 border-r-2 border-slate-900">Jour</th>
                      <th className="p-0.5 text-center w-20 border-r-2 border-slate-900">Horaire</th>
                      {teachers.map((tch) => {
                        const count = slots.filter((s) => s.teacher_id === tch.id).length;
                        return (
                          <th key={tch.id} className="p-0.5 border-r border-slate-700 last:border-r-0 text-center">
                            <div className="font-black text-[5.8pt] leading-tight text-slate-950 uppercase tracking-tight">
                              {tch.last_name}
                            </div>
                            <div className="font-bold text-[5.4pt] leading-tight text-slate-800 capitalize">
                              {tch.first_name}
                            </div>
                            <div className="text-[4.8pt] text-slate-600 font-bold leading-tight mt-0.5 truncate">
                              {tch.specialization || 'Prof'} ({count}h)
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-300">
                    {MOROCCAN_SCHOOL_DAYS.map((day) => {
                      const dayPeriods = day.id === 5 ? MOROCCAN_55MIN_PERIODS.slice(0, 4) : MOROCCAN_55MIN_PERIODS;
                      return dayPeriods.map((period, pIdx) => {
                        const isFirst = pIdx === 0;
                        const rowCount = dayPeriods.length;
                        const isLastPeriodOfDay = pIdx === rowCount - 1;

                        return (
                          <tr key={`${day.id}_${period.id}`} className={isLastPeriodOfDay ? 'print-master-day-end' : ''}>
                            {isFirst && (
                              <td
                                rowSpan={rowCount}
                                className="print-master-day-header border-r border-slate-400"
                              >
                                <span>{day.name}</span>
                              </td>
                            )}
                            <td className="p-0.5 font-mono font-black text-[6.4pt] bg-slate-50 border-r border-slate-300 text-slate-800">
                              {period.label}
                            </td>

                            {teachers.map((tch) => {
                              const tSlot = slots.find(
                                (s) =>
                                  s.teacher_id === tch.id &&
                                  isSameSlotTime(s.day_of_week, s.start_time, day.id, period.start)
                              );

                              return (
                                <td key={tch.id} className="p-0.5 border-r border-slate-300 last:border-r-0 align-middle">
                                  {tSlot ? (
                                    <div
                                      className="print-master-badge text-white"
                                      style={{ backgroundColor: tSlot.subject?.color_code || '#0f172a' }}
                                    >
                                      <span><strong>{tSlot.class?.name || 'Cls'}</strong> ({getSubjectAbbreviation(tSlot.subject)})</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 font-bold">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      });
                    })}
                  </tbody>

                  <tfoot>
                    <tr className="bg-slate-200 text-[6.8pt] font-black text-slate-900 border-t border-slate-400">
                      <td colSpan={2} className="p-0.5 text-center border-r border-slate-400 uppercase font-black">
                        Total Heures / Semaine
                      </td>
                      {teachers.map((tch) => {
                        const count = slots.filter((s) => s.teacher_id === tch.id).length;
                        return (
                          <td key={tch.id} className="p-0.5 border-r border-slate-400 last:border-r-0 text-center font-black text-slate-900">
                            {count}h
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-between items-center print-signature-footer text-[6.8pt]">
                <div>
                  <p className="font-bold text-slate-800">Cachet de l&apos;Établissement</p>
                </div>
                <div className="text-center text-[6pt] text-slate-500 font-medium">
                  Grille récapitulative générale officielle générée par GM School System
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">Signature du Directeur Pédagogique</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal 1: Add or Edit Slot with Subject Selection */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in print:hidden">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-sky-500/20 animate-in zoom-in-95 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-sky-500/15 text-sky-500">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {editingSlotId
                        ? (dir === 'rtl' ? 'تعديل الحصة واختيار المادة' : 'Modifier la Séance & la Matière')
                        : (dir === 'rtl' ? 'إضافة حصة وتحديد المادة' : 'Ajouter une Séance & Choisir la Matière')}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {viewMode === 'CLASS'
                        ? `Classe : ${selectedClass?.name || 'Classe'}`
                        : `Enseignant : ${selectedTeacher?.first_name} ${selectedTeacher?.last_name}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingSlotId(null);
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddSlot} className="space-y-4">
                {/* Day & Period */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Jour de la Semaine
                    </label>
                    <select
                      value={newSlot.day_of_week}
                      onChange={(e) => setNewSlot({ ...newSlot, day_of_week: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      {MOROCCAN_SCHOOL_DAYS.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.isHalfDay ? '(Fin à 12h20)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Créneau Horaire (55 min)
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
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      {MOROCCAN_55MIN_PERIODS.map((p) => (
                        <option
                          key={p.id}
                          value={p.start}
                          disabled={Number(newSlot.day_of_week) === 5 && p.notOnFriday}
                        >
                          {p.label} &mdash; {p.sessionName} {Number(newSlot.day_of_week) === 5 && p.notOnFriday ? '(Libre Vendredi)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Subject Selector with Visual Preview */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Matière Enseignée (المادة الدراسية)
                  </label>
                  <select
                    required
                    value={newSlot.subject_id}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    <option value="">-- Sélectionner une Matière --</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code || getSubjectAbbreviation(s)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Class, Teacher & Room Pickers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Enseignant (Professeur)
                    </label>
                    <select
                      required
                      value={newSlot.teacher_id}
                      onChange={(e) => setNewSlot({ ...newSlot, teacher_id: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      <option value="">-- Choisir Professeur --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.first_name} {t.last_name} ({t.specialization || 'Prof'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Salle de Cours
                    </label>
                    <select
                      required
                      value={newSlot.room_id}
                      onChange={(e) => setNewSlot({ ...newSlot, room_id: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      <option value="">-- Choisir Salle --</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.room_number})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  {editingSlotId ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleDeleteSlot(editingSlotId);
                        setShowAddModal(false);
                        setEditingSlotId(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer cette séance</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setEditingSlotId(null);
                      }}
                      className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 rounded-xl shadow-lg shadow-sky-500/25 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>{editingSlotId ? 'Mettre à jour la séance' : 'Enregistrer la séance'}</span>
                    </button>
                  </div>
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

        {/* Modal 4: Teacher Busy Conflict Modal (Garantie / Avertissement de Conflit d'Horaire Enseignant) */}
        {teacherConflictModal && teacherConflictModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in print:hidden">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border-2 border-rose-500 dark:border-rose-500/60 animate-in zoom-in-95 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 text-rose-600 dark:text-rose-400">
                <div className="p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30">
                  <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Conflit d&apos;Horaire Enseignant
                  </h3>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                    Enseignant déjà en cours sur ce créneau
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-slate-800 dark:text-slate-200 space-y-2">
                  <p className="font-medium leading-relaxed">
                    L&apos;enseignant <strong className="text-slate-950 dark:text-white font-extrabold">{teacherConflictModal.teacherName}</strong> enseigne déjà à cette même heure dans une autre classe :
                  </p>
                  
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[10px] uppercase font-bold">Séance Occupée :</span>
                      <span className="font-mono font-black text-rose-600 dark:text-rose-400">{teacherConflictModal.conflictingClassName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[10px] uppercase font-bold">Discipline :</span>
                      <span className="font-bold text-slate-900 dark:text-white">{teacherConflictModal.conflictingSubjectName}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 text-[10px] uppercase font-bold">Horaire :</span>
                      <span className="font-extrabold text-amber-600 dark:text-amber-400">{teacherConflictModal.dayName} &bull; {teacherConflictModal.timeLabel}</span>
                    </div>
                  </div>
                </div>

                {teacherConflictModal.alternativeSlot && (
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-slate-200 space-y-1">
                    <span className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400">Solution Intelligente :</span>
                    <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">
                      Déplacer la séance de {teacherConflictModal.teacherName} vers :{' '}
                      <strong>
                        {MOROCCAN_SCHOOL_DAYS.find((d) => d.id === teacherConflictModal.alternativeSlot?.dayId)?.name || 'Jour'}{' '}
                        &bull; {teacherConflictModal.alternativeSlot.period.label}
                      </strong>
                    </p>
                  </div>
                )}

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  {teacherConflictModal.onSwapWithConflictingClass
                    ? 'Vous pouvez permuter / réorganiser automatiquement les séances sans créer de chevauchement.'
                    : 'Le déplacement est impossible car cet enseignant est déjà engagé sur ce créneau horaire.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setTeacherConflictModal(null);
                    setDraggedSlot(null);
                  }}
                  className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  {teacherConflictModal.onSwapWithConflictingClass ? 'Annuler' : 'Fermer'}
                </button>

                {teacherConflictModal.onSwapWithConflictingClass && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (teacherConflictModal.onSwapWithConflictingClass) {
                        await teacherConflictModal.onSwapWithConflictingClass();
                      }
                    }}
                    className="px-4 py-2.5 text-xs font-black text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 rounded-xl shadow-lg shadow-rose-600/25 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>
                      {teacherConflictModal.alternativeSlot
                        ? 'Permuter & Réorganiser'
                        : 'Permuter les 2 Séances (Swap)'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Real-time Schedule Conflict Inspector Modal */}
        {showConflictModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${detectedConflicts.length > 0 ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
                    {detectedConflicts.length > 0 ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Inspecteur de Conformité & Conflits
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Audit en temps réel de tous les créneaux et affectations des professeurs
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConflictModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {detectedConflicts.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                        Aucun Conflit Détecté !
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                        L&apos;emploi du temps respecte 100% des contraintes. Aucun professeur n&apos;est programmé dans deux classes simultanément.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between">
                      <div className="text-xs font-bold text-rose-800 dark:text-rose-200">
                        {detectedConflicts.length} conflit(s) actif(s) nécessitant une réorganisation :
                      </div>
                      <button
                        onClick={handleAutoFixAllConflicts}
                        disabled={isAutoFixing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md shadow-rose-600/20 transition-all hover:scale-105 disabled:opacity-50 cursor-pointer"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>{isAutoFixing ? 'Résolution en cours...' : '⚡ Résoudre Tous Automatiquement'}</span>
                      </button>
                    </div>

                    {detectedConflicts.map((c, idx) => {
                      const isHole = c.type === 'CLASS_SCHEDULE_HOLE';
                      return (
                        <div
                          key={c.id || idx}
                          className={`p-4 rounded-2xl border space-y-2 transition-all ${
                            isHole
                              ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/50'
                              : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-800/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-black flex items-center gap-1.5 ${
                                isHole ? 'text-amber-700 dark:text-amber-300' : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {isHole ? <Clock className="w-4 h-4 text-amber-500" /> : <AlertCircle className="w-4 h-4 text-rose-500" />}
                              {c.title}
                            </span>
                            <span
                              className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg ${
                                isHole
                                  ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
                                  : 'bg-rose-500/20 text-rose-800 dark:text-rose-200'
                              }`}
                            >
                              {c.dayName} &bull; {c.timeLabel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                            {c.description}
                          </p>
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Classes concernées :</span>
                            <div className="flex items-center gap-1.5">
                              {c.classes.map((clsName) => (
                                <span
                                  key={clsName}
                                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs"
                                >
                                  {clsName}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[11px] text-slate-400">
                  {slots.length} séances au total vérifiées en temps réel
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowConflictModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Fermer
                  </button>
                  {detectedConflicts.length > 0 && (
                    <button
                      onClick={handleAutoFixAllConflicts}
                      disabled={isAutoFixing}
                      className="px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 rounded-xl shadow-lg shadow-rose-600/25 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>{isAutoFixing ? 'Résolution...' : 'Auto-Correction Intelligente'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
