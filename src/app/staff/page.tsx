'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { StaffMember, StaffCategory, Teacher, Subject, TeacherContractType, TeacherAvailabilitySlot } from '@/types/database';
import { useI18n } from '@/lib/i18n';
import { useNotify, useConfirm } from '@/lib/modal-service';
import { logAuditEvent } from '@/lib/audit';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Phone,
  Mail,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Building2,
  GraduationCap,
  Sparkles,
  Shield,
  Truck,
  Briefcase,
  Calendar,
  Clock,
  Printer,
  FileSpreadsheet,
  Plus,
  X,
  UserCheck,
  Award,
  Layers,
  ChevronRight,
  MoreVertical,
  SlidersHorizontal,
  BookOpen
} from 'lucide-react';
import Link from 'next/link';

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

export type ActiveStaffTab =
  | 'ALL'
  | 'ENSEIGNANT'
  | 'DIRECTION_ADMIN'
  | 'DIRECTION_PEDAGOGIQUE'
  | 'STAFF_MENAGE'
  | 'TRANSPORTEUR'
  | 'SURVEILLANCE';

interface CategoryTabConfig {
  key: ActiveStaffTab;
  label: string;
  labelAr: string;
  icon: any;
  color: string;
  badgeBg: string;
  description: string;
}

export const STAFF_TAB_CONFIGS: CategoryTabConfig[] = [
  {
    key: 'ALL',
    label: 'Tout le Personnel',
    labelAr: 'جميع الموظفين',
    icon: Users,
    color: 'text-slate-700 dark:text-slate-200',
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    description: 'Vue globale sur l\'ensemble des effectifs de l\'établissement',
  },
  {
    key: 'ENSEIGNANT',
    label: 'Enseignants',
    labelAr: 'الأساتذة وهيئة التدريس',
    icon: GraduationCap,
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300',
    description: 'Corps professoral : Maternelle, Primaire, Collège et Lycée',
  },
  {
    key: 'DIRECTION_ADMIN',
    label: 'Direction Administrative',
    labelAr: 'الإدارة العامة والموارد البشرية',
    icon: Building2,
    color: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300',
    description: 'Secrétariat général, Ressources Humaines, Comptabilité & Finances',
  },
  {
    key: 'DIRECTION_PEDAGOGIQUE',
    label: 'Direction Pédagogique',
    labelAr: 'الإدارة التربوية والتنسيق',
    icon: Award,
    color: 'text-indigo-600 dark:text-indigo-400',
    badgeBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-300',
    description: 'Direction pédagogique, coordination des cycles & suivi scolaire',
  },
  {
    key: 'STAFF_MENAGE',
    label: 'Staff Ménage & Entretien',
    labelAr: 'أعوان النظافة والصيانة',
    icon: Sparkles,
    color: 'text-pink-600 dark:text-pink-400',
    badgeBg: 'bg-pink-100 text-pink-700 dark:bg-pink-950/80 dark:text-pink-300 border-pink-300',
    description: 'Agentes d\'entretien, hygiène, maintenance des locaux & installations',
  },
  {
    key: 'TRANSPORTEUR',
    label: 'Transporteurs & Chauffeurs',
    labelAr: 'سائقو النقل المدرسي',
    icon: Truck,
    color: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300',
    description: 'Chauffeurs de bus scolaires, accompagnatrices & gestion des circuits',
  },
  {
    key: 'SURVEILLANCE',
    label: 'Surveillance & Vie Scolaire',
    labelAr: 'الحراسة العامة والأمن',
    icon: Shield,
    color: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border-purple-300',
    description: 'Surveillants généraux, surveillants, vie scolaire, gardiens & sécurité',
  },
];

