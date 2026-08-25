'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import {
  Announcement,
  AnnouncementAudience,
  AnnouncementPriority,
  Teacher,
  StaffMember,
} from '@/types/database';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useNotify, useConfirm } from '@/lib/modal-service';
import { useSettings } from '@/lib/settings';
import { logAuditEvent } from '@/lib/audit';
import {
  Megaphone,
  MessageSquare,
  Users,
  Send,
  Plus,
  Search,
  Pin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  Building2,
  GraduationCap,
  Shield,
  Truck,
  Trash2,
  Edit3,
  ExternalLink,
  Copy,
  Check,
  X,
  Phone,
  Bookmark,
  Share2,
  Filter,
  Layers,
  FileText
} from 'lucide-react';

// Default / Initial announcements in case table is empty or loading
const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: 'انعقاد المجلس البيداغوجي وتنسيق المواد العلمية واللغات',
    content: `تحية طيبة لكافة الأساتذة الكرام،\n\nتنهي إدارة المؤسسة إلى علم كافة السادة الأساتذة أنه تقرر عقد الاجتماع التنسيقي البيداغوجي يوم الجمعة القادم على الساعة 16:30 بقاعة الاجتماعات الرئيسية.\n\nجدول الأعمال:\n1. تقييم المكتسبات للفترة السابقة.\n2. التنسيق حول رزنامة الفروض والمراقبة المستمرة.\n3. مقترحات الأنشطة الموازية والنوادي المدرسية.\n\nحضوركم ضروري ومؤكد لإنجاح هذا اللقاء.`,
    target_audience: 'TEACHERS',
    priority: 'IMPORTANT',
    author_name: 'الإدارة التربوية',
    is_pinned: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'ann-2',
    title: 'مذكرة تنظيمية خاصة بالمواكبة الإدارية والنظام الداخلي',
    content: `إلى جميع أطر الإدارة وهيئة الإشراف،\n\nيرجى التفضل بالحرص على تسجيل وتوثيق تقارير الحضور اليومية ومتابعة دفاتر النصوص الرقمية واستقبال أولياء الأمور وفق المواعيد الرسمية المقررة.\n\nشكراً لحسن تعاونكم والتزامكم الدائم.`,
    target_audience: 'ADMIN',
    priority: 'INFO',
    author_name: 'المدير العام',
    is_pinned: true,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'ann-3',
    title: 'تعليمات الحراسة العامة وتأمين فترات الاستراحة والنقل المدرسي',
    content: `السادة المشرفون وسائقو حافلات النقل المدرسي،\n\nنؤكد على ضرورة التواجد قبل موعد الدخول بـ 15 دقيقة، وضمان المراقبة المستمرة لسلامة التلاميذ أثناء الصعود والنزول وفترات الاستراحة الصباحية والمسائية.`,
    target_audience: 'SUPERVISORS',
    priority: 'URGENT',
    author_name: 'الحراسة العامة',
    is_pinned: false,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'ann-4',
    title: 'بلاغ إخباري عام: انطلاق الأنشطة الثقافية والرياضية للموسم الدراسي',
    content: `تعلن إدارة المؤسسة عن فتح باب التسجيل في الأندية الثقافية والرياضية والنوادي العلمية لجميع المستويات ابتداءً من الأسبوع المقبل.\n\nمرحباً بمبادرات واقتراحات جميع الأطر التربوية والتلاميذ.`,
    target_audience: 'ALL',
    priority: 'EVENT',
    author_name: 'إدارة الأنشطة والحياة المدرسية',
    is_pinned: false,
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
];

// Predefined WhatsApp message templates
interface WhatsAppTemplate {
  id: string;
  name: string;
  nameAr: string;
  icon: any;
  category: 'TEACHER' | 'STAFF' | 'GENERAL';
  defaultText: string;
  defaultTextAr: string;
}

