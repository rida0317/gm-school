'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { StaffMember, Teacher } from '@/types/database';
import { useI18n } from '@/lib/i18n';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useConfirm, useNotify } from '@/lib/modal-service';
import {
  Shield,
  Zap,
  Printer,
  Download,
  Save,
  CheckCircle2,
  Sparkles,
  Search,
  Users,
  Calendar,
  Clock,
  Check,
  X,
  FileSpreadsheet,
  HelpCircle,
  AlertCircle,
  Building2,
  CalendarDays,
  Plus,
  Trash2,
  UtensilsCrossed,
  Layers,
  MapPin,
  TrendingDown,
  Baby,
  AlertTriangle,
  UserPlus,
  Wrench,
  ArrowRight
} from 'lucide-react';

export interface SchoolFloor {
  id: string;
  name: string;
  requiredTeachers: number; // quota d'enseignants requis par étage (Matin & Soir)
  color: string;
  isMaternelleOnly?: boolean; // Réservé exclusivement aux enseignants de Maternelle (ex: Sous-sol)
  hasLunchGuard?: boolean;    // false pour RDC et Sous-sol
}

export interface ShiftConfig {
  staffId: string;
  expectedEntry: string;
  expectedExit: string;
  hasGarde: boolean;
  gardeDays?: number[];        // [1, 2, ...] Garde Sortie (16:00 Lun-Jeu, 12:20 Vendredi)
  hasGardeEntry?: boolean;
  gardeEntryDays?: number[];   // [1, 2, ...] Garde Matin (08:00)
  hasGardeLunch?: boolean;
  gardeLunchDays?: number[];   // [1, 2, ...] Garde Déjeuner (12:20, Lun-Jeu uniquement)
  assignedFloors?: Record<number, string>; // dayNum -> floorId
}

const STORAGE_KEY_MASTER = 'gm_staff_permanent_shifts_master_v1';
const STORAGE_KEY_FLOORS = 'gm_school_floors_config_v1';
const STORAGE_KEY_MATERNELLE_IDS = 'gm_teachers_maternelle_ids_v1';

// Default school floors with RDC & Sous-sol excluded from Lunch and Sous-sol Maternelle-only
const DEFAULT_FLOORS: SchoolFloor[] = [
  { id: 'floor-ss', name: 'Sous-sol (Maternelle)', requiredTeachers: 1, color: 'pink', isMaternelleOnly: true, hasLunchGuard: false },
  { id: 'floor-rdc', name: 'Rez-de-chaussée & Cour', requiredTeachers: 2, color: 'emerald', isMaternelleOnly: false, hasLunchGuard: false },
  { id: 'floor-1', name: '1er Étage', requiredTeachers: 1, color: 'sky', isMaternelleOnly: false, hasLunchGuard: true },
  { id: 'floor-2', name: '2ème Étage', requiredTeachers: 1, color: 'purple', isMaternelleOnly: false, hasLunchGuard: true },
];

// Official School Days (Samedi exclu - Sortie Garde 16:15 Lun-Jeu, Vendredi sortie à 12h20)
const SCHOOL_DAYS = [
  { id: 1, name: 'Lundi', short: 'Lun', exitTime: '16:15', hasLunch: true },
  { id: 2, name: 'Mardi', short: 'Mar', exitTime: '16:15', hasLunch: true },
  { id: 3, name: 'Mercredi', short: 'Mer', exitTime: '16:15', hasLunch: true },
  { id: 4, name: 'Jeudi', short: 'Jeu', exitTime: '16:15', hasLunch: true },
  { id: 5, name: 'Vendredi', short: 'Ven', exitTime: '12:20', hasLunch: false },
];

export interface GardeTeacher {
  id: string;
  first_name: string;
  last_name: string;
  staff_code: string;
  role_title: string;
  department?: string;
  specialization?: string;
  teaching_levels?: string[];
  is_active: boolean;
}

// Helper to determine if a teacher belongs to Maternelle
export function isMaternelleTeacher(
  t: GardeTeacher,
  customMaternelleIds?: string[]
): boolean {
  if (customMaternelleIds && customMaternelleIds.includes(t.id)) {
    return true;
  }
  const role = (t.role_title || '').toUpperCase();
  const spec = (t.specialization || '').toUpperCase();
  const dep = (t.department || '').toUpperCase();

  const hasMaternelleLevel =
    Array.isArray(t.teaching_levels) &&
    t.teaching_levels.some((l) => {
      const u = String(l).toUpperCase();
      return u === 'TPS' || u === 'PS' || u === 'MS' || u === 'GS' || u.includes('MATERN');
    });

  return (
    role.includes('MATERN') ||
    spec.includes('MATERN') ||
    dep.includes('MATERN') ||
    role.includes('ÉDUCATRICE') ||
    role.includes('EDUCATRICE') ||
    hasMaternelleLevel
  );
}