export default function StaffManagementPage() {
  const { t, dir } = useI18n();
  const notify = useNotify();
  const confirm = useConfirm();

  // Active Category Tab
  const [activeTab, setActiveTab] = useState<ActiveStaffTab>('ALL');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [contractFilter, setContractFilter] = useState<string>('ALL');

  // Staff & Teachers Data
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Create/Edit State for generic staff
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);

  // Dedicated Teacher Modal State
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [teacherFormData, setTeacherFormData] = useState({
    teacher_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    specialization: 'Anglais',
    contract_type: 'PLEIN_TEMPS' as TeacherContractType,
    teaching_levels: ['CP', 'CE1', 'CE2', 'CM1', 'CM2', 'CE6'] as string[],
    weekly_hours_target: 24,
    availability: [] as TeacherAvailabilitySlot[],
  });

  // Generic Staff Form State
  const [formData, setFormData] = useState({
    staff_code: '',
    first_name: '',
    last_name: '',
    category: 'DIRECTION_ADMIN' as StaffCategory,
    role_title: '',
    phone: '',
    email: '',
    contract_type: 'CDI',
    hire_date: new Date().toISOString().split('T')[0],
    is_active: true,
    specialization: '',
    notes: '',
  });

  // Fetch all staff members, teachers & subjects from Supabase
  const loadStaffData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      const [{ data: staffData, error: staffErr }, { data: teachersData, error: teachErr }, { data: sbjsData }] = await Promise.all([
        supabase.from('staff_members').select('*').order('created_at', { ascending: false }),
        supabase.from('teachers').select('*').order('last_name', { ascending: true }),
        supabase.from('subjects').select('*').order('name', { ascending: true }),
      ]);

      if (teachErr) console.warn('Teachers fetch notice:', teachErr.message);
      if (staffErr) console.warn('Staff fetch notice:', staffErr.message);

      if (teachersData) {
        setTeachersList(teachersData);
      }
      if (sbjsData) {
        setSubjects(sbjsData);
      }

      // Convert teachers to StaffMember objects
      const mappedTeachers: StaffMember[] = (teachersData || []).map((t) => ({
        id: t.id,
        staff_code: t.teacher_code || `ENS-${t.id.slice(0, 4).toUpperCase()}`,
        first_name: t.first_name,
        last_name: t.last_name,
        category: 'ENSEIGNANT' as StaffCategory,
        role_title: t.specialization ? `Enseignant (${t.specialization})` : 'Enseignant',
        phone: t.phone || '',
        email: t.email || '',
        contract_type: t.contract_type || 'Titulaire',
        is_active: t.status !== 'INACTIVE',
        specialization: t.specialization || '',
        created_at: t.created_at,
      }));

      // Combine both sources
      const combined = [...(staffData || []), ...mappedTeachers];
      setStaffList(combined);
    } catch (err) {
      console.error('Error loading staff data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaffData();
  }, [loadStaffData]);

  // Open Modal for New Staff Member or Teacher
  const handleOpenCreate = (preselectedCategory?: ActiveStaffTab) => {
    const cat = preselectedCategory && preselectedCategory !== 'ALL'
      ? (preselectedCategory as StaffCategory)
      : activeTab !== 'ALL'
      ? (activeTab as StaffCategory)
      : 'ENSEIGNANT';

    // If adding a teacher -> Open dedicated rich Teacher Modal
    if (cat === 'ENSEIGNANT') {
      setEditingTeacherId(null);
      setTeacherFormData({
        teacher_code: `ENS-${Math.floor(100 + Math.random() * 900)}`,
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        specialization: subjects[0]?.name || 'Anglais',
        contract_type: 'PLEIN_TEMPS',
        teaching_levels: ['CP', 'CE1', 'CE2', 'CM1', 'CM2', 'CE6'],
        weekly_hours_target: 24,
        availability: [],
      });
      setIsTeacherModalOpen(true);
      return;
    }

    // Otherwise -> Generic Staff Modal
    setEditingStaff(null);
    const prefixes: Record<string, string> = {
      DIRECTION_ADMIN: 'ADM',
      DIRECTION_PEDAGOGIQUE: 'PED',
      STAFF_MENAGE: 'ENT',
      TRANSPORTEUR: 'CHF',
      SURVEILLANCE: 'SUR',
    };
    const randNum = Math.floor(100 + Math.random() * 900);
    const generatedCode = `${prefixes[cat] || 'STF'}-${randNum}`;

    setFormData({
      staff_code: generatedCode,
      first_name: '',
      last_name: '',
      category: cat,
      role_title: '',
      phone: '',
      email: '',
      contract_type: 'CDI',
      hire_date: new Date().toISOString().split('T')[0],
      is_active: true,
      specialization: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (staff: StaffMember) => {
    if (staff.category === 'ENSEIGNANT') {
      const existingTeacher = teachersList.find((t) => t.id === staff.id);
      setEditingTeacherId(staff.id);
      setTeacherFormData({
        teacher_code: existingTeacher?.teacher_code || staff.staff_code || '',
        first_name: existingTeacher?.first_name || staff.first_name || '',
        last_name: existingTeacher?.last_name || staff.last_name || '',
        email: existingTeacher?.email || staff.email || '',
        phone: existingTeacher?.phone || staff.phone || '',
        specialization: existingTeacher?.specialization || staff.specialization || subjects[0]?.name || 'Anglais',
        contract_type: (existingTeacher?.contract_type as TeacherContractType) || 'PLEIN_TEMPS',
        teaching_levels: Array.isArray(existingTeacher?.teaching_levels) ? existingTeacher.teaching_levels : ['CP', 'CE1', 'CE2', 'CM1', 'CM2', 'CE6'],
        weekly_hours_target: existingTeacher?.weekly_hours_target || 24,
        availability: Array.isArray(existingTeacher?.availability) ? (existingTeacher.availability as TeacherAvailabilitySlot[]) : [],
      });
      setIsTeacherModalOpen(true);
      return;
    }

    setEditingStaff(staff);
    setFormData({
      staff_code: staff.staff_code || '',
      first_name: staff.first_name || '',
      last_name: staff.last_name || '',
      category: staff.category || 'DIRECTION_ADMIN',
      role_title: staff.role_title || '',
      phone: staff.phone || '',
      email: staff.email || '',
      contract_type: staff.contract_type || 'CDI',
      hire_date: staff.hire_date || new Date().toISOString().split('T')[0],
      is_active: staff.is_active ?? true,
      specialization: staff.specialization || '',
      notes: staff.notes || '',
    });
    setIsModalOpen(true);
  };

  // Toggle individual level for teacher
  const toggleTeacherLevel = (lvlValue: string) => {
    setTeacherFormData((prev) => {
      const exists = prev.teaching_levels.includes(lvlValue);
      if (exists) {
        return { ...prev, teaching_levels: prev.teaching_levels.filter((l) => l !== lvlValue) };
      } else {
        return { ...prev, teaching_levels: [...prev.teaching_levels, lvlValue] };
      }
    });
  };

  // Toggle all levels in a specific cycle
  const toggleEntireTeacherCycle = (cycleObj: LevelGroup) => {
    const cycleLevelValues = cycleObj.levels.map((l) => l.value);
    const allSelected = cycleLevelValues.every((val) => teacherFormData.teaching_levels.includes(val));

    if (allSelected) {
      setTeacherFormData((prev) => ({
        ...prev,
        teaching_levels: prev.teaching_levels.filter((l) => !cycleLevelValues.includes(l)),
      }));
    } else {
      const set = new Set([...teacherFormData.teaching_levels, ...cycleLevelValues]);
      setTeacherFormData((prev) => ({
        ...prev,
        teaching_levels: Array.from(set),
      }));
    }
  };

  const toggleSlotAvailability = (dayId: number, period: typeof MOROCCAN_55MIN_PERIODS[0]) => {
    const isAlreadySelected = teacherFormData.availability.some(
      (s) => s.day_of_week === dayId && (s.period_id === period.id || s.start_time === period.start)
    );

    if (isAlreadySelected) {
      setTeacherFormData((prev) => ({
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
      setTeacherFormData((prev) => ({
        ...prev,
        availability: [...prev.availability, newSlot],
      }));
    }
  };

  const isSlotSelected = (dayId: number, periodId: string, startTime: string) => {
    return teacherFormData.availability.some(
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
    setTeacherFormData((prev) => ({ ...prev, availability: morningSlots }));
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
    setTeacherFormData((prev) => ({ ...prev, availability: afternoonSlots }));
  };

  const clearAvailability = () => {
    setTeacherFormData((prev) => ({ ...prev, availability: [] }));
  };

  // Save Teacher directly in 'teachers' table
  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherFormData.first_name.trim() || !teacherFormData.last_name.trim()) {
      notify({
        title: 'Champs Obligatoires',
        message: 'Veuillez saisir le prénom et le nom de famille de l\'enseignant.',
        type: 'danger',
      });
      return;
    }

    if (teacherFormData.contract_type === 'VACATAIRE' && teacherFormData.availability.length === 0) {
      notify({
        title: 'Disponibilités Requises',
        message: 'Veuillez sélectionner au moins un créneau horaire disponible pour l\'enseignant vacataire.',
        type: 'warning',
      });
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const code = teacherFormData.teacher_code || `ENS-${Date.now().toString().slice(-3)}`;

      if (editingTeacherId) {
        const { error } = await supabase
          .from('teachers')
          .update({
            teacher_code: code,
            first_name: teacherFormData.first_name.trim(),
            last_name: teacherFormData.last_name.trim(),
            email: teacherFormData.email.trim() || null,
            phone: teacherFormData.phone.trim() || null,
            specialization: teacherFormData.specialization,
            contract_type: teacherFormData.contract_type,
            teaching_levels: teacherFormData.teaching_levels,
            weekly_hours_target: Number(teacherFormData.weekly_hours_target),
            availability: teacherFormData.contract_type === 'VACATAIRE' ? teacherFormData.availability : [],
          })
          .eq('id', editingTeacherId);

        if (error) throw error;

        logAuditEvent({
          action: 'TEACHER_UPDATED',
          entity_type: 'teachers',
          entity_id: editingTeacherId,
          details: {
            name: `${teacherFormData.first_name} ${teacherFormData.last_name}`,
            specialization: teacherFormData.specialization,
            contract_type: teacherFormData.contract_type,
          },
        });

        notify({ title: 'Succès', message: 'Fiche enseignant modifiée avec succès !', type: 'success' });
      } else {
        const { error } = await supabase.from('teachers').insert([
          {
            teacher_code: code,
            first_name: teacherFormData.first_name.trim(),
            last_name: teacherFormData.last_name.trim(),
            email: teacherFormData.email.trim() || null,
            phone: teacherFormData.phone.trim() || null,
            specialization: teacherFormData.specialization,
            contract_type: teacherFormData.contract_type,
            teaching_levels: teacherFormData.teaching_levels,
            weekly_hours_target: Number(teacherFormData.weekly_hours_target),
            availability: teacherFormData.contract_type === 'VACATAIRE' ? teacherFormData.availability : [],
            status: 'ACTIVE',
          },
        ]);

        if (error) throw error;

        logAuditEvent({
          action: 'TEACHER_CREATED',
          entity_type: 'teachers',
          details: {
            name: `${teacherFormData.first_name} ${teacherFormData.last_name}`,
            specialization: teacherFormData.specialization,
            contract_type: teacherFormData.contract_type,
          },
        });

        notify({ title: 'Succès', message: 'Enseignant ajouté avec succès !', type: 'success' });
      }

      setIsTeacherModalOpen(false);
      loadStaffData();
    } catch (err: any) {
      console.error('Save teacher error:', err);
      notify({ title: 'Erreur', message: err.message || 'Impossible d\'enregistrer l\'enseignant.', type: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  // Save or Update generic Staff Member in Supabase
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.role_title.trim()) {
      notify({
        title: 'Champs Obligatoires',
        message: 'Veuillez renseigner le nom, le prénom et la fonction du collaborateur.',
        type: 'danger',
      });
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();

      if (editingStaff) {
        await supabase
          .from('staff_members')
          .update({
            staff_code: formData.staff_code,
            first_name: formData.first_name,
            last_name: formData.last_name,
            category: formData.category,
            role_title: formData.role_title,
            phone: formData.phone || null,
            email: formData.email || null,
            contract_type: formData.contract_type,
            hire_date: formData.hire_date || null,
            is_active: formData.is_active,
            notes: formData.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingStaff.id);
      } else {
        await supabase.from('staff_members').insert([
          {
            staff_code: formData.staff_code,
            first_name: formData.first_name,
            last_name: formData.last_name,
            category: formData.category,
            role_title: formData.role_title,
            phone: formData.phone || null,
            email: formData.email || null,
            contract_type: formData.contract_type,
            hire_date: formData.hire_date || null,
            is_active: formData.is_active,
            notes: formData.notes || null,
          },
        ]);
      }

      notify({
        title: editingStaff ? 'Membre Modifié' : 'Nouveau Membre Enregistré',
        message: `${formData.first_name} ${formData.last_name} a été enregistré(e) avec succès.`,
        type: 'success',
      });

      logAuditEvent({
        action: editingStaff ? 'STAFF_MEMBER_UPDATED' : 'STAFF_MEMBER_CREATED',
        entity_type: 'staff_members',
        entity_id: formData.staff_code,
        details: {
          name: `${formData.first_name} ${formData.last_name}`,
          category: formData.category,
          role: formData.role_title,
        },
      });

      setIsModalOpen(false);
      loadStaffData();
    } catch (err: any) {
      notify({
        title: 'Erreur',
        message: `Échec de l'enregistrement : ${err.message}`,
        type: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete staff member
  const handleDeleteStaff = async (staff: StaffMember) => {
    const isConfirmed = await confirm({
      title: 'Supprimer ce membre du personnel ?',
      message: `Êtes-vous sûr de vouloir supprimer définitivement ${staff.first_name} ${staff.last_name} (${staff.role_title}) ? Cette action est irréversible.`,
      confirmText: 'Oui, Supprimer',
      cancelText: 'Annuler',
      type: 'danger',
    });

    if (!isConfirmed) return;

    try {
      const supabase = createClient();
      if (staff.category === 'ENSEIGNANT') {
        await supabase.from('teachers').delete().eq('id', staff.id);
      } else {
        await supabase.from('staff_members').delete().eq('id', staff.id);
      }

      notify({
        title: 'Membre Supprimé',
        message: `${staff.first_name} ${staff.last_name} a été retiré(e) de la liste.`,
        type: 'info',
      });

      logAuditEvent({
        action: 'STAFF_MEMBER_DELETED',
        entity_type: 'staff_members',
        entity_id: staff.id,
        details: {
          name: `${staff.first_name} ${staff.last_name}`,
          role: staff.role_title,
        },
      });

      loadStaffData();
    } catch (err: any) {
      notify({
        title: 'Erreur',
        message: `Impossible de supprimer : ${err.message}`,
        type: 'danger',
      });
    }
  };

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      // Category match
      let matchCat = true;
      if (activeTab !== 'ALL') {
        if (activeTab === 'ENSEIGNANT') matchCat = s.category === 'ENSEIGNANT';
        else if (activeTab === 'DIRECTION_ADMIN') matchCat = s.category === 'DIRECTION_ADMIN' || s.category === 'ADMINISTRATION';
        else if (activeTab === 'DIRECTION_PEDAGOGIQUE') matchCat = s.category === 'DIRECTION_PEDAGOGIQUE' || s.category === 'ASSISTANTE';
        else if (activeTab === 'STAFF_MENAGE') matchCat = s.category === 'STAFF_MENAGE' || s.category === 'AGENT_ENTRETIEN';
        else if (activeTab === 'TRANSPORTEUR') matchCat = s.category === 'TRANSPORTEUR' || s.category === 'CHAUFFEUR';
        else if (activeTab === 'SURVEILLANCE') matchCat = s.category === 'SURVEILLANCE' || s.category === 'SECURITE_GARDIEN';
      }

      // Status match
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && s.is_active) ||
        (statusFilter === 'INACTIVE' && !s.is_active);

      // Contract match
      const matchContract =
        contractFilter === 'ALL' || s.contract_type === contractFilter;

      // Search match
      const matchSearch =
        searchQuery === '' ||
        `${s.first_name} ${s.last_name} ${s.staff_code} ${s.role_title} ${s.phone || ''} ${s.email || ''}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      return matchCat && matchStatus && matchContract && matchSearch;
    });
  }, [staffList, activeTab, statusFilter, contractFilter, searchQuery]);

  // Counts by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: staffList.length,
      ENSEIGNANT: 0,
      DIRECTION_ADMIN: 0,
      DIRECTION_PEDAGOGIQUE: 0,
      STAFF_MENAGE: 0,
      TRANSPORTEUR: 0,
      SURVEILLANCE: 0,
    };

    staffList.forEach((s) => {
      if (s.category === 'ENSEIGNANT') counts.ENSEIGNANT++;
      else if (s.category === 'DIRECTION_ADMIN' || s.category === 'ADMINISTRATION') counts.DIRECTION_ADMIN++;
      else if (s.category === 'DIRECTION_PEDAGOGIQUE' || s.category === 'ASSISTANTE') counts.DIRECTION_PEDAGOGIQUE++;
      else if (s.category === 'STAFF_MENAGE' || s.category === 'AGENT_ENTRETIEN') counts.STAFF_MENAGE++;
      else if (s.category === 'TRANSPORTEUR' || s.category === 'CHAUFFEUR') counts.TRANSPORTEUR++;
      else if (s.category === 'SURVEILLANCE' || s.category === 'SECURITE_GARDIEN') counts.SURVEILLANCE++;
    });

    return counts;
  }, [staffList]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Matricule', 'Nom', 'Prenom', 'Categorie', 'Fonction', 'Telephone', 'Email', 'Contrat', 'Statut'];
    const rows = filteredStaff.map((s) => [
      `"${s.staff_code}"`,
      `"${s.last_name}"`,
      `"${s.first_name}"`,
      `"${s.category}"`,
      `"${s.role_title}"`,
      `"${s.phone || ''}"`,
      `"${s.email || ''}"`,
      `"${s.contract_type || 'CDI'}"`,
      `"${s.is_active ? 'Actif' : 'Inactif'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Personnel_GM_School_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notify({
      title: 'Export Réussi',
      message: `La liste du personnel (${filteredStaff.length} membres) a été exportée en CSV.`,
      type: 'success',
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              <Users className="w-4 h-4" />
              <span>Ressources Humaines &amp; Établissement</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Gestion du Personnel &amp; Collaborateurs
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enseignants, Directions Administrative &amp; Pédagogique, Ménage, Transporteurs et Surveillance.
            </p>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4 text-sky-500" />
              <span>Imprimer</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-100 transition-all cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Exporter CSV</span>
            </button>

            <button
              onClick={() => handleOpenCreate()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-xs shadow-md shadow-sky-500/25 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Collaborateur</span>
            </button>
          </div>
        </div>

        {/* 6 Categories Tabs (As explicitly requested by user) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
          {STAFF_TAB_CONFIGS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.key;
            const count = categoryCounts[tab.key] || 0;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 relative overflow-hidden ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 border-sky-500 shadow-md ring-2 ring-sky-500/20'
                    : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-xl ${isSelected ? 'bg-sky-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${isSelected ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    {count}
                  </span>
                </div>

                <div>
                  <div className={`text-xs font-bold leading-tight ${isSelected ? 'text-sky-900 dark:text-sky-100' : 'text-slate-800 dark:text-slate-200'}`}>
                    {tab.label}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                    {tab.labelAr}
                  </div>
                </div>

                {isSelected && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-blue-600" />
                )}
              </button>
            );
          })}
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, prénom, matricule, poste, téléphone, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-semibold cursor-pointer focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="ACTIVE">Actifs uniquement</option>
              <option value="INACTIVE">Inactifs</option>
            </select>

            {/* Quick Add Button in tab */}
            {activeTab !== 'ALL' && (
              <button
                onClick={() => handleOpenCreate(activeTab)}
                className="px-3.5 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter dans {STAFF_TAB_CONFIGS.find((t) => t.key === activeTab)?.label}</span>
              </button>
            )}
          </div>
        </div>

        {/* Staff Table / List */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Personnel &amp; Matricule</th>
                  <th className="px-6 py-3.5">Département &amp; Catégorie</th>
                  <th className="px-6 py-3.5">Poste / Fonction</th>
                  <th className="px-6 py-3.5">Coordonnées</th>
                  <th className="px-6 py-3.5">Contrat</th>
                  <th className="px-6 py-3.5">Statut</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-xs">
                      Chargement de l'annuaire du personnel...
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-xs">
                      Aucun collaborateur trouvé pour les critères sélectionnés.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => {
                    const initials = `${staff.first_name?.[0] || ''}${staff.last_name?.[0] || ''}`.toUpperCase() || 'P';
                    const categoryConfig = STAFF_TAB_CONFIGS.find((c) => c.key === staff.category) || STAFF_TAB_CONFIGS[0];

                    return (
                      <tr
                        key={staff.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Name & Matricule */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0">
                              {initials}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                {staff.first_name} {staff.last_name}
                              </div>
                              <div className="text-[11px] font-mono text-sky-600 dark:text-sky-400 font-bold">
                                {staff.staff_code}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category Badge */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${categoryConfig.badgeBg}`}>
                            <span>{categoryConfig.label}</span>
                          </span>
                        </td>

                        {/* Role Title */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                            {staff.role_title}
                          </div>
                          {staff.specialization && (
                            <div className="text-[11px] text-slate-400">
                              Spécialité : {staff.specialization}
                            </div>
                          )}
                        </td>

                        {/* Contact */}
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                          {staff.phone && (
                            <a
                              href={`tel:${staff.phone}`}
                              className="flex items-center gap-1.5 hover:text-sky-600"
                            >
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{staff.phone}</span>
                            </a>
                          )}
                          {staff.email && (
                            <a
                              href={`mailto:${staff.email}`}
                              className="flex items-center gap-1.5 hover:text-sky-600 text-[11px] text-slate-400 mt-0.5"
                            >
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>{staff.email}</span>
                            </a>
                          )}
                        </td>

                        {/* Contract */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold">
                            {staff.contract_type || 'CDI'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {staff.is_active ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Actif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Inactif
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(staff)}
                              className="p-2 text-slate-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                              title="Modifier"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteStaff(staff)}
                              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
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

        {/* ============================================================ */}
        {/* DEDICATED MODAL: AJOUTER / MODIFIER UN ENSEIGNANT            */}
        {/* ============================================================ */}
        {isTeacherModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-emerald-500/20 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingTeacherId ? 'Modifier la Fiche Enseignant' : 'Ajouter un Enseignant'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsTeacherModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTeacher} className="space-y-5 mt-4">
                {/* Contract Type Selection Tabs */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Type de Contrat &bullet; Régime de Travail
                  </label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setTeacherFormData({ ...teacherFormData, contract_type: 'PLEIN_TEMPS' })}
                      className={`p-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        teacherFormData.contract_type === 'PLEIN_TEMPS'
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
                      onClick={() => setTeacherFormData({ ...teacherFormData, contract_type: 'VACATAIRE' })}
                      className={`p-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        teacherFormData.contract_type === 'VACATAIRE'
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
                      value={teacherFormData.first_name}
                      onChange={(e) => setTeacherFormData({ ...teacherFormData, first_name: e.target.value })}
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
                      value={teacherFormData.last_name}
                      onChange={(e) => setTeacherFormData({ ...teacherFormData, last_name: e.target.value })}
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
                      value={teacherFormData.specialization}
                      onChange={(e) => setTeacherFormData({ ...teacherFormData, specialization: e.target.value })}
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
                      value={teacherFormData.email}
                      onChange={(e) => setTeacherFormData({ ...teacherFormData, email: e.target.value })}
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
                      value={teacherFormData.phone}
                      onChange={(e) => setTeacherFormData({ ...teacherFormData, phone: e.target.value })}
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
                      {teacherFormData.teaching_levels.length} niveau(x) sélectionné(s)
                    </span>
                  </div>

                  {TEACHING_CYCLES.map((cycle) => {
                    const cycleLevelValues = cycle.levels.map((l) => l.value);
                    const allCycleSelected = cycleLevelValues.every((val) => teacherFormData.teaching_levels.includes(val));

                    return (
                      <div key={cycle.name} className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            {cycle.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleEntireTeacherCycle(cycle)}
                            className="text-[10px] font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                          >
                            {allCycleSelected ? 'Tout désélectionner' : `+ Tout ${cycle.name}`}
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {cycle.levels.map((lvl) => {
                            const isSelected = teacherFormData.teaching_levels.includes(lvl.value);
                            return (
                              <button
                                key={lvl.value}
                                type="button"
                                onClick={() => toggleTeacherLevel(lvl.value)}
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

                {/* VACATAIRE AVAILABILITY SCHEDULE PICKER */}
                {teacherFormData.contract_type === 'VACATAIRE' && (
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
                                      className={`w-full py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                        selected
                                          ? 'bg-amber-500 text-white shadow-xs font-black scale-[0.98]'
                                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700'
                                      }`}
                                    >
                                      {selected ? 'Disponible' : '—'}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsTeacherModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-2"
                  >
                    {saving ? 'Enregistrement...' : editingTeacherId ? 'Enregistrer les Modifications' : 'Créer l\'Enseignant'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* GENERIC MODAL: CREATE / EDIT STAFF MEMBER                    */}
        {/* ============================================================ */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {editingStaff ? 'Modifier le Collaborateur' : 'Nouveau Membre du Personnel'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Remplissez les informations administratives et professionnelles.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveStaff} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* 1. Category Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Département / Catégorie du Personnel *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as StaffCategory })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    <option value="DIRECTION_ADMIN">🏢 Direction Administrative (RH, Comptabilité, Secrétariat)</option>
                    <option value="DIRECTION_PEDAGOGIQUE">🎓 Direction Pédagogique (Coordination, Suivi)</option>
                    <option value="STAFF_MENAGE">🧹 Staff Ménage &amp; Entretien (Hygiène, Maintenance)</option>
                    <option value="TRANSPORTEUR">🚐 Transporteurs &amp; Chauffeurs (Transport Scolaire)</option>
                    <option value="SURVEILLANCE">🛡️ Surveillance &amp; Vie Scolaire (Surveillants, Gardiens)</option>
                  </select>
                </div>

                {/* 2. Matricule, First Name, Last Name */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Matricule / Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.staff_code}
                      onChange={(e) => setFormData({ ...formData, staff_code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-sky-600 dark:text-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Prénom *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Youssef"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nom *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Mansouri"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {/* 3. Role Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Poste / Fonction Exacte *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Secrétaire Général, Chauffeur Bus 02..."
                    value={formData.role_title}
                    onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* 4. Contact Phone & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Numéro de Téléphone
                    </label>
                    <input
                      type="tel"
                      placeholder="0661001122"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Adresse Email
                    </label>
                    <input
                      type="email"
                      placeholder="nom@gm-school.ma"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {/* 5. Contract & Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Type de Contrat
                    </label>
                    <select
                      value={formData.contract_type}
                      onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      <option value="CDI">CDI (Plein temps)</option>
                      <option value="CDD">CDD</option>
                      <option value="Titulaire">Titulaire</option>
                      <option value="Vacataire">Vacataire</option>
                      <option value="Stage">Stage / Intérim</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Statut d'Activité
                    </label>
                    <select
                      value={formData.is_active ? 'ACTIVE' : 'INACTIVE'}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'ACTIVE' })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                    >
                      <option value="ACTIVE">Actif (En poste)</option>
                      <option value="INACTIVE">Inactif (Départ / Congé prolongé)</option>
                    </select>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
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