const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'meeting',
    name: 'Convocation Réunion Pédagogique',
    nameAr: 'استدعاء لاجتماع تربوي',
    icon: Calendar,
    category: 'TEACHER',
    defaultText: `Bonjour Professeur {teacher_name},\n\nLa Direction de l'établissement {school_name} a l'honneur de vous convier à la Réunion Pédagogique ({specialization}) qui se tiendra :\n📅 Date : {date}\n⏰ Heure : {time}\n📍 Lieu : Salle des Réunions\n\n📌 Ordre du jour : {subject}\n\nVotre présence est vivement souhaitée. Cordialement,\nDirection {school_name}`,
    defaultTextAr: `السلام عليكم ورحمة الله تعالى وبركاته،\nالأستاذ(ة) الفاضل(ة) {teacher_name} ({specialization})،\n\nتتشرف إدارة {school_name} بدعوتكم لحضور الاجتماع التربوي المزمع عقده:\n📅 التاريخ : {date}\n⏰ التوقيت : {time}\n📍 المكان : قاعة الاجتماعات الرئيسية\n\n📌 موضوع الاجتماع : {subject}\n\nحضوركم مهم لإغناء النقاش التربوي والتنسيق.\nمع أزكى التحيات والتقدير،\nإدارة {school_name}`,
  },
  {
    id: 'admin_note',
    name: 'Note de Service & Information',
    nameAr: 'مذكرة إدارية وإشعار رسمي',
    icon: FileText,
    category: 'GENERAL',
    defaultText: `Bonjour {recipient_name},\n\nNous vous prions de prendre connaissance de la note de service suivante émise par la Direction de {school_name} :\n\n📌 Objet : {subject}\n📝 Message : {note}\n\nRestant à votre disposition pour toute information complémentaire.\nCordialement, Direction {school_name}`,
    defaultTextAr: `تحية طيبة واحتراماً،\nالأستاذ(ة) / الزميل(ة) {recipient_name}،\n\nتنهي إدارة {school_name} إلى علمكم ما يلي بخصوص :\n📌 الموضوع : {subject}\n📝 التفاصيل : {note}\n\nشاكرين لكم حسن تعاونكم وتفانيكم الدائم.\nإدارة {school_name}`,
  },
  {
    id: 'schedule_change',
    name: 'Changement dans l\'Emploi du Temps',
    nameAr: 'إشعار بتعديل في استعمال الزمن',
    icon: Clock,
    category: 'TEACHER',
    defaultText: `Bonjour Professeur {teacher_name},\n\nNous vous informons qu'un ajustement a été apporté à votre emploi du temps pour la séance du {date} à {time}.\n\n📌 Détails : {note}\n\nVous pouvez consulter votre planning à jour directement sur la plateforme GM School.\nMerci de votre compréhension, Direction {school_name}`,
    defaultTextAr: `السلام عليكم الأستاذ(ة) {teacher_name}،\n\nنحيطكم علماً بأنه تم إجراء تعديل في جدول الحصص الخاص بكم ليوم {date} على الساعة {time}.\n\n📌 تفاصيل التعديل : {note}\n\nيمكنكم الاطلاع على الجدول المحدث مباشرة من خلال المنصة الرقمية.\nتقبلوا فائق الاحترام والتقدير،\nإدارة {school_name}`,
  },
  {
    id: 'notes_reminder',
    name: 'Rappel Dépôt des Notes & Évaluations',
    nameAr: 'تذكير بمسك وتسليم النقط',
    icon: Bookmark,
    category: 'TEACHER',
    defaultText: `Bonjour Professeur {teacher_name},\n\nRappel amical concernant la date limite de remise et de saisie des notes du contrôle continu pour la matière ({specialization}).\n\n📅 Dernier délai : {date}\n\nMerci de veiller au respect des délais pour la préparation des bulletins scolaires.\nCordialement, Direction {school_name}`,
    defaultTextAr: `تحية تقدير واحترام،\nالأستاذ(ة) الفاضل(ة) {teacher_name} ({specialization})،\n\nنود تذكيركم بموعد حصر ومسك نقط المراقبة المستمرة وتسليم أوراق الفروض الخاصة بـ {subject}.\n\n📅 آخر أجل محدد : {date}\n\nشاكرين لكم حرصكم الدائم على الالتزام بالجدولة المحددة.\nإدارة {school_name}`,
  },
  {
    id: 'custom',
    name: 'Message Personnalisé Libre',
    nameAr: 'رسالة خاصة وحرة',
    icon: MessageSquare,
    category: 'GENERAL',
    defaultText: `Bonjour {recipient_name},\n\n{note}\n\nCordialement,\nDirection {school_name}`,
    defaultTextAr: `السلام عليكم الأستاذ(ة) {recipient_name}،\n\n{note}\n\nمع خالص التحيات والتقدير،\nإدارة {school_name}`,
  },
];

