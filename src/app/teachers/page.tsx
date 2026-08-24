'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { Teacher, TeacherContractType, TeacherAvailabilitySlot, Subject } from '@/types/database';
import { useConfirm, useNotify } from '@/lib/modal-service';
import { logAuditEvent } from '@/lib/audit';

import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  BookOpen,
  Trash2,
  Edit2,
  X,
  Clock,
  Briefcase,
  Layers,
  GraduationCap,
  Calendar,
  CalendarDays,
  MoreVertical,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

export interface LevelGroup {
  cycle: string;
  name: string;
  levels: Array<{ value: string; label: string; short: string }>;
}

export const TEACHING_CYCLES: LevelGroup[] = [
  {
    cycle: 'Maternelle (Préscolaire)',
    name: 'Maternelle',
    levels: [
      { value: 'TPS', label: 'TPS', short: 'TPS' },
      { value: 'PS', label: 'PS', short: 'PS' },
      { value: 'MS', label: 'MS', short: 'MS' },
      { value: 'GS', label: 'GS', short: 'GS' },
    ],
  },
  {
    cycle: 'Enseignement Primaire',
    name: 'Primaire',
    levels: [
      { value: 'CP', label: 'CP', short: 'CP' },
      { value: 'CE1', label: 'CE1', short: 'CE1' },
      { value: 'CE2', label: 'CE2', short: 'CE2' },
      { value: 'CM1', label: 'CM1', short: 'CM1' },
      { value: 'CM2', label: 'CM2', short: 'CM2' },
      { value: 'CE6', label: 'CE6', short: 'CE6' },
    ],
  },
  {
    cycle: 'Enseignement Collégial (Collège)',
    name: 'Collège',
    levels: [
      { value: '1AC', label: '1AC', short: '1AC' },
      { value: '2AC', label: '2AC', short: '2AC' },
      { value: '3AC', label: '3AC', short: '3AC' },
    ],
  },
  {
    cycle: 'Enseignement Secondaire (Lycée)',
    name: 'Lycée',
    levels: [
      { value: 'Tronc Commun Sciences', label: 'TC Sciences', short: 'TCS' },
      { value: 'Tronc Commun Lettres', label: 'TC Lettres', short: 'TCL' },
      { value: 'Tronc Commun Technologie', label: 'TC Tech', short: 'TCT' },
      { value: '1ère Bac Sciences Exp', label: '1Bac ScExp', short: '1Bac-ScExp' },
      { value: '1ère Bac Sciences Math', label: '1Bac SM', short: '1Bac-SM' },
      { value: '1ère Bac Économie', label: '1Bac Eco', short: '1Bac-Eco' },
      { value: '1ère Bac Lettres', label: '1Bac L', short: '1Bac-L' },
      { value: '2ème Bac PC', label: '2Bac PC', short: '2Bac-PC' },
      { value: '2ème Bac SVT', label: '2Bac SVT', short: '2Bac-SVT' },
      { value: '2ème Bac SM', label: '2Bac SM', short: '2Bac-SM' },
      { value: '2ème Bac Économie', label: '2Bac Eco', short: '2Bac-Eco' },
      { value: '2ème Bac Lettres', label: '2Bac L', short: '2Bac-L' },
    ],
  },
];

const MOROCCAN_DAYS = [
  { id: 1, name: 'Lundi', short: 'Lun' },
  { id: 2, name: 'Mardi', short: 'Mar' },
  { id: 3, name: 'Mercredi', short: 'Mer' },
  { id: 4, name: 'Jeudi', short: 'Jeu' },
  { id: 5, name: 'Vendredi', short: 'Ven', isHalfDay: true },
];

const MOROCCAN_55MIN_PERIODS = [
  { id: 'P1', start: '08:30', end: '09:25', label: '08h30 — 09h25', tag: 'Matin' },
  { id: 'P2', start: '09:25', end: '10:20', label: '09h25 — 10h20', tag: 'Matin' },
  { id: 'P3', start: '10:30', end: '11:25', label: '10h30 — 11h25', tag: 'Matin' },
  { id: 'P4', start: '11:25', end: '12:20', label: '11h25 — 12h20', tag: 'Matin' },
  { id: 'P5', start: '13:00', end: '13:55', label: '13h00 — 13h55', tag: 'Après-midi', notOnFriday: true },
  { id: 'P6', start: '14:00', end: '14:55', label: '14h00 — 14h55', tag: 'Après-midi', notOnFriday: true },
  { id: 'P7', start: '15:05', end: '16:00', label: '15h05 — 16h00', tag: 'Après-midi', notOnFriday: true },
];

