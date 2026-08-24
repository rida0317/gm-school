'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { ClassEntity, Teacher } from '@/types/database';
import { useConfirm, useNotify } from '@/lib/modal-service';
import { logAuditEvent } from '@/lib/audit';
import {
  Building2,
  Plus,
  GraduationCap,
  Trash2,
  Edit2,
  X,
  Search,
  Users,
  Layers
} from 'lucide-react';

export interface LevelCategory {
  cycle: string;
  name: string;
  levels: Array<{ value: string; label: string; short: string }>;
}

export const SCHOOL_CYCLES: LevelCategory[] = [
  {
    cycle: 'Maternelle (Préscolaire)',
    name: 'Maternelle',
    levels: [
      { value: 'TPS', label: 'TPS (Toute Petite Section)', short: 'TPS' },
      { value: 'PS', label: 'PS (Petite Section)', short: 'PS' },
      { value: 'MS', label: 'MS (Moyenne Section)', short: 'MS' },
      { value: 'GS', label: 'GS (Grande Section)', short: 'GS' },
    ],
  },
  {
    cycle: 'Enseignement Primaire',
    name: 'Primaire',
    levels: [
      { value: 'CP', label: 'CP — Cours Préparatoire', short: 'CP' },
      { value: 'CE1', label: 'CE1 — Cours Élémentaire 1', short: 'CE1' },
      { value: 'CE2', label: 'CE2 — Cours Élémentaire 2', short: 'CE2' },
      { value: 'CM1', label: 'CM1 — Cours Moyen 1', short: 'CM1' },
      { value: 'CM2', label: 'CM2 — Cours Moyen 2', short: 'CM2' },
      { value: 'CE6', label: 'CE6 — 6ème Année Primaire', short: 'CE6' },
    ],
  },
  {
    cycle: 'Enseignement Collégial (Collège)',
    name: 'Collège',
    levels: [
      { value: '1AC', label: '1AC — 1ère Année Collège', short: '1AC' },
      { value: '2AC', label: '2AC — 2ème Année Collège', short: '2AC' },
      { value: '3AC', label: '3AC — 3ème Année Collège', short: '3AC' },
    ],
  },
  {
    cycle: 'Enseignement Secondaire (Lycée)',
    name: 'Lycée',
    levels: [
      { value: 'Tronc Commun Sciences', label: 'TC Sciences (Tronc Commun)', short: 'TCS' },
      { value: 'Tronc Commun Lettres', label: 'TC Lettres & Humanités', short: 'TCL' },
      { value: 'Tronc Commun Technologie', label: 'TC Technologique', short: 'TCT' },
      { value: '1ère Bac Sciences Exp', label: '1ère Bac — Sciences Expérimentales', short: '1Bac-ScExp' },
      { value: '1ère Bac Sciences Math', label: '1ère Bac — Sciences Mathématiques', short: '1Bac-SM' },
      { value: '1ère Bac Économie', label: '1ère Bac — Sciences Économiques', short: '1Bac-Eco' },
      { value: '1ère Bac Lettres', label: '1ère Bac — Lettres & Sc. Humaines', short: '1Bac-L' },
      { value: '2ème Bac PC', label: '2ème Bac — Sciences Physiques (PC)', short: '2Bac-PC' },
      { value: '2ème Bac SVT', label: '2ème Bac — Sciences de la Vie et de la Terre (SVT)', short: '2Bac-SVT' },
      { value: '2ème Bac SM', label: '2ème Bac — Sciences Mathématiques (SM)', short: '2Bac-SM' },
      { value: '2ème Bac Économie', label: '2ème Bac — Sciences Économiques & Gestion', short: '2Bac-Eco' },
      { value: '2ème Bac Lettres', label: '2ème Bac — Lettres & Sc. Humaines', short: '2Bac-L' },
    ],
  },
];

export const GROUP_OPTIONS = [
  { value: 'A', label: 'Groupe A' },
  { value: 'B', label: 'Groupe B' },
  { value: 'C', label: 'Groupe C' },
  { value: 'D', label: 'Groupe D' },
  { value: '1', label: 'Groupe 1' },
  { value: '2', label: 'Groupe 2' },
  { value: 'Unique', label: 'Groupe Unique' },
];

