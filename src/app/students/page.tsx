'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { useAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import { Student, ClassEntity } from '@/types/database';
import { useConfirm, useNotify } from '@/lib/modal-service';
import { logAuditEvent } from '@/lib/audit';
import {
  GraduationCap,
  Plus,
  Search,
  Filter,
  Phone,
  Mail,
  Trash2,
  Edit2,
  X,
  UserCheck,
  Bus,
  Coins,
  CreditCard,
  ShieldAlert,
  BookOpen,
  FileSpreadsheet,
  Sparkles,
  Printer,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { StudentsImportModal } from '@/components/students/StudentsImportModal';
import { StudentsPromotionModal } from '@/components/students/StudentsPromotionModal';

export default function StudentsPage() {
  const { t, dir } = useI18n();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const isTeacher = profile?.role === 'TEACHER';

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [teacherClassIds, setTeacherClassIds] = useState<string[]>([]);
  const [teacherName, setTeacherName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  
  // Modal state (create / edit / import / promotion)
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    student_code: '',
    first_name: '',
    last_name: '',
    gender: 'M' as 'M' | 'F',
    date_of_birth: '2010-01-01',
    email: '',
    phone: '',
    class_id: '',
    address: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'GRADUATED',
    guardian_name: '',
    guardian_phone: '',
    custom_tuition_fee: '' as string | number,
    has_transport: false,
    transport_fee: '' as string | number,
  });

  const confirm = useConfirm();
  const notify = useNotify();

  async function loadData() {
    setLoading(true);
    try {
      const supabase = createClient();
      
      let allowedClassIds: string[] | null = null;

      // If current user is TEACHER, scope exclusively to their assigned classes
      if (profile?.role === 'TEACHER') {
        // 1. Find teacher record
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('id, first_name, last_name')
          .or(`profile_id.eq.${profile.id},email.eq.${profile.email}`)
          .maybeSingle();

        if (teacherData) {
          setTeacherName(`${teacherData.first_name} ${teacherData.last_name}`);
          // 2. Find classes where teacher teaches via timetable_slots or main_teacher
          const [{ data: slots }, { data: mainClasses }] = await Promise.all([
            supabase.from('timetable_slots').select('class_id').eq('teacher_id', teacherData.id),
            supabase.from('classes').select('id').eq('main_teacher_id', teacherData.id),
          ]);

          const classIdSet = new Set<string>();
          (slots || []).forEach((s) => {
            if (s.class_id) classIdSet.add(s.class_id);
          });
          (mainClasses || []).forEach((c) => {
            if (c.id) classIdSet.add(c.id);
          });

          allowedClassIds = Array.from(classIdSet);
          setTeacherClassIds(allowedClassIds);
        } else {
          allowedClassIds = [];
          setTeacherClassIds([]);
        }
      }

      const [{ data: studs }, { data: cls }] = await Promise.all([
        supabase.from('students').select('*, class:classes(*)').order('last_name'),
        supabase.from('classes').select('*').order('name'),
      ]);

      if (allowedClassIds !== null) {
        // Scope classes and students to teacher's assigned classes
        const scopedClasses = (cls || []).filter((c) => allowedClassIds!.includes(c.id));
        const scopedStudents = (studs || []).filter((s) => s.class_id && allowedClassIds!.includes(s.class_id));
        setClasses(scopedClasses);
        setStudents(scopedStudents);
      } else {
        if (studs) setStudents(studs);
        if (cls) {
          setClasses(cls);
          if (cls.length > 0 && !formData.class_id) {
            setFormData((prev) => ({ ...prev, class_id: cls[0].id }));
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [profile]);

  const handleOpenCreateModal = () => {
    setEditingStudent(null);
    const nextNum = String(students.length + 1).padStart(3, '0');
    setFormData({
      student_code: `ETU-${new Date().getFullYear()}-${nextNum}`,
      first_name: '',
      last_name: '',
      gender: 'M',
      date_of_birth: '2012-01-01',
      email: '',
      phone: '',
      class_id: classes[0]?.id || '',
      address: '',
      status: 'ACTIVE',
      guardian_name: '',
      guardian_phone: '',
      custom_tuition_fee: '',
      has_transport: false,
      transport_fee: '',
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      student_code: student.student_code || '',
      first_name: student.first_name || '',
      last_name: student.last_name || '',
      gender: (student.gender as 'M' | 'F') || 'M',
      date_of_birth: student.date_of_birth || '2012-01-01',
      email: student.email || '',
      phone: student.phone || '',
      class_id: student.class_id || (classes[0]?.id || ''),
      address: student.address || '',
      status: student.status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'GRADUATED' || 'ACTIVE',
      guardian_name: student.guardian_name || '',
      guardian_phone: student.guardian_phone || '',
      custom_tuition_fee: student.custom_tuition_fee !== undefined && student.custom_tuition_fee !== null ? student.custom_tuition_fee : '',
      has_transport: Boolean(student.has_transport),
      transport_fee: student.transport_fee !== undefined && student.transport_fee !== null ? student.transport_fee : '',
    });
    setShowModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const supabase = createClient();

      const customTuitionVal = formData.custom_tuition_fee !== '' ? Number(formData.custom_tuition_fee) : null;
      const transportFeeVal = formData.has_transport && formData.transport_fee !== '' ? Number(formData.transport_fee) : null;

      if (editingStudent) {
        // UPDATE existing student
        const { error } = await supabase
          .from('students')
          .update({
            student_code: formData.student_code.trim(),
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            gender: formData.gender,
            date_of_birth: formData.date_of_birth,
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            class_id: formData.class_id || null,
            address: formData.address.trim() || null,
            status: formData.status,
            guardian_name: formData.guardian_name.trim() || null,
            guardian_phone: formData.guardian_phone.trim() || null,
            custom_tuition_fee: customTuitionVal,
            has_transport: formData.has_transport,
            transport_fee: transportFeeVal,
          })
          .eq('id', editingStudent.id);

        if (error) throw error;

        logAuditEvent({
          action: 'STUDENT_UPDATED',
          entity_type: 'students',
          entity_id: editingStudent.id,
          details: {
            name: `${formData.first_name} ${formData.last_name}`,
            class_id: formData.class_id,
            status: formData.status,
          },
        });

        notify({
          title: 'Modification Enregistrée',
          message: `Les informations de ${formData.first_name} ${formData.last_name} ont été mises à jour.`,
          type: 'success',
        });
      } else {
        // INSERT new student
        const { error } = await supabase.from('students').insert([
          {
            student_code: formData.student_code.trim() || `ETU-${Date.now().toString().slice(-4)}`,
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            gender: formData.gender,
            date_of_birth: formData.date_of_birth,
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            class_id: formData.class_id || null,
            address: formData.address.trim() || null,
            status: formData.status,
            guardian_name: formData.guardian_name.trim() || null,
            guardian_phone: formData.guardian_phone.trim() || null,
            custom_tuition_fee: customTuitionVal,
            has_transport: formData.has_transport,
            transport_fee: transportFeeVal,
          },
        ]);

        if (error) throw error;

        logAuditEvent({
          action: 'STUDENT_CREATED',
          entity_type: 'students',
          details: {
            name: `${formData.first_name} ${formData.last_name}`,
            code: formData.student_code,
            class_id: formData.class_id,
            status: formData.status,
          },
        });

        notify({
          title: 'Inscription Réussie',
          message: `L'élève ${formData.first_name} ${formData.last_name} a été inscrit avec succès.`,
          type: 'success',
        });
      }

      setShowModal(false);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const handleDelete = async (id: string, name?: string) => {
    const ok = await confirm({
      title: 'Archiver / Supprimer l\'élève',
      message: name
        ? `Êtes-vous sûr de vouloir supprimer le dossier de "${name}" ?`
        : 'Êtes-vous sûr de vouloir supprimer cet élève ?',
      type: 'danger',
      confirmText: 'Confirmer la suppression',
      cancelText: 'Annuler',
    });
    if (!ok) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;

      logAuditEvent({
        action: 'STUDENT_DELETED',
        entity_type: 'students',
        entity_id: id,
        details: { name: name || id },
      });

      notify({ title: 'Supprimé', message: 'Dossier élève supprimé avec succès.', type: 'success' });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de suppression';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      `${s.first_name} ${s.last_name} ${s.student_code} ${s.email || ''} ${s.phone || ''}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === 'ALL' || s.class_id === selectedClass;
    return matchesSearch && matchesClass;
  });

  const handleToggleStatus = async (student: Student) => {
    if (isTeacher) return;
    const currentStatus = student.status || 'ACTIVE';
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('students')
        .update({ status: nextStatus })
        .eq('id', student.id);

      if (error) throw error;

      setStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, status: nextStatus } : s))
      );

      logAuditEvent({
        action: 'STUDENT_STATUS_TOGGLED',
        entity_type: 'students',
        entity_id: student.id,
        details: {
          name: `${student.first_name} ${student.last_name}`,
          old_status: currentStatus,
          new_status: nextStatus,
        },
      });

      notify({
        title: nextStatus === 'ACTIVE' ? 'Élève Réactivé' : 'Élève Désactivé',
        message: `${student.first_name} ${student.last_name} est désormais ${nextStatus === 'ACTIVE' ? 'Actif' : 'Désactivé (Inactif)'}.`,
        type: nextStatus === 'ACTIVE' ? 'success' : 'warning',
      });
    } catch (err: unknown) {
      notify({
        title: 'Erreur',
        message: err instanceof Error ? err.message : 'Erreur lors du changement de statut',
        type: 'danger',
      });
    }
  };

  const handleExportPDF = () => {
    const activeClass = classes.find((c) => c.id === selectedClass);
    const titleText = activeClass ? `CLASSE : ${activeClass.name} (${activeClass.level})` : 'LISTE GÉNÉRALE DES ÉLÈVES';
    const totalCount = filteredStudents.length;
    const girlsCount = filteredStudents.filter((s) => s.gender === 'F').length;
    const boysCount = filteredStudents.filter((s) => s.gender !== 'F').length;
    const logoUrl = settings.logo_url || '/logo.png';
    const fullLogoSrc = logoUrl.startsWith('http') ? logoUrl : `${window.location.origin}${logoUrl}`;

    const html = `
      <!DOCTYPE html>
      <html lang="fr" dir="ltr">
        <head>
          <meta charset="utf-8" />
          <title>${titleText} - Groupe Scolaire GM</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 0;
              font-size: 11px;
              line-height: 1.3;
            }
            .header-container {
              border-bottom: 2px solid #0f172a;
              padding-bottom: 10px;
              margin-bottom: 14px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .logo-img {
              width: 50px;
              height: 50px;
              object-fit: contain;
              border-radius: 8px;
            }
            .gov {
              font-size: 8.5px;
              font-weight: bold;
              text-transform: uppercase;
              color: #475569;
            }
            .school {
              font-size: 14px;
              font-weight: 900;
              color: #0f172a;
              margin-top: 2px;
              letter-spacing: 0.3px;
            }
            .badge-class {
              display: inline-block;
              background-color: #0f172a;
              color: #ffffff;
              font-weight: 900;
              font-size: 12px;
              padding: 5px 12px;
              border-radius: 4px;
              text-transform: uppercase;
            }
            .meta-info {
              font-size: 9.5px;
              font-weight: bold;
              color: #475569;
              margin-top: 4px;
              text-align: right;
            }
            .stats-bar {
              display: flex;
              gap: 14px;
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 6px 12px;
              margin-bottom: 12px;
              font-size: 10px;
              font-weight: bold;
            }
            .stats-item span {
              color: #0f172a;
              font-weight: 900;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 4px;
            }
            th, td {
              border: 1px solid #94a3b8;
              padding: 5.5px 7px;
              text-align: left;
            }
            th {
              background-color: #e2e8f0;
              color: #0f172a;
              font-weight: 800;
              font-size: 9.5px;
              text-transform: uppercase;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            .col-num {
              width: 24px;
              text-align: center;
              font-weight: bold;
              color: #64748b;
            }
            .col-name {
              font-weight: 800;
              color: #0f172a;
            }
            .col-massar {
              font-family: monospace;
              font-weight: bold;
              color: #1d4ed8;
              width: 85px;
            }
            .col-class {
              font-weight: bold;
              width: 65px;
              text-align: center;
            }
            .col-gender {
              width: 45px;
              text-align: center;
              font-weight: 800;
            }
            .col-phone {
              font-family: monospace;
              font-size: 9.5px;
              font-weight: 600;
              width: 165px;
            }
            .col-obs {
              width: 80px;
            }
            .footer-container {
              margin-top: 25px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              font-size: 10px;
              font-weight: bold;
              color: #334155;
              page-break-inside: avoid;
            }
            .stamp-box {
              border: 1.5px dashed #64748b;
              border-radius: 6px;
              width: 160px;
              height: 65px;
              margin-top: 5px;
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="header-left">
              <img src="${fullLogoSrc}" alt="Logo" class="logo-img" />
              <div>
                <div class="gov">Royaume du Maroc &bull; Ministère de l'Éducation Nationale</div>
                <div class="school">${settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES'}</div>
              </div>
            </div>
            <div>
              <div class="badge-class">${titleText}</div>
              <div class="meta-info">Année Scolaire : ${settings.academic_year || '2025-2026'}</div>
            </div>
          </div>

          <div class="stats-bar">
            <div class="stats-item">Effectif Total : <span>${totalCount} élèves</span></div>
            <div class="stats-item">&bull; Filles : <span>${girlsCount}</span></div>
            <div class="stats-item">&bull; Garçons : <span>${boysCount}</span></div>
            <div class="stats-item" style="margin-left: auto;">Édité le : <span>${new Date().toLocaleDateString('fr-FR')}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="col-num">N°</th>
                <th>Nom &amp; Prénom de l'Élève</th>
                <th class="col-massar">Code Massar</th>
                <th class="col-class">Classe</th>
                <th class="col-gender">Genre</th>
                <th class="col-phone">Téléphone(s) Parent</th>
                <th class="col-obs">Observation</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStudents
                .map((s, idx) => {
                  const phones = [s.phone, s.guardian_phone].filter(Boolean).join(' / ') || '-';
                  return `
                  <tr>
                    <td class="col-num">${idx + 1}</td>
                    <td class="col-name">${s.first_name} ${s.last_name}</td>
                    <td class="col-massar">${s.student_code || '-'}</td>
                    <td class="col-class">${s.class?.name || '-'}</td>
                    <td class="col-gender">${s.gender === 'F' ? 'F' : 'G'}</td>
                    <td class="col-phone">${phones}</td>
                    <td class="col-obs"></td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>

          <div class="footer-container">
            <div>Fait à Marrakech, le ${new Date().toLocaleDateString('fr-FR')}</div>
            <div style="text-align: center;">
              <div>Cachet et Signature de la Direction</div>
              <div class="stamp-box"></div>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 200);
            };
          </script>
        </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
    }
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const activeClass = classes.find((c) => c.id === selectedClass);
      const fileName = activeClass
        ? `Liste_Eleves_${activeClass.name.replace(/\s+/g, '_')}.xlsx`
        : 'Liste_Globale_Eleves.xlsx';

      const dataToExport = filteredStudents.map((s, idx) => ({
        'N°': idx + 1,
        'Nom': s.last_name,
        'Prénom': s.first_name,
        'Code Massar': s.student_code,
        'Classe': s.class?.name || '-',
        'Niveau': s.class?.level || '-',
        'Genre': s.gender === 'F' ? 'Féminin' : 'Masculin',
        'Téléphone 1': s.phone || '',
        'Téléphone 2': s.guardian_phone || '',
        'Statut': s.status || 'ACTIVE',
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Élèves');
      XLSX.writeFile(workbook, fileName);

      notify({
        title: 'Export Excel Réussi',
        message: `Le fichier ${fileName} (${filteredStudents.length} élèves) a été téléchargé.`,
        type: 'success',
      });
    } catch {
      notify({ title: 'Erreur', message: "Impossible d'exporter le fichier Excel.", type: 'danger' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Teacher Scoping Banner */}
        {isTeacher && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-300 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="font-bold text-sm">
                  {dir === 'rtl' ? 'فضاء الأستاذ — لوائح تلاميذ أقسامك' : `Espace Enseignant ${teacherName ? `(${teacherName})` : ''}`}
                </div>
                <div className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                  {dir === 'rtl'
                    ? 'يتم عرض تلاميذ الأقسام المسندة إليك في جدول الحصص فقط مع قفل التعديلات الإدارية والمالية.'
                    : 'Affichage exclusif des élèves inscrits dans vos classes assignées. Les modifications administratives sont désactivées.'}
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
              {classes.length} {dir === 'rtl' ? 'أقسام مسندة' : 'classes'}
            </span>
          </div>
        )}

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <GraduationCap className="w-4 h-4" />
              {t('students')}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('students_page_title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {dir === 'rtl' ? 'الاطلاع على لوائح التلاميذ، وتفقد بيانات التمدرس.' : "Consultez et visualisez les dossiers et fiches des élèves de l'établissement."}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportPDF}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-105"
              title="Générer et imprimer le tableau officiel de la classe en PDF"
            >
              <Printer className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
              <span>{dir === 'rtl' ? 'طباعة لائحة PDF' : 'Tableau PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer hover:scale-105"
              title="Exporter les élèves au format tableau Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{dir === 'rtl' ? 'تصدير جدول Excel' : 'Tableau Excel'}</span>
            </button>

            {!isTeacher && (
              <>
                <button
                  type="button"
                  onClick={() => setShowPromotionModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer hover:scale-105"
                  title="Transférer les élèves admis vers le niveau supérieur et équilibrer les groupes"
                >
                  <GraduationCap className="w-4 h-4 text-yellow-300" />
                  <span>{dir === 'rtl' ? 'الترقية والأفواج' : 'Promotion & Répartition'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 font-bold text-xs transition-all cursor-pointer hover:scale-105"
                  title="Importer la liste des élèves depuis un fichier Excel (.xlsx)"
                >
                  <span>{dir === 'rtl' ? '📥 استيراد Excel' : '📥 Importer Excel'}</span>
                </button>

                <button
                  onClick={handleOpenCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-600/20 hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('add_student')}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Real-time KPI Stats Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <Users className="w-4 h-4 text-blue-500" />
              <span>{dir === 'rtl' ? 'مجموع التلاميذ بالمؤسسة' : 'Total Global Élèves'}</span>
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono">
              {students.length} <span className="text-xs font-semibold text-slate-400">élèves</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <GraduationCap className="w-4 h-4 text-indigo-500" />
              <span>{dir === 'rtl' ? 'تلاميذ القسم المحدد' : 'Classe Sélectionnée'}</span>
            </div>
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
              {filteredStudents.length} <span className="text-xs font-semibold text-slate-400">élèves</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span>
              <span>{dir === 'rtl' ? 'عدد الإناث' : 'Élèves Féminin (Filles)'}</span>
            </div>
            <div className="text-xl font-black text-pink-600 dark:text-pink-400 mt-1 font-mono">
              {filteredStudents.filter((s) => s.gender === 'F').length} <span className="text-xs font-semibold text-slate-400">filles</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>{dir === 'rtl' ? 'عدد الذكور' : 'Élèves Masculin (Garçons)'}</span>
            </div>
            <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1 font-mono">
              {filteredStudents.filter((s) => s.gender !== 'F').length} <span className="text-xs font-semibold text-slate-400">garçons</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1">
            <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
            <input
              type="text"
              placeholder={t('search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full ${dir === 'rtl' ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white`}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">
                {dir === 'rtl' ? `جميع الأقسام (${students.length} تلميذ)` : `Toutes les classes (${students.length} élèves)`}
              </option>
              {classes.map((c) => {
                const count = students.filter((s) => s.class_id === c.id).length;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.level}) &bull; {count} élèves
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Students Data Table */}
        <div className="overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">{dir === 'rtl' ? 'الرمز والتلميذ' : t('code_and_student')}</th>
                  <th className="px-6 py-3.5">{dir === 'rtl' ? 'القسم والمستوى' : t('class_and_level')}</th>
                  <th className="px-6 py-3.5">{dir === 'rtl' ? 'الاتصال' : t('contact')}</th>
                  <th className="px-6 py-3.5">{dir === 'rtl' ? 'الجنس' : t('gender')}</th>
                  <th className="px-6 py-3.5">{t('status')}</th>
                  {!isTeacher && <th className="px-6 py-3.5 text-right rtl:text-left">{t('actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={isTeacher ? 5 : 6} className="px-6 py-12 text-center text-slate-400 font-semibold">
                      {t('loading')}
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={isTeacher ? 5 : 6} className="px-6 py-12 text-center text-slate-400 font-semibold">
                      {isTeacher && classes.length === 0
                        ? (dir === 'rtl' ? 'لم يتم تعيين أي أقسام لك بعد في جدول الحصص.' : 'Aucune classe ne vous a encore été assignée dans l\'emploi du temps.')
                        : t('no_data')}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-2xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                            {student.first_name?.[0] || 'E'}
                            {student.last_name?.[0] || 'T'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                              {student.first_name} {student.last_name}
                            </div>
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-mono font-bold">
                              {student.student_code}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {student.class?.name || 'Non assigné'}
                        </span>
                        <div className="text-xs text-slate-400">{student.class?.level || '-'}</div>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="text-xs space-y-1">
                          {student.phone && (
                            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-bold">
                              <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="font-mono">{student.phone}</span>
                            </div>
                          )}
                          {student.guardian_phone && student.guardian_phone !== student.phone && (
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
                              <Phone className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span className="font-mono text-[11px]">{student.guardian_phone}</span>
                            </div>
                          )}
                          {student.email && (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[160px]">{student.email}</span>
                            </div>
                          )}
                          {!student.email && !student.phone && !student.guardian_phone && (
                            <span className="text-slate-400 italic">Aucun contact</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${
                            student.gender === 'F'
                              ? 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                          }`}
                        >
                          {student.gender === 'F' ? 'Féminin' : 'Masculin'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(student)}
                          disabled={isTeacher}
                          title={
                            isTeacher
                              ? 'Statut géré par l\'administration'
                              : (student.status || 'ACTIVE') === 'ACTIVE'
                              ? 'Cliquer pour désactiver cet élève (Désactivé)'
                              : 'Cliquer pour réactiver cet élève (Actif)'
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer select-none hover:scale-105 active:scale-95 disabled:cursor-default disabled:hover:scale-100 ${
                            (student.status || 'ACTIVE') === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800'
                              : 'bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300/80 dark:border-rose-800'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full transition-all ${
                              (student.status || 'ACTIVE') === 'ACTIVE'
                                ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                                : 'bg-rose-500 shadow-xs shadow-rose-500/50'
                            }`}
                          />
                          <span>
                            {(student.status || 'ACTIVE') === 'ACTIVE'
                              ? dir === 'rtl' ? 'نشط' : 'Actif'
                              : dir === 'rtl' ? 'غير نشط' : 'Désactivé'}
                          </span>
                        </button>
                      </td>
                      {!isTeacher && (
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Modifier Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(student)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/60 font-bold text-xs transition-colors cursor-pointer"
                              title="Modifier les informations de l'élève"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Modifier</span>
                            </button>

                            {/* Supprimer Button */}
                            <button
                              type="button"
                              onClick={() => handleDelete(student.id, `${student.first_name} ${student.last_name}`)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Archiver / Supprimer l'élève"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Create / Edit Student */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="relative w-[95vw] max-w-lg md:max-w-xl bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 space-y-4 my-auto max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 min-w-0">
                  <div className="p-2.5 rounded-2xl bg-blue-500/15 shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                      {editingStudent ? t('edit_student') : t('new_student')}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      {editingStudent
                          ? `${t('edit_student')} - ${editingStudent.first_name} ${editingStudent.last_name}`
                          : t('register_new_student')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveStudent} className="space-y-3.5 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 w-full">
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      {dir === 'rtl' ? 'رقم التسجيل (Matricule)' : 'Matricule / Code'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.student_code}
                      onChange={(e) => setFormData({ ...formData, student_code: e.target.value })}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white shadow-xs"
                      placeholder="ETU-2025-001"
                    />
                  </div>
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      {dir === 'rtl' ? 'الاسم الشخصي' : 'Prénom'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white shadow-xs"
                      placeholder={dir === 'rtl' ? 'أمين' : 'Amine'}
                    />
                  </div>
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      {dir === 'rtl' ? 'الاسم العائلي' : 'Nom'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white shadow-xs"
                      placeholder={dir === 'rtl' ? 'برادة' : 'Berrada'}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      {dir === 'rtl' ? 'القسم والمستوى' : 'Classe & Niveau'}
                    </label>
                    <select
                      value={formData.class_id}
                      onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs truncate"
                    >
                      <option value="">{dir === 'rtl' ? '-- غير محدد --' : 'Non assigné'}</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.level})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      {dir === 'rtl' ? 'الجنس' : 'Genre'}
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'M' | 'F' })}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
                    >
                      <option value="M">{dir === 'rtl' ? 'ذكر' : 'Masculin'}</option>
                      <option value="F">{dir === 'rtl' ? 'أنثى' : 'Féminin'}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      {dir === 'rtl' ? 'تاريخ الازدياد' : 'Date de naissance'}
                    </label>
                    <input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                    />
                  </div>
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      {dir === 'rtl' ? 'الحالة المدرسية' : 'Statut'}
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'GRADUATED' })}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
                    >
                      <option value="ACTIVE">{dir === 'rtl' ? 'مسجل ونشط' : 'Actif (Inscrit)'}</option>
                      <option value="INACTIVE">{dir === 'rtl' ? 'غير نشط' : 'Inactif'}</option>
                      <option value="SUSPENDED">{dir === 'rtl' ? 'موقوف' : 'Suspendu'}</option>
                      <option value="GRADUATED">{dir === 'rtl' ? 'متخرج / منتقل' : 'Lauréat / Transféré'}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      {dir === 'rtl' ? 'اسم ولي الأمر' : 'Nom du Tuteur'}
                    </label>
                    <input
                      type="text"
                      value={formData.guardian_name}
                      onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white shadow-xs"
                      placeholder={dir === 'rtl' ? 'إدريس برادة' : 'Driss Berrada'}
                    />
                  </div>
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      {dir === 'rtl' ? 'هاتف ولي الأمر (واتساب)' : 'Téléphone Tuteur (WhatsApp)'}
                    </label>
                    <input
                      type="tel"
                      value={formData.guardian_phone}
                      onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white shadow-xs"
                      placeholder="+212 670-000001"
                    />
                  </div>
                </div>

                {/* Financial & Transport Section */}
                <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                    <Coins className="w-4 h-4 text-amber-600" />
                    <span>{dir === 'rtl' ? 'الواجب الشهري والنقل المدرسي (Frais & Transport)' : 'Frais de Scolarité & Transport'}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Custom Tuition Fee Override */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {dir === 'rtl' ? 'واجب شهري مخصص (MAD)' : 'Frais Scolarité Spécifique (MAD)'}
                      </label>
                      <input
                        type="number"
                        value={formData.custom_tuition_fee}
                        onChange={(e) => setFormData({ ...formData, custom_tuition_fee: e.target.value })}
                        placeholder={dir === 'rtl' ? 'اتركه فارغاً للاعتماد على تعريفة السلك' : 'Vide = Tarif cycle par défaut'}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        {dir === 'rtl' ? 'لتطبيق تخفيض الأخوة أو منحة دراسية' : 'Pour remise fratrie ou tarif spécial'}
                      </span>
                    </div>

                    {/* Transport Scolaire Toggle & Amount */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Bus className="w-3.5 h-3.5 text-amber-600" />
                          <span>{dir === 'rtl' ? 'النقل المدرسي' : 'Transport Scolaire'}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const nextState = !formData.has_transport;
                            setFormData({
                              ...formData,
                              has_transport: nextState,
                              transport_fee: nextState && !formData.transport_fee ? (settings.default_transport_fee || 400) : formData.transport_fee,
                            });
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            formData.has_transport ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              formData.has_transport ? (dir === 'rtl' ? '-translate-x-4' : 'translate-x-4') : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {formData.has_transport ? (
                        <div className="relative animate-in fade-in">
                          <input
                            type="number"
                            value={formData.transport_fee}
                            onChange={(e) => setFormData({ ...formData, transport_fee: e.target.value })}
                            placeholder={String(settings.default_transport_fee || 400)}
                            className="w-full h-10 px-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-xs font-black text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">MAD/mois</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic py-2">
                          {dir === 'rtl' ? 'التلميذ غير مستفيد من النقل المدرسي' : 'Non inscrit au transport scolaire'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    {t('address')}
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white shadow-xs"
                    placeholder="Quartier, Ville..."
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800 w-full">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer shrink-0"
                  >
                    {editingStudent ? t('save_changes') : t('register_student')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Official Moroccan Print Sheet (Visible only when Printing / Saving as PDF) */}
        <div className="hidden print:block font-sans text-black p-4 bg-white">
          <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider">Royaume du Maroc</div>
              <div className="text-[10px] font-bold uppercase">Ministère de l&apos;Éducation Nationale, du Préscolaire et des Sports</div>
              <h1 className="text-sm font-black uppercase text-slate-900 mt-1">
                {settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES'}
              </h1>
            </div>
            <div className="text-right">
              <div className="text-xs font-black uppercase px-3 py-1 bg-slate-900 text-white rounded inline-block">
                {selectedClass === 'ALL'
                  ? 'LISTE GÉNÉRALE DES ÉLÈVES'
                  : `LISTE OFFICIELLE — CLASSE : ${classes.find((c) => c.id === selectedClass)?.name || ''}`}
              </div>
              <div className="text-[9px] text-slate-600 font-bold mt-1">
                Année Scolaire : {settings.academic_year || '2025-2026'} &bull; Effectif : {filteredStudents.length} élèves ({filteredStudents.filter((s) => s.gender === 'F').length} Filles, {filteredStudents.filter((s) => s.gender !== 'F').length} Garçons)
              </div>
            </div>
          </div>

          <table className="w-full text-left text-[9pt] border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 font-bold uppercase text-[8pt] border-b border-slate-300">
                <th className="p-1.5 border-r border-slate-300 w-8 text-center">N°</th>
                <th className="p-1.5 border-r border-slate-300">Nom &amp; Prénom de l&apos;Élève</th>
                <th className="p-1.5 border-r border-slate-300 w-28">Code Massar</th>
                <th className="p-1.5 border-r border-slate-300 w-24">Classe</th>
                <th className="p-1.5 border-r border-slate-300 w-16 text-center">Genre</th>
                <th className="p-1.5 border-r border-slate-300 w-36">Téléphone(s)</th>
                <th className="p-1.5 w-28 text-center">Observation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredStudents.map((s, idx) => (
                <tr key={s.id}>
                  <td className="p-1.5 border-r border-slate-300 font-mono text-center">{idx + 1}</td>
                  <td className="p-1.5 border-r border-slate-300 font-bold">{s.first_name} {s.last_name}</td>
                  <td className="p-1.5 border-r border-slate-300 font-mono text-[8pt]">{s.student_code}</td>
                  <td className="p-1.5 border-r border-slate-300 font-semibold">{s.class?.name || '-'}</td>
                  <td className="p-1.5 border-r border-slate-300 text-center font-bold text-[8pt]">{s.gender === 'F' ? 'F' : 'G'}</td>
                  <td className="p-1.5 border-r border-slate-300 font-mono text-[8pt]">{s.phone || s.guardian_phone || '-'}</td>
                  <td className="p-1.5 border-r-0"></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-8 pt-4 flex justify-between text-[9pt] font-bold">
            <div>Fait à Marrakech, le {new Date().toLocaleDateString('fr-FR')}</div>
            <div className="text-center">
              <div>Cachet et Signature de la Direction</div>
              <div className="h-16 w-40 border border-dashed border-slate-400 mt-2 rounded"></div>
            </div>
          </div>
        </div>

        {/* Students Excel Import Modal */}
        <StudentsImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          classes={classes}
          onImportComplete={loadData}
          notify={notify}
        />

        {/* Students Collective Promotion Modal */}
        <StudentsPromotionModal
          isOpen={showPromotionModal}
          onClose={() => setShowPromotionModal(false)}
          classes={classes}
          initialSourceClassId={selectedClass !== 'ALL' ? selectedClass : undefined}
          onPromotionComplete={loadData}
          notify={notify}
        />
      </div>
    </DashboardLayout>
  );
}
