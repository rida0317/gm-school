'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import {
  Settings,
  Building,
  Globe,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

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
  });

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
      });
    }
  }, [settings]);

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
      });

      if (!success) {
        throw new Error('Erreur lors de l\'enregistrement dans Supabase');
      }

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
