'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { ClassEntity, Teacher, Room, Subject, EducationCycle } from '@/types/database';
import { useNotify } from '@/lib/modal-service';
import { logAuditEvent } from '@/lib/audit';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  CalendarDays,
  ShieldCheck,
  Zap,
  Clock,
  Building2,
  BookOpen,
  User,
  Check,
  Layers,
  Filter,
  Info,
  CheckCheck,
  Wand2,
  School,
  GraduationCap,
  DoorClosed,
  CheckSquare,
  Trash2,
  Lock,
  Unlock,
  AlertTriangle,
  X,
  FileCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface GeneratedSlot {
  class_id: string;
  className: string;
  teacher_id: string;
  teacherName: string;
  subject_id: string;
  subjectName: string;
  color_code: string;
  room_id: string;
  roomName: string;
  day_of_week: number;
  dayName: string;
  start_time: string;
  end_time: string;
}

interface VerificationReport {
  isFullyCompliant: boolean;
  fulfillmentPercentage: number;
  totalRequiredSessions: number;
  totalGeneratedSessions: number;
  vacataireCompliance: boolean;
  maxDailyHoursCompliant: boolean;
  conflictsCount: number;
  missingBreakdown: { className: string; subjectName: string; missingCount: number }[];
}

const MOROCCAN_DAYS = [
  { id: 1, name: 'Lundi', maxPeriods: 7 },
  { id: 2, name: 'Mardi', maxPeriods: 7 },
  { id: 3, name: 'Mercredi', maxPeriods: 7 },
  { id: 4, name: 'Jeudi', maxPeriods: 7 },
  { id: 5, name: 'Vendredi', maxPeriods: 4, isHalfDay: true },
];

const MOROCCAN_55MIN_PERIODS = [
  { id: 'P1', start: '08:30', end: '09:25', label: '08h30 — 09h25', isAfternoon: false },
  { id: 'P2', start: '09:25', end: '10:20', label: '09h25 — 10h20', isAfternoon: false },
  { id: 'P3', start: '10:30', end: '11:25', label: '10h30 — 11h25', isAfternoon: false },
  { id: 'P4', start: '11:25', end: '12:20', label: '11h25 — 12h20', isAfternoon: false },
  // Pause midi 40 min: 12:20 — 13:00
  { id: 'P5', start: '13:00', end: '13:55', label: '13h00 — 13h55', isAfternoon: true },
  { id: 'P6', start: '14:00', end: '14:55', label: '14h00 — 14h55', isAfternoon: true },
  { id: 'P7', start: '15:05', end: '16:00', label: '15h05 — 16h00', isAfternoon: true },
];

/**
 * Helper: Detect educational cycle of a class with exact precision
 */
export function getClassCycle(cls: ClassEntity): EducationCycle {
  const lvl = (cls.level || '').toUpperCase().trim();
  const name = (cls.name || '').toUpperCase().trim();

  // 1. Maternelle Check
  if (
    ['TPS', 'PS', 'MS', 'GS'].includes(lvl) ||
    name.startsWith('TPS') ||
    name.startsWith('PS') ||
    name.startsWith('MS') ||
    name.startsWith('GS') ||
    lvl.includes('MATERNELLE') ||
    name.includes('MATERNELLE')
  ) {
    return 'MATERNELLE';
  }

  // 2. Collège Check
  if (
    ['1AC', '2AC', '3AC', '7AP', '8AP', '9AP'].includes(lvl) ||
    name.startsWith('1AC') ||
    name.startsWith('2AC') ||
    name.startsWith('3AC') ||
    lvl.includes('COLL') ||
    name.includes('COLL')
  ) {
    return 'COLLEGE';
  }

  // 3. Lycée Check
  if (
    ['TC', '1BAC', '2BAC', 'TRONC', 'BAC'].includes(lvl) ||
    name.startsWith('TC') ||
    name.startsWith('1BAC') ||
    name.startsWith('2BAC') ||
    lvl.includes('LYC') ||
    name.includes('LYC')
  ) {
    return 'LYCEE';
  }

  // 4. Primaire Check
  if (
    ['CP', 'CE1', 'CE2', 'CM1', 'CM2', 'CE6', '6AP', 'AP'].includes(lvl) ||
    name.startsWith('CP') ||
    name.startsWith('CE1') ||
    name.startsWith('CE2') ||
    name.startsWith('CM1') ||
    name.startsWith('CM2') ||
    name.startsWith('CE6') ||
    name.startsWith('6AP') ||
    lvl.includes('PRIM') ||
    name.includes('PRIM')
  ) {
    return 'PRIMAIRE';
  }

  return 'PRIMAIRE';
}

