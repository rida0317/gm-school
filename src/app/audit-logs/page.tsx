'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import { useNotify } from '@/lib/modal-service';
import {
  History,
  ShieldCheck,
  Search,
  Filter,
  User,
  Activity,
  Lock,
  RefreshCw,
  Download,
  Calendar,
  Layers,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Clock,
  Database,
  Info
} from 'lucide-react';

interface AuditLogRecord {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  user?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    role: string | null;
  } | null;
}

export default function AuditLogsPage() {
  const { t, dir } = useI18n();
  const { profile } = useAuth();
  const notify = useNotify();

  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState('ALL');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<AuditLogRecord | null>(null);

  const fetchLogs = useCallback(async () => {
    if (profile && profile.role !== 'SUPER_ADMIN') {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          id,
          user_id,
          action,
          entity_type,
          entity_id,
          details,
          ip_address,
          created_at,
          user:profiles (
            id,
            first_name,
            last_name,
            email,
            role
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.warn('Error fetching audit logs:', error.message);
      } else if (data) {
        // Safe casting of joined user structure
        const mapped: AuditLogRecord[] = data.map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          action: item.action,
          entity_type: item.entity_type,
          entity_id: item.entity_id,
          details: item.details,
          ip_address: item.ip_address,
          created_at: item.created_at,
          user: Array.isArray(item.user) ? item.user[0] : item.user,
        }));
        setLogs(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile && profile.role !== 'SUPER_ADMIN') return;

    fetchLogs();

    // Subscribe to real-time additions in audit_logs
    const supabase = createClient();
    const channel = supabase
      .channel('realtime_audit_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs, profile]);

  // Unique entity types and actions for filters
  const entityTypes = Array.from(new Set(logs.map((l) => l.entity_type).filter(Boolean)));
  const actionTypes = Array.from(new Set(logs.map((l) => l.action).filter(Boolean)));

  const filteredLogs = logs.filter((l) => {
    const userName = l.user ? `${l.user.first_name || ''} ${l.user.last_name || ''} ${l.user.email || ''}` : 'Système';
    const matchesSearch =
      userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.entity_id && l.entity_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      JSON.stringify(l.details || {}).toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEntity = selectedEntityType === 'ALL' || l.entity_type === selectedEntityType;
    const matchesAction = selectedAction === 'ALL' || l.action === selectedAction;

    return matchesSearch && matchesEntity && matchesAction;
  });

  const handleExportCSV = () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const headers = [
        'ID Événement',
        'Date & Heure',
        'Utilisateur',
        'Rôle',
        'Email',
        'Action',
        'Entité',
        'ID Entité',
        'Détails JSON',
        'Adresse IP'
      ];

      const rows = filteredLogs.map((l) => {
        const userName = l.user ? `${l.user.first_name || ''} ${l.user.last_name || ''}`.trim() : 'Système';
        const userRole = l.user?.role || 'SYSTEM';
        const userEmail = l.user?.email || 'N/A';
        const detailsStr = JSON.stringify(l.details || {}).replace(/"/g, '""');

        return [
          `"${l.id}"`,
          `"${l.created_at}"`,
          `"${userName}"`,
          `"${userRole}"`,
          `"${userEmail}"`,
          `"${l.action}"`,
          `"${l.entity_type}"`,
          `"${l.entity_id || ''}"`,
          `"${detailsStr}"`,
          `"${l.ip_address || ''}"`
        ].join(';');
      });

      const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Journal_Audit_GM_${today}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notify({
        title: 'Export Réussi',
        message: 'Le journal d\'audit complet a été exporté en CSV.',
        type: 'success',
      });
    } catch (err) {
      console.error(err);
      notify({
        title: 'Erreur d\'Export',
        message: 'Impossible de générer le fichier CSV.',
        type: 'danger',
      });
    }
  };

  const getActionBadgeColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('CREATE') || act.includes('INSERT') || act.includes('ADD') || act.includes('APPROVED')) {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('MODIFY') || act.includes('MOVE') || act.includes('JUSTIF')) {
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    }
    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('CLEAR') || act.includes('CANCEL')) {
      return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
    }
    if (act.includes('GENERATE') || act.includes('PUBLISH')) {
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    }
    return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>{t('audit_logs')}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {dir === 'rtl' ? 'سجل التدقيق والأمان المباشر' : 'Journal d\'Audit & Traçabilité Supabase'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {dir === 'rtl'
                ? 'تسجيل دقيق وغير قابل للتعديل لجميع العمليات والتحركات في المنصة متزامن مع Supabase.'
                : 'Enregistrement sécurisé, immuable et en direct de toutes les modifications effectuées sur le système.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{dir === 'rtl' ? 'تصدير CSV' : 'Exporter CSV'}</span>
            </button>

            <button
              onClick={() => fetchLogs()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-bold text-xs hover:bg-sky-100 transition-all cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 text-sky-600 ${loading ? 'animate-spin' : ''}`} />
              <span>{dir === 'rtl' ? 'تحديث' : 'Actualiser'}</span>
            </button>

            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Database className="w-3.5 h-3.5" />
              <span>Supabase Sync Active</span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
            <input
              type="text"
              placeholder={dir === 'rtl' ? 'بحث بالمستخدم، العملية، الكيان، أو التفاصيل...' : 'Recherche par utilisateur, action, entité ou détails...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full ${dir === 'rtl' ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500`}
            />
          </div>

          {/* Entity Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Entité :
            </label>
            <select
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value)}
              className="w-full md:w-auto px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              <option value="ALL">Toutes les Entités</option>
              {entityTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Action :
            </label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full md:w-auto px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              <option value="ALL">Toutes les Actions</option>
              {actionTypes.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">{dir === 'rtl' ? 'المستخدم والصلاحية' : 'Utilisateur & Rôle'}</th>
                  <th className="px-5 py-3.5">{dir === 'rtl' ? 'العملية المنجزة' : 'Action Effectuée'}</th>
                  <th className="px-5 py-3.5">{dir === 'rtl' ? 'الكيان والمستهدف' : 'Entité / Cible'}</th>
                  <th className="px-5 py-3.5">{dir === 'rtl' ? 'التفاصيل والبيانات' : 'Aperçu Données'}</th>
                  <th className="px-5 py-3.5">{dir === 'rtl' ? 'التاريخ والوقت' : 'Horodatage'}</th>
                  <th className="px-5 py-3.5 text-right rtl:text-left">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-semibold">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
                        <span>Chargement du journal d&apos;audit depuis Supabase...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-semibold">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <ShieldCheck className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        <span>Aucun journal d&apos;audit ne correspond aux critères de recherche.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const userName = log.user
                      ? `${log.user.first_name || ''} ${log.user.last_name || ''}`.trim() || log.user.email || 'Utilisateur'
                      : 'Système / Automatique';
                    const userRole = log.user?.role || 'SYSTEM';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        {/* User & Role */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {userName[0]?.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white text-xs">
                                {userName}
                              </div>
                              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                                {userRole}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Action Badge */}
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold border ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>

                        {/* Entity */}
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                            {log.entity_type}
                          </div>
                          {log.entity_id && (
                            <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]" title={log.entity_id}>
                              ID: {log.entity_id}
                            </div>
                          )}
                        </td>

                        {/* Details Preview */}
                        <td className="px-5 py-3.5 max-w-xs truncate">
                          {log.details && Object.keys(log.details).length > 0 ? (
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate block">
                              {JSON.stringify(log.details)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">—</span>
                          )}
                        </td>

                        {/* Timestamp */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                            {formatDate(log.created_at)}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </td>

                        {/* Action details button */}
                        <td className="px-5 py-3.5 text-right rtl:text-left">
                          <button
                            onClick={() => setSelectedLogForDetails(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-sky-500" />
                            <span>Détails</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Full Event JSON Inspector */}
        {selectedLogForDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                  <div className="p-2 rounded-xl bg-sky-500/15">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Inspecteur d&apos;Événement d&apos;Audit
                    </h3>
                    <p className="text-xs text-slate-400">
                      ID: {selectedLogForDetails.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLogForDetails(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Event Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Action</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedLogForDetails.action}</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Entité</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedLogForDetails.entity_type} {selectedLogForDetails.entity_id ? `(${selectedLogForDetails.entity_id})` : ''}</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Auteur</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedLogForDetails.user
                      ? `${selectedLogForDetails.user.first_name || ''} ${selectedLogForDetails.user.last_name || ''}`.trim() || selectedLogForDetails.user.email
                      : 'Système'}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Horodatage</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {new Date(selectedLogForDetails.created_at).toLocaleString('fr-FR')}
                  </span>
                </div>
              </div>

              {/* JSON Payload Viewer */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-sky-500" />
                  <span>Payload &amp; Données Enregistrées (JSON)</span>
                </label>
                <pre className="p-4 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800 max-h-60 overflow-y-auto">
                  {JSON.stringify(selectedLogForDetails.details, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setSelectedLogForDetails(null)}
                  className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
