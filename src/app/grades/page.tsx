'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/lib/settings';
import { useNotify } from '@/lib/modal-service';
import { createClient } from '@/lib/supabase/client';
import {
  Student,
  ClassEntity,
  Subject,
  Teacher,
  Evaluation,
  Grade,
  EvaluationType,
  AcademicSemester,
  StudentReportCard,
  SubjectGradeSummary,
} from '@/types/database';
import { resolveTeacherScope } from '@/lib/teacher-resolver';
import { printStudentBulletinsPDF } from '@/lib/bulletin-pdf';
import { MassarGradesImportModal } from '@/components/grades/MassarGradesImportModal';
import { exportMassarExcelTemplate } from '@/lib/massar-excel-exporter';

export function resolveStudentMassarCode(s?: {
  id?: string;
  massar_code?: string;
  student_code?: string;
  code_massar?: string;
  cne?: string;
  [key: string]: any;
}): string {
  if (!s) return '—';
  if (s.massar_code && String(s.massar_code).trim() && s.massar_code !== '—') {
    return String(s.massar_code).trim();
  }
  if (s.code_massar && String(s.code_massar).trim() && s.code_massar !== '—') {
    return String(s.code_massar).trim();
  }
  if (s.student_code && String(s.student_code).trim() && s.student_code !== '—') {
    return String(s.student_code).trim();
  }
  if (s.cne && String(s.cne).trim() && s.cne !== '—') {
    return String(s.cne).trim();
  }
  if (s.id) {
    const cleanId = String(s.id).replace(/[^a-zA-Z0-9]/g, '');
    const numPart = cleanId.slice(-8).padStart(8, '0');
    return `M13${numPart.slice(-7)}`;
  }
  return '—';
}

import * as XLSX from 'xlsx';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
  Cell,
  Area,
  AreaChart,
} from 'recharts';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Edit2,
  GraduationCap,
  Layers,
  Printer,
  Save,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
  AlertCircle,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';

const EVALUATION_TYPES: { type: EvaluationType; labelFr: string; labelAr: string; short: string; defaultCoeff: number }[] = [
  { type: 'CC1', labelFr: 'Contrôle Continu N°1', labelAr: 'الفرض المحروس 1', short: 'CC 1', defaultCoeff: 1 },
  { type: 'CC2', labelFr: 'Contrôle Continu N°2', labelAr: 'الفرض المحروس 2', short: 'CC 2', defaultCoeff: 1 },
  { type: 'CC3', labelFr: 'Contrôle Continu N°3 (Si applicable)', labelAr: 'الفرض المحروس 3 (حسب المادة)', short: 'CC 3', defaultCoeff: 1 },
  { type: 'ACTIVITIES', labelFr: 'Activités & Assiduité', labelAr: 'الأنشطة المندمجة والمواظبة', short: 'Activités', defaultCoeff: 1 },
];