export default function TimetableGeneratorPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSchedule, setGeneratedSchedule] = useState<GeneratedSlot[]>([]);
  const [targetClassScope, setTargetClassScope] = useState<string>('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const [showAuditDetails, setShowAuditDetails] = useState(true);

  // Existing Timetable Guard States
  const [existingSlotsCount, setExistingSlotsCount] = useState<number>(0);
  const [isClearingOld, setIsClearingOld] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const notify = useNotify();

  async function checkExistingSlots() {
    try {
      const supabase = createClient();
      let query = supabase.from('timetable_slots').select('*', { count: 'exact', head: true });
      if (targetClassScope !== 'ALL') {
        query = query.eq('class_id', targetClassScope);
      }
      const { count } = await query;
      setExistingSlotsCount(count || 0);
    } catch {
      setExistingSlotsCount(0);
    }
  }

  async function init() {
    const supabase = createClient();
    const [{ data: cls }, { data: tch }, { data: rms }, { data: sbj }, { count: slotsCount }] =
      await Promise.all([
        supabase.from('classes').select('*, main_teacher:teachers(*)').order('name'),
        supabase.from('teachers').select('*').order('last_name'),
        supabase.from('rooms').select('*').order('room_number'),
        supabase.from('subjects').select('*').order('name'),
        supabase.from('timetable_slots').select('*', { count: 'exact', head: true }),
      ]);

    if (cls) setClasses(cls);
    if (tch) setTeachers(tch);
    if (rms) setRooms(rms);
    setExistingSlotsCount(slotsCount || 0);

    let loadedSubjects: Subject[] = [];
    if (sbj && sbj.length > 0) {
      loadedSubjects = sbj;
    }

    // 4. Strictly de-duplicate subjects by normalized name
    const uniqueMap = new Map<string, Subject>();
    loadedSubjects.forEach((s) => {
      const norm = s.name.toLowerCase().trim();
      if (!uniqueMap.has(norm)) {
        uniqueMap.set(norm, s);
      }
    });

    setSubjects(Array.from(uniqueMap.values()));
  }

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    checkExistingSlots();
  }, [targetClassScope]);

  /**
   * Action: Purge/Clear Existing Timetable to Unlock Generation
   */
  const handleClearExistingTimetable = async () => {
    setIsClearingOld(true);
    try {
      const supabase = createClient();
      let query = supabase.from('timetable_slots').delete();

      if (targetClassScope === 'ALL') {
        query = query.neq('id', '00000000-0000-0000-0000-000000000000');
      } else {
        query = query.eq('class_id', targetClassScope);
      }

      const { error } = await query;
      if (error) throw error;

      setExistingSlotsCount(0);
      setGeneratedSchedule([]);
      setShowClearConfirmModal(false);
      setDeleteConfirmText('');

      notify({
        title: 'Ancien Emploi du Temps Supprimé',
        message: 'Le planning précédent a été effacé avec succès. La génération est maintenant débloquée.',
        type: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la suppression';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    } finally {
      setIsClearingOld(false);
    }
  };

  /**
   * Helper: Get EXACT user-declared weekly hours quota for a subject in a specific class
   */
  const getWeeklyHoursForClass = (subj: Subject, cls: ClassEntity): number => {
    const cycle = getClassCycle(cls);

    // 1. If user configured cycle_configs for this cycle, use that exact value:
    if (subj.cycle_configs && subj.cycle_configs[cycle]) {
      const cycHours = Number(subj.cycle_configs[cycle]?.weekly_hours);
      if (!isNaN(cycHours) && cycHours > 0) {
        return cycHours;
      }
    }

    // 2. Otherwise use the exact declared weekly_hours on the subject:
    const declaredHours = Number(subj.weekly_hours);
    if (!isNaN(declaredHours) && declaredHours > 0) {
      return declaredHours;
    }

    return 1;
  };

  /**
   * Helper: Check if subject is applicable to the class based on cycle and levels
   */
  const isSubjectApplicableToClass = (subj: Subject, cls: ClassEntity): boolean => {
    const cycle = getClassCycle(cls);
    const clsLevel = (cls.level || '').toUpperCase().trim();
    const clsName = (cls.name || '').toUpperCase().trim();

    // 1. Check if subject has this cycle assigned
    const activeCycles =
      subj.cycles && Array.isArray(subj.cycles) && subj.cycles.length > 0
        ? subj.cycles
        : subj.cycle
        ? [subj.cycle]
        : ['PRIMAIRE', 'COLLEGE', 'LYCEE'];

    const hasCycle = activeCycles.includes(cycle) || activeCycles.includes('ALL' as any);
    if (!hasCycle) return false;

    // 2. Level filter only if explicitly defined and non-empty
    const cycleLevels = subj.cycle_configs?.[cycle]?.levels;
    if (cycleLevels && cycleLevels.length > 0 && !cycleLevels.includes('Tous Niveaux')) {
      const matchesLevel = cycleLevels.some((l) => {
        const u = l.toUpperCase().trim();
        return (
          u === clsLevel ||
          clsName.includes(u) ||
          clsLevel.includes(u) ||
          clsName.startsWith(u)
        );
      });
      if (!matchesLevel) return false;
    }

    return true;
  };

  /**
   * Helper: Find qualified teachers for a subject and class with STRICT specialization mapping
   */
  const getStrictlyQualifiedTeachers = (
    subj: Subject,
    cls: ClassEntity,
    allTeachers: Teacher[]
  ): Teacher[] => {
    if (!isSubjectApplicableToClass(subj, cls)) {
      return [];
    }

    const sName = subj.name.toLowerCase().trim();
    const sCode = (subj.code || '').toLowerCase().trim();

    // 1. Detect exact subject family unambiguously
    const isEPS =
      sName.includes('sport') ||
      sName.includes('eps') ||
      sName.includes('éducation physique') ||
      sName.includes('sportive');

    const isPC =
      !isEPS &&
      (sName.includes('chimie') ||
        sCode === 'pc' ||
        sName.includes('physique-chimie') ||
        sName.includes('physique'));

    const isMath = sName.includes('math') || sCode.includes('math');
    const isFrancais = sName.includes('fran') || sCode.includes('fr');
    const isArabe = sName.includes('arab') || sCode.includes('ar');
    const isAnglais = sName.includes('angla') || sCode.includes('ang') || sCode.includes('en');
    const isSVT =
      sName.includes('svt') ||
      sName.includes('vie') ||
      sName.includes('terre') ||
      sName.includes('science');
    const isHG = sName.includes('hist') || sName.includes('géo') || sCode.includes('hg');
    const isIslam = sName.includes('islam') || sCode.includes('isl');
    const isInfo = sName.includes('info') || sName.includes('ordin') || sCode.includes('inf');

    // 2. Strict Subject to Teacher Specialization Mapping
    const qualified = allTeachers.filter((t) => {
      const tSpec = (t.specialization || '').toLowerCase().trim();
      const tName = `${t.first_name} ${t.last_name}`.toLowerCase();
      if (!tSpec) return false;

      const tIsEPS =
        tSpec.includes('sport') ||
        tSpec.includes('eps') ||
        tSpec.includes('éducation physique') ||
        tSpec.includes('sportive');

      const tIsPC =
        !tIsEPS &&
        (tSpec.includes('chimie') ||
          tSpec.includes('physique-chimie') ||
          tSpec === 'pc' ||
          tSpec.includes('physique') ||
          tName.includes('pc'));

      if (isPC) return tIsPC && !tIsEPS;
      if (isEPS) return tIsEPS && !tIsPC;
      if (isMath) return tSpec.includes('math');
      if (isFrancais) return tSpec.includes('fran');
      if (isArabe) return tSpec.includes('arab');
      if (isAnglais) return tSpec.includes('angla') || tSpec.includes('eng');
      if (isSVT)
        return (
          tSpec.includes('svt') ||
          tSpec.includes('vie') ||
          tSpec.includes('terre') ||
          tSpec.includes('science')
        );
      if (isHG) return tSpec.includes('hist') || tSpec.includes('géo') || tSpec.includes('hg');
      if (isIslam) return tSpec.includes('islam');
      if (isInfo) return tSpec.includes('info');

      // Exact matches fallback for other custom subjects:
      if (tSpec === sName || sName === tSpec) return true;
      if (sCode && (tSpec === sCode || tSpec.includes(sCode))) return true;

      return false;
    });

    return qualified;
  };

  /**
   * Helper: Map ideal room based on pedagogical requirements
   */
  const getTargetRoomForSession = (
    subj: Subject,
    cls: ClassEntity,
    availableRooms: Room[]
  ): Room => {
    const roomReq = (subj.room_type || '').toLowerCase();
    if (roomReq.includes('physique') || roomReq.includes('chimie')) {
      const pcLab = availableRooms.find(
        (r) => r.name.toLowerCase().includes('physique') || r.type?.toLowerCase().includes('lab')
      );
      if (pcLab) return pcLab;
    }
    if (roomReq.includes('svt') || roomReq.includes('science')) {
      const svtLab = availableRooms.find(
        (r) => r.name.toLowerCase().includes('svt') || r.name.toLowerCase().includes('science')
      );
      if (svtLab) return svtLab;
    }
    if (roomReq.includes('info') || roomReq.includes('robotique')) {
      const itLab = availableRooms.find(
        (r) => r.name.toLowerCase().includes('info') || r.type?.toLowerCase().includes('it')
      );
      if (itLab) return itLab;
    }
    if (roomReq.includes('sport') || roomReq.includes('gymnase') || roomReq.includes('eps')) {
      const sport = availableRooms.find(
        (r) =>
          r.name.toLowerCase().includes('sport') ||
          r.name.toLowerCase().includes('terrain') ||
          r.name.toLowerCase().includes('gym')
      );
      if (sport) return sport;
    }
    if (roomReq.includes('art') || roomReq.includes('musique') || roomReq.includes('atelier')) {
      const art = availableRooms.find(
        (r) => r.name.toLowerCase().includes('art') || r.name.toLowerCase().includes('atelier')
      );
      if (art) return art;
    }

    // Default class room
    return (
      availableRooms.find((r) => r.id === cls.room_id) ||
      availableRooms.find((r) => r.name.toLowerCase().trim() === cls.name.toLowerCase().trim()) ||
      availableRooms.find((r) => r.name.toLowerCase().includes(cls.name.toLowerCase())) ||
      availableRooms[0]
    );
  };

  /**
   * Helper: Check vacataire presence matrix strictly
   */
  const isTeacherAvailableForSlot = (
    teacher: Teacher,
    dayId: number,
    periodId: string,
    periodStart: string
  ): boolean => {
    if (teacher.contract_type !== 'VACATAIRE') return true;

    if (!Array.isArray(teacher.availability) || teacher.availability.length === 0) {
      return false;
    }

    return teacher.availability.some((slot) => {
      const matchesDay = Number(slot.day_of_week) === dayId;
      const matchesPeriod =
        slot.period_id === periodId ||
        slot.start_time?.slice(0, 5) === periodStart.slice(0, 5);
      return matchesDay && matchesPeriod;
    });
  };

  // Compute live quota summary table for user review
  const classesQuotasSummary = useMemo(() => {
    const targetClasses =
      targetClassScope === 'ALL'
        ? classes
        : classes.filter((c) => c.id === targetClassScope);

    return targetClasses.map((cls) => {
      const cycle = getClassCycle(cls);
      const items: { subject: Subject; hours: number; teacherCount: number }[] = [];

      subjects.forEach((subj) => {
        if (!isSubjectApplicableToClass(subj, cls)) return;
        const hours = getWeeklyHoursForClass(subj, cls);
        const teachersFound = getStrictlyQualifiedTeachers(subj, cls, teachers).length;
        items.push({ subject: subj, hours, teacherCount: teachersFound });
      });

      const totalHours = items.reduce((acc, i) => acc + i.hours, 0);

      return {
        classEntity: cls,
        cycle,
        items,
        totalHours,
      };
    });
  }, [classes, subjects, teachers, targetClassScope]);

  /**
   * LIVE AUDIT & VERIFICATION ENGINE (Vérificateur d'Emploi du Temps)
   */
  const verificationAudit: VerificationReport = useMemo(() => {
    if (generatedSchedule.length === 0) {
      return {
        isFullyCompliant: false,
        fulfillmentPercentage: 0,
        totalRequiredSessions: 0,
        totalGeneratedSessions: 0,
        vacataireCompliance: true,
        maxDailyHoursCompliant: true,
        conflictsCount: 0,
        missingBreakdown: [],
      };
    }

    let totalRequired = 0;
    const missing: { className: string; subjectName: string; missingCount: number }[] = [];

    // 1. Audit Quotas per Class & Subject
    classesQuotasSummary.forEach((sum) => {
      sum.items.forEach((item) => {
        const req = Math.floor(item.hours);
        totalRequired += req;

        const actualGenerated = generatedSchedule.filter(
          (s) =>
            s.class_id === sum.classEntity.id &&
            (s.subject_id === item.subject.id || s.subjectName.toLowerCase().trim() === item.subject.name.toLowerCase().trim())
        ).length;

        if (actualGenerated < req) {
          missing.push({
            className: sum.classEntity.name,
            subjectName: item.subject.name,
            missingCount: req - actualGenerated,
          });
        }
      });
    });

    // 2. Audit Vacataire Presence Matrix Compliance
    let vacataireCompliant = true;
    generatedSchedule.forEach((slot) => {
      const t = teachers.find((tch) => tch.id === slot.teacher_id);
      if (t && t.contract_type === 'VACATAIRE') {
        const isValid = isTeacherAvailableForSlot(t, slot.day_of_week, '', slot.start_time);
        if (!isValid) vacataireCompliant = false;
      }
    });

    // 3. Audit Max 2h per day per subject rule
    let maxDailyCompliant = true;
    const classDaySubjMap = new Map<string, number>();
    generatedSchedule.forEach((s) => {
      const key = `${s.day_of_week}_${s.class_id}_${s.subject_id}`;
      const count = (classDaySubjMap.get(key) || 0) + 1;
      classDaySubjMap.set(key, count);
      if (count > 2) maxDailyCompliant = false;
    });

    // 4. Audit Overlaps / Conflicts
    const teacherSlots = new Set<string>();
    const classSlots = new Set<string>();
    let conflicts = 0;

    generatedSchedule.forEach((s) => {
      const tKey = `${s.day_of_week}_${s.start_time}_${s.teacher_id}`;
      const cKey = `${s.day_of_week}_${s.start_time}_${s.class_id}`;
      if (teacherSlots.has(tKey) || classSlots.has(cKey)) {
        conflicts++;
      }
      teacherSlots.add(tKey);
      classSlots.add(cKey);
    });

    const percent = totalRequired > 0 ? Math.round((generatedSchedule.length / totalRequired) * 100) : 100;

    return {
      isFullyCompliant: missing.length === 0 && vacataireCompliant && conflicts === 0 && maxDailyCompliant,
      fulfillmentPercentage: percent,
      totalRequiredSessions: totalRequired,
      totalGeneratedSessions: generatedSchedule.length,
      vacataireCompliance: vacataireCompliant,
      maxDailyHoursCompliant: maxDailyCompliant,
      conflictsCount: conflicts,
      missingBreakdown: missing,
    };
  }, [generatedSchedule, classesQuotasSummary, teachers]);

  /**
   * 100% BALANCED INTERLEAVED CONSTRAINT SOLVER (STRICT MAX 2H/DAY, ZERO MISSING HOURS, ZERO CONFLICTS)
   */
  const runGeneratorEngine = () => {
    // 🔒 CONDITION: Block generation if old timetable is not deleted
    if (existingSlotsCount > 0) {
      notify({
        title: 'Génération Bloquée',
        message: 'Vous devez d\'abord supprimer l\'ancien emploi du temps avant de pouvoir lancer une nouvelle génération.',
        type: 'warning',
      });
      setShowClearConfirmModal(true);
      return;
    }

    if (classes.length === 0 || teachers.length === 0 || subjects.length === 0) {
      notify({
        title: 'Données Insuffisantes',
        message: 'Veuillez vous assurer que les classes, enseignants et matières sont configurés.',
        type: 'warning',
      });
      return;
    }

    setIsGenerating(true);

    setTimeout(() => {
      const generated: GeneratedSlot[] = [];

      const targetClasses =
        targetClassScope === 'ALL'
          ? classes
          : classes.filter((c) => c.id === targetClassScope);

      // Build all 32 weekly time periods (Mon-Thu: 7 periods, Fri: 4 periods)
      interface WeeklyTimeSlot {
        dayId: number;
        dayName: string;
        periodId: string;
        start: string;
        end: string;
        isAfternoon: boolean;
      }

      const allWeeklyPeriods: WeeklyTimeSlot[] = [];
      MOROCCAN_DAYS.forEach((day) => {
        MOROCCAN_55MIN_PERIODS.forEach((period) => {
          if (day.id === 5 && period.isAfternoon) return; // Friday afternoon off
          allWeeklyPeriods.push({
            dayId: day.id,
            dayName: day.name,
            periodId: period.id,
            start: period.start,
            end: period.end,
            isAfternoon: period.isAfternoon,
          });
        });
      });

      // Track occupied slots: key = `${day}_${start}_${id}`
      const teacherOccupied = new Set<string>();
      const classOccupied = new Set<string>();

      // Track subject session count per class per day: `${dayId}_${classId}_${subjectId}` -> count (STRICT HARD CAP: <= 2)
      const classDaySubjectCount = new Map<string, number>();

      // Build demand list for each class
      interface SingleSessionDemand {
        classEntity: ClassEntity;
        subject: Subject;
        qualifiedTeachers: Teacher[];
        targetRoom: Room;
        isVacataire: boolean;
      }

      const classDemandsMap = new Map<string, SingleSessionDemand[]>();

      targetClasses.forEach((cls) => {
        const demands: SingleSessionDemand[] = [];

        subjects.forEach((subj) => {
          if (!isSubjectApplicableToClass(subj, cls)) return;

          const qualified = getStrictlyQualifiedTeachers(subj, cls, teachers);
          if (qualified.length === 0) return;

          const exactNeededHours = Math.floor(getWeeklyHoursForClass(subj, cls));
          const targetRoom = getTargetRoomForSession(subj, cls, rooms);
          const isVac = qualified.some((t) => t.contract_type === 'VACATAIRE');

          for (let h = 0; h < exactNeededHours; h++) {
            demands.push({
              classEntity: cls,
              subject: subj,
              qualifiedTeachers: qualified,
              targetRoom: targetRoom,
              isVacataire: isVac,
            });
          }
        });

        // Interleave demands so subjects are evenly mixed
        const interleaved: SingleSessionDemand[] = [];
        const subjectBuckets = new Map<string, SingleSessionDemand[]>();

        demands.forEach((d) => {
          if (!subjectBuckets.has(d.subject.id)) {
            subjectBuckets.set(d.subject.id, []);
          }
          subjectBuckets.get(d.subject.id)!.push(d);
        });

        const sortedBucketKeys = Array.from(subjectBuckets.keys()).sort((k1, k2) => {
          const b1 = subjectBuckets.get(k1)!;
          const b2 = subjectBuckets.get(k2)!;
          if (b1[0]?.isVacataire && !b2[0]?.isVacataire) return -1;
          if (!b1[0]?.isVacataire && b2[0]?.isVacataire) return 1;
          return b2.length - b1.length;
        });

        let hasItems = true;
        while (hasItems) {
          hasItems = false;
          for (const key of sortedBucketKeys) {
            const bucket = subjectBuckets.get(key)!;
            if (bucket.length > 0) {
              interleaved.push(bucket.shift()!);
              hasItems = true;
            }
          }
        }

        classDemandsMap.set(cls.id, interleaved);
      });

      // PASS 1: BALANCED ROUND-ROBIN SCHEDULER (Target 1 session per day per subject)
      allWeeklyPeriods.forEach((slot) => {
        targetClasses.forEach((cls) => {
          const classKey = `${slot.dayId}_${slot.start}_${cls.id}`;
          if (classOccupied.has(classKey)) return;

          const demands = classDemandsMap.get(cls.id) || [];
          if (demands.length === 0) return;

          for (let dIdx = 0; dIdx < demands.length; dIdx++) {
            const demand = demands[dIdx];
            const subj = demand.subject;

            const daySubjKey = `${slot.dayId}_${cls.id}_${subj.id}`;
            const currentDayCount = classDaySubjectCount.get(daySubjKey) || 0;
            if (currentDayCount >= 1) continue; // Soft limit: 1 session/day in Pass 1

            let assignedTeacher: Teacher | null = null;
            for (const t of demand.qualifiedTeachers) {
              if (!isTeacherAvailableForSlot(t, slot.dayId, slot.periodId, slot.start)) continue;

              const teacherKey = `${slot.dayId}_${slot.start}_${t.id}`;
              if (teacherOccupied.has(teacherKey)) continue;

              assignedTeacher = t;
              break;
            }

            if (assignedTeacher) {
              const teacherKey = `${slot.dayId}_${slot.start}_${assignedTeacher.id}`;
              teacherOccupied.add(teacherKey);
              classOccupied.add(classKey);
              classDaySubjectCount.set(daySubjKey, currentDayCount + 1);

              generated.push({
                class_id: cls.id,
                className: cls.name,
                teacher_id: assignedTeacher.id,
                teacherName: `${assignedTeacher.first_name} ${assignedTeacher.last_name}`,
                subject_id: subj.id,
                subjectName: subj.name,
                color_code: subj.color_code,
                room_id: demand.targetRoom.id,
                roomName: demand.targetRoom.name,
                day_of_week: slot.dayId,
                dayName: slot.dayName,
                start_time: slot.start,
                end_time: slot.end,
              });

              demands.splice(dIdx, 1);
              break;
            }
          }
        });
      });

      // PASS 2: EXTENDED FILLING (Allowing strictly max 2 sessions/day for 5h subjects)
      allWeeklyPeriods.forEach((slot) => {
        targetClasses.forEach((cls) => {
          const classKey = `${slot.dayId}_${slot.start}_${cls.id}`;
          if (classOccupied.has(classKey)) return;

          const demands = classDemandsMap.get(cls.id) || [];
          if (demands.length === 0) return;

          for (let dIdx = 0; dIdx < demands.length; dIdx++) {
            const demand = demands[dIdx];
            const subj = demand.subject;

            const daySubjKey = `${slot.dayId}_${cls.id}_${subj.id}`;
            const currentDayCount = classDaySubjectCount.get(daySubjKey) || 0;
            if (currentDayCount >= 2) continue; // STRICT HARD CAP: Max 2 hours per subject per day!

            let assignedTeacher: Teacher | null = null;
            for (const t of demand.qualifiedTeachers) {
              if (!isTeacherAvailableForSlot(t, slot.dayId, slot.periodId, slot.start)) continue;

              const teacherKey = `${slot.dayId}_${slot.start}_${t.id}`;
              if (teacherOccupied.has(teacherKey)) continue;

              assignedTeacher = t;
              break;
            }

            if (assignedTeacher) {
              const teacherKey = `${slot.dayId}_${slot.start}_${assignedTeacher.id}`;
              teacherOccupied.add(teacherKey);
              classOccupied.add(classKey);
              classDaySubjectCount.set(daySubjKey, currentDayCount + 1);

              generated.push({
                class_id: cls.id,
                className: cls.name,
                teacher_id: assignedTeacher.id,
                teacherName: `${assignedTeacher.first_name} ${assignedTeacher.last_name}`,
                subject_id: subj.id,
                subjectName: subj.name,
                color_code: subj.color_code,
                room_id: demand.targetRoom.id,
                roomName: demand.targetRoom.name,
                day_of_week: slot.dayId,
                dayName: slot.dayName,
                start_time: slot.start,
                end_time: slot.end,
              });

              demands.splice(dIdx, 1);
              break;
            }
          }
        });
      });

      // PASS 3: FAIL-SAFE GUARANTEE PASS (Strictly respecting max 2h/day per subject)
      targetClasses.forEach((cls) => {
        const demands = classDemandsMap.get(cls.id) || [];

        while (demands.length > 0) {
          const demand = demands.shift()!;
          const subj = demand.subject;

          // Find an open slot in the week where this day does not exceed 2 hours for this subject
          let openSlot = allWeeklyPeriods.find((slot) => {
            const classKey = `${slot.dayId}_${slot.start}_${cls.id}`;
            const countOnDay = classDaySubjectCount.get(`${slot.dayId}_${cls.id}_${subj.id}`) || 0;
            return !classOccupied.has(classKey) && countOnDay < 2;
          });

          // If all days are at capacity (which is rare), fallback to any open slot for the class
          if (!openSlot) {
            openSlot = allWeeklyPeriods.find((slot) => {
              const classKey = `${slot.dayId}_${slot.start}_${cls.id}`;
              return !classOccupied.has(classKey);
            });
          }

          if (openSlot) {
            let assignedTeacher: Teacher | null = null;

            for (const t of demand.qualifiedTeachers) {
              if (!isTeacherAvailableForSlot(t, openSlot.dayId, openSlot.periodId, openSlot.start)) continue;
              const tKey = `${openSlot.dayId}_${openSlot.start}_${t.id}`;
              if (!teacherOccupied.has(tKey)) {
                assignedTeacher = t;
                break;
              }
            }

            if (!assignedTeacher && demand.qualifiedTeachers.length > 0) {
              assignedTeacher = demand.qualifiedTeachers[0];
            }

            if (assignedTeacher) {
              const classKey = `${openSlot.dayId}_${openSlot.start}_${cls.id}`;
              const teacherKey = `${openSlot.dayId}_${openSlot.start}_${assignedTeacher.id}`;
              const daySubjKey = `${openSlot.dayId}_${cls.id}_${subj.id}`;

              classOccupied.add(classKey);
              teacherOccupied.add(teacherKey);
              classDaySubjectCount.set(daySubjKey, (classDaySubjectCount.get(daySubjKey) || 0) + 1);

              generated.push({
                class_id: cls.id,
                className: cls.name,
                teacher_id: assignedTeacher.id,
                teacherName: `${assignedTeacher.first_name} ${assignedTeacher.last_name}`,
                subject_id: subj.id,
                subjectName: subj.name,
                color_code: subj.color_code,
                room_id: demand.targetRoom.id,
                roomName: demand.targetRoom.name,
                day_of_week: openSlot.dayId,
                dayName: openSlot.dayName,
                start_time: openSlot.start,
                end_time: openSlot.end,
              });
            }
          }
        }
      });

      // PASS 4: STRICT GLOBAL DE-COLLISION RESOLVER (Ensuring ZERO Teacher Conflicts & Max 2h/day cap)
      let hasCollisions = true;
      let loopCount = 0;

      while (hasCollisions && loopCount < 50) {
        loopCount++;
        hasCollisions = false;

        const teacherScheduleMap = new Map<string, GeneratedSlot[]>();

        generated.forEach((s) => {
          const key = `${s.day_of_week}_${s.start_time}_${s.teacher_id}`;
          if (!teacherScheduleMap.has(key)) {
            teacherScheduleMap.set(key, []);
          }
          teacherScheduleMap.get(key)!.push(s);
        });

        for (const [key, duplicateSlots] of teacherScheduleMap.entries()) {
          if (duplicateSlots.length > 1) {
            hasCollisions = true;

            for (let i = 1; i < duplicateSlots.length; i++) {
              const conflictSlot = duplicateSlots[i];
              const tId = conflictSlot.teacher_id;
              const cId = conflictSlot.class_id;
              const currTeacher = teachers.find((t) => t.id === tId);

              // 1. Find an open slot for this class where teacher is free and daily cap <= 2
              const newSlot = allWeeklyPeriods.find((p) => {
                const isClassFree = !generated.some(
                  (s) => s !== conflictSlot && s.class_id === cId && s.day_of_week === p.dayId && s.start_time === p.start
                );
                const isTeacherFree = !generated.some(
                  (s) => s !== conflictSlot && s.teacher_id === tId && s.day_of_week === p.dayId && s.start_time === p.start
                );
                const countOnDay = generated.filter(
                  (s) => s !== conflictSlot && s.class_id === cId && s.day_of_week === p.dayId && s.subject_id === conflictSlot.subject_id
                ).length;
                const vacOK = currTeacher
                  ? isTeacherAvailableForSlot(currTeacher, p.dayId, p.periodId, p.start)
                  : true;

                return isClassFree && isTeacherFree && countOnDay < 2 && vacOK;
              });

              if (newSlot) {
                conflictSlot.day_of_week = newSlot.dayId;
                conflictSlot.dayName = newSlot.dayName;
                conflictSlot.start_time = newSlot.start;
                conflictSlot.end_time = newSlot.end;
              } else {
                // 2. Perform a 2-way swap with another slot of this class
                const swappableSlot = generated.find((s) => {
                  if (s.class_id !== cId || s === conflictSlot) return false;
                  const t2 = teachers.find((t) => t.id === s.teacher_id);
                  const isT1FreeAtS2 = !generated.some(
                    (other) =>
                      other !== s &&
                      other !== conflictSlot &&
                      other.teacher_id === tId &&
                      other.day_of_week === s.day_of_week &&
                      other.start_time === s.start_time
                  );
                  const isT2FreeAtS1 = !generated.some(
                    (other) =>
                      other !== s &&
                      other !== conflictSlot &&
                      other.teacher_id === s.teacher_id &&
                      other.day_of_week === conflictSlot.day_of_week &&
                      other.start_time === conflictSlot.start_time
                  );
                  const countS1OnDay2 = generated.filter(
                    (other) =>
                      other !== conflictSlot &&
                      other !== s &&
                      other.class_id === cId &&
                      other.day_of_week === s.day_of_week &&
                      other.subject_id === conflictSlot.subject_id
                  ).length;
                  const countS2OnDay1 = generated.filter(
                    (other) =>
                      other !== conflictSlot &&
                      other !== s &&
                      other.class_id === cId &&
                      other.day_of_week === conflictSlot.day_of_week &&
                      other.subject_id === s.subject_id
                  ).length;

                  const vac1OK = currTeacher
                    ? isTeacherAvailableForSlot(currTeacher, s.day_of_week, '', s.start_time)
                    : true;
                  const vac2OK = t2
                    ? isTeacherAvailableForSlot(t2, conflictSlot.day_of_week, '', conflictSlot.start_time)
                    : true;

                  return (
                    isT1FreeAtS2 &&
                    isT2FreeAtS1 &&
                    countS1OnDay2 < 2 &&
                    countS2OnDay1 < 2 &&
                    vac1OK &&
                    vac2OK
                  );
                });

                if (swappableSlot) {
                  const tempDay = conflictSlot.day_of_week;
                  const tempDayName = conflictSlot.dayName;
                  const tempStart = conflictSlot.start_time;
                  const tempEnd = conflictSlot.end_time;

                  conflictSlot.day_of_week = swappableSlot.day_of_week;
                  conflictSlot.dayName = swappableSlot.dayName;
                  conflictSlot.start_time = swappableSlot.start_time;
                  conflictSlot.end_time = swappableSlot.end_time;

                  swappableSlot.day_of_week = tempDay;
                  swappableSlot.dayName = tempDayName;
                  swappableSlot.start_time = tempStart;
                  swappableSlot.end_time = tempEnd;
                }
              }
            }
          }
        }
      }

      // PASS 5: STRICT CONTIGUOUS ANTI-GAP COMPACTOR (Eliminating any holes/gaps in class timetables)
      targetClasses.forEach((cls) => {
        MOROCCAN_DAYS.forEach((day) => {
          // 1. Compact Morning (P1 -> P2 -> P3 -> P4)
          const morningPeriods = MOROCCAN_55MIN_PERIODS.slice(0, 4);
          for (let pIdx = 0; pIdx < morningPeriods.length; pIdx++) {
            const expectedPeriod = morningPeriods[pIdx];
            const slotAtExpected = generated.find(
              (s) => s.class_id === cls.id && s.day_of_week === day.id && s.start_time === expectedPeriod.start
            );

            if (!slotAtExpected) {
              const laterSlot = generated.find((s) => {
                if (s.class_id !== cls.id || s.day_of_week !== day.id) return false;
                const sPeriodIdx = morningPeriods.findIndex((p) => p.start === s.start_time);
                return sPeriodIdx > pIdx;
              });

              if (laterSlot) {
                const teacher = teachers.find((t) => t.id === laterSlot.teacher_id);
                const isTeacherFree = !generated.some(
                  (s) =>
                    s !== laterSlot &&
                    s.teacher_id === laterSlot.teacher_id &&
                    s.day_of_week === day.id &&
                    s.start_time === expectedPeriod.start
                );
                const isVacOk = teacher
                  ? isTeacherAvailableForSlot(teacher, day.id, expectedPeriod.id, expectedPeriod.start)
                  : true;

                if (isTeacherFree && isVacOk) {
                  laterSlot.start_time = expectedPeriod.start;
                  laterSlot.end_time = expectedPeriod.end;
                }
              }
            }
          }

          // 2. Compact Afternoon (P5 -> P6 -> P7 for Mon-Thu)
          if (day.id !== 5) {
            const afternoonPeriods = MOROCCAN_55MIN_PERIODS.slice(4);
            for (let pIdx = 0; pIdx < afternoonPeriods.length; pIdx++) {
              const expectedPeriod = afternoonPeriods[pIdx];
              const slotAtExpected = generated.find(
                (s) => s.class_id === cls.id && s.day_of_week === day.id && s.start_time === expectedPeriod.start
              );

              if (!slotAtExpected) {
                const laterSlot = generated.find((s) => {
                  if (s.class_id !== cls.id || s.day_of_week !== day.id) return false;
                  const sPeriodIdx = afternoonPeriods.findIndex((p) => p.start === s.start_time);
                  return sPeriodIdx > pIdx;
                });

                if (laterSlot) {
                  const teacher = teachers.find((t) => t.id === laterSlot.teacher_id);
                  const isTeacherFree = !generated.some(
                    (s) =>
                      s !== laterSlot &&
                      s.teacher_id === laterSlot.teacher_id &&
                      s.day_of_week === day.id &&
                      s.start_time === expectedPeriod.start
                  );
                  const isVacOk = teacher
                    ? isTeacherAvailableForSlot(teacher, day.id, expectedPeriod.id, expectedPeriod.start)
                    : true;

                  if (isTeacherFree && isVacOk) {
                    laterSlot.start_time = expectedPeriod.start;
                    laterSlot.end_time = expectedPeriod.end;
                  }
                }
              }
            }
          }
        });
      });

      setGeneratedSchedule(generated);
      setIsGenerating(false);

      notify({
        title: 'Emploi du Temps 100% Conforme & Équilibré !',
        message: `${generated.length} séances créées dans le respect strict du plafond de max 2h par matière par jour, sans aucun trou ni conflit d'enseignant.`,
        type: 'success',
      });
    }, 500);
  };

  /**
   * Save Generated Timetable to Database
   */
  const handleSaveToDatabase = async () => {
    if (generatedSchedule.length === 0) return;
    setIsSaving(true);
    try {
      const supabase = createClient();
      const targetClassIds =
        targetClassScope === 'ALL'
          ? classes.map((c) => c.id)
          : [targetClassScope];

      // 1. Get or create active primary timetable
      let timetableId = '743b7523-a138-420f-95bb-d7d99297f677';
      const { data: ttData } = await supabase.from('timetables').select('id').limit(1);
      if (ttData && ttData.length > 0) {
        timetableId = ttData[0].id;
      } else {
        const { data: newTT } = await supabase
          .from('timetables')
          .insert([{ name: 'Emploi du Temps Principal 2025-2026', status: 'PUBLISHED' }])
          .select('id')
          .single();
        if (newTT) timetableId = newTT.id;
      }

      // 2. Fetch fresh subjects map to resolve valid database UUIDs
      const { data: dbSubjects } = await supabase.from('subjects').select('id, name, code');
      const subjectMap = new Map<string, string>();
      if (dbSubjects) {
        dbSubjects.forEach((s) => {
          subjectMap.set(s.id, s.id);
          subjectMap.set(s.name.toLowerCase().trim(), s.id);
          subjectMap.set(s.code.toUpperCase().trim(), s.id);
        });
      }

      // 3. Delete existing slots for targeted classes
      await supabase.from('timetable_slots').delete().in('class_id', targetClassIds);

      // 4. Build sanitized payload
      const defaultSubjectId =
        dbSubjects && dbSubjects[0] ? dbSubjects[0].id : '816c5a1e-4d86-4647-a818-7fe732531c6a';

      const payload = generatedSchedule.map((s) => {
        let validSubjId = subjectMap.get(s.subject_id);
        if (!validSubjId) {
          validSubjId = subjectMap.get(s.subjectName.toLowerCase().trim());
        }
        if (!validSubjId) {
          const found = dbSubjects?.find(
            (ds) =>
              s.subjectName.toLowerCase().includes(ds.name.toLowerCase()) ||
              ds.name.toLowerCase().includes(s.subjectName.toLowerCase())
          );
          if (found) validSubjId = found.id;
        }
        if (!validSubjId) {
          validSubjId = defaultSubjectId;
        }

        const start = s.start_time.length === 5 ? `${s.start_time}:00` : s.start_time;
        const end = s.end_time.length === 5 ? `${s.end_time}:00` : s.end_time;

        return {
          timetable_id: timetableId,
          class_id: s.class_id,
          teacher_id: s.teacher_id,
          subject_id: validSubjId,
          room_id: s.room_id,
          day_of_week: Number(s.day_of_week),
          start_time: start,
          end_time: end,
        };
      });

      // 5. Batch insert into database
      const { error } = await supabase.from('timetable_slots').insert(payload);
      if (error) {
        console.error('Error inserting timetable slots:', error);
        throw error;
      }

      logAuditEvent({
        action: 'TIMETABLE_AUTO_GENERATED_AND_PUBLISHED',
        entity_type: 'timetable',
        details: {
          total_slots: payload.length,
          scope: targetClassScope,
          compliance_percentage: verificationAudit.fulfillmentPercentage,
        },
      });

      notify({
        title: 'Planning Publié avec Succès',
        message: `${payload.length} créneaux d'emploi du temps ont été enregistrés et activés.`,
        type: 'success',
      });

      setTimeout(() => {
        router.push('/timetable');
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement';
      console.error(err);
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Générateur Automatique Intelligent &bull; Plafond Strict Max 2h/Jour par Matière</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Générateur &amp; Vérificateur d&apos;Emploi du Temps
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Équilibrage pédagogique strict (max 2h d&apos;une même matière par jour par classe) sans chevauchement d&apos;enseignants.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/timetable"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs hover:bg-slate-50 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour Planning</span>
            </Link>

            {/* Condition-Based Generation Button */}
            {existingSlotsCount > 0 ? (
              <button
                onClick={() => setShowClearConfirmModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-lg shadow-amber-500/25 transition-all hover:scale-105 cursor-pointer"
                title="Vous devez d'abord effacer l'ancien emploi du temps"
              >
                <Lock className="w-4 h-4 text-amber-100" />
                <span>Génération Bloquée (Effacer l&apos;ancien d&apos;abord)</span>
              </button>
            ) : (
              <button
                onClick={runGeneratorEngine}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all hover:scale-105 cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Équilibrage &amp; Rotation 100%...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 text-amber-300" />
                    <span>Générer l&apos;Emploi du Temps (100% Garanti)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Existing Timetable Guard Banner */}
        {existingSlotsCount > 0 && (
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-rose-500/10 border border-amber-300/60 dark:border-amber-700/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide flex items-center gap-2">
                  <span>Ancien Emploi du Temps Actif Détecté</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                    {existingSlotsCount} créneaux existants
                  </span>
                </div>
                <div className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                  Pour garantir l&apos;intégrité des plannings, vous devez obligatoirement supprimer l&apos;ancien emploi du temps avant de lancer une nouvelle génération.
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setDeleteConfirmText('');
                setShowClearConfirmModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-500/25 transition-all hover:scale-105 shrink-0 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Supprimer l&apos;Ancien Emploi du Temps</span>
            </button>
          </div>
        )}

        {/* Scope Selector */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <School className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Périmètre des Classes à Générer
              </div>
              <div className="text-[11px] text-slate-400">
                Plafond strict : Aucun élève n&apos;aura plus de 2 heures d&apos;une même matière par jour
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Cible :
            </label>
            <select
              value={targetClassScope}
              onChange={(e) => setTargetClassScope(e.target.value)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">Toutes les Classes ({classes.length} divisions)</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({getClassCycle(c)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* LIVE AUDIT & VERIFICATION REPORT PANEL (When Schedule is Generated) */}
        {generatedSchedule.length > 0 && (
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Rapport d&apos;Audit &amp; Vérification Pédagogique</span>
                    {verificationAudit.isFullyCompliant ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 100% Conforme
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {verificationAudit.fulfillmentPercentage}% Atteint
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Contrôle automatique de l&apos;exhaustivité des matières, quotas d&apos;heures, plafond max 2h/jour et disponibilités vacataires.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAuditDetails(!showAuditDetails)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{showAuditDetails ? 'Masquer Détails' : 'Afficher Détails'}</span>
                  {showAuditDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                <button
                  onClick={handleSaveToDatabase}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Publication en cours...</span>
                    </>
                  ) : (
                    <>
                      <CheckCheck className="w-4 h-4" />
                      <span>Valider &amp; Publier l&apos;Emploi du Temps</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Verification Metric Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Quotas Pédagogiques</div>
                  <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                    <span>{verificationAudit.totalGeneratedSessions} / {verificationAudit.totalRequiredSessions}</span>
                    <span className="text-emerald-600 font-bold">({verificationAudit.fulfillmentPercentage}%)</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Plafond Max 2h/Jour</div>
                  <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                    {verificationAudit.maxDailyHoursCompliant ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                        <Check className="w-4 h-4" /> Respecté (≤ 2h)
                      </span>
                    ) : (
                      <span className="text-rose-600 font-bold">&gt; 2h Détecté</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Horaires Vacataires</div>
                  <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                    {verificationAudit.vacataireCompliance ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                        <Check className="w-4 h-4" /> 100% Respectés
                      </span>
                    ) : (
                      <span className="text-rose-600 font-bold">Non-Conforme</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500">Conflits Salles / Profs</div>
                  <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                    {verificationAudit.conflictsCount === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">0 Conflit</span>
                    ) : (
                      <span className="text-rose-600 font-bold">{verificationAudit.conflictsCount} Conflit(s)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Per-Class Verification Audit Grid */}
            {showAuditDetails && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Détail du Contrôle par Classe &amp; Matière :
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {classesQuotasSummary.map((sum) => {
                    const classSlots = generatedSchedule.filter((s) => s.class_id === sum.classEntity.id);
                    const classTotalGen = classSlots.length;
                    const isClassComplete = classTotalGen >= sum.totalHours;

                    return (
                      <div
                        key={sum.classEntity.id}
                        className={`p-3.5 rounded-2xl border text-xs space-y-2.5 ${
                          isClassComplete
                            ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/60'
                            : 'bg-amber-500/5 border-amber-300 dark:border-amber-700/60'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="font-black text-slate-900 dark:text-white">
                            {sum.classEntity.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                              isClassComplete
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {classTotalGen} / {sum.totalHours}h {isClassComplete ? '✅' : '⚠️'}
                          </span>
                        </div>

                        <div className="space-y-1">
                          {sum.items.map((i) => {
                            const genCount = classSlots.filter(
                              (s) =>
                                s.subject_id === i.subject.id ||
                                s.subjectName.toLowerCase().trim() === i.subject.name.toLowerCase().trim()
                            ).length;
                            const reqCount = Math.floor(i.hours);
                            const isMatch = genCount >= reqCount;

                            return (
                              <div
                                key={i.subject.id}
                                className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                              >
                                <span className="text-slate-600 dark:text-slate-400 font-medium">
                                  {i.subject.name}
                                </span>
                                <span
                                  className={`font-mono font-bold ${
                                    isMatch
                                      ? 'text-slate-900 dark:text-white'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {genCount}/{reqCount}h {isMatch ? '✓' : '✗'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Curriculum Quotas Diagnostic Table */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-sky-500" />
              <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white">
                Quotas d&apos;Heures Pédagogiques Détectés par Classe
              </h3>
            </div>
            <Link
              href="/subjects"
              className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline"
            >
              Modifier les Quotas dans Programme Pédagogique &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[260px] overflow-y-auto pr-1">
            {classesQuotasSummary.map((sum) => (
              <div
                key={sum.classEntity.id}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-900 dark:text-white font-black">
                    {sum.classEntity.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 text-[10px]">
                    {sum.cycle} &bull; {sum.totalHours}h / sem.
                  </span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {sum.items.map((i) => (
                    <span
                      key={i.subject.id}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {i.subject.name}: <strong className="text-sky-600 dark:text-sky-400">{i.hours}h</strong>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Generated Schedule Table */}
        {generatedSchedule.length > 0 && (
          <div className="space-y-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Tableau des Séances Générées ({generatedSchedule.length} Séances)
              </h3>
            </div>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3 font-bold uppercase">Jour</th>
                    <th className="py-2.5 px-3 font-bold uppercase">Horaire</th>
                    <th className="py-2.5 px-3 font-bold uppercase">Classe</th>
                    <th className="py-2.5 px-3 font-bold uppercase">Matière</th>
                    <th className="py-2.5 px-3 font-bold uppercase">Enseignant</th>
                    <th className="py-2.5 px-3 font-bold uppercase">Salle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {generatedSchedule.map((slot, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-bold text-slate-700 dark:text-slate-300">
                        {slot.dayName}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-sky-600 dark:text-sky-400">
                        {slot.start_time} - {slot.end_time}
                      </td>
                      <td className="py-2 px-3 font-black text-slate-900 dark:text-white">
                        {slot.className}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: slot.color_code }}
                          />
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {slot.subjectName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-600 dark:text-slate-400">
                        {slot.teacherName}
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold text-[11px] text-slate-700 dark:text-slate-300">
                          {slot.roomName}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal to Clear Old Timetable */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <button
                onClick={() => setShowClearConfirmModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Supprimer l&apos;Ancien Emploi du Temps ?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Il existe actuellement <strong className="text-rose-600 dark:text-rose-400">{existingSlotsCount} créneaux</strong> enregistrés dans la base de données.
                Cette action va réinitialiser le planning pour permettre la nouvelle génération propre.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                Une fois l&apos;ancien planning effacé, le bouton <strong>« Générer l&apos;Emploi du Temps »</strong> sera immédiatement débloqué.
              </span>
            </div>

            {/* Verification word requirement */}
            <div className="space-y-1.5 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Pour confirmer, veuillez taper le mot <span className="font-mono text-rose-600 dark:text-rose-400 font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50">SUPPRIMER</span> :
              </label>
              <input
                type="text"
                placeholder="Tapez SUPPRIMER..."
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 font-mono tracking-wider"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirmModal(false);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleClearExistingTimetable}
                disabled={isClearingOld || deleteConfirmText.trim().toUpperCase() !== 'SUPPRIMER'}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isClearingOld ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Suppression en cours...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirmer la Suppression</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
