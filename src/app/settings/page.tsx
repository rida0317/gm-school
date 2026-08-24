'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { logAuditEvent } from '@/lib/audit';
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
  Coins
} from 'lucide-react';
import { DEFAULT_WHATSAPP_TEMPLATES } from '@/lib/whatsapp';

export default function SettingsPage() {
  const { locale, setLocale, t, dir } = useI18n();
  const { settings, updateSettings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <div className="space-y-6 max-w-4xl">
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
              {dir === 'rtl' ? 'تحديث البيانات الأساسية للمؤسسة، السنة الدراسية ولغة النظام.' : "Ces modifications s'appliquent en temps réel sur l'ensemble du site et dans la base Supabase."}
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

        <form onSubmit={handlePerformSave} className="space-y-6">
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
              {/* Logo Preview Box */}
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

              {/* Actions & Explanations */}
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
              Informations sur l&apos;Établissement
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nom de l&apos;École (Français)
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
                  Nom de l&apos;École (Arabe)
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
                  Année Scolaire Active
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
                  Semestre en Cours
                </label>
                <select
                  value={formState.current_term}
                  onChange={(e) => setFormState({ ...formState, current_term: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="Semestre 1">Semestre 1</option>
                  <option value="Semestre 2">Semestre 2</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email de Direction
                </label>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                  placeholder="contact@gm-school.ma"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Téléphone Contact
                </label>
                <input
                  type="tel"
                  value={formState.phone}
                  onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                  placeholder="+212 522-001122"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Adresse de l&apos;Établissement
                </label>
                <input
                  type="text"
                  value={formState.address}
                  onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                  placeholder="Casablanca, Maroc"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Regional & System Preferences */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Globe className="w-4 h-4 text-emerald-500" />
              Langue & Préférences Régionales
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Langue par Défaut
                </label>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as 'fr' | 'ar')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="fr">Français (LTR)</option>
                  <option value="ar">العربية (RTL)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Devise Monétaire
                </label>
                <input
                  type="text"
                  value={formState.currency}
                  onChange={(e) => setFormState({ ...formState, currency: e.target.value })}
                  placeholder="MAD (Dirham Marocain)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Grille Tarifaire par Cycle & Transport Scolaire Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {dir === 'rtl' ? 'التعريفة الشهرية حسب السلك والنقل المدرسي' : 'Grille Tarifaire par Cycle & Transport Scolaire'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {dir === 'rtl'
                      ? 'الواجب الشهري الأساسي لكل سلك دراسي وتعريفة النقل المدرسي القياسية (يمكن تخصيصها لكل تلميذ).'
                      : 'Tarifs mensuels standards par cycle et transport (personnalisables par élève).'}
                  </p>
                </div>
              </div>
            </div>

            {/* Cycle Tuition Rates Grid */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {dir === 'rtl' ? 'واجبات التمدرس الشهرية حسب السلك (MAD)' : 'Frais de Scolarité Mensuels par Cycle (MAD)'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Maternelle */}
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

                {/* 2. Primaire */}
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

                {/* 3. Collège */}
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

                {/* 4. Lycée */}
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
                      {dir === 'rtl'
                        ? 'المبلغ الافتراضي الذي يُطبق عند تفعيل خدمة النقل للتلميذ.'
                        : 'Montant appliqué par défaut lorsqu\'un élève est inscrit au transport scolaire.'}
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

          {/* WhatsApp Notification Templates */}
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
                  className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title={dir === 'rtl' ? 'استعادة النصوص الافتراضية' : 'Rétablir les modèles par défaut'}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Target Template Tabs (Absence / Late / Payment) */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              {[
                {
                  key: 'absence',
                  label: dir === 'rtl' ? '🔴 نموذج رسالة الغياب' : '🔴 Modèle Absence Élève',
                  desc: dir === 'rtl' ? 'يُرسل عند تسجيل غياب تلميذ' : 'Envoyé lors d\'une absence',
                },
                {
                  key: 'late',
                  label: dir === 'rtl' ? '🟡 نموذج رسالة التأخر' : '🟡 Modèle Retard Élève',
                  desc: dir === 'rtl' ? 'يُرسل عند تسجيل تأخر تلميذ' : 'Envoyé lors d\'un retard',
                },
                {
                  key: 'payment',
                  label: dir === 'rtl' ? '💳 نموذج تذكير الواجب الشهري' : '💳 Modèle Rappel Frais Scolarité',
                  desc: dir === 'rtl' ? 'يُرسل لتذكير أولياء الأمور بالأداء' : 'Envoyé pour le rappel des frais',
                },
              ].map((target) => {
                const isActive = activeTarget === target.key;
                return (
                  <button
                    key={target.key}
                    type="button"
                    onClick={() => setActiveTarget(target.key as any)}
                    className={`flex-1 min-w-[200px] py-2.5 px-4 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex flex-col items-center sm:items-start gap-0.5 ${
                      isActive
                        ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-md shadow-emerald-500/10 border border-emerald-500/30'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className="text-xs">{target.label}</span>
                    <span className="text-[10px] font-normal text-slate-400 hidden sm:inline">{target.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Tags Interactive Insertion Hub for active target */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-xs space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>
                    {dir === 'rtl'
                      ? 'انقر على أي زر لإضافته مباشرة في النموذج المختار أعلاه :'
                      : 'Cliquez sur un bouton pour l\'insérer dans le modèle sélectionné ci-dessus :'}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {dir === 'rtl' ? 'النموذج النشط حالياً :' : 'Modèle actif :'} <span className="font-bold underline">{activeTarget === 'absence' ? 'الغياب' : activeTarget === 'late' ? 'التأخر' : 'الواجب الشهري'}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {/* School Logo / Header button */}
                <button
                  type="button"
                  onClick={() => insertSchoolHeader(activeTarget)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-xs hover:from-emerald-700 hover:to-teal-700 transition-all cursor-pointer transform active:scale-95"
                >
                  <span>+</span>
                  <span>{dir === 'rtl' ? '🏫 اسم وشعار المؤسسة في الأعلى' : '🏫 En-tête / Logo École'}</span>
                </button>

                {[
                  { tag: '{student_name}', label: dir === 'rtl' ? 'اسم التلميذ' : 'Nom de l\'élève' },
                  { tag: '{class_name}', label: dir === 'rtl' ? 'القسم' : 'Classe' },
                  ...(activeTarget === 'payment'
                    ? [
                        { tag: '{month}', label: dir === 'rtl' ? 'الشهر' : 'Mois' },
                        { tag: '{amount}', label: dir === 'rtl' ? 'المبلغ' : 'Montant' },
                      ]
                    : []),
                  ...(activeTarget === 'late'
                    ? [{ tag: '{late_minutes}', label: dir === 'rtl' ? 'دقائق التأخر' : 'Minutes retard' }]
                    : []),
                  ...(activeTarget !== 'payment'
                    ? [{ tag: '{date}', label: dir === 'rtl' ? 'التاريخ' : 'Date' }]
                    : []),
                  { tag: '{school_name}', label: dir === 'rtl' ? 'اسم المؤسسة' : 'Nom école' },
                  { tag: '{guardian_name}', label: dir === 'rtl' ? 'اسم الولي' : 'Nom tuteur' },
                ].map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => insertTag(item.tag)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300 shadow-2xs hover:bg-emerald-100 dark:hover:bg-slate-700 transition-all cursor-pointer transform active:scale-95"
                  >
                    <span>+</span>
                    <code>{item.tag}</code>
                    <span className="text-[10px] text-slate-400 font-sans">({item.label})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Single Full-Width Template Editor based on activeTarget & whatsappTab */}
            <div className="space-y-2">
              {/* Header with Title and Header Toggle */}
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {whatsappTab === 'ar'
                    ? activeTarget === 'absence'
                      ? '🔴 نص رسالة غياب التلميذ (عربية)'
                      : activeTarget === 'late'
                      ? '🟡 نص رسالة تأخر التلميذ (عربية)'
                      : '💳 نص رسالة تذكير الواجب الشهري (عربية)'
                    : activeTarget === 'absence'
                    ? '🔴 Modèle du Message d\'Absence (Français)'
                    : activeTarget === 'late'
                    ? '🟡 Modèle du Message de Retard (Français)'
                    : '💳 Modèle de Rappel Frais de Scolarité (Français)'}
                </label>

                <button
                  type="button"
                  onClick={() => insertSchoolHeader(activeTarget)}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                    /^\*[^*]+\*[\r\n]+-+\s*[\r\n]*/.test(
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
                    )
                      ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300'
                      : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
                  }`}
                >
                  {/^\*[^*]+\*[\r\n]+-+\s*[\r\n]*/.test(
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
                  ) ? (
                    <>
                      <span>✕</span>
                      <span>{dir === 'rtl' ? 'حذف اسم وشعار المؤسسة من الرأس' : 'Retirer En-tête / Logo École'}</span>
                    </>
                  ) : (
                    <>
                      <span>+</span>
                      <span>{dir === 'rtl' ? 'إضافة اسم وشعار المؤسسة في الرأس' : 'Ajouter En-tête / Logo École'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Full Width Textarea */}
              <textarea
                rows={9}
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
                placeholder={
                  whatsappTab === 'ar'
                    ? 'اكتب نص النموذج هنا...'
                    : 'Rédigez le modèle de message ici...'
                }
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => handlePerformSave()}
              disabled={saving}
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-blue-600/30 transition-all transform active:scale-95 cursor-pointer disabled:opacity-70"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving ? 'Enregistrement en cours...' : 'Enregistrer les Paramètres'}</span>
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