export default function AnnouncementsPage() {
  const { t, dir } = useI18n();
  const { profile } = useAuth();
  const { settings } = useSettings();
  const notify = useNotify();
  const confirm = useConfirm();

  const isTeacher = profile?.role === 'TEACHER';
  const isAdminOrSupervisor = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN' || profile?.role === 'SUPERVISOR';

  // Navigation Mode: 'ANNOUNCEMENTS' vs 'WHATSAPP_HUB'
  const [activeMainTab, setActiveMainTab] = useState<'ANNOUNCEMENTS' | 'WHATSAPP_HUB'>('ANNOUNCEMENTS');

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>(INITIAL_ANNOUNCEMENTS);
  const [selectedAudienceFilter, setSelectedAudienceFilter] = useState<AnnouncementAudience | 'ALL_FILTER'>('ALL_FILTER');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Announcement Modal State
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);
  const [annFormData, setAnnFormData] = useState({
    title: '',
    content: '',
    target_audience: 'TEACHERS' as AnnouncementAudience,
    priority: 'IMPORTANT' as AnnouncementPriority,
    is_pinned: false,
    expires_at: '',
  });

  // WhatsApp Hub State
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedRecipientType, setSelectedRecipientType] = useState<'SINGLE_TEACHER' | 'ALL_TEACHERS' | 'STAFF_ADMIN' | 'STAFF_SUPERVISOR' | 'STAFF_TRANSPORT'>('SINGLE_TEACHER');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('meeting');
  const [templateLanguage, setTemplateLanguage] = useState<'ar' | 'fr'>('ar');
  const [copied, setCopied] = useState(false);

  // Dynamic parameters for template
  const [waParams, setWaParams] = useState({
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time: '16:30',
    subject: 'التنسيق البيداغوجي وجدول الفروض',
    note: 'يرجى إحضار دفاتر النصوص ووثائق المراقبة المستمرة.',
  });

  // Load announcements, teachers, staff from Supabase
  const loadData = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: annData }, { data: tchData }, { data: stfData }] = await Promise.all([
        supabase.from('announcements').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('teachers').select('*').order('last_name', { ascending: true }),
        supabase.from('staff_members').select('*').order('last_name', { ascending: true }),
      ]);

      if (annData && annData.length > 0) {
        setAnnouncements(annData);
      } else {
        // Fallback to initial announcements
        setAnnouncements(INITIAL_ANNOUNCEMENTS);
      }

      if (tchData) {
        setTeachersList(tchData);
        if (tchData.length > 0 && !selectedTeacherId) {
          setSelectedTeacherId(tchData[0].id);
        }
      }

      if (stfData) {
        setStaffList(stfData);
      }
    } catch (err) {
      console.warn('Announcements loading error (fallback to local state):', err);
      setAnnouncements(INITIAL_ANNOUNCEMENTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((ann) => {
      // Role-based visibility check for TEACHER
      if (isTeacher) {
        if (ann.target_audience !== 'ALL' && ann.target_audience !== 'TEACHERS') {
          return false;
        }
      }

      // Audience Filter check
      if (selectedAudienceFilter !== 'ALL_FILTER') {
        if (selectedAudienceFilter === 'ALL' && ann.target_audience !== 'ALL') return false;
        if (selectedAudienceFilter !== 'ALL' && ann.target_audience !== selectedAudienceFilter && ann.target_audience !== 'ALL') return false;
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (ann.title || '').toLowerCase().includes(q);
        const matchesContent = (ann.content || '').toLowerCase().includes(q);
        const matchesAuthor = (ann.author_name || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesContent && !matchesAuthor) return false;
      }

      return true;
    });
  }, [announcements, selectedAudienceFilter, searchQuery, isTeacher]);

  // Selected Teacher object
  const currentSelectedTeacher = useMemo(() => {
    return teachersList.find((t) => t.id === selectedTeacherId) || teachersList[0] || null;
  }, [teachersList, selectedTeacherId]);

  // Generate WhatsApp Message text based on selected template and dynamic variables
  const generatedWhatsAppText = useMemo(() => {
    const tmpl = WHATSAPP_TEMPLATES.find((t) => t.id === selectedTemplateId) || WHATSAPP_TEMPLATES[0];
    const rawTemplate = templateLanguage === 'ar' ? tmpl.defaultTextAr : tmpl.defaultText;
    const schoolName = settings.school_name || 'GROUPE SCOLAIRE GM';

    let teacherName = 'الأستاذ(ة) المحترم(ة)';
    let teacherSpec = 'هيئة التدريس';

    if (currentSelectedTeacher) {
      teacherName = `${currentSelectedTeacher.first_name} ${currentSelectedTeacher.last_name}`;
      teacherSpec = currentSelectedTeacher.specialization || 'التدريس';
    }

    let text = rawTemplate
      .replace(/{school_name}/g, schoolName)
      .replace(/{teacher_name}/g, teacherName)
      .replace(/{recipient_name}/g, teacherName)
      .replace(/{specialization}/g, teacherSpec)
      .replace(/{date}/g, waParams.date || '')
      .replace(/{time}/g, waParams.time || '')
      .replace(/{subject}/g, waParams.subject || '')
      .replace(/{note}/g, waParams.note || '');

    return text;
  }, [selectedTemplateId, templateLanguage, currentSelectedTeacher, settings.school_name, waParams]);

  // Handle Save Announcement
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annFormData.title.trim() || !annFormData.content.trim()) {
      notify({ title: 'Champs requis', message: 'Veuillez renseigner le titre et le contenu.', type: 'warning' });
      return;
    }

    try {
      const supabase = createClient();
      const author = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Administration';

      if (editingAnnId) {
        // Update
        const updated = announcements.map((a) =>
          a.id === editingAnnId
            ? {
                ...a,
                title: annFormData.title,
                content: annFormData.content,
                target_audience: annFormData.target_audience,
                priority: annFormData.priority,
                is_pinned: annFormData.is_pinned,
                expires_at: annFormData.expires_at || undefined,
                updated_at: new Date().toISOString(),
              }
            : a
        );
        setAnnouncements(updated);

        // Try updating Supabase
        await supabase
          .from('announcements')
          .update({
            title: annFormData.title,
            content: annFormData.content,
            target_audience: annFormData.target_audience,
            priority: annFormData.priority,
            is_pinned: annFormData.is_pinned,
            expires_at: annFormData.expires_at || null,
          })
          .eq('id', editingAnnId);

        logAuditEvent({
          action: 'ANNOUNCEMENT_UPDATED',
          entity_type: 'announcements',
          entity_id: editingAnnId,
          details: { title: annFormData.title, audience: annFormData.target_audience },
        });

        notify({ title: 'Succès', message: 'Annonce mise à jour avec succès !', type: 'success' });
      } else {
        // Insert
        const newAnn: Announcement = {
          id: `ann-${Date.now()}`,
          title: annFormData.title,
          content: annFormData.content,
          target_audience: annFormData.target_audience,
          priority: annFormData.priority,
          author_name: author,
          author_id: profile?.id,
          is_pinned: annFormData.is_pinned,
          expires_at: annFormData.expires_at || undefined,
          created_at: new Date().toISOString(),
        };

        setAnnouncements([newAnn, ...announcements]);

        await supabase.from('announcements').insert([
          {
            title: annFormData.title,
            content: annFormData.content,
            target_audience: annFormData.target_audience,
            priority: annFormData.priority,
            author_name: author,
            is_pinned: annFormData.is_pinned,
            expires_at: annFormData.expires_at || null,
          },
        ]);

        logAuditEvent({
          action: 'ANNOUNCEMENT_CREATED',
          entity_type: 'announcements',
          details: { title: annFormData.title, audience: annFormData.target_audience },
        });

        notify({ title: 'Succès', message: 'Annonce publiée avec succès !', type: 'success' });
      }

      setShowAnnModal(false);
    } catch (err) {
      console.warn('Error saving announcement to Supabase (saved in local memory):', err);
      setShowAnnModal(false);
    }
  };

  // Handle Delete Announcement
  const handleDeleteAnnouncement = async (id: string, title: string) => {
    const isOk = await confirm({
      title: 'Supprimer l\'annonce ?',
      message: `Êtes-vous sûr de vouloir supprimer définitivement l'annonce "${title}" ?`,
      type: 'danger',
    });
    if (!isOk) return;

    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    try {
      const supabase = createClient();
      await supabase.from('announcements').delete().eq('id', id);
      logAuditEvent({
        action: 'ANNOUNCEMENT_DELETED',
        entity_type: 'announcements',
        entity_id: id,
        details: { title },
      });
      notify({ title: 'Supprimée', message: 'Annonce supprimée avec succès.', type: 'info' });
    } catch (err) {
      console.warn('Delete announcement error:', err);
    }
  };

  // Open WhatsApp Link directly
  const handleOpenWhatsApp = (customPhone?: string) => {
    const targetPhone = customPhone || currentSelectedTeacher?.phone;
    if (!targetPhone) {
      notify({
        title: 'Numéro Manquant',
        message: 'Cet enseignant n\'a pas de numéro de téléphone enregistré dans sa fiche.',
        type: 'warning',
      });
      return;
    }

    // Clean phone number (e.g. 0661122334 -> 212661122334)
    let cleanNumber = targetPhone.replace(/[^0-9]/g, '');
    if (cleanNumber.startsWith('0')) {
      cleanNumber = '212' + cleanNumber.slice(1);
    } else if (!cleanNumber.startsWith('212') && cleanNumber.length <= 10) {
      cleanNumber = '212' + cleanNumber;
    }

    const encodedText = encodeURIComponent(generatedWhatsAppText);
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodedText}`;
    window.open(waUrl, '_blank');
  };

  // Copy message to clipboard
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(generatedWhatsAppText);
    setCopied(true);
    notify({ title: 'Copié !', message: 'Texte du message copié dans le presse-papier.', type: 'success' });
    setTimeout(() => setCopied(false), 2500);
  };

  // Audience Helper Badges
  const getAudienceBadge = (aud: AnnouncementAudience) => {
    switch (aud) {
      case 'TEACHERS':
        return {
          label: dir === 'rtl' ? '👨‍🏫 هيئة التدريس (الأساتذة)' : 'Enseignants',
          bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
          icon: GraduationCap,
        };
      case 'ADMIN':
        return {
          label: dir === 'rtl' ? '🏢 الطاقم الإداري' : 'Administration',
          bg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
          icon: Building2,
        };
      case 'SUPERVISORS':
        return {
          label: dir === 'rtl' ? '🛡️ الحراسة والمشرفين' : 'Surveillants & Vie Scolaire',
          bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
          icon: Shield,
        };
      case 'TRANSPORT':
        return {
          label: dir === 'rtl' ? '🚐 النقل المدرسي' : 'Transport Scolaire',
          bg: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
          icon: Truck,
        };
      case 'MAINTENANCE':
        return {
          label: dir === 'rtl' ? '🧹 النظافة والصيانة' : 'Entretien & Ménage',
          bg: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
          icon: Users,
        };
      case 'ALL':
      default:
        return {
          label: dir === 'rtl' ? '📢 إعلان عام للجميع' : 'Tout le Personnel',
          bg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
          icon: Megaphone,
        };
    }
  };

  // Priority Helper Badges
  const getPriorityBadge = (p: AnnouncementPriority) => {
    switch (p) {
      case 'URGENT':
        return {
          label: dir === 'rtl' ? '🚨 عاجل وهام' : 'URGENT',
          bg: 'bg-rose-500 text-white shadow-xs animate-pulse',
          icon: AlertTriangle,
        };
      case 'IMPORTANT':
        return {
          label: dir === 'rtl' ? '⚠️ هام جداً' : 'IMPORTANT',
          bg: 'bg-amber-500 text-white shadow-xs',
          icon: AlertTriangle,
        };
      case 'EVENT':
        return {
          label: dir === 'rtl' ? '🎉 نشاط / فعالية' : 'ÉVÉNEMENT',
          bg: 'bg-purple-600 text-white shadow-xs',
          icon: Sparkles,
        };
      case 'INFO':
      default:
        return {
          label: dir === 'rtl' ? 'ℹ️ إخباري' : 'INFO',
          bg: 'bg-sky-500 text-white shadow-xs',
          icon: Info,
        };
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in pb-12">
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/25 flex items-center justify-center shrink-0">
              <Megaphone className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                <span>{dir === 'rtl' ? 'التواصل الداخلي والمذكرات' : 'Communication & Mémos'}</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {dir === 'rtl' ? 'لوحة الإعلانات ومركز التواصل WhatsApp' : 'Annonces & Centre de Communication WhatsApp'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {dir === 'rtl'
                  ? 'مذكرات إدارية، بلاغات مخصصة للأساتذة والموظفين، ومراسلة فورية عبر الواتساب بنقرة واحدة.'
                  : 'Panneau d\'affichage officiel et centre de messagerie WhatsApp directe pour enseignants et personnel.'}
              </p>
            </div>
          </div>

          {/* Main Mode Toggle Switcher */}
          <div className="flex items-center p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              onClick={() => setActiveMainTab('ANNOUNCEMENTS')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeMainTab === 'ANNOUNCEMENTS'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Megaphone className="w-4 h-4" />
              <span>{dir === 'rtl' ? 'لوحة الإعلانات والمذكرات' : 'Panneau d\'Affichage'}</span>
              <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                {filteredAnnouncements.length}
              </span>
            </button>

            {isAdminOrSupervisor && (
              <button
                onClick={() => setActiveMainTab('WHATSAPP_HUB')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeMainTab === 'WHATSAPP_HUB'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-emerald-300" />
                <span>{dir === 'rtl' ? 'مركز WhatsApp الموظفين' : 'Centre WhatsApp Staff 📲'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: PANNEAU D'AFFICHAGE (لوحة الإعلانات والمذكرات) */}
        {/* ========================================================================= */}
        {activeMainTab === 'ANNOUNCEMENTS' && (
          <div className="space-y-6">
            {/* Filter and Action Bar */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Category Audience Filter Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  onClick={() => setSelectedAudienceFilter('ALL_FILTER')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    selectedAudienceFilter === 'ALL_FILTER'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {dir === 'rtl' ? '🌟 جميع الإعلانات' : '🌟 Toutes les Annonces'}
                </button>

                <button
                  onClick={() => setSelectedAudienceFilter('TEACHERS')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    selectedAudienceFilter === 'TEACHERS'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>{dir === 'rtl' ? 'فقرة الأساتذة' : 'Enseignants'}</span>
                </button>

                {!isTeacher && (
                  <>
                    <button
                      onClick={() => setSelectedAudienceFilter('ADMIN')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        selectedAudienceFilter === 'ADMIN'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{dir === 'rtl' ? 'فقرة الإدارة' : 'Administration'}</span>
                    </button>

                    <button
                      onClick={() => setSelectedAudienceFilter('SUPERVISORS')}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        selectedAudienceFilter === 'SUPERVISORS'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>{dir === 'rtl' ? 'المشرفين والمعنيين' : 'Surveillants'}</span>
                    </button>
                  </>
                )}
              </div>

              {/* Search & Publish button */}
              <div className="flex items-center gap-2.5">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={dir === 'rtl' ? 'بحث في الإعلانات...' : 'Rechercher une annonce...'}
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {isAdminOrSupervisor && (
                  <button
                    onClick={() => {
                      setEditingAnnId(null);
                      setAnnFormData({
                        title: '',
                        content: '',
                        target_audience: 'TEACHERS',
                        priority: 'IMPORTANT',
                        is_pinned: false,
                        expires_at: '',
                      });
                      setShowAnnModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/25 transition-all shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{dir === 'rtl' ? 'نشر إعلان جديد' : 'Publier une Annonce'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Announcements Grid Cards */}
            {filteredAnnouncements.length === 0 ? (
              <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                  <Megaphone className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {dir === 'rtl' ? 'لا توجد إعلانات حالياً' : 'Aucune annonce disponible'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {dir === 'rtl'
                    ? 'لم يتم نشر أي إعلانات أو مذكرات في هذا القسم حالياً.'
                    : 'Aucune note de service ou annonce n\'a été publiée pour cette catégorie.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredAnnouncements.map((ann) => {
                  const audBadge = getAudienceBadge(ann.target_audience);
                  const prioBadge = getPriorityBadge(ann.priority);
                  const AudIcon = audBadge.icon;
                  const PrioIcon = prioBadge.icon;

                  return (
                    <div
                      key={ann.id}
                      className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border transition-all duration-300 flex flex-col justify-between relative shadow-sm hover:shadow-md ${
                        ann.is_pinned
                          ? 'border-amber-400 dark:border-amber-500/50 bg-gradient-to-b from-amber-50/20 to-transparent'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {/* Top Meta Bar */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {ann.is_pinned && (
                              <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white font-black text-[10px] flex items-center gap-1 shadow-xs">
                                <Pin className="w-2.5 h-2.5" />
                                <span>{dir === 'rtl' ? 'مثبت' : 'Épinglé'}</span>
                              </span>
                            )}

                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 ${prioBadge.bg}`}>
                              <PrioIcon className="w-2.5 h-2.5" />
                              <span>{prioBadge.label}</span>
                            </span>

                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${audBadge.bg}`}>
                              <AudIcon className="w-3 h-3" />
                              <span>{audBadge.label}</span>
                            </span>
                          </div>

                          {isAdminOrSupervisor && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingAnnId(ann.id);
                                  setAnnFormData({
                                    title: ann.title,
                                    content: ann.content,
                                    target_audience: ann.target_audience,
                                    priority: ann.priority,
                                    is_pinned: !!ann.is_pinned,
                                    expires_at: ann.expires_at || '',
                                  });
                                  setShowAnnModal(true);
                                }}
                                title="Modifier"
                                className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteAnnouncement(ann.id, ann.title)}
                                title="Supprimer"
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug mb-2.5">
                          {ann.title}
                        </h3>

                        {/* Content text */}
                        <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed font-normal p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                          {ann.content}
                        </div>
                      </div>

                      {/* Footer Info */}
                      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                          <Building2 className="w-3.5 h-3.5 text-amber-500" />
                          <span>{ann.author_name || 'Direction Générale'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(ann.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: WHATSAPP STAFF & TEACHERS HUB (مركز التواصل عبر الواتساب) */}
        {/* ========================================================================= */}
        {activeMainTab === 'WHATSAPP_HUB' && isAdminOrSupervisor && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Configuration Panel (7 Columns) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Step 1: Select Recipient */}
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <Users className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-black text-slate-900 dark:text-white">
                      {dir === 'rtl' ? '1. اختيار المستلم من الطاقم التربوي والإداري' : '1. Choix du Destinataire'}
                    </h2>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {teachersList.length} Professeurs enregistrés
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {dir === 'rtl' ? 'الأستاذ المستهدف' : 'Sélectionner un Enseignant'}
                    </label>
                    <select
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      {teachersList.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.teacher_code ? `[${t.teacher_code}] ` : ''}
                          {t.first_name} {t.last_name} ({t.specialization || 'Matière'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {dir === 'rtl' ? 'رقم الهاتف المسجل' : 'Numéro de Téléphone'}
                    </label>
                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white">
                      <Phone className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{currentSelectedTeacher?.phone || 'Non renseigné'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Choose Template & Language */}
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <Bookmark className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm font-black text-slate-900 dark:text-white">
                      {dir === 'rtl' ? '2. نموذج وقالب الرسالة' : '2. Modèle & Thème du Message'}
                    </h2>
                  </div>

                  {/* Language Switcher */}
                  <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black">
                    <button
                      onClick={() => setTemplateLanguage('ar')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        templateLanguage === 'ar' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      العربية
                    </button>
                    <button
                      onClick={() => setTemplateLanguage('fr')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        templateLanguage === 'fr' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Français
                    </button>
                  </div>
                </div>

                {/* Templates Selection Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {WHATSAPP_TEMPLATES.map((tmpl) => {
                    const TIcon = tmpl.icon;
                    const isSelected = selectedTemplateId === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(tmpl.id)}
                        className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20'
                            : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                          <TIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className={`text-xs font-black ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-200'}`}>
                            {dir === 'rtl' ? tmpl.nameAr : tmpl.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium line-clamp-1 mt-0.5">
                            {dir === 'rtl' ? tmpl.name : tmpl.nameAr}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Parameters inputs for template */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-3 pt-3">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {dir === 'rtl' ? 'تخصيص متغيرات الرسالة (Variables) :' : 'Paramètres Dynamiques du Message :'}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        {dir === 'rtl' ? 'التاريخ المحدد' : 'Date'}
                      </label>
                      <input
                        type="date"
                        value={waParams.date}
                        onChange={(e) => setWaParams({ ...waParams, date: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        {dir === 'rtl' ? 'التوقيت' : 'Heure'}
                      </label>
                      <input
                        type="time"
                        value={waParams.time}
                        onChange={(e) => setWaParams({ ...waParams, time: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      {dir === 'rtl' ? 'الموضوع / جدول الأعمال' : 'Objet / Sujet de la réunion'}
                    </label>
                    <input
                      type="text"
                      value={waParams.subject}
                      onChange={(e) => setWaParams({ ...waParams, subject: e.target.value })}
                      placeholder="Ex: التنسيق البيداغوجي وتوزيع الفروض"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      {dir === 'rtl' ? 'ملاحظة إضافية أو نص الرسالة' : 'Remarque ou Détails'}
                    </label>
                    <textarea
                      rows={2}
                      value={waParams.note}
                      onChange={(e) => setWaParams({ ...waParams, note: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Live WhatsApp Simulator & Send Button (5 Columns) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="sticky top-6 p-5 rounded-3xl bg-slate-900 text-white shadow-xl border border-slate-800 space-y-4">
                {/* WhatsApp Window Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white font-black flex items-center justify-center shadow-md">
                      {currentSelectedTeacher?.first_name?.[0] || 'E'}
                    </div>
                    <div>
                      <div className="text-xs font-black text-white">
                        {currentSelectedTeacher
                          ? `${currentSelectedTeacher.first_name} ${currentSelectedTeacher.last_name}`
                          : 'Enseignant Destinataire'}
                      </div>
                      <div className="text-[10px] text-emerald-400 font-semibold">
                        {currentSelectedTeacher?.phone || 'Numéro WhatsApp'}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                    WhatsApp Web 📲
                  </span>
                </div>

                {/* Simulated WhatsApp Bubble */}
                <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-50 text-xs leading-relaxed whitespace-pre-line font-sans shadow-inner max-h-[380px] overflow-y-auto">
                  {generatedWhatsAppText}
                  <div className="text-[9px] text-emerald-400/70 text-right mt-2 font-mono">
                    {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ✓✓
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => handleOpenWhatsApp()}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>{dir === 'rtl' ? 'إرسال مباشر عبر تطبيق WhatsApp' : 'Envoyer via WhatsApp Web / App'}</span>
                  </button>

                  <button
                    onClick={handleCopyMessage}
                    className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? (dir === 'rtl' ? 'تم نسخ الرسالة !' : 'Message copié !') : (dir === 'rtl' ? 'نسخ نص الرسالة' : 'Copier le texte')}</span>
                  </button>
                </div>
              </div>

              {/* Quick Teachers Directory Table */}
              <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="text-xs font-black text-slate-900 dark:text-white flex items-center justify-between">
                  <span>{dir === 'rtl' ? 'دليل هواتف الأساتذة السريع' : 'Répertoire Rapide des Enseignants'}</span>
                  <span className="text-[10px] text-slate-400">{teachersList.length} profs</span>
                </div>

                <div className="max-h-[220px] overflow-y-auto space-y-1.5 scrollbar-thin">
                  {teachersList.map((tch) => (
                    <div
                      key={tch.id}
                      className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {tch.teacher_code ? `[${tch.teacher_code}] ` : ''}
                          {tch.first_name} {tch.last_name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {tch.specialization || 'Enseignant'} &bull; {tch.phone || 'Pas de numéro'}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedTeacherId(tch.id);
                          handleOpenWhatsApp(tch.phone);
                        }}
                        title={`Envoyer WhatsApp à ${tch.first_name}`}
                        className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors shrink-0 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Create / Edit Announcement */}
        {showAnnModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingAnnId ? 'Modifier l\'Annonce' : 'Publier une Nouvelle Annonce'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowAnnModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAnnouncement} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {dir === 'rtl' ? 'عنوان الإعلان أو المذكرة *' : 'Titre de l\'Annonce / Note de Service *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={annFormData.title}
                    onChange={(e) => setAnnFormData({ ...annFormData, title: e.target.value })}
                    placeholder="Ex: انعقاد المجلس البيداغوجي / تنظيم فترات المراقبة المستمرة..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {dir === 'rtl' ? 'الفئة المستهدفة *' : 'Public Destinataire *'}
                    </label>
                    <select
                      value={annFormData.target_audience}
                      onChange={(e) => setAnnFormData({ ...annFormData, target_audience: e.target.value as AnnouncementAudience })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    >
                      <option value="TEACHERS">👨‍🏫 فقرة الأساتذة (Enseignants)</option>
                      <option value="ADMIN">🏢 فقرة الإدارة (Administration)</option>
                      <option value="SUPERVISORS">🛡️ فقرة المشرفين والحراسة (Surveillants)</option>
                      <option value="TRANSPORT">🚐 النقل المدرسي (Transport)</option>
                      <option value="MAINTENANCE">🧹 النظافة والصيانة (Entretien)</option>
                      <option value="ALL">📢 إعلان عام للجميع (Tout le Personnel)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {dir === 'rtl' ? 'درجة الأولوية والأهمية' : 'Niveau de Priorité'}
                    </label>
                    <select
                      value={annFormData.priority}
                      onChange={(e) => setAnnFormData({ ...annFormData, priority: e.target.value as AnnouncementPriority })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    >
                      <option value="IMPORTANT">⚠️ هام جداً (Important)</option>
                      <option value="URGENT">🚨 عاجل وهام (Urgent)</option>
                      <option value="INFO">ℹ️ إخباري وتوجيهي (Info)</option>
                      <option value="EVENT">🎉 نشاط أو فعالية (Événement)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {dir === 'rtl' ? 'نص ومحتوى الإعلان بالتفصيل *' : 'Texte & Contenu de l\'Annonce *'}
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={annFormData.content}
                    onChange={(e) => setAnnFormData({ ...annFormData, content: e.target.value })}
                    placeholder="اكتب تفاصيل المذكرة أو البلاغ هنا..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_pinned_cb"
                    checked={annFormData.is_pinned}
                    onChange={(e) => setAnnFormData({ ...annFormData, is_pinned: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                  />
                  <label htmlFor="is_pinned_cb" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    📌 {dir === 'rtl' ? 'تثبيت هذا الإعلان في أعلى اللوحة' : 'Épingler cette annonce en tête du panneau'}
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowAnnModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/25 hover:from-amber-600 hover:to-orange-700 transition-all cursor-pointer"
                  >
                    {editingAnnId ? 'Mettre à jour' : 'Publier l\'Annonce'}
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
