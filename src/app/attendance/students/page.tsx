'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import {
  Student,
  ClassEntity,
  AttendanceStatus,
  StudentAttendance
} from '@/types/database';
import { useNotify } from '@/lib/modal-service';
import { useSettings } from '@/lib/settings';
import { logAuditEvent } from '@/lib/audit';
import {
  ClipboardCheck,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Search,
  Printer,
  FileSpreadsheet,
  UserCheck,
  UserX,
  TrendingUp,
  Award,
  FileText,
  X,
  Edit2,
  Filter,
  GraduationCap,
  Layers,
  ChevronDown,
  Download,
  MessageSquare,
  Send,
  Smartphone
} from 'lucide-react';
import { WhatsAppAbsenceModal } from '@/components/attendance/WhatsAppAbsenceModal';
import {
  openWhatsAppChat,
  normalizeMoroccanPhone,
  buildAbsenceMessage
} from '@/lib/whatsapp';

// Format delay duration helper
export function formatDelayDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 min';
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours > 0 && remainingMins > 0) return `${hours}h ${remainingMins}min`;
  if (hours > 0) return `${hours}h`;
  return `${remainingMins} min`;
}

export default function StudentAttendancePage() {
  const { t, dir, locale } = useI18n();
  const { settings } = useSettings();
  const notify = useNotify();

  // WhatsApp Hub Modal state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [sessionSentIds, setSessionSentIds] = useState<Record<string, boolean>>({});

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'pointage' | 'daily_report' | 'monthly_report' | 'semester_report'>('pointage');

  // Filter & Search states
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedSemester, setSelectedSemester] = useState<'S1' | 'S2'>('S1');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedCycle, setSelectedCycle] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Print & Export Hub States
  const [printReportMode, setPrintReportMode] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PERIODIC'>('DAILY');
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCustomRangeModal, setShowCustomRangeModal] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Core Data
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit delay / justification modal state
  const [editingRecord, setEditingRecord] = useState<{
    studentId: string;
    studentName: string;
    className: string;
    status: AttendanceStatus;
    checkInTime: string;
    expectedTime: string;
    lateMinutes: number;
    isJustified: boolean;
    justificationReason: string;
    notes: string;
  } | null>(null);

  // Load classes, students and attendance
  useEffect(() => {
    async function initData() {
      setLoading(true);
      try {
        const supabase = createClient();
        const [{ data: cls }, { data: studs }, { data: att }] = await Promise.all([
          supabase.from('classes').select('*').order('name'),
          supabase.from('students').select('*, class:classes(*)').order('last_name'),
          supabase.from('student_attendance').select('*'),
        ]);

        if (cls) setClasses(cls);
        if (studs) setStudents(studs);
        if (att) {
          const parsed = (att as any[]).map((r) => ({
            id: r.id,
            student_id: r.student_id,
            class_id: r.class_id,
            date: r.date,
            status: r.status === 'EXCUSED' ? 'ABSENT' : r.status,
            late_minutes: r.reason && r.reason.includes('Retard:') ? parseInt(r.reason.replace(/\D/g, '')) || 0 : 0,
            is_justified: r.status === 'EXCUSED' || Boolean(r.reason && r.reason.toLowerCase().includes('justifi')),
            justification_reason: r.reason || '',
            notes: r.comment || '',
          }));
          setAttendanceRecords(parsed as StudentAttendance[]);
        }
      } catch (err) {
        console.error('Error loading student attendance:', err);
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, []);

  // Helper to check if a class belongs to a cycle
  const isClassInCycle = (lvlStr: string, cycle: string) => {
    if (cycle === 'ALL') return true;
    const lvl = (lvlStr || '').toUpperCase();
    if (cycle === 'MATERNELLE') {
      return ['TPS', 'PS', 'MS', 'GS', 'MATERNELLE'].some((k) => lvl.includes(k));
    } else if (cycle === 'PRIMAIRE') {
      return ['CP', 'CE1', 'CE2', 'CM1', 'CM2', 'CE6', 'PRIMAIRE'].some((k) => lvl.includes(k));
    } else if (cycle === 'COLLEGE') {
      return ['1AC', '2AC', '3AC', 'COLLÈGE', 'COLLEGE'].some((k) => lvl.includes(k));
    } else if (cycle === 'LYCEE') {
      return ['TRONC', 'BAC', 'LYCÉE', 'LYCEE', 'TCS', 'TCL', '1BAC', '2BAC'].some((k) => lvl.includes(k));
    }
    return true;
  };

  // Filtered classes list based on selected cycle
  const filteredClasses = useMemo(() => {
    return classes.filter((c) => isClassInCycle(c.level || c.name, selectedCycle));
  }, [classes, selectedCycle]);

  // Filtered student list
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // Class filter
      const matchClass = selectedClassId === 'ALL' || student.class_id === selectedClassId;

      // Cycle filter
      const matchCycle = isClassInCycle(student.class?.level || student.class?.name || '', selectedCycle);

      // Search filter
      const matchSearch =
        searchQuery === '' ||
        `${student.first_name} ${student.last_name} ${student.student_code} ${student.class?.name || ''} ${student.phone || ''}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      return matchClass && matchCycle && matchSearch;
    });
  }, [students, selectedClassId, selectedCycle, searchQuery]);

  // Map of today's records indexed by student_id
  const dailyRecordMap = useMemo(() => {
    const map: Record<string, StudentAttendance> = {};
    attendanceRecords
      .filter((r) => r.date === selectedDate)
      .forEach((r) => {
        map[r.student_id] = r;
      });
    return map;
  }, [attendanceRecords, selectedDate]);

  // Total count of absent and late students for selected date
  const todayAbsentsAndLatesCount = useMemo(() => {
    return attendanceRecords.filter(
      (r) => r.date === selectedDate && (r.status === 'ABSENT' || r.status === 'EXCUSED' || r.status === 'LATE')
    ).length;
  }, [attendanceRecords, selectedDate]);

  // Persist records
  const persistAttendanceRecords = async (newRecords: StudentAttendance[]) => {
    setAttendanceRecords(newRecords);

    try {
      const supabase = createClient();
      const currentDayRecords = newRecords
        .filter((r) => r.date === selectedDate)
        .map((r) => {
          const stud = students.find((s) => s.id === r.student_id);
          const cId = r.class_id || stud?.class_id || null;
          return {
            student_id: r.student_id,
            class_id: cId,
            date: r.date,
            status: r.is_justified && (r.status === 'ABSENT' || r.status === 'EXCUSED') ? 'EXCUSED' : r.status,
            reason: r.justification_reason || (r.is_justified ? 'Absence justifiée' : r.status === 'LATE' && r.late_minutes && r.late_minutes > 0 ? `Retard: ${r.late_minutes}m` : null),
            comment: r.notes || null,
          };
        });

      if (currentDayRecords.length > 0) {
        const { error } = await supabase
          .from('student_attendance')
          .upsert(currentDayRecords, { onConflict: 'student_id,date' });

        if (error) {
          console.error('Supabase attendance sync error:', error);
          notify({
            title: 'Erreur d\'enregistrement',
            message: `Impossible d'enregistrer dans la base de données: ${error.message}`,
            type: 'danger',
          });
        }
      }
    } catch (err: any) {
      console.error('DB sync exception:', err);
      notify({
        title: 'Erreur de connexion',
        message: err?.message || 'Erreur inconnue lors de la sauvegarde',
        type: 'danger',
      });
    }
  };

  // Quick 1-click update for student status
  const handleQuickStatusChange = (student: Student, newStatus: AttendanceStatus) => {
    const existing = dailyRecordMap[student.id];

    let lateMins = 0;
    let checkIn = '08:00';
    if (newStatus === 'LATE') {
      lateMins = existing?.late_minutes && existing.late_minutes > 0 ? existing.late_minutes : 15;
      checkIn = '08:15';
    }

    const updatedRecord: StudentAttendance = {
      id: existing?.id || `att-stud-${student.id}-${selectedDate}`,
      student_id: student.id,
      class_id: student.class_id || undefined,
      date: selectedDate,
      status: newStatus,
      check_in_time: newStatus === 'PRESENT' ? '08:00' : newStatus === 'LATE' ? checkIn : undefined,
      expected_time: '08:00',
      late_minutes: lateMins,
      is_justified: existing?.is_justified || false,
      justification_reason: existing?.justification_reason || '',
      notes: existing?.notes || '',
    };

    const nextRecords = [
      ...attendanceRecords.filter((r) => !(r.student_id === student.id && r.date === selectedDate)),
      updatedRecord,
    ];

    persistAttendanceRecords(nextRecords);

    logAuditEvent({
      action: 'STUDENT_POINTAGE_UPDATED',
      entity_type: 'student_attendance',
      entity_id: student.id,
      details: {
        student: `${student.first_name} ${student.last_name}`,
        class: student.class?.name,
        date: selectedDate,
        new_status: newStatus,
      },
    });
  };

  // Toggle justification for absent student (Justifié 🟢 / Non Justifié 🔴)
  const handleToggleJustification = (student: Student) => {
    const existing = dailyRecordMap[student.id];
    const currentJustified = existing?.is_justified ?? false;
    const newJustified = !currentJustified;

    const updatedRecord: StudentAttendance = {
      id: existing?.id || `att-stud-${student.id}-${selectedDate}`,
      student_id: student.id,
      class_id: student.class_id || undefined,
      date: selectedDate,
      status: 'ABSENT',
      check_in_time: undefined,
      expected_time: '08:00',
      late_minutes: 0,
      is_justified: newJustified,
      justification_reason: newJustified ? (existing?.justification_reason || 'Justifiée') : '',
      notes: existing?.notes || '',
    };

    const nextRecords = [
      ...attendanceRecords.filter((r) => !(r.student_id === student.id && r.date === selectedDate)),
      updatedRecord,
    ];

    persistAttendanceRecords(nextRecords);

    logAuditEvent({
      action: 'STUDENT_ABSENCE_JUSTIFICATION_TOGGLED',
      entity_type: 'student_attendance',
      entity_id: student.id,
      details: {
        student: `${student.first_name} ${student.last_name}`,
        class: student.class?.name,
        date: selectedDate,
        is_justified: newJustified,
      },
    });
  };

  // Mark all filtered students as PRESENT
  const handleMarkAllPresent = () => {
    const nextRecords = [...attendanceRecords];

    filteredStudents.forEach((student) => {
      const idx = nextRecords.findIndex((r) => r.student_id === student.id && r.date === selectedDate);
      const record: StudentAttendance = {
        id: idx >= 0 ? nextRecords[idx].id : `att-stud-${student.id}-${selectedDate}`,
        student_id: student.id,
        class_id: student.class_id || undefined,
        date: selectedDate,
        status: 'PRESENT',
        check_in_time: '08:00',
        expected_time: '08:00',
        late_minutes: 0,
        is_justified: false,
        justification_reason: '',
      };

      if (idx >= 0) {
        nextRecords[idx] = record;
      } else {
        nextRecords.push(record);
      }
    });

    persistAttendanceRecords(nextRecords);

    logAuditEvent({
      action: 'BULK_STUDENT_POINTAGE_PRESENT',
      entity_type: 'student_attendance',
      details: {
        count: filteredStudents.length,
        date: selectedDate,
        cycle: selectedCycle,
        class_id: selectedClassId,
      },
    });

    persistAttendanceRecords(nextRecords);
    notify({
      title: 'Pointage Élèves Effectué',
      message: `${filteredStudents.length} élève(s) marqués présents à l'heure pour le ${selectedDate}.`,
      type: 'success',
    });
  };

  // Open detailed delay / justification modal
  const openEditModal = (student: Student) => {
    const existing = dailyRecordMap[student.id];
    setEditingRecord({
      studentId: student.id,
      studentName: `${student.first_name} ${student.last_name}`,
      className: student.class?.name || 'Classe non assignée',
      status: existing?.status || 'PRESENT',
      checkInTime: existing?.check_in_time || (existing?.status === 'LATE' ? '08:20' : '08:00'),
      expectedTime: existing?.expected_time || '08:00',
      lateMinutes: existing?.late_minutes || (existing?.status === 'LATE' ? 20 : 0),
      isJustified: existing?.is_justified || false,
      justificationReason: existing?.justification_reason || '',
      notes: existing?.notes || '',
    });
  };

  // Save detailed record modal
  const handleSaveModalRecord = () => {
    if (!editingRecord) return;

    const student = students.find((s) => s.id === editingRecord.studentId);
    const updatedRecord: StudentAttendance = {
      id: dailyRecordMap[editingRecord.studentId]?.id || `att-stud-${editingRecord.studentId}-${selectedDate}`,
      student_id: editingRecord.studentId,
      class_id: student?.class_id || undefined,
      date: selectedDate,
      status: editingRecord.status,
      check_in_time: editingRecord.checkInTime,
      expected_time: editingRecord.expectedTime,
      late_minutes: editingRecord.status === 'LATE' ? Number(editingRecord.lateMinutes) || 0 : 0,
      is_justified: editingRecord.isJustified,
      justification_reason: editingRecord.justificationReason.trim(),
      notes: editingRecord.notes.trim(),
    };

    const nextRecords = [
      ...attendanceRecords.filter((r) => !(r.student_id === editingRecord.studentId && r.date === selectedDate)),
      updatedRecord,
    ];

    persistAttendanceRecords(nextRecords);
    setEditingRecord(null);

    logAuditEvent({
      action: 'STUDENT_ATTENDANCE_DETAILS_UPDATED',
      entity_type: 'student_attendance',
      entity_id: editingRecord.studentId,
      details: {
        student: editingRecord.studentName,
        class: editingRecord.className,
        date: selectedDate,
        status: editingRecord.status,
        late_minutes: editingRecord.lateMinutes,
        is_justified: editingRecord.isJustified,
        justification_reason: editingRecord.justificationReason,
        notes: editingRecord.notes,
      },
    });

    notify({
      title: 'Enregistrement Mis à Jour',
      message: `Détails de présence enregistrés pour l'élève ${editingRecord.studentName}.`,
      type: 'success',
    });
  };

  // --- STATS COMPUTATIONS ---

  // 1. Daily Statistics
  const dailyStats = useMemo(() => {
    let presentCount = 0;
    let lateCount = 0;
    let totalLateMins = 0;
    let lateJustifiedCount = 0;
    let absentCount = 0;
    let absentJustifiedCount = 0;
    let excusedCount = 0;

    filteredStudents.forEach((student) => {
      const rec = dailyRecordMap[student.id];
      const status = rec?.status || 'PRESENT';

      if (status === 'PRESENT') {
        presentCount++;
      } else if (status === 'LATE') {
        lateCount++;
        totalLateMins += rec?.late_minutes || 0;
        if (rec?.is_justified) lateJustifiedCount++;
      } else if (status === 'ABSENT') {
        absentCount++;
        if (rec?.is_justified) absentJustifiedCount++;
      } else if (status === 'EXCUSED') {
        excusedCount++;
        absentJustifiedCount++;
      }
    });

    const totalStudents = filteredStudents.length;
    const rate = totalStudents > 0 ? Math.round(((presentCount + lateCount) / totalStudents) * 100) : 100;

    return {
      totalStudents,
      presentCount,
      lateCount,
      totalLateMins,
      totalLateFormatted: formatDelayDuration(totalLateMins),
      lateJustifiedCount,
      lateUnjustifiedCount: lateCount - lateJustifiedCount,
      absentCount,
      absentJustifiedCount,
      absentUnjustifiedCount: absentCount - (absentJustifiedCount - excusedCount),
      rate,
    };
  }, [filteredStudents, dailyRecordMap]);

  // 2. Monthly Summary per Student
  const monthlyStudentSummary = useMemo(() => {
    const monthRecords = attendanceRecords.filter((r) => r.date.startsWith(selectedMonth));

    return filteredStudents.map((student) => {
      const studentMonthRecs = monthRecords.filter((r) => r.student_id === student.id);

      let presentDays = 0;
      let lateCount = 0;
      let totalLateMins = 0;
      let lateJustified = 0;
      let absentDays = 0;
      let absentJustified = 0;

      studentMonthRecs.forEach((r) => {
        if (r.status === 'PRESENT') presentDays++;
        if (r.status === 'LATE') {
          lateCount++;
          totalLateMins += r.late_minutes || 0;
          if (r.is_justified) lateJustified++;
        }
        if (r.status === 'ABSENT') {
          absentDays++;
          if (r.is_justified) absentJustified++;
        }
        if (r.status === 'EXCUSED') {
          absentDays++;
          absentJustified++;
        }
      });

      const totalRecordedDays = presentDays + lateCount + absentDays;
      const assiduityRate = totalRecordedDays > 0 ? Math.round(((presentDays + lateCount) / totalRecordedDays) * 100) : 100;

      return {
        student,
        totalRecordedDays,
        presentDays,
        lateCount,
        totalLateMins,
        totalLateFormatted: formatDelayDuration(totalLateMins),
        lateJustified,
        lateUnjustified: lateCount - lateJustified,
        absentDays,
        absentJustified,
        absentUnjustified: absentDays - absentJustified,
        assiduityRate,
      };
    });
  }, [filteredStudents, attendanceRecords, selectedMonth]);

  // 3. Semester Summary per Student
  const semesterStudentSummary = useMemo(() => {
    const semesterMonths =
      selectedSemester === 'S1'
        ? ['-09-', '-10-', '-11-', '-12-', '-01-']
        : ['-02-', '-03-', '-04-', '-05-', '-06-'];

    const semesterRecords = attendanceRecords.filter((r) =>
      semesterMonths.some((m) => r.date.includes(m))
    );

    return filteredStudents.map((student) => {
      const studentRecs = semesterRecords.filter((r) => r.student_id === student.id);

      let presentDays = 0;
      let lateCount = 0;
      let totalLateMins = 0;
      let lateJustified = 0;
      let absentDays = 0;
      let absentJustified = 0;

      studentRecs.forEach((r) => {
        if (r.status === 'PRESENT') presentDays++;
        if (r.status === 'LATE') {
          lateCount++;
          totalLateMins += r.late_minutes || 0;
          if (r.is_justified) lateJustified++;
        }
        if (r.status === 'ABSENT') {
          absentDays++;
          if (r.is_justified) absentJustified++;
        }
        if (r.status === 'EXCUSED') {
          absentDays++;
          absentJustified++;
        }
      });

      const totalRecordedDays = presentDays + lateCount + absentDays;
      const assiduityRate = totalRecordedDays > 0 ? Math.round(((presentDays + lateCount) / totalRecordedDays) * 100) : 100;

      return {
        student,
        totalRecordedDays,
        presentDays,
        lateCount,
        totalLateMins,
        totalLateFormatted: formatDelayDuration(totalLateMins),
        lateJustified,
        lateUnjustified: lateCount - lateJustified,
        absentDays,
        absentJustified,
        absentUnjustified: absentDays - absentJustified,
        assiduityRate,
      };
    });
  }, [filteredStudents, attendanceRecords, selectedSemester]);

  // 4. Weekly Summary & Dates (Monday to Saturday) based on selectedDate
  const currentWeekDates = useMemo(() => {
    const curr = new Date(selectedDate);
    const day = curr.getDay(); // 0 is Sun, 1 is Mon
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diff));
    const dates: string[] = [];
    for (let i = 0; i < 6; i++) {
      const next = new Date(monday);
      next.setDate(monday.getDate() + i);
      dates.push(next.toISOString().split('T')[0]);
    }
    return dates;
  }, [selectedDate]);

  // 5. Periodic Summary per Student (customStartDate to customEndDate)
  const periodicStudentSummary = useMemo(() => {
    const periodRecords = attendanceRecords.filter(
      (r) => r.date >= customStartDate && r.date <= customEndDate
    );

    return filteredStudents.map((student) => {
      const studentRecs = periodRecords.filter((r) => r.student_id === student.id);

      let presentDays = 0;
      let lateCount = 0;
      let totalLateMins = 0;
      let lateJustified = 0;
      let absentDays = 0;
      let absentJustified = 0;

      studentRecs.forEach((r) => {
        if (r.status === 'PRESENT') presentDays++;
        if (r.status === 'LATE') {
          lateCount++;
          totalLateMins += r.late_minutes || 0;
          if (r.is_justified) lateJustified++;
        }
        if (r.status === 'ABSENT' || r.status === 'EXCUSED') {
          absentDays++;
          if (r.is_justified || r.status === 'EXCUSED') absentJustified++;
        }
      });

      const totalRecordedDays = presentDays + lateCount + absentDays;
      const assiduityRate = totalRecordedDays > 0 ? Math.round(((presentDays + lateCount) / totalRecordedDays) * 100) : 100;

      return {
        student,
        totalRecordedDays,
        presentDays,
        lateCount,
        totalLateMins,
        totalLateFormatted: formatDelayDuration(totalLateMins),
        lateJustified,
        lateUnjustified: lateCount - lateJustified,
        absentDays,
        absentJustified,
        absentUnjustified: absentDays - absentJustified,
        assiduityRate,
      };
    });
  }, [filteredStudents, attendanceRecords, customStartDate, customEndDate]);

  // Export Daily CSV
  const handleExportDailyCSV = () => {
    const headers = ['Matricule', 'Nom', 'Prenom', 'Classe', 'Statut', 'Heure Arrivee', 'Retard (Minutes)', 'Duree Retard', 'Justifie', 'Motif Justification', 'Contact Parent'];
    const rows = filteredStudents.map((student) => {
      const rec = dailyRecordMap[student.id];
      const status = rec?.status || 'PRESENT';
      return [
        `"${student.student_code}"`,
        `"${student.last_name}"`,
        `"${student.first_name}"`,
        `"${student.class?.name || 'Non assigné'}"`,
        `"${status}"`,
        `"${rec?.check_in_time || '08:00'}"`,
        `"${rec?.late_minutes || 0}"`,
        `"${formatDelayDuration(rec?.late_minutes || 0)}"`,
        `"${rec?.is_justified ? 'OUI' : 'NON'}"`,
        `"${rec?.justification_reason || ''}"`,
        `"${student.phone || ''}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pointage_Eleves_Quotidien_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notify({
      title: 'Export Quotidien Réussi',
      message: `Pointage élèves du ${selectedDate} téléchargé en CSV.`,
      type: 'success',
    });
    setShowExportMenu(false);
  };

  // Export Weekly CSV
  const handleExportWeeklyCSV = () => {
    const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const headers = [
      'Matricule',
      'Nom Complet',
      'Classe',
      ...currentWeekDates.map((d, i) => `${dayNames[i]} (${d})`),
      'Total Retards (min)',
      'Total Absences (j)',
      'Taux Assiduite'
    ];

    const rows = filteredStudents.map((student) => {
      const weekRecs = attendanceRecords.filter((r) => r.student_id === student.id && currentWeekDates.includes(r.date));
      let totalLateMins = 0;
      let totalAbsents = 0;
      let presentDays = 0;

      const dayCells = currentWeekDates.map((dateStr) => {
        const rec = weekRecs.find((r) => r.date === dateStr);
        if (!rec) return '"-"';
        if (rec.status === 'PRESENT') {
          presentDays++;
          return '"PRESENT"';
        }
        if (rec.status === 'LATE') {
          presentDays++;
          totalLateMins += rec.late_minutes || 0;
          return `"RETARD (${rec.late_minutes} min)"`;
        }
        if (rec.status === 'ABSENT') {
          totalAbsents++;
          return '"ABSENT"';
        }
        if (rec.status === 'EXCUSED') {
          totalAbsents++;
          return '"EXCUSE"';
        }
        return '"-"';
      });

      const totalRecorded = presentDays + totalAbsents;
      const rate = totalRecorded > 0 ? Math.round((presentDays / totalRecorded) * 100) : 100;

      return [
        `"${student.student_code}"`,
        `"${student.first_name} ${student.last_name}"`,
        `"${student.class?.name || 'Non assigné'}"`,
        ...dayCells,
        `"${totalLateMins}"`,
        `"${totalAbsents}"`,
        `"${rate}%"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pointage_Eleves_Hebdomadaire_${currentWeekDates[0]}_au_${currentWeekDates[5]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notify({
      title: 'Export Hebdomadaire Réussi',
      message: `Bilan semaine élèves (${currentWeekDates[0]} au ${currentWeekDates[5]}) téléchargé.`,
      type: 'success',
    });
    setShowExportMenu(false);
  };

  // Export Monthly CSV
  const handleExportMonthlyCSV = () => {
    const headers = ['Matricule', 'Nom Complet', 'Classe', 'Jours Presents', 'Total Retards (Nombre)', 'Duree Totale Retards', 'Retards Justifies', 'Retards Injustifies', 'Absences Totales (Jours)', 'Absences Justifiees', 'Absences Injustifiees', 'Taux Assiduite'];
    const rows = monthlyStudentSummary.map((item) => [
      `"${item.student.student_code}"`,
      `"${item.student.first_name} ${item.student.last_name}"`,
      `"${item.student.class?.name || 'Non assigné'}"`,
      `"${item.presentDays}"`,
      `"${item.lateCount}"`,
      `"${item.totalLateFormatted}"`,
      `"${item.lateJustified}"`,
      `"${item.lateUnjustified}"`,
      `"${item.absentDays}"`,
      `"${item.absentJustified}"`,
      `"${item.absentUnjustified}"`,
      `"${item.assiduityRate}%"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rapport_Assiduite_Eleves_Mensuel_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notify({
      title: 'Export Mensuel Réussi',
      message: `Rapport mensuel élèves ${selectedMonth} téléchargé.`,
      type: 'success',
    });
    setShowExportMenu(false);
  };

  // Export Periodic CSV
  const handleExportPeriodicCSV = () => {
    const headers = ['Matricule', 'Nom Complet', 'Classe', 'Jours Presents', 'Total Retards (Nombre)', 'Duree Totale Retards', 'Retards Justifies', 'Retards Injustifies', 'Absences Totales (Jours)', 'Absences Justifiees', 'Absences Injustifiees', 'Taux Assiduite'];
    const rows = periodicStudentSummary.map((item) => [
      `"${item.student.student_code}"`,
      `"${item.student.first_name} ${item.student.last_name}"`,
      `"${item.student.class?.name || 'Non assigné'}"`,
      `"${item.presentDays}"`,
      `"${item.lateCount}"`,
      `"${item.totalLateFormatted}"`,
      `"${item.lateJustified}"`,
      `"${item.lateUnjustified}"`,
      `"${item.absentDays}"`,
      `"${item.absentJustified}"`,
      `"${item.absentUnjustified}"`,
      `"${item.assiduityRate}%"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rapport_Assiduite_Eleves_Periodique_${customStartDate}_au_${customEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notify({
      title: 'Export Périodique Réussi',
      message: `Rapport élèves (${customStartDate} au ${customEndDate}) téléchargé.`,
      type: 'success',
    });
    setShowCustomRangeModal(false);
    setShowExportMenu(false);
  };

  // Trigger Print for a specific mode with dynamic PDF file naming
  const handleTriggerPrint = (mode: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PERIODIC') => {
    setPrintReportMode(mode);
    setShowPrintMenu(false);
    setShowCustomRangeModal(false);

    const prevTitle = typeof document !== 'undefined' ? document.title : '';
    const classObj = classes.find((c) => c.id === selectedClassId);
    const classPrefix = classObj ? `${classObj.name}_` : selectedClassId !== 'ALL' ? `${selectedClassId}_` : '';
    let pdfFileName = 'GM_Pointage_Eleves';

    if (mode === 'DAILY') {
      pdfFileName = `GM_Pointage_Eleves_Journalier_${classPrefix}${selectedDate}`;
    } else if (mode === 'WEEKLY') {
      pdfFileName = `GM_Pointage_Eleves_Hebdomadaire_${classPrefix}${currentWeekDates[0]}_au_${currentWeekDates[5]}`;
    } else if (mode === 'MONTHLY') {
      pdfFileName = `GM_Pointage_Eleves_Mensuel_${classPrefix}${selectedMonth}`;
    } else if (mode === 'PERIODIC') {
      pdfFileName = `GM_Pointage_Eleves_Periodique_${classPrefix}${customStartDate}_au_${customEndDate}`;
    }

    if (typeof document !== 'undefined') {
      document.title = pdfFileName;
    }

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        if (typeof document !== 'undefined') {
          document.title = prevTitle;
        }
      }, 1500);
    }, 250);
  };

  return (
    <DashboardLayout>
      {/* Official Print Stylesheet */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape !important;
            margin: 10mm !important;
          }
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
          }
          header, aside, nav, .print\\:hidden {
            display: none !important;
          }
          .print-student-attendance-sheet {
            display: block !important;
            width: 100% !important;
          }
        }
      `}</style>

      <div className="space-y-6">
        {/* Printable Official Header */}
        <div className="hidden print:flex print:items-center print:justify-between print:pb-4 print:mb-4 print:border-b-2 print:border-slate-900">
          <div className="flex items-center gap-3.5">
            <img
              src="/logo.png"
              alt="Logo GM"
              className="w-14 h-14 object-contain shrink-0"
            />
            <div>
              <h1 className="text-base font-black uppercase text-slate-900 leading-tight">
                GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES
              </h1>
              <p className="text-[10px] text-slate-700 font-bold">
                Registre Officiel de Présence, Pointage &amp; Assiduité des Élèves
              </p>
              <p className="text-[9px] text-slate-500 font-semibold">
                Année Scolaire 2025-2026 &bull; Direction Pédagogique
              </p>
            </div>
          </div>
          <div className="text-right border-2 border-slate-900 px-3 py-1.5 rounded-lg bg-slate-50">
            <div className="font-black text-xs">POINTAGE ÉLÈVES</div>
            <div className="text-[9pt] font-bold">Date : {new Date().toLocaleDateString('fr-FR')}</div>
          </div>
        </div>

        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <ClipboardCheck className="w-4 h-4 shrink-0" />
              <span>{t('student_attendance')}</span>
            </div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t('student_attendance_page_title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {dir === 'rtl' ? 'تتبع حضور التلاميذ حسب الأقسام، وحساب دقيق للتأخرات ومبررات الغياب.' : "Suivi des présences par classe, calcul précis des retards (H/Min), justificatifs et bilans périodiques."}
            </p>
          </div>

          {/* Quick Actions & Exports Dropdowns */}
          <div className="flex items-center gap-2 shrink-0">
            {/* WhatsApp Absence Hub Button */}
            <button
              type="button"
              onClick={() => setShowWhatsAppModal(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs shadow-md shadow-emerald-500/25 transition-all cursor-pointer whitespace-nowrap transform active:scale-95"
              title={dir === 'rtl' ? 'مركز إرسال رسائل واتساب لأولياء الأمور' : 'Centre d\'envoi WhatsApp aux parents'}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span>{dir === 'rtl' ? 'إشعارات واتساب' : 'WhatsApp Parents'}</span>
              {todayAbsentsAndLatesCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-white text-emerald-700 text-[10px] font-black leading-none ml-0.5 shadow-2xs">
                  {todayAbsentsAndLatesCount}
                </span>
              )}
            </button>

            {/* Print / PDF Dropdown Hub */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowPrintMenu(!showPrintMenu);
                  setShowExportMenu(false);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-4 h-4 text-blue-500 shrink-0" />
                <span>{dir === 'rtl' ? 'طباعة / PDF' : 'Imprimer / PDF'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showPrintMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95 space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    {dir === 'rtl' ? 'خيارات الطباعة الرسمية' : 'Type de Rapport à Imprimer'}
                  </div>

                  <button
                    onClick={() => handleTriggerPrint('DAILY')}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-all text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <div>
                        <div>{dir === 'rtl' ? '1. التقرير اليومي للمواظبة' : '1. Rapport Journalier / Quotidien'}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{dir === 'rtl' ? `التاريخ : ${selectedDate}` : `Date : ${selectedDate}`}</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleTriggerPrint('WEEKLY')}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-all text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                      <div>
                        <div>{dir === 'rtl' ? '2. السجل الأسبوعي للحضور' : '2. Journal Hebdomadaire (Semaine)'}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{dir === 'rtl' ? `الأسبوع : من ${currentWeekDates[0]} إلى ${currentWeekDates[5]}` : `Semaine du ${currentWeekDates[0]} au ${currentWeekDates[5]}`}</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleTriggerPrint('MONTHLY')}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-500" />
                      <div>
                        <div>{dir === 'rtl' ? '3. الحصيلة الشهرية الشاملة' : '3. Bilan Mensuel (Mois Complet)'}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{dir === 'rtl' ? `الشهر : ${selectedMonth}` : `Mois : ${selectedMonth}`}</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowPrintMenu(false);
                      setShowCustomRangeModal(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-xl transition-all text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-purple-500" />
                      <div>
                        <div>{dir === 'rtl' ? '4. تقرير دوري مخصص' : '4. Bilan Périodique Personnalisé'}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{dir === 'rtl' ? 'تحديد تاريخ البداية والنهاية' : 'Choisir Date Début ➔ Date Fin'}</div>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Export CSV Dropdown Hub */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowExportMenu(!showExportMenu);
                  setShowPrintMenu(false);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-100 transition-all cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{dir === 'rtl' ? 'تصدير Excel / CSV' : 'Exporter CSV / Excel'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95 space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    {dir === 'rtl' ? 'خيارات التصدير' : 'Exporter au format CSV'}
                  </div>

                  <button
                    onClick={handleExportDailyCSV}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all text-left"
                  >
                    <Download className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <div>{dir === 'rtl' ? '1. تصدير الحضور اليومي' : '1. Exporter Pointage Journalier'}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{dir === 'rtl' ? `اليوم : ${selectedDate}` : `Jour : ${selectedDate}`}</div>
                    </div>
                  </button>

                  <button
                    onClick={handleExportWeeklyCSV}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all text-left"
                  >
                    <Download className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div>
                      <div>{dir === 'rtl' ? '2. تصدير السجل الأسبوعي' : '2. Exporter Journal Hebdomadaire'}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{dir === 'rtl' ? `الأسبوع : من ${currentWeekDates[0]} إلى ${currentWeekDates[5]}` : `Semaine du ${currentWeekDates[0]} au ${currentWeekDates[5]}`}</div>
                    </div>
                  </button>

                  <button
                    onClick={handleExportMonthlyCSV}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all text-left"
                  >
                    <Download className="w-4 h-4 text-teal-500 shrink-0" />
                    <div>
                      <div>{dir === 'rtl' ? '3. تصدير الحصيلة الشهرية' : '3. Exporter Bilan Mensuel'}</div>
                      <div className="text-[10px] text-slate-400 font-normal">Mois : {selectedMonth}</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      setShowCustomRangeModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all text-left"
                  >
                    <Download className="w-4 h-4 text-purple-500 shrink-0" />
                    <div>
                      <div>4. Exporter Période Personnalisée</div>
                      <div className="text-[10px] text-slate-400 font-normal">Plage personnalisée (Date Début ➔ Fin)</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Custom Range Period Modal */}
        {showCustomRangeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in print:hidden">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <div className="p-2 rounded-xl bg-purple-500/15">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Rapport Périodique des Élèves
                    </h3>
                    <p className="text-xs text-slate-400">Sélectionnez la période exacte à traiter</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCustomRangeModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date Début
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date Fin
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleTriggerPrint('PERIODIC')}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/20"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPeriodicCSV}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Exporter CSV</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Tabs */}
        <div className="grid grid-cols-2 sm:flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs print:hidden gap-1">
          <button
            onClick={() => setActiveTab('pointage')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'pointage'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{dir === 'rtl' ? '1. تسجيل الحضور اليومي' : '1. Pointage Quotidien'}</span>
          </button>

          <button
            onClick={() => setActiveTab('daily_report')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'daily_report'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{dir === 'rtl' ? '2. التقرير اليومي' : '2. Rapport Journalier'}</span>
          </button>

          <button
            onClick={() => setActiveTab('monthly_report')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'monthly_report'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{dir === 'rtl' ? '3. التقرير الشهري' : '3. Rapport Mensuel'}</span>
          </button>

          <button
            onClick={() => setActiveTab('semester_report')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'semester_report'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>4. Rapport Semestriel</span>
          </button>
        </div>

        {/* Global KPI Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {dailyStats.presentCount} <span className="text-xs text-slate-400 font-semibold">/ {dailyStats.totalStudents}</span>
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Présents à l&apos;heure ({dailyStats.rate}%)</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {dailyStats.lateCount} <span className="text-xs text-slate-400 font-semibold font-mono">({dailyStats.totalLateFormatted})</span>
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Retards ({dailyStats.lateJustifiedCount} justifié{dailyStats.lateJustifiedCount > 1 ? 's' : ''})
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {dailyStats.absentCount}
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Absences ({dailyStats.absentJustifiedCount} justifiée{dailyStats.absentJustifiedCount > 1 ? 's' : ''})
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {dailyStats.lateJustifiedCount + dailyStats.absentJustifiedCount}
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Justifiés (Motif validé)</div>
            </div>
          </div>
        </div>

        {/* Filter & Selector Ribbon: Continuous Single Row with Responsive Scaling */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
          <div className="flex flex-wrap items-center gap-2.5 w-full">
            {/* Cycle Selector */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap flex items-center gap-1 shrink-0">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>Cycle :</span>
              </label>
              <select
                value={selectedCycle}
                onChange={(e) => {
                  const newCycle = e.target.value;
                  setSelectedCycle(newCycle);
                  if (selectedClassId !== 'ALL') {
                    const currentCls = classes.find((c) => c.id === selectedClassId);
                    if (currentCls && !isClassInCycle(currentCls.level || currentCls.name, newCycle)) {
                      setSelectedClassId('ALL');
                    }
                  }
                }}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs truncate"
              >
                <option value="ALL">Tous les Cycles</option>
                <option value="MATERNELLE">🧸 Maternelle</option>
                <option value="PRIMAIRE">📚 Primaire</option>
                <option value="COLLEGE">📐 Collège</option>
                <option value="LYCEE">🎓 Lycée</option>
              </select>
            </div>

            {/* Class Selector (Filtered dynamically by cycle) */}
            <div className="flex items-center gap-1.5 flex-1 min-w-[150px]">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap flex items-center gap-1 shrink-0">
                <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
                <span>Classe :</span>
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs truncate"
              >
                <option value="ALL">
                  {selectedCycle === 'ALL' ? 'Toutes les classes' : `Toutes les classes du cycle (${filteredClasses.length})`}
                </option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.level})
                  </option>
                ))}
              </select>
            </div>

            {/* Date / Month / Semester Selector */}
            {activeTab === 'pointage' || activeTab === 'daily_report' ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>
            ) : activeTab === 'monthly_report' ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-[130px]">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">Mois :</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-1 min-w-[150px]">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">Semestre :</label>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value as 'S1' | 'S2')}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white cursor-pointer shadow-xs truncate"
                >
                  <option value="S1">Semestre 1 (Sept - Janv)</option>
                  <option value="S2">Semestre 2 (Févr - Juin)</option>
                </select>
              </div>
            )}

            {/* Quick Action: Mark all present */}
            {activeTab === 'pointage' && (
              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                Tout pointer Présent
              </button>
            )}

            {/* Search Input */}
            <div className="relative flex-1 min-w-[140px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher élève..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: POINTAGE QUOTIDIEN ÉLÈVES (Fluid Responsive Table)    */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'pointage' && (
          <div className="space-y-3 animate-in fade-in duration-300 print:hidden">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4 w-36 whitespace-nowrap">Matricule</th>
                      <th className="py-3 px-4 min-w-[200px]">Élève &amp; Tuteur</th>
                      <th className="py-3 px-4 w-44 whitespace-nowrap">Classe &amp; Niveau</th>
                      <th className="py-3 px-4 text-center min-w-[240px] whitespace-nowrap">Pointage &amp; Statut</th>
                      <th className="py-3 px-4 text-center w-28 whitespace-nowrap">Retard</th>
                      <th className="py-3 px-4 text-right min-w-[170px] whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                          Aucun élève trouvé pour cette sélection.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => {
                        const rec = dailyRecordMap[student.id];
                        const status = rec?.status || 'PRESENT';
                        const lateMins = rec?.late_minutes || 0;
                        const isJustified = rec?.is_justified || false;

                        return (
                          <tr key={student.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            {/* Matricule */}
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {student.student_code}
                            </td>

                            {/* Élève & Tuteur */}
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900 dark:text-white text-xs" title={`${student.first_name} ${student.last_name}`}>
                                {student.first_name} {student.last_name}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {student.guardian_phone || student.phone ? (
                                  <span>{student.guardian_phone || student.phone} {student.guardian_name ? `(${student.guardian_name})` : ''}</span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600 italic">Aucun téléphone</span>
                                )}
                              </div>
                            </td>

                            {/* Classe & Niveau Badge */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className="inline-flex items-center px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-[11px] border border-blue-200/50 dark:border-blue-900/50"
                                title={`${student.class?.name || 'Non assigné'} (${student.class?.level || '-'})`}
                              >
                                {student.class?.name || 'Non assigné'} &bull; {student.class?.level || '-'}
                              </span>
                            </td>

                            {/* Status Pill Box (3 Button switcher + Justification below when Absent) */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <div className="flex flex-col items-center gap-1.5 justify-center">
                                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                  <button
                                    type="button"
                                    onClick={() => handleQuickStatusChange(student, 'PRESENT')}
                                    className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                      status === 'PRESENT'
                                        ? 'bg-emerald-500 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                                    }`}
                                  >
                                    Présent
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleQuickStatusChange(student, 'LATE')}
                                    className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                      status === 'LATE'
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
                                    }`}
                                  >
                                    Retard
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleQuickStatusChange(student, 'ABSENT')}
                                    className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                      status === 'ABSENT' || status === 'EXCUSED'
                                        ? 'bg-rose-500 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
                                    }`}
                                  >
                                    Absent
                                  </button>
                                </div>

                                {/* Justification toggle button when Absent */}
                                {(status === 'ABSENT' || status === 'EXCUSED') && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleJustification(student)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer shadow-2xs ${
                                      isJustified || status === 'EXCUSED'
                                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40 hover:bg-emerald-200'
                                        : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300/40 hover:bg-rose-200'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        isJustified || status === 'EXCUSED'
                                          ? 'bg-emerald-500'
                                          : 'bg-rose-500'
                                      }`}
                                    />
                                    <span>{isJustified || status === 'EXCUSED' ? 'Justifié' : 'Non justifié'}</span>
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Delay Duration */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              {status === 'LATE' ? (
                                <span className="inline-block px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-mono text-[11px] font-bold border border-amber-300/50">
                                  {formatDelayDuration(lateMins)}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono text-xs">-</span>
                              )}
                            </td>

                            {/* Actions & WhatsApp Buttons */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                {/* WhatsApp Send Button for Absent / Late */}
                                {(status === 'ABSENT' || status === 'EXCUSED' || status === 'LATE') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const rawPhone = student.guardian_phone || student.phone;
                                      const normalized = normalizeMoroccanPhone(rawPhone);
                                      if (!normalized) {
                                        setShowWhatsAppModal(true);
                                        return;
                                      }
                                      const isLate = status === 'LATE';
                                      const template = isLate
                                        ? locale === 'ar'
                                          ? settings?.whatsapp_late_template_ar
                                          : settings?.whatsapp_late_template_fr
                                        : locale === 'ar'
                                        ? settings?.whatsapp_absence_template_ar
                                        : settings?.whatsapp_absence_template_fr;
                                      const schoolName = locale === 'ar' ? settings?.school_name_ar || settings?.school_name : settings?.school_name;
                                      const msg = buildAbsenceMessage({
                                        studentName: `${student.first_name} ${student.last_name}`,
                                        guardianName: student.guardian_name || '',
                                        className: student.class?.name || '',
                                        date: selectedDate,
                                        schoolName: schoolName || 'GM School',
                                        isLate,
                                        lateMinutes: lateMins || 15,
                                        customTemplate: template,
                                        locale: locale as 'fr' | 'ar',
                                      });
                                      openWhatsAppChat(normalized, msg);
                                      setSessionSentIds((prev) => ({ ...prev, [student.id]: true }));
                                    }}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold transition-all cursor-pointer shadow-xs ${
                                      sessionSentIds[student.id]
                                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    }`}
                                    title={dir === 'rtl' ? 'إرسال إشعار واتساب لولي الأمر' : 'Envoyer message WhatsApp au parent'}
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                                    <span>{sessionSentIds[student.id] ? (dir === 'rtl' ? 'تم الإرسال' : 'Envoyé') : 'WhatsApp'}</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => openEditModal(student)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                                >
                                  <Edit2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>Éditer</span>
                                </button>
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
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: RAPPORT JOURNALIER (Daily Detailed Report)            */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'daily_report' && (
          <div className="space-y-4 animate-in fade-in duration-300 print:hidden">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Rapport Quotidien du Pointage des Élèves &bull; {selectedDate}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Bilan d&apos;assiduité journalier, liste des élèves en retard et motifs d&apos;absence.
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-slate-400 uppercase">Taux de Présence Globale</div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{dailyStats.rate}%</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs table-fixed min-w-[760px]">
                  <colgroup>
                    <col className="w-[20%]" />
                    <col className="w-[18%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold uppercase">
                    <tr>
                      <th className="p-3">Élève</th>
                      <th className="p-3">Classe</th>
                      <th className="p-3">Arrivée</th>
                      <th className="p-3">Statut</th>
                      <th className="p-3">Retard Constaté</th>
                      <th className="p-3">Justification</th>
                      <th className="p-3">Motif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredStudents.map((student) => {
                      const rec = dailyRecordMap[student.id];
                      const status = rec?.status || 'PRESENT';
                      const lateMins = rec?.late_minutes || 0;

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-900 dark:text-white truncate" title={`${student.first_name} ${student.last_name}`}>
                            {student.first_name} {student.last_name}
                          </td>
                          <td className="p-3 text-slate-500 truncate" title={student.class?.name || 'Non assigné'}>
                            {student.class?.name || 'Non assigné'}
                          </td>
                          <td className="p-3 font-mono">{rec?.check_in_time || '08:00'}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                status === 'PRESENT'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : status === 'LATE'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                  : status === 'ABSENT'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                  : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                            {status === 'LATE' ? formatDelayDuration(lateMins) : <span className="text-slate-400 font-normal">0 min</span>}
                          </td>
                          <td className="p-3">
                            {rec?.is_justified || status === 'EXCUSED' ? (
                              <span className="text-emerald-600 font-bold">Oui</span>
                            ) : status === 'LATE' || status === 'ABSENT' ? (
                              <span className="text-rose-500 font-bold">Non</span>
                            ) : (
                              <span className="text-slate-400 font-normal">Non concerné</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 truncate" title={rec?.justification_reason || rec?.notes || ''}>
                            {rec?.justification_reason || rec?.notes || <span className="text-slate-400">Aucun</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: RAPPORT MENSUEL (Monthly Consolidated Report)         */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'monthly_report' && (
          <div className="space-y-4 animate-in fade-in duration-300 print:hidden">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Bilan Mensuel d&apos;Assiduité des Élèves &bull; {selectedMonth}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Total cumulé des retards en heures et minutes, décompte des absences justifiées vs non justifiées.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs table-fixed min-w-[760px]">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[16%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[14%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold uppercase">
                    <tr>
                      <th className="p-3">Élève</th>
                      <th className="p-3">Classe</th>
                      <th className="p-3 text-center">Présence</th>
                      <th className="p-3 text-center">Retards</th>
                      <th className="p-3 text-center font-bold">Cumul H/Min</th>
                      <th className="p-3 text-center">Injustifiés</th>
                      <th className="p-3 text-center">Absences</th>
                      <th className="p-3 text-right">Taux Assiduité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {monthlyStudentSummary.map((item) => (
                      <tr key={item.student.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-900 dark:text-white truncate" title={`${item.student.first_name} ${item.student.last_name}`}>
                          {item.student.first_name} {item.student.last_name}
                        </td>
                        <td className="p-3 text-slate-500 truncate" title={item.student.class?.name || 'Non assigné'}>
                          {item.student.class?.name || 'Non assigné'}
                        </td>
                        <td className="p-3 text-center font-bold text-emerald-600">{item.presentDays} j</td>
                        <td className="p-3 text-center">{item.lateCount}</td>
                        <td className="p-3 text-center font-mono font-bold">
                          {item.totalLateMins > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400">{item.totalLateFormatted}</span>
                          ) : (
                            <span className="text-slate-400 font-normal">0 min</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {item.lateUnjustified > 0 ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">
                              {item.lateUnjustified}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-bold text-rose-600">{item.absentDays} j</td>
                        <td className="p-3 text-right font-black text-xs">
                          <span
                            className={
                              item.assiduityRate >= 95
                                ? 'text-emerald-600'
                                : item.assiduityRate >= 85
                                ? 'text-amber-600'
                                : 'text-rose-600'
                            }
                          >
                            {item.assiduityRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: RAPPORT SEMESTRIEL (Semester Report & KPI)             */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'semester_report' && (
          <div className="space-y-4 animate-in fade-in duration-300 print:hidden">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Bilan Semestriel Consolidé des Élèves &bull; {selectedSemester === 'S1' ? 'Semestre 1 (S1)' : 'Semestre 2 (S2)'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Analyse semestrielle de l&apos;assiduité scolaire, heures de retard cumulées, volume des absences.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs table-fixed min-w-[760px]">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[16%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[14%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold uppercase">
                    <tr>
                      <th className="p-3">Élève</th>
                      <th className="p-3">Classe</th>
                      <th className="p-3 text-center">Présence</th>
                      <th className="p-3 text-center">Retards</th>
                      <th className="p-3 text-center font-bold">Cumul H/Min</th>
                      <th className="p-3 text-center">Injustifiés</th>
                      <th className="p-3 text-center">Absences</th>
                      <th className="p-3 text-right">Taux Semestriel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {semesterStudentSummary.map((item) => (
                      <tr key={item.student.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-900 dark:text-white truncate" title={`${item.student.first_name} ${item.student.last_name}`}>
                          {item.student.first_name} {item.student.last_name}
                        </td>
                        <td className="p-3 text-slate-500 truncate" title={item.student.class?.name || 'Non assigné'}>
                          {item.student.class?.name || 'Non assigné'}
                        </td>
                        <td className="p-3 text-center font-bold text-emerald-600">{item.presentDays} j</td>
                        <td className="p-3 text-center">{item.lateCount}</td>
                        <td className="p-3 text-center font-mono font-bold">
                          {item.totalLateMins > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400">{item.totalLateFormatted}</span>
                          ) : (
                            <span className="text-slate-400 font-normal">0 min</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {item.lateUnjustified > 0 ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">
                              {item.lateUnjustified}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-bold text-rose-600">{item.absentDays} j</td>
                        <td className="p-3 text-right font-black text-xs">
                          <span
                            className={
                              item.assiduityRate >= 95
                                ? 'text-emerald-600'
                                : item.assiduityRate >= 85
                                ? 'text-amber-600'
                                : 'text-rose-600'
                            }
                          >
                            {item.assiduityRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PRINTABLE OFFICIAL REPORT SHEET (DAILY / WEEKLY / MONTHLY / PERIODIC) */}
        {/* ------------------------------------------------------------- */}
        <div className="hidden print:block print-student-attendance-sheet">
          <div className="border-b-2 border-slate-900 pb-3 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-base font-black uppercase text-slate-900">
                  {settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES'}
                </h1>
                <p className="text-[10pt] font-bold text-slate-700 mt-0.5">
                  {printReportMode === 'DAILY' && "FEUILLE OFFICIELLE D'APPEL ET D'ASSIDUITÉ DES ÉLÈVES (JOURNALIER)"}
                  {printReportMode === 'WEEKLY' && "JOURNAL HEBDOMADAIRE D'AUDIT ET DE PRÉSENCE DES ÉLÈVES"}
                  {printReportMode === 'MONTHLY' && "REGISTRE MENSUEL RÉCAPITULATIF DE PRÉSENCE DES ÉLÈVES"}
                  {printReportMode === 'PERIODIC' && `BILAN D'ASSIDUITÉ DES ÉLÈVES (${customStartDate} AU ${customEndDate})`}
                </p>
                <p className="text-[8pt] text-slate-600">
                  Année Scolaire : {settings.academic_year || '2025-2026'} &bull; Établissement Privé &bull; Direction Pédagogique
                </p>
              </div>

              <div className="text-right border border-slate-400 p-2 rounded">
                <div className="text-[9pt] font-black">
                  {printReportMode === 'DAILY' && `Date : ${selectedDate}`}
                  {printReportMode === 'WEEKLY' && `Semaine : ${currentWeekDates[0]} au ${currentWeekDates[5]}`}
                  {printReportMode === 'MONTHLY' && `Mois : ${selectedMonth}`}
                  {printReportMode === 'PERIODIC' && `Période : ${customStartDate} au ${customEndDate}`}
                </div>
                <div className="text-[8pt] text-slate-700">Taux de présence : {dailyStats.rate}%</div>
                <div className="text-[7.5pt] text-slate-500">Généré le : {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          </div>

          {/* 1. DAILY PRINT TABLE */}
          {printReportMode === 'DAILY' && (
            <table className="w-full text-left border-collapse text-[8pt] mb-6">
              <thead>
                <tr className="bg-slate-100 border border-slate-400 font-bold">
                  <th className="p-2 border border-slate-400">Matricule</th>
                  <th className="p-2 border border-slate-400">Nom &amp; Prénom Élève</th>
                  <th className="p-2 border border-slate-400">Classe</th>
                  <th className="p-2 border border-slate-400 text-center">Arrivée</th>
                  <th className="p-2 border border-slate-400 text-center">Statut</th>
                  <th className="p-2 border border-slate-400 text-center">Retard (H/Min)</th>
                  <th className="p-2 border border-slate-400 text-center">Justifié</th>
                  <th className="p-2 border border-slate-400">Motif / Justification</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, idx) => {
                  const rec = dailyRecordMap[student.id];
                  const status = rec?.status || 'PRESENT';
                  const lateMins = rec?.late_minutes || 0;

                  return (
                    <tr key={idx} className="border border-slate-400">
                      <td className="p-2 border border-slate-400 font-mono font-bold">{student.student_code}</td>
                      <td className="p-2 border border-slate-400 font-bold">
                        {student.last_name.toUpperCase()} {student.first_name}
                      </td>
                      <td className="p-2 border border-slate-400">{student.class?.name || '-'}</td>
                      <td className="p-2 border border-slate-400 text-center font-mono">{rec?.check_in_time || '08:00'}</td>
                      <td className="p-2 border border-slate-400 text-center font-bold">{status}</td>
                      <td className="p-2 border border-slate-400 text-center font-mono font-bold">
                        {status === 'LATE' ? formatDelayDuration(lateMins) : '-'}
                      </td>
                      <td className="p-2 border border-slate-400 text-center font-bold">
                        {rec?.is_justified || status === 'EXCUSED' ? 'OUI' : status === 'LATE' || status === 'ABSENT' ? 'NON' : '-'}
                      </td>
                      <td className="p-2 border border-slate-400">{rec?.justification_reason || rec?.notes || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* 2. WEEKLY PRINT TABLE */}
          {printReportMode === 'WEEKLY' && (
            <table className="w-full text-left border-collapse text-[7.5pt] mb-6">
              <thead>
                <tr className="bg-slate-100 border border-slate-400 font-bold">
                  <th className="p-2 border border-slate-400">Matricule</th>
                  <th className="p-2 border border-slate-400">Nom &amp; Prénom</th>
                  <th className="p-2 border border-slate-400">Classe</th>
                  <th className="p-2 border border-slate-400 text-center">Lun ({currentWeekDates[0].slice(5)})</th>
                  <th className="p-2 border border-slate-400 text-center">Mar ({currentWeekDates[1].slice(5)})</th>
                  <th className="p-2 border border-slate-400 text-center">Mer ({currentWeekDates[2].slice(5)})</th>
                  <th className="p-2 border border-slate-400 text-center">Jeu ({currentWeekDates[3].slice(5)})</th>
                  <th className="p-2 border border-slate-400 text-center">Ven ({currentWeekDates[4].slice(5)})</th>
                  <th className="p-2 border border-slate-400 text-center">Sam ({currentWeekDates[5].slice(5)})</th>
                  <th className="p-2 border border-slate-400 text-center">Retards</th>
                  <th className="p-2 border border-slate-400 text-center">Assiduité</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, idx) => {
                  const weekRecs = attendanceRecords.filter((r) => r.student_id === student.id && currentWeekDates.includes(r.date));
                  let totalLateMins = 0;
                  let presentCount = 0;
                  let absentCount = 0;

                  return (
                    <tr key={idx} className="border border-slate-400">
                      <td className="p-2 border border-slate-400 font-mono font-bold">{student.student_code}</td>
                      <td className="p-2 border border-slate-400 font-bold">{student.last_name.toUpperCase()} {student.first_name}</td>
                      <td className="p-2 border border-slate-400">{student.class?.name || '-'}</td>
                      {currentWeekDates.map((dateStr, dIdx) => {
                        const rec = weekRecs.find((r) => r.date === dateStr);
                        if (!rec) return <td key={dIdx} className="p-1 border border-slate-400 text-center text-slate-400">-</td>;
                        if (rec.status === 'PRESENT') {
                          presentCount++;
                          return <td key={dIdx} className="p-1 border border-slate-400 text-center text-emerald-700 font-bold">P (08:00)</td>;
                        }
                        if (rec.status === 'LATE') {
                          presentCount++;
                          totalLateMins += rec.late_minutes || 0;
                          return <td key={dIdx} className="p-1 border border-slate-400 text-center text-amber-700 font-bold">R (+{rec.late_minutes}m)</td>;
                        }
                        absentCount++;
                        return <td key={dIdx} className="p-1 border border-slate-400 text-center text-rose-700 font-bold">ABS</td>;
                      })}
                      <td className="p-2 border border-slate-400 text-center font-bold">{formatDelayDuration(totalLateMins)}</td>
                      <td className="p-2 border border-slate-400 text-center font-black">
                        {presentCount + absentCount > 0 ? `${Math.round((presentCount / (presentCount + absentCount)) * 100)}%` : '100%'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* 3. MONTHLY PRINT TABLE */}
          {printReportMode === 'MONTHLY' && (
            <table className="w-full text-left border-collapse text-[8pt] mb-6">
              <thead>
                <tr className="bg-slate-100 border border-slate-400 font-bold">
                  <th className="p-2 border border-slate-400">Matricule</th>
                  <th className="p-2 border border-slate-400">Nom Complet</th>
                  <th className="p-2 border border-slate-400">Classe</th>
                  <th className="p-2 border border-slate-400 text-center">Jours Présents</th>
                  <th className="p-2 border border-slate-400 text-center">Retards (Nb)</th>
                  <th className="p-2 border border-slate-400 text-center">Cumul Retards</th>
                  <th className="p-2 border border-slate-400 text-center">Absences (j)</th>
                  <th className="p-2 border border-slate-400 text-center">Taux d&apos;Assiduité</th>
                </tr>
              </thead>
              <tbody>
                {monthlyStudentSummary.map((item, idx) => (
                  <tr key={idx} className="border border-slate-400">
                    <td className="p-2 border border-slate-400 font-mono font-bold">{item.student.student_code}</td>
                    <td className="p-2 border border-slate-400 font-bold">{item.student.last_name.toUpperCase()} {item.student.first_name}</td>
                    <td className="p-2 border border-slate-400">{item.student.class?.name || '-'}</td>
                    <td className="p-2 border border-slate-400 text-center font-bold">{item.presentDays} j</td>
                    <td className="p-2 border border-slate-400 text-center">{item.lateCount}</td>
                    <td className="p-2 border border-slate-400 text-center font-mono">{item.totalLateFormatted}</td>
                    <td className="p-2 border border-slate-400 text-center font-bold text-rose-700">{item.absentDays} j</td>
                    <td className="p-2 border border-slate-400 text-center font-black">{item.assiduityRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 4. PERIODIC PRINT TABLE */}
          {printReportMode === 'PERIODIC' && (
            <table className="w-full text-left border-collapse text-[8pt] mb-6">
              <thead>
                <tr className="bg-slate-100 border border-slate-400 font-bold">
                  <th className="p-2 border border-slate-400">Matricule</th>
                  <th className="p-2 border border-slate-400">Nom Complet</th>
                  <th className="p-2 border border-slate-400">Classe</th>
                  <th className="p-2 border border-slate-400 text-center">Jours Présents</th>
                  <th className="p-2 border border-slate-400 text-center">Retards (Nb)</th>
                  <th className="p-2 border border-slate-400 text-center">Total Retards</th>
                  <th className="p-2 border border-slate-400 text-center">Absences (j)</th>
                  <th className="p-2 border border-slate-400 text-center">Taux Assiduité</th>
                </tr>
              </thead>
              <tbody>
                {periodicStudentSummary.map((item, idx) => (
                  <tr key={idx} className="border border-slate-400">
                    <td className="p-2 border border-slate-400 font-mono font-bold">{item.student.student_code}</td>
                    <td className="p-2 border border-slate-400 font-bold">{item.student.last_name.toUpperCase()} {item.student.first_name}</td>
                    <td className="p-2 border border-slate-400">{item.student.class?.name || '-'}</td>
                    <td className="p-2 border border-slate-400 text-center font-bold">{item.presentDays} j</td>
                    <td className="p-2 border border-slate-400 text-center">{item.lateCount}</td>
                    <td className="p-2 border border-slate-400 text-center font-mono">{item.totalLateFormatted}</td>
                    <td className="p-2 border border-slate-400 text-center font-bold text-rose-700">{item.absentDays} j</td>
                    <td className="p-2 border border-slate-400 text-center font-black">{item.assiduityRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="flex justify-between items-center text-[8pt] pt-6 border-t border-slate-300 mt-6">
            <div>
              <p className="font-bold">Visa du Responsable Pédagogique / Direction</p>
              <div className="h-14"></div>
            </div>
            <div className="text-right">
              <p className="font-bold">Signature du Surveillant Général / Vie Scolaire</p>
              <div className="h-14"></div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* MODAL: EDIT RETARD / JUSTIFICATION ÉLÈVE                     */}
        {/* ------------------------------------------------------------- */}
        {editingRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in print:hidden overflow-y-auto">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <div className="p-2 rounded-xl bg-blue-500/15">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Édition de Présence &amp; Justification Élève
                    </h3>
                    <p className="text-xs text-slate-400">
                      {editingRecord.studentName} &bull; {editingRecord.className} &bull; {selectedDate}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingRecord(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5">
                {/* Status selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Statut de Présence de l&apos;Élève
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] as AttendanceStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setEditingRecord({ ...editingRecord, status: st })}
                        className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          editingRecord.status === st
                            ? st === 'PRESENT'
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                              : st === 'LATE'
                              ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                              : st === 'ABSENT'
                              ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                              : 'bg-purple-500 text-white border-purple-500 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Delay configuration if LATE */}
                {editingRecord.status === 'LATE' && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-3">
                    <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>Calcul Précis du Retard de l&apos;Élève (Heures &amp; Minutes)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Heure d&apos;Arrivée Réelle
                        </label>
                        <input
                          type="time"
                          value={editingRecord.checkInTime}
                          onChange={(e) => {
                            const newTime = e.target.value;
                            const [h, m] = newTime.split(':').map(Number);
                            const diffMins = Math.max(0, (h - 8) * 60 + m);
                            setEditingRecord({
                              ...editingRecord,
                              checkInTime: newTime,
                              lateMinutes: diffMins,
                            });
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Durée Retard (en minutes)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="480"
                          value={editingRecord.lateMinutes}
                          onChange={(e) =>
                            setEditingRecord({
                              ...editingRecord,
                              lateMinutes: Number(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
                      Durée convertie :{' '}
                      <span className="font-black underline font-mono">
                        {formatDelayDuration(editingRecord.lateMinutes)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Justification toggle */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Justification du Retard / de l&apos;Absence
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Billet d&apos;entrée ou certificat médical fourni par les parents
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setEditingRecord({
                          ...editingRecord,
                          isJustified: !editingRecord.isJustified,
                        })
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs ${
                        editingRecord.isJustified
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/80 border border-emerald-300/40'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/80 border border-rose-300/40'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          editingRecord.isJustified ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                        }`}
                      />
                      <span>{editingRecord.isJustified ? 'Justifié' : 'Non justifié'}</span>
                    </button>
                  </div>

                  {editingRecord.isJustified && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Motif de Justification
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Certificat médical, Motif familial exceptionnel, Panne de bus..."
                        value={editingRecord.justificationReason}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            justificationReason: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Notes / Remarques de la Vie Scolaire
                  </label>
                  <input
                    type="text"
                    placeholder="Remarques complémentaires, contact téléphonique parents..."
                    value={editingRecord.notes}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveModalRecord}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md transition-all cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp Absence & Retard Modal Hub */}
        <WhatsAppAbsenceModal
          isOpen={showWhatsAppModal}
          onClose={() => setShowWhatsAppModal(false)}
          selectedDate={selectedDate}
          students={students}
          attendanceRecords={attendanceRecords}
          onStudentUpdated={(updatedStudent) => {
            setStudents((prev) =>
              prev.map((s) => (s.id === updatedStudent.id ? updatedStudent : s))
            );
          }}
        />
      </div>
    </DashboardLayout>
  );
}
