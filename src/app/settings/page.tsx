'use client';

import React, { useState, useEffect } from 'react';
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
  RotateCcw
} from 'lucide-react';
import { DEFAULT_WHATSAPP_TEMPLATES } from '@/lib/whatsapp';

export default function SettingsPage() {
  const { locale, setLocale, t, dir } = useI18n();
  const { settings, updateSettings } = useSettings();

  const [formState, setFormState] = useState({
    school_name: settings?.school_name || 'Groupe Scolaire Des Générations Montantes',
    school_name_ar: settings?.school_name_ar || 'مجموعة مدارس الأجيال الصاعدة',
    academic_year: settings?.academic_year || '2025-2026',
    current_term: settings?.current_term || 'Semestre 1',
    email: settings?.email || 'contact@gm-school.ma',
    phone: settings?.phone || '+212 522-001122',
    address: settings?.address || 'Casablanca, Maroc',
    currency: settings?.currency || 'MAD (Dirham Marocain)',
    whatsapp_absence_template_ar: settings?.whatsapp_absence_template_ar || DEFAULT_WHATSAPP_TEMPLATES.ar_absence,
    whatsapp_absence_template_fr: settings?.whatsapp_absence_template_fr || DEFAULT_WHATSAPP_TEMPLATES.fr_absence,
    whatsapp_late_template_ar: settings?.whatsapp_late_template_ar || DEFAULT_WHATSAPP_TEMPLATES.ar_late,
    whatsapp_late_template_fr: settings?.whatsapp_late_template_fr || DEFAULT_WHATSAPP_TEMPLATES.fr_late,
  });

  const [whatsappTab, setWhatsappTab] = useState<'ar' | 'fr'>('ar');
  const [activeTarget, setActiveTarget] = useState<'absence' | 'late'>('absence');

  const insertTag = (tag: string) => {
    const fieldKey =
      whatsappTab === 'ar'
        ? activeTarget === 'absence'
          ? 'whatsapp_absence_template_ar'
          : 'whatsapp_late_template_ar'
        : activeTarget === 'absence'
        ? 'whatsapp_absence_template_fr'
        : 'whatsapp_late_template_fr';

    setFormState((prev) => {
      const current = prev[fieldKey] || '';
      return {
        ...prev,
        [fieldKey]: current ? `${current} ${tag}` : tag,
      };
    });
  };

  const insertSchoolHeader = (target: 'absence' | 'late') => {
    const schoolName =
      whatsappTab === 'ar'
        ? formState.school_name_ar || 'مجموعة مدارس الأجيال الصاعدة'
        : formState.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES';
    const header = `*${schoolName}*\n----------------------------------------\n`;

    const fieldKey =
      whatsappTab === 'ar'
        ? target === 'absence'
          ? 'whatsapp_absence_template_ar'
          : 'whatsapp_late_template_ar'
        : target === 'absence'
        ? 'whatsapp_absence_template_fr'
        : 'whatsapp_late_template_fr';

    setFormState((prev) => {
      const current = prev[fieldKey] || '';
      // Strip any existing top header if already present
      const cleaned = current.replace(/^(\*[^*]+\*[\r\n]+-+\s*[\r\n]*)/, '');
      return {
        ...prev,
        [fieldKey]: `${header}${cleaned}`,
      };
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
        whatsapp_absence_template_ar: settings.whatsapp_absence_template_ar || DEFAULT_WHATSAPP_TEMPLATES.ar_absence,
        whatsapp_absence_template_fr: settings.whatsapp_absence_template_fr || DEFAULT_WHATSAPP_TEMPLATES.fr_absence,
        whatsapp_late_template_ar: settings.whatsapp_late_template_ar || DEFAULT_WHATSAPP_TEMPLATES.ar_late,
        whatsapp_late_template_fr: settings.whatsapp_late_template_fr || DEFAULT_WHATSAPP_TEMPLATES.fr_late,
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
        whatsapp_absence_template_ar: formState.whatsapp_absence_template_ar.trim(),
        whatsapp_absence_template_fr: formState.whatsapp_absence_template_fr.trim(),
        whatsapp_late_template_ar: formState.whatsapp_late_template_ar.trim(),
        whatsapp_late_template_fr: formState.whatsapp_late_template_fr.trim(),
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

            {/* Dynamic Tags Interactive Insertion Hub */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                  <Sparkles className="w-4 h-4" />
                  <span>{dir === 'rtl' ? 'انقر على أي زر لإضافته مباشرة في نص الرسالة :' : 'Cliquez sur un bouton pour l\'insérer dans le modèle :'}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                  <span>{dir === 'rtl' ? 'الخانة المحددة :' : 'Cible :'}</span>
                  <button
                    type="button"
                    onClick={() => setActiveTarget(activeTarget === 'absence' ? 'late' : 'absence')}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-300 dark:border-emerald-800 cursor-pointer shadow-2xs"
                  >
                    {activeTarget === 'absence'
                      ? dir === 'rtl'
                        ? '🔴 رسالة الغياب'
                        : '🔴 Modèle Absence'
                      : dir === 'rtl'
                      ? '🟡 رسالة التأخر'
                      : '🟡 Modèle Retard'}
                  </button>
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
                  { tag: '{date}', label: dir === 'rtl' ? 'التاريخ' : 'Date' },
                  { tag: '{school_name}', label: dir === 'rtl' ? 'اسم المؤسسة' : 'Nom école' },
                  { tag: '{guardian_name}', label: dir === 'rtl' ? 'اسم الولي' : 'Nom tuteur' },
                  { tag: '{late_minutes}', label: dir === 'rtl' ? 'دقائق التأخر' : 'Minutes retard' },
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

            {/* Template Editors */}
            {whatsappTab === 'ar' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" dir="rtl">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      🔴 نموذج رسالة غياب التلميذ (عربية)
                    </label>
                    <button
                      type="button"
                      onClick={() => insertSchoolHeader('absence')}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                    >
                      + إضافة رأس/شعار المؤسسة
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={formState.whatsapp_absence_template_ar}
                    onFocus={() => setActiveTarget('absence')}
                    onChange={(e) => setFormState({ ...formState, whatsapp_absence_template_ar: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed font-sans"
                    placeholder="اكتب نموذج رسالة الغياب بالعربية..."
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      🟡 نموذج رسالة تأخر التلميذ (عربية)
                    </label>
                    <button
                      type="button"
                      onClick={() => insertSchoolHeader('late')}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                    >
                      + إضافة رأس/شعار المؤسسة
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={formState.whatsapp_late_template_ar}
                    onFocus={() => setActiveTarget('late')}
                    onChange={(e) => setFormState({ ...formState, whatsapp_late_template_ar: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed font-sans"
                    placeholder="اكتب نموذج رسالة التأخر بالعربية..."
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" dir="ltr">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      🔴 Modèle Absence Élève (Français)
                    </label>
                    <button
                      type="button"
                      onClick={() => insertSchoolHeader('absence')}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                    >
                      + Insérer En-tête École
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={formState.whatsapp_absence_template_fr}
                    onFocus={() => setActiveTarget('absence')}
                    onChange={(e) => setFormState({ ...formState, whatsapp_absence_template_fr: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed font-sans"
                    placeholder="Rédigez le modèle d'absence en français..."
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      🟡 Modèle Retard Élève (Français)
                    </label>
                    <button
                      type="button"
                      onClick={() => insertSchoolHeader('late')}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                    >
                      + Insérer En-tête École
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={formState.whatsapp_late_template_fr}
                    onFocus={() => setActiveTarget('late')}
                    onChange={(e) => setFormState({ ...formState, whatsapp_late_template_fr: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed font-sans"
                    placeholder="Rédigez le modèle de retard en français..."
                  />
                </div>
              </div>
            )}
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
