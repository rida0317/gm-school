'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { StaffMember, StaffCategory, Teacher } from '@/types/database';
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
  SlidersHorizontal
} from 'lucide-react';
import Link from 'next/link';

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

  // Staff Data
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Create/Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    staff_code: '',
    first_name: '',
    last_name: '',
    category: 'ENSEIGNANT' as StaffCategory,
    role_title: '',
    phone: '',
    email: '',
    contract_type: 'CDI',
    hire_date: new Date().toISOString().split('T')[0],
    is_active: true,
    specialization: '',
    notes: '',
  });

  // Fetch all staff members & teachers from Supabase
  const loadStaffData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      // 1. Fetch from staff_members table
      const { data: staffData, error: staffErr } = await supabase
        .from('staff_members')
        .select('*')
        .order('created_at', { ascending: false });

      // 2. Fetch from teachers table
      const { data: teachersData, error: teachErr } = await supabase
        .from('teachers')
        .select('*')
        .order('last_name', { ascending: true });

      if (teachErr) console.warn('Teachers fetch notice:', teachErr.message);
      if (staffErr) console.warn('Staff fetch notice:', staffErr.message);

      if (teachersData) {
        setTeachersList(teachersData);
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

  // Open Modal for New Staff Member
  const handleOpenCreate = (preselectedCategory?: ActiveStaffTab) => {
    setEditingStaff(null);
    const cat = preselectedCategory && preselectedCategory !== 'ALL'
      ? (preselectedCategory as StaffCategory)
      : activeTab !== 'ALL'
      ? (activeTab as StaffCategory)
      : 'ENSEIGNANT';

    // Auto-generate code prefix
    const prefixes: Record<string, string> = {
      ENSEIGNANT: 'ENS',
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
    setEditingStaff(staff);
    setFormData({
      staff_code: staff.staff_code || '',
      first_name: staff.first_name || '',
      last_name: staff.last_name || '',
      category: staff.category || 'ENSEIGNANT',
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

  // Save or Update Staff Member in Supabase
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

      if (formData.category === 'ENSEIGNANT') {
        // Handle teacher in 'teachers' table
        if (editingStaff) {
          await supabase
            .from('teachers')
            .update({
              first_name: formData.first_name,
              last_name: formData.last_name,
              teacher_code: formData.staff_code,
              specialization: formData.specialization || formData.role_title,
              phone: formData.phone || null,
              email: formData.email || null,
              contract_type: formData.contract_type,
              status: formData.is_active ? 'ACTIVE' : 'INACTIVE',
            })
            .eq('id', editingStaff.id);
        } else {
          await supabase.from('teachers').insert([
            {
              teacher_code: formData.staff_code,
              first_name: formData.first_name,
              last_name: formData.last_name,
              specialization: formData.specialization || formData.role_title,
              phone: formData.phone || null,
              email: formData.email || null,
              contract_type: formData.contract_type,
              status: formData.is_active ? 'ACTIVE' : 'INACTIVE',
            },
          ]);
        }
      } else {
        // Handle other categories in 'staff_members' table
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

        {/* Create / Edit Staff Modal */}
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
                    <option value="ENSEIGNANT">👨‍🏫 Enseignants (Corps Professoral)</option>
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

                {/* 3. Role Title & Specialization */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  {formData.category === 'ENSEIGNANT' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Matière / Spécialisation
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Mathématiques, Français, Arabe..."
                        value={formData.specialization}
                        onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  )}
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