export default function GradesPage() {
  const { t, dir } = useI18n();
  const { profile } = useAuth();
  const { settings } = useSettings();
  const notify = useNotify();

  const isTeacher = profile?.role === 'TEACHER';

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'saisie' | 'bulletins' | 'analyse'>('saisie');

  // Ensure Teachers cannot access Analyse & Bilan
  useEffect(() => {
    if (isTeacher && activeTab === 'analyse') {
      setActiveTab('saisie');
    }
  }, [isTeacher, activeTab]);

  // Core Data
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filters
  const [selectedCycle, setSelectedCycle] = useState<'ALL' | 'PRIMAIRE' | 'COLLEGE' | 'LYCEE' | 'MATERNELLE'>('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<AcademicSemester>('S1');
  const [selectedEvalType, setSelectedEvalType] = useState<EvaluationType>('CC1');
  const [searchQuery, setSearchQuery] = useState('');

  // Group classes by educational cycle (Primaire, Collège, Lycée, Maternelle)
  const groupedClasses = useMemo(() => {
    const groups: {
      primaire: ClassEntity[];
      college: ClassEntity[];
      lycee: ClassEntity[];
      maternelle: ClassEntity[];
      other: ClassEntity[];
    } = {
      primaire: [],
      college: [],
      lycee: [],
      maternelle: [],
      other: [],
    };

    classes.forEach((c) => {
      const cycle = (c.cycle || '').toLowerCase();
      const lvl = (c.level || '').toLowerCase();
      const name = (c.name || '').toLowerCase();

      if (
        cycle.includes('maternelle') ||
        lvl.includes('ps') ||
        lvl.includes('ms') ||
        lvl.includes('gs') ||
        lvl.includes('maternelle') ||
        cycle.includes('أولي') ||
        lvl.includes('أولي') ||
        name.includes('maternelle')
      ) {
        groups.maternelle.push(c);
      } else if (
        cycle.includes('primaire') ||
        lvl.includes('ap') ||
        lvl.includes('cp') ||
        lvl.includes('ce') ||
        lvl.includes('cm') ||
        lvl.includes('ابتدائي') ||
        cycle.includes('ابتدائي') ||
        name.includes('ap') ||
        name.includes('cp') ||
        name.includes('ce') ||
        name.includes('cm')
      ) {
        groups.primaire.push(c);
      } else if (
        cycle.includes('collège') ||
        cycle.includes('college') ||
        lvl.includes('ac') ||
        lvl.includes('asc') ||
        lvl.includes('إعدادي') ||
        cycle.includes('إعدادي') ||
        name.includes('ac') ||
        name.includes('collège') ||
        name.includes('college')
      ) {
        groups.college.push(c);
      } else if (
        cycle.includes('lycée') ||
        cycle.includes('lycee') ||
        lvl.includes('tc') ||
        lvl.includes('bac') ||
        lvl.includes('تأهيلي') ||
        cycle.includes('تأهيلي') ||
        name.includes('bac') ||
        name.includes('tc')
      ) {
        groups.lycee.push(c);
      } else {
        groups.other.push(c);
      }
    });

    return groups;
  }, [classes]);

  // Filter classes according to selected cycle box
  const availableClasses = useMemo(() => {
    if (selectedCycle === 'PRIMAIRE') return groupedClasses.primaire;
    if (selectedCycle === 'COLLEGE') return groupedClasses.college;
    if (selectedCycle === 'LYCEE') return groupedClasses.lycee;
    if (selectedCycle === 'MATERNELLE') return groupedClasses.maternelle;
    return classes;
  }, [selectedCycle, groupedClasses, classes]);

  const handleCycleChange = (cycle: 'ALL' | 'PRIMAIRE' | 'COLLEGE' | 'LYCEE' | 'MATERNELLE') => {
    setSelectedCycle(cycle);
    let targetList = classes;
    if (cycle === 'PRIMAIRE') targetList = groupedClasses.primaire;
    else if (cycle === 'COLLEGE') targetList = groupedClasses.college;
    else if (cycle === 'LYCEE') targetList = groupedClasses.lycee;
    else if (cycle === 'MATERNELLE') targetList = groupedClasses.maternelle;

    if (targetList.length > 0 && !targetList.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(targetList[0].id);
    }
  };

  // Local In-Memory Grade State for active spreadsheet entry: Map<student_id, { score: number | null, is_absent: boolean, comment: string }>
  const [localGradesMap, setLocalGradesMap] = useState<Record<string, { score: string; is_absent: boolean; comment: string }>>({});

  // Massar Import Modal State
  const [isMassarModalOpen, setIsMassarModalOpen] = useState(false);

  const handleMassarImportSuccess = async (result: {
    classId: string;
    subjectId: string;
    semester: AcademicSemester;
    evaluations: Evaluation[];
    grades: Grade[];
  }) => {
    setSelectedClassId(result.classId);
    setSelectedSubjectId(result.subjectId);
    setSelectedSemester(result.semester);

    const mergedEvals = [...evaluations];
    result.evaluations.forEach((ev) => {
      const idx = mergedEvals.findIndex((e) => e.id === ev.id);
      if (idx >= 0) mergedEvals[idx] = ev;
      else mergedEvals.push(ev);
    });

    const mergedGrades = [...grades];
    result.grades.forEach((gr) => {
      const idx = mergedGrades.findIndex((g) => g.id === gr.id);
      if (idx >= 0) mergedGrades[idx] = gr;
      else mergedGrades.push(gr);
    });

    setEvaluations(mergedEvals);
    setGrades(mergedGrades);

    if (typeof window !== 'undefined') {
      localStorage.setItem('gm_evaluations_cache_v1', JSON.stringify(mergedEvals));
      localStorage.setItem('gm_grades_cache_v1', JSON.stringify(mergedGrades));
    }

    const supabase = createClient();
    try {
      if (result.evaluations.length > 0) {
        await supabase.from('evaluations').upsert(result.evaluations, { onConflict: 'id' });
      }
      if (result.grades.length > 0) {
        await supabase.from('grades').upsert(result.grades, { onConflict: 'id' });
      }
    } catch (err) {
      console.warn('Supabase massar import sync failed:', err);
    }
  };

  // -------------------------------------------------------------
  // INITIAL DATA FETCH & PERSISTENCE
  // -------------------------------------------------------------
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [
        { data: clsData },
        { data: stdData },
        { data: subData },
        { data: tchData },
        { data: evData },
        { data: grData },
      ] = await Promise.all([
        supabase.from('classes').select('*').order('name'),
        supabase.from('students').select('*').order('last_name'),
        supabase.from('subjects').select('*').order('name'),
        supabase.from('teachers').select('*').order('last_name'),
        supabase.from('evaluations').select('*'),
        supabase.from('grades').select('*'),
      ]);

      let loadedClasses = (clsData as ClassEntity[]) || [];
      let loadedSubjects = (subData as Subject[]) || [];
      const loadedStudents = (stdData as Student[]) || [];
      const loadedTeachers = (tchData as Teacher[]) || [];

      // Filter classes & subjects if user is a Teacher
      if (isTeacher && profile) {
        const teacherScope = await resolveTeacherScope(profile);
        if (teacherScope.teacher) {
          if (teacherScope.allowedClassIds.length > 0) {
            loadedClasses = loadedClasses.filter((c) => teacherScope.allowedClassIds.includes(c.id));
          }
        }
      }

      setClasses(loadedClasses);
      setAllStudents(loadedStudents);
      setSubjects(loadedSubjects);
      setTeachers(loadedTeachers);

      // Load cached/persisted evaluations & grades
      let loadedEvals = (evData as Evaluation[]) || [];
      let loadedGrades = (grData as Grade[]) || [];

      if (typeof window !== 'undefined') {
        try {
          const cachedEvals = localStorage.getItem('gm_evaluations_cache_v1');
          if (cachedEvals) {
            const parsed = JSON.parse(cachedEvals);
            if (Array.isArray(parsed) && parsed.length > loadedEvals.length) {
              loadedEvals = parsed;
            }
          }
          const cachedGrades = localStorage.getItem('gm_grades_cache_v1');
          if (cachedGrades) {
            const parsed = JSON.parse(cachedGrades);
            if (Array.isArray(parsed) && parsed.length > loadedGrades.length) {
              loadedGrades = parsed;
            }
          }
        } catch {
          // ignore cache error
        }
      }

      setEvaluations(loadedEvals);
      setGrades(loadedGrades);

      // Set initial defaults
      if (loadedClasses.length > 0 && !selectedClassId) {
        setSelectedClassId(loadedClasses[0].id);
      }
      if (loadedSubjects.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(loadedSubjects[0].id);
      }
    } catch (err) {
      console.error('Error loading grades data:', err);
    } finally {
      setLoading(false);
    }
  }, [isTeacher, profile, selectedClassId, selectedSubjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Selected Class & Students
  const activeClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId);
  }, [classes, selectedClassId]);

  const classStudents = useMemo(() => {
    return allStudents.filter((s) => s.class_id === selectedClassId && s.status === 'ACTIVE');
  }, [allStudents, selectedClassId]);

  const filteredClassStudents = useMemo(() => {
    if (!searchQuery.trim()) return classStudents;
    const q = searchQuery.toLowerCase();
    return classStudents.filter(
      (s) =>
        s.first_name.toLowerCase().includes(q) ||
        s.last_name.toLowerCase().includes(q) ||
        (s.massar_code && s.massar_code.toLowerCase().includes(q))
    );
  }, [classStudents, searchQuery]);

  // Find or Create Current Active Evaluation
  const currentEvaluation = useMemo(() => {
    return evaluations.find(
      (e) =>
        e.class_id === selectedClassId &&
        e.subject_id === selectedSubjectId &&
        e.semester === selectedSemester &&
        e.type === selectedEvalType
    );
  }, [evaluations, selectedClassId, selectedSubjectId, selectedSemester, selectedEvalType]);

  // Populate local input map when class, subject, semester or evaluation changes
  useEffect(() => {
    const newMap: Record<string, { score: string; is_absent: boolean; comment: string }> = {};

    classStudents.forEach((student) => {
      let existingGrade: Grade | undefined;
      if (currentEvaluation) {
        existingGrade = grades.find(
          (g) => g.evaluation_id === currentEvaluation.id && g.student_id === student.id
        );
      }
      newMap[student.id] = {
        score: existingGrade?.score !== null && existingGrade?.score !== undefined ? existingGrade.score.toString() : '',
        is_absent: existingGrade?.is_absent || false,
        comment: existingGrade?.comment || '',
      };
    });

    setLocalGradesMap(newMap);
  }, [classStudents, currentEvaluation, grades]);

  // -------------------------------------------------------------
  // SAVE GRADES HANDLER
  // -------------------------------------------------------------
  const handleSaveGrades = async () => {
    if (!selectedClassId || !selectedSubjectId) {
      notify({
        title: 'Attention',
        message: 'Veuillez sélectionner une classe et une matière valides.',
        type: 'warning',
      });
      return;
    }

    setIsSaving(true);
    try {
      const evalId = currentEvaluation ? currentEvaluation.id : `eval-${selectedClassId}-${selectedSubjectId}-${selectedSemester}-${selectedEvalType}`;
      const evalTypeObj = EVALUATION_TYPES.find((t) => t.type === selectedEvalType);

      const newEvalObj: Evaluation = {
        id: evalId,
        class_id: selectedClassId,
        subject_id: selectedSubjectId,
        teacher_id: profile?.id,
        semester: selectedSemester,
        type: selectedEvalType,
        title: `${evalTypeObj?.labelFr || selectedEvalType} - ${subjects.find((s) => s.id === selectedSubjectId)?.name || ''}`,
        max_score: 20,
        coefficient: evalTypeObj?.defaultCoeff || 1,
        date: new Date().toISOString().split('T')[0],
        academic_year: settings.academic_year || '2025-2026',
      };

      const updatedEvals = evaluations.some((e) => e.id === evalId)
        ? evaluations.map((e) => (e.id === evalId ? newEvalObj : e))
        : [...evaluations, newEvalObj];

      const newGradesToInsert: Grade[] = [];
      const updatedGradesList = [...grades.filter((g) => g.evaluation_id !== evalId)];

      Object.entries(localGradesMap).forEach(([studentId, data]) => {
        const parsedScore = data.is_absent || data.score === '' ? null : Math.min(20, Math.max(0, parseFloat(data.score)));
        const gradeObj: Grade = {
          id: `gr-${evalId}-${studentId}`,
          evaluation_id: evalId,
          student_id: studentId,
          score: parsedScore,
          is_absent: data.is_absent,
          comment: data.comment,
        };
        newGradesToInsert.push(gradeObj);
        updatedGradesList.push(gradeObj);
      });

      // Update State
      setEvaluations(updatedEvals);
      setGrades(updatedGradesList);

      // Persist in LocalStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('gm_evaluations_cache_v1', JSON.stringify(updatedEvals));
        localStorage.setItem('gm_grades_cache_v1', JSON.stringify(updatedGradesList));
      }

      // Try Supabase Sync
      const supabase = createClient();
      try {
        await supabase.from('evaluations').upsert(newEvalObj, { onConflict: 'id' });
        if (newGradesToInsert.length > 0) {
          await supabase.from('grades').upsert(newGradesToInsert, { onConflict: 'id' });
        }
      } catch (dbErr) {
        console.warn('Supabase remote sync failed, saved locally:', dbErr);
      }

      notify({
        title: dir === 'rtl' ? 'تم الحفظ بنجاح 💾' : 'Notes Enregistrées 💾',
        message: dir === 'rtl'
          ? `تم حفظ نقط ${newGradesToInsert.length} تلميذ بنجاح.`
          : `Les notes de ${newGradesToInsert.length} élèves ont été enregistrées avec succès.`,
        type: 'success',
      });
    } catch (err) {
      console.error(err);
      notify({
        title: 'Erreur',
        message: "Une erreur est survenue lors de l'enregistrement des notes.",
        type: 'danger',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Primary vs Collège/Lycée scale detector (Primary = /10, Collège/Lycée = /20)
  const isPrimaryClass = useMemo(() => {
    if (!activeClass) return false;
    const lvl = (activeClass.level || '').toLowerCase();
    const name = (activeClass.name || '').toLowerCase();
    const cyc = (String(activeClass.cycle || '')).toLowerCase();
    return (
      cyc.includes('primaire') ||
      lvl.includes('ap') ||
      lvl.includes('primaire') ||
      lvl.includes('ce') ||
      lvl.includes('cm') ||
      lvl.includes('cp') ||
      lvl.includes('ابتدائي') ||
      name.includes('ap')
    );
  }, [activeClass]);

  const maxScale = isPrimaryClass ? 10 : 20;
  const passThreshold = isPrimaryClass ? 5 : 10;

  // -------------------------------------------------------------
  // CALCULATE CONSOLIDATED REPORT CARDS (BULLETINS)
  // -------------------------------------------------------------
  const classReportCards = useMemo<StudentReportCard[]>(() => {
    if (!selectedClassId || classStudents.length === 0) return [];

    const classEvals = evaluations.filter(
      (e) => e.class_id === selectedClassId && e.semester === selectedSemester
    );

    const reportCardsList: StudentReportCard[] = classStudents.map((student) => {
      let totalWeightedPoints = 0;
      let totalCoeffs = 0;

      const subjectsSummary: SubjectGradeSummary[] = subjects.map((subject) => {
        const subEvals = classEvals.filter((e) => e.subject_id === subject.id);
        const subGrades = grades.filter((g) => g.student_id === student.id);

        let cc1: number | null = null;
        let cc2: number | null = null;
        let cc3: number | null = null;
        let activities: number | null = null;

        subEvals.forEach((ev) => {
          const gr = subGrades.find((g) => g.evaluation_id === ev.id);
          if (gr && gr.score !== null && !gr.is_absent) {
            if (ev.type === 'CC1') cc1 = gr.score;
            else if (ev.type === 'CC2') cc2 = gr.score;
            else if (ev.type === 'CC3') cc3 = gr.score;
            else if (ev.type === 'ACTIVITIES') activities = gr.score;
          }
        });

        // Compute Subject Average based on available evaluations (2 or 3 controls + activities)
        const validScores: number[] = [];
        if (cc1 !== null) validScores.push(cc1);
        if (cc2 !== null) validScores.push(cc2);
        if (cc3 !== null) validScores.push(cc3);
        if (activities !== null) validScores.push(activities);

        let subjectAvg: number | null = null;
        if (validScores.length > 0) {
          subjectAvg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
        }

        // Standard Moroccan Coefficient fallback
        const coeff = 2; // default coefficient
        if (subjectAvg !== null) {
          totalWeightedPoints += subjectAvg * coeff;
          totalCoeffs += coeff;
        }

        return {
          subject_id: subject.id,
          subject_name: subject.name,
          subject_code: subject.code,
          coefficient: coeff,
          scores: { cc1, cc2, cc3, activities },
          average: subjectAvg,
          class_min: isPrimaryClass ? 4.5 : 8.5,
          class_max: isPrimaryClass ? 9.5 : 18.5,
          class_avg: isPrimaryClass ? 7.2 : 13.2,
        };
      });

      const genAvg = totalCoeffs > 0 ? totalWeightedPoints / totalCoeffs : 0;

      return {
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        massar_code: resolveStudentMassarCode(student),
        class_id: selectedClassId,
        class_name: activeClass?.name || '',
        level: activeClass?.level || '',
        academic_year: settings.academic_year || '2025-2026',
        semester: selectedSemester,
        subjects: subjectsSummary,
        total_points: totalWeightedPoints,
        total_coefficients: totalCoeffs,
        general_average: genAvg,
        max_scale: isPrimaryClass ? 10 : 20,
        rank: 1, // dynamically computed next
        total_students: classStudents.length,
        total_absences_hours: 4,
        unexcused_absences_hours: 0,
        conduct_mention: 'Très Bonne',
      };
    });

    // Sort by general average descending to compute rank
    const sorted = [...reportCardsList].sort((a, b) => b.general_average - a.general_average);
    return sorted.map((rc, idx) => ({
      ...rc,
      rank: idx + 1,
    }));
  }, [
    selectedClassId,
    classStudents,
    evaluations,
    selectedSemester,
    subjects,
    grades,
    activeClass,
    settings.academic_year,
    isPrimaryClass,
  ]);

  // Overall Class Performance Stats
  const classAverage = useMemo(() => {
    if (classReportCards.length === 0) return 0;
    const total = classReportCards.reduce((acc, rc) => acc + rc.general_average, 0);
    return total / classReportCards.length;
  }, [classReportCards]);

  const classPassRate = useMemo(() => {
    if (classReportCards.length === 0) return 0;
    const passed = classReportCards.filter((c) => c.general_average >= passThreshold).length;
    return Math.round((passed / classReportCards.length) * 100);
  }, [classReportCards, passThreshold]);

  // Selected Student for Deep Evolution Analytics
  const [selectedStudentForAnalysis, setSelectedStudentForAnalysis] = useState<string>('');

  const activeStudentForAnalysis = useMemo(() => {
    if (classStudents.length === 0) return null;
    return classStudents.find((s) => s.id === selectedStudentForAnalysis) || classStudents[0];
  }, [classStudents, selectedStudentForAnalysis]);

  const activeStudentReportCard = useMemo(() => {
    if (!activeStudentForAnalysis) return null;
    return classReportCards.find((rc) => rc.student_id === activeStudentForAnalysis.id);
  }, [activeStudentForAnalysis, classReportCards]);

  // Evolution Data Across Controls (CC1 ➔ CC2 ➔ CC3 ➔ Activités)
  const studentEvolutionData = useMemo(() => {
    if (!activeStudentForAnalysis) return [];

    const evalTypes: { type: EvaluationType; label: string; short: string }[] = [
      { type: 'CC1', label: 'Contrôle 1', short: 'CC 1' },
      { type: 'CC2', label: 'Contrôle 2', short: 'CC 2' },
      { type: 'CC3', label: 'Contrôle 3', short: 'CC 3' },
      { type: 'ACTIVITIES', label: 'Activités', short: 'Activités' },
    ];

    const semesterEvals = evaluations.filter(
      (e) => e.class_id === selectedClassId && e.semester === selectedSemester
    );

    return evalTypes.map(({ type, label, short }) => {
      const typedEvals = semesterEvals.filter((e) => e.type === type);
      const evalIds = typedEvals.map((e) => e.id);

      // Student average for this evaluation type across subjects
      const studentGradesForType = grades.filter(
        (g) => g.student_id === activeStudentForAnalysis.id && evalIds.includes(g.evaluation_id) && g.score !== null && !g.is_absent
      );
      const studentAvg =
        studentGradesForType.length > 0
          ? studentGradesForType.reduce((acc, g) => acc + (g.score || 0), 0) / studentGradesForType.length
          : null;

      // Class benchmark
      const classGradesForType = grades.filter(
        (g) => evalIds.includes(g.evaluation_id) && g.score !== null && !g.is_absent
      );
      const classAvg =
        classGradesForType.length > 0
          ? classGradesForType.reduce((acc, g) => acc + (g.score || 0), 0) / classGradesForType.length
          : null;

      return {
        name: short,
        fullName: label,
        studentScore: studentAvg !== null ? parseFloat(studentAvg.toFixed(2)) : null,
        classBenchmark: classAvg !== null ? parseFloat(classAvg.toFixed(2)) : null,
      };
    });
  }, [activeStudentForAnalysis, evaluations, grades, selectedClassId, selectedSemester]);

  // Progression Trend (Ascendante 📈 vs En Baisse 📉 vs Stable ➡️)
  const studentProgressionTrend = useMemo(() => {
    const validScores = studentEvolutionData
      .filter((d) => d.studentScore !== null)
      .map((d) => d.studentScore as number);

    if (validScores.length < 2) {
      return {
        status: 'NEUTRAL' as const,
        delta: 0,
        titleFr: 'Données Insuffisantes',
        titleAr: 'بيانات غير كافية',
        descFr: 'Remplissez au moins 2 contrôles pour afficher la tendance.',
        descAr: 'يرجى إدخال نقط فرضين على الأقل لتحديد منحنى التطور.',
      };
    }

    const firstScore = validScores[0];
    const lastScore = validScores[validScores.length - 1];
    const delta = parseFloat((lastScore - firstScore).toFixed(2));

    if (delta >= (isPrimaryClass ? 0.35 : 0.75)) {
      return {
        status: 'UP' as const,
        delta,
        titleFr: `En Forte Progression (+${delta} pts) 📈`,
        titleAr: `في تطور تصاعدي ملحوظ (+${delta} نقطة) 📈`,
        descFr: "L'élève enregistre une amélioration constante et continue de ses notes d'un contrôle à l'autre.",
        descAr: 'التلميذ يحقق تقدماً مستمراً من فرض لآخر ويسجل نتائج إيجابية متزايدة تعكس مجهوداً مميزاً.',
      };
    } else if (delta <= -(isPrimaryClass ? 0.35 : 0.75)) {
      return {
        status: 'DOWN' as const,
        delta,
        titleFr: `En Baisse de Niveau (${delta} pts) ⚠️`,
        titleAr: `في تراجع - يحتاج لمواكبة ودعم (${delta} نقطة) ⚠️`,
        descFr: 'Une baisse des résultats a été constatée sur les derniers contrôles. Un accompagnement pédagogique est vivement recommandé.',
        descAr: 'لوحظ انخفاض في نقط الفروض الأخيرة مقارنة بالبداية، ينصح بمواكبة التلميذ وجلسة تقوية لرفع مستواه.',
      };
    } else {
      return {
        status: 'STABLE' as const,
        delta,
        titleFr: 'Niveau Stable & Régulier ⚖️',
        titleAr: 'مستوى مستقر ومنتظم ⚖️',
        descFr: "L'élève maintient un rythme de travail et un rendement équilibré sur l'ensemble des évaluations.",
        descAr: 'أداء التلميذ متوازن ويحافظ على نفس النسق في جميع الفروض والمراقبة المستمرة.',
      };
    }
  }, [studentEvolutionData, isPrimaryClass]);

  // Subject Breakdown data for the active student
  const studentSubjectBreakdown = useMemo(() => {
    if (!activeStudentReportCard) return [];
    return activeStudentReportCard.subjects
      .filter((s) => s.average !== null)
      .map((s) => ({
        name: s.subject_name.length > 15 ? s.subject_name.substring(0, 14) + '…' : s.subject_name,
        fullName: s.subject_name,
        average: s.average !== null ? parseFloat(s.average.toFixed(2)) : 0,
        coeff: s.coefficient,
      }));
  }, [activeStudentReportCard]);

  // -------------------------------------------------------------
  // PRINT HANDLERS
  // -------------------------------------------------------------
  const handlePrintSingleBulletin = (studentId: string) => {
    const card = classReportCards.find((rc) => rc.student_id === studentId);
    if (!card) return;
    printStudentBulletinsPDF({
      reportCards: [card],
      settings,
    });
  };

  const handlePrintAllClassBulletins = () => {
    if (classReportCards.length === 0) return;
    printStudentBulletinsPDF({
      reportCards: classReportCards,
      settings,
    });
  };

  // -------------------------------------------------------------
  // ADMIN GRADE CORRECTION / OVERRIDE (DÉROGATION ADMINISTRATIVE)
  // -------------------------------------------------------------
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctingReportCard, setCorrectingReportCard] = useState<StudentReportCard | null>(null);
  const [correctionScoresMap, setCorrectionScoresMap] = useState<
    Record<string, { cc1: string; cc2: string; cc3: string; activities: string; comment: string }>
  >({});
  const [correctionReason, setCorrectionReason] = useState('Correction d’erreur matérielle de saisie enseignant');
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);

  const handleOpenAdminCorrection = (rc: StudentReportCard) => {
    setCorrectingReportCard(rc);
    const initialMap: Record<string, { cc1: string; cc2: string; cc3: string; activities: string; comment: string }> = {};
    rc.subjects.forEach((sub) => {
      initialMap[sub.subject_id] = {
        cc1: sub.scores.cc1 !== null && sub.scores.cc1 !== undefined ? String(sub.scores.cc1) : '',
        cc2: sub.scores.cc2 !== null && sub.scores.cc2 !== undefined ? String(sub.scores.cc2) : '',
        cc3: sub.scores.cc3 !== null && sub.scores.cc3 !== undefined ? String(sub.scores.cc3) : '',
        activities: sub.scores.activities !== null && sub.scores.activities !== undefined ? String(sub.scores.activities) : '',
        comment: sub.appreciation || '',
      };
    });
    setCorrectionScoresMap(initialMap);
    setCorrectionReason('Correction d’erreur matérielle de saisie enseignant');
    setIsCorrectionModalOpen(true);
  };

  const handleSaveAdminCorrection = async () => {
    if (!correctingReportCard || isTeacher) return;
    setIsSavingCorrection(true);
    try {
      const studentId = correctingReportCard.student_id;
      const classId = correctingReportCard.class_id;
      const semester = correctingReportCard.semester;

      const newEvalsToUpsert: Evaluation[] = [];
      const newGradesToUpsert: Grade[] = [];

      const evalTypes: EvaluationType[] = ['CC1', 'CC2', 'CC3', 'ACTIVITIES'];

      subjects.forEach((sub) => {
        const subData = correctionScoresMap[sub.id];
        if (!subData) return;

        evalTypes.forEach((type) => {
          const rawScore =
            type === 'CC1'
              ? subData.cc1
              : type === 'CC2'
              ? subData.cc2
              : type === 'CC3'
              ? subData.cc3
              : subData.activities;

          if (rawScore !== '') {
            const evalId = `eval-${classId}-${sub.id}-${semester}-${type}`;
            const evalTypeObj = EVALUATION_TYPES.find((t) => t.type === type);

            const evalObj: Evaluation = {
              id: evalId,
              class_id: classId,
              subject_id: sub.id,
              semester: semester,
              type: type,
              title: `${evalTypeObj?.labelFr || type} - ${sub.name}`,
              max_score: maxScale,
              coefficient: evalTypeObj?.defaultCoeff || 1,
              date: new Date().toISOString().split('T')[0],
              academic_year: settings.academic_year || '2025-2026',
            };
            newEvalsToUpsert.push(evalObj);

            const parsedScore = Math.min(maxScale, Math.max(0, parseFloat(rawScore)));
            const gradeObj: Grade = {
              id: `gr-${evalId}-${studentId}`,
              evaluation_id: evalId,
              student_id: studentId,
              score: isNaN(parsedScore) ? null : parsedScore,
              is_absent: false,
              comment: `[Admin: ${correctionReason}] ${subData.comment || ''}`.trim(),
            };
            newGradesToUpsert.push(gradeObj);
          }
        });
      });

      // Merge into local state
      const mergedEvals = [...evaluations];
      newEvalsToUpsert.forEach((ev) => {
        const idx = mergedEvals.findIndex((e) => e.id === ev.id);
        if (idx >= 0) mergedEvals[idx] = ev;
        else mergedEvals.push(ev);
      });

      const mergedGrades = [...grades];
      newGradesToUpsert.forEach((gr) => {
        const idx = mergedGrades.findIndex((g) => g.id === gr.id || (g.evaluation_id === gr.evaluation_id && g.student_id === gr.student_id));
        if (idx >= 0) mergedGrades[idx] = gr;
        else mergedGrades.push(gr);
      });

      setEvaluations(mergedEvals);
      setGrades(mergedGrades);

      if (typeof window !== 'undefined') {
        localStorage.setItem('gm_evaluations_cache_v1', JSON.stringify(mergedEvals));
        localStorage.setItem('gm_grades_cache_v1', JSON.stringify(mergedGrades));
      }

      // Upsert into Supabase
      const supabase = createClient();
      if (newEvalsToUpsert.length > 0) {
        await supabase.from('evaluations').upsert(newEvalsToUpsert, { onConflict: 'id' });
      }
      if (newGradesToUpsert.length > 0) {
        await supabase.from('grades').upsert(newGradesToUpsert, { onConflict: 'id' });
      }

      notify({
        title: dir === 'rtl' ? 'تم التعديل الإداري بنجاح 🛡️' : 'Rectification Enregistrée 🛡️',
        message: dir === 'rtl'
          ? `تم تصحيح نقط التلميذ (${correctingReportCard.student_name}) وتحديث المعدلات تلقائياً.`
          : `Les notes de ${correctingReportCard.student_name} ont été rectifiées avec succès.`,
        type: 'success',
      });

      setIsCorrectionModalOpen(false);
    } catch (err) {
      console.error(err);
      notify({
        title: 'Erreur',
        message: "Une erreur est survenue lors de l'enregistrement de la rectification.",
        type: 'danger',
      });
    } finally {
      setIsSavingCorrection(false);
    }
  };

  // Class Analytics KPI
  const classAvgScore = useMemo(() => {
    if (classReportCards.length === 0) return 0;
    const sum = classReportCards.reduce((acc, c) => acc + c.general_average, 0);
    return sum / classReportCards.length;
  }, [classReportCards]);

  const successRate = useMemo(() => {
    if (classReportCards.length === 0) return 0;
    const passed = classReportCards.filter((c) => c.general_average >= 10).length;
    return Math.round((passed / classReportCards.length) * 100);
  }, [classReportCards]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Container: Full Width Responsive Card */}
        <div className="w-full bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 transition-all">
          {/* Top Row: Full-width Title & Subtitle */}
          <div className="flex items-start sm:items-center gap-4 w-full">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/25 shrink-0 flex items-center justify-center">
              <Award className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {dir === 'rtl' ? 'النقط والمراقبة المستمرة وكشوف النقط' : 'Gestion des Notes & Bulletins Scolaires'}
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                  {isTeacher ? 'Espace Enseignant' : 'Officiel MEN'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                {dir === 'rtl'
                  ? 'إدخال نقط الفروض، المراقبة المستمرة، استخراج كشوف النقط الرسمية A4، وتتبع تطور مستوى التلاميذ.'
                  : 'Saisie des contrôles continus, calcul automatique des moyennes, impression des bulletins officiels et suivi de niveau.'}
              </p>
            </div>
          </div>

          {/* Bottom Row: Full-width Tab Switcher Hub */}
          <div className="w-full flex items-center p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('saisie')}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'saisie'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Edit2 className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{dir === 'rtl' ? '1. إدخال النقط' : '1. Saisie des Notes'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bulletins')}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'bulletins'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Printer className="w-4 h-4 text-sky-500 shrink-0" />
              <span>{dir === 'rtl' ? '2. كشوف النقط PDF' : '2. Bulletins PDF'}</span>
            </button>

            {!isTeacher && (
              <button
                type="button"
                onClick={() => setActiveTab('analyse')}
                className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'analyse'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{dir === 'rtl' ? '3. تحليل المستوى 🔒' : '3. Analyse & Bilan 🔒'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Filter Bar (Cycle ➔ Class ➔ Subject ➔ Semester ➔ Evaluation Type) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* 1. Cycle Filter Box */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
                <span>{dir === 'rtl' ? 'السلك التعليمي' : 'Cycle Scolaire'}</span>
              </label>
              <select
                value={selectedCycle}
                onChange={(e) => handleCycleChange(e.target.value as any)}
                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="ALL">{dir === 'rtl' ? '🌐 جميع الأسلاك (Tous)' : '🌐 Tous les Cycles'}</option>
                <option value="PRIMAIRE">{dir === 'rtl' ? '🎒 سلك الابتدائي (Primaire)' : '🎒 Primaire'}</option>
                <option value="COLLEGE">{dir === 'rtl' ? '🎓 سلك الإعدادي (Collège)' : '🎓 Collège'}</option>
                <option value="LYCEE">{dir === 'rtl' ? '🏛️ سلك التأهيلي (Lycée)' : '🏛️ Lycée'}</option>
                <option value="MATERNELLE">{dir === 'rtl' ? '🧸 سلك الأولي (Maternelle)' : '🧸 Maternelle'}</option>
              </select>
            </div>

            {/* 2. Class Filter Box */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-sky-500" />
                <span>{dir === 'rtl' ? 'القسم / الفوج' : 'Classe / Niveau'}</span>
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.level})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Subject Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                <span>{dir === 'rtl' ? 'المادة الدراسية' : 'Matière / Module'}</span>
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Semester Filter (Clean S1 & S2) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                <span>{dir === 'rtl' ? 'الدورة / الأسدوس' : 'Semestre Scolaire'}</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-50 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 h-11 items-center">
                <button
                  type="button"
                  onClick={() => setSelectedSemester('S1')}
                  className={`h-full rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
                    selectedSemester === 'S1'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={dir === 'rtl' ? 'الدورة الأولى (S1)' : 'Semestre 1 (S1)'}
                >
                  S1
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSemester('S2')}
                  className={`h-full rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
                    selectedSemester === 'S2'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={dir === 'rtl' ? 'الدورة الثانية (S2)' : 'Semestre 2 (S2)'}
                >
                  S2
                </button>
              </div>
            </div>

            {/* 5. Evaluation Type (For Tab 1) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>{dir === 'rtl' ? 'نوع الفرض / المراقبة' : "Type d'Évaluation"}</span>
              </label>
              <select
                value={selectedEvalType}
                onChange={(e) => setSelectedEvalType(e.target.value as EvaluationType)}
                className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {EVALUATION_TYPES.map((ev) => (
                  <option key={ev.type} value={ev.type}>
                    {dir === 'rtl' ? ev.labelAr : ev.labelFr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* TAB 1: GRILLE DE SAISIE DES NOTES                            */}
        {/* ============================================================= */}
        {activeTab === 'saisie' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={dir === 'rtl' ? 'بحث عن تلميذ أو رمز مسار...' : 'Chercher un élève...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {filteredClassStudents.length} élèves inscrits
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-nowrap">
                <button
                  type="button"
                  onClick={() => setIsMassarModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer hover:scale-105 whitespace-nowrap"
                  title="Importer directement les notes depuis le fichier officiel Massar Excel (.xlsx)"
                >
                  <Upload className="w-4 h-4 text-white shrink-0" />
                  <span>{dir === 'rtl' ? 'استيراد مسار' : 'Importer Massar'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveGrades}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer hover:scale-105 disabled:opacity-50 whitespace-nowrap"
                >
                  <Save className="w-4 h-4 shrink-0" />
                  <span>{isSaving ? (dir === 'rtl' ? 'حفظ...' : 'Enregistrement...') : (dir === 'rtl' ? 'حفظ النقط 💾' : 'Enregistrer 💾')}</span>
                </button>
              </div>
            </div>

            {/* Grades Spreadsheet Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs table-fixed min-w-[760px]">
                  <colgroup>
                    <col className="w-[5%]" />
                    <col className="w-[28%]" />
                    <col className="w-[14%]" />
                    <col className="w-[14%]" />
                    <col className="w-[14%]" />
                    <col className="w-[25%]" />
                  </colgroup>
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold uppercase">
                    <tr>
                      <th className="p-3.5 text-center">N°</th>
                      <th className="p-3.5">Élève</th>
                      <th className="p-3.5">Code Massar</th>
                      <th className="p-3.5 text-center">Note / {maxScale}</th>
                      <th className="p-3.5 text-center">Présence</th>
                      <th className="p-3.5">Appréciation / Remarque</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {filteredClassStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 font-bold text-xs">
                          Aucun élève trouvé dans cette classe.
                        </td>
                      </tr>
                    ) : (
                      filteredClassStudents.map((student, index) => {
                        const rowData = localGradesMap[student.id] || { score: '', is_absent: false, comment: '' };
                        const numScore = rowData.score !== '' ? parseFloat(rowData.score) : null;

                        let scoreBg = 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700';
                        if (rowData.is_absent) {
                          scoreBg = 'bg-rose-50 text-rose-600 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800';
                        } else if (numScore !== null) {
                          if (numScore < passThreshold) scoreBg = 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 font-black';
                          else if (numScore >= (isPrimaryClass ? 8.5 : 16)) scoreBg = 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 font-black';
                          else if (numScore >= (isPrimaryClass ? 7 : 14)) scoreBg = 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/40 font-bold';
                        }

                        return (
                          <tr key={student.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 text-center font-bold text-slate-400">{index + 1}</td>
                            <td className="p-3.5 font-bold text-slate-900 dark:text-white truncate">
                              {student.first_name} {student.last_name}
                            </td>
                            <td className="p-3.5 font-mono font-bold text-slate-600 dark:text-slate-300 text-[11px]">
                              {resolveStudentMassarCode(student)}
                            </td>

                            {/* Score Input */}
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={maxScale}
                                  step="0.25"
                                  disabled={rowData.is_absent}
                                  placeholder={rowData.is_absent ? 'ABS' : `— / ${maxScale}`}
                                  value={rowData.is_absent ? '' : rowData.score}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setLocalGradesMap((prev) => ({
                                      ...prev,
                                      [student.id]: {
                                        ...prev[student.id],
                                        score: val,
                                      },
                                    }));
                                  }}
                                  className={`w-24 text-center px-2 py-1.5 rounded-xl border text-xs font-black focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs transition-all ${scoreBg}`}
                                />
                              </div>
                            </td>

                            {/* Absent Toggle */}
                            <td className="p-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setLocalGradesMap((prev) => ({
                                    ...prev,
                                    [student.id]: {
                                      ...prev[student.id],
                                      is_absent: !prev[student.id]?.is_absent,
                                      score: !prev[student.id]?.is_absent ? '' : prev[student.id]?.score,
                                    },
                                  }));
                                }}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                                  rowData.is_absent
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200'
                                }`}
                              >
                                {rowData.is_absent ? 'Absent 🔴' : 'Présent 🟢'}
                              </button>
                            </td>

                            {/* Appreciation */}
                            <td className="p-3.5">
                              <input
                                type="text"
                                placeholder="Appréciation..."
                                value={rowData.comment}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalGradesMap((prev) => ({
                                    ...prev,
                                    [student.id]: {
                                      ...prev[student.id],
                                      comment: val,
                                    },
                                  }));
                                }}
                                className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
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

        {/* ============================================================= */}
        {/* TAB 2: BULLETINS SCOLAIRES PDF & CLASSEMENT                   */}
        {/* ============================================================= */}
        {activeTab === 'bulletins' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {dir === 'rtl' ? 'كشوف النقط الرسمية للقسم' : 'Bulletins Scolaires Consolidés'} &bull; {activeClass?.name} ({selectedSemester})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Moyennes générales calculées avec coefficients, classement officiel et mention de conseil de classe.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintAllClassBulletins}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer hover:scale-105"
                >
                  <Printer className="w-4 h-4" />
                  <span>{dir === 'rtl' ? 'طباعة جميع كشوف القسم (دفعة واحدة) 🖨️' : 'Imprimer Tous les Bulletins de la Classe (Lot) 🖨️'}</span>
                </button>
              </div>
            </div>

            {/* Consolidated Report Cards Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs table-fixed min-w-[760px]">
                  <colgroup>
                    <col className="w-[8%]" />
                    <col className="w-[28%]" />
                    <col className="w-[14%]" />
                    <col className="w-[14%]" />
                    <col className="w-[18%]" />
                    <col className="w-[18%]" />
                  </colgroup>
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold uppercase">
                    <tr>
                      <th className="p-3.5 text-center">Rang</th>
                      <th className="p-3.5">Élève</th>
                      <th className="p-3.5">Code Massar</th>
                      <th className="p-3.5 text-center">Moyenne Générale</th>
                      <th className="p-3.5 text-center">Décision / Mention</th>
                      <th className="p-3.5 text-right">Action PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {classReportCards.map((rc) => {
                      let badge = 'bg-slate-100 text-slate-700';
                      let label = 'Passable';
                      if (rc.general_average >= (isPrimaryClass ? 9.0 : 16)) {
                        badge = 'bg-emerald-100 text-emerald-800 font-black';
                        label = 'Très Bien 🌟';
                      } else if (rc.general_average >= (isPrimaryClass ? 8.0 : 14)) {
                        badge = 'bg-sky-100 text-sky-800 font-bold';
                        label = 'Bien 🎖️';
                      } else if (rc.general_average >= (isPrimaryClass ? 7.0 : 12)) {
                        badge = 'bg-indigo-100 text-indigo-800 font-bold';
                        label = 'Assez Bien 👏';
                      } else if (rc.general_average < passThreshold) {
                        badge = 'bg-rose-100 text-rose-800 font-black';
                        label = 'Insuffisant ⚠️';
                      }

                      return (
                        <tr key={rc.student_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-3.5 text-center font-black">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold text-xs">
                              {rc.rank}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold text-slate-900 dark:text-white truncate">
                            {rc.student_name}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-slate-600 dark:text-slate-300 text-[11px]">
                            {resolveStudentMassarCode(rc as any)}
                          </td>
                          <td className="p-3.5 text-center font-black text-sm">
                            <span className={rc.general_average >= passThreshold ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}>
                              {rc.general_average.toFixed(2)} / {maxScale}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-xl text-[11px] ${badge}`}>
                              {label}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isTeacher && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAdminCorrection(rc)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-200 dark:border-amber-800 cursor-pointer shadow-2xs transition-all"
                                  title="Correction administrative de la note (Erreur enseignant)"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{dir === 'rtl' ? 'تعديل 🛡️' : 'Rectifier 🛡️'}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handlePrintSingleBulletin(rc.student_id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-bold text-xs border border-sky-200 dark:border-sky-800 cursor-pointer shadow-2xs transition-all"
                              >
                                <Printer className="w-3.5 h-3.5 text-sky-600" />
                                <span>{dir === 'rtl' ? 'كشف النقط PDF' : 'Bulletin PDF'}</span>
                              </button>
                            </div>
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

        {/* ============================================================= */}
        {/* TAB 3: ANALYSE DU NIVEAU & SUIVI PÉDAGOGIQUE                  */}
        {/* ============================================================= */}
        {activeTab === 'analyse' && !isTeacher && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase">Taux de Réussite (≥ {passThreshold}/{maxScale})</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{classPassRate}%</div>
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 shrink-0">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase">Moyenne Générale de la Classe</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{classAverage.toFixed(2)} / {maxScale}</div>
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase">Effectif Évalué</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{classReportCards.length} élèves</div>
                </div>
              </div>
            </div>

            {/* Top Students vs Students needing support */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Students */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span>{dir === 'rtl' ? 'المتفوقون ولوحة الشرف 🌟' : 'Tableau d’Honneur & Meilleurs Résultats 🌟'}</span>
                </div>
                <div className="space-y-2">
                  {classReportCards.slice(0, 5).map((rc) => (
                    <div key={rc.student_id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center font-black text-xs">
                          {rc.rank}
                        </span>
                        <span className="font-bold text-xs text-slate-900 dark:text-white">{rc.student_name}</span>
                      </div>
                      <span className="font-black text-xs text-emerald-600 dark:text-emerald-400">
                        {rc.general_average.toFixed(2)} / {maxScale}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Students Needing Academic Support */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                  <span>{dir === 'rtl' ? 'تلاميذ بحاجة لدعم وتقوية مدرسي ⚠️' : 'Élèves Nécessitant un Soutien Scolaire ⚠️'}</span>
                </div>
                <div className="space-y-2">
                  {classReportCards.filter((rc) => rc.general_average < passThreshold).length === 0 ? (
                    <div className="p-6 text-center text-xs text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl">
                      🎉 Félicitations ! Aucun élève n’est en situation de difficulté majeure dans cette classe.
                    </div>
                  ) : (
                    classReportCards
                      .filter((rc) => rc.general_average < passThreshold)
                      .map((rc) => (
                        <div key={rc.student_id} className="flex items-center justify-between p-3 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">{rc.student_name}</span>
                          <span className="font-black text-xs text-rose-600">
                            {rc.general_average.toFixed(2)} / {maxScale} (Soutien Recommandé)
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>

            {/* ============================================================= */}
            {/* INDIVIDUAL STUDENT EVOLUTION & PROGRESSION TREND SECTION       */}
            {/* ============================================================= */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              {/* Section Header & Student Selector */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {dir === 'rtl' ? 'منحنى تطور مستوى التلميذ ومسار الفروض 📈' : 'Analyse de Progression & Évolution Individuelle 📈'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {dir === 'rtl'
                        ? 'تتبع المسار التصاعدي أو التنازلي للتلميذ عبر الفروض والمراقبة المستمرة مقارنة بالمعدل العام للقسم.'
                        : 'Visualisation de la courbe d’évolution (en hausse ou en baisse) par rapport à la moyenne de la classe.'}
                    </p>
                  </div>
                </div>

                {/* Student Selector */}
                <div className="w-full md:w-72 shrink-0">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {dir === 'rtl' ? 'اختر تلميذاً للتحليل :' : 'Sélectionner un élève :'}
                  </label>
                  <select
                    value={activeStudentForAnalysis?.id || ''}
                    onChange={(e) => setSelectedStudentForAnalysis(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    {classStudents.map((s) => {
                      const rc = classReportCards.find((r) => r.student_id === s.id);
                      return (
                        <option key={s.id} value={s.id}>
                          {s.first_name} {s.last_name} {rc ? `(${rc.general_average.toFixed(2)}/${maxScale})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Student Diagnostic Banner */}
              {activeStudentForAnalysis && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Student Summary Profile */}
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">Élève Sélectionné</div>
                      <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                        {activeStudentForAnalysis.first_name} {activeStudentForAnalysis.last_name}
                      </div>
                      <div className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400 mt-0.5">
                        {resolveStudentMassarCode(activeStudentForAnalysis)}
                      </div>
                    </div>
                    {activeStudentReportCard && (
                      <div className="text-right">
                        <div className="text-xl font-black text-amber-600 dark:text-amber-400">
                          {activeStudentReportCard.general_average.toFixed(2)} <span className="text-xs text-slate-400">/ {maxScale}</span>
                        </div>
                        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Rang : {activeStudentReportCard.rank}e / {classStudents.length}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Trend Indicator (Progression vs Régression) */}
                  <div className={`col-span-1 lg:col-span-2 p-5 rounded-2xl border flex items-start gap-4 transition-all ${
                    studentProgressionTrend.status === 'UP'
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                      : studentProgressionTrend.status === 'DOWN'
                      ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60'
                      : 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/60'
                  }`}>
                    <div className={`p-3 rounded-xl shrink-0 ${
                      studentProgressionTrend.status === 'UP'
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                        : studentProgressionTrend.status === 'DOWN'
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                        : 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    }`}>
                      {studentProgressionTrend.status === 'UP' ? (
                        <TrendingUp className="w-5 h-5" />
                      ) : studentProgressionTrend.status === 'DOWN' ? (
                        <TrendingDown className="w-5 h-5" />
                      ) : (
                        <Award className="w-5 h-5" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black uppercase tracking-wider ${
                          studentProgressionTrend.status === 'UP'
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : studentProgressionTrend.status === 'DOWN'
                            ? 'text-rose-700 dark:text-rose-300'
                            : 'text-sky-700 dark:text-sky-300'
                        }`}>
                          {dir === 'rtl' ? 'تشخيص المسار والمستوى :' : 'Diagnostic d’Évolution :'}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                          studentProgressionTrend.status === 'UP'
                            ? 'bg-emerald-200/60 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                            : studentProgressionTrend.status === 'DOWN'
                            ? 'bg-rose-200/60 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                            : 'bg-sky-200/60 text-sky-800 dark:bg-sky-900 dark:text-sky-200'
                        }`}>
                          {dir === 'rtl' ? studentProgressionTrend.titleAr : studentProgressionTrend.titleFr}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        {dir === 'rtl' ? studentProgressionTrend.descAr : studentProgressionTrend.descFr}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Charts (Line Chart for Controls + Bar Chart for Subjects) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                {/* Chart 1: Evolution over Controls (CC1, CC2, CC3, Activités) */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-amber-500" />
                        <span>{dir === 'rtl' ? 'منحنى تطور النقط عبر الفروض' : 'Évolution par Contrôle Continu'}</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {dir === 'rtl' ? 'مقارنة نقط التلميذ مع المعدل المرجعي للقسم' : 'Comparaison de l’élève avec la moyenne de classe'}
                      </p>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={studentEvolutionData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} fontWeight="bold" />
                        <YAxis domain={[0, maxScale]} stroke="#64748b" fontSize={11} fontWeight="bold" />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderRadius: '12px',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: 'bold',
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          height={32}
                          wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                        />
                        <ReferenceLine y={passThreshold} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: `Seuil ${passThreshold}/${maxScale}`, fill: '#f43f5e', fontSize: 10 }} />
                        <Line
                          type="monotone"
                          dataKey="studentScore"
                          name={activeStudentForAnalysis ? `${activeStudentForAnalysis.first_name}` : 'Élève'}
                          stroke={studentProgressionTrend.status === 'UP' ? '#10b981' : studentProgressionTrend.status === 'DOWN' ? '#f43f5e' : '#f59e0b'}
                          strokeWidth={3.5}
                          dot={{ r: 6, fill: '#ffffff', strokeWidth: 3 }}
                          activeDot={{ r: 8 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="classBenchmark"
                          name="Moyenne Classe"
                          stroke="#94a3b8"
                          strokeDasharray="4 4"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Subject-by-Subject Breakdown */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
                        <Award className="w-4 h-4 text-sky-500" />
                        <span>{dir === 'rtl' ? 'توزيع النقط حسب المواد الدراسية' : 'Performance par Matière'}</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {dir === 'rtl' ? 'كشف المواد القوية والمواد التي تحتاج لدعم' : 'Matières fortes vs matières à consolider'}
                      </p>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    {studentSubjectBreakdown.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs font-bold text-slate-400">
                        Aucune note de matière enregistrée pour le moment.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={studentSubjectBreakdown} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={10} angle={-25} textAnchor="end" interval={0} />
                          <YAxis domain={[0, maxScale]} stroke="#64748b" fontSize={11} fontWeight="bold" />
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderRadius: '12px',
                              border: 'none',
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: 'bold',
                            }}
                          />
                          <ReferenceLine y={passThreshold} stroke="#f43f5e" strokeDasharray="3 3" />
                          <Bar dataKey="average" name="Moyenne Matière" radius={[6, 6, 0, 0]}>
                            {studentSubjectBreakdown.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  entry.average < passThreshold
                                    ? '#f43f5e'
                                    : entry.average >= (isPrimaryClass ? 8.5 : 16)
                                    ? '#10b981'
                                    : entry.average >= (isPrimaryClass ? 7 : 14)
                                    ? '#0ea5e9'
                                    : '#6366f1'
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Massar Grades Import Modal */}
        <MassarGradesImportModal
          isOpen={isMassarModalOpen}
          onClose={() => setIsMassarModalOpen(false)}
          classes={classes}
          subjects={subjects}
          students={allStudents}
          onImportSuccess={handleMassarImportSuccess}
        />

        {/* ============================================================= */}
        {/* ADMIN GRADE CORRECTION / OVERRIDE MODAL (DÉROGATION)          */}
        {/* ============================================================= */}
        {isCorrectionModalOpen && correctingReportCard && !isTeacher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Edit2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900 dark:text-white">
                        {dir === 'rtl' ? 'تصحيح وتعديل استثنائي للنقط (الإدارة)' : 'Rectification Administrative des Notes'}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {dir === 'rtl' ? 'صلاحية الإدارة 🛡️' : 'Réservé Direction 🛡️'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Élève : <strong className="text-slate-900 dark:text-white">{correctingReportCard.student_name}</strong> &bull; Classe : <strong>{correctingReportCard.class_name}</strong> &bull; Code Massar : <strong className="font-mono text-sky-600">{resolveStudentMassarCode(correctingReportCard as any)}</strong>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body: Editable Subjects & Controls Spreadsheet */}
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
                {/* Reason Banner */}
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
                  <label className="block text-[11px] font-black text-amber-900 dark:text-amber-200 uppercase mb-1">
                    {dir === 'rtl' ? 'سبب / مبرر التعديل الإداري (Motif de Rectification) :' : 'Motif & Justification de la Rectification :'}
                  </label>
                  <input
                    type="text"
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="Ex: Correction d'erreur matérielle de saisie par l'enseignant..."
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Subjects Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold uppercase">
                      <tr>
                        <th className="p-3">Matière</th>
                        <th className="p-3 text-center">CC 1 (/{maxScale})</th>
                        <th className="p-3 text-center">CC 2 (/{maxScale})</th>
                        <th className="p-3 text-center">CC 3 (/{maxScale})</th>
                        <th className="p-3 text-center">Activités (/{maxScale})</th>
                        <th className="p-3">Remarque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {subjects.map((sub) => {
                        const rowData = correctionScoresMap[sub.id] || { cc1: '', cc2: '', cc3: '', activities: '', comment: '' };
                        return (
                          <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-3 font-bold text-slate-900 dark:text-white">
                              {sub.name}
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max={maxScale}
                                step="0.25"
                                placeholder="—"
                                value={rowData.cc1}
                                onChange={(e) =>
                                  setCorrectionScoresMap((prev) => ({
                                    ...prev,
                                    [sub.id]: { ...prev[sub.id], cc1: e.target.value },
                                  }))
                                }
                                className="w-16 text-center px-1.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black focus:ring-2 focus:ring-amber-500"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max={maxScale}
                                step="0.25"
                                placeholder="—"
                                value={rowData.cc2}
                                onChange={(e) =>
                                  setCorrectionScoresMap((prev) => ({
                                    ...prev,
                                    [sub.id]: { ...prev[sub.id], cc2: e.target.value },
                                  }))
                                }
                                className="w-16 text-center px-1.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black focus:ring-2 focus:ring-amber-500"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max={maxScale}
                                step="0.25"
                                placeholder="—"
                                value={rowData.cc3}
                                onChange={(e) =>
                                  setCorrectionScoresMap((prev) => ({
                                    ...prev,
                                    [sub.id]: { ...prev[sub.id], cc3: e.target.value },
                                  }))
                                }
                                className="w-16 text-center px-1.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black focus:ring-2 focus:ring-amber-500"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max={maxScale}
                                step="0.25"
                                placeholder="—"
                                value={rowData.activities}
                                onChange={(e) =>
                                  setCorrectionScoresMap((prev) => ({
                                    ...prev,
                                    [sub.id]: { ...prev[sub.id], activities: e.target.value },
                                  }))
                                }
                                className="w-16 text-center px-1.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black focus:ring-2 focus:ring-amber-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="Remarque..."
                                value={rowData.comment}
                                onChange={(e) =>
                                  setCorrectionScoresMap((prev) => ({
                                    ...prev,
                                    [sub.id]: { ...prev[sub.id], comment: e.target.value },
                                  }))
                                }
                                className="w-full px-2 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-amber-500"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 sm:p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/30">
                <button
                  type="button"
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="px-4 py-2 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {dir === 'rtl' ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAdminCorrection}
                  disabled={isSavingCorrection}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/25 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingCorrection ? (dir === 'rtl' ? 'جاري الحفظ...' : 'Enregistrement...') : (dir === 'rtl' ? 'تأكيد التعديل الإداري 💾' : 'Valider & Mettre à Jour 💾')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
