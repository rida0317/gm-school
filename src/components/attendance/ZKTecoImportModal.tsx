'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { StaffMember, StaffAttendanceRecord, AttendanceStatus } from '@/types/database';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import {
  UploadCloud,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Sparkles,
  Settings2,
  Calendar,
  UserCheck,
  Eye,
  RefreshCw,
  X,
  Sliders,
  Check,
  AlertCircle,
  HelpCircle,
  Save,
  BookmarkCheck,
  Lightbulb,
  Wand2,
  Zap,
  TableProperties
} from 'lucide-react';

export interface ShiftConfig {
  staffId: string;
  expectedEntry: string; // e.g. "08:00" or "08:15"
  expectedExit: string;  // e.g. "16:00", "12:20"
  hasGarde: boolean;     // true if guard duty sortie today
  gardeDays?: number[];  // [1, 2, ...] days of week for Garde Sortie
  hasGardeEntry?: boolean; // true if guard duty entrée today
  gardeEntryDays?: number[]; // [1, 2, ...] days of week for Garde Entrée
  hasGardeLunch?: boolean;
  gardeLunchDays?: number[]; // [1, 2, ...] days of week for Garde Déjeuner
  assignedFloors?: Record<number, string>; // dayNum -> floorId
}

export interface ParsedPunch {
  pin: string;
  date: string;
  time: string; // "08:14:22"
}

export interface ComputedAttendanceItem {
  staff: StaffMember;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  expectedEntry: string;
  expectedExit: string;
  hasGarde: boolean;
  hasGardeEntry?: boolean;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  gardeRespected?: boolean;
  notes?: string;
  rawPunchesCount: number;
}

interface ZKTecoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  staffList: StaffMember[];
  onApplyAttendance: (records: StaffAttendanceRecord[], shiftConfigs: Record<string, ShiftConfig>) => void;
}

const STORAGE_KEY_MASTER = 'gm_staff_permanent_shifts_master_v1';
const STORAGE_KEY_GLOBAL = 'gm_staff_shifts_global_defaults_v1';

