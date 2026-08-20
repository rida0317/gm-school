'use client';

import React from 'react';
import { useI18n, Locale } from '@/lib/i18n';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium">
      <Globe className="w-3.5 h-3.5 text-slate-500 mx-1" />
      <button
        type="button"
        onClick={() => setLocale('fr')}
        className={`px-2 py-1 rounded transition-colors ${
          locale === 'fr'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:text-blue-600'
        }`}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => setLocale('ar')}
        className={`px-2 py-1 rounded transition-colors ${
          locale === 'ar'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:text-blue-600'
        }`}
      >
        العربية
      </button>
    </div>
  );
}
