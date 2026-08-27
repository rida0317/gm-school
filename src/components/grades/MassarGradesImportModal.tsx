'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useI18n } from '@/lib/i18n';
import { useNotify } from '@/lib/modal-service';
import { ClassEntity, Subject, Student, Evaluation, Grade, AcademicSemester } from '@/types/database';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  ArrowRight,
  Download,
  BookOpen,
  Users,
} from 'lucide-react';

interface MassarImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassEntity[];
  subjects: Subject[];
  students: Student[];
  onImportSuccess: (result: {
    classId: string;
    subjectId: string;
    semester: AcademicSemester;
    evaluations: Evaluation[];
    grades: Grade[];
  }) => void;
}

interface ParsedStudentRow {
  massarCode: string;
  studentName: string;
  matchedStudent?: Student;
  cc1?: number | null;
  cc1Absent?: boolean;
  cc2?: number | null;
  cc2Absent?: boolean;
  cc3?: number | null;
  cc3Absent?: boolean;
  activities?: number | null;
  activitiesAbsent?: boolean;
  comment?: string;
}

export function MassarGradesImportModal({
  isOpen,
  onClose,
  classes,
  subjects,
  students,
  onImportSuccess,
}: MassarImportModalProps) {
  const { t, dir } = useI18n();
  const notify = useNotify();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>('');
  const [detectedClassName, setDetectedClassName] = useState<string>('');
  const [detectedSubjectName, setDetectedSubjectName] = useState<string>('');
  const [detectedSemester, setDetectedSemester] = useState<AcademicSemester>('S1');

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<AcademicSemester>('S1');

  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheetName = workbook.SheetNames[0] || 'NotesCC';
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        // 1. Extract Metadata from Massar Header
        let fileClass = '';
        let fileSubject = '';
        let fileSemester: AcademicSemester = 'S1';

        rawJson.slice(0, 16).forEach((row) => {
          const rowStr = row.map((c) => String(c).trim()).join(' ');

          // Detect Class
          if (rowStr.includes('القسم') || rowStr.includes('2APIC') || rowStr.includes('1APIC') || rowStr.includes('3APIC')) {
            const classCell = row.find((c) => String(c).includes('APIC') || String(c).includes('A') || String(c).includes('B'));
            if (classCell) fileClass = String(classCell).trim();
          }

          // Detect Subject
          if (rowStr.includes('المادة') || rowStr.includes('المعلوميات') || rowStr.includes('الرياضيات') || rowStr.includes('الفرنسية') || rowStr.includes('العربية')) {
            row.forEach((cell, idx) => {
              const str = String(cell).trim();
              if (str.includes('المعلوميات') || str.includes('الرياضيات') || str.includes('الفرنسية') || str.includes('العربية') || str.includes('الفيزياء') || str.includes('علوم الحياة')) {
                fileSubject = str;
              }
            });
          }

          // Detect Semester
          if (rowStr.includes('الدورة الثانية') || rowStr.includes('Semestre 2') || rowStr.includes('S2')) {
            fileSemester = 'S2';
          } else if (rowStr.includes('الدورة الأولى') || rowStr.includes('Semestre 1') || rowStr.includes('S1')) {
            fileSemester = 'S1';
          }
        });

        setDetectedClassName(fileClass);
        setDetectedSubjectName(fileSubject);
        setDetectedSemester(fileSemester);
        setSelectedSemester(fileSemester);

        // Auto-match class in system
        if (fileClass) {
          const matchedCls = classes.find(
            (c) => c.name.toLowerCase().includes(fileClass.toLowerCase()) || fileClass.toLowerCase().includes(c.name.toLowerCase())
          );
          if (matchedCls) setSelectedClassId(matchedCls.id);
          else if (classes.length > 0) setSelectedClassId(classes[0].id);
        } else if (classes.length > 0) {
          setSelectedClassId(classes[0].id);
        }

        // Auto-match subject in system
        if (fileSubject) {
          const matchedSub = subjects.find(
            (s) => s.name.toLowerCase().includes(fileSubject.toLowerCase()) || fileSubject.toLowerCase().includes(s.name.toLowerCase())
          );
          if (matchedSub) setSelectedSubjectId(matchedSub.id);
          else if (subjects.length > 0) setSelectedSubjectId(subjects[0].id);
        } else if (subjects.length > 0) {
          setSelectedSubjectId(subjects[0].id);
        }

        // 2. Parse Student Grade Rows (Row 18 onwards)
        const rows: ParsedStudentRow[] = [];
        let startIndex = 17; // Row 18 (0-indexed 17)

        // Find exact header row with "رقم التلميذ" or Massar Code
        for (let i = 0; i < Math.min(25, rawJson.length); i++) {
          const rowStr = rawJson[i].map((c) => String(c)).join(' ');
          if (rowStr.includes('رقم') && rowStr.includes('التلميذ')) {
            startIndex = i + 2; // skip sub-header "النقطة / التغيب"
            break;
          }
        }

        for (let r = startIndex; r < rawJson.length; r++) {
          const row = rawJson[r];
          if (!row || row.length < 4) continue;

          // Massar code is usually in col 2 or 1
          const codeCandidate = String(row[2] || row[1] || '').trim();
          const nameCandidate = String(row[3] || row[2] || '').trim();

          if (!codeCandidate && !nameCandidate) continue;

          // Find student in our system by Massar Code or Name
          const matched = students.find((s) => {
            const sMassar = (s.massar_code || s.student_code || '').trim().toLowerCase();
            if (sMassar && codeCandidate.toLowerCase() === sMassar) return true;

            const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
            const revFullName = `${s.last_name} ${s.first_name}`.toLowerCase();
            const cleanName = nameCandidate.toLowerCase();
            return fullName.includes(cleanName) || cleanName.includes(fullName) || revFullName.includes(cleanName);
          });

          // Parse Scores
          const parseScore = (val: any) => {
            if (val === '' || val === null || val === undefined) return null;
            const n = parseFloat(String(val).replace(',', '.'));
            return isNaN(n) ? null : Math.min(20, Math.max(0, n));
          };

          const cc1Score = parseScore(row[6]);
          const cc1Abs = String(row[7] || '').trim() !== '';

          const cc2Score = parseScore(row[8]);
          const cc2Abs = String(row[9] || '').trim() !== '';

          const cc3Score = parseScore(row[10]);
          const cc3Abs = String(row[11] || '').trim() !== '';

          const actScore = parseScore(row[12]);
          const actAbs = String(row[13] || '').trim() !== '';

          const comment = String(row[14] || '').trim();

          rows.push({
            massarCode: codeCandidate,
            studentName: nameCandidate,
            matchedStudent: matched,
            cc1: cc1Score,
            cc1Absent: cc1Abs,
            cc2: cc2Score,
            cc2Absent: cc2Abs,
            cc3: cc3Score,
            cc3Absent: cc3Abs,
            activities: actScore,
            activitiesAbsent: actAbs,
            comment,
          });
        }

        setParsedRows(rows);

        notify({
          title: 'Fichier Massar Chargé 📄',
          message: `${rows.length} élèves détectés dans le fichier Excel.`,
          type: 'info',
        });
      } catch (err) {
        console.error(err);
        notify({
          title: 'Erreur de lecture',
          message: 'Impossible de lire le fichier Excel Massar.',
          type: 'danger',
        });
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = () => {
    if (!selectedClassId || !selectedSubjectId || parsedRows.length === 0) {
      notify({
        title: 'Attention',
        message: 'Veuillez sélectionner la classe et la matière de destination.',
        type: 'warning',
      });
      return;
    }

    const createdEvals: Evaluation[] = [
      {
        id: `eval-${selectedClassId}-${selectedSubjectId}-${selectedSemester}-CC1`,
        class_id: selectedClassId,
        subject_id: selectedSubjectId,
        semester: selectedSemester,
        type: 'CC1',
        title: `Contrôle Continu N°1 - ${subjects.find((s) => s.id === selectedSubjectId)?.name || ''}`,
        max_score: 20,
        coefficient: 1,
        date: new Date().toISOString().split('T')[0],
      },
      {
        id: `eval-${selectedClassId}-${selectedSubjectId}-${selectedSemester}-CC2`,
        class_id: selectedClassId,
        subject_id: selectedSubjectId,
        semester: selectedSemester,
        type: 'CC2',
        title: `Contrôle Continu N°2 - ${subjects.find((s) => s.id === selectedSubjectId)?.name || ''}`,
        max_score: 20,
        coefficient: 1,
        date: new Date().toISOString().split('T')[0],
      },
      {
        id: `eval-${selectedClassId}-${selectedSubjectId}-${selectedSemester}-CC3`,
        class_id: selectedClassId,
        subject_id: selectedSubjectId,
        semester: selectedSemester,
        type: 'CC3',
        title: `Contrôle Continu N°3 - ${subjects.find((s) => s.id === selectedSubjectId)?.name || ''}`,
        max_score: 20,
        coefficient: 1,
        date: new Date().toISOString().split('T')[0],
      },
      {
        id: `eval-${selectedClassId}-${selectedSubjectId}-${selectedSemester}-ACTIVITIES`,
        class_id: selectedClassId,
        subject_id: selectedSubjectId,
        semester: selectedSemester,
        type: 'ACTIVITIES',
        title: `Activités & Assiduité - ${subjects.find((s) => s.id === selectedSubjectId)?.name || ''}`,
        max_score: 20,
        coefficient: 1,
        date: new Date().toISOString().split('T')[0],
      },
    ];

    const createdGrades: Grade[] = [];

    parsedRows.forEach((row) => {
      const studentId = row.matchedStudent ? row.matchedStudent.id : row.massarCode;

      if (row.cc1 !== null || row.cc1Absent) {
        createdGrades.push({
          id: `gr-eval-${selectedClassId}-${selectedSubjectId}-${selectedSemester}-CC1-${studentId}`,
          evaluation_id: `eval-${selectedClassId}-${selectedSubjectId}-${selectedSemester}-CC1`,
          student_id: studentId,
          score: row.cc1Absent ? null : row.cc1 || null,
          is_absent: !!row.cc1Absent,
          comment: row.comment,
        });
      }

      if (row.cc2 !== null || row.cc2Absent) {
        createdGrades.push({
          id: `gr-eval-${selectedClassId}-${selectedSubjectId}-${selectedSemester}-CC2-${studentId}`,
          evaluation_id: `eval-${selectedClassId}-${selectedSubjectId}-${selectedSemester}-CC2`,
          student_id: studentId,
          score: row.cc2Absent ? null : row.cc2 || null,
          is_absent: !!row.cc2Absent,
          comment: row.comment,
        });
      }

      if (row.cc3 !== null || row.cc3Absent) {
        createdGrades.push({
          id: `gr-eval-${selectedClassId}-${selectedSubjectId}-${selectedSemester}-CC3-${studentId}`,
          evaluation_id: `eval-${selectedClassId}-${selectedSubjectId}-${selectedSemester}-CC3`,
          student_id: studentId,
          score: row.cc3Absent ? null : row.cc3 || null,
          is_absent: !!row.cc3Absent,
          comment: row.comment,
        });
      }

      if (row.activities !== null || row.activitiesAbsent) {
        createdGrades.push({
          id: `gr-eval-${selectedClassId}-${selectedSubjectId}-${selectedSemester}-ACTIVITIES-${studentId}`,
          evaluation_id: `eval-${selectedClassId}-${selectedSubjectId}-${selectedSemester}-ACTIVITIES`,
          student_id: studentId,
          score: row.activitiesAbsent ? null : row.activities || null,
          is_absent: !!row.activitiesAbsent,
          comment: row.comment,
        });
      }
    });

    onImportSuccess({
      classId: selectedClassId,
      subjectId: selectedSubjectId,
      semester: selectedSemester,
      evaluations: createdEvals,
      grades: createdGrades,
    });

    notify({
      title: 'Importation Réussie 🎉',
      message: `${createdGrades.length} notes importées et enregistrées avec succès.`,
      type: 'success',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {dir === 'rtl' ? 'استيراد نقط المراقبة المستمرة (ملف مسار Excel)' : 'Importer les Notes depuis Excel Massar'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Modèle officiel MEN &bull; Fichier <code className="text-emerald-600 font-bold">export_notesCC_*.xlsx</code>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* File Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-emerald-300 dark:border-emerald-700/60 rounded-3xl p-6 text-center bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/70 transition-all cursor-pointer space-y-2 group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6" />
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {fileName ? (
                <span className="text-emerald-600 font-mono">{fileName}</span>
              ) : (
                <span>Cliquez pour sélectionner le fichier Excel Massar (<span className="font-mono text-emerald-600">.xlsx</span>)</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Compatible avec le format exporté depuis le portail officiel مسار (Massar).
            </p>
          </div>

          {/* Target Mapping Configuration (Destination Class, Subject, Semester) */}
          {parsedRows.length > 0 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Vérification et Destination des Notes</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Class Selection */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Classe de destination
                    </label>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.level})
                        </option>
                      ))}
                    </select>
                    {detectedClassName && (
                      <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                        Détecté : {detectedClassName}
                      </span>
                    )}
                  </div>

                  {/* Subject Selection */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Matière de destination
                    </label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {detectedSubjectName && (
                      <span className="text-[10px] text-emerald-600 font-bold block mt-0.5 truncate">
                        Détecté : {detectedSubjectName}
                      </span>
                    )}
                  </div>

                  {/* Semester Selection */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Semestre
                    </label>
                    <select
                      value={selectedSemester}
                      onChange={(e) => setSelectedSemester(e.target.value as AcademicSemester)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                    >
                      <option value="S1">Semestre 1 (S1)</option>
                      <option value="S2">Semestre 2 (S2)</option>
                    </select>
                    <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                      Détecté : {detectedSemester}
                    </span>
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Aperçu des élèves et notes lues ({parsedRows.length} élèves) :</span>
                  <span className="text-emerald-600 font-bold">
                    {parsedRows.filter((r) => r.matchedStudent).length} correspondances trouvées
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left text-xs table-fixed">
                    <colgroup>
                      <col className="w-[12%]" />
                      <col className="w-[30%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[16%]" />
                    </colgroup>
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase sticky top-0">
                      <tr>
                        <th className="p-2.5">Code</th>
                        <th className="p-2.5">Élève</th>
                        <th className="p-2.5 text-center">CC 1</th>
                        <th className="p-2.5 text-center">CC 2</th>
                        <th className="p-2.5 text-center">CC 3</th>
                        <th className="p-2.5 text-center">Activités</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {parsedRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2.5 font-mono text-[11px] text-sky-600 font-bold">
                            {row.massarCode}
                          </td>
                          <td className="p-2.5 font-bold truncate" title={row.studentName}>
                            {row.studentName}
                          </td>
                          <td className="p-2.5 text-center font-bold">
                            {row.cc1Absent ? (
                              <span className="text-rose-500 text-[10px]">ABS</span>
                            ) : row.cc1 !== null ? (
                              <span className="text-emerald-600">{row.cc1}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-bold">
                            {row.cc2Absent ? (
                              <span className="text-rose-500 text-[10px]">ABS</span>
                            ) : row.cc2 !== null ? (
                              <span className="text-emerald-600">{row.cc2}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-bold">
                            {row.cc3Absent ? (
                              <span className="text-rose-500 text-[10px]">ABS</span>
                            ) : row.cc3 !== null ? (
                              <span className="text-emerald-600">{row.cc3}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-bold">
                            {row.activitiesAbsent ? (
                              <span className="text-rose-500 text-[10px]">ABS</span>
                            ) : row.activities !== null ? (
                              <span className="text-indigo-600">{row.activities}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 sm:p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Annuler
          </button>

          {parsedRows.length > 0 && (
            <button
              type="button"
              onClick={handleConfirmImport}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer transition-all hover:scale-105"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmer et Enregistrer {parsedRows.length} Élèves</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