export default function GardesPlanningPage() {
  const { t, dir } = useI18n();
  const confirm = useConfirm();
  const notify = useNotify();

  // State
  const [teachers, setTeachers] = useState<GardeTeacher[]>([]);
  const [timetableSlots, setTimetableSlots] = useState<any[]>([]);
  const [staffShifts, setStaffShifts] = useState<Record<string, ShiftConfig>>({});
  const [floors, setFloors] = useState<SchoolFloor[]>(DEFAULT_FLOORS);
  const [maternelleTeacherIds, setMaternelleTeacherIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'grid_floors' | 'matrix_teachers'>('grid_floors');

  // Helper to get floor slots (Matin, Midi, Soir)
  const getFloorSlots = (floor: SchoolFloor) => {
    const slots: Array<{ key: 'morning' | 'lunch' | 'evening'; label: string; time: string; badgeColor: string }> = [
      { key: 'morning', label: 'Matin', time: '08h00', badgeColor: 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300' },
    ];
    if (floor.hasLunchGuard !== false) {
      slots.push({ key: 'lunch', label: 'Midi', time: '12h20', badgeColor: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300' });
    }
    slots.push({ key: 'evening', label: 'Soir', time: '16h00 (Ven 12h20)', badgeColor: 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300' });
    return slots;
  };

  // Helper to get assigned teachers for a given floor, day, and slot
  const getSlotAssignedTeachers = (floorId: string, dayId: number, slotType: 'morning' | 'lunch' | 'evening') => {
    return teachers.filter((t) => {
      const shift = staffShifts[t.id];
      if (!shift) return false;
      const fId = shift.assignedFloors?.[dayId] || floors[0]?.id;
      if (fId !== floorId) return false;
      if (slotType === 'morning') return shift.gardeEntryDays?.includes(dayId);
      if (slotType === 'lunch') return dayId !== 5 && shift.gardeLunchDays?.includes(dayId);
      if (slotType === 'evening') return shift.gardeDays?.includes(dayId);
      return false;
    });
  };

  // Floors Config Modal
  const [showFloorsModal, setShowFloorsModal] = useState<boolean>(false);
  const [newFloorName, setNewFloorName] = useState<string>('');
  const [newFloorQuota, setNewFloorQuota] = useState<number>(1);
  const [newFloorColor, setNewFloorColor] = useState<string>('purple');
  const [newFloorIsMaternelle, setNewFloorIsMaternelle] = useState<boolean>(false);
  const [newFloorHasLunch, setNewFloorHasLunch] = useState<boolean>(true);

  // Manual Fix & Quick Assignment Modal State
  const [activeFloorForManualFix, setActiveFloorForManualFix] = useState<SchoolFloor | null>(null);
  const [manualFixDay, setManualFixDay] = useState<number>(1);
  const [manualFixSearch, setManualFixSearch] = useState<string>('');
  const [manualFixFilter, setManualFixFilter] = useState<'all' | 'maternelle' | 'available_today'>('all');

  // Sync / Save states
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [isSavedFeedback, setIsSavedFeedback] = useState<boolean>(false);

  // Defaults (Horaires Officiels : Entrée 08:15, Garde Matin 08:00, Sortie 16:15, Vendredi 12:20)
  const [defaultEntry, setDefaultEntry] = useState<string>('08:15');
  const [defaultExit, setDefaultExit] = useState<string>('16:15');

  // Load teachers, timetable slots, floors, and permanent shifts
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const supabase = createClient();
        
        // 1. Fetch teachers (Strictly exclude Vacataires - Vacataires ne font JAMAIS de garde ni de remplacement)
        const { data: tchData } = await supabase.from('teachers').select('*').order('last_name');
        if (tchData) {
          const permanentTeachers = tchData.filter((t: Teacher) => {
            const ct = (t.contract_type || '').toUpperCase().trim();
            const spec = (t.specialization || '').toUpperCase().trim();
            return !ct.includes('VACAT') && !spec.includes('VACAT');
          });

          const mapped: GardeTeacher[] = permanentTeachers.map((t: Teacher) => ({
            id: t.id,
            first_name: t.first_name,
            last_name: t.last_name,
            staff_code: t.teacher_code || t.id.substring(0, 6).toUpperCase(),
            role_title: t.specialization || 'Enseignant',
            department: 'Pédagogique',
            specialization: t.specialization,
            teaching_levels: t.teaching_levels,
            is_active: t.status !== 'INACTIVE',
          }));
          setTeachers(mapped);
        }

        // 2. Fetch timetable slots
        const { data: slotsData } = await supabase.from('timetable_slots').select('*');
        if (slotsData) {
          setTimetableSlots(slotsData);
        }

        // 3. Load from Supabase 'gardes_planning' table
        const { data: dbPlanning, error: dbError } = await supabase
          .from('gardes_planning')
          .select('*')
          .eq('id', 'master')
          .maybeSingle();

        let loadedFloors = DEFAULT_FLOORS;
        let loadedMatIds: string[] = [];
        let loadedShifts: Record<string, ShiftConfig> = {};

        if (dbPlanning) {
          if (Array.isArray(dbPlanning.floors) && dbPlanning.floors.length > 0) {
            loadedFloors = dbPlanning.floors;
          }
          if (Array.isArray(dbPlanning.maternelle_teacher_ids)) {
            loadedMatIds = dbPlanning.maternelle_teacher_ids;
          }
          if (dbPlanning.shifts && typeof dbPlanning.shifts === 'object') {
            loadedShifts = dbPlanning.shifts;
          }
        } else {
          // Fallback to localStorage if Supabase has no master row yet
          try {
            const savedMat = localStorage.getItem(STORAGE_KEY_MATERNELLE_IDS);
            if (savedMat) loadedMatIds = JSON.parse(savedMat);
            const savedFloors = localStorage.getItem(STORAGE_KEY_FLOORS);
            if (savedFloors) loadedFloors = JSON.parse(savedFloors);
            const savedMaster = localStorage.getItem(STORAGE_KEY_MASTER);
            if (savedMaster) loadedShifts = JSON.parse(savedMaster);
          } catch {
            // ignore
          }
        }

        // Ensure every permanent teacher has an entry
        if (tchData) {
          tchData.forEach((t: Teacher) => {
            if (!loadedShifts[t.id]) {
              loadedShifts[t.id] = {
                staffId: t.id,
                expectedEntry: '08:15',
                expectedExit: '16:15',
                hasGarde: false,
                hasGardeEntry: false,
                hasGardeLunch: false,
                gardeDays: [],
                gardeEntryDays: [],
                gardeLunchDays: [],
                assignedFloors: {},
              };
            }
          });
        }

        setFloors(loadedFloors);
        setMaternelleTeacherIds(loadedMatIds);
        setStaffShifts(loadedShifts);

        // Cache in localStorage
        try {
          localStorage.setItem(STORAGE_KEY_FLOORS, JSON.stringify(loadedFloors));
          localStorage.setItem(STORAGE_KEY_MATERNELLE_IDS, JSON.stringify(loadedMatIds));
          localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(loadedShifts));
        } catch {
          // ignore
        }
      } catch (err) {
        console.error('Error loading gardes planning data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Compute total weekly teaching hours/slots for each teacher
  const teacherWeeklyHoursMap = useMemo(() => {
    const map: Record<string, number> = {};
    teachers.forEach((t) => {
      const count = timetableSlots.filter(
        (s) =>
          s.teacher_id === t.id ||
          s.teacher_id === t.staff_code ||
          (t.staff_code && s.teacher_code === t.staff_code)
      ).length;
      map[t.id] = count;
    });
    return map;
  }, [teachers, timetableSlots]);

  // Save everything to Supabase and cache locally
  const saveToSupabase = async (
    shiftsToSave?: Record<string, ShiftConfig>,
    floorsToSave?: SchoolFloor[],
    maternelleIdsToSave?: string[],
    silent = true
  ) => {
    const s = shiftsToSave || staffShifts;
    const f = floorsToSave || floors;
    const m = maternelleIdsToSave || maternelleTeacherIds;

    // Cache locally immediately & broadcast update
    try {
      localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(s));
      localStorage.setItem(STORAGE_KEY_FLOORS, JSON.stringify(f));
      localStorage.setItem(STORAGE_KEY_MATERNELLE_IDS, JSON.stringify(m));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('gm_gardes_planning_updated', {
            detail: { shifts: s, floors: f, maternelle_teacher_ids: m },
          })
        );
      }
    } catch {
      // ignore
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.from('gardes_planning').upsert({
        id: 'master',
        floors: f,
        maternelle_teacher_ids: m,
        shifts: s,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Supabase save error:', error);
        if (!silent) {
          notify({
            title: 'Sauvegardé en Cache Local',
            message: `Erreur de connexion Supabase (${error.message}). Sauvegardé en local.`,
            type: 'warning',
          });
        }
      } else {
        if (!silent) {
          setIsSavedFeedback(true);
          notify({
            title: 'Enregistré dans Supabase ☁️',
            message: 'Le planning des gardes et la configuration des étages ont été enregistrés avec succès dans Supabase.',
            type: 'success',
          });
          setTimeout(() => setIsSavedFeedback(false), 3000);
        }
      }
    } catch (err: any) {
      console.error('Save to Supabase failed:', err);
    }
  };

  // Toggle teacher Maternelle designation
  const toggleTeacherMaternelle = (teacherId: string) => {
    setMaternelleTeacherIds((prev) => {
      const exists = prev.includes(teacherId);
      const next = exists ? prev.filter((id) => id !== teacherId) : [...prev, teacherId];
      
      saveToSupabase(staffShifts, floors, next, true);

      notify({
        title: exists ? 'Désignation Retirée' : 'Désigné(e) Enseignant Maternelle',
        message: exists
          ? "L'enseignant n'est plus marqué comme Maternelle."
          : "L'enseignant est désormais prioritaire et exclusif pour les étages réservés Maternelle (ex: Sous-sol).",
        type: 'info',
      });
      return next;
    });
  };

  // Update specific teacher shift
  const updateStaffShift = (staffId: string, updates: Partial<ShiftConfig>) => {
    setStaffShifts((prev) => {
      const current = prev[staffId] || {
        staffId,
        expectedEntry: '08:00',
        expectedExit: defaultExit,
        hasGarde: false,
        hasGardeEntry: false,
        hasGardeLunch: false,
        gardeDays: [],
        gardeEntryDays: [],
        gardeLunchDays: [],
        assignedFloors: {},
      };
      const next = { ...prev, [staffId]: { ...current, ...updates } };
      
      saveToSupabase(next, floors, maternelleTeacherIds, true);
      return next;
    });
  };

  // Assign a teacher to a specific slot on a floor and day
  const handleAssignTeacherSlot = (
    teacherId: string,
    slotType: 'morning' | 'lunch' | 'evening',
    dayNum: number,
    floorId: string
  ) => {
    const shift = staffShifts[teacherId] || {
      staffId: teacherId,
      expectedEntry: '08:00',
      expectedExit: defaultExit,
      hasGarde: false,
      hasGardeEntry: false,
      hasGardeLunch: false,
      gardeDays: [],
      gardeEntryDays: [],
      gardeLunchDays: [],
      assignedFloors: {},
    };

    let nextGardeEntryDays = shift.gardeEntryDays || [];
    let nextGardeLunchDays = shift.gardeLunchDays || [];
    let nextGardeDays = shift.gardeDays || [];
    const nextAssignedFloors = { ...(shift.assignedFloors || {}), [dayNum]: floorId };

    if (slotType === 'morning') {
      if (!nextGardeEntryDays.includes(dayNum)) {
        nextGardeEntryDays = [...nextGardeEntryDays, dayNum];
      }
    } else if (slotType === 'lunch') {
      if (!nextGardeLunchDays.includes(dayNum)) {
        nextGardeLunchDays = [...nextGardeLunchDays, dayNum];
      }
    } else if (slotType === 'evening') {
      if (!nextGardeDays.includes(dayNum)) {
        nextGardeDays = [...nextGardeDays, dayNum];
      }
    }

    updateStaffShift(teacherId, {
      gardeEntryDays: nextGardeEntryDays,
      hasGardeEntry: nextGardeEntryDays.length > 0,
      gardeLunchDays: nextGardeLunchDays,
      hasGardeLunch: nextGardeLunchDays.length > 0,
      gardeDays: nextGardeDays,
      hasGarde: nextGardeDays.length > 0,
      assignedFloors: nextAssignedFloors,
    });

    const teacher = teachers.find((t) => t.id === teacherId);
    const floor = floors.find((f) => f.id === floorId);
    const dayName = SCHOOL_DAYS.find((d) => d.id === dayNum)?.name || '';
    const slotLabel = slotType === 'morning' ? 'Matin (08h00)' : slotType === 'lunch' ? 'Midi (12h20)' : 'Soir';

    notify({
      title: 'Affectation Réussie',
      message: `${teacher?.first_name || ''} ${teacher?.last_name || ''} affecté(e) au ${floor?.name || ''} (${slotLabel} - ${dayName}).`,
      type: 'success',
    });
  };

  // Remove a teacher from a slot on a day
  const handleRemoveTeacherSlot = (
    teacherId: string,
    slotType: 'morning' | 'lunch' | 'evening',
    dayNum: number
  ) => {
    const shift = staffShifts[teacherId];
    if (!shift) return;

    let nextGardeEntryDays = shift.gardeEntryDays || [];
    let nextGardeLunchDays = shift.gardeLunchDays || [];
    let nextGardeDays = shift.gardeDays || [];

    if (slotType === 'morning') {
      nextGardeEntryDays = nextGardeEntryDays.filter((d) => d !== dayNum);
    } else if (slotType === 'lunch') {
      nextGardeLunchDays = nextGardeLunchDays.filter((d) => d !== dayNum);
    } else if (slotType === 'evening') {
      nextGardeDays = nextGardeDays.filter((d) => d !== dayNum);
    }

    updateStaffShift(teacherId, {
      gardeEntryDays: nextGardeEntryDays,
      hasGardeEntry: nextGardeEntryDays.length > 0,
      gardeLunchDays: nextGardeLunchDays,
      hasGardeLunch: nextGardeLunchDays.length > 0,
      gardeDays: nextGardeDays,
      hasGarde: nextGardeDays.length > 0,
    });

    const teacher = teachers.find((t) => t.id === teacherId);
    const dayName = SCHOOL_DAYS.find((d) => d.id === dayNum)?.name || '';
    const slotLabel = slotType === 'morning' ? 'Matin' : slotType === 'lunch' ? 'Midi' : 'Soir';

    notify({
      title: 'Affectation Retirée',
      message: `${teacher?.first_name || ''} ${teacher?.last_name || ''} retiré(e) de la garde ${slotLabel} (${dayName}).`,
      type: 'info',
    });
  };

  // Helper to compute detailed coverage for a floor on a specific day
  const getFloorCoverageForDay = (floorId: string, dayNum: number) => {
    const floor = floors.find((f) => f.id === floorId);
    const morningStaff: GardeTeacher[] = [];
    const lunchStaff: GardeTeacher[] = [];
    const eveningStaff: GardeTeacher[] = [];

    teachers.forEach((t) => {
      const shift = staffShifts[t.id];
      if (!shift) return;
      const fId = shift.assignedFloors?.[dayNum] || floors[0]?.id;
      if (fId === floorId) {
        if (shift.gardeEntryDays?.includes(dayNum)) morningStaff.push(t);
        if (shift.gardeLunchDays?.includes(dayNum)) lunchStaff.push(t);
        if (shift.gardeDays?.includes(dayNum)) eveningStaff.push(t);
      }
    });

    const quota = floor?.requiredTeachers || 1;
    const isMorningDeficit = morningStaff.length < quota;
    const isLunchDeficit = dayNum !== 5 && floor?.hasLunchGuard !== false && lunchStaff.length < 1;
    const isEveningDeficit = eveningStaff.length < quota;
    const hasDeficit = isMorningDeficit || isLunchDeficit || isEveningDeficit;

    return {
      floor,
      quota,
      morningStaff,
      lunchStaff,
      eveningStaff,
      isMorningDeficit,
      isLunchDeficit,
      isEveningDeficit,
      hasDeficit,
      morningCount: morningStaff.length,
      lunchCount: lunchStaff.length,
      eveningCount: eveningStaff.length,
    };
  };

  // Floor configuration handlers
  const handleAddFloor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFloorName.trim()) return;

    const newFloor: SchoolFloor = {
      id: `floor-${Date.now()}`,
      name: newFloorName.trim(),
      requiredTeachers: Math.max(1, newFloorQuota),
      color: newFloorColor,
      isMaternelleOnly: newFloorIsMaternelle,
      hasLunchGuard: newFloorHasLunch,
    };

    const updated = [...floors, newFloor];
    setFloors(updated);
    saveToSupabase(staffShifts, updated, maternelleTeacherIds, true);

    setNewFloorName('');
    setNewFloorQuota(1);
    setNewFloorIsMaternelle(false);
    setNewFloorHasLunch(true);
  };

  const handleUpdateFloorQuota = (floorId: string, quota: number) => {
    const updated = floors.map((f) => (f.id === floorId ? { ...f, requiredTeachers: Math.max(1, quota) } : f));
    setFloors(updated);
    saveToSupabase(staffShifts, updated, maternelleTeacherIds, true);
  };

  const handleToggleFloorMaternelle = (floorId: string) => {
    const updated = floors.map((f) => (f.id === floorId ? { ...f, isMaternelleOnly: !f.isMaternelleOnly } : f));
    setFloors(updated);
    saveToSupabase(staffShifts, updated, maternelleTeacherIds, true);
  };

  const handleToggleFloorLunch = (floorId: string) => {
    const updated = floors.map((f) => (f.id === floorId ? { ...f, hasLunchGuard: f.hasLunchGuard === false } : f));
    setFloors(updated);
    saveToSupabase(staffShifts, updated, maternelleTeacherIds, true);
  };

  const handleDeleteFloor = async (floorId: string) => {
    if (floors.length <= 1) return;
    const floorToDelete = floors.find((f) => f.id === floorId);
    const ok = await confirm({
      title: 'Supprimer cet étage ?',
      message: `Voulez-vous vraiment supprimer "${floorToDelete?.name || 'cet étage'}" ? Les affectations liées seront réinitialisées.`,
      confirmText: 'Oui, supprimer',
      cancelText: 'Annuler',
      type: 'danger',
    });

    if (!ok) return;

    const updated = floors.filter((f) => f.id !== floorId);
    setFloors(updated);
    saveToSupabase(staffShifts, updated, maternelleTeacherIds, true);
    notify({
      title: 'Étage Supprimé',
      message: `L'étage "${floorToDelete?.name || ''}" a été supprimé.`,
      type: 'success',
    });
  };

  // Manual save button handler
  const handleSave = () => {
    saveToSupabase(staffShifts, floors, maternelleTeacherIds, false);
  };

  // 🧹 Clear all Gardes with Custom Branded Modal
  const handleClearGardes = async () => {
    const ok = await confirm({
      title: 'Vider le Planning des Gardes ?',
      message: 'Êtes-vous sûr de vouloir vider et effacer toutes les affectations de garde de la semaine pour tous les enseignants ?',
      confirmText: 'Oui, tout effacer',
      cancelText: 'Annuler',
      type: 'danger',
    });

    if (!ok) return;

    const resetShifts: Record<string, ShiftConfig> = {};
    teachers.forEach((t) => {
      resetShifts[t.id] = {
        staffId: t.id,
        expectedEntry: '08:15',
        expectedExit: '16:15',
        hasGarde: false,
        hasGardeEntry: false,
        hasGardeLunch: false,
        gardeDays: [],
        gardeEntryDays: [],
        gardeLunchDays: [],
        assignedFloors: {},
      };
    });

    setStaffShifts(resetShifts);
    await saveToSupabase(resetShifts, floors, maternelleTeacherIds, false);
    setSyncFeedback('🧹 Le planning des gardes a été entièrement réinitialisé et vidé avec succès.');
    setSyncWarning(null);
  };

  // ⚡ Auto-Synchronize with Timetable (Multi-Stage Smart Solver)
  // STRICT RULE FOR MATERNELLE:
  // If a floor is isMaternelleOnly (e.g. Sous-sol), ONLY Maternelle teachers are assigned.
  // If NO Maternelle teacher is available, that floor slot remains STRICTLY EMPTY and a clear warning is displayed!
  const handleSyncWithTimetable = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    setSyncWarning(null);

    try {
      let slots = timetableSlots;
      if (slots.length === 0) {
        const supabase = createClient();
        const { data } = await supabase.from('timetable_slots').select('*');
        if (data) {
          slots = data;
          setTimetableSlots(data);
        }
      }

      let totalMorningGardes = 0;
      let totalLunchGardes = 0;
      let totalEveningGardes = 0;
      let unassignedMaternelleCount = 0;

      // Prepare teacher shift records
      const updatedShifts: Record<string, ShiftConfig> = {};
      teachers.forEach((t) => {
        updatedShifts[t.id] = {
          staffId: t.id,
          expectedEntry: '08:15',
          expectedExit: '16:15',
          hasGarde: false,
          hasGardeEntry: false,
          hasGardeLunch: false,
          gardeDays: [],
          gardeEntryDays: [],
          gardeLunchDays: [],
          assignedFloors: {},
        };
      });

      // Track real-time distribution across the week to ensure fair rotation and NO overloading
      const assignedWeeklyGardesCount: Record<string, number> = {};
      const assignedDailyGardesCount: Record<number, Record<string, number>> = {};
      const assignedLunchGardesCount: Record<string, number> = {};
      const assignedMorningGardesCount: Record<string, number> = {};
      const assignedEveningGardesCount: Record<string, number> = {};

      teachers.forEach((t) => {
        assignedWeeklyGardesCount[t.id] = 0;
        assignedLunchGardesCount[t.id] = 0;
        assignedMorningGardesCount[t.id] = 0;
        assignedEveningGardesCount[t.id] = 0;
      });

      SCHOOL_DAYS.forEach((d) => {
        assignedDailyGardesCount[d.id] = {};
        teachers.forEach((t) => {
          assignedDailyGardesCount[d.id][t.id] = 0;
        });
      });

      // Helper function to find the best fair candidate for a specific slot on day d
      const pickBestCandidate = (
        candidateList: Array<{
          staff: GardeTeacher;
          isMaternelle: boolean;
          isPresentToday: boolean;
          weeklyHours: number;
          hasMorningClass: boolean;
          hasClassAfterLunch: boolean;
          hasAfternoonClass: boolean;
        }>,
        filterSlot: 'morning' | 'lunch' | 'evening',
        alreadyAssignedInThisExactSlot: string[],
        currentDay: number,
        targetFloor: SchoolFloor
      ) => {
        // Exclude teachers already in this exact slot
        let available = candidateList.filter((c) => !alreadyAssignedInThisExactSlot.includes(c.staff.id));

        // STRICT RULE: If floor is Maternelle-Only (Sous-sol), ONLY allow Maternelle teachers!
        // If no Maternelle teacher is found, RETURN NULL (NEVER assign other teachers!)
        if (targetFloor.isMaternelleOnly) {
          available = available.filter((c) => c.isMaternelle);
          if (available.length === 0) {
            return null; // Strict isolation: slot stays unassigned
          }
        } else {
          // If floor is general (RDC, 1er, 2ème), prefer non-maternelle teachers first so Maternelle staff stay for Sous-sol
          const nonMat = available.filter((c) => !c.isMaternelle);
          if (nonMat.length > 0) {
            available = nonMat;
          }
        }

        if (available.length === 0) return null;

        // Sort with Strict Rotation (Modawara) & Fair Balancing:
        const sorted = [...available].sort((a, b) => {
          // 1. SPECIFIC ROTATION FOR LUNCH (Garde Déjeuner):
          if (filterSlot === 'lunch') {
            const lunchA = assignedLunchGardesCount[a.staff.id] || 0;
            const lunchB = assignedLunchGardesCount[b.staff.id] || 0;
            if (lunchA !== lunchB) return lunchA - lunchB;
          }

          // 2. Minimum daily gardes today
          const dailyA = assignedDailyGardesCount[currentDay]?.[a.staff.id] || 0;
          const dailyB = assignedDailyGardesCount[currentDay]?.[b.staff.id] || 0;
          if (dailyA !== dailyB) return dailyA - dailyB;

          // 3. Slot-specific counts for morning / evening
          if (filterSlot === 'morning') {
            const mCountA = assignedMorningGardesCount[a.staff.id] || 0;
            const mCountB = assignedMorningGardesCount[b.staff.id] || 0;
            if (mCountA !== mCountB) return mCountA - mCountB;
          } else if (filterSlot === 'evening') {
            const eCountA = assignedEveningGardesCount[a.staff.id] || 0;
            const eCountB = assignedEveningGardesCount[b.staff.id] || 0;
            if (eCountA !== eCountB) return eCountA - eCountB;
          }

          // 4. Minimum total weekly gardes so far (so EVERY teacher gets their fair share!)
          const weeklyA = assignedWeeklyGardesCount[a.staff.id] || 0;
          const weeklyB = assignedWeeklyGardesCount[b.staff.id] || 0;
          if (weeklyA !== weeklyB) return weeklyA - weeklyB;

          // 5. Slot availability check
          if (filterSlot === 'morning') {
            if (!a.hasMorningClass && b.hasMorningClass) return -1;
            if (a.hasMorningClass && !b.hasMorningClass) return 1;
          } else if (filterSlot === 'lunch') {
            if (!a.hasClassAfterLunch && b.hasClassAfterLunch) return -1;
            if (a.hasClassAfterLunch && !b.hasClassAfterLunch) return 1;
          } else if (filterSlot === 'evening') {
            if (!a.hasAfternoonClass && b.hasAfternoonClass) return -1;
            if (a.hasAfternoonClass && !b.hasAfternoonClass) return 1;
          }

          return a.weeklyHours - b.weeklyHours;
        });

        return sorted[0];
      };

      // Solve for each day (1 to 5 - Lundi à Vendredi, Samedi exclu)
      for (const day of SCHOOL_DAYS) {
        const d = day.id;

        // Collect teacher status on this day
        const dayStaffProfiles = teachers.map((t) => {
          const tSlots = slots.filter(
            (s) =>
              (s.teacher_id === t.id || s.teacher_id === t.staff_code || (t.staff_code && s.teacher_code === t.staff_code)) &&
              s.day_of_week === d
          );

          const isPresentToday = tSlots.length > 0;
          const weeklyHours = teacherWeeklyHoursMap[t.id] || 0;
          const isMat = isMaternelleTeacher(t, maternelleTeacherIds);

          // Check morning session (P1, P2, P3 or < 12:00)
          const hasMorningClass = tSlots.some(
            (s) => s.period_id === 'P1' || s.period_id === 'P2' || s.period_id === 'P3' || (s.start_time && s.start_time < '12:00')
          );

          // Check post-lunch session (P4 / 13:00 - 14:00)
          const hasClassAfterLunch = tSlots.some(
            (s) => s.period_id === 'P4' || (s.start_time && s.start_time >= '13:00' && s.start_time <= '14:30')
          );

          // Check afternoon session (P5, P6, P7 or > 14:30)
          const hasAfternoonClass = tSlots.some(
            (s) => s.period_id === 'P5' || s.period_id === 'P6' || s.period_id === 'P7' || (s.end_time && s.end_time > '14:30')
          );

          return {
            staff: t,
            isMaternelle: isMat,
            isPresentToday,
            weeklyHours,
            hasMorningClass,
            hasClassAfterLunch,
            hasAfternoonClass,
          };
        });

        // 1. Assign Garde Matin (08:00) across all floors
        const assignedInMorning: string[] = [];
        for (const floor of floors) {
          for (let q = 0; q < floor.requiredTeachers; q++) {
            const best = pickBestCandidate(dayStaffProfiles, 'morning', assignedInMorning, d, floor);
            if (best) {
              const tId = best.staff.id;
              assignedInMorning.push(tId);
              assignedDailyGardesCount[d][tId] = (assignedDailyGardesCount[d][tId] || 0) + 1;
              assignedWeeklyGardesCount[tId] = (assignedWeeklyGardesCount[tId] || 0) + 1;
              assignedMorningGardesCount[tId] = (assignedMorningGardesCount[tId] || 0) + 1;

              const currentRec = updatedShifts[tId];
              currentRec.gardeEntryDays = [...(currentRec.gardeEntryDays || []), d];
              currentRec.hasGardeEntry = true;
              currentRec.assignedFloors = { ...(currentRec.assignedFloors || {}), [d]: floor.id };
              totalMorningGardes++;
            } else if (floor.isMaternelleOnly) {
              unassignedMaternelleCount++;
            }
          }
        }

        // 2. Assign Garde Déjeuner / Midi (12:20 - 13:20) — ONLY Monday to Thursday (Skipped on Vendredi!)
        if (day.hasLunch) {
          const assignedInLunch: string[] = [];
          const lunchEligibleFloors = floors.filter((f) => f.hasLunchGuard !== false);

          for (const floor of lunchEligibleFloors) {
            const best = pickBestCandidate(dayStaffProfiles, 'lunch', assignedInLunch, d, floor);
            if (best) {
              const tId = best.staff.id;
              assignedInLunch.push(tId);
              assignedDailyGardesCount[d][tId] = (assignedDailyGardesCount[d][tId] || 0) + 1;
              assignedWeeklyGardesCount[tId] = (assignedWeeklyGardesCount[tId] || 0) + 1;
              assignedLunchGardesCount[tId] = (assignedLunchGardesCount[tId] || 0) + 1;

              const currentRec = updatedShifts[tId];
              currentRec.gardeLunchDays = [...(currentRec.gardeLunchDays || []), d];
              currentRec.hasGardeLunch = true;
              if (!currentRec.assignedFloors?.[d]) {
                currentRec.assignedFloors = { ...(currentRec.assignedFloors || {}), [d]: floor.id };
              }
              totalLunchGardes++;
            }
          }
        }

        // 3. Assign Garde Sortie (16:00 Lun-Jeu / 12:20 Vendredi) across all floors
        const assignedInEvening: string[] = [];
        for (const floor of floors) {
          for (let q = 0; q < floor.requiredTeachers; q++) {
            const best = pickBestCandidate(dayStaffProfiles, 'evening', assignedInEvening, d, floor);
            if (best) {
              const tId = best.staff.id;
              assignedInEvening.push(tId);
              assignedDailyGardesCount[d][tId] = (assignedDailyGardesCount[d][tId] || 0) + 1;
              assignedWeeklyGardesCount[tId] = (assignedWeeklyGardesCount[tId] || 0) + 1;
              assignedEveningGardesCount[tId] = (assignedEveningGardesCount[tId] || 0) + 1;

              const currentRec = updatedShifts[tId];
              currentRec.gardeDays = [...(currentRec.gardeDays || []), d];
              currentRec.hasGarde = true;
              if (!currentRec.assignedFloors?.[d]) {
                currentRec.assignedFloors = { ...(currentRec.assignedFloors || {}), [d]: floor.id };
              }
              totalEveningGardes++;
            } else if (floor.isMaternelleOnly) {
              unassignedMaternelleCount++;
            }
          }
        }
      }

      setStaffShifts(updatedShifts);
      await saveToSupabase(updatedShifts, floors, maternelleTeacherIds, false);

      if (unassignedMaternelleCount > 0) {
        const warnText = `⚠️ Information Importante : Aucun enseignant de Maternelle n'a été trouvé pour le Sous-sol (Maternelle). Comme vous l'avez exigé, les autres enseignants n'ont PAS été affectés au Sous-sol. Vous pouvez désigner un enseignant en Maternelle en cliquant sur le badge 👶 Maternelle à côté de son nom !`;
        setSyncWarning(warnText);
        notify({
          title: 'Sous-sol (Maternelle) Non Assigné',
          message: 'Aucun enseignant Maternelle disponible. Cliquez sur "👶 Marquer Maternelle" sur un enseignant pour l\'activer.',
          type: 'warning',
        });
      }

      setSyncFeedback(
        `✨ Planning Optimisé (Lundi - Vendredi) : ${totalMorningGardes} Matin (08h00), ${totalLunchGardes} Déjeuner (12h20 Lun-Jeu avec rotation), et ${totalEveningGardes} Sortie (16h15 Lun-Jeu / 12h20 Vendredi) !`
      );
      setIsSavedFeedback(true);
      setTimeout(() => setIsSavedFeedback(false), 5000);
    } catch (err: any) {
      setSyncFeedback(`Erreur lors de la synchronisation : ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Print planning
  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `GM_Planning_Gardes_Lundi_Vendredi_${new Date().toISOString().split('T')[0]}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Matricule', 'Enseignant', 'Matiere', 'Charge_Hebdo', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Total Gardes'];
    const rows = printableTeachers.map((t) => {
      const shift = staffShifts[t.id] || { expectedEntry: '08:15', expectedExit: '16:15' };
      const weeklyHours = teacherWeeklyHoursMap[t.id] || 0;
      
      const dayStatuses = [1, 2, 3, 4, 5].map((dayNum) => {
        const m = shift.gardeEntryDays?.includes(dayNum);
        const l = shift.gardeLunchDays?.includes(dayNum);
        const e = shift.gardeDays?.includes(dayNum);
        const floorId = shift.assignedFloors?.[dayNum];
        const floorName = floors.find((f) => f.id === floorId)?.name || 'Étage RDC';

        const parts: string[] = [];
        if (m) parts.push('Matin (08h00)');
        if (l) parts.push('Midi (12h20)');
        if (e) {
          parts.push(dayNum === 5 ? 'Sortie (12h20)' : 'Soir (16h00)');
        }

        if (parts.length > 0) return `${parts.join(' + ')} [${floorName}]`;
        return '-';
      });

      const totalCount = (shift.gardeEntryDays?.length || 0) + (shift.gardeLunchDays?.length || 0) + (shift.gardeDays?.length || 0);
      return [
        t.staff_code,
        `"${t.first_name} ${t.last_name}"`,
        `"${t.role_title}"`,
        `${weeklyHours} séances`,
        ...dayStatuses.map((s) => `"${s}"`),
        totalCount,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GM_Planning_Gardes_Lundi_Vendredi_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered teachers list (Interactive Table View - respects day tabs and search)
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const matchSearch = `${t.first_name} ${t.last_name} ${t.staff_code} ${t.role_title}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      
      if (!matchSearch) return false;
      if (selectedDayFilter === 'ALL') return true;

      const shift = staffShifts[t.id];
      const hasMorning = shift?.gardeEntryDays?.includes(selectedDayFilter);
      const hasLunch = shift?.gardeLunchDays?.includes(selectedDayFilter);
      const hasEvening = shift?.gardeDays?.includes(selectedDayFilter);
      return hasMorning || hasLunch || hasEvening;
    });
  }, [teachers, searchQuery, selectedDayFilter, staffShifts]);

  // Complete Teachers list for Official Print & CSV Export (Full week Lundi-Vendredi without day filter cutoff)
  const printableTeachers = useMemo(() => {
    return teachers
      .filter((t) => {
        if (!searchQuery.trim()) return true;
        return `${t.first_name} ${t.last_name} ${t.staff_code} ${t.role_title}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => a.last_name.localeCompare(b.last_name, 'fr'));
  }, [teachers, searchQuery]);

  // Floor Coverage Stats by Selected Day (Matin, Midi, Soir)
  const floorCoverage = useMemo(() => {
    const result: Record<string, { floor: SchoolFloor; morningCount: number; lunchCount: number; eveningCount: number }> = {};
    floors.forEach((f) => {
      result[f.id] = { floor: f, morningCount: 0, lunchCount: 0, eveningCount: 0 };
    });

    const targetDay = selectedDayFilter === 'ALL' ? 1 : selectedDayFilter;

    teachers.forEach((t) => {
      const shift = staffShifts[t.id];
      if (!shift) return;
      const isMorning = shift.gardeEntryDays?.includes(targetDay);
      const isLunch = shift.gardeLunchDays?.includes(targetDay);
      const isEvening = shift.gardeDays?.includes(targetDay);
      const fId = shift.assignedFloors?.[targetDay] || floors[0]?.id;

      if (result[fId]) {
        if (isMorning) result[fId].morningCount++;
        if (isLunch) result[fId].lunchCount++;
        if (isEvening) result[fId].eveningCount++;
      }
    });

    return result;
  }, [floors, teachers, staffShifts, selectedDayFilter]);

  // KPIs
  const stats = useMemo(() => {
    let totalMorning = 0;
    let totalLunch = 0;
    let totalEvening = 0;
    let teachersWithGarde = 0;

    teachers.forEach((t) => {
      const shift = staffShifts[t.id];
      const mCount = shift?.gardeEntryDays?.length || 0;
      const lCount = shift?.gardeLunchDays?.length || 0;
      const eCount = shift?.gardeDays?.length || 0;
      totalMorning += mCount;
      totalLunch += lCount;
      totalEvening += eCount;
      if (mCount > 0 || lCount > 0 || eCount > 0) teachersWithGarde++;
    });

    const totalRequiredPerDay = floors.reduce((acc, f) => acc + f.requiredTeachers, 0);
    const lunchEligibleFloorsCount = floors.filter((f) => f.hasLunchGuard !== false).length;

    return {
      totalTeachers: teachers.length,
      teachersWithGarde,
      totalMorning,
      totalLunch,
      totalEvening,
      totalGardes: totalMorning + totalLunch + totalEvening,
      totalFloors: floors.length,
      totalRequiredPerDay,
      lunchEligibleFloorsCount,
    };
  }, [teachers, staffShifts, floors]);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 w-full min-h-screen">
        {/* 1. Header & Actions Bar */}
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 print:hidden">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            {/* Title & Badges */}
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 p-1.5 flex items-center justify-center shrink-0 shadow-xs">
                <img
                  src="/logo.png"
                  alt="Logo GM School"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    {dir === 'rtl' ? 'جدول وتوزيع الحراسة' : 'Planning des Gardes'}
                  </h1>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    <Calendar className="w-3 h-3" />
                    <span>Lundi &mdash; Vendredi</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-50 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                    <Baby className="w-3 h-3" />
                    <span>Sous-sol 100% Maternelle</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {dir === 'rtl'
                    ? 'حراسة الصباح (08:00)، الاستراحة والغداء (12:20)، والمساء (16:15 الإثنين-الخميس / 12:20 الجمعة).'
                    : 'Matin (08h00), Déjeuner (12h20 Lun-Jeu, Étages 1 & 2) et Sortie (16h00 Lun-Jeu / 12h20 Vendredi).'}
                </p>
              </div>
            </div>

            {/* Actions Toolbar */}
            <div className="flex flex-wrap items-center gap-2 pt-1 xl:pt-0">
              {/* 🏢 Configurer les Étages */}
              <button
                type="button"
                onClick={() => setShowFloorsModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer shadow-xs whitespace-nowrap"
              >
                <Building2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>{dir === 'rtl' ? `الطوابق (${floors.length})` : `Étages (${floors.length})`}</span>
              </button>

              {/* 🖨️ Print */}
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer shadow-xs whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>{dir === 'rtl' ? 'طباعة' : 'Imprimer'}</span>
              </button>

              {/* 📥 CSV Export */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer shadow-xs whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{dir === 'rtl' ? 'CSV' : 'CSV'}</span>
              </button>

              {/* 🧹 Clear Gardes */}
              <button
                type="button"
                onClick={handleClearGardes}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800 transition-all cursor-pointer shadow-xs whitespace-nowrap"
                title="Vider et réinitialiser les affectations"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>{dir === 'rtl' ? 'إفراغ' : 'Vider'}</span>
              </button>

              {/* ⚡ Sync with Timetable */}
              <button
                type="button"
                onClick={handleSyncWithTimetable}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/25 transition-all cursor-pointer whitespace-nowrap hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? (dir === 'rtl' ? 'توزيع...' : 'Remplissage...') : (dir === 'rtl' ? '⚡ توزيع ذكي 100%' : '⚡ Remplir 100%')}</span>
              </button>

              {/* 💾 Save */}
              <button
                type="button"
                onClick={handleSave}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white transition-all shadow-md cursor-pointer whitespace-nowrap hover:scale-[1.02] active:scale-[0.98] ${
                  isSavedFeedback
                    ? 'bg-emerald-600 shadow-emerald-600/30 ring-2 ring-emerald-400'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-600/25'
                }`}
              >
                {isSavedFeedback ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>{dir === 'rtl' ? 'تم الحفظ ✅' : 'Enregistré ✅'}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-white" />
                    <span>{dir === 'rtl' ? 'حفظ' : 'Enregistrer'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Warning Banner (e.g. Maternelle Missing) */}
        {syncWarning && (
          <div className="p-4 rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-start justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in print:hidden">
            <div className="flex items-start gap-2.5 font-medium">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <span>{syncWarning}</span>
            </div>
            <button
              onClick={() => setSyncWarning(null)}
              className="p-1.5 hover:bg-amber-500/20 rounded-xl text-slate-500 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Sync Feedback Banner */}
        {syncFeedback && (
          <div className="p-4 rounded-3xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-between text-xs text-purple-900 dark:text-purple-200 animate-in fade-in print:hidden">
            <div className="flex items-center gap-2.5 font-bold">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
              <span>{syncFeedback}</span>
            </div>
            <button
              onClick={() => setSyncFeedback(null)}
              className="p-1.5 hover:bg-purple-500/20 rounded-xl text-slate-500 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2. Étages & Quotas Live Coverage Bar (Matin, Midi, Soir) */}
        <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white shadow-lg border border-purple-900/40 print:hidden">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
                <Building2 className="w-4 h-4" />
                <span>Couverture des Étages &bull; {selectedDayFilter === 'ALL' ? 'Lundi (Réf. Semaine)' : `Jour : ${SCHOOL_DAYS.find(d => d.id === selectedDayFilter)?.name}`}</span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Matin: <span className="font-bold text-sky-300">{stats.totalRequiredPerDay} ens.</span> &bull; Déjeuner (Lun-Jeu): <span className="font-bold text-amber-300">{stats.lunchEligibleFloorsCount} ens.</span> &bull; Sortie: <span className="font-bold text-purple-300">{stats.totalRequiredPerDay} ens. (12h20 le Vendredi)</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {floors.map((f) => {
                const cov = floorCoverage[f.id];
                const isMorningOk = (cov?.morningCount || 0) >= f.requiredTeachers;
                const isLunchOk = selectedDayFilter === 5 || f.hasLunchGuard === false || (cov?.lunchCount || 0) >= 1;
                const isEveningOk = (cov?.eveningCount || 0) >= f.requiredTeachers;
                const isFull = isMorningOk && isLunchOk && isEveningOk;

                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setActiveFloorForManualFix(f);
                      setManualFixDay(selectedDayFilter === 'ALL' ? 1 : selectedDayFilter);
                    }}
                    className={`px-4 py-2.5 rounded-2xl border text-xs flex flex-col gap-1.5 transition-all text-left cursor-pointer group relative hover:scale-[1.03] hover:shadow-lg focus:outline-none ${
                      isFull
                        ? 'bg-emerald-950/60 hover:bg-emerald-900/70 border-emerald-500/40 hover:border-emerald-400 text-emerald-200'
                        : 'bg-amber-950/70 hover:bg-amber-900/80 border-amber-500/50 hover:border-amber-400 text-amber-200 shadow-sm shadow-amber-500/10'
                    }`}
                    title="👉 Cliquer pour voir les manques et affecter manuellement un enseignant"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className={`w-2.5 h-2.5 rounded-full ${isFull ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}></span>
                        <span className="font-extrabold">{f.name}</span>
                        {f.isMaternelleOnly && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-pink-500/20 text-pink-300 border border-pink-500/30">
                            👶 Maternelle
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {isFull ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 animate-pulse flex items-center gap-1">
                            <Wrench className="w-2.5 h-2.5" />
                            <span>Affecter</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 text-[10.5px] font-mono text-slate-300">
                      <span className={!isMorningOk ? 'text-rose-300 font-bold' : 'text-emerald-300'}>
                        🌅 {cov?.morningCount || 0}/{f.requiredTeachers}
                      </span>
                      <span className={!isLunchOk ? 'text-rose-300 font-bold' : 'text-slate-300'}>
                        🍱 {selectedDayFilter === 5 ? 'Vendredi (Exclu)' : f.hasLunchGuard === false ? 'Exclu' : `${cov?.lunchCount || 0}/1`}
                      </span>
                      <span className={!isEveningOk ? 'text-rose-300 font-bold' : 'text-purple-300'}>
                        🌇 {cov?.eveningCount || 0}/{f.requiredTeachers}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Search & Day Filter Tabs (Lundi à Vendredi) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm print:hidden">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par nom, matricule, matière..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* View Mode Toggle Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('grid_floors')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'grid_floors'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{dir === 'rtl' ? 'جدول الطوابق (الرسمي)' : 'Tableau par Étages (Officiel)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix_teachers')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'matrix_teachers'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{dir === 'rtl' ? 'حسب الأستاذ' : 'Par Enseignant'}</span>
            </button>
          </div>
        </div>

        {/* 4. MAIN VIEW A: Official Floors & Créneaux Grid (Exact Layout from User Request) */}
        {viewMode === 'grid_floors' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden print:hidden animate-in fade-in duration-200">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-xs border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700 text-center">
                    <th className="p-3 w-[15%] text-left border-r border-slate-200 dark:border-slate-700/80">Étages</th>
                    <th className="p-3 w-[12%] text-center border-r border-slate-200 dark:border-slate-700/80">Créneaux</th>
                    {SCHOOL_DAYS.map((day) => (
                      <th key={day.id} className="p-3 w-[14.6%] text-center border-r border-slate-200 dark:border-slate-700/80 last:border-r-0">
                        <div className="text-slate-900 dark:text-white font-bold leading-tight">{day.name}</div>
                        <div className="text-[9.5px] font-normal text-slate-400 mt-0.5">
                          {day.id === 5 ? '08:15 - 12:20' : '08:15 - 16:15'}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                        Chargement du planning des gardes...
                      </td>
                    </tr>
                  ) : floors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                        Aucun étage configuré.
                      </td>
                    </tr>
                  ) : (
                    floors.map((floor, fIdx) => {
                      const slots = getFloorSlots(floor);
                      return slots.map((slot, sIdx) => {
                        return (
                          <tr key={`${floor.id}-${slot.key}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            {/* Floor Name Column with rowSpan */}
                            {sIdx === 0 && (
                              <td
                                rowSpan={slots.length}
                                className="p-3 border-r border-b border-slate-200 dark:border-slate-800 font-bold align-middle bg-slate-50/70 dark:bg-slate-800/40"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span>
                                    <span className="text-xs font-black text-slate-900 dark:text-white">{floor.name}</span>
                                  </div>
                                  {floor.isMaternelleOnly && (
                                    <div className="text-[9.5px] text-pink-600 dark:text-pink-400 font-bold flex items-center gap-1">
                                      <Baby className="w-3 h-3" />
                                      <span>100% Maternelle</span>
                                    </div>
                                  )}
                                  <div className="text-[10px] text-slate-400 font-medium">
                                    Quota: <span className="font-bold text-slate-700 dark:text-slate-300">{floor.requiredTeachers} ens.</span>
                                  </div>
                                </div>
                              </td>
                            )}

                            {/* Slot Name Column (Matin, Midi, Soir) */}
                            <td className="p-2.5 border-r border-slate-200 dark:border-slate-800 text-center align-middle bg-slate-50/30 dark:bg-slate-800/20">
                              <div className="inline-flex flex-col items-center">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${slot.badgeColor}`}>
                                  {slot.label === 'Matin' ? '🌅 Matin' : slot.label === 'Midi' ? '🍱 Midi' : '🌇 Soir'}
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono mt-0.5">{slot.time}</span>
                              </div>
                            </td>

                            {/* Day Cells (Lundi à Vendredi) */}
                            {SCHOOL_DAYS.map((day) => {
                              const isVenLunch = day.id === 5 && slot.key === 'lunch';
                              const assigned = getSlotAssignedTeachers(floor.id, day.id, slot.key);
                              const matchSearch = (t: GardeTeacher) =>
                                !searchQuery.trim() ||
                                `${t.first_name} ${t.last_name} ${t.staff_code} ${t.role_title}`
                                  .toLowerCase()
                                  .includes(searchQuery.toLowerCase());

                              return (
                                <td
                                  key={day.id}
                                  className={`p-2 border-r border-slate-200 dark:border-slate-800 last:border-r-0 align-middle ${
                                    isVenLunch ? 'bg-slate-50/40 dark:bg-slate-800/20' : ''
                                  }`}
                                >
                                  {isVenLunch ? (
                                    <div className="text-center text-[9px] text-slate-400 italic">
                                      -
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      {assigned.map((tch) => {
                                        const isHighlighted = searchQuery.trim() && matchSearch(tch);
                                        return (
                                          <div
                                            key={tch.id}
                                            className={`p-1.5 rounded-xl border flex items-center justify-between gap-1 shadow-2xs group transition-all ${
                                              isHighlighted
                                                ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-400 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400'
                                                : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                                            }`}
                                          >
                                            <div className="min-w-0">
                                              <div className="font-bold text-[10.5px] leading-tight truncate" title={`${tch.first_name} ${tch.last_name} (${tch.role_title})`}>
                                                {tch.first_name} {tch.last_name}
                                              </div>
                                              <div className="text-[8.5px] text-slate-400 truncate leading-tight mt-0.5">
                                                {tch.role_title}
                                              </div>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveTeacherSlot(tch.id, slot.key, day.id)}
                                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-500 rounded transition-opacity cursor-pointer shrink-0"
                                              title="Retirer cet enseignant"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </div>
                                        );
                                      })}

                                      {/* Affecter / Add button if quota not met */}
                                      {assigned.length < floor.requiredTeachers && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveFloorForManualFix(floor);
                                            setManualFixDay(day.id);
                                          }}
                                          className="w-full py-1 px-1.5 rounded-xl border border-dashed border-purple-300 dark:border-purple-700/80 bg-purple-50/50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-[9.5px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                                          title={`Affecter un enseignant (${assigned.length}/${floor.requiredTeachers})`}
                                        >
                                          <Plus className="w-3 h-3" />
                                          <span>{assigned.length > 0 ? `+ Ens. (${assigned.length}/${floor.requiredTeachers})` : '+ Affecter'}</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      });
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. MAIN VIEW B: Weekly Interactive Matrix Table by Teacher */}
        {viewMode === 'matrix_teachers' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden print:hidden animate-in fade-in duration-200">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className={`px-3 py-3.5 ${selectedDayFilter === 'ALL' ? 'w-[24%]' : 'w-[45%]'}`}>Enseignant &amp; Cycle</th>
                {SCHOOL_DAYS.filter((d) => selectedDayFilter === 'ALL' || selectedDayFilter === d.id).map((day) => (
                  <th key={day.id} className={`px-2 py-3.5 text-center border-l border-slate-200/60 dark:border-slate-800 ${selectedDayFilter === 'ALL' ? 'w-[13.5%]' : 'w-[40%]'}`}>
                    <div className="text-slate-900 dark:text-white font-bold leading-tight">{day.name}</div>
                    <div className="text-[9px] font-normal text-slate-400">
                      {day.id === 5 ? '08:15 - 12:20' : '08:15 - 16:15'}
                    </div>
                  </th>
                ))}
                <th className={`px-2 py-3.5 text-center border-l border-slate-200/60 dark:border-slate-800 ${selectedDayFilter === 'ALL' ? 'w-[8%]' : 'w-[15%]'}`}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={selectedDayFilter === 'ALL' ? 7 : 3} className="text-center py-12 text-slate-400 font-medium">
                    Chargement du planning des gardes...
                  </td>
                </tr>
              ) : filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={selectedDayFilter === 'ALL' ? 7 : 3} className="text-center py-12 text-slate-400 font-medium">
                    Aucun enseignant trouvé pour cette sélection.
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((t) => {
                  const shift = staffShifts[t.id] || {
                    staffId: t.id,
                    expectedEntry: '08:15',
                    expectedExit: '16:15',
                    hasGarde: false,
                    hasGardeEntry: false,
                    hasGardeLunch: false,
                    gardeDays: [],
                    gardeEntryDays: [],
                    gardeLunchDays: [],
                    assignedFloors: {},
                  };

                  const teacherSlots = timetableSlots.filter(
                    (slot) =>
                      slot.teacher_id === t.id ||
                      slot.teacher_id === t.staff_code ||
                      (t.staff_code && slot.teacher_code === t.staff_code)
                  );

                  const isMat = isMaternelleTeacher(t, maternelleTeacherIds);
                  const weeklyHours = teacherWeeklyHoursMap[t.id] || 0;
                  const totalTeacherGardes =
                    (shift.gardeEntryDays?.length || 0) +
                    (shift.gardeLunchDays?.length || 0) +
                    (shift.gardeDays?.length || 0);

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white align-middle">
                        <div className="text-xs leading-tight">{t.first_name} {t.last_name}</div>
                        <div className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold leading-tight flex items-center gap-1.5 mt-0.5">
                          <span>{t.role_title}</span>
                          {/* Clickable Maternelle Badge Button */}
                          <button
                            type="button"
                            onClick={() => toggleTeacherMaternelle(t.id)}
                            className={`px-1.5 py-0.2 rounded text-[8px] font-bold border transition-all cursor-pointer flex items-center gap-0.5 ${
                              isMat
                                ? 'bg-pink-100 dark:bg-pink-950/70 text-pink-700 dark:text-pink-300 border-pink-300 shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-pink-600 border-slate-200 dark:border-slate-700'
                            }`}
                            title="Cliquer pour activer/désactiver l'appartenance Maternelle"
                          >
                            <Baby className="w-2.5 h-2.5" />
                            <span>{isMat ? 'Maternelle ✓' : '+ Maternelle'}</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] text-slate-400 font-mono">{t.staff_code}</span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" title="Charge d'enseignement hebdomadaire">
                            <TrendingDown className="w-2.5 h-2.5 text-purple-500" />
                            <span>{weeklyHours}h</span>
                          </span>
                        </div>
                      </td>

                      {SCHOOL_DAYS.filter((d) => selectedDayFilter === 'ALL' || selectedDayFilter === d.id).map((day) => {
                        const daySlots = teacherSlots.filter((ts) => ts.day_of_week === day.id);
                        const isMorningGarde = shift.gardeEntryDays?.includes(day.id);
                        const isLunchGarde = shift.gardeLunchDays?.includes(day.id);
                        const isEveningGarde = shift.gardeDays?.includes(day.id);
                        const assignedFloorId = shift.assignedFloors?.[day.id] || floors[0]?.id;

                        return (
                          <td key={day.id} className="px-1 py-2 align-middle border-l border-slate-100 dark:border-slate-800/60">
                            <div className="space-y-1 flex flex-col items-center">
                              {/* Course Load Hint */}
                              <div className="w-full text-center">
                                {daySlots.length > 0 ? (
                                  <span
                                    className="inline-block px-1 py-0.5 rounded text-[8px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 leading-none"
                                    title={`Séances : ${daySlots.map((x) => x.period_id || 'C').join(', ')}`}
                                  >
                                    {daySlots.length} cours
                                  </span>
                                ) : (
                                  <span className="text-[8px] text-slate-400 italic leading-none">Libre</span>
                                )}
                              </div>

                              {/* 1. Morning Garde (08:00) */}
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = shift.gardeEntryDays || [];
                                  const next = isMorningGarde ? cur.filter((d) => d !== day.id) : [...cur, day.id];
                                  updateStaffShift(t.id, {
                                    gardeEntryDays: next,
                                    hasGardeEntry: next.length > 0,
                                  });
                                }}
                                className={`w-full py-0.5 px-1 rounded-md text-[8.5px] font-bold border transition-all cursor-pointer text-center flex items-center justify-center gap-0.5 ${
                                  isMorningGarde
                                    ? 'bg-sky-600 text-white border-sky-500 shadow-xs'
                                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-sky-300'
                                }`}
                                title={`Garde Matin (08:00) le ${day.name}`}
                              >
                                <span>🌅</span>
                                <span>{isMorningGarde ? '08:00' : 'Matin'}</span>
                              </button>

                              {/* 2. Lunch Garde (12:20 - 13:20) - Only Lundi à Jeudi (Vendredi has no lunch) */}
                              {day.hasLunch ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const cur = shift.gardeLunchDays || [];
                                    const next = isLunchGarde ? cur.filter((d) => d !== day.id) : [...cur, day.id];
                                    updateStaffShift(t.id, {
                                      gardeLunchDays: next,
                                      hasGardeLunch: next.length > 0,
                                    });
                                  }}
                                  className={`w-full py-0.5 px-1 rounded-md text-[8.5px] font-bold border transition-all cursor-pointer text-center flex items-center justify-center gap-0.5 ${
                                    isLunchGarde
                                      ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
                                      : 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-amber-300'
                                  }`}
                                  title={`Garde Déjeuner (12:20) le ${day.name} (Étages 1 & 2)`}
                                >
                                  <span>🍱</span>
                                  <span>{isLunchGarde ? '12:20' : 'Midi'}</span>
                                </button>
                              ) : (
                                <div className="w-full py-0.5 text-center text-[7.5px] text-slate-400 font-semibold bg-slate-50/50 dark:bg-slate-800/40 rounded border border-dashed border-slate-200 dark:border-slate-700">
                                  Pas de Midi
                                </div>
                              )}

                              {/* 3. Exit / Evening Garde (16:15 Lun-Jeu / 12:20 Vendredi) */}
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = shift.gardeDays || [];
                                  const next = isEveningGarde ? cur.filter((d) => d !== day.id) : [...cur, day.id];
                                  updateStaffShift(t.id, {
                                    gardeDays: next,
                                    hasGarde: next.length > 0,
                                  });
                                }}
                                className={`w-full py-0.5 px-1 rounded-md text-[8.5px] font-bold border transition-all cursor-pointer text-center flex items-center justify-center gap-0.5 ${
                                  isEveningGarde
                                    ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                                }`}
                                title={day.id === 5 ? `Garde Sortie Vendredi (12:20)` : `Garde Soir (16:15) le ${day.name}`}
                              >
                                <span>🌇</span>
                                <span>
                                  {isEveningGarde ? day.exitTime : day.id === 5 ? '12:20' : 'Soir'}
                                </span>
                              </button>

                              {/* Floor Selector (Visible when any Garde is active) */}
                              {(isMorningGarde || isLunchGarde || isEveningGarde) && (
                                <select
                                  value={assignedFloorId}
                                  onChange={(e) => {
                                    const nextFloors = { ...(shift.assignedFloors || {}), [day.id]: e.target.value };
                                    updateStaffShift(t.id, { assignedFloors: nextFloors });
                                  }}
                                  className="w-full text-[8px] py-0.5 px-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800 font-bold focus:outline-none cursor-pointer leading-tight"
                                  title="Affecter à un étage spécifique"
                                >
                                  {floors.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      🏢 {f.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Total Count */}
                      <td className="px-2 py-2 text-center align-middle border-l border-slate-100 dark:border-slate-800 font-bold">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-black ${
                          totalTeacherGardes > 0
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            : 'text-slate-400 bg-slate-100 dark:bg-slate-800'
                        }`}>
                          {totalTeacherGardes}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* 5. Modal: Configuration des Étages et Quotas */}
        {showFloorsModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Configuration des Étages, Cycles &amp; Quotas de Surveillance
                    </h2>
                    <p className="text-xs text-slate-500">
                      Définissez les étages de l'établissement, les règles spécifiques (ex: Sous-sol réservé Maternelle, RDC sans Déjeuner).
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFloorsModal(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Existing Floors List */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Étages actuels ({floors.length}) :
                </label>
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {floors.map((f) => (
                    <div
                      key={f.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-purple-500 shrink-0"></span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{f.name}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px]">
                          {/* Maternelle Only Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleFloorMaternelle(f.id)}
                            className={`px-2 py-0.5 rounded-lg font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                              f.isMaternelleOnly
                                ? 'bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border-pink-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <Baby className="w-3 h-3" />
                            <span>{f.isMaternelleOnly ? '👶 Réservé Maternelle (Exclusif)' : 'Tous cycles'}</span>
                          </button>

                          {/* Lunch Guard Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleFloorLunch(f.id)}
                            className={`px-2 py-0.5 rounded-lg font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                              f.hasLunchGuard !== false
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <UtensilsCrossed className="w-3 h-3" />
                            <span>{f.hasLunchGuard !== false ? '🍱 Garde Déjeuner Active (Lun-Jeu)' : '🍱 Pas de Garde Déjeuner'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-500 font-medium">Quota :</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={f.requiredTeachers}
                            onChange={(e) => handleUpdateFloorQuota(f.id, parseInt(e.target.value) || 1)}
                            className="w-14 px-2 py-1 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-center text-purple-600"
                          />
                          <span className="text-[11px] text-slate-400">ens.</span>
                        </div>

                        {floors.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteFloor(f.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                            title="Supprimer cet étage"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Floor Form */}
              <form onSubmit={handleAddFloor} className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Ajouter un nouvel étage ou secteur :
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    type="text"
                    placeholder="Ex: 3ème Étage, Salle Polyvalente..."
                    value={newFloorName}
                    onChange={(e) => setNewFloorName(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-xs rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={newFloorQuota}
                      onChange={(e) => setNewFloorQuota(parseInt(e.target.value) || 1)}
                      className="w-14 px-2 py-2 text-xs rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center font-bold text-purple-600"
                      title="Nombre d'enseignants requis"
                    />
                    <span className="text-xs text-slate-400">ens.</span>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20 cursor-pointer shrink-0 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter</span>
                  </button>
                </div>
              </form>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowFloorsModal(false)}
                  className="px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Fermer &amp; Appliquer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. Modal: Résolution Rapide des Manques & Affectation Manuelle par Étage */}
        {activeFloorForManualFix && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full p-6 space-y-5 my-8 max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/20">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                        {activeFloorForManualFix.name}
                      </h2>
                      {activeFloorForManualFix.isMaternelleOnly && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 font-bold border border-pink-300">
                          👶 Réservé Maternelle
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Gérez les surveillants, comblez les manques en 1 clic et ajustez manuellement pour chaque jour.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveFloorForManualFix(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Day Selection Tabs with Real-Time Deficit Indicators */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
                {SCHOOL_DAYS.map((day) => {
                  const dayCov = getFloorCoverageForDay(activeFloorForManualFix.id, day.id);
                  const isSelected = manualFixDay === day.id;

                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => setManualFixDay(day.id)}
                      className={`flex-1 min-w-[100px] px-3 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 border ${
                        isSelected
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/25'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{day.name}</span>
                      <div className="flex items-center gap-1">
                        {dayCov.hasDeficit ? (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold flex items-center gap-0.5 ${
                            isSelected ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          }`}>
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Manque</span>
                          </span>
                        ) : (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold flex items-center gap-0.5 ${
                            isSelected ? 'bg-emerald-400 text-slate-950' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            <Check className="w-2.5 h-2.5" />
                            <span>Complet</span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                {(() => {
                  const currentDayCov = getFloorCoverageForDay(activeFloorForManualFix.id, manualFixDay);
                  const currentDayObj = SCHOOL_DAYS.find((d) => d.id === manualFixDay)!;

                  return (
                    <div className="space-y-3">
                      {/* Slots Status Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* 🌅 Matin */}
                        <div className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                          currentDayCov.isMorningDeficit
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs flex items-center gap-1.5">
                              <span>🌅 Matin (08h00)</span>
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${
                              currentDayCov.isMorningDeficit
                                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            }`}>
                              {currentDayCov.morningCount} / {currentDayCov.quota}
                            </span>
                          </div>

                          <div className="space-y-1">
                            {currentDayCov.morningStaff.length > 0 ? (
                              currentDayCov.morningStaff.map((t) => (
                                <div key={t.id} className="flex items-center justify-between bg-white/70 dark:bg-slate-800/80 px-2 py-1 rounded-xl text-[11px] font-semibold">
                                  <span>{t.first_name} {t.last_name}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTeacherSlot(t.id, 'morning', manualFixDay)}
                                    className="text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer"
                                    title="Retirer cette garde"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 italic">
                                ⚠️ Aucun enseignant affecté
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 🍱 Midi */}
                        <div className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                          manualFixDay === 5 || activeFloorForManualFix.hasLunchGuard === false
                            ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400'
                            : currentDayCov.isLunchDeficit
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs flex items-center gap-1.5">
                              <span>🍱 Midi (12h20)</span>
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {manualFixDay === 5 ? 'Vendredi Exclu' : activeFloorForManualFix.hasLunchGuard === false ? 'Exclu' : `${currentDayCov.lunchCount} / 1`}
                            </span>
                          </div>

                          <div className="space-y-1">
                            {manualFixDay === 5 || activeFloorForManualFix.hasLunchGuard === false ? (
                              <p className="text-[10px] text-slate-400 italic">
                                {manualFixDay === 5 ? 'Sortie à 12h20 le Vendredi.' : 'Pas de garde déjeuner sur cet étage.'}
                              </p>
                            ) : currentDayCov.lunchStaff.length > 0 ? (
                              currentDayCov.lunchStaff.map((t) => (
                                <div key={t.id} className="flex items-center justify-between bg-white/70 dark:bg-slate-800/80 px-2 py-1 rounded-xl text-[11px] font-semibold">
                                  <span>{t.first_name} {t.last_name}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTeacherSlot(t.id, 'lunch', manualFixDay)}
                                    className="text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer"
                                    title="Retirer cette garde"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 italic">
                                ⚠️ Aucun enseignant affecté
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 🌇 Soir */}
                        <div className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                          currentDayCov.isEveningDeficit
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-xs flex items-center gap-1.5">
                              <span>🌇 Soir ({currentDayObj.exitTime})</span>
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${
                              currentDayCov.isEveningDeficit
                                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            }`}>
                              {currentDayCov.eveningCount} / {currentDayCov.quota}
                            </span>
                          </div>

                          <div className="space-y-1">
                            {currentDayCov.eveningStaff.length > 0 ? (
                              currentDayCov.eveningStaff.map((t) => (
                                <div key={t.id} className="flex items-center justify-between bg-white/70 dark:bg-slate-800/80 px-2 py-1 rounded-xl text-[11px] font-semibold">
                                  <span>{t.first_name} {t.last_name}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTeacherSlot(t.id, 'evening', manualFixDay)}
                                    className="text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer"
                                    title="Retirer cette garde"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 italic">
                                ⚠️ Aucun enseignant affecté
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Maternelle Notice */}
                      {activeFloorForManualFix.isMaternelleOnly && (
                        <div className="p-3 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-between gap-3 text-xs text-pink-900 dark:text-pink-200">
                          <div className="flex items-center gap-2">
                            <Baby className="w-4 h-4 text-pink-600 shrink-0" />
                            <span>
                              <strong>Règle Maternelle :</strong> Seuls les enseignants avec le badge 👶 Maternelle peuvent être affectés au Sous-sol. Cliquez sur &quot;👶 Marquer Maternelle&quot; sur un enseignant ci-dessous pour l&apos;autoriser.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Search & Filter Bar for Available Teachers */}
                      <div className="pt-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                          <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <UserPlus className="w-4 h-4 text-purple-600" />
                            <span>Sélectionner un Enseignant à Affecter ({currentDayObj.name})</span>
                          </h3>

                          {/* Quick Filter Buttons */}
                          <div className="flex items-center gap-1 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setManualFixFilter('all')}
                              className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                                manualFixFilter === 'all'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              Tous
                            </button>
                            <button
                              type="button"
                              onClick={() => setManualFixFilter('available_today')}
                              className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                                manualFixFilter === 'available_today'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              Présents {currentDayObj.name}
                            </button>
                            {activeFloorForManualFix.isMaternelleOnly && (
                              <button
                                type="button"
                                onClick={() => setManualFixFilter('maternelle')}
                                className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                                  manualFixFilter === 'maternelle'
                                    ? 'bg-pink-600 text-white'
                                    : 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300'
                                }`}
                              >
                                👶 Maternelle
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Search Input */}
                        <div className="relative mb-2">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Chercher un enseignant..."
                            value={manualFixSearch}
                            onChange={(e) => setManualFixSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        {/* List of Teachers */}
                        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                          {teachers
                            .filter((t) => {
                              const matchText = `${t.first_name} ${t.last_name} ${t.staff_code} ${t.role_title}`
                                .toLowerCase()
                                .includes(manualFixSearch.toLowerCase());
                              if (!matchText) return false;

                              const isMat = isMaternelleTeacher(t, maternelleTeacherIds);
                              if (manualFixFilter === 'maternelle' && !isMat) return false;

                              if (manualFixFilter === 'available_today') {
                                const hasDayClass = timetableSlots.some(
                                  (s) =>
                                    (s.teacher_id === t.id || s.teacher_id === t.staff_code || (t.staff_code && s.teacher_code === t.staff_code)) &&
                                    s.day_of_week === manualFixDay
                                );
                                if (!hasDayClass) return false;
                              }

                              return true;
                            })
                            .sort((a, b) => {
                              // If floor is Maternelle-only, prioritize Maternelle teachers
                              if (activeFloorForManualFix.isMaternelleOnly) {
                                const matA = isMaternelleTeacher(a, maternelleTeacherIds);
                                const matB = isMaternelleTeacher(b, maternelleTeacherIds);
                                if (matA && !matB) return -1;
                                if (!matA && matB) return 1;
                              }
                              return (teacherWeeklyHoursMap[a.id] || 0) - (teacherWeeklyHoursMap[b.id] || 0);
                            })
                            .map((t) => {
                              const shift = staffShifts[t.id];
                              const isMat = isMaternelleTeacher(t, maternelleTeacherIds);
                              const isMorningAssigned = shift?.gardeEntryDays?.includes(manualFixDay);
                              const isLunchAssigned = shift?.gardeLunchDays?.includes(manualFixDay);
                              const isEveningAssigned = shift?.gardeDays?.includes(manualFixDay);
                              const weeklyHours = teacherWeeklyHoursMap[t.id] || 0;

                              const daySlots = timetableSlots.filter(
                                (s) =>
                                  (s.teacher_id === t.id || s.teacher_id === t.staff_code || (t.staff_code && s.teacher_code === t.staff_code)) &&
                                  s.day_of_week === manualFixDay
                              );

                              return (
                                <div
                                  key={t.id}
                                  className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                                      <span>{t.first_name} {t.last_name}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">({t.staff_code})</span>
                                      <button
                                        type="button"
                                        onClick={() => toggleTeacherMaternelle(t.id)}
                                        className={`px-1.5 py-0.2 rounded text-[8px] font-bold border transition-all cursor-pointer flex items-center gap-0.5 ${
                                          isMat
                                            ? 'bg-pink-100 dark:bg-pink-950/70 text-pink-700 dark:text-pink-300 border-pink-300'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-pink-600 border-slate-200 dark:border-slate-700'
                                        }`}
                                        title="Cliquer pour basculer le statut Maternelle"
                                      >
                                        <Baby className="w-2.5 h-2.5" />
                                        <span>{isMat ? 'Maternelle ✓' : '+ Maternelle'}</span>
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      <span>{t.role_title}</span>
                                      <span>&bull;</span>
                                      <span className="font-bold text-purple-600 dark:text-purple-400">{weeklyHours}h charge</span>
                                      <span>&bull;</span>
                                      <span className={daySlots.length > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>
                                        {daySlots.length > 0 ? `${daySlots.length} cours ce jour` : 'Libre ce jour'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Action Buttons to Add to Slots */}
                                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                    {/* Morning Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isMorningAssigned) {
                                          handleRemoveTeacherSlot(t.id, 'morning', manualFixDay);
                                        } else {
                                          handleAssignTeacherSlot(t.id, 'morning', manualFixDay, activeFloorForManualFix.id);
                                        }
                                      }}
                                      className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                        isMorningAssigned
                                          ? 'bg-sky-600 text-white border-sky-500 shadow-xs'
                                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-sky-400'
                                      }`}
                                    >
                                      <span>🌅</span>
                                      <span>{isMorningAssigned ? '08:00 ✓' : '+ Matin'}</span>
                                    </button>

                                    {/* Lunch Button (if eligible) */}
                                    {manualFixDay !== 5 && activeFloorForManualFix.hasLunchGuard !== false && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (isLunchAssigned) {
                                            handleRemoveTeacherSlot(t.id, 'lunch', manualFixDay);
                                          } else {
                                            handleAssignTeacherSlot(t.id, 'lunch', manualFixDay, activeFloorForManualFix.id);
                                          }
                                        }}
                                        className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                          isLunchAssigned
                                            ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
                                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-amber-400'
                                        }`}
                                      >
                                        <span>🍱</span>
                                        <span>{isLunchAssigned ? '12:20 ✓' : '+ Midi'}</span>
                                      </button>
                                    )}

                                    {/* Evening Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isEveningAssigned) {
                                          handleRemoveTeacherSlot(t.id, 'evening', manualFixDay);
                                        } else {
                                          handleAssignTeacherSlot(t.id, 'evening', manualFixDay, activeFloorForManualFix.id);
                                        }
                                      }}
                                      className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                        isEveningAssigned
                                          ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-purple-400'
                                      }`}
                                    >
                                      <span>🌇</span>
                                      <span>{isEveningAssigned ? `${currentDayObj.exitTime} ✓` : '+ Soir'}</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDayFilter(manualFixDay);
                    setActiveFloorForManualFix(null);
                  }}
                  className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Afficher ce jour dans le grand tableau</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSave();
                    setActiveFloorForManualFix(null);
                  }}
                  className="px-5 py-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-md shadow-purple-600/25 hover:from-purple-500 hover:to-indigo-500 cursor-pointer"
                >
                  Enregistrer &amp; Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. Printable Official Planning Document (Visible only when Printing - Full Weekly Schedule for All Staff) */}
        <div className="hidden print:block print-container text-slate-900 bg-white p-2 w-full">
          <style dangerouslySetInnerHTML={{ __html: `
            @page {
              size: landscape;
              margin: 6mm 8mm;
            }
            @media print {
              html, body {
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                font-size: 10px !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                background: white !important;
              }
              aside, header, nav, footer, [aria-hidden="true"], .print\\:hidden {
                display: none !important;
                visibility: hidden !important;
              }
              .print-container {
                display: block !important;
                width: 100% !important;
                box-sizing: border-box !important;
                background: white !important;
              }
              .print-header {
                margin-bottom: 8px !important;
              }
              .print-table-wrapper {
                width: 100% !important;
                margin: 6px 0 12px 0 !important;
              }
              .print-table {
                width: 100% !important;
                table-layout: fixed !important;
                border-collapse: collapse !important;
              }
              .print-table thead tr {
                background-color: #f1f5f9 !important;
                -webkit-print-color-adjust: exact !important;
              }
              .print-table tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .print-table td, .print-table th {
                padding: 4px 5px !important;
                vertical-align: middle !important;
              }
              .print-footer {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                margin-top: 14px !important;
              }
            }
          `}} />

          {/* Header with Logo on Top Left */}
          <div className="print-header flex items-center justify-between border-b-2 border-slate-900 pb-2">
            <div className="flex items-center gap-3.5">
              <img
                src="/logo.png"
                alt="Logo École"
                className="w-14 h-14 object-contain shrink-0"
              />
              <div>
                <h1 className="text-base font-black uppercase tracking-tight text-slate-900 leading-tight">
                  GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES
                </h1>
                <p className="text-[10px] font-bold text-slate-600 leading-tight">
                  DIRECTION PÉDAGOGIQUE — PLANNING OFFICIEL DE SURVEILLANCE &amp; GARDES (LUNDI &mdash; VENDREDI)
                </p>
                <div className="text-[9px] text-slate-500 font-semibold mt-0.5">
                  Matin (08h00) &bull; Déjeuner (12h20 Lun-Jeu) &bull; Sortie (16h00 Lun-Jeu / 12h20 Vendredi)
                </div>
              </div>
            </div>
            <div className="text-right text-[10px] shrink-0 font-medium">
              <div className="font-bold text-slate-900">Année Scolaire : 2026 - 2027</div>
              <div className="text-slate-500">Date d'édition : {new Date().toLocaleDateString('fr-FR')}</div>
              <div className="text-[9px] text-purple-700 font-bold">5 Jours &bull; Samedi Repos</div>
            </div>
          </div>

          {/* Official Planning Table by Floors & Days (Exact School Board Grid matching Sketch) */}
          <div className="print-table-wrapper">
            <table className="print-table w-full table-fixed border-collapse text-[10px] border border-slate-900">
              <thead>
                <tr className="bg-slate-100 border border-slate-900 text-center font-bold">
                  <th className="p-2 text-left border border-slate-900 w-[14%] bg-slate-200 text-slate-900">Étages</th>
                  <th className="p-2 border border-slate-900 w-[11%] bg-slate-200 text-slate-900">Créneaux</th>
                  <th className="p-2 border border-slate-900 w-[15%]">Lundi</th>
                  <th className="p-2 border border-slate-900 w-[15%]">Mardi</th>
                  <th className="p-2 border border-slate-900 w-[15%]">Mercredi</th>
                  <th className="p-2 border border-slate-900 w-[15%]">Jeudi</th>
                  <th className="p-2 border border-slate-900 w-[15%]">Vendredi (12h20)</th>
                </tr>
              </thead>
              <tbody>
                {floors.map((floor) => {
                  const slots = getFloorSlots(floor);
                  return slots.map((slot, sIdx) => (
                    <tr key={`${floor.id}-${slot.key}`} className="border border-slate-900 text-center">
                      {sIdx === 0 && (
                        <td
                          rowSpan={slots.length}
                          className="p-2 border border-slate-900 font-black text-center bg-slate-100/70 text-slate-900 text-[11px] align-middle"
                        >
                          <div className="font-extrabold">{floor.name}</div>
                          {floor.isMaternelleOnly && (
                            <div className="text-[8.5px] text-pink-700 font-bold mt-0.5">(Maternelle)</div>
                          )}
                          <div className="text-[8px] text-slate-600 font-normal mt-0.5">Quota: {floor.requiredTeachers} ens.</div>
                        </td>
                      )}
                      <td className="p-1.5 border border-slate-900 font-bold text-center bg-slate-50 text-slate-800 text-[9.5px] align-middle">
                        <div className="font-bold">{slot.label}</div>
                        <div className="text-[8px] text-slate-500 font-normal">{slot.time}</div>
                      </td>
                      {SCHOOL_DAYS.map((day) => {
                        const isVenLunch = day.id === 5 && slot.key === 'lunch';
                        const assigned = getSlotAssignedTeachers(floor.id, day.id, slot.key);

                        return (
                          <td key={day.id} className="p-1.5 border border-slate-900 text-center align-middle">
                            {isVenLunch ? (
                              <span className="text-slate-400 text-[8px]">-</span>
                            ) : assigned.length > 0 ? (
                              <div className="space-y-0.5">
                                {assigned.map((t) => (
                                  <div key={t.id} className="font-black text-[10px] text-slate-900 leading-tight">
                                    {t.first_name} {t.last_name}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-300 font-mono text-[9px]">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Compact Signatures */}
          <div className="print-footer pt-3 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-[10px] font-bold">
            <div>
              <p className="uppercase tracking-wider text-slate-800">Le Surveillant Général</p>
              <div className="h-12"></div>
              <p className="text-slate-400 text-[9px]">Cachet &amp; Signature</p>
            </div>
            <div>
              <p className="uppercase tracking-wider text-slate-800">La Direction de l'Établissement</p>
              <div className="h-12"></div>
              <p className="text-slate-400 text-[9px]">Cachet &amp; Signature</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
