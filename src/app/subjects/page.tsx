'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { Subject, EducationCycle, CycleSubjectConfig } from '@/types/database';
import { useConfirm, useNotify } from '@/lib/modal-service';
import {
  BookOpen,
  Plus,
  Clock,
  Trash2,
  Edit2,
  X,
  Sparkles,
  Search,
  Layers,
  GraduationCap,
  School,
  Building2,
  Printer,
  Download,
  Check,
  LayoutGrid,
  Table as TableIcon,
  Sliders,
  DoorClosed
} from 'lucide-react';

const PRESET_LEVELS_MAP: Record<EducationCycle, string[]> = {
  ALL: ['Tous Niveaux'],
  MATERNELLE: ['TPS', 'PS', 'MS', 'GS'],
  PRIMAIRE: ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6AP'],
  COLLEGE: ['1AC', '2AC', '3AC'],
  LYCEE: ['Tronc Commun', '1ère Bac', '2ème Bac'],
};

const DEFAULT_HOURS_PER_CYCLE: Record<EducationCycle, number> = {
  ALL: 4,
  MATERNELLE: 4,
  PRIMAIRE: 5,
  COLLEGE: 4,
  LYCEE: 5,
};

// Default Authentic Moroccan Multi-Cycle Curriculum with cycle-specific hours
const DEFAULT_CURRICULUM: Subject[] = [
  {
    id: 'subj-math',
    code: 'MATH',
    name: 'Mathématiques',
    cycles: ['PRIMAIRE', 'COLLEGE', 'LYCEE'],
    cycle: 'PRIMAIRE',
    weekly_hours: 5,
    coefficient: 1,
    color_code: '#2563eb',
    room_type: 'Salle de classe standard',
    cycle_configs: {
      PRIMAIRE: { weekly_hours: 5, coefficient: 1, levels: ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6AP'] },
      COLLEGE: { weekly_hours: 5, coefficient: 1, levels: ['1AC', '2AC', '3AC'] },
      LYCEE: { weekly_hours: 6, coefficient: 1, levels: ['Tronc Commun', '1ère Bac', '2ème Bac'] },
    },
  },
  {
    id: 'subj-fran',
    code: 'FRAN',
    name: 'Langue Française & Communication',
    cycles: ['PRIMAIRE', 'COLLEGE', 'LYCEE'],
    cycle: 'PRIMAIRE',
    weekly_hours: 6,
    coefficient: 1,
    color_code: '#0284c7',
    room_type: 'Salle de classe standard',
    cycle_configs: {
      PRIMAIRE: { weekly_hours: 8, coefficient: 1, levels: ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6AP'] },
      COLLEGE: { weekly_hours: 5, coefficient: 1, levels: ['1AC', '2AC', '3AC'] },
      LYCEE: { weekly_hours: 4, coefficient: 1, levels: ['Tronc Commun', '1ère Bac'] },
    },
  },
  {
    id: 'subj-arab',
    code: 'ARAB',
    name: 'Langue Arabe',
    cycles: ['PRIMAIRE', 'COLLEGE', 'LYCEE'],
    cycle: 'PRIMAIRE',
    weekly_hours: 5,
    coefficient: 1,
    color_code: '#059669',
    room_type: 'Salle de classe standard',
    cycle_configs: {
      PRIMAIRE: { weekly_hours: 7, coefficient: 1, levels: ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6AP'] },
      COLLEGE: { weekly_hours: 4, coefficient: 1, levels: ['1AC', '2AC', '3AC'] },
      LYCEE: { weekly_hours: 2, coefficient: 1, levels: ['Tronc Commun', '1ère Bac'] },
    },
  },
  {
    id: 'subj-engl',
    code: 'ANGL',
    name: 'Langue Anglaise (Cambridge)',
    cycles: ['PRIMAIRE', 'COLLEGE', 'LYCEE'],
    cycle: 'PRIMAIRE',
    weekly_hours: 3,
    coefficient: 1,
    color_code: '#6366f1',
    room_type: 'Salle de classe standard',
    cycle_configs: {
      PRIMAIRE: { weekly_hours: 2, coefficient: 1, levels: ['CE1', 'CE2', 'CM1', 'CM2', '6AP'] },
      COLLEGE: { weekly_hours: 3, coefficient: 1, levels: ['1AC', '2AC', '3AC'] },
      LYCEE: { weekly_hours: 3, coefficient: 1, levels: ['Tronc Commun', '1ère Bac', '2ème Bac'] },
    },
  },
  {
    id: 'subj-pc',
    code: 'PC',
    name: 'Physique - Chimie',
    cycles: ['COLLEGE', 'LYCEE'],
    cycle: 'COLLEGE',
    weekly_hours: 4,
    coefficient: 1,
    color_code: '#8b5cf6',
    room_type: 'Laboratoire Physique-Chimie',
    cycle_configs: {
      COLLEGE: { weekly_hours: 2, coefficient: 1, levels: ['1AC', '2AC', '3AC'] },
      LYCEE: { weekly_hours: 5, coefficient: 1, levels: ['Tronc Commun', '1ère Bac', '2ème Bac'] },
    },
  },
  {
    id: 'subj-svt',
    code: 'SVT',
    name: 'Sciences de la Vie et de la Terre (SVT)',
    cycles: ['COLLEGE', 'LYCEE'],
    cycle: 'COLLEGE',
    weekly_hours: 3,
    coefficient: 1,
    color_code: '#10b981',
    room_type: 'Laboratoire SVT',
    cycle_configs: {
      COLLEGE: { weekly_hours: 2, coefficient: 1, levels: ['1AC', '2AC', '3AC'] },
      LYCEE: { weekly_hours: 4, coefficient: 1, levels: ['Tronc Commun', '1ère Bac', '2ème Bac'] },
    },
  },
  {
    id: 'subj-scie-p',
    code: 'EVEIL-SC',
    name: 'Éveil Scientifique',
    cycles: ['PRIMAIRE'],
    cycle: 'PRIMAIRE',
    weekly_hours: 2,
    coefficient: 1,
    color_code: '#14b8a6',
    room_type: 'Salle de classe / Labo',
    cycle_configs: {
      PRIMAIRE: { weekly_hours: 2, coefficient: 1, levels: ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6AP'] },
    },
  },
  {
    id: 'subj-islam',
    code: 'ISLAM',
    name: 'Éducation Islamique',
    cycles: ['PRIMAIRE', 'COLLEGE', 'LYCEE'],
    cycle: 'PRIMAIRE',
    weekly_hours: 2,
    coefficient: 1,
    color_code: '#0d9488',
    room_type: 'Salle de classe standard',
    cycle_configs: {
      PRIMAIRE: { weekly_hours: 2, coefficient: 1, levels: ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6AP'] },
      COLLEGE: { weekly_hours: 2, coefficient: 1, levels: ['1AC', '2AC', '3AC'] },
      LYCEE: { weekly_hours: 2, coefficient: 1, levels: ['Tronc Commun', '1ère Bac'] },
    },
  },
  {
    id: 'subj-hg',
    code: 'HG',
    name: 'Histoire - Géographie',
    cycles: ['PRIMAIRE', 'COLLEGE', 'LYCEE'],
    cycle: 'COLLEGE',
    weekly_hours: 3,
    coefficient: 1,
    color_code: '#ea580c',
    room_type: 'Salle de classe standard',
    cycle_configs: {
      PRIMAIRE: { weekly_hours: 1.5, coefficient: 1, levels: ['CE2', 'CM1', 'CM2', '6AP'] },
      COLLEGE: { weekly_hours: 3, coefficient: 1, levels: ['1AC', '2AC', '3AC'] },
      LYCEE: { weekly_hours: 2, coefficient: 1, levels: ['Tronc Commun', '1ère Bac'] },
    },
  },
  {
    id: 'subj-philo',
    code: 'PHILO',
    name: 'Philosophie',
    cycles: ['LYCEE'],
    cycle: 'LYCEE',
    weekly_hours: 2,
    coefficient: 1,
    color_code: '#d97706',
    room_type: 'Salle de classe standard',
    cycle_configs: {
      LYCEE: { weekly_hours: 2, coefficient: 1, levels: ['1ère Bac', '2ème Bac'] },
    },
  },
  {
    id: 'subj-info',
    code: 'INFO',
    name: 'Informatique & Robotique',
    cycles: ['PRIMAIRE', 'COLLEGE', 'LYCEE'],
    cycle: 'COLLEGE',
    weekly_hours: 2,
    coefficient: 1,
    color_code: '#06b6d4',
    room_type: 'Laboratoire Informatique & Robotique',
    cycle_configs: {
      PRIMAIRE: { weekly_hours: 1.5, coefficient: 1, levels: ['CE2', 'CM1', 'CM2', '6AP'] },
      COLLEGE: { weekly_hours: 2, coefficient: 1, levels: ['1AC', '2AC', '3AC'] },
      LYCEE: { weekly_hours: 2, coefficient: 1, levels: ['Tronc Commun'] },
    },
  },
  {
    id: 'subj-eps',
    code: 'EPS',
    name: 'Éducation Physique & Sportive (EPS)',
    cycles: ['MATERNELLE', 'PRIMAIRE', 'COLLEGE', 'LYCEE'],
    cycle: 'PRIMAIRE',
    weekly_hours: 2,
    coefficient: 1,
    color_code: '#e11d48',
    room_type: 'Terrain de Sport / Gymnase',
    cycle_configs: {
      MATERNELLE: { weekly_hours: 3, coefficient: 1, levels: ['TPS', 'PS', 'MS', 'GS'] },
      PRIMAIRE: { weekly_hours: 2, coefficient: 1, levels: ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6AP'] },
      COLLEGE: { weekly_hours: 2, coefficient: 1, levels: ['1AC', '2AC', '3AC'] },
      LYCEE: { weekly_hours: 2, coefficient: 1, levels: ['Tronc Commun', '1ère Bac', '2ème Bac'] },
    },
  },
  {
    id: 'subj-mat-eveil',
    code: 'MAT-EVEIL',
    name: 'Activités d\'Éveil & Langage',
    cycles: ['MATERNELLE'],
    cycle: 'MATERNELLE',
    weekly_hours: 6,
    coefficient: 1,
    color_code: '#38bdf8',
    room_type: 'Salle Maternelle / Motricité',
    cycle_configs: {
      MATERNELLE: { weekly_hours: 6, coefficient: 1, levels: ['TPS', 'PS', 'MS', 'GS'] },
    },
  },
  {
    id: 'subj-mat-art',
    code: 'MAT-ART',
    name: 'Éveil Musical & Arts Plastiques',
    cycles: ['MATERNELLE'],
    cycle: 'MATERNELLE',
    weekly_hours: 3,
    coefficient: 1,
    color_code: '#ec4899',
    room_type: 'Atelier d\'Art & Musique',
    cycle_configs: {
      MATERNELLE: { weekly_hours: 3, coefficient: 1, levels: ['TPS', 'PS', 'MS', 'GS'] },
    },
  },
];

const CYCLE_DEFINITIONS: { id: EducationCycle; label: string; icon: any; color: string; badge: string }[] = [
  { id: 'MATERNELLE', label: 'Maternelle', icon: Sparkles, color: 'text-sky-600 dark:text-sky-400', badge: 'TPS - GS' },
  { id: 'PRIMAIRE', label: 'Primaire', icon: School, color: 'text-blue-600 dark:text-blue-400', badge: 'CP - CE6' },
  { id: 'COLLEGE', label: 'Collège', icon: GraduationCap, color: 'text-orange-600 dark:text-orange-400', badge: '1AC - 3AC' },
  { id: 'LYCEE', label: 'Lycée', icon: Building2, color: 'text-purple-600 dark:text-purple-400', badge: 'TC - 2BAC' },
];

const CYCLE_TABS = [
  { id: 'ALL', label: 'Tous les Cycles', icon: Layers, color: 'text-slate-900 dark:text-white', badge: 'Vue Globale' },
  ...CYCLE_DEFINITIONS,
];

const ROOM_TYPE_OPTIONS = [
  'Salle de classe standard',
  'Laboratoire Physique-Chimie',
  'Laboratoire SVT',
  'Laboratoire Informatique & Robotique',
  'Salle Maternelle / Motricité',
  'Atelier d\'Art & Musique',
  'Terrain de Sport / Gymnase',
  'Amphithéâtre / Salle Polyvalente'
];

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState<EducationCycle | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    cycles: EducationCycle[];
    cycle_configs: Partial<Record<EducationCycle, CycleSubjectConfig>>;
    color_code: string;
    room_type: string;
  }>({
    code: '',
    name: '',
    cycles: ['PRIMAIRE'],
    cycle_configs: {
      PRIMAIRE: { weekly_hours: 5, coefficient: 1, levels: ['CP', 'CE1', 'CE2'] },
    },
    color_code: '#0284c7',
    room_type: 'Salle de classe standard',
  });

  const confirm = useConfirm();
  const notify = useNotify();

  // Load Subjects from Supabase
  async function loadSubjects() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('subjects').select('*').order('name');
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setSubjects(data as Subject[]);
      } else {
        setSubjects(DEFAULT_CURRICULUM);
      }
    } catch (err) {
      console.error('Error loading subjects:', err);
      setSubjects(DEFAULT_CURRICULUM);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubjects();
  }, []);


  // Helper to test if a subject matches the cycle
  const subjectHasCycle = (s: Subject, cycleId: EducationCycle | 'ALL') => {
    if (cycleId === 'ALL') return true;
    if (s.cycles && Array.isArray(s.cycles) && s.cycles.includes(cycleId)) return true;
    if (s.cycle === cycleId || s.cycle === 'ALL') return true;
    return false;
  };

  // Helper to extract effective weekly hours for active view
  const getSubjectHoursForCycle = (s: Subject, cycleId: EducationCycle | 'ALL'): number => {
    if (cycleId !== 'ALL' && s.cycle_configs && s.cycle_configs[cycleId]) {
      return Number(s.cycle_configs[cycleId]?.weekly_hours) || Number(s.weekly_hours) || 0;
    }
    if (s.cycles && s.cycles[0] && s.cycle_configs && s.cycle_configs[s.cycles[0]]) {
      return Number(s.cycle_configs[s.cycles[0]]?.weekly_hours) || Number(s.weekly_hours) || 0;
    }
    return Number(s.weekly_hours) || 0;
  };

  // Helper to extract levels for active view
  const getSubjectLevelsForCycle = (s: Subject, cycleId: EducationCycle | 'ALL'): string[] => {
    if (cycleId !== 'ALL' && s.cycle_configs && s.cycle_configs[cycleId]?.levels) {
      return s.cycle_configs[cycleId]?.levels || [];
    }
    if (s.cycle_configs) {
      const all: string[] = [];
      Object.values(s.cycle_configs).forEach((cfg) => {
        if (cfg?.levels) all.push(...cfg.levels);
      });
      if (all.length > 0) return Array.from(new Set(all));
    }
    return s.levels || [];
  };

  // Filtered Subjects based on Tab and Search
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const matchCycle = subjectHasCycle(s, selectedCycle);
      const allLevels = getSubjectLevelsForCycle(s, selectedCycle);
      const matchSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.room_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        allLevels.some((l) => l.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.cycles || []).some((c) => c.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchCycle && matchSearch;
    });
  }, [subjects, selectedCycle, searchTerm]);

  // Synthesis Stats for active view
  const currentStats = useMemo(() => {
    const totalCount = filteredSubjects.length;
    const totalHours = filteredSubjects.reduce((acc, s) => acc + getSubjectHoursForCycle(s, selectedCycle), 0);
    const uniqueRooms = new Set(filteredSubjects.map((s) => s.room_type || 'Salle de classe standard')).size;
    return { totalCount, totalHours, uniqueRooms };
  }, [filteredSubjects, selectedCycle]);

  // Open Modal for creation
  const openCreateModal = (presetCycle?: EducationCycle) => {
    setEditingId(null);
    const initialCycle: EducationCycle =
      presetCycle && presetCycle !== 'ALL'
        ? presetCycle
        : selectedCycle !== 'ALL'
        ? selectedCycle
        : 'PRIMAIRE';

    setFormData({
      code: '',
      name: '',
      cycles: [initialCycle],
      cycle_configs: {
        [initialCycle]: {
          weekly_hours: DEFAULT_HOURS_PER_CYCLE[initialCycle] || 5,
          coefficient: 1,
          levels: PRESET_LEVELS_MAP[initialCycle] || [],
        },
      },
      color_code: '#0284c7',
      room_type: 'Salle de classe standard',
    });
    setShowModal(true);
  };

  // Open Modal for edit
  const openEditModal = (s: Subject) => {
    setEditingId(s.id);
    const resolvedCycles: EducationCycle[] =
      s.cycles && Array.isArray(s.cycles) && s.cycles.length > 0
        ? s.cycles
        : s.cycle && s.cycle !== 'ALL'
        ? [s.cycle]
        : ['PRIMAIRE'];

    const configs: Partial<Record<EducationCycle, CycleSubjectConfig>> = { ...(s.cycle_configs || {}) };
    resolvedCycles.forEach((c) => {
      if (!configs[c]) {
        configs[c] = {
          weekly_hours: s.weekly_hours || DEFAULT_HOURS_PER_CYCLE[c] || 4,
          coefficient: 1,
          levels: PRESET_LEVELS_MAP[c] || [],
        };
      }
    });

    setFormData({
      code: s.code,
      name: s.name,
      cycles: resolvedCycles,
      cycle_configs: configs,
      color_code: s.color_code || '#0284c7',
      room_type: s.room_type || 'Salle de classe standard',
    });
    setShowModal(true);
  };

  // Toggle cycle inclusion
  const toggleCycleSelection = (c: EducationCycle) => {
    setFormData((prev) => {
      const exists = prev.cycles.includes(c);
      let newCycles: EducationCycle[] = [];
      const newConfigs = { ...prev.cycle_configs };

      if (exists) {
        if (prev.cycles.length === 1) return prev;
        newCycles = prev.cycles.filter((item) => item !== c);
        delete newConfigs[c];
      } else {
        newCycles = [...prev.cycles, c];
        newConfigs[c] = {
          weekly_hours: DEFAULT_HOURS_PER_CYCLE[c] || 4,
          coefficient: 1,
          levels: PRESET_LEVELS_MAP[c] || [],
        };
      }

      return {
        ...prev,
        cycles: newCycles,
        cycle_configs: newConfigs,
      };
    });
  };

  const selectAllCycles = () => {
    const allCycles: EducationCycle[] = ['MATERNELLE', 'PRIMAIRE', 'COLLEGE', 'LYCEE'];
    const newConfigs: Partial<Record<EducationCycle, CycleSubjectConfig>> = { ...formData.cycle_configs };
    allCycles.forEach((c) => {
      if (!newConfigs[c]) {
        newConfigs[c] = {
          weekly_hours: DEFAULT_HOURS_PER_CYCLE[c] || 4,
          coefficient: 1,
          levels: PRESET_LEVELS_MAP[c] || [],
        };
      }
    });

    setFormData((prev) => ({
      ...prev,
      cycles: allCycles,
      cycle_configs: newConfigs,
    }));
  };

  // Update specific cycle hours
  const updateCycleHours = (c: EducationCycle, hours: number) => {
    setFormData((prev) => ({
      ...prev,
      cycle_configs: {
        ...prev.cycle_configs,
        [c]: {
          weekly_hours: hours,
          coefficient: 1,
          levels: prev.cycle_configs[c]?.levels || PRESET_LEVELS_MAP[c] || [],
        },
      },
    }));
  };

  // Toggle specific level in cycle
  const toggleLevelInCycle = (c: EducationCycle, lvl: string) => {
    setFormData((prev) => {
      const currentLevels = prev.cycle_configs[c]?.levels || PRESET_LEVELS_MAP[c] || [];
      const exists = currentLevels.includes(lvl);
      const newLevels = exists
        ? currentLevels.filter((l) => l !== lvl)
        : [...currentLevels, lvl];

      return {
        ...prev,
        cycle_configs: {
          ...prev.cycle_configs,
          [c]: {
            weekly_hours: prev.cycle_configs[c]?.weekly_hours || DEFAULT_HOURS_PER_CYCLE[c] || 4,
            coefficient: 1,
            levels: newLevels,
          },
        },
      };
    });
  };

  const toggleAllLevelsOfCycle = (c: EducationCycle) => {
    setFormData((prev) => {
      const allLevels = PRESET_LEVELS_MAP[c] || [];
      const currentLevels = prev.cycle_configs[c]?.levels || [];
      const allSelected = allLevels.every((l) => currentLevels.includes(l));

      return {
        ...prev,
        cycle_configs: {
          ...prev.cycle_configs,
          [c]: {
            weekly_hours: prev.cycle_configs[c]?.weekly_hours || DEFAULT_HOURS_PER_CYCLE[c] || 4,
            coefficient: 1,
            levels: allSelected ? [] : [...allLevels],
          },
        },
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const code = formData.code.trim() || formData.name.substring(0, 4).toUpperCase();
      const primaryCycle = formData.cycles[0] || 'PRIMAIRE';
      const primaryConfig = formData.cycle_configs[primaryCycle] || {
        weekly_hours: 4,
        coefficient: 1,
      };

      const allLevels: string[] = [];
      Object.values(formData.cycle_configs).forEach((cfg) => {
        if (cfg?.levels) allLevels.push(...cfg.levels);
      });

      const newEntry: Partial<Subject> = {
        code: code,
        name: formData.name.trim(),
        cycle: primaryCycle,
        cycles: formData.cycles,
        levels: Array.from(new Set(allLevels)),
        weekly_hours: primaryConfig.weekly_hours,
        coefficient: 1,
        color_code: formData.color_code,
        room_type: formData.room_type,
        cycle_configs: formData.cycle_configs,
      };

      const supabase = createClient();
      
      if (editingId) {
        const { error } = await supabase.from('subjects').update(newEntry).eq('id', editingId);
        if (error) throw error;
        
        notify({
          title: 'Matière Modifiée',
          message: `Le volume horaire par cycle pour "${newEntry.name}" a été actualisé.`,
          type: 'success',
        });
      } else {
        const { error } = await supabase.from('subjects').insert([newEntry]);
        if (error) throw error;
        
        notify({
          title: 'Matière Ajoutée',
          message: `La matière "${newEntry.name}" a été enregistrée avec succès.`,
          type: 'success',
        });
      }

      loadSubjects();

      setShowModal(false);
      setEditingId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const handleDelete = async (id: string, name?: string) => {
    const ok = await confirm({
      title: 'Supprimer la matière',
      message: name
        ? `Êtes-vous sûr de vouloir supprimer "${name}" du programme pédagogique ?`
        : 'Supprimer cette matière ?',
      type: 'danger',
      confirmText: 'Supprimer définitivement',
      cancelText: 'Annuler',
    });
    if (!ok) return;

    const updated = subjects.filter((s) => s.id !== id);
    setSubjects(updated);
    notify({ title: 'Supprimée', message: 'Matière retirée du programme.', type: 'success' });

    try {
      const supabase = createClient();
      await supabase.from('subjects').delete().eq('id', id);
    } catch {
      // ignore
    }
  };

  // Export to Excel / CSV
  const handleExportCSV = () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const headers = [
        'Code Matière',
        'Nom de la Discipline',
        'Cycles Concernés',
        'Détail Heures par Cycle',
        'Niveaux / Classes',
        'Type de Salle Requis',
        'Date d\'Édition',
      ];

      const rows = filteredSubjects.map((s) => {
        const activeCycles = s.cycles && s.cycles.length > 0 ? s.cycles : s.cycle ? [s.cycle] : ['PRIMAIRE'];
        const details = activeCycles.map((c) => {
          const h = s.cycle_configs?.[c as EducationCycle]?.weekly_hours || s.weekly_hours || 4;
          return `${c}: ${h}h/sem`;
        }).join(' | ');

        const allLvs = getSubjectLevelsForCycle(s, selectedCycle);

        return [
          `"${s.code}"`,
          `"${s.name.replace(/"/g, '""')}"`,
          `"${activeCycles.join(', ')}"`,
          `"${details}"`,
          `"${allLvs.join(', ').replace(/"/g, '""')}"`,
          `"${(s.room_type || 'Salle Standard').replace(/"/g, '""')}"`,
          `"${today}"`,
        ].join(';');
      });

      const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Programme_Pedagogique_GM_${selectedCycle}_${today}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notify({ type: 'success', title: 'Export Réussi', message: 'Le programme pédagogique a été exporté en format Excel/CSV.' });
    } catch (err) {
      console.error(err);
      notify({ type: 'danger', title: 'Erreur', message: 'Impossible d\'exporter les données.' });
    }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    const today = new Date().toISOString().split('T')[0];
    document.title = `Programme_Pedagogique_GM_${selectedCycle}_${today}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1500);
  };

  return (
    <DashboardLayout>
      {/* Print Stylesheet */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 10mm 12mm !important;
          }
          header, aside, nav, .print\\:hidden {
            display: none !important;
          }
          .print-curriculum-sheet {
            display: block !important;
          }
        }
      `}</style>

      <div className="space-y-6 print:hidden">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              <BookOpen className="w-4 h-4" />
              <span>Ingénierie &amp; Programme Pédagogique par Cycle</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Programme Pédagogique &amp; Matières par Cycle
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Définissez les quotas d&apos;heures par semaine spécifiques pour chaque cycle (Maternelle, Primaire, Collège &amp; Lycée).
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Exporter Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 font-bold text-xs shadow-xs hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>Imprimer PDF</span>
            </button>

            <button
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/25 transition-all hover:scale-105 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter une Matière</span>
            </button>
          </div>
        </div>

        {/* Cycle Navigation Tabs Strip */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-3xl border border-slate-200 dark:border-slate-700/60 overflow-x-auto">
          {CYCLE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = selectedCycle === tab.id;
            const countInCycle =
              tab.id === 'ALL'
                ? subjects.length
                : subjects.filter((s) => subjectHasCycle(s, tab.id as EducationCycle)).length;

            return (
              <button
                key={tab.id}
                onClick={() => setSelectedCycle(tab.id as EducationCycle | 'ALL')}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md border border-slate-200 dark:border-slate-700 scale-100'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? tab.color : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isActive
                      ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {countInCycle}
                </span>
                {tab.badge && (
                  <span className="hidden sm:inline-block text-[9px] text-slate-400 font-normal">
                    ({tab.badge})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Synthesis KPI Ribbon for Active Cycle */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Matières du Cycle</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {currentStats.totalCount} Matières
              </div>
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Volume Hebdo ({selectedCycle === 'ALL' ? 'Moyen' : selectedCycle})
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {currentStats.totalHours} Heures / sem.
              </div>
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
              <DoorClosed className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Types de Locaux Requis</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {currentStats.uniqueRooms} Salles &amp; Labos
              </div>
            </div>
          </div>
        </div>

        {/* Filter & View Switcher Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher une matière, code, niveau ou cycle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs font-semibold rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Affichage :</span>
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Vue Cartes"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Vue Tableau"
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Section: Grid or Table */}
        {filteredSubjects.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Aucune matière trouvée</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Aucune discipline ne correspond aux filtres actuels. Vous pouvez ajouter une nouvelle matière pour ce cycle.
            </p>
            <button
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 text-white text-xs font-bold hover:bg-sky-600 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Créer une Matière</span>
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 items-stretch">
            {filteredSubjects.map((s) => {
              const activeCycles = s.cycles && s.cycles.length > 0 ? s.cycles : s.cycle ? [s.cycle] : ['PRIMAIRE'];
              const effectiveHours = getSubjectHoursForCycle(s, selectedCycle);
              const activeLevels = getSubjectLevelsForCycle(s, selectedCycle);

              return (
                <div
                  key={s.id}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden h-full min-h-[235px]"
                  style={{ borderTopColor: s.color_code, borderTopWidth: '4px' }}
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-[10px] font-black px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        {s.code}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-3.5 h-3.5 rounded-full shadow-xs ring-2 ring-white dark:ring-slate-900"
                          style={{ backgroundColor: s.color_code }}
                          title="Couleur d'identification"
                        />
                      </div>
                    </div>

                    {/* Subject Name */}
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight mt-1">
                      {s.name}
                    </h3>

                    {/* Multi-Cycles Quota Breakdown Chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {activeCycles.map((cyc, idx) => {
                        const cycHours = s.cycle_configs?.[cyc as EducationCycle]?.weekly_hours || s.weekly_hours || 4;
                        const isCurrentActiveCycle = selectedCycle === cyc;

                        return (
                          <div
                            key={idx}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all ${
                              isCurrentActiveCycle
                                ? 'bg-sky-500 text-white border-sky-400 shadow-xs'
                                : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="font-black uppercase">{cyc.substring(0, 4)}. :</span>{' '}
                            <span className="underline decoration-sky-400 font-extrabold">{cycHours}h / sem</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Levels Badges */}
                    {activeLevels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {activeLevels.slice(0, 6).map((lvl, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-bold"
                          >
                            {lvl}
                          </span>
                        ))}
                        {activeLevels.length > 6 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[9px] font-bold">
                            +{activeLevels.length - 6}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Quotas for Selected View */}
                    <div className="mt-3.5 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <span className="flex items-center gap-1.5 font-medium text-[11px]">
                          <Clock className="w-4 h-4 text-sky-500" /> Volume Hebdo ({selectedCycle === 'ALL' ? 'Base' : selectedCycle}) :
                        </span>
                        <strong className="text-slate-900 dark:text-white font-black text-sm">
                          {effectiveHours}h / sem.
                        </strong>
                      </div>

                      {s.room_type && (
                        <div className="text-[10.5px] text-slate-400 truncate pt-0.5">
                          📍 {s.room_type}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">Actions</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(s)}
                        title="Modifier la matière et heures par cycle"
                        className="p-1.5 text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-white rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id, s.name)}
                        title="Supprimer la matière"
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/75 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 px-4 font-bold uppercase tracking-wider">Code</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider">Discipline / Matière</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider">Volume d&apos;Heures par Cycle</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider">Niveaux Concernés</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">Quota Actif</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider">Salle Recommandée</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSubjects.map((s) => {
                  const activeCycles = s.cycles && s.cycles.length > 0 ? s.cycles : s.cycle ? [s.cycle] : ['PRIMAIRE'];
                  const effectiveHours = getSubjectHoursForCycle(s, selectedCycle);
                  const activeLevels = getSubjectLevelsForCycle(s, selectedCycle);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-black text-slate-800 dark:text-slate-200">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          {s.code}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color_code }} />
                          <span className="font-bold text-slate-900 dark:text-white">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {activeCycles.map((cyc, idx) => {
                            const h = s.cycle_configs?.[cyc as EducationCycle]?.weekly_hours || s.weekly_hours || 4;
                            return (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold"
                              >
                                {cyc}: <strong className="text-sky-600 dark:text-sky-400">{h}h/sem</strong>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {activeLevels.map((lvl, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-semibold">
                              {lvl}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-black text-slate-900 dark:text-white text-sm">
                        {effectiveHours}h / sem.
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {s.room_type || 'Salle standard'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(s)}
                            className="p-1.5 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id, s.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal Add / Edit Subject with Cycle-by-Cycle Hours Quotas */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 my-auto max-h-[92vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {editingId ? 'Paramétrer la Matière & Heures par Cycle' : 'Nouvelle Matière & Heures par Cycle'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Définissez le quota d&apos;heures par semaine propre à chaque cycle
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                {/* 1. Name and Code */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nom de la Discipline / Matière
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ex: Mathématiques, Français, SVT..."
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Code Court
                    </label>
                    <input
                      type="text"
                      placeholder="ex: MATH"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {/* 2. Multi-Cycle Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      1. Cycles Pédagogiques Concernés (Cochez un ou plusieurs)
                    </label>
                    <button
                      type="button"
                      onClick={selectAllCycles}
                      className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      Sélectionner Tous les Cycles
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CYCLE_DEFINITIONS.map((c) => {
                      const isSelected = formData.cycles.includes(c.id);
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => toggleCycleSelection(c.id)}
                          className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                            isSelected
                              ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white border-sky-500 shadow-md shadow-sky-500/25 ring-2 ring-sky-400/40'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                            <span>{c.label}</span>
                          </div>
                          <span className={`text-[9px] font-normal ${isSelected ? 'text-sky-100' : 'text-slate-400'}`}>
                            {c.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Cycle-by-Cycle Hours & Levels Configuration */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    2. Quota d&apos;Heures Hebdomadaires spécifique pour chaque Cycle
                  </label>

                  <div className="space-y-3">
                    {formData.cycles.map((cyc) => {
                      const cfg = formData.cycle_configs[cyc] || {
                        weekly_hours: DEFAULT_HOURS_PER_CYCLE[cyc] || 4,
                        coefficient: 1,
                        levels: PRESET_LEVELS_MAP[cyc] || [],
                      };
                      const allLevelsOfCycle = PRESET_LEVELS_MAP[cyc] || [];
                      const selectedLevels = cfg.levels || [];
                      const allSelected = allLevelsOfCycle.every((l) => selectedLevels.includes(l));

                      const cycleTitle =
                        cyc === 'MATERNELLE'
                          ? '🎨 Cycle Maternelle'
                          : cyc === 'PRIMAIRE'
                          ? '🎒 Cycle Primaire'
                          : cyc === 'COLLEGE'
                          ? '🎓 Cycle Collège'
                          : '🏛️ Cycle Lycée';

                      return (
                        <div
                          key={cyc}
                          className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5"
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-700">
                            <span className="font-black text-xs text-sky-600 dark:text-sky-400">
                              {cycleTitle}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              Heures par semaine pour ce cycle
                            </span>
                          </div>

                          {/* Hours Input */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Nombre d&apos;Heures par Semaine ({cyc})
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0.5"
                                step="0.5"
                                required
                                value={cfg.weekly_hours}
                                onChange={(e) =>
                                  updateCycleHours(cyc, Number(e.target.value))
                                }
                                className="w-full px-3.5 py-2 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                                Heures / semaine
                              </span>
                            </div>
                          </div>

                          {/* Levels chips */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                Classes concernées ({cyc}) :
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleAllLevelsOfCycle(cyc)}
                                className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                              >
                                {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                              </button>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {allLevelsOfCycle.map((lvl) => {
                                const isSelected = selectedLevels.includes(lvl);
                                return (
                                  <button
                                    type="button"
                                    key={lvl}
                                    onClick={() => toggleLevelInCycle(cyc, lvl)}
                                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-800'
                                        : 'bg-white dark:bg-slate-900 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700'
                                    }`}
                                  >
                                    {isSelected ? '✓ ' : '+ '}
                                    {lvl}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Room Type and Color */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Type de Salle Requis
                    </label>
                    <select
                      value={formData.room_type}
                      onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                    >
                      {ROOM_TYPE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Couleur
                    </label>
                    <input
                      type="color"
                      value={formData.color_code}
                      onChange={(e) => setFormData({ ...formData, color_code: e.target.value })}
                      className="w-full h-9 p-1 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-black text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 rounded-xl shadow-md shadow-sky-500/25 transition-all cursor-pointer"
                  >
                    {editingId ? 'Enregistrer les Quotas' : 'Ajouter au Programme'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* OFFICIAL PRINT SHEET (PROGRAMME PÉDAGOGIQUE A4) */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden print-curriculum-sheet text-black bg-white p-6 space-y-4">
        {/* Banner */}
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo GM" className="w-14 h-14 object-contain" />
            <div>
              <h1 className="text-base font-black uppercase">GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES</h1>
              <p className="text-[10pt] font-bold text-gray-800">
                Direction Pédagogique &bull; Décret des Disciplines &amp; Volumes Horaires par Cycle
              </p>
              <p className="text-[9pt] text-gray-600">
                Cycle : {selectedCycle === 'ALL' ? 'Tous les Cycles Pédagogiques' : selectedCycle} &bull; Année 2025-2026
              </p>
            </div>
          </div>
          <div className="text-right border-2 border-black px-3 py-1.5 rounded-lg">
            <div className="font-black text-xs">RÉF : PROG-PEDAG-2026</div>
            <div className="text-[9pt]">Date : {new Date().toLocaleDateString('fr-FR')}</div>
          </div>
        </div>

        {/* Synthesis Table */}
        <table className="w-full text-xs border-2 border-black border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-black font-black text-black">
              <th className="py-2 px-3 border-r border-black">Code</th>
              <th className="py-2 px-3 border-r border-black">Matière / Discipline</th>
              <th className="py-2 px-3 border-r border-black">Quotas d&apos;Heures par Cycle</th>
              <th className="py-2 px-3 border-r border-black">Niveaux Concernés</th>
              <th className="py-2 px-3 border-r border-black text-center">Quota Actif</th>
              <th className="py-2 px-3">Salle Requise</th>
            </tr>
          </thead>
          <tbody>
            {filteredSubjects.map((s, idx) => {
              const activeCycles = s.cycles && s.cycles.length > 0 ? s.cycles : s.cycle ? [s.cycle] : ['PRIMAIRE'];
              const effectiveHours = getSubjectHoursForCycle(s, selectedCycle);
              const activeLevels = getSubjectLevelsForCycle(s, selectedCycle);

              const breakdown = activeCycles.map((c) => {
                const h = s.cycle_configs?.[c as EducationCycle]?.weekly_hours || s.weekly_hours || 4;
                return `${c}: ${h}h/sem`;
              }).join(' | ');

              return (
                <tr key={idx} className="border-b border-black">
                  <td className="py-1.5 px-3 border-r border-black font-mono font-bold">{s.code}</td>
                  <td className="py-1.5 px-3 border-r border-black font-bold">{s.name}</td>
                  <td className="py-1.5 px-3 border-r border-black font-semibold text-[9pt]">{breakdown}</td>
                  <td className="py-1.5 px-3 border-r border-black">{activeLevels.join(', ')}</td>
                  <td className="py-1.5 px-3 border-r border-black text-center font-bold">{effectiveHours}h / sem.</td>
                  <td className="py-1.5 px-3">{s.room_type || 'Salle standard'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-between items-center p-3 border-2 border-black font-bold text-xs bg-gray-50">
          <span>Total Matières Programmées : {currentStats.totalCount}</span>
          <span>Volume Horaire ({selectedCycle}) : {currentStats.totalHours} Heures / semaine</span>
          <span>Types de Salles : {currentStats.uniqueRooms}</span>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-4">
          <div className="border-2 border-black p-3 rounded-lg h-24 flex flex-col justify-between text-xs">
            <div className="font-bold">Visa du Responsable Pédagogique :</div>
            <div className="text-[9pt] text-gray-500">Date, Signature &amp; Cachet</div>
          </div>

          <div className="border-2 border-black p-3 rounded-lg h-24 flex flex-col justify-between text-xs">
            <div className="font-bold">Approbation de la Direction Générale :</div>
            <div className="text-[9pt] text-gray-500">Cachet officiel de l&apos;Établissement</div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
