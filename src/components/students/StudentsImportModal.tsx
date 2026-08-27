'use client';

import React, { useState, useRef } from 'react';
import { ClassEntity } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { logAuditEvent } from '@/lib/audit';
import {
  parseStudentsExcel,
  generateStudentExcelTemplate,
  ParsedImportResult,
  ParsedStudentRow,
} from '@/lib/student-import';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  Building2,
  Check,
  Zap,
} from 'lucide-react';

interface StudentsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassEntity[];
  onImportComplete: () => void;
  notify: (opts: { title: string; message: string; type?: 'info' | 'success' | 'warning' | 'danger' }) => void;
}

export function StudentsImportModal({
  isOpen,
  onClose,
  classes,
  onImportComplete,
  notify,
}: StudentsImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parsedResult, setParsedResult] = useState<ParsedImportResult | null>(null);
  const [previewFilterClass, setPreviewFilterClass] = useState<string>('ALL');
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importMode, setImportMode] = useState<'UPSERT' | 'REPLACE_ALL'>('UPSERT');

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = async (file: File) => {
    setFileName(file.name);
    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseStudentsExcel(buffer, classes);
      setParsedResult(result);
      if (result.validRows.length === 0) {
        notify({
          title: 'Aucun élève valide',
          message: 'Le fichier ne contient aucun élève avec une classe reconnue.',
          type: 'warning',
        });
      } else {
        notify({
          title: 'Fichier analysé avec succès',
          message: `${result.validRows.length} élèves détectés et répartis sur ${Object.keys(result.classStats).length} classes.`,
          type: 'success',
        });
      }
    } catch (err: unknown) {
      notify({
        title: "Erreur de lecture du fichier",
        message: err instanceof Error ? err.message : 'Fichier Excel invalide',
        type: 'danger',
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleLoadSampleFile = async () => {
    setIsParsing(true);
    setFileName('eleves(1).xlsx (Fichier Primaire GM)');
    try {
      const res = await fetch('/api/students/import-sample');
      if (!res.ok) throw new Error('Impossible de charger le fichier exemple.');
      const buffer = await res.arrayBuffer();
      const result = parseStudentsExcel(buffer, classes);
      setParsedResult(result);
      notify({
        title: 'Fichier Primaire Chargé',
        message: `${result.validRows.length} élèves prêts à être importés dans leurs classes respectives.`,
        type: 'success',
      });
    } catch (err: unknown) {
      notify({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Erreur lors du chargement du fichier',
        type: 'danger',
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleDownloadTemplate = () => {
    try {
      const templateBytes = generateStudentExcelTemplate();
      const blob = new Blob([templateBytes as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Modele_Import_Eleves_GM.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      notify({ title: 'Erreur', message: 'Impossible de générer le modèle.', type: 'danger' });
    }
  };

  const handleExecuteImport = async () => {
    if (!parsedResult || parsedResult.validRows.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      const supabase = createClient();
      const rowsToInsert = parsedResult.validRows;

      if (importMode === 'REPLACE_ALL') {
        // Clear existing students
        await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }

      const BATCH_SIZE = 50;
      let insertedCount = 0;

      for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
        const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
        const payload = batch.map((r) => ({
          student_code: r.student_code,
          first_name: r.first_name,
          last_name: r.last_name,
          gender: r.gender,
          phone: r.phone || null,
          guardian_phone: r.guardian_phone || null,
          class_id: r.class_id,
          status: 'ACTIVE',
        }));

        const { error } = await supabase
          .from('students')
          .upsert(payload, { onConflict: 'student_code' });

        if (error) throw error;

        insertedCount += batch.length;
        setImportProgress(Math.round((insertedCount / rowsToInsert.length) * 100));
      }

      await logAuditEvent({
        action: 'STUDENTS_BULK_IMPORTED_EXCEL',
        entity_type: 'students',
        details: {
          total_imported: rowsToInsert.length,
          fileName,
          classes_count: Object.keys(parsedResult.classStats).length,
        },
      });

      notify({
        title: 'Importation réussie ! 🎉',
        message: `${rowsToInsert.length} élèves ont été importés et assignés à leurs classes avec succès.`,
        type: 'success',
      });

      onImportComplete();
      onClose();
    } catch (err: unknown) {
      notify({
        title: "Erreur lors de l'importation",
        message: err instanceof Error ? err.message : 'Erreur base de données',
        type: 'danger',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const filteredPreviewRows = parsedResult
    ? parsedResult.validRows.filter((r) => {
        const matchesClass = previewFilterClass === 'ALL' || r.matched_class_name === previewFilterClass;
        const matchesSearch =
          previewSearch === '' ||
          `${r.first_name} ${r.last_name} ${r.student_code} ${r.raw_class_group} ${r.phone || ''} ${r.guardian_phone || ''}`
            .toLowerCase()
            .includes(previewSearch.toLowerCase());
        return matchesClass && matchesSearch;
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full p-5 sm:p-7 space-y-6 my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Importer les Élèves depuis Excel (.xlsx)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Smart Auto-Matcher
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Importez la liste complète avec détection automatique des classes, groupes (GA / GB) et numéros de téléphone multiples (1, 2 ou 3+).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-5 overflow-y-auto pr-1 flex-1">
          {/* Upload / Quick Select Box */}
          {!parsedResult && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 group-hover:text-emerald-600 group-hover:scale-110 shadow-sm transition-transform">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    Glissez-déposez votre fichier Excel ici, ou <span className="text-emerald-600 dark:text-emerald-400 underline">parcourir</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Prend en charge les colonnes : <strong className="text-slate-600 dark:text-slate-300">Classe/Groupe</strong>, <strong className="text-slate-600 dark:text-slate-300">Elve</strong>, <strong className="text-slate-600 dark:text-slate-300">Identifiant</strong>, <strong className="text-slate-600 dark:text-slate-300">Tel Parent</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons: 1-Click Load & Template Download */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleLoadSampleFile}
                  disabled={isParsing}
                  className="p-4 rounded-2xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-emerald-500/10 border border-sky-200 dark:border-sky-800/60 hover:border-sky-400 text-left transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-sky-500 text-white shadow-xs group-hover:scale-105 transition-transform">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        Charger la Liste Primaire Locale
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        243 élèves &bull; CP, CE1, CE2, CM1, CM2, 6ème (GA &amp; GB)
                      </div>
                    </div>
                  </div>
                  <Sparkles className="w-4 h-4 text-sky-500 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-left transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 group-hover:scale-105 transition-transform">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        Télécharger le Modèle Excel
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Format type (.xlsx) avec exemples
                      </div>
                    </div>
                  </div>
                  <FileSpreadsheet className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              </div>
            </div>
          )}

          {/* PARSED PREVIEW REPORT */}
          {parsedResult && (
            <div className="space-y-4">
              {/* Top summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <Users className="w-4 h-4" />
                    <span>Total Élèves</span>
                  </div>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
                    {parsedResult.validRows.length}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60">
                  <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 text-xs font-bold">
                    <Building2 className="w-4 h-4" />
                    <span>Classes Reconnues</span>
                  </div>
                  <div className="text-xl font-black text-sky-700 dark:text-sky-300 mt-1 font-mono">
                    {Object.keys(parsedResult.classStats).length} classes
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                    <Phone className="w-4 h-4" />
                    <span>Numéros Multiples</span>
                  </div>
                  <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-1 font-mono">
                    {parsedResult.phoneStats.double + parsedResult.phoneStats.multiple} élèves
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Sans Numéro</span>
                  </div>
                  <div className="text-xl font-black text-slate-700 dark:text-slate-300 mt-1 font-mono">
                    {parsedResult.phoneStats.zero} élèves
                  </div>
                </div>
              </div>

              {/* Class Distribution Tags */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Répartition par Classe &amp; Groupe :
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(parsedResult.classStats).map(([cName, count]) => (
                    <span
                      key={cName}
                      className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs flex items-center gap-1.5"
                    >
                      <span className="text-sky-600 font-black">{cName}</span>
                      <span className="px-1.5 py-0.2 rounded-md bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 text-[10px]">
                        {count} élèves
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Search & Filter in Preview */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrer par nom, code Massar, téléphone..."
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <select
                  value={previewFilterClass}
                  onChange={(e) => setPreviewFilterClass(e.target.value)}
                  className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="ALL">Toutes les classes ({parsedResult.validRows.length})</option>
                  {Object.entries(parsedResult.classStats).map(([cName, count]) => (
                    <option key={cName} value={cName}>
                      {cName} ({count} élèves)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setParsedResult(null);
                    setFileName('');
                  }}
                  className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Changer de Fichier
                </button>
              </div>

              {/* Live Preview Table */}
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Élève</th>
                      <th className="py-2 px-3">Code Massar</th>
                      <th className="py-2 px-3">Classe Assumée</th>
                      <th className="py-2 px-3">Téléphone(s) Parent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {filteredPreviewRows.slice(0, 100).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-1.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-1.5 px-3 font-black text-slate-900 dark:text-white">
                          {row.first_name} {row.last_name}
                        </td>
                        <td className="py-1.5 px-3 font-mono font-bold text-sky-600 dark:text-sky-400">
                          {row.student_code}
                        </td>
                        <td className="py-1.5 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold text-[11px]">
                            {row.matched_class_name}
                          </span>
                        </td>
                        <td className="py-1.5 px-3">
                          {row.all_phones.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {row.all_phones.map((p, pIdx) => (
                                <span
                                  key={pIdx}
                                  className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[10px] border border-emerald-200 dark:border-emerald-800"
                                >
                                  📞 {p}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Aucun numéro</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredPreviewRows.length > 100 && (
                <div className="text-center text-slate-400 text-xs font-semibold">
                  Affichage des 100 premiers élèves sur {filteredPreviewRows.length} au total...
                </div>
              )}

              {/* Import Mode Radio */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Mode d&apos;Importation :
                </span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'UPSERT'}
                      onChange={() => setImportMode('UPSERT')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Mettre à jour &amp; Ajouter sans doublons (Recommandé)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-rose-600 dark:text-rose-400">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'REPLACE_ALL'}
                      onChange={() => setImportMode('REPLACE_ALL')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span>Remplacer toute la liste existante</span>
                  </label>
                </div>
              </div>

              {/* Progress Bar during Import */}
              {isImporting && (
                <div className="space-y-1.5 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <span>Importation et synchronisation des dossiers en cours...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <div className="w-full bg-emerald-200 dark:bg-emerald-900 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
          >
            Annuler
          </button>

          {parsedResult && (
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isImporting || parsedResult.validRows.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 cursor-pointer disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Enregistrement ({importProgress}%)...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirmer et Importer les {parsedResult.validRows.length} Élèves</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