export function ZKTecoImportModal({
  isOpen,
  onClose,
  selectedDate,
  staffList,
  onApplyAttendance,
}: ZKTecoImportModalProps) {
  const { dir } = useI18n();

  // Tabs / Steps: 'upload' | 'shifts' | 'preview'
  const [activeStep, setActiveStep] = useState<'upload' | 'shifts' | 'preview'>('upload');

  // Tolerance in minutes (e.g. 5 minutes grace period)
  const [graceMinutes, setGraceMinutes] = useState<number>(5);

  // Global default shifts (Horaires Officiels : Entrée 08:00, Sortie Standard 16:00, Sortie Garde 16:15)
  const [defaultEntry, setDefaultEntry] = useState<string>('08:00');
  const [defaultGardeEntry, setDefaultGardeEntry] = useState<string>('08:00');
  const [defaultExit, setDefaultExit] = useState<string>('16:00');
  const [defaultGardeExit, setDefaultGardeExit] = useState<string>('16:15');

  // Per-staff permanent shift / garde configuration
  const [staffShifts, setStaffShifts] = useState<Record<string, ShiftConfig>>({});

  // Save feedback indicator
  const [isSavedFeedback, setIsSavedFeedback] = useState<boolean>(false);

  // Raw file content / parsed punches
  const [rawText, setRawText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parsedPunches, setParsedPunches] = useState<ParsedPunch[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search in shift planning table
  const [shiftSearch, setShiftSearch] = useState('');

  // Planning View mode: 'list' (individual view) or 'matrix' (weekly timetable matrix)
  const [planningViewMode, setPlanningViewMode] = useState<'list' | 'matrix'>('list');

  // Timetable slots fetched from database
  const [timetableSlots, setTimetableSlots] = useState<any[]>([]);
  const [isSyncingTimetable, setIsSyncingTimetable] = useState(false);
  const [syncFeedbackMessage, setSyncFeedbackMessage] = useState<string | null>(null);

  // Fetch timetable slots on modal open
  useEffect(() => {
    if (!isOpen) return;
    async function loadTimetable() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.from('timetable_slots').select('*');
        if (!error && data) {
          setTimetableSlots(data);
        }
      } catch (err) {
        console.warn('Could not load timetable slots:', err);
      }
    }
    loadTimetable();
  }, [isOpen]);

  // 1. Initialize permanent master shifts & global settings from Supabase & localStorage
  const loadShiftsFromMasterAndDb = React.useCallback(async () => {
    let loaded: Record<string, ShiftConfig> = {};

    // A. Read from localStorage for instantaneous display
    try {
      const savedMaster = localStorage.getItem(STORAGE_KEY_MASTER);
      if (savedMaster) {
        loaded = JSON.parse(savedMaster);
      }
    } catch {
      // ignore
    }

    // B. Fetch authoritative data from Supabase 'gardes_planning'
    try {
      const supabase = createClient();
      const { data: dbPlanning } = await supabase
        .from('gardes_planning')
        .select('shifts')
        .eq('id', 'master')
        .maybeSingle();

      if (dbPlanning?.shifts && typeof dbPlanning.shifts === 'object') {
        loaded = { ...loaded, ...dbPlanning.shifts };
        try {
          localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(loaded));
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn('Supabase gardes shifts fetch error:', err);
    }

    // C. Ensure all current staff members are included
    const merged: Record<string, ShiftConfig> = {};
    staffList.forEach((s) => {
      if (loaded[s.id]) {
        merged[s.id] = loaded[s.id];
      } else {
        merged[s.id] = {
          staffId: s.id,
          expectedEntry: '08:00',
          expectedExit: defaultExit,
          hasGarde: false,
          hasGardeEntry: false,
          hasGardeLunch: false,
          gardeDays: [],
          gardeEntryDays: [],
          gardeLunchDays: [],
        };
      }
    });

    setStaffShifts(merged);
  }, [staffList, defaultExit]);

  useEffect(() => {
    if (!isOpen) return;

    // Load global settings if saved
    try {
      const savedGlobal = localStorage.getItem(STORAGE_KEY_GLOBAL);
      if (savedGlobal) {
        const parsedG = JSON.parse(savedGlobal);
        if (parsedG.defaultEntry) setDefaultEntry(parsedG.defaultEntry);
        if (parsedG.defaultExit) setDefaultExit(parsedG.defaultExit);
        if (parsedG.defaultGardeExit) setDefaultGardeExit(parsedG.defaultGardeExit);
        if (typeof parsedG.graceMinutes === 'number') setGraceMinutes(parsedG.graceMinutes);
      }
    } catch {
      // ignore
    }

    loadShiftsFromMasterAndDb();

    // Listen to live updates from /gardes page or other tabs
    const handleLiveUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ shifts?: Record<string, ShiftConfig> }>;
      if (custom.detail?.shifts) {
        setStaffShifts((prev) => ({ ...prev, ...custom.detail?.shifts }));
      } else {
        loadShiftsFromMasterAndDb();
      }
    };

    window.addEventListener('gm_gardes_planning_updated', handleLiveUpdate);
    window.addEventListener('storage', handleLiveUpdate);

    return () => {
      window.removeEventListener('gm_gardes_planning_updated', handleLiveUpdate);
      window.removeEventListener('storage', handleLiveUpdate);
    };
  }, [isOpen, loadShiftsFromMasterAndDb]);

  // ⚡ Synchronize Gardes with Timetable Slots
  const handleSyncWithTimetable = async () => {
    setIsSyncingTimetable(true);
    setSyncFeedbackMessage(null);

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

      const selectedDayOfWeek = new Date(selectedDate).getDay();
      let totalMorningGardesDetected = 0;
      let totalEveningGardesDetected = 0;

      const updatedShifts: Record<string, ShiftConfig> = {};

      staffList.forEach((staff) => {
        const current = staffShifts[staff.id] || {
          staffId: staff.id,
          expectedEntry: '08:00',
          expectedExit: defaultExit,
          hasGarde: false,
          hasGardeEntry: false,
        };

        // Check if teacher is Vacataire -> strictly exclude from Gardes
        const isVacataire =
          (staff.contract_type || '').toUpperCase() === 'VACATAIRE' ||
          (staff.role_title || '').toLowerCase().includes('vacataire');

        if (isVacataire) {
          updatedShifts[staff.id] = {
            ...current,
            gardeEntryDays: [],
            hasGardeEntry: false,
            expectedEntry: '08:00',
            gardeDays: [],
            hasGarde: false,
            expectedExit: defaultExit,
          };
          return;
        }

        // Find all timetable slots for this teacher
        const teacherSlots = slots.filter(
          (slot) =>
            slot.teacher_id === staff.id ||
            slot.teacher_id === staff.staff_code ||
            (staff.staff_code && slot.teacher_code === staff.staff_code)
        );

        if (teacherSlots.length === 0) {
          // No slots found -> keep current
          updatedShifts[staff.id] = current;
          return;
        }

        const morningDays: number[] = [];
        const eveningDays: number[] = [];

        // Check each day 1 to 6 (Lundi à Samedi)
        for (let d = 1; d <= 6; d++) {
          const daySlots = teacherSlots.filter((s) => s.day_of_week === d);
          
          // Only evaluate days where teacher is scheduled or active in school
          // (or if teacher has at least 1 slot on this day, we check their free half-day)
          if (daySlots.length === 0) continue;

          // Morning Sessions check: P1, P2, P3 or start before 12:00
          const hasMorningSession = daySlots.some(
            (s) =>
              s.period_id === 'P1' ||
              s.period_id === 'P2' ||
              s.period_id === 'P3' ||
              (s.start_time && s.start_time < '12:00')
          );

          // Afternoon Sessions check: P4, P5, P6, P7 or start/end after 12:30
          const hasAfternoonSession = daySlots.some(
            (s) =>
              s.period_id === 'P4' ||
              s.period_id === 'P5' ||
              s.period_id === 'P6' ||
              s.period_id === 'P7' ||
              (s.end_time && s.end_time > '12:30')
          );

          // 1. Garde Matin (08:00): Assignée aux enseignants qui N'ONT PAS de cours le matin (disponibles pour la surveillance)
          if (!hasMorningSession) {
            morningDays.push(d);
            totalMorningGardesDetected++;
          }

          // 2. Garde Soir (16:30): Assignée aux enseignants qui N'ONT PAS de cours l'après-midi (disponibles pour la surveillance de sortie)
          if (!hasAfternoonSession) {
            eveningDays.push(d);
            totalEveningGardesDetected++;
          }
        }

        const isMorningGardeToday = morningDays.includes(selectedDayOfWeek);
        const isEveningGardeToday = eveningDays.includes(selectedDayOfWeek);

        updatedShifts[staff.id] = {
          ...current,
          gardeEntryDays: morningDays,
          hasGardeEntry: isMorningGardeToday,
          expectedEntry: isMorningGardeToday ? '08:00' : '08:15',
          gardeDays: eveningDays,
          hasGarde: isEveningGardeToday,
          expectedExit: isEveningGardeToday ? defaultGardeExit : defaultExit,
        };
      });

      setStaffShifts(updatedShifts);

      // Auto persist
      try {
        localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(updatedShifts));
        localStorage.setItem(`gm_staff_shifts_${selectedDate}`, JSON.stringify(updatedShifts));
      } catch {
        // ignore
      }

      setSyncFeedbackMessage(
        `✨ Synchronisation réussie : ${totalMorningGardesDetected} Gardes Matin (08:00) assignées aux enseignants libres le matin, et ${totalEveningGardesDetected} Gardes Soir (16:30) à ceux libres l'après-midi !`
      );
      setIsSavedFeedback(true);
      setTimeout(() => setIsSavedFeedback(false), 4000);
    } catch (err: any) {
      setSyncFeedbackMessage(`Erreur lors de la synchronisation : ${err.message}`);
    } finally {
      setIsSyncingTimetable(false);
    }
  };

  // Save permanent master shift configs and global settings to Supabase and localStorage
  const persistShiftsToSupabaseAndLocal = async (nextShifts: Record<string, ShiftConfig>) => {
    try {
      localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(nextShifts));
      localStorage.setItem(`gm_staff_shifts_${selectedDate}`, JSON.stringify(nextShifts));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('gm_gardes_planning_updated', {
            detail: { shifts: nextShifts },
          })
        );
      }

      const supabase = createClient();
      await supabase.from('gardes_planning').upsert({
        id: 'master',
        shifts: nextShifts,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Failed to save shifts to Supabase:', err);
    }
  };

  const handleSavePermanentPlanning = async () => {
    try {
      await persistShiftsToSupabaseAndLocal(staffShifts);
      localStorage.setItem(
        STORAGE_KEY_GLOBAL,
        JSON.stringify({
          defaultEntry,
          defaultExit,
          defaultGardeExit,
          graceMinutes,
        })
      );

      setIsSavedFeedback(true);
      setTimeout(() => setIsSavedFeedback(false), 3000);
    } catch (err) {
      console.warn('Failed to save planning:', err);
    }
  };

  // Update specific shift config in state and auto-persist to Supabase & localStorage
  const updateStaffShift = (staffId: string, updates: Partial<ShiftConfig>) => {
    setStaffShifts((prev) => {
      const current = prev[staffId] || {
        staffId,
        expectedEntry: '08:15',
        expectedExit: defaultExit,
        hasGarde: false,
        hasGardeEntry: false,
      };
      const updated = { ...current, ...updates };

      // If hasGardeEntry is toggled on, entry is 08:00, otherwise default 08:15
      if (updates.hasGardeEntry === true && !updates.expectedEntry) {
        updated.expectedEntry = '08:00';
      } else if (updates.hasGardeEntry === false && !updates.expectedEntry) {
        updated.expectedEntry = '08:15';
      }

      // If hasGarde (Sortie) is toggled on, default exit to garde time (16:15)
      if (updates.hasGarde === true && !updates.expectedExit) {
        updated.expectedExit = defaultGardeExit || '16:15';
      } else if (updates.hasGarde === false && !updates.expectedExit) {
        updated.expectedExit = defaultExit;
      }

      const next = { ...prev, [staffId]: updated };
      persistShiftsToSupabaseAndLocal(next);
      return next;
    });
  };

  // Quick batch apply entry to all
  const applyEntryToAll = (time: string) => {
    setStaffShifts((prev) => {
      const next: Record<string, ShiftConfig> = {};
      staffList.forEach((s) => {
        next[s.id] = {
          ...(prev[s.id] || { staffId: s.id, expectedExit: defaultExit, hasGarde: false, hasGardeEntry: false }),
          expectedEntry: time,
        };
      });
      persistShiftsToSupabaseAndLocal(next);
      return next;
    });
  };

  // Helper to convert "HH:MM" or "HH:MM:SS" to minutes from midnight
  const timeToMinutes = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map((p) => parseInt(p, 10));
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    return h * 60 + m;
  };

  // 2. Parse ZKTeco file content
  const parseZKTecoContent = (content: string) => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const lines = content.split(/\r?\n/);
      const punches: ParsedPunch[] = [];

      lines.forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.toLowerCase().includes('matricule') || line.toLowerCase().includes('user id')) {
          return;
        }

        // Patterns to match:
        // Format A (Tab / space separated standard ZKTeco .dat/.txt): "101\t2025-08-23 08:14:22\t1\t0"
        // Format B (CSV/Semicolon): "101,2025-08-23,08:14:22" or "ADM-001;2025-08-23 08:14:22"
        const tokens = line.split(/[\t,;]+|\s{2,}/).map((t) => t.trim().replace(/^"|"$/g, ''));

        if (tokens.length >= 2) {
          const pinCandidate = tokens[0];
          let datePart = '';
          let timePart = '';

          // Look for date & time in tokens
          const dateTimeToken = tokens.find((t) => /\d{4}[-/]\d{2}[-/]\d{2}/.test(t));
          if (dateTimeToken) {
            const dtMatch = dateTimeToken.match(/(\d{4}[-/]\d{2}[-/]\d{2})[ T](\d{1,2}:\d{2}(?::\d{2})?)/);
            if (dtMatch) {
              datePart = dtMatch[1].replace(/\//g, '-');
              timePart = dtMatch[2];
            } else {
              datePart = dateTimeToken.replace(/\//g, '-');
              // Look for time in adjacent token
              const timeToken = tokens.find((t) => /^\d{1,2}:\d{2}(?::\d{2})?$/.test(t));
              if (timeToken) timePart = timeToken;
            }
          } else {
            // Space delimited line: "101 2025-08-23 08:14:22 1 0"
            const spaceParts = line.split(/\s+/);
            if (spaceParts.length >= 3) {
              const dt = spaceParts.find((p) => /\d{4}[-/]\d{2}[-/]\d{2}/.test(p));
              const tm = spaceParts.find((p) => /^\d{1,2}:\d{2}(?::\d{2})?$/.test(p));
              if (dt && tm) {
                datePart = dt.replace(/\//g, '-');
                timePart = tm;
              }
            }
          }

          if (pinCandidate && timePart) {
            punches.push({
              pin: pinCandidate.toUpperCase(),
              date: datePart || selectedDate,
              time: timePart.length === 5 ? `${timePart}:00` : timePart,
            });
          }
        }
      });

      if (punches.length === 0) {
        setErrorMessage('Aucun pointage valide détecté. Vérifiez le format du fichier ZKTeco.');
      } else {
        setParsedPunches(punches);
        setActiveStep('preview');
      }
    } catch (err: any) {
      setErrorMessage(`Erreur lors de la lecture du fichier : ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle file drop / select
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      setRawText(content);
      parseZKTecoContent(content);
    };
    reader.readAsText(file);
  };

  // 3. Compute Attendance per staff member based on punches and saved shifts
  const computedAttendance: ComputedAttendanceItem[] = useMemo(() => {
    // Group punches by matching staff member
    const punchesByStaff: Record<string, string[]> = {};

    staffList.forEach((s) => {
      punchesByStaff[s.id] = [];
    });

    parsedPunches.forEach((p) => {
      // Check if date matches selectedDate (or if date is not specified)
      if (p.date && p.date !== selectedDate) return;

      // Find staff by matching pin/code
      const matched = staffList.find((s) => {
        const code = s.staff_code.toUpperCase();
        const pin = p.pin.toUpperCase();
        if (code === pin) return true;
        if (code.replace(/\D/g, '') === pin.replace(/\D/g, '') && pin.replace(/\D/g, '') !== '') return true;
        if (s.id.toUpperCase().includes(pin)) return true;
        return false;
      });

      if (matched) {
        punchesByStaff[matched.id].push(p.time);
      }
    });

    const currentDayOfWeek = new Date(selectedDate).getDay();

    return staffList.map((staff) => {
      const times = (punchesByStaff[staff.id] || []).sort();
      const shift = staffShifts[staff.id] || {
        staffId: staff.id,
        expectedEntry: defaultEntry,
        expectedExit: defaultExit,
        hasGarde: false,
        hasGardeEntry: false,
      };

      // Check recurring guard duty days from master planning
      const isGardeEntryToday = Boolean(
        shift.gardeEntryDays?.includes(currentDayOfWeek) ||
        (shift.hasGardeEntry && currentDayOfWeek >= 1 && currentDayOfWeek <= 5)
      );
      const isGardeExitToday = Boolean(
        shift.gardeDays?.includes(currentDayOfWeek) ||
        (shift.hasGarde && currentDayOfWeek >= 1 && currentDayOfWeek <= 5)
      );
      const isGardeLunchToday = Boolean(
        shift.gardeLunchDays?.includes(currentDayOfWeek) ||
        (shift.hasGardeLunch && currentDayOfWeek >= 1 && currentDayOfWeek <= 4)
      );

      // Expected entry: if guard morning -> 08:00; else default
      const expectedEntryTime = isGardeEntryToday
        ? (shift.expectedEntry || '08:00')
        : (shift.expectedEntry || (staff.category === 'ENSEIGNANT' ? '08:15' : defaultEntry));

      // Expected exit: if Friday (day 5) -> 12:20; else Mon-Thu with Garde -> 16:15; else -> 16:00
      let expectedExitTime = shift.expectedExit || defaultExit;
      if (currentDayOfWeek === 5) {
        expectedExitTime = '12:20';
      } else if (isGardeExitToday) {
        expectedExitTime = shift.expectedExit || defaultGardeExit || '16:15';
      }

      if (times.length === 0) {
        // No punch -> ABSENT
        return {
          staff,
          status: 'ABSENT' as AttendanceStatus,
          expectedEntry: expectedEntryTime,
          expectedExit: expectedExitTime,
          hasGarde: !!isGardeExitToday,
          hasGardeEntry: !!isGardeEntryToday,
          lateMinutes: 0,
          earlyDepartureMinutes: 0,
          notes: 'Non pointé sur la pointeuse ZKTeco',
          rawPunchesCount: 0,
        };
      }

      const firstPunch = times[0].slice(0, 5); // "08:14"
      const lastPunch = times.length > 1 ? times[times.length - 1].slice(0, 5) : undefined;

      const firstPunchMins = timeToMinutes(firstPunch);
      const expectedEntryMins = timeToMinutes(expectedEntryTime);
      const expectedExitMins = timeToMinutes(expectedExitTime);

      // Late calculation with tolerance
      const diffEntry = firstPunchMins - expectedEntryMins;
      let lateMins = 0;
      let status: AttendanceStatus = 'PRESENT';

      if (diffEntry > graceMinutes) {
        status = 'LATE';
        lateMins = diffEntry;
      }

      // Early departure calculation
      let earlyDeparture = 0;
      let gardeRespected = true;
      if (lastPunch) {
        const lastPunchMins = timeToMinutes(lastPunch);
        if (lastPunchMins < expectedExitMins) {
          earlyDeparture = expectedExitMins - lastPunchMins;
          if (isGardeExitToday) {
            gardeRespected = false;
          }
        }
      }

      let notes = '';
      if (status === 'LATE') {
        notes = `Retard de ${lateMins} min (Arrivée : ${firstPunch} vs Prévu : ${expectedEntryTime})`;
      }
      if (isGardeEntryToday) {
        notes += (notes ? ' • ' : '') + `🌅 Garde Matin (${expectedEntryTime})`;
      }
      if (isGardeLunchToday) {
        notes += (notes ? ' • ' : '') + `🍽️ Garde Déjeuner`;
      }
      if (isGardeExitToday && !gardeRespected) {
        notes += (notes ? ' • ' : '') + `⚠️ Départ anticipé (${lastPunch || '-'} vs fin garde ${expectedExitTime})`;
      } else if (isGardeExitToday) {
        notes += (notes ? ' • ' : '') + `🌇 Garde Soir respectée (${expectedExitTime})`;
      }

      return {
        staff,
        status,
        checkInTime: firstPunch,
        checkOutTime: lastPunch,
        expectedEntry: expectedEntryTime,
        expectedExit: expectedExitTime,
        hasGarde: !!isGardeExitToday,
        hasGardeEntry: !!isGardeEntryToday,
        lateMinutes: lateMins,
        earlyDepartureMinutes: earlyDeparture,
        gardeRespected,
        notes: notes || 'Présent à l’heure',
        rawPunchesCount: times.length,
      };
    });
  }, [staffList, parsedPunches, selectedDate, staffShifts, defaultEntry, defaultGardeEntry, defaultExit, defaultGardeExit, graceMinutes]);

  // Statistics Summary
  const stats = useMemo(() => {
    const total = computedAttendance.length;
    const present = computedAttendance.filter((i) => i.status === 'PRESENT').length;
    const late = computedAttendance.filter((i) => i.status === 'LATE').length;
    const absent = computedAttendance.filter((i) => i.status === 'ABSENT').length;
    const totalLateMins = computedAttendance.reduce((acc, curr) => acc + curr.lateMinutes, 0);
    const totalGardes = computedAttendance.filter((i) => i.hasGarde).length;

    return { total, present, late, absent, totalLateMins, totalGardes };
  }, [computedAttendance]);

  // Final apply handler
  const handleConfirmAndApply = () => {
    // Save permanent config on apply as well
    handleSavePermanentPlanning();

    const recordsToApply: StaffAttendanceRecord[] = computedAttendance.map((item) => ({
      id: `zk-${item.staff.id}-${selectedDate}`,
      staff_id: item.staff.id,
      date: selectedDate,
      status: item.status,
      check_in_time: item.checkInTime,
      expected_time: item.expectedEntry,
      check_out_time: item.checkOutTime,
      late_minutes: item.lateMinutes,
      is_justified: false,
      justification_reason: '',
      notes: item.notes,
    }));

    onApplyAttendance(recordsToApply, staffShifts);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
        dir={dir}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 font-black text-sm">
              ZK
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Import Pointeuse ZKTeco &amp; Calcul des Horaires
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                  Planning Permanent Actif
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Date de pointage : <span className="font-bold text-sky-600 dark:text-sky-400">{selectedDate}</span> &bull; Horaires sauvegardés automatiquement pour tous les imports
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-2.5 gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveStep('upload')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeStep === 'upload'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>1. Fichier ZKTeco (.DAT / .TXT / .CSV)</span>
            </button>

            <button
              onClick={() => setActiveStep('shifts')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeStep === 'shifts'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>2. Planning Horaires &amp; Gardes (Enregistré)</span>
              {stats.totalGardes > 0 && (
                <span className="px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold">
                  {stats.totalGardes} Gardes
                </span>
              )}
            </button>

            <button
              onClick={() => {
                if (parsedPunches.length > 0) setActiveStep('preview');
              }}
              disabled={parsedPunches.length === 0}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeStep === 'preview'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : parsedPunches.length > 0
                  ? 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  : 'opacity-40 cursor-not-allowed text-slate-400'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>3. Résultats &amp; Calcul des Retards</span>
              {parsedPunches.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>
          </div>

          {/* Permanent Save Indicator button */}
          {activeStep === 'shifts' && (
            <button
              onClick={handleSavePermanentPlanning}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isSavedFeedback
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {isSavedFeedback ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Planning Enregistré !</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-sky-500" />
                  <span>Enregistrer les Modifications</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: FILE UPLOAD */}
          {activeStep === 'upload' && (
            <div className="space-y-6">
              {/* Permanent Planning Status Notice */}
              <div className="p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300">
                  <BookmarkCheck className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
                  <span>
                    <strong>Planning Permanent actif :</strong> Vos réglages d&apos;horaires (08:00 / 08:15) et de gardes (16:30) sont mémorisés et seront appliqués directement lors de l&apos;import.
                  </span>
                </div>
                <button
                  onClick={() => setActiveStep('shifts')}
                  className="text-xs font-bold text-sky-700 dark:text-sky-300 hover:underline shrink-0 cursor-pointer"
                >
                  Modifier le planning &rarr;
                </button>
              </div>

              {/* 💡 Conseil Pratique pour ZKTeco */}
              <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3.5 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-950 dark:text-amber-100 text-xs">
                    <span>💡 Conseil pratique pour ZKTeco :</span>
                  </div>
                  <p className="leading-relaxed text-amber-900/90 dark:text-amber-300/90">
                    Lors de la saisie des employés et enseignants sur la pointeuse ou le logiciel ZKTeco ATT, veillez à renseigner dans le champ <strong className="font-semibold text-amber-950 dark:text-amber-100">User ID / PIN / N° Utilisateur</strong> exactement le même <strong className="font-semibold text-amber-950 dark:text-amber-100">Matricule</strong> que celui présent sur la plateforme (ex: <code className="px-1.5 py-0.5 bg-amber-200/60 dark:bg-amber-900/60 rounded font-mono font-bold">1</code>, <code className="px-1.5 py-0.5 bg-amber-200/60 dark:bg-amber-900/60 rounded font-mono font-bold">2</code> ou <code className="px-1.5 py-0.5 bg-amber-200/60 dark:bg-amber-900/60 rounded font-mono font-bold">ENS-001</code>, <code className="px-1.5 py-0.5 bg-amber-200/60 dark:bg-amber-900/60 rounded font-mono font-bold">ADM-001</code>). Cela permet une synchronisation 100% automatique et sans aucune erreur.
                  </p>
                </div>
              </div>

              {/* Drag & Drop Box */}
              <div className="border-2 border-dashed border-sky-300 dark:border-sky-800 hover:border-sky-500 rounded-3xl p-8 text-center bg-sky-50/40 dark:bg-sky-950/20 transition-all flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-3xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-inner">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Glissez-déposez le journal de pointage ZKTeco
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                    Fichiers exportés de la clé USB ou du logiciel ZKTeco : <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">attlog.dat</span>, <span className="font-mono text-sky-600 font-bold">.txt</span>, <span className="font-mono text-sky-600 font-bold">.csv</span> ou <span className="font-mono text-sky-600 font-bold">.xlsx</span>.
                  </p>
                </div>

                <label className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg shadow-sky-600/30 transition-all cursor-pointer">
                  <FileText className="w-4 h-4" />
                  <span>Parcourir mes Fichiers</span>
                  <input
                    type="file"
                    accept=".dat,.txt,.csv,.log,.tsv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {fileName && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Fichier chargé : <strong className="text-sky-600">{fileName}</strong> ({parsedPunches.length} pointages)</span>
                  </div>
                )}
              </div>

              {/* Paste Raw Logs Alternative */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Ou collez directement le texte brut des pointages :</span>
                  </label>
                  {rawText && (
                    <button
                      onClick={() => parseZKTecoContent(rawText)}
                      className="text-xs font-bold text-sky-600 hover:underline cursor-pointer"
                    >
                      Analyser le texte collé
                    </button>
                  )}
                </div>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Exemple ZKTeco :&#10;1&#9;2025-08-23 08:04:12&#9;1&#9;0&#10;2&#9;2025-08-23 08:24:50&#9;1&#9;0&#10;ADM-001&#9;2025-08-23 07:58:00&#9;1&#9;0"
                  rows={4}
                  className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-sky-500 focus:outline-none text-slate-800 dark:text-slate-200"
                />
              </div>

              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-3 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: SHIFTS & GARDE PLANNING (PERMANENT CONFIGURATION) */}
          {activeStep === 'shifts' && (
            <div className="space-y-6">
              {/* Permanent Planning Notice & Save Button */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-sky-50 via-blue-50/60 to-indigo-50/50 dark:from-slate-800/90 dark:via-slate-800/60 dark:to-slate-800/40 border border-sky-200/80 dark:border-slate-700/80 shadow-xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Title & Subtitle */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-black uppercase text-sky-950 dark:text-sky-200 tracking-wider">
                        Planning Permanent des Horaires &amp; Gardes
                      </h4>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Synchronisé avec Planning des Gardes</span>
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                      Réglez les heures prévues (08:00 / 08:15) et activez la garde (16:00 / Ven 12:20) pour les enseignants. Toute modification dans le <strong>Planning des Gardes</strong> ou ici est synchronisée en temps réel.
                    </p>
                  </div>

                  {/* Right Column: Timetable Sync, Tolerance Select & Save Button */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
                    {/* 🔄 Reload from Planning des Gardes */}
                    <button
                      type="button"
                      onClick={() => {
                        loadShiftsFromMasterAndDb();
                        setIsSavedFeedback(true);
                        setTimeout(() => setIsSavedFeedback(false), 2500);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-sky-500 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                      title="Recharge immédiatement la dernière version du Planning des Gardes depuis Supabase"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-sky-500" />
                      <span>Recharger Planning</span>
                    </button>

                    {/* ⚡ Sync with Timetable Button */}
                    <button
                      type="button"
                      onClick={handleSyncWithTimetable}
                      disabled={isSyncingTimetable}
                      className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/25 transition-all cursor-pointer whitespace-nowrap"
                      title="Analyse l'emploi du temps pour attribuer la Garde Matin (08:00) aux enseignants libres le matin, et la Garde Soir à ceux libres l'après-midi"
                    >
                      <Zap className={`w-4 h-4 ${isSyncingTimetable ? 'animate-spin' : ''}`} />
                      <span>{isSyncingTimetable ? 'Analyse en cours...' : '⚡ Sync Emploi du Temps'}</span>
                    </button>

                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                      <span className="text-xs text-slate-600 dark:text-slate-300 font-bold whitespace-nowrap">
                        Tolérance :
                      </span>
                      <select
                        value={graceMinutes}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setGraceMinutes(val);
                          handleSavePermanentPlanning();
                        }}
                        className="text-xs py-1 pl-2 pr-6 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-bold text-slate-800 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value={0}>0 min (Strict)</option>
                        <option value={5}>5 min (Recommandé)</option>
                        <option value={10}>10 min</option>
                        <option value={15}>15 min</option>
                      </select>
                    </div>

                    <button
                      onClick={handleSavePermanentPlanning}
                      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md cursor-pointer shrink-0 whitespace-nowrap ${
                        isSavedFeedback
                          ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-400'
                          : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-sky-600/25'
                      }`}
                    >
                      {isSavedFeedback ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-white" />
                          <span>Enregistré ✅</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 text-white" />
                          <span>Enregistrer</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Sync Feedback Message */}
                {syncFeedbackMessage && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 animate-in fade-in">
                    <div className="flex items-center gap-2 font-bold">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{syncFeedbackMessage}</span>
                    </div>
                    <button
                      onClick={() => setSyncFeedbackMessage(null)}
                      className="p-1 hover:bg-amber-500/20 rounded-lg text-slate-500 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Bottom Quick Preset Bar & View Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-sky-100 dark:border-slate-700/80">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      Appliquer à tous l'entrée :
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => applyEntryToAll('08:15')}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 hover:border-sky-500 shadow-xs cursor-pointer whitespace-nowrap transition-all"
                      >
                        08:15 (Par Défaut - Enseignants)
                      </button>
                      <button
                        onClick={() => applyEntryToAll('08:00')}
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 hover:border-sky-500 shadow-xs cursor-pointer whitespace-nowrap transition-all"
                      >
                        08:00 (Garde Matin)
                      </button>
                    </div>
                  </div>

                  {/* View Mode Toggle: List vs Weekly Matrix */}
                  <div className="flex items-center bg-white dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setPlanningViewMode('list')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        planningViewMode === 'list'
                          ? 'bg-sky-500 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Vue Rapide</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanningViewMode('matrix')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        planningViewMode === 'matrix'
                          ? 'bg-sky-500 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <TableProperties className="w-3.5 h-3.5" />
                      <span>Matrice Semaine (Emploi du Temps)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Staff shifts individual customization table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Liste du Personnel &amp; Gardes ({staffList.length} membres)
                  </span>
                  <input
                    type="text"
                    placeholder="Chercher un enseignant..."
                    value={shiftSearch}
                    onChange={(e) => setShiftSearch(e.target.value)}
                    className="text-xs py-1 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                {planningViewMode === 'matrix' ? (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-xs">
                    <table className="w-full text-left text-xs min-w-[850px]">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-4 py-3 w-52">Enseignant</th>
                          {[
                            { name: 'Lundi', dayNum: 1 },
                            { name: 'Mardi', dayNum: 2 },
                            { name: 'Mercredi', dayNum: 3 },
                            { name: 'Jeudi', dayNum: 4 },
                            { name: 'Vendredi', dayNum: 5 },
                            { name: 'Samedi', dayNum: 6 },
                          ].map(({ name, dayNum }) => (
                            <th key={name} className="px-3 py-3 text-center">
                              <div className="text-slate-800 dark:text-slate-200 font-bold">{name}</div>
                              <div className="text-[10px] font-normal text-slate-400">Jour {dayNum}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {staffList
                          .filter((s) => `${s.first_name} ${s.last_name} ${s.staff_code}`.toLowerCase().includes(shiftSearch.toLowerCase()))
                          .map((s) => {
                            const shift = staffShifts[s.id] || {
                              staffId: s.id,
                              expectedEntry: '08:15',
                              expectedExit: defaultExit,
                              hasGarde: false,
                              hasGardeEntry: false,
                            };

                            const teacherSlots = timetableSlots.filter(
                              (slot) =>
                                slot.teacher_id === s.id ||
                                slot.teacher_id === s.staff_code ||
                                (s.staff_code && slot.teacher_code === s.staff_code)
                            );

                            return (
                              <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-100 align-top">
                                  <div>{s.first_name} {s.last_name}</div>
                                  <div className="text-[10px] text-slate-400 font-normal">{s.staff_code} &bull; {s.role_title}</div>
                                </td>

                                {[1, 2, 3, 4, 5, 6].map((dayNum) => {
                                  const daySlots = teacherSlots.filter((ts) => ts.day_of_week === dayNum);
                                  const isMorningGarde = shift.gardeEntryDays?.includes(dayNum);
                                  const isEveningGarde = shift.gardeDays?.includes(dayNum);

                                  return (
                                    <td key={dayNum} className="px-2 py-3 align-top border-l border-slate-100 dark:border-slate-800/60">
                                      <div className="space-y-1.5 flex flex-col items-center">
                                        {/* Timetable classes hint */}
                                        <div className="w-full text-center">
                                          {daySlots.length > 0 ? (
                                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                                              {daySlots.length} séance{daySlots.length > 1 ? 's' : ''} ({daySlots.map((x) => x.period_id || 'C').join(', ')})
                                            </span>
                                          ) : (
                                            <span className="text-[9px] text-slate-400 italic">Libre</span>
                                          )}
                                        </div>

                                        {/* Morning Garde Toggle (08:00) */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const cur = shift.gardeEntryDays || [];
                                            const next = isMorningGarde ? cur.filter((d) => d !== dayNum) : [...cur, dayNum];
                                            const selectedDayOfWeek = new Date(selectedDate).getDay();
                                            const matchesToday = next.includes(selectedDayOfWeek);
                                            updateStaffShift(s.id, {
                                              gardeEntryDays: next,
                                              hasGardeEntry: matchesToday,
                                              expectedEntry: matchesToday ? '08:00' : '08:15',
                                            });
                                          }}
                                          className={`w-full py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                                            isMorningGarde
                                              ? 'bg-sky-600 text-white border-sky-500 shadow-xs'
                                              : 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-sky-300'
                                          }`}
                                          title={`Garde Matin (08:00) le ${['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][dayNum]}`}
                                        >
                                          <span>🌅</span>
                                          <span>{isMorningGarde ? '08:00' : 'Matin'}</span>
                                        </button>

                                        {/* Evening Garde Toggle (16:30) */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const cur = shift.gardeDays || [];
                                            const next = isEveningGarde ? cur.filter((d) => d !== dayNum) : [...cur, dayNum];
                                            const selectedDayOfWeek = new Date(selectedDate).getDay();
                                            const matchesToday = next.includes(selectedDayOfWeek);
                                            updateStaffShift(s.id, {
                                              gardeDays: next,
                                              hasGarde: matchesToday,
                                              expectedExit: matchesToday ? defaultGardeExit : defaultExit,
                                            });
                                          }}
                                          className={`w-full py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                                            isEveningGarde
                                              ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                                              : 'bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                                          }`}
                                          title={`Garde Soir (16:15) le ${['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][dayNum]}`}
                                        >
                                          <span>🌇</span>
                                          <span>{isEveningGarde ? '16:15' : 'Soir'}</span>
                                        </button>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-4 py-2.5">Personnel</th>
                          <th className="px-4 py-2.5 text-sky-700 dark:text-sky-300">🌅 Garde Matin &amp; Heure d&apos;Entrée</th>
                          <th className="px-4 py-2.5 text-purple-700 dark:text-purple-300">🌇 Garde Soir &amp; Heure de Sortie</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {staffList
                          .filter((s) => `${s.first_name} ${s.last_name} ${s.staff_code}`.toLowerCase().includes(shiftSearch.toLowerCase()))
                          .map((s) => {
                            const shift = staffShifts[s.id] || {
                              staffId: s.id,
                              expectedEntry: defaultEntry,
                              expectedExit: defaultExit,
                              hasGarde: false,
                              hasGardeEntry: false,
                            };

                            return (
                              <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 align-top">
                                  <div>{s.first_name} {s.last_name}</div>
                                  <div className="text-[10px] text-slate-400 font-normal">{s.staff_code} &bull; {s.role_title}</div>
                                </td>

                                {/* 1. Garde Entrée & Arrivée Customization */}
                                <td className="px-4 py-3 align-top">
                                  <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const willHaveGardeEntry = !shift.hasGardeEntry;
                                          updateStaffShift(s.id, {
                                            hasGardeEntry: willHaveGardeEntry,
                                            expectedEntry: willHaveGardeEntry ? (shift.expectedEntry || defaultGardeEntry) : defaultEntry,
                                          });
                                        }}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                          shift.hasGardeEntry
                                            ? 'bg-sky-600 text-white border-sky-500 shadow-sm shadow-sky-500/20'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-sky-300'
                                        }`}
                                      >
                                        <span>{shift.hasGardeEntry ? `⭐ Garde Matin (${shift.expectedEntry || '08:00'})` : `Entrée Std (${shift.expectedEntry || '08:00'})`}</span>
                                      </button>

                                      {/* Entry Presets & Picker */}
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => updateStaffShift(s.id, { expectedEntry: '08:00' })}
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                            shift.expectedEntry === '08:00'
                                              ? 'bg-sky-700 text-white border-sky-600'
                                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400'
                                          }`}
                                        >
                                          08:00
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateStaffShift(s.id, { expectedEntry: '08:15' })}
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                            shift.expectedEntry === '08:15'
                                              ? 'bg-sky-700 text-white border-sky-600'
                                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-sky-400'
                                          }`}
                                        >
                                          08:15
                                        </button>
                                        <input
                                          type="time"
                                          value={shift.expectedEntry}
                                          onChange={(e) => updateStaffShift(s.id, { expectedEntry: e.target.value })}
                                          className="px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/50 text-[11px] font-mono font-bold text-sky-900 dark:text-sky-200 border border-sky-200 dark:border-sky-800 focus:outline-none"
                                          title="Heure exacte d'arrivée prévue"
                                        />
                                      </div>
                                    </div>

                                    {/* Day of Week Selector for Morning Garde */}
                                    <div className="flex items-center gap-1 text-[10px]">
                                      <span className="text-slate-400 font-semibold">Jours Garde :</span>
                                      {[
                                        { day: 1, label: 'L' },
                                        { day: 2, label: 'M' },
                                        { day: 3, label: 'M' },
                                        { day: 4, label: 'J' },
                                        { day: 5, label: 'V' },
                                        { day: 6, label: 'S' },
                                      ].map(({ day, label }) => {
                                        const isDaySelected = shift.gardeEntryDays?.includes(day);
                                        return (
                                          <button
                                            key={day}
                                            type="button"
                                            onClick={() => {
                                              const currentDays = shift.gardeEntryDays || [];
                                              const newDays = isDaySelected
                                                ? currentDays.filter((d) => d !== day)
                                                : [...currentDays, day];
                                              
                                              const selectedDayOfWeek = new Date(selectedDate).getDay();
                                              const matchesToday = newDays.includes(selectedDayOfWeek);

                                              updateStaffShift(s.id, {
                                                gardeEntryDays: newDays,
                                                hasGardeEntry: matchesToday || newDays.length > 0,
                                                expectedEntry: (matchesToday || newDays.length > 0) ? (shift.expectedEntry || defaultGardeEntry) : defaultEntry,
                                              });
                                            }}
                                            className={`w-4 h-4 rounded flex items-center justify-center font-bold text-[9px] cursor-pointer transition-all ${
                                              isDaySelected
                                                ? 'bg-sky-600 text-white shadow-xs'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                                            }`}
                                            title={`Garde Matin le ${['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][day]}`}
                                          >
                                            {label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>

                                {/* 2. Garde Sortie & Départ Customization */}
                                <td className="px-4 py-3 align-top">
                                  <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const willHaveGarde = !shift.hasGarde;
                                          updateStaffShift(s.id, {
                                            hasGarde: willHaveGarde,
                                            expectedExit: willHaveGarde ? (shift.expectedExit && shift.expectedExit > defaultExit ? shift.expectedExit : defaultGardeExit) : defaultExit,
                                          });
                                        }}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                          shift.hasGarde
                                            ? 'bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-500/20'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                                        }`}
                                      >
                                        <span>{shift.hasGarde ? `⭐ Garde Soir (${shift.expectedExit || '16:15'})` : `Sortie Std (${shift.expectedExit || '16:00'})`}</span>
                                      </button>

                                      {/* Exit Presets & Picker */}
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => updateStaffShift(s.id, { expectedExit: '16:00', hasGarde: false })}
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                            shift.expectedExit === '16:00'
                                              ? 'bg-slate-700 text-white border-slate-600'
                                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                          }`}
                                          title="Sortie Standard 16:00"
                                        >
                                          16:00
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateStaffShift(s.id, { expectedExit: '16:15', hasGarde: true })}
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                            shift.expectedExit === '16:15'
                                              ? 'bg-purple-700 text-white border-purple-600'
                                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-400'
                                          }`}
                                          title="Garde Soir Officielle 16:15"
                                        >
                                          16:15
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateStaffShift(s.id, { expectedExit: '16:30', hasGarde: true })}
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                                            shift.expectedExit === '16:30'
                                              ? 'bg-purple-700 text-white border-purple-600'
                                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-400'
                                          }`}
                                          title="Sortie prolongée 16:30"
                                        >
                                          16:30
                                        </button>
                                        <input
                                          type="time"
                                          value={shift.expectedExit}
                                          onChange={(e) => updateStaffShift(s.id, { expectedExit: e.target.value })}
                                          className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/50 text-[11px] font-mono font-bold text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800 focus:outline-none"
                                          title="Heure personnalisée de fin de garde ou sortie"
                                        />
                                      </div>
                                    </div>

                                    {/* Day of Week Selector for Evening Garde */}
                                    <div className="flex items-center gap-1 text-[10px]">
                                      <span className="text-slate-400 font-semibold">Jours Garde :</span>
                                      {[
                                        { day: 1, label: 'L' },
                                        { day: 2, label: 'M' },
                                        { day: 3, label: 'M' },
                                        { day: 4, label: 'J' },
                                        { day: 5, label: 'V' },
                                        { day: 6, label: 'S' },
                                      ].map(({ day, label }) => {
                                        const isDaySelected = shift.gardeDays?.includes(day);
                                        return (
                                          <button
                                            key={day}
                                            type="button"
                                            onClick={() => {
                                              const currentDays = shift.gardeDays || [];
                                              const newDays = isDaySelected
                                                ? currentDays.filter((d) => d !== day)
                                                : [...currentDays, day];
                                              
                                              const selectedDayOfWeek = new Date(selectedDate).getDay();
                                              const matchesToday = newDays.includes(selectedDayOfWeek);

                                              updateStaffShift(s.id, {
                                                gardeDays: newDays,
                                                hasGarde: matchesToday || newDays.length > 0,
                                                expectedExit: (matchesToday || newDays.length > 0) ? (shift.expectedExit || defaultGardeExit) : defaultExit,
                                              });
                                            }}
                                            className={`w-4 h-4 rounded flex items-center justify-center font-bold text-[9px] cursor-pointer transition-all ${
                                              isDaySelected
                                                ? 'bg-purple-600 text-white shadow-xs'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                                            }`}
                                            title={`Garde Soir le ${['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][day]}`}
                                          >
                                            {label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & RESULTS */}
          {activeStep === 'preview' && (
            <div className="space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
                  <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Présents à l'Heure</div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-800 dark:text-emerald-200 mt-0.5">{stats.present}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50">
                  <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Retards Détectés</div>
                  <div className="text-xl sm:text-2xl font-black text-amber-800 dark:text-amber-200 mt-0.5">
                    {stats.late} <span className="text-xs font-normal">({stats.totalLateMins} min)</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50">
                  <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300">Absences (Non Pointés)</div>
                  <div className="text-xl sm:text-2xl font-black text-rose-800 dark:text-rose-200 mt-0.5">{stats.absent}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50">
                  <div className="text-[11px] font-bold text-purple-700 dark:text-purple-300">Gardes Assignées</div>
                  <div className="text-xl sm:text-2xl font-black text-purple-800 dark:text-purple-200 mt-0.5">{stats.totalGardes}</div>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-4 py-2.5">Personnel</th>
                      <th className="px-4 py-2.5">Statut Calculé</th>
                      <th className="px-4 py-2.5">Pointages (Entrée / Sortie)</th>
                      <th className="px-4 py-2.5">Horaire Prévu &amp; Garde</th>
                      <th className="px-4 py-2.5">Retard Exact</th>
                      <th className="px-4 py-2.5">Notes &amp; Garde</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {computedAttendance.map((item) => (
                      <tr key={item.staff.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-100">
                          <div>{item.staff.first_name} {item.staff.last_name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{item.staff.staff_code} &bull; {item.staff.role_title}</div>
                        </td>

                        <td className="px-4 py-2.5">
                          {item.status === 'PRESENT' && (
                            <span className="px-2.5 py-1 rounded-lg font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 text-[11px] inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Présent
                            </span>
                          )}
                          {item.status === 'LATE' && (
                            <span className="px-2.5 py-1 rounded-lg font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 text-[11px] inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Retard ({item.lateMinutes} min)
                            </span>
                          )}
                          {item.status === 'ABSENT' && (
                            <span className="px-2.5 py-1 rounded-lg font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 text-[11px] inline-flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Absent
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-2.5 font-mono">
                          {item.checkInTime ? (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-800 dark:text-slate-200 font-bold">Arrivée : {item.checkInTime}</span>
                              {item.checkOutTime && (
                                <span className="text-slate-500">&bull; Départ : {item.checkOutTime}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Aucun pointage</span>
                          )}
                        </td>

                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                            <span>Prévu : {item.expectedEntry} - {item.expectedExit}</span>
                            {item.hasGarde && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-bold text-[10px]">
                                Garde ⭐
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-2.5">
                          {item.lateMinutes > 0 ? (
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              +{item.lateMinutes} min
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-bold">0 min (OK)</span>
                          )}
                        </td>

                        <td className="px-4 py-2.5 text-[11px] text-slate-500">
                          {item.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Fermer
          </button>

          <div className="flex items-center gap-2">
            {activeStep === 'upload' && parsedPunches.length > 0 && (
              <button
                onClick={() => setActiveStep('shifts')}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Suivant : Ajuster le Planning des Gardes &rarr;
              </button>
            )}

            {activeStep === 'shifts' && (
              <button
                onClick={() => setActiveStep('preview')}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Voir les Résultats du Calcul &rarr;
              </button>
            )}

            {activeStep === 'preview' && (
              <button
                onClick={handleConfirmAndApply}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Valider &amp; Enregistrer le Pointage ({computedAttendance.length} Personnes)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
