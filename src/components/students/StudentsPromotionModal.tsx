'use client';

import React, { useState, useEffect } from 'react';
import { ClassEntity, Student } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { logAuditEvent } from '@/lib/audit';
import {
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Users,
  Building2,
  Check,
  Scale,
  Sparkles,
  UserCheck,
  UserX,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

export const NEXT_LEVEL_MAP: Record<string, string> = {
  'TPS': 'PS',
  'PS': 'MS',
  'MS': 'GS',
  'GS': 'CP',
  'CP': 'CE1',
  'CE1': 'CE2',
  'CE2': 'CM1',
  'CM1': 'CM2',
  'CM2': 'CE6',
  'CE6': '1AC',
  '1AC': '2AC',
  '2AC': '3AC',
  '3AC': 'Tronc Commun Sciences',
  'TCS': '1ère Bac Sciences Exp',
  'TCL': '1ère Bac Lettres',
};

interface StudentPromotionDecision {
  student: Student;
  status: 'PROMOTED_PRIMARY' | 'PROMOTED_SECONDARY' | 'RETAINED' | 'GRADUATED';
}

interface StudentsPromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassEntity[];
  initialSourceClassId?: string;
  onPromotionComplete: () => void;
  notify: (opts: { title: string; message: string; type?: 'info' | 'success' | 'warning' | 'danger' }) => void;
}

