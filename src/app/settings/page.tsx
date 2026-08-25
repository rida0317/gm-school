'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { logAuditEvent } from '@/lib/audit';
import { useAuth } from '@/lib/auth';
import { useNotify, useConfirm } from '@/lib/modal-service';
import { createClient } from '@/lib/supabase/client';
import { SystemBackup } from '@/types/database';
import {
  Settings,
  Building,
  Globe,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  Sparkles,
  RotateCcw,
  Upload,
  Image as ImageIcon,
  Camera,
  Trash2,
  Bus,
  Coins,
  Database,
  Download,
  ShieldCheck,
  FileArchive,
  HardDrive,
  FileSpreadsheet,
  History,
  Lock,
  Eye,
  Clock,
  AlertTriangle,
  FileCheck,
  Check,
  X
} from 'lucide-react';
import { DEFAULT_WHATSAPP_TEMPLATES } from '@/lib/whatsapp';

export default function SettingsPage() {
  const { locale, setLocale, t, dir } = useI18n();
  const { settings, updateSettings } = useSettings();
  const { profile } = useAuth();
  const notify = useNotify();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  // Settings active main tab
  const [activeSettingsTab, setActiveSettingsTab] = useState<'GENERAL' | 'FEES' | 'WHATSAPP' | 'BACKUP'>('GENERAL');

  // Backup & Restore State
  const [backupLogs, setBackupLogs] = useState<SystemBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStatusText, setRestoreStatusText] = useState('');
  const [restorePreviewData, setRestorePreviewData] = useState<any | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [liveDbStats, setLiveDbStats] = useState({
    studentsCount: 0,
    teachersCount: 0,
    staffCount: 0,
    classesCount: 0,
    paymentsCount: 0,
    stockCount: 0,
    movementsCount: 0,
    announcementsCount: 0,
  });

  const [formState, setFormState] = useState({
    school_name: settings?.school_name || 'Groupe Scolaire Des Générations Montantes',
    school_name_ar: settings?.school_name_ar || 'مجموعة مدارس الأجيال الصاعدة',
    academic_year: settings?.academic_year || '2025-2026',
    current_term: settings?.current_term || 'Semestre 1',
    email: settings?.email || 'contact@gm-school.ma',
    phone: settings?.phone || '+212 522-001122',
    address: settings?.address || 'Casablanca, Maroc',
    currency: settings?.currency || 'MAD (Dirham Marocain)',
    logo_url: settings?.logo_url || '/logo.png',
    whatsapp_absence_template_ar: settings?.whatsapp_absence_template_ar || DEFAULT_WHATSAPP_TEMPLATES.ar_absence,
    whatsapp_absence_template_fr: settings?.whatsapp_absence_template_fr || DEFAULT_WHATSAPP_TEMPLATES.fr_absence,
    whatsapp_late_template_ar: settings?.whatsapp_late_template_ar || DEFAULT_WHATSAPP_TEMPLATES.ar_late,
    whatsapp_late_template_fr: settings?.whatsapp_late_template_fr || DEFAULT_WHATSAPP_TEMPLATES.fr_late,
    whatsapp_payment_template_ar: settings?.whatsapp_payment_template_ar || DEFAULT_WHATSAPP_TEMPLATES.ar_payment,
    whatsapp_payment_template_fr: settings?.whatsapp_payment_template_fr || DEFAULT_WHATSAPP_TEMPLATES.fr_payment,
    tuition_fee_maternelle: settings?.tuition_fee_maternelle !== undefined ? settings.tuition_fee_maternelle : 1300,
    tuition_fee_primaire: settings?.tuition_fee_primaire !== undefined ? settings.tuition_fee_primaire : 1500,
    tuition_fee_college: settings?.tuition_fee_college !== undefined ? settings.tuition_fee_college : 1800,
    tuition_fee_lycee: settings?.tuition_fee_lycee !== undefined ? settings.tuition_fee_lycee : 2200,
    default_transport_fee: settings?.default_transport_fee !== undefined ? settings.default_transport_fee : 400,
  });

  const [whatsappTab, setWhatsappTab] = useState<'ar' | 'fr'>('ar');
  const [activeTarget, setActiveTarget] = useState<'absence' | 'late' | 'payment'>('absence');

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg(dir === 'rtl' ? 'حجم الصورة كبير جداً (الحد الأقصى 3 ميجابايت)' : 'Le fichier est trop volumineux (Max 3 Mo)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFormState((prev) => ({ ...prev, logo_url: result }));
    };
    reader.readAsDataURL(file);
  };

  const insertTag = (tag: string) => {
    const fieldKey =
      whatsappTab === 'ar'
        ? activeTarget === 'absence'
          ? 'whatsapp_absence_template_ar'
          : activeTarget === 'late'
          ? 'whatsapp_late_template_ar'
          : 'whatsapp_payment_template_ar'
        : activeTarget === 'absence'
        ? 'whatsapp_absence_template_fr'
        : activeTarget === 'late'
        ? 'whatsapp_late_template_fr'
        : 'whatsapp_payment_template_fr';

    setFormState((prev) => {
      const current = prev[fieldKey] || '';
      return {
        ...prev,
        [fieldKey]: current ? `${current} ${tag}` : tag,
      };
    });
  };

  const insertSchoolHeader = (target: 'absence' | 'late' | 'payment') => {
    const schoolName =
      whatsappTab === 'ar'
        ? formState.school_name_ar || 'مجموعة مدارس الأجيال الصاعدة'
        : formState.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES';
    const header = `*${schoolName}*\n----------------------------------------\n`;

    const fieldKey =
      whatsappTab === 'ar'
        ? target === 'absence'
          ? 'whatsapp_absence_template_ar'
          : target === 'late'
          ? 'whatsapp_late_template_ar'
          : 'whatsapp_payment_template_ar'
        : target === 'absence'
        ? 'whatsapp_absence_template_fr'
        : target === 'late'
        ? 'whatsapp_late_template_fr'
        : 'whatsapp_payment_template_fr';

    setFormState((prev) => {
      const current = prev[fieldKey] || '';
      const headerRegex = /^(\*[^*]+\*[\r\n]+-+\s*[\r\n]*)/;
      if (headerRegex.test(current)) {
        return {
          ...prev,
          [fieldKey]: current.replace(headerRegex, ''),
        };
      } else {
        return {
          ...prev,
          [fieldKey]: `${header}${current}`,
        };
      }
    });
  };
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hasInitializedRef = React.useRef(false);

  // Sync formState once when initial settings are loaded
  useEffect(() => {
    if (settings && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setFormState({
        school_name: settings.school_name || 'Groupe Scolaire Des Générations Montantes',
        school_name_ar: settings.school_name_ar || 'مجموعة مدارس الأجيال الصاعدة',
        academic_year: settings.academic_year || '2025-2026',
        current_term: settings.current_term || 'Semestre 1',
        email: settings.email || 'contact@gm-school.ma',
        phone: settings.phone || '+212 522-001122',
        address: settings.address || 'Casablanca, Maroc',
        currency: settings.currency || 'MAD (Dirham Marocain)',
        logo_url: settings.logo_url || '/logo.png',
        whatsapp_absence_template_ar: settings.whatsapp_absence_template_ar || DEFAULT_WHATSAPP_TEMPLATES.ar_absence,
        whatsapp_absence_template_fr: settings.whatsapp_absence_template_fr || DEFAULT_WHATSAPP_TEMPLATES.fr_absence,
        whatsapp_late_template_ar: settings.whatsapp_late_template_ar || DEFAULT_WHATSAPP_TEMPLATES.ar_late,
        whatsapp_late_template_fr: settings.whatsapp_late_template_fr || DEFAULT_WHATSAPP_TEMPLATES.fr_late,
        whatsapp_payment_template_ar: settings.whatsapp_payment_template_ar || DEFAULT_WHATSAPP_TEMPLATES.ar_payment,
        whatsapp_payment_template_fr: settings.whatsapp_payment_template_fr || DEFAULT_WHATSAPP_TEMPLATES.fr_payment,
        tuition_fee_maternelle: settings.tuition_fee_maternelle !== undefined ? settings.tuition_fee_maternelle : 1300,
        tuition_fee_primaire: settings.tuition_fee_primaire !== undefined ? settings.tuition_fee_primaire : 1500,
        tuition_fee_college: settings.tuition_fee_college !== undefined ? settings.tuition_fee_college : 1800,
        tuition_fee_lycee: settings.tuition_fee_lycee !== undefined ? settings.tuition_fee_lycee : 2200,
        default_transport_fee: settings.default_transport_fee !== undefined ? settings.default_transport_fee : 400,
      });
    }
  }, [settings]);

  // Load Backup History & Live Database Statistics
  const loadBackupHistoryAndStats = async () => {
    try {
      setLoadingBackups(true);
      const supabase = createClient();

      const { data: bData } = await supabase
        .from('system_backups')
        .select('*')
        .order('created_at', { ascending: false });

      if (bData) {
        setBackupLogs(bData);
      }

      const [
        { count: stCount },
        { count: tcCount },
        { count: sfCount },
        { count: clCount },
        { count: payCount },
        { count: stkCount },
        { count: movCount },
        { count: annCount },
      ] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('teachers').select('*', { count: 'exact', head: true }),
        supabase.from('staff_members').select('*', { count: 'exact', head: true }),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
        supabase.from('student_tuition_payments').select('*', { count: 'exact', head: true }),
        supabase.from('stock_products').select('*', { count: 'exact', head: true }),
        supabase.from('stock_movements').select('*', { count: 'exact', head: true }),
        supabase.from('announcements').select('*', { count: 'exact', head: true }),
      ]);

      setLiveDbStats({
        studentsCount: stCount || 0,
        teachersCount: tcCount || 0,
        staffCount: sfCount || 0,
        classesCount: clCount || 0,
        paymentsCount: payCount || 0,
        stockCount: stkCount || 0,
        movementsCount: movCount || 0,
        announcementsCount: annCount || 0,
      });
    } catch (err) {
      console.error('Error fetching backup stats:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (activeSettingsTab === 'BACKUP') {
      loadBackupHistoryAndStats();
    }
  }, [activeSettingsTab]);

  const handleExportCompleteBackup = async () => {
    setIsExportingBackup(true);
    try {
      const supabase = createClient();
      const now = new Date();

      const [
        studentsRes,
        teachersRes,
        staffRes,
        classesRes,
        subjectsRes,
        roomsRes,
        timetablesRes,
        slotsRes,
        tuitionRes,
        stockProdRes,
        stockCatRes,
        stockMovRes,
        stockRepRes,
        announcementsRes,
        suppliersRes,
        settingsRes,
      ] = await Promise.all([
        supabase.from('students').select('*'),
        supabase.from('teachers').select('*'),
        supabase.from('staff_members').select('*'),
        supabase.from('classes').select('*'),
        supabase.from('subjects').select('*'),
        supabase.from('rooms').select('*'),
        supabase.from('timetables').select('*'),
        supabase.from('timetable_slots').select('*'),
        supabase.from('student_tuition_payments').select('*'),
        supabase.from('stock_products').select('*'),
        supabase.from('stock_categories').select('*'),
        supabase.from('stock_movements').select('*'),
        supabase.from('stock_reports').select('*'),
        supabase.from('announcements').select('*'),
        supabase.from('suppliers').select('*'),
        supabase.from('school_settings').select('*'),
      ]);

      const backupData = {
        metadata: {
          app_name: 'GM School Management System',
          version: '2.0.0',
          backup_timestamp: now.toISOString(),
          school_name: formState.school_name,
          school_name_ar: formState.school_name_ar,
          academic_year: formState.academic_year,
          created_by: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Super Admin',
        },
        stats: {
          students: studentsRes.data?.length || 0,
          teachers: teachersRes.data?.length || 0,
          staff: staffRes.data?.length || 0,
          classes: classesRes.data?.length || 0,
          subjects: subjectsRes.data?.length || 0,
          rooms: roomsRes.data?.length || 0,
          timetables: timetablesRes.data?.length || 0,
          timetable_slots: slotsRes.data?.length || 0,
          tuition_payments: tuitionRes.data?.length || 0,
          stock_products: stockProdRes.data?.length || 0,
          stock_categories: stockCatRes.data?.length || 0,
          stock_movements: stockMovRes.data?.length || 0,
          stock_reports: stockRepRes.data?.length || 0,
          announcements: announcementsRes.data?.length || 0,
          suppliers: suppliersRes.data?.length || 0,
        },
        tables: {
          school_settings: settingsRes.data || [],
          students: studentsRes.data || [],
          teachers: teachersRes.data || [],
          staff_members: staffRes.data || [],
          classes: classesRes.data || [],
          subjects: subjectsRes.data || [],
          rooms: roomsRes.data || [],
          timetables: timetablesRes.data || [],
          timetable_slots: slotsRes.data || [],
          student_tuition_payments: tuitionRes.data || [],
          stock_products: stockProdRes.data || [],
          stock_categories: stockCatRes.data || [],
          stock_movements: stockMovRes.data || [],
          stock_reports: stockRepRes.data || [],
          announcements: announcementsRes.data || [],
          suppliers: suppliersRes.data || [],
        },
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const totalRecords = Object.values(backupData.stats).reduce((a, b) => a + b, 0);

      const author = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Super Admin';
      const backupName = `GM_School_Backup_${now.toISOString().split('T')[0]}_${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;

      await supabase.from('system_backups').insert([
        {
          backup_name: backupName,
          file_size_bytes: blob.size,
          total_records: totalRecords,
          data_summary: {
            students_count: backupData.stats.students,
            teachers_count: backupData.stats.teachers,
            classes_count: backupData.stats.classes,
            payments_count: backupData.stats.tuition_payments,
            stock_count: backupData.stats.stock_products,
            movements_count: backupData.stats.stock_movements,
            announcements_count: backupData.stats.announcements,
          },
          created_by: author,
        },
      ]);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${backupName}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notify({
        title: dir === 'rtl' ? 'تم إنشاء النسخة الاحتياطية بنجاح' : 'Sauvegarde Téléchargée avec Succès',
        message: dir === 'rtl' ? `تم تصدير ${totalRecords} سجلاً وتأمينها في ملف JSON.` : `${totalRecords} enregistrements archivés et sécurisés avec succès.`,
        type: 'success',
      });

      loadBackupHistoryAndStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      notify({
        title: 'Erreur',
        message: `Erreur lors de la sauvegarde: ${msg}`,
        type: 'danger',
      });
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleExportTableCSV = async (tableType: 'STUDENTS' | 'TEACHERS' | 'FINANCE' | 'STOCK') => {
    try {
      const supabase = createClient();
      let csvContent = '';
      let filename = '';

      if (tableType === 'STUDENTS') {
        const { data } = await supabase.from('students').select('*, class:classes(name)').order('last_name');
        filename = `GM_School_Eleves_${new Date().toISOString().split('T')[0]}.csv`;
        const headers = ['ID', 'Nom', 'Prenom', 'Classe', 'Cycle', 'Genre', 'Date_Naissance', 'Telephone_Parent', 'Adresse', 'Statut'];
        const rows = (data || []).map((s: any) => [
          `"${s.id}"`,
          `"${s.last_name || ''}"`,
          `"${s.first_name || ''}"`,
          `"${s.class?.name || ''}"`,
          `"${s.cycle || ''}"`,
          `"${s.gender || ''}"`,
          `"${s.birth_date || ''}"`,
          `"${s.parent_phone || ''}"`,
          `"${(s.address || '').replace(/"/g, '""')}"`,
          `"${s.status || 'ACTIVE'}"`,
        ]);
        csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');
      } else if (tableType === 'TEACHERS') {
        const { data } = await supabase.from('teachers').select('*').order('last_name');
        filename = `GM_School_Enseignants_${new Date().toISOString().split('T')[0]}.csv`;
        const headers = ['ID', 'Nom', 'Prenom', 'Specialite', 'Telephone', 'Email', 'Cycle', 'Statut'];
        const rows = (data || []).map((tc: any) => [
          `"${tc.id}"`,
          `"${tc.last_name || ''}"`,
          `"${tc.first_name || ''}"`,
          `"${tc.specialty || ''}"`,
          `"${tc.phone || ''}"`,
          `"${tc.email || ''}"`,
          `"${tc.cycle || ''}"`,
          `"${tc.status || 'ACTIVE'}"`,
        ]);
        csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');
      } else if (tableType === 'FINANCE') {
        const { data } = await supabase.from('student_tuition_payments').select('*, student:students(first_name, last_name)').order('payment_date', { ascending: false });
        filename = `GM_School_Paiements_${new Date().toISOString().split('T')[0]}.csv`;
        const headers = ['ID', 'Eleve', 'Mois', 'Montant_MAD', 'Methode_Paiement', 'Reference', 'Date_Paiement', 'Statut'];
        const rows = (data || []).map((p: any) => [
          `"${p.id}"`,
          `"${p.student?.first_name || ''} ${p.student?.last_name || ''}"`,
          `"${p.month_for || ''}"`,
          `"${p.amount || 0}"`,
          `"${p.payment_method || ''}"`,
          `"${p.receipt_number || p.reference || ''}"`,
          `"${p.payment_date || ''}"`,
          `"${p.status || 'PAID'}"`,
        ]);
        csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');
      } else if (tableType === 'STOCK') {
        const { data } = await supabase.from('stock_products').select('*, category:stock_categories(name)').order('name');
        filename = `GM_School_Inventaire_Stock_${new Date().toISOString().split('T')[0]}.csv`;
        const headers = ['ID', 'Article', 'SKU', 'Categorie', 'Quantite', 'Quantite_Min', 'Unite', 'Prix_Achat_MAD', 'Statut'];
        const rows = (data || []).map((p: any) => [
          `"${p.id}"`,
          `"${(p.name || '').replace(/"/g, '""')}"`,
          `"${p.sku || ''}"`,
          `"${p.category?.name || ''}"`,
          `"${p.quantity || 0}"`,
          `"${p.minimum_quantity || 0}"`,
          `"${p.unit || 'Unité'}"`,
          `"${p.purchase_price || 0}"`,
          `"${p.status || 'IN_STOCK'}"`,
        ]);
        csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');
      }

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notify({
        title: 'Export Réussi',
        message: `Fichier ${filename} téléchargé avec succès !`,
        type: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const handleFileSelectedForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed.tables || !parsed.metadata) {
          throw new Error('Le fichier sélectionné n\'est pas un fichier de sauvegarde GM School valide.');
        }

        setRestorePreviewData(parsed);
        setShowRestoreModal(true);
      } catch (err: any) {
        notify({
          title: 'Format Invalide',
          message: err?.message || 'Erreur de lecture du fichier JSON.',
          type: 'danger',
        });
      }
    };
    reader.readAsText(file);
    if (restoreFileInputRef.current) restoreFileInputRef.current.value = '';
  };

  const handleExecuteRestore = async () => {
    if (!restorePreviewData || !restorePreviewData.tables) return;

    setIsRestoringBackup(true);
    setRestoreProgress(5);
    setRestoreStatusText('Démarrage de la restauration...');

    try {
      const supabase = createClient();
      const tables = restorePreviewData.tables;

      if (tables.school_settings && tables.school_settings.length > 0) {
        setRestoreStatusText('Restauration des paramètres de l\'école...');
        setRestoreProgress(15);
        for (const s of tables.school_settings) {
          await supabase.from('school_settings').upsert(s, { onConflict: 'id' });
        }
      }

      setRestoreStatusText('Restauration des classes et salles...');
      setRestoreProgress(30);
      if (tables.classes?.length > 0) {
        for (const cl of tables.classes) {
          const { class: _, ...cleanCl } = cl;
          await supabase.from('classes').upsert(cleanCl, { onConflict: 'id' });
        }
      }
      if (tables.subjects?.length > 0) {
        for (const sub of tables.subjects) {
          await supabase.from('subjects').upsert(sub, { onConflict: 'id' });
        }
      }
      if (tables.rooms?.length > 0) {
        for (const rm of tables.rooms) {
          await supabase.from('rooms').upsert(rm, { onConflict: 'id' });
        }
      }

      setRestoreStatusText('Restauration du corps enseignant et staff...');
      setRestoreProgress(45);
      if (tables.teachers?.length > 0) {
        for (const tc of tables.teachers) {
          await supabase.from('teachers').upsert(tc, { onConflict: 'id' });
        }
      }
      if (tables.staff_members?.length > 0) {
        for (const sf of tables.staff_members) {
          await supabase.from('staff_members').upsert(sf, { onConflict: 'id' });
        }
      }

      setRestoreStatusText('Restauration des élèves...');
      setRestoreProgress(60);
      if (tables.students?.length > 0) {
        for (const st of tables.students) {
          const { class: _, ...cleanSt } = st;
          await supabase.from('students').upsert(cleanSt, { onConflict: 'id' });
        }
      }

      setRestoreStatusText('Restauration du stock et des fournisseurs...');
      setRestoreProgress(75);
      if (tables.suppliers?.length > 0) {
        for (const sup of tables.suppliers) {
          await supabase.from('suppliers').upsert(sup, { onConflict: 'id' });
        }
      }
      if (tables.stock_categories?.length > 0) {
        for (const sc of tables.stock_categories) {
          await supabase.from('stock_categories').upsert(sc, { onConflict: 'id' });
        }
      }
      if (tables.stock_products?.length > 0) {
        for (const sp of tables.stock_products) {
          const { category: _, location: __, ...cleanSp } = sp;
          await supabase.from('stock_products').upsert(cleanSp, { onConflict: 'id' });
        }
      }

      setRestoreStatusText('Restauration des annonces...');
      setRestoreProgress(90);
      if (tables.announcements?.length > 0) {
        for (const ann of tables.announcements) {
          await supabase.from('announcements').upsert(ann, { onConflict: 'id' });
        }
      }

      setRestoreProgress(100);
      setRestoreStatusText('Synchronisation terminée !');

      notify({
        title: dir === 'rtl' ? 'تمت استعادة البيانات بنجاح' : 'Restauration Réussie',
        message: dir === 'rtl' ? 'تمت مزامنة كافة الجداول وقواعد البيانات مع Supabase.' : 'Toutes les données ont été synchronisées avec la base de données.',
        type: 'success',
      });

      setShowRestoreModal(false);
      setRestorePreviewData(null);
      loadBackupHistoryAndStats();
    } catch (err: any) {
      notify({
        title: 'Erreur de Restauration',
        message: err?.message || 'Erreur lors de la synchronisation.',
        type: 'danger',
      });
    } finally {
      setIsRestoringBackup(false);
      setRestoreProgress(0);
    }
  };

  const handleDeleteBackupLog = async (id: string) => {
    const isOk = await confirm({
      title: dir === 'rtl' ? 'حذف سجل النسخة الاحتياطية' : 'Supprimer l\'archive de sauvegarde',
      message: dir === 'rtl' ? 'هل أنت متأكد من حذف هذا السجل من الأرشيف؟' : 'Voulez-vous supprimer cet enregistrement d\'archive ?',
      type: 'danger',
    });
    if (!isOk) return;

    try {
      const supabase = createClient();
      await supabase.from('system_backups').delete().eq('id', id);
      setBackupLogs((prev) => prev.filter((b) => b.id !== id));
      notify({ title: 'Supprimé', message: 'Enregistrement retiré avec succès.', type: 'info' });
    } catch (err: any) {
      notify({ title: 'Erreur', message: err?.message || 'Erreur', type: 'danger' });
    }
  };

  const handleResetWhatsAppDefaults = () => {
    setFormState((prev) => ({
      ...prev,
      whatsapp_absence_template_ar: DEFAULT_WHATSAPP_TEMPLATES.ar_absence,
      whatsapp_absence_template_fr: DEFAULT_WHATSAPP_TEMPLATES.fr_absence,
      whatsapp_late_template_ar: DEFAULT_WHATSAPP_TEMPLATES.ar_late,
      whatsapp_late_template_fr: DEFAULT_WHATSAPP_TEMPLATES.fr_late,
      whatsapp_payment_template_ar: DEFAULT_WHATSAPP_TEMPLATES.ar_payment,
      whatsapp_payment_template_fr: DEFAULT_WHATSAPP_TEMPLATES.fr_payment,
    }));
  };

  const handlePerformSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSaved(false);

    try {
      const success = await updateSettings({
        school_name: formState.school_name.trim(),
        school_name_ar: formState.school_name_ar.trim(),
        academic_year: formState.academic_year.trim(),
        current_term: formState.current_term.trim(),
        email: formState.email.trim(),
        phone: formState.phone.trim(),
        address: formState.address.trim(),
        currency: formState.currency.trim(),
        default_locale: locale,
        logo_url: formState.logo_url,
        whatsapp_absence_template_ar: formState.whatsapp_absence_template_ar.trim(),
        whatsapp_absence_template_fr: formState.whatsapp_absence_template_fr.trim(),
        whatsapp_late_template_ar: formState.whatsapp_late_template_ar.trim(),
        whatsapp_late_template_fr: formState.whatsapp_late_template_fr.trim(),
        whatsapp_payment_template_ar: formState.whatsapp_payment_template_ar.trim(),
        whatsapp_payment_template_fr: formState.whatsapp_payment_template_fr.trim(),
        tuition_fee_maternelle: Number(formState.tuition_fee_maternelle),
        tuition_fee_primaire: Number(formState.tuition_fee_primaire),
        tuition_fee_college: Number(formState.tuition_fee_college),
        tuition_fee_lycee: Number(formState.tuition_fee_lycee),
        default_transport_fee: Number(formState.default_transport_fee),
      });

      if (!success) {
        throw new Error('Erreur lors de l\'enregistrement dans Supabase');
      }

      logAuditEvent({
        action: 'SETTINGS_UPDATED',
        entity_type: 'settings',
        details: {
          school_name: formState.school_name,
          academic_year: formState.academic_year,
          current_term: formState.current_term,
          locale: locale,
        },
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de sauvegarde';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              <Settings className="w-4 h-4" />
              {t('settings')}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('settings_page_title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {dir === 'rtl' ? 'تحديث البيانات الأساسية للمؤسسة، الرسوم، قوالب الرسائل، والنسخ الاحتياطي الشامل.' : "Gestion globale : identité, tarifs, modèles WhatsApp et sauvegardes Supabase."}
            </p>
          </div>

          {saved && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>{dir === 'rtl' ? 'تم حفظ الإعدادات بنجاح !' : 'Paramètres Enregistrés avec Succès !'}</span>
            </div>
          )}

          {errorMsg && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-500/25 animate-in fade-in">
              <AlertCircle className="w-4 h-4" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSettingsTab('GENERAL')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
              activeSettingsTab === 'GENERAL'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>{dir === 'rtl' ? 'الهوية والمعلومات العامة' : 'Général & Identité'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSettingsTab('FEES')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
              activeSettingsTab === 'FEES'
                ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>{dir === 'rtl' ? 'الرسوم المدرسية والتعريفات' : 'Grille Tarifaire'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSettingsTab('WHATSAPP')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
              activeSettingsTab === 'WHATSAPP'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{dir === 'rtl' ? 'قوالب رسائل WhatsApp' : 'Modèles WhatsApp'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSettingsTab('BACKUP')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all whitespace-nowrap cursor-pointer ${
              activeSettingsTab === 'BACKUP'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>{dir === 'rtl' ? 'النسخ الاحتياطي والأمان 💾' : 'Sauvegardes & Sécurité 💾'}</span>
          </button>
        </div>

        {/* TAB 1: GENERAL & IDENTITY */}
        {activeSettingsTab === 'GENERAL' && (
          <form onSubmit={handlePerformSave} className="space-y-6 animate-in fade-in">
            {/* School Logo & Visual Identity Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-sky-500" />
                  {dir === 'rtl' ? 'شعار وهوية المؤسسة (Logo)' : 'Logo & Identité Visuelle'}
                </h2>
                <span className="text-[11px] text-slate-400 font-medium">PNG, JPG, SVG, WebP (Max 3 Mo)</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative group shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white dark:bg-slate-800 border-2 border-dashed border-sky-400/60 p-2 flex items-center justify-center shadow-lg shadow-sky-500/10 overflow-hidden ring-4 ring-sky-500/10">
                    <img
                      src={formState.logo_url || '/logo.png'}
                      alt="School Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs text-white rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity cursor-pointer text-xs font-bold"
                  >
                    <Camera className="w-5 h-5 text-sky-400" />
                    <span>{dir === 'rtl' ? 'تغيير' : 'Changer'}</span>
                  </button>
                </div>

                <div className="flex-1 space-y-3 text-center sm:text-left">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                      {dir === 'rtl' ? 'شعار المؤسسة الرسمي' : 'Logo Officiel de l\'Établissement'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {dir === 'rtl'
                        ? 'يظهر هذا الشعار في القائمة الجانبية (Sidebar)، الرأسية (Topbar)، التقارير المطبوعة، وإشعارات النظام.'
                        : 'Ce logo apparaît dans la barre latérale, l\'en-tête, les relevés de notes et les rapports administratifs.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all cursor-pointer transform active:scale-95"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{dir === 'rtl' ? 'تحميل شعار جديد (Upload)' : 'Téléverser un Nouveau Logo'}</span>
                    </button>

                    {formState.logo_url && formState.logo_url !== '/logo.png' && (
                      <button
                        type="button"
                        onClick={() => setFormState((prev) => ({ ...prev, logo_url: '/logo.png' }))}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{dir === 'rtl' ? 'استعادة الشعار الافتراضي' : 'Logo par défaut'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* School Details */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <Building className="w-4 h-4 text-sky-500" />
                {dir === 'rtl' ? 'معلومات وبيانات المؤسسة الرسمية' : "Informations sur l'Établissement"}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {dir === 'rtl' ? 'اسم المؤسسة (بالفرنسية)' : "Nom de l'École (Français)"}
                  </label>
                  <input
                    type="text"
                    value={formState.school_name}
                    onChange={(e) => setFormState({ ...formState, school_name: e.target.value })}
                    placeholder="Groupe Scolaire Des Générations Montantes"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {dir === 'rtl' ? 'اسم المؤسسة (بالعربية)' : "Nom de l'École (Arabe)"}
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={formState.school_name_ar}
                    onChange={(e) => setFormState({ ...formState, school_name_ar: e.target.value })}
                    placeholder="مجموعة مدارس الأجيال الصاعدة"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {dir === 'rtl' ? 'السنة الدراسية الحالية' : 'Année Scolaire Active'}
                  </label>
                  <input
                    type="text"
                    value={formState.academic_year}
                    onChange={(e) => setFormState({ ...formState, academic_year: e.target.value })}
                    placeholder="2025-2026"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {dir === 'rtl' ? 'الدورة / الأسدس الحالي' : 'Semestre en Cours'}
                  </label>
                  <select
                    value={formState.current_term}
                    onChange={(e) => setFormState({ ...formState, current_term: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    <option value="Semestre 1">{dir === 'rtl' ? 'الدورة الأولى (Semestre 1)' : 'Semestre 1'}</option>
                    <option value="Semestre 2">{dir === 'rtl' ? 'الدورة الثانية (Semestre 2)' : 'Semestre 2'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {dir === 'rtl' ? 'البريد الإلكتروني للإدارة' : 'Email de Direction'}
                  </label>
                  <input
                    type="email"
                    value={formState.email}
                    onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                    placeholder="contact@gm-school.ma"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {dir === 'rtl' ? 'رقم هاتف المؤسسة' : 'Téléphone de Contact'}
                  </label>
                  <input
                    type="text"
                    value={formState.phone}
                    onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                    placeholder="+212 522-001122"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {dir === 'rtl' ? 'عنوان مقر المؤسسة' : 'Adresse de l\'Établissement'}
                  </label>
                  <input
                    type="text"
                    value={formState.address}
                    onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                    placeholder="Casablanca, Maroc"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-blue-600/30 transition-all transform active:scale-95 cursor-pointer disabled:opacity-70"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? (dir === 'rtl' ? 'جاري الحفظ...' : 'Enregistrement en cours...') : (dir === 'rtl' ? 'حفظ الإعدادات' : 'Enregistrer les Paramètres')}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: TARIFF & TUITION FEES */}
        {activeSettingsTab === 'FEES' && (
          <form onSubmit={handlePerformSave} className="space-y-6 animate-in fade-in">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {dir === 'rtl' ? 'جدول الرسوم والواجبات الشهرية الافتراضية' : 'Grille Tarifaire Mensuelle Standard'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {dir === 'rtl'
                        ? 'تُحدد هذه القيم الواجبات الشهرية التلقائية عند تسجيل تلميذ جديد في كل سلك.'
                        : 'Ces montants sont appliqués par défaut lors de l\'inscription de nouveaux élèves.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 dark:text-white">
                    🎨 {dir === 'rtl' ? 'التعليم الأولي (Maternelle)' : 'Cycle Maternelle'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formState.tuition_fee_maternelle}
                      onChange={(e) => setFormState({ ...formState, tuition_fee_maternelle: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">MAD</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 dark:text-white">
                    📚 {dir === 'rtl' ? 'التعليم الابتدائي (Primaire)' : 'Cycle Primaire'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formState.tuition_fee_primaire}
                      onChange={(e) => setFormState({ ...formState, tuition_fee_primaire: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">MAD</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 dark:text-white">
                    🔬 {dir === 'rtl' ? 'التعليم الإعدادي (Collège)' : 'Cycle Collège'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formState.tuition_fee_college}
                      onChange={(e) => setFormState({ ...formState, tuition_fee_college: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">MAD</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 dark:text-white">
                    🎓 {dir === 'rtl' ? 'التعليم الثانوي (Lycée)' : 'Cycle Lycée'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formState.tuition_fee_lycee}
                      onChange={(e) => setFormState({ ...formState, tuition_fee_lycee: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">MAD</span>
                  </div>
                </div>
              </div>

              {/* Transport Scolaire Standard Rate */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-200/70 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0">
                      <Bus className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {dir === 'rtl' ? 'التعريفة الشهرية القياسية للنقل المدرسي' : 'Tarif Mensuel Standard du Transport Scolaire'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {dir === 'rtl' ? 'المبلغ الافتراضي لخدمة النقل المدرسي.' : 'Montant par défaut pour le transport scolaire.'}
                      </p>
                    </div>
                  </div>

                  <div className="w-full sm:w-48 relative shrink-0">
                    <input
                      type="number"
                      value={formState.default_transport_fee}
                      onChange={(e) => setFormState({ ...formState, default_transport_fee: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-sm font-black text-amber-700 dark:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">MAD</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-sm shadow-xl shadow-amber-600/30 transition-all transform active:scale-95 cursor-pointer disabled:opacity-70"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? (dir === 'rtl' ? 'جاري الحفظ...' : 'Enregistrement en cours...') : (dir === 'rtl' ? 'حفظ التعريفات' : 'Enregistrer la Grille')}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: WHATSAPP NOTIFICATION TEMPLATES */}
        {activeSettingsTab === 'WHATSAPP' && (
          <form onSubmit={handlePerformSave} className="space-y-6 animate-in fade-in">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {dir === 'rtl' ? 'إعدادات رسائل واتساب لأولياء الأمور' : 'Modèles des Messages WhatsApp Parents'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {dir === 'rtl'
                        ? 'تخصيص نص الرسائل التلقائية التي يتم إرسالها لولياء الأمور عند تسجيل غياب أو تأخر التلميذ.'
                        : 'Personnalisez les messages pré-remplis lors de l\'envoi direct aux tuteurs.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setWhatsappTab('ar')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        whatsappTab === 'ar'
                          ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      العربية 🇲🇦
                    </button>
                    <button
                      type="button"
                      onClick={() => setWhatsappTab('fr')}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        whatsappTab === 'fr'
                          ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Français 🇫🇷
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetWhatsAppDefaults}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{dir === 'rtl' ? 'استعادة النماذج الأصلية' : 'Modèles par défaut'}</span>
                  </button>
                </div>
              </div>

              {/* Target Type Selector */}
              <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl max-w-md">
                <button
                  type="button"
                  onClick={() => setActiveTarget('absence')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTarget === 'absence'
                      ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {dir === 'rtl' ? 'إشعار الغياب' : "Avis d'Absence"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTarget('late')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTarget === 'late'
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {dir === 'rtl' ? 'إشعار التأخر' : 'Avis de Retard'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTarget('payment')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTarget === 'payment'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {dir === 'rtl' ? 'تذكير بالأداء' : 'Rappel Paiement'}
                </button>
              </div>

              {/* Dynamic Tag Pills */}
              <div className="space-y-2 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{dir === 'rtl' ? 'المتغيرات الديناميكية (انقر للإدراج التلقائي في الرسالة):' : 'Variables dynamiques disponibles (cliquez pour insérer) :'}</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => insertTag('{nom_eleve}')}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-slate-800 dark:text-slate-200 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer shadow-2xs"
                  >
                    {'{nom_eleve}'}
                  </button>

                  <button
                    type="button"
                    onClick={() => insertTag('{classe}')}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-slate-800 dark:text-slate-200 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer shadow-2xs"
                  >
                    {'{classe}'}
                  </button>

                  <button
                    type="button"
                    onClick={() => insertTag('{date}')}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-slate-800 dark:text-slate-200 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer shadow-2xs"
                  >
                    {'{date}'}
                  </button>

                  <button
                    type="button"
                    onClick={() => insertTag('{ecole}')}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-slate-800 dark:text-slate-200 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer shadow-2xs"
                  >
                    {'{ecole}'}
                  </button>

                  {activeTarget === 'late' && (
                    <button
                      type="button"
                      onClick={() => insertTag('{retard_minutes}')}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-500 hover:text-white transition-all cursor-pointer shadow-2xs"
                    >
                      {'{retard_minutes}'}
                    </button>
                  )}

                  {activeTarget === 'payment' && (
                    <button
                      type="button"
                      onClick={() => insertTag('{mois}')}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer shadow-2xs"
                    >
                      {'{mois}'}
                    </button>
                  )}
                </div>
              </div>

              {/* Full Width Textarea */}
              <div className="space-y-2">
                <textarea
                  rows={8}
                  dir={whatsappTab === 'ar' ? 'rtl' : 'ltr'}
                  value={
                    whatsappTab === 'ar'
                      ? activeTarget === 'absence'
                        ? formState.whatsapp_absence_template_ar
                        : activeTarget === 'late'
                        ? formState.whatsapp_late_template_ar
                        : formState.whatsapp_payment_template_ar
                      : activeTarget === 'absence'
                      ? formState.whatsapp_absence_template_fr
                      : activeTarget === 'late'
                      ? formState.whatsapp_late_template_fr
                      : formState.whatsapp_payment_template_fr
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    const fieldKey =
                      whatsappTab === 'ar'
                        ? activeTarget === 'absence'
                          ? 'whatsapp_absence_template_ar'
                          : activeTarget === 'late'
                          ? 'whatsapp_late_template_ar'
                          : 'whatsapp_payment_template_ar'
                        : activeTarget === 'absence'
                        ? 'whatsapp_absence_template_fr'
                        : activeTarget === 'late'
                        ? 'whatsapp_late_template_fr'
                        : 'whatsapp_payment_template_fr';

                    setFormState({ ...formState, [fieldKey]: val });
                  }}
                  className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed font-sans shadow-inner"
                  placeholder={whatsappTab === 'ar' ? 'اكتب نص النموذج هنا...' : 'Rédigez le modèle de message ici...'}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/30 transition-all transform active:scale-95 cursor-pointer disabled:opacity-70"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? (dir === 'rtl' ? 'جاري الحفظ...' : 'Enregistrement en cours...') : (dir === 'rtl' ? 'حفظ نماذج WhatsApp' : 'Enregistrer les Modèles')}</span>
              </button>
            </div>
          </form>
        )}

      {/* TAB 4: GLOBAL DATA BACKUP & RESTORE HUB */}
      {activeSettingsTab === 'BACKUP' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Top Status & Live Database Volume Card */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-[#0a1832] to-slate-950 border border-sky-500/30 text-white shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-400/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <span>{dir === 'rtl' ? 'مركز الأمان والنسخ الاحتياطي الشامل' : 'Hub de Sauvegarde & Sécurité Supabase'}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      {dir === 'rtl' ? 'نظام آمن 100%' : 'Opérationnel & Protégé'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300">
                    {dir === 'rtl' ? 'تأمين كافة بيانات المؤسسة، تنزيل أرشيف شامل، أو استرجاع نقطة حفظ سابقة.' : 'Exportez un instantané complet ou restaurez vos données en toute sécurité.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={loadBackupHistoryAndStats}
                disabled={loadingBackups}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-sky-300 transition-all flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingBackups ? 'animate-spin' : ''}`} />
                <span>{dir === 'rtl' ? 'تحديث الإحصائيات' : 'Actualiser'}</span>
              </button>
            </div>

            {/* Live Count Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-2xl font-black text-sky-400">{liveDbStats.studentsCount}</div>
                <div className="text-xs text-slate-300 font-semibold">{dir === 'rtl' ? 'التلاميذ المسجلون' : 'Élèves Actifs'}</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-2xl font-black text-amber-400">{liveDbStats.teachersCount + liveDbStats.staffCount}</div>
                <div className="text-xs text-slate-300 font-semibold">{dir === 'rtl' ? 'الأساتذة والموظفون' : 'Enseignants & Staff'}</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-2xl font-black text-emerald-400">{liveDbStats.paymentsCount}</div>
                <div className="text-xs text-slate-300 font-semibold">{dir === 'rtl' ? 'عمليات الأداء المسجلة' : 'Reçus de Paiement'}</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-2xl font-black text-purple-400">{liveDbStats.stockCount}</div>
                <div className="text-xs text-slate-300 font-semibold">{dir === 'rtl' ? 'مواد المخزون' : 'Articles en Stock'}</div>
              </div>
            </div>
          </div>

          {/* Actions Grid: Export Full Snapshot vs Restore from File */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Box 1: Export Complete Database */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                    <Download className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {dir === 'rtl' ? 'إنشاء وتنزيل نسخة احتياطية كاملة' : 'Sauvegarde Complète (Snapshot JSON)'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {dir === 'rtl'
                        ? 'تجميع كافة الجداول (تلاميذ، أساتذة، مالية، مخزون، استعمال الزمن) في ملف JSON موثق.'
                        : 'Archive l\'intégralité des tables et enregistre un snapshot dans Supabase.'}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
                  💡 <strong>{dir === 'rtl' ? 'نصيحة أمنية :' : 'Recommandation :'}</strong> {dir === 'rtl'
                    ? 'يُستحسن تنزيل نسخة احتياطية مرة كل أسبوع أو قبل نهاية كل دورة دراسية والاحتفاظ بها في مكان آمن.'
                    : 'Conservez une copie sur un disque externe ou Google Drive à la fin de chaque mois ou semestre.'}
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportCompleteBackup}
                disabled={isExportingBackup}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                <Download className={`w-4 h-4 ${isExportingBackup ? 'animate-bounce' : ''}`} />
                <span>{isExportingBackup ? (dir === 'rtl' ? 'جاري تجميع البيانات...' : 'Exportation en cours...') : (dir === 'rtl' ? 'تنزيل النسخة الاحتياطية الكاملة (.json)' : 'Télécharger la Sauvegarde Complète')}</span>
              </button>
            </div>

            {/* Box 2: Restore from Backup File */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      {dir === 'rtl' ? 'استرجاع البيانات من نسخة سابقة' : 'Restaurer une Sauvegarde'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {dir === 'rtl'
                        ? 'رفع ملف نسخة سابقة (.json) واسترجاع البيانات المفقودة ومزامنتها تلقائياً مع Supabase.'
                        : 'Injectez un fichier de sauvegarde JSON pour rétablir vos données d\'origine.'}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                  ⚠️ <strong>{dir === 'rtl' ? 'تنبيه أمان :' : 'Attention :'}</strong> {dir === 'rtl'
                    ? 'سيتم فحص الملف أولاً وعرض محتوياته للمراجعة والموافقة قبل تطبيق الاسترجاع.'
                    : 'Le système validera le fichier et vous demandera confirmation avant d\'effectuer la restauration.'}
                </div>
              </div>

              <div>
                <input
                  ref={restoreFileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelectedForRestore}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => restoreFileInputRef.current?.click()}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{dir === 'rtl' ? 'اختيار ورفع ملف النسخة (.json)' : 'Sélectionner un Fichier de Sauvegarde'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Individual Master Table Exports (Excel / CSV) */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {dir === 'rtl' ? 'تصدير الجداول الفردية بصيغة Excel / CSV' : 'Exports Individuels des Tables (Excel / CSV)'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {dir === 'rtl' ? 'تنزيل ملفات جدولية مباشرة لكل قسم للاستخدام والتحليل في برنامج Excel.' : 'Téléchargez des extractions ciblées par module.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => handleExportTableCSV('STUDENTS')}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:border-sky-300 transition-all text-left flex items-center justify-between group cursor-pointer"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-xs text-slate-900 dark:text-white">👨‍🎓 {dir === 'rtl' ? 'قاعدة بيانات التلاميذ' : 'Base Élèves'}</div>
                  <div className="text-[11px] text-slate-400">{liveDbStats.studentsCount} {dir === 'rtl' ? 'تلميذ' : 'élèves'} &bull; CSV</div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => handleExportTableCSV('TEACHERS')}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-300 transition-all text-left flex items-center justify-between group cursor-pointer"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-xs text-slate-900 dark:text-white">👨‍🏫 {dir === 'rtl' ? 'هيئة التدريس والأطر' : 'Corps Enseignant'}</div>
                  <div className="text-[11px] text-slate-400">{liveDbStats.teachersCount} {dir === 'rtl' ? 'أستاذ' : 'enseignants'} &bull; CSV</div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => handleExportTableCSV('FINANCE')}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 transition-all text-left flex items-center justify-between group cursor-pointer"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-xs text-slate-900 dark:text-white">💳 {dir === 'rtl' ? 'سجل الأداءات والمداخيل' : 'Journal des Paiements'}</div>
                  <div className="text-[11px] text-slate-400">{liveDbStats.paymentsCount} {dir === 'rtl' ? 'وصل' : 'reçus'} &bull; CSV</div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => handleExportTableCSV('STOCK')}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-300 transition-all text-left flex items-center justify-between group cursor-pointer"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-xs text-slate-900 dark:text-white">📦 {dir === 'rtl' ? 'جرد سلع المخزون' : 'Inventaire du Stock'}</div>
                  <div className="text-[11px] text-slate-400">{liveDbStats.stockCount} {dir === 'rtl' ? 'مادة' : 'articles'} &bull; CSV</div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
              </button>
            </div>
          </div>

          {/* Supabase Backup Snapshots Log Table */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {dir === 'rtl' ? 'أرشيف وسجل النسخ الاحتياطية في Supabase' : 'Historique des Snapshots de Sauvegarde'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {dir === 'rtl' ? 'سجل العمليات السابقة مع التاريخ، الحجم وعدد السجلات.' : 'Liste des sauvegardes archivées dans la base de données.'}
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {backupLogs.length} {dir === 'rtl' ? 'نسخة مسجلة' : 'archive(s)'}
              </span>
            </div>

            {backupLogs.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                {dir === 'rtl' ? 'لم يتم تسجيل أي نسخة احتياطية بعد. اضغط على زر التنزيل لإنشاء أول نسخة.' : 'Aucune sauvegarde archivée pour le moment.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {backupLogs.map((log) => {
                  const sizeKb = Math.round((log.file_size_bytes || 0) / 1024);
                  return (
                    <div key={log.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 shrink-0">
                          <FileArchive className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">
                            {log.backup_name}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>📅 {new Date(log.created_at).toLocaleString(dir === 'rtl' ? 'ar-MA' : 'fr-FR')}</span>
                            <span>&bull;</span>
                            <span>👤 {log.created_by || 'Admin'}</span>
                            <span>&bull;</span>
                            <span>📊 {log.total_records} {dir === 'rtl' ? 'سجل' : 'enregistrements'}</span>
                            <span>&bull;</span>
                            <span>💾 {sizeKb} KB</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteBackupLog(log.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title={dir === 'rtl' ? 'حذف من السجل' : 'Supprimer du journal'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* RESTORE CONFIRMATION & PROGRESS MODAL */}
      {showRestoreModal && restorePreviewData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {dir === 'rtl' ? 'مراجعة وتأكيد استرجاع البيانات' : 'Confirmer la Restauration des Données'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {dir === 'rtl' ? 'معلومات النسخة المختارة قبل بدء المزامنة' : 'Vérifiez les données du fichier avant application'}
                  </p>
                </div>
              </div>

              {!isRestoringBackup && (
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Metadata Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">{dir === 'rtl' ? 'المؤسسة :' : 'Établissement :'}</span>
                <span className="font-bold text-slate-900 dark:text-white">{restorePreviewData.metadata?.school_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{dir === 'rtl' ? 'تاريخ إنشاء النسخة :' : 'Date de Sauvegarde :'}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {new Date(restorePreviewData.metadata?.backup_timestamp).toLocaleString(dir === 'rtl' ? 'ar-MA' : 'fr-FR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{dir === 'rtl' ? 'المسؤول :' : 'Auteur :'}</span>
                <span className="font-bold text-slate-900 dark:text-white">{restorePreviewData.metadata?.created_by || 'Admin'}</span>
              </div>
            </div>

            {/* Records Summary Grid */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {dir === 'rtl' ? 'السجلات التي سيتم استرجاعها وتحديثها :' : 'Contenu à restaurer :'}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50">
                  <span className="text-slate-500">{dir === 'rtl' ? 'التلاميذ :' : 'Élèves :'}</span>
                  <span className="font-black text-sky-700 dark:text-sky-300 ml-1.5">{restorePreviewData.stats?.students || 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                  <span className="text-slate-500">{dir === 'rtl' ? 'الأساتذة :' : 'Enseignants :'}</span>
                  <span className="font-black text-amber-700 dark:text-amber-300 ml-1.5">{restorePreviewData.stats?.teachers || 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50">
                  <span className="text-slate-500">{dir === 'rtl' ? 'الأقسام :' : 'Classes :'}</span>
                  <span className="font-black text-purple-700 dark:text-purple-300 ml-1.5">{restorePreviewData.stats?.classes || 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
                  <span className="text-slate-500">{dir === 'rtl' ? 'المالية :' : 'Paiements :'}</span>
                  <span className="font-black text-emerald-700 dark:text-emerald-300 ml-1.5">{restorePreviewData.stats?.tuition_payments || 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50">
                  <span className="text-slate-500">{dir === 'rtl' ? 'المخزون :' : 'Stock :'}</span>
                  <span className="font-black text-indigo-700 dark:text-indigo-300 ml-1.5">{restorePreviewData.stats?.stock_products || 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
                  <span className="text-slate-500">{dir === 'rtl' ? 'الإعلانات :' : 'Annonces :'}</span>
                  <span className="font-black text-rose-700 dark:text-rose-300 ml-1.5">{restorePreviewData.stats?.announcements || 0}</span>
                </div>
              </div>
            </div>

            {/* Progress Bar (during restore) */}
            {isRestoringBackup && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                  <span>{restoreStatusText}</span>
                  <span>{restoreProgress}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all duration-300 rounded-full"
                    style={{ width: `${restoreProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              {!isRestoringBackup ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowRestoreModal(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    {dir === 'rtl' ? 'إلغاء' : 'Annuler'}
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteRestore}
                    className="px-6 py-2.5 text-xs font-black text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-xl shadow-lg shadow-amber-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{dir === 'rtl' ? 'تأكيد واسترجاع البيانات الآن' : 'Confirmer la Restauration'}</span>
                  </button>
                </>
              ) : (
                <div className="text-xs text-slate-400 font-semibold flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                  <span>{dir === 'rtl' ? 'يرجى الانتظار، جاري حفظ البيانات...' : 'Synchronisation en cours, veuillez patienter...'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
