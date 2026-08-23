'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
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
  UserCheck
} from 'lucide-react';

export default function StudentsPage() {
  const { t, dir } = useI18n();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  
  // Modal state (create / edit)
  const [showModal, setShowModal] = useState(false);
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
  });

  const confirm = useConfirm();
  const notify = useNotify();

  async function loadData() {
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: studs }, { data: cls }] = await Promise.all([
        supabase.from('students').select('*, class:classes(*)').order('last_name'),
        supabase.from('classes').select('*').order('name'),
      ]);
      if (studs) setStudents(studs);
      if (cls) {
        setClasses(cls);
        if (cls.length > 0 && !formData.class_id) {
          setFormData((prev) => ({ ...prev, class_id: cls[0].id }));
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
  }, []);

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
    });
    setShowModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const supabase = createClient();

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
          })
          .eq('id', editingStudent.id);

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
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
              {dir === 'rtl' ? 'الاطلاع على لوائح التلاميذ، إضافة ملفات جديدة وتحديث بيانات التمدرس.' : "Consultez, inscrivez et modifiez les dossiers et fiches des élèves de l'établissement."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-600/20 hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('add_student')}</span>
            </button>
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
              <option value="ALL">{dir === 'rtl' ? 'جميع الأقسام' : 'Toutes les classes'}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.level})
                </option>
              ))}
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
                  <th className="px-6 py-3.5 text-right rtl:text-left">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-semibold">
                      {t('loading')}
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-semibold">
                      {t('no_data')}
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
                        <div className="text-xs space-y-0.5">
                          {student.email && (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>{student.email}</span>
                            </div>
                          )}
                          {student.phone && (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{student.phone}</span>
                            </div>
                          )}
                          {!student.email && !student.phone && (
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
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Actif
                        </span>
                      </td>
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
                      t('student_code')
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
                      t('first_name')
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white shadow-xs"
                      placeholder="Amine"
                    />
                  </div>
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      Nom
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white shadow-xs"
                      placeholder="Berrada"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      t('class_and_level')
                    </label>
                    <select
                      value={formData.class_id}
                      onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs truncate"
                    >
                      <option value="">Non assigné</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.level})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      t('gender')
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'M' | 'F' })}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
                    >
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      t('date_of_birth')
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
                      t('status')
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'GRADUATED' })}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
                    >
                      <option value="ACTIVE">Actif (Inscrit)</option>
                      <option value="INACTIVE">Inactif</option>
                      <option value="SUSPENDED">Suspendu</option>
                      <option value="GRADUATED">Lauréat / Transféré</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      t('guardian_name')
                    </label>
                    <input
                      type="text"
                      value={formData.guardian_name}
                      onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white shadow-xs"
                      placeholder="Driss Berrada"
                    />
                  </div>
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      t('guardian_phone')
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

                <div className="w-full min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    t('address')
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
      </div>
    </DashboardLayout>
  );
}