export function StudentsPromotionModal({
  isOpen,
  onClose,
  classes,
  initialSourceClassId,
  onPromotionComplete,
  notify,
}: StudentsPromotionModalProps) {
  const [sourceClassId, setSourceClassId] = useState<string>(initialSourceClassId || classes[0]?.id || '');
  const [targetClassIdPrimary, setTargetClassIdPrimary] = useState<string>('');
  const [enableDualGroupSplit, setEnableDualGroupSplit] = useState<boolean>(false);
  const [targetClassIdSecondary, setTargetClassIdSecondary] = useState<string>('');

  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [sourceStudents, setSourceStudents] = useState<Student[]>([]);
  const [decisions, setDecisions] = useState<Record<string, StudentPromotionDecision>>({});
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Update source class if initialSourceClassId changes
  useEffect(() => {
    if (initialSourceClassId) {
      setSourceClassId(initialSourceClassId);
    }
  }, [initialSourceClassId]);

  // Load students for selected source class
  useEffect(() => {
    if (!sourceClassId || !isOpen) return;

    async function fetchClassStudents() {
      setLoadingStudents(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('students')
          .select('*, class:classes(*)')
          .eq('class_id', sourceClassId)
          .order('last_name');

        if (error) throw error;

        const list = data || [];
        setSourceStudents(list);

        // Compute recommended next target class
        const currentClass = classes.find((c) => c.id === sourceClassId);
        if (currentClass) {
          const nextLevel = NEXT_LEVEL_MAP[currentClass.level] || '';
          const sameGroup = currentClass.group_name || 'A';
          const oppositeGroup = sameGroup === 'A' ? 'B' : 'A';

          const suggestedPrimary = classes.find(
            (c) => (c.level === nextLevel || c.name.includes(nextLevel)) && c.group_name === sameGroup
          );
          const suggestedSecondary = classes.find(
            (c) => (c.level === nextLevel || c.name.includes(nextLevel)) && c.group_name === oppositeGroup
          );

          if (suggestedPrimary) {
            setTargetClassIdPrimary(suggestedPrimary.id);
          } else {
            const anyNextClass = classes.find((c) => c.level === nextLevel || c.name.includes(nextLevel));
            setTargetClassIdPrimary(anyNextClass?.id || classes.find((c) => c.id !== sourceClassId)?.id || '');
          }

          if (suggestedSecondary) {
            setTargetClassIdSecondary(suggestedSecondary.id);
          }
        }

        // Initialize decisions as 100% promoted to primary target
        const initDecisions: Record<string, StudentPromotionDecision> = {};
        list.forEach((s) => {
          initDecisions[s.id] = {
            student: s,
            status: 'PROMOTED_PRIMARY',
          };
        });
        setDecisions(initDecisions);
      } catch (err: unknown) {
        console.error(err);
      } finally {
        setLoadingStudents(false);
      }
    }

    fetchClassStudents();
  }, [sourceClassId, isOpen, classes]);

  if (!isOpen) return null;

  const currentClass = classes.find((c) => c.id === sourceClassId);
  const targetClassPrimary = classes.find((c) => c.id === targetClassIdPrimary);
  const targetClassSecondary = classes.find((c) => c.id === targetClassIdSecondary);

  // Distribution Algorithms
  const handleSetAllPromotedPrimary = () => {
    setDecisions((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        next[k] = { ...next[k], status: 'PROMOTED_PRIMARY' };
      });
      return next;
    });
  };

  const handleBalance5050 = () => {
    if (!enableDualGroupSplit || !targetClassIdSecondary) {
      setEnableDualGroupSplit(true);
    }
    const studentList = [...sourceStudents];
    const nextDecisions: Record<string, StudentPromotionDecision> = {};
    const half = Math.ceil(studentList.length / 2);

    studentList.forEach((s, idx) => {
      const isRetained = decisions[s.id]?.status === 'RETAINED';
      nextDecisions[s.id] = {
        student: s,
        status: isRetained ? 'RETAINED' : idx < half ? 'PROMOTED_PRIMARY' : 'PROMOTED_SECONDARY',
      };
    });
    setDecisions(nextDecisions);
    notify({
      title: 'Répartition 50% / 50% Appliquée',
      message: `Les élèves ont été divisés à parts égales entre ${targetClassPrimary?.name} et ${targetClassSecondary?.name || 'le 2ème groupe'}.`,
      type: 'info',
    });
  };

  const handleBalanceGenderParity = () => {
    if (!enableDualGroupSplit || !targetClassIdSecondary) {
      setEnableDualGroupSplit(true);
    }
    const girls = sourceStudents.filter((s) => s.gender === 'F');
    const boys = sourceStudents.filter((s) => s.gender !== 'F');

    const nextDecisions: Record<string, StudentPromotionDecision> = {};

    girls.forEach((s, idx) => {
      const isRetained = decisions[s.id]?.status === 'RETAINED';
      nextDecisions[s.id] = {
        student: s,
        status: isRetained ? 'RETAINED' : idx % 2 === 0 ? 'PROMOTED_PRIMARY' : 'PROMOTED_SECONDARY',
      };
    });

    boys.forEach((s, idx) => {
      const isRetained = decisions[s.id]?.status === 'RETAINED';
      nextDecisions[s.id] = {
        student: s,
        status: isRetained ? 'RETAINED' : idx % 2 === 0 ? 'PROMOTED_PRIMARY' : 'PROMOTED_SECONDARY',
      };
    });

    setDecisions(nextDecisions);
    notify({
      title: 'Parité Garçons / Filles Équilibrée',
      message: 'Les filles et les garçons ont été répartis équitablement entre les deux groupes.',
      type: 'success',
    });
  };

  const handleBalanceAlphabetical = () => {
    if (!enableDualGroupSplit || !targetClassIdSecondary) {
      setEnableDualGroupSplit(true);
    }
    const sorted = [...sourceStudents].sort((a, b) =>
      `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
    );
    const nextDecisions: Record<string, StudentPromotionDecision> = {};
    sorted.forEach((s, idx) => {
      const isRetained = decisions[s.id]?.status === 'RETAINED';
      nextDecisions[s.id] = {
        student: s,
        status: isRetained ? 'RETAINED' : idx % 2 === 0 ? 'PROMOTED_PRIMARY' : 'PROMOTED_SECONDARY',
      };
    });
    setDecisions(nextDecisions);
  };

  // Summary Metrics
  const primaryCount = Object.values(decisions).filter((d) => d.status === 'PROMOTED_PRIMARY').length;
  const secondaryCount = Object.values(decisions).filter((d) => d.status === 'PROMOTED_SECONDARY').length;
  const retainedCount = Object.values(decisions).filter((d) => d.status === 'RETAINED').length;

  const handleExecutePromotion = async () => {
    if (sourceStudents.length === 0) return;
    if (!targetClassIdPrimary) {
      notify({ title: 'Attention', message: 'Veuillez sélectionner la classe de destination.', type: 'warning' });
      return;
    }

    setIsExecuting(true);
    try {
      const supabase = createClient();

      const updates: Array<{ id: string; class_id: string }> = [];

      Object.values(decisions).forEach((d) => {
        if (d.status === 'PROMOTED_PRIMARY') {
          updates.push({ id: d.student.id, class_id: targetClassIdPrimary });
        } else if (d.status === 'PROMOTED_SECONDARY' && targetClassIdSecondary) {
          updates.push({ id: d.student.id, class_id: targetClassIdSecondary });
        }
        // If RETAINED, class_id remains unchanged in source class
      });

      // Execute updates in parallel batches
      const BATCH_SIZE = 40;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((u) => supabase.from('students').update({ class_id: u.class_id }).eq('id', u.id))
        );
      }

      await logAuditEvent({
        action: 'STUDENTS_COLLECTIVE_PROMOTION',
        entity_type: 'students',
        details: {
          source_class: currentClass?.name,
          target_class_primary: targetClassPrimary?.name,
          target_class_secondary: targetClassSecondary?.name,
          promoted_count: updates.length,
          retained_count: retainedCount,
        },
      });

      notify({
        title: 'Promotion Réussie ! 🎓',
        message: `${updates.length} élèves ont été promus avec succès (${primaryCount} vers ${targetClassPrimary?.name}${enableDualGroupSplit && targetClassSecondary ? `, ${secondaryCount} vers ${targetClassSecondary.name}` : ''}). ${retainedCount > 0 ? `${retainedCount} élèves maintenus.` : ''}`,
        type: 'success',
      });

      onPromotionComplete();
      onClose();
    } catch (err: unknown) {
      notify({
        title: 'Erreur lors de la promotion',
        message: err instanceof Error ? err.message : 'Erreur base de données',
        type: 'danger',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const filteredStudents = sourceStudents.filter((s) =>
    `${s.first_name} ${s.last_name} ${s.student_code}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full p-5 sm:p-7 space-y-5 my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 text-white shadow-md shadow-indigo-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Promotion Collective &amp; Répartition des Classes
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  Passage de Niveau
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Transférez les élèves admis vers le niveau supérieur, gérez les redoublants et équilibrez les effectifs entre les groupes (GA / GB).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Class Pathway Mapping Configuration Bar */}
          <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Source Class */}
              <div className="md:col-span-5 space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
                  1. Classe d&apos;Origine (Classe Actuelle)
                </label>
                <select
                  value={sourceClassId}
                  onChange={(e) => setSourceClassId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl text-xs font-black border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 shadow-xs"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.level}) &bull; {c.group_name ? `Groupe ${c.group_name}` : 'Classe'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Arrow Indicator */}
              <div className="md:col-span-2 flex justify-center items-center pt-3 md:pt-4">
                <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>

              {/* Destination Target Class (Primary) */}
              <div className="md:col-span-5 space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
                  2. Classe de Destination (Niveau Supérieur)
                </label>
                <select
                  value={targetClassIdPrimary}
                  onChange={(e) => setTargetClassIdPrimary(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl text-xs font-black border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-indigo-950 dark:text-indigo-200 focus:ring-2 focus:ring-indigo-500 shadow-xs"
                >
                  {classes
                    .filter((c) => c.id !== sourceClassId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.level}) &bull; {c.group_name ? `Groupe ${c.group_name}` : 'Classe'}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Optional Dual Group Splitting Checkbox & Target 2 */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={enableDualGroupSplit}
                  onChange={(e) => setEnableDualGroupSplit(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Diviser / Répartir les élèves entre deux groupes (ex: Groupe A &amp; Groupe B)</span>
              </label>

              {enableDualGroupSplit && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">2ème Groupe :</span>
                  <select
                    value={targetClassIdSecondary}
                    onChange={(e) => setTargetClassIdSecondary(e.target.value)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-purple-950 dark:text-purple-200"
                  >
                    <option value="">Sélectionner le 2ème groupe...</option>
                    {classes
                      .filter((c) => c.id !== sourceClassId && c.id !== targetClassIdPrimary)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.level})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Smart Balancer & Quick Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/50">
            <div className="text-xs font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Outils de Répartition Rapide :</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSetAllPromotedPrimary}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>100% Admis vers {targetClassPrimary?.name || 'Cible'}</span>
              </button>

              {enableDualGroupSplit && (
                <>
                  <button
                    type="button"
                    onClick={handleBalance5050}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Équilibrer 50/50</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBalanceGenderParity}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Parité Filles / Garçons</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBalanceAlphabetical}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span>🔤 Ordre A-Z</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Real-time Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-bold uppercase text-slate-500">Effectif Actuel</div>
              <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                {sourceStudents.length} élèves
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60">
              <div className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 truncate">
                Vers {targetClassPrimary?.name || 'Groupe 1'}
              </div>
              <div className="text-lg font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                {primaryCount} élèves
              </div>
            </div>

            {enableDualGroupSplit && (
              <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
                <div className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400 truncate">
                  Vers {targetClassSecondary?.name || 'Groupe 2'}
                </div>
                <div className="text-lg font-black text-purple-700 dark:text-purple-300 mt-0.5">
                  {secondaryCount} élèves
                </div>
              </div>
            )}

            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
              <div className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
                Redoublants (Maintien)
              </div>
              <div className="text-lg font-black text-amber-800 dark:text-amber-300 mt-0.5">
                {retainedCount} élèves
              </div>
            </div>
          </div>

          {/* Search bar inside students list */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <input
              type="text"
              placeholder="Rechercher un élève par nom, code Massar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* Students Table with Decision Selectors */}
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            {loadingStudents ? (
              <div className="p-12 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Chargement des élèves de la classe...</span>
              </div>
            ) : sourceStudents.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs font-bold">
                Aucun élève inscrit dans cette classe d&apos;origine.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Élève</th>
                    <th className="py-2.5 px-3">Genre</th>
                    <th className="py-2.5 px-3">Code Massar</th>
                    <th className="py-2.5 px-3 text-right">Statut &amp; Destination</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {filteredStudents.map((student, idx) => {
                    const dec = decisions[student.id]?.status || 'PROMOTED_PRIMARY';
                    return (
                      <tr key={student.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <div className="font-black text-slate-900 dark:text-white">
                            {student.first_name} {student.last_name}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              student.gender === 'F'
                                ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {student.gender === 'F' ? 'Fille' : 'Garçon'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-xs font-bold text-slate-500">
                          {student.student_code}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <select
                            value={dec}
                            onChange={(e) =>
                              setDecisions((prev) => ({
                                ...prev,
                                [student.id]: {
                                  student,
                                  status: e.target.value as StudentPromotionDecision['status'],
                                },
                              }))
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                              dec === 'PROMOTED_PRIMARY'
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                                : dec === 'PROMOTED_SECONDARY'
                                ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                            }`}
                          >
                            <option value="PROMOTED_PRIMARY">
                              ✅ Admis ➔ {targetClassPrimary?.name || 'Classe Cible'}
                            </option>
                            {enableDualGroupSplit && (
                              <option value="PROMOTED_SECONDARY">
                                🟣 Admis ➔ {targetClassSecondary?.name || '2ème Groupe'}
                              </option>
                            )}
                            <option value="RETAINED">
                              ⚠️ Redoublant (Maintien dans {currentClass?.name})
                            </option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleExecutePromotion}
            disabled={isExecuting || sourceStudents.length === 0}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-black text-xs shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 cursor-pointer disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Enregistrement dans Supabase...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>
                  Confirmer et Transférer les {primaryCount + secondaryCount} Élèves Admis
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
