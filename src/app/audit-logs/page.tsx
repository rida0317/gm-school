'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import {
  History,
  ShieldCheck,
  Search,
  Filter,
  User,
  Activity,
  Lock
} from 'lucide-react';

export default function AuditLogsPage() {
  const { t, dir } = useI18n();
  const [logs, setLogs] = useState<Array<{
    id: string;
    user: string;
    role: string;
    action: string;
    entity: string;
    date: string;
    ip: string;
    status: string;
  }>>([
    {
      id: '1',
      user: 'Admin Principal',
      role: 'SUPER_ADMIN',
      action: 'GENERATION_TIMETABLE_AUTO',
      entity: 'Timetable 2025-2026',
      date: new Date().toISOString(),
      ip: '196.200.142.12',
      status: 'SUCCESS',
    },
    {
      id: '2',
      user: 'Responsable Stock',
      role: 'STOCK_MANAGER',
      action: 'STOCK_DISPATCH_CREATE',
      entity: 'Bon de Sortie #BS-2026-0042',
      date: new Date(Date.now() - 3600000).toISOString(),
      ip: '196.200.142.15',
      status: 'SUCCESS',
    },
    {
      id: '3',
      user: 'Directrice Pédagogique',
      role: 'ADMIN',
      action: 'SUBSTITUTION_VALIDATED',
      entity: 'Remplacement M. Alami (Maths)',
      date: new Date(Date.now() - 7200000).toISOString(),
      ip: '196.200.142.18',
      status: 'SUCCESS',
    },
  ]);

  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter(
    (l) =>
      l.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.entity.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>{t('audit_logs')}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('audit_logs')}
            </h1>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <Lock className="w-3.5 h-3.5" />
            <span>{dir === 'rtl' ? 'سجل غير قابل للتعديل' : 'Journal Immuable Actif'}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative">
            <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
            <input
              type="text"
              placeholder={t('search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full ${dir === 'rtl' ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">{dir === 'rtl' ? 'المستخدم والصلاحية' : 'Utilisateur & Rôle'}</th>
                  <th className="px-6 py-4">{dir === 'rtl' ? 'العملية' : 'Action'}</th>
                  <th className="px-6 py-4">{dir === 'rtl' ? 'البيان / التفاصيل' : 'Entité / Détails'}</th>
                  <th className="px-6 py-4">{dir === 'rtl' ? 'التاريخ والوقت' : 'Horodatage'}</th>
                  <th className="px-6 py-4">{dir === 'rtl' ? 'عنوان IP' : 'Adresse IP'}</th>
                  <th className="px-6 py-4 text-right rtl:text-left">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white">{log.user}</div>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {log.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-800 dark:text-slate-200">
                      {log.entity}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">
                      {formatDate(log.date)} {new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">
                      {log.ip}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