function ClassesContent() {
  const { t, dir } = useI18n();
  const searchParams = useSearchParams();
  const cycleParam = searchParams ? searchParams.get('cycle') : null;

  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCycle, setSelectedCycle] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    level: '1AC',
    group_name: 'A',
    capacity: 30,
    main_teacher_id: '',
  });

  const confirm = useConfirm();
  const notify = useNotify();

  // Sync cycle query param from navigation
  useEffect(() => {
    if (cycleParam) {
      const matched = SCHOOL_CYCLES.find(
        (c) =>
          c.name.toLowerCase() === cycleParam.toLowerCase() ||
          c.cycle.toLowerCase().includes(cycleParam.toLowerCase())
      );
      if (matched) {
        setSelectedCycle(matched.cycle);
      }
    }
  }, [cycleParam]);

  async function loadData() {
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: cls }, { data: tch }] = await Promise.all([
        supabase.from('classes').select('*, main_teacher:teachers(*)').order('name'),
        supabase.from('teachers').select('*').order('last_name'),
      ]);
      if (cls) setClasses(cls);
      if (tch) setTeachers(tch);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ name: '1AC-A', level: '1AC', group_name: 'A', capacity: 30, main_teacher_id: '' });
    setShowModal(true);
  };

  const openEditModal = (c: ClassEntity) => {
    setEditingId(c.id);
    setFormData({
      name: c.name,
      level: c.level || '1AC',
      group_name: c.group_name || 'A',
      capacity: c.capacity || 30,
      main_teacher_id: c.main_teacher_id || '',
    });
    setShowModal(true);
  };

  const handleLevelOrGroupChange = (newLevel: string, newGroup: string) => {
    // Find short code of level
    let shortCode = newLevel;
    for (const cy of SCHOOL_CYCLES) {
      const found = cy.levels.find((l) => l.value === newLevel);
      if (found) {
        shortCode = found.short;
        break;
      }
    }
    const autoName = newGroup && newGroup !== 'Unique' ? `${shortCode}-${newGroup}` : shortCode;

    setFormData((prev) => ({
      ...prev,
      level: newLevel,
      group_name: newGroup,
      name: autoName,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const supabase = createClient();
      if (editingId) {
        // Update existing class
        const { error } = await supabase
          .from('classes')
          .update({
            name: formData.name.trim(),
            level: formData.level,
            group_name: formData.group_name || 'A',
            capacity: Number(formData.capacity),
            main_teacher_id: formData.main_teacher_id || null,
          })
          .eq('id', editingId);

        if (error) {
          notify({ title: 'Erreur', message: error.message, type: 'danger' });
          return;
        }

        logAuditEvent({
          action: 'CLASS_UPDATED',
          entity_type: 'classes',
          entity_id: editingId,
          details: {
            name: formData.name,
            level: formData.level,
            capacity: formData.capacity,
          },
        });

        notify({ title: 'Succès', message: 'Classe modifiée avec succès !', type: 'success' });
      } else {
        // Create new class
        const { error } = await supabase.from('classes').insert([
          {
            name: formData.name.trim(),
            level: formData.level,
            group_name: formData.group_name || 'A',
            capacity: Number(formData.capacity),
            main_teacher_id: formData.main_teacher_id || null,
            is_active: true,
          },
        ]);

        if (error) {
          notify({ title: 'Erreur', message: error.message, type: 'danger' });
          return;
        }

        logAuditEvent({
          action: 'CLASS_CREATED',
          entity_type: 'classes',
          details: {
            name: formData.name,
            level: formData.level,
            capacity: formData.capacity,
          },
        });

        notify({ title: 'Succès', message: 'Classe créée avec succès !', type: 'success' });
      }

      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', level: '1AC', group_name: 'A', capacity: 30, main_teacher_id: '' });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const handleDelete = async (id: string, name?: string) => {
    const ok = await confirm({
      title: 'Supprimer la classe',
      message: name
        ? `Êtes-vous sûr de vouloir supprimer la classe "${name}" ? Cette action est irréversible.`
        : 'Voulez-vous supprimer cette classe ?',
      type: 'danger',
      confirmText: 'Supprimer définitivement',
      cancelText: 'Annuler',
    });
    if (!ok) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;

      logAuditEvent({
        action: 'CLASS_DELETED',
        entity_type: 'classes',
        entity_id: id,
        details: { name: name || id },
      });

      notify({ title: 'Succès', message: 'Classe supprimée.', type: 'success' });
      notify({ title: 'Supprimée', message: 'La classe a été supprimée.', type: 'success' });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de suppression';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      const matchesSearch = `${c.name} ${c.level || ''} ${c.group_name || ''} ${c.main_teacher?.first_name || ''} ${c.main_teacher?.last_name || ''}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedCycle === 'ALL') return true;

      // Match cycle
      const cycleObj = SCHOOL_CYCLES.find((cy) => cy.cycle === selectedCycle);
      if (!cycleObj) return true;

      return cycleObj.levels.some(
        (l) => l.value === c.level || l.short === c.level || c.level?.startsWith(l.short) || c.level?.includes(l.value)
      );
    });
  }, [classes, searchTerm, selectedCycle]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
              <Building2 className="w-4 h-4" />
              {t('classes')}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('classes_page_title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {dir === 'rtl' ? 'تدبير المستويات الدراسية، الشعب والأقسام (فوج أ، فوج ب، إلخ).' : "Administrez les niveaux scolaires et les divisions par groupes (Groupe A, Groupe B, etc.)."}
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm shadow-lg shadow-orange-500/25 transition-all hover:scale-105 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t('add_class')}
          </button>
        </div>

        {/* Filter Bar & Cycle Tabs */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
            <button
              onClick={() => setSelectedCycle('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCycle === 'ALL'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {t('all')} ({classes.length})
            </button>

            {SCHOOL_CYCLES.map((cycle) => (
              <button
                key={cycle.cycle}
                onClick={() => setSelectedCycle(cycle.cycle)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCycle === cycle.cycle
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 scale-105'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cycle.name}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className={`w-4 h-4 text-slate-400 absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2`} />
            <input
              type="text"
              placeholder={t('search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full ${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500`}
            />
          </div>
        </div>

        {/* Classes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {loading ? (
            <div className="col-span-full py-12 text-center text-slate-400">
              Chargement des classes...
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400">
              Aucune classe trouvée pour ce filtre.
            </div>
          ) : (
            filteredClasses.map((c) => (
              <div
                key={c.id}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-orange-500/50 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-3 rounded-2xl bg-orange-500/10 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-orange-500 text-white shadow-xs">
                        Groupe {c.group_name || 'A'}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-orange-50 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border border-orange-300/40">
                        {c.level}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{c.name}</h3>

                  <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>Groupe / Division :</span>
                      <strong className="text-slate-900 dark:text-white font-bold">
                        Groupe {c.group_name || 'A'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Prof. Principal :</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                        {c.main_teacher
                          ? `${c.main_teacher.first_name} ${c.main_teacher.last_name}`
                          : 'Non défini'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Capacité maximale :</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {c.capacity} Élèves
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">Actions</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(c)}
                      title="Modifier la classe"
                      className="p-2 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-white rounded-xl hover:bg-orange-50 dark:hover:bg-orange-950/50 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      title="Supprimer la classe"
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Add/Edit Class */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-orange-500/20 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-orange-500/15 text-orange-500">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingId ? 'Modifier la Classe' : 'Créer une Nouvelle Classe'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nom de la classe (ex: CE1-A, 3AC-B, 2Bac-PC-A)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Niveau Scolaire (TPS &rarr; 2Bac)
                    </label>
                    <select
                      value={formData.level}
                      onChange={(e) => handleLevelOrGroupChange(e.target.value, formData.group_name)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                    >
                      {SCHOOL_CYCLES.map((cycle) => (
                        <optgroup key={cycle.cycle} label={cycle.cycle}>
                          {cycle.levels.map((lvl) => (
                            <option key={lvl.value} value={lvl.value}>
                              {lvl.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-orange-500" /> Groupe
                    </label>
                    <select
                      value={formData.group_name}
                      onChange={(e) => handleLevelOrGroupChange(formData.level, e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-orange-300 dark:border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/30 text-xs font-bold text-orange-900 dark:text-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                    >
                      {GROUP_OPTIONS.map((grp) => (
                        <option key={grp.value} value={grp.value}>
                          {grp.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Capacité (Élèves max)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Professeur Principal
                    </label>
                    <select
                      value={formData.main_teacher_id}
                      onChange={(e) => setFormData({ ...formData, main_teacher_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                    >
                      <option value="">-- Aucun / Non assigné --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.first_name} {t.last_name} ({t.specialization})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

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
                    className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 rounded-xl shadow-lg shadow-orange-500/25 transition-all cursor-pointer"
                  >
                    {editingId ? 'Enregistrer les Modifications' : 'Créer la Classe'}
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

export default function ClassesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">Chargement...</div>}>
      <ClassesContent />
    </Suspense>
  );
}
