'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface SchoolSettings {
  school_name: string;
  school_name_ar: string;
  academic_year: string;
  current_term: string;
  email: string;
  phone: string;
  address: string;
  currency: string;
  default_locale: 'fr' | 'ar';
  logo_url?: string;
  whatsapp_absence_template_ar?: string;
  whatsapp_absence_template_fr?: string;
  whatsapp_late_template_ar?: string;
  whatsapp_late_template_fr?: string;
  whatsapp_payment_template_ar?: string;
  whatsapp_payment_template_fr?: string;
  tuition_fee_maternelle?: number;
  tuition_fee_primaire?: number;
  tuition_fee_college?: number;
  tuition_fee_lycee?: number;
  default_transport_fee?: number;
}

export const defaultSettings: SchoolSettings = {
  school_name: 'Groupe Scolaire Des Générations Montantes',
  school_name_ar: 'مجموعة مدارس الأجيال الصاعدة',
  academic_year: '2025-2026',
  current_term: 'Semestre 1',
  email: 'contact@gm-school.ma',
  phone: '+212 522-001122',
  address: 'Casablanca, Maroc',
  currency: 'MAD (Dirham Marocain)',
  default_locale: 'fr',
  logo_url: '/logo.png',
  whatsapp_absence_template_ar: '',
  whatsapp_absence_template_fr: '',
  whatsapp_late_template_ar: '',
  whatsapp_late_template_fr: '',
  whatsapp_payment_template_ar: '',
  whatsapp_payment_template_fr: '',
  tuition_fee_maternelle: 1300,
  tuition_fee_primaire: 1500,
  tuition_fee_college: 1800,
  tuition_fee_lycee: 2200,
  default_transport_fee: 400,
};

interface SettingsContextType {
  settings: SchoolSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<SchoolSettings>) => Promise<boolean>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  loading: false,
  updateSettings: async () => true,
  refreshSettings: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SchoolSettings>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('gm_school_settings');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore
        }
      }
    }
    return defaultSettings;
  });
  const [loading, setLoading] = useState(false);

  const loadSettingsFromSupabase = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('school_settings')
        .select('*')
        .eq('id', 'current')
        .maybeSingle();

      if (data && !error) {
        const loaded: SchoolSettings = {
          school_name: data.school_name || defaultSettings.school_name,
          school_name_ar: data.school_name_ar || defaultSettings.school_name_ar,
          academic_year: data.academic_year || defaultSettings.academic_year,
          current_term: data.current_term || defaultSettings.current_term,
          email: data.email || defaultSettings.email,
          phone: data.phone || defaultSettings.phone,
          address: data.address || defaultSettings.address,
          currency: data.currency || defaultSettings.currency,
          default_locale: (data.default_locale as 'fr' | 'ar') || defaultSettings.default_locale,
          whatsapp_absence_template_ar: data.whatsapp_absence_template_ar || '',
          whatsapp_absence_template_fr: data.whatsapp_absence_template_fr || '',
          whatsapp_late_template_ar: data.whatsapp_late_template_ar || '',
          whatsapp_late_template_fr: data.whatsapp_late_template_fr || '',
        };
        setSettings(loaded);
        if (typeof window !== 'undefined') {
          localStorage.setItem('gm_school_settings', JSON.stringify(loaded));
        }
      }
    } catch (err) {
      console.warn('Error fetching school settings from Supabase:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettingsFromSupabase().catch(() => {});

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<SchoolSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      }
    };

    window.addEventListener('gm_settings_change', handleCustomChange);
    return () => {
      window.removeEventListener('gm_settings_change', handleCustomChange);
    };
  }, [loadSettingsFromSupabase]);

  const updateSettings = async (newSettings: Partial<SchoolSettings>): Promise<boolean> => {
    const merged: SchoolSettings = { ...settings, ...newSettings };
    
    // 1. Instant local update
    setSettings(merged);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gm_school_settings', JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('gm_settings_change', { detail: merged }));
    }

    // 2. Supabase DB update
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('school_settings')
        .upsert({
          id: 'current',
          school_name: merged.school_name,
          school_name_ar: merged.school_name_ar,
          academic_year: merged.academic_year,
          current_term: merged.current_term,
          email: merged.email,
          phone: merged.phone,
          address: merged.address,
          currency: merged.currency,
          default_locale: merged.default_locale,
          whatsapp_absence_template_ar: merged.whatsapp_absence_template_ar,
          whatsapp_absence_template_fr: merged.whatsapp_absence_template_fr,
          whatsapp_late_template_ar: merged.whatsapp_late_template_ar,
          whatsapp_late_template_fr: merged.whatsapp_late_template_fr,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Supabase settings update error:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error saving settings to Supabase:', err);
      return false;
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        refreshSettings: loadSettingsFromSupabase,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