export default function TeachersPage() {
  const { t, dir } = useI18n();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; level: string; group_name?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PLEIN_TEMPS' | 'VACATAIRE'>('ALL');
  const [selectedCycleFilter, setSelectedCycleFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    teacher_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    specialization: 'Mathématiques',
    contract_type: 'PLEIN_TEMPS' as TeacherContractType,
    teaching_levels: [] as string[],
    teaching_groups: [] as string[],
    weekly_hours_target: 24,
    availability: [] as TeacherAvailabilitySlot[],
  });

  const confirm = useConfirm();
  const notify = useNotify();

  async function loadTeachers() {
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: tchs, error: tchErr }, { data: sbjs, error: sbjErr }, { data: cls, error: clsErr }] = await Promise.all([
        supabase.from('teachers').select('*').order('last_name'),
        supabase.from('subjects').select('*').order('name'),
        supabase.from('classes').select('id, name, level, group_name').order('name'),
      ]);
      if (tchs) setTeachers(tchs);
      if (sbjs) setSubjects(sbjs);
      if (cls) setClasses(cls);
      if (tchErr) console.error(tchErr);
      if (sbjErr) console.error(sbjErr);
      if (clsErr) console.error(clsErr);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTeachers();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      teacher_code: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      specialization: subjects.length > 0 ? subjects[0].name : 'Mathématiques',
      contract_type: 'PLEIN_TEMPS',
      teaching_levels: ['CP', 'CE1', 'CE2', 'CM1', 'CM2', 'CE6'], // Default to Primary or clean selection
      teaching_groups: [],
      weekly_hours_target: 24,
      availability: [],
    });
    setShowModal(true);
  };

  const openEditModal = (tch: Teacher) => {
    setEditingId(tch.id);
    const existingAvailability = Array.isArray(tch.availability) ? (tch.availability as TeacherAvailabilitySlot[]) : [];
    const existingLevels = Array.isArray(tch.teaching_levels) ? tch.teaching_levels : [];
    const existingGroups = Array.isArray(tch.teaching_groups) ? tch.teaching_groups : [];
    setFormData({
      teacher_code: tch.teacher_code || '',
      first_name: tch.first_name || '',
      last_name: tch.last_name || '',
      email: tch.email || '',
      phone: tch.phone || '',
      specialization: tch.specialization || (subjects.length > 0 ? subjects[0].name : 'Mathématiques'),
      contract_type: (tch.contract_type as TeacherContractType) || 'PLEIN_TEMPS',
      teaching_levels: existingLevels,
      teaching_groups: existingGroups,
      weekly_hours_target: tch.weekly_hours_target || (tch.contract_type === 'VACATAIRE' ? 10 : 24),
      availability: existingAvailability,
    });
    setShowModal(true);
  };

  // Toggle single level selection
  const toggleLevel = (lvlValue: string) => {
    setFormData((prev) => {
      const exists = prev.teaching_levels.includes(lvlValue);
      if (exists) {
        return { ...prev, teaching_levels: prev.teaching_levels.filter((l) => l !== lvlValue) };
      } else {
        return { ...prev, teaching_levels: [...prev.teaching_levels, lvlValue] };
      }
    });
  };

  // Toggle single group selection
  const toggleGroup = (grpName: string) => {
    setFormData((prev) => {
      const exists = prev.teaching_groups.includes(grpName);
      if (exists) {
        return { ...prev, teaching_groups: prev.teaching_groups.filter((g) => g !== grpName) };
      } else {
        return { ...prev, teaching_groups: [...prev.teaching_groups, grpName] };
      }
    });
  };

  // Select all or deselect all groups
  const selectAllGroups = (availableGrpList: string[]) => {
    setFormData((prev) => {
      const allSelected = availableGrpList.every((g) => prev.teaching_groups.includes(g));
      if (allSelected) {
        return { ...prev, teaching_groups: prev.teaching_groups.filter((g) => !availableGrpList.includes(g)) };
      } else {
        const set = new Set([...prev.teaching_groups, ...availableGrpList]);
        return { ...prev, teaching_groups: Array.from(set) };
      }
    });
  };

  // Toggle all levels in a specific cycle
  const toggleEntireCycle = (cycleObj: LevelGroup) => {
    const cycleLevelValues = cycleObj.levels.map((l) => l.value);
    const allSelected = cycleLevelValues.every((val) => formData.teaching_levels.includes(val));

    if (allSelected) {
      // Unselect all of this cycle
      setFormData((prev) => ({
        ...prev,
        teaching_levels: prev.teaching_levels.filter((l) => !cycleLevelValues.includes(l)),
      }));
    } else {
      // Add all missing levels of this cycle
      const set = new Set([...formData.teaching_levels, ...cycleLevelValues]);
      setFormData((prev) => ({
        ...prev,
        teaching_levels: Array.from(set),
      }));
    }
  };

  const relevantClasses = useMemo(() => {
    if (formData.teaching_levels.length === 0) return classes;
    return classes.filter((cls) => formData.teaching_levels.includes(cls.level));
  }, [classes, formData.teaching_levels]);

  const toggleSlotAvailability = (dayId: number, period: typeof MOROCCAN_55MIN_PERIODS[0]) => {
    const isAlreadySelected = formData.availability.some(
      (s) => s.day_of_week === dayId && (s.period_id === period.id || s.start_time === period.start)
    );

    if (isAlreadySelected) {
      setFormData((prev) => ({
        ...prev,
        availability: prev.availability.filter(
          (s) => !(s.day_of_week === dayId && (s.period_id === period.id || s.start_time === period.start))
        ),
      }));
    } else {
      const newSlot: TeacherAvailabilitySlot = {
        day_of_week: dayId,
        period_id: period.id,
        start_time: period.start,
        end_time: period.end,
      };
      setFormData((prev) => ({
        ...prev,
        availability: [...prev.availability, newSlot],
      }));
    }
  };

  const isSlotSelected = (dayId: number, periodId: string, startTime: string) => {
    return formData.availability.some(
      (s) => s.day_of_week === dayId && (s.period_id === periodId || s.start_time === startTime)
    );
  };

  const selectAllMornings = () => {
    const morningSlots: TeacherAvailabilitySlot[] = [];
    MOROCCAN_DAYS.forEach((day) => {
      MOROCCAN_55MIN_PERIODS.slice(0, 4).forEach((period) => {
        morningSlots.push({
          day_of_week: day.id,
          period_id: period.id,
          start_time: period.start,
          end_time: period.end,
        });
      });
    });
    setFormData((prev) => ({ ...prev, availability: morningSlots }));
  };

  const selectAllAfternoons = () => {
    const afternoonSlots: TeacherAvailabilitySlot[] = [];
    MOROCCAN_DAYS.slice(0, 4).forEach((day) => {
      MOROCCAN_55MIN_PERIODS.slice(4).forEach((period) => {
        afternoonSlots.push({
          day_of_week: day.id,
          period_id: period.id,
          start_time: period.start,
          end_time: period.end,
        });
      });
    });
    setFormData((prev) => ({ ...prev, availability: afternoonSlots }));
  };

  const clearAvailability = () => {
    setFormData((prev) => ({ ...prev, availability: [] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.contract_type === 'VACATAIRE' && formData.availability.length === 0) {
      notify({
        title: 'Disponibilité Obligatoire',
        message: 'Veuillez sélectionner au moins un créneau horaire disponible pour l\'enseignant vacataire.',
        type: 'warning',
      });
      return;
    }

    try {
      const supabase = createClient();
      const code = formData.teacher_code || `ENS-${Date.now().toString().slice(-3)}`;

      if (editingId) {
        // Update existing teacher
        const { error } = await supabase
          .from('teachers')
          .update({
            teacher_code: code,
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            specialization: formData.specialization,
            contract_type: formData.contract_type,
            teaching_levels: formData.teaching_levels,
            teaching_groups: formData.teaching_groups,
            weekly_hours_target: Number(formData.weekly_hours_target),
            availability: formData.contract_type === 'VACATAIRE' ? formData.availability : [],
          })
          .eq('id', editingId);

        if (error) {
          notify({ title: 'Erreur', message: error.message, type: 'danger' });
          return;
        }

        logAuditEvent({
          action: 'TEACHER_UPDATED',
          entity_type: 'teachers',
          entity_id: editingId,
          details: {
            name: `${formData.first_name} ${formData.last_name}`,
            specialization: formData.specialization,
            contract_type: formData.contract_type,
          },
        });

        notify({ title: 'Succès', message: 'Fiche enseignant modifiée avec succès !', type: 'success' });
      } else {
        // Create new teacher
        const { error } = await supabase.from('teachers').insert([
          {
            teacher_code: code,
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            specialization: formData.specialization,
            contract_type: formData.contract_type,
            teaching_levels: formData.teaching_levels,
            teaching_groups: formData.teaching_groups,
            weekly_hours_target: Number(formData.weekly_hours_target),
            availability: formData.contract_type === 'VACATAIRE' ? formData.availability : [],
            status: 'ACTIVE',
          },
        ]);

        if (error) {
          notify({ title: 'Erreur', message: error.message, type: 'danger' });
          return;
        }

        logAuditEvent({
          action: 'TEACHER_CREATED',
          entity_type: 'teachers',
          details: {
            name: `${formData.first_name} ${formData.last_name}`,
            specialization: formData.specialization,
            contract_type: formData.contract_type,
          },
        });

        notify({ title: 'Succès', message: 'Enseignant ajouté avec succès !', type: 'success' });
      }

      setShowModal(false);
      setEditingId(null);
      loadTeachers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const handleDelete = async (id: string, name?: string) => {
    const ok = await confirm({
      title: 'Supprimer l\'enseignant',
      message: name
        ? `Êtes-vous sûr de vouloir supprimer la fiche de "${name}" ? Cette action est irréversible.`
        : 'Voulez-vous supprimer cet enseignant ?',
      type: 'danger',
      confirmText: 'Supprimer définitivement',
      cancelText: 'Annuler',
    });
    if (!ok) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.from('teachers').delete().eq('id', id);
      if (error) {
        notify({ title: 'Erreur', message: error.message, type: 'danger' });
        return;
      }

      logAuditEvent({
        action: 'TEACHER_DELETED',
        entity_type: 'teachers',
        entity_id: id,
        details: { name: name || id },
      });

      notify({ title: 'Succès', message: 'Enseignant supprimé avec succès.', type: 'success' });
      loadTeachers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de suppression';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const levelsStr = Array.isArray(t.teaching_levels) ? t.teaching_levels.join(' ') : '';
      const matchesSearch = `${t.first_name} ${t.last_name} ${t.specialization || ''} ${t.email} ${t.teacher_code || ''} ${levelsStr}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (filterType === 'PLEIN_TEMPS' && t.contract_type === 'VACATAIRE') return false;
      if (filterType === 'VACATAIRE' && t.contract_type !== 'VACATAIRE') return false;

      if (selectedCycleFilter !== 'ALL') {
        const cycle = TEACHING_CYCLES.find((c) => c.name === selectedCycleFilter);
        if (cycle) {
          const cycleValues = cycle.levels.map((l) => l.value);
          const teacherLevels = Array.isArray(t.teaching_levels) ? t.teaching_levels : [];
          const hasOverlap = teacherLevels.some((lvl) => cycleValues.includes(lvl) || lvl.includes(cycle.name));
          if (!hasOverlap && teacherLevels.length > 0) return false;
        }
      }

      return true;
    });
  }, [teachers, searchTerm, filterType, selectedCycleFilter]);

  const pleinTempsCount = teachers.filter((t) => t.contract_type === 'PLEIN_TEMPS' || !t.contract_type).length;
  const vacataireCount = teachers.filter((t) => t.contract_type === 'VACATAIRE').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              <Users className="w-4 h-4" />
              {t('teachers')}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('teachers_page_title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {dir === 'rtl' ? 'توزيع مستويات التدريس (أولي، ابتدائي، إعدادي، ثانوي) وضبط الجداول الزمنية.' : "Affectez les niveaux d'enseignement (Maternelle, Primaire, Collège, Lycée) et les créneaux horaires."}
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t('add_teacher')}
          </button>
        </div>

        {/* Filter Pills & Search Bar */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-thin">
            <button
              onClick={() => {
                setFilterType('ALL');
                setSelectedCycleFilter('ALL');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                filterType === 'ALL' && selectedCycleFilter === 'ALL'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {t('all')} ({teachers.length})
            </button>

            {/* Cycle Filters */}
            {TEACHING_CYCLES.map((cycle) => (
              <button
                key={cycle.name}
                onClick={() => setSelectedCycleFilter(cycle.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCycleFilter === cycle.name
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 scale-105'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {dir === 'rtl'
                  ? cycle.name === 'Maternelle'
                    ? 'التعليم الأولي'
                    : cycle.name === 'Primaire'
                    ? 'الابتدائي'
                    : cycle.name === 'Collège'
                    ? 'الإعدادي'
                    : 'الثانوي والباكالوريا'
                  : cycle.name}
              </button>
            ))}

            <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

            <button
              onClick={() => setFilterType('PLEIN_TEMPS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'PLEIN_TEMPS'
                  ? 'bg-emerald-700 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              {dir === 'rtl' ? 'دوام كامل' : 'Plein Temps'} ({pleinTempsCount})
            </button>

            <button
              onClick={() => setFilterType('VACATAIRE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'VACATAIRE'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {dir === 'rtl' ? 'ساعات إضافية' : 'Vacataires'} ({vacataireCount})
            </button>
          </div>

          <div className="relative w-full lg:w-64">
            <Search className={`w-4 h-4 text-slate-400 absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2`} />
            <input
              type="text"
              placeholder={t('search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full ${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500`}
            />
          </div>
        </div>

        {/* Teachers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full py-12 text-center text-slate-400">
              {t('loading')}
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400">
              {t('no_data')}
            </div>
          ) : (
            filteredTeachers.map((tch) => {
              const isVacataire = tch.contract_type === 'VACATAIRE';
              const availabilityCount = Array.isArray(tch.availability) ? tch.availability.length : 0;
              const teacherLevels = Array.isArray(tch.teaching_levels) ? tch.teaching_levels : [];
              const teacherGroups = Array.isArray(tch.teaching_groups) ? tch.teaching_groups : [];

              return (
                <div
                  key={tch.id}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold flex items-center justify-center text-base shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                          {tch.first_name?.[0]}
                          {tch.last_name?.[0]}
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900 dark:text-white">
                            {tch.first_name} {tch.last_name}
                          </h3>
                          <span className="font-mono text-[10px] font-bold text-slate-400">
                            {tch.teacher_code}
                          </span>
                        </div>
                      </div>

                      {/* Contract Type Pill */}
                      {isVacataire ? (
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300/40 flex items-center gap-1 shadow-xs">
                          <Clock className="w-3 h-3 text-amber-500" />
                          {dir === 'rtl' ? 'ساعات إضافية' : 'Vacataire'}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40 flex items-center gap-1 shadow-xs">
                          <Briefcase className="w-3 h-3 text-emerald-500" />
                          {dir === 'rtl' ? 'دوام كامل' : 'Plein Temps'}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {tch.specialization}
                        </span>
                      </div>

                      {/* Teaching Levels Chips */}
                      <div className="flex items-start gap-2 pt-1">
                        <GraduationCap className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                        <div className="flex flex-wrap gap-1">
                          {teacherLevels.length === 0 ? (
                            <span className="text-[10px] text-slate-400 italic">{dir === 'rtl' ? 'جميع المستويات' : 'Tous niveaux'}</span>
                          ) : (
                            teacherLevels.map((lvl) => (
                              <span
                                key={lvl}
                                className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-300/40"
                              >
                                {lvl}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Teaching Groups & Classes Chips */}
                      {teacherGroups.length > 0 && (
                        <div className="flex items-start gap-2 pt-1">
                          <Users className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                          <div className="flex flex-wrap gap-1">
                            {teacherGroups.map((grp) => (
                              <span
                                key={grp}
                                className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300/40"
                              >
                                {grp}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{tch.email}</span>
                      </div>
                      {tch.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{tch.phone}</span>
                        </div>
                      )}

                      {/* Availability status line */}
                      <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">{dir === 'rtl' ? 'الحضور الأسبوعي :' : 'Présence :'}</span>
                        {isVacataire ? (
                          <strong className="text-amber-600 dark:text-amber-400 font-bold">
                            {availabilityCount} {dir === 'rtl' ? 'حصة (ساعة / أسبوع)' : 'séances (h / semaine)'}
                          </strong>
                        ) : (
                          <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {dir === 'rtl' ? 'كامل الأسبوع (دوام كامل)' : 'Toute la semaine (Plein Temps)'}
                          </strong>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">{t('actions')}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(tch)}
                        title={dir === 'rtl' ? 'تعديل الأستاذ والمستويات والتوقيت' : "Modifier l'enseignant, ses niveaux et ses disponibilités"}
                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-white rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(tch.id, `${tch.first_name} ${tch.last_name}`)}
                        title={dir === 'rtl' ? 'حذف الأستاذ' : 'Supprimer la fiche'}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Add/Edit Teacher */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-emerald-500/20 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingId ? 'Modifier la Fiche Enseignant' : 'Ajouter un Enseignant'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-5 mt-4">
                {/* Contract Type Selection Tabs */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Type de Contrat &bullet; Régime de Travail
                  </label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, contract_type: 'PLEIN_TEMPS' })}
                      className={`p-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        formData.contract_type === 'PLEIN_TEMPS'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 scale-[1.02]'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4" />
                        <span>Plein Temps (Permanent)</span>
                      </div>
                      <span className="text-[10px] font-normal opacity-80">Présent toute la semaine</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, contract_type: 'VACATAIRE' })}
                      className={`p-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        formData.contract_type === 'VACATAIRE'
                          ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 scale-[1.02]'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        <span>Vacataire (Temps Partiel)</span>
                      </div>
                      <span className="text-[10px] font-normal opacity-80">Heures spécifiques choisies</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Prénom
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nom de Famille
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>Matière Enseignée</span>
                      <Link href="/subjects" className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline">
                        + Matières
                      </Link>
                    </label>
                    <select
                      required
                      value={formData.specialization}
                      onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="">-- Sélectionner une matière --</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Email Professionnel
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="prof@gm-school.ma"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      placeholder="06 00 11 22 33"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* NIVEAUX D'ENSEIGNEMENT SECTION */}
                <div className="p-4 rounded-2xl bg-orange-50/40 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-orange-900 dark:text-orange-200">
                      <GraduationCap className="w-4 h-4 text-orange-500" />
                      <span>Niveaux Scolaires Enseignés (Affectation)</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {formData.teaching_levels.length} niveau(x) sélectionné(s)
                    </span>
                  </div>

                  {TEACHING_CYCLES.map((cycle) => {
                    const cycleLevelValues = cycle.levels.map((l) => l.value);
                    const allCycleSelected = cycleLevelValues.every((val) => formData.teaching_levels.includes(val));

                    return (
                      <div key={cycle.name} className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            {cycle.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleEntireCycle(cycle)}
                            className="text-[10px] font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                          >
                            {allCycleSelected ? 'Tout désélectionner' : `+ Tout ${cycle.name}`}
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {cycle.levels.map((lvl) => {
                            const isSelected = formData.teaching_levels.includes(lvl.value);
                            return (
                              <button
                                key={lvl.value}
                                type="button"
                                onClick={() => toggleLevel(lvl.value)}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs scale-105'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {isSelected ? '✓ ' : ''}
                                {lvl.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* GROUPES & CLASSES D'ENSEIGNEMENT SECTION */}
                <div className="p-4 rounded-2xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900 dark:text-purple-200">
                      <Users className="w-4 h-4 text-purple-500" />
                      <span>{dir === 'rtl' ? 'الأقسام والمجموعات المسندة (Groupes & Classes)' : 'Groupes & Classes Enseignés (Affectation)'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">
                        {formData.teaching_groups.length} {dir === 'rtl' ? 'مجموعة محددة' : 'groupe(s) sélectionné(s)'}
                      </span>
                      {relevantClasses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => selectAllGroups(relevantClasses.map((c) => c.name))}
                          className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                        >
                          {relevantClasses.every((c) => formData.teaching_groups.includes(c.name))
                            ? (dir === 'rtl' ? 'إلغاء التحديد' : 'Tout désélectionner')
                            : (dir === 'rtl' ? '+ تحديد كل الأقسام' : '+ Tout sélectionner')}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Specific Classes from database matching levels */}
                  {relevantClasses.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {dir === 'rtl' ? 'الأقسام الفعلية للمؤسسة :' : 'Classes réelles de l\'école :'}
                        </span>
                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                          {relevantClasses.length} {dir === 'rtl' ? 'قسم متوفر' : 'classe(s) disponible(s)'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {relevantClasses.map((cls) => {
                          const isSelected = formData.teaching_groups.includes(cls.name);
                          return (
                            <button
                              key={cls.id}
                              type="button"
                              onClick={() => toggleGroup(cls.name)}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs scale-105'
                                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {isSelected ? '✓ ' : ''}
                              {cls.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Quick Generic Group Presets */}
                  <div className="space-y-1.5 pt-2 border-t border-purple-100 dark:border-purple-900/40">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      {dir === 'rtl' ? 'تسميات المجموعات العامة (G1, G2, Groupe A...) :' : 'Groupes standards / sous-groupes TP :' }
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {['Groupe 1 (G1)', 'Groupe 2 (G2)', 'Groupe 3 (G3)', 'Groupe A', 'Groupe B', 'Groupe C', 'Tous les groupes (الجميع)'].map((preset) => {
                        const isSelected = formData.teaching_groups.includes(preset);
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => toggleGroup(preset)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs scale-105'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {isSelected ? '✓ ' : ''}
                            {preset}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* VACATAIRE AVAILABILITY SCHEDULE PICKER */}
                {formData.contract_type === 'VACATAIRE' && (
                  <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-3 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-amber-500" />
                          <span>Emploi du Temps des Disponibilités (Vacataire)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Cliquez sur les créneaux où ce professeur sera présent à l&apos;école.
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={selectAllMornings}
                          className="px-2.5 py-1 text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                        >
                          Matinées
                        </button>
                        <button
                          type="button"
                          onClick={selectAllAfternoons}
                          className="px-2.5 py-1 text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                        >
                          Après-midis
                        </button>
                        <button
                          type="button"
                          onClick={clearAvailability}
                          className="px-2.5 py-1 text-[10px] font-bold text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                        >
                          Effacer
                        </button>
                      </div>
                    </div>

                    {/* Weekly Availability Interactive Matrix */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <table className="w-full text-center border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                            <th className="p-2 text-left w-28">Créneau (55 min)</th>
                            {MOROCCAN_DAYS.map((day) => (
                              <th key={day.id} className="p-2">
                                {day.name} {day.isHalfDay ? '(Matin)' : ''}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {MOROCCAN_55MIN_PERIODS.map((period) => (
                            <tr key={period.id}>
                              <td className="p-2 text-left text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
                                {period.label}
                              </td>

                              {MOROCCAN_DAYS.map((day) => {
                                // Skip Friday afternoon
                                if (day.id === 5 && period.notOnFriday) {
                                  return (
                                    <td key={day.id} className="p-1 bg-slate-50/40 text-[9px] text-slate-400">
                                      Libre (Joumouaa)
                                    </td>
                                  );
                                }

                                const selected = isSlotSelected(day.id, period.id, period.start);

                                return (
                                  <td key={day.id} className="p-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleSlotAvailability(day.id, period)}
                                      className={`w-full py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                        selected
                                          ? 'bg-emerald-600 text-white shadow-xs scale-95 ring-2 ring-emerald-400'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                                      }`}
                                    >
                                      {selected ? '✓ Présent' : '—'}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200 pt-1">
                      <span>Total des créneaux sélectionnés :</span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100">
                        {formData.availability.length} séances &bull; {formData.availability.length}h / semaine
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
                  >
                    {editingId ? 'Enregistrer les Modifications' : 'Créer l\'Enseignant'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
