'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { Profile, UserRole } from '@/types/database';
import { useConfirm } from '@/lib/modal-service';
import { useAuth } from '@/lib/auth';
import { canManageUser } from '@/lib/permissions';
import {
  UserCheck,
  UserX,
  Search,
  Mail,
  Phone,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  RefreshCw,
  Filter,
  AlertTriangle,
  UserPlus,
  Lock
} from 'lucide-react';

export default function UsersManagementPage() {
  const { t, dir } = useI18n();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL'); // ALL, PENDING, ACTIVE, INACTIVE
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const confirm = useConfirm();
  const { profile: currentLoggedUser } = useAuth();
  const currentUserRole = currentLoggedUser?.role || 'SUPER_ADMIN';

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: unknown) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(user: Profile) {
    const { canEdit, reason } = canManageUser(currentUserRole, user.role);
    if (!canEdit) {
      setFeedback({ type: 'error', message: reason || 'Action non autorisée' });
      return;
    }

    setActionLoadingId(user.id);
    setFeedback(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // Log audit
      await supabase.from('audit_logs').insert({
        action: 'USER_APPROVED',
        entity_type: 'profiles',
        entity_id: user.id,
        details: { email: user.email, name: `${user.first_name} ${user.last_name}`, role: user.role },
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: true } : u))
      );

      setFeedback({
        type: 'success',
        message: `Compte de ${user.first_name} ${user.last_name} validé et activé avec succès !`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la validation';
      setFeedback({ type: 'error', message });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleToggleStatus(user: Profile, newStatus: boolean) {
    const { canEdit, reason } = canManageUser(currentUserRole, user.role);
    if (!canEdit) {
      setFeedback({ type: 'error', message: reason || 'Action non autorisée sur un Super Administrateur' });
      return;
    }

    setActionLoadingId(user.id);
    setFeedback(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // Log audit
      await supabase.from('audit_logs').insert({
        action: newStatus ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entity_type: 'profiles',
        entity_id: user.id,
        details: { email: user.email, is_active: newStatus },
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: newStatus } : u))
      );

      setFeedback({
        type: 'success',
        message: `Statut de ${user.first_name} mis à jour (${newStatus ? 'Actif' : 'Désactivé'}).`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de mise à jour';
      setFeedback({ type: 'error', message });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleChangeRole(user: Profile, newRole: UserRole) {
    const { canEdit, reason } = canManageUser(currentUserRole, user.role);
    if (!canEdit) {
      setFeedback({ type: 'error', message: reason || 'Action non autorisée sur un Super Administrateur' });
      return;
    }

    setActionLoadingId(user.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
      );

      setFeedback({
        type: 'success',
        message: `Rôle mis à jour pour ${user.first_name} (${newRole}).`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de mise à jour du rôle';
      setFeedback({ type: 'error', message });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDelete(user: Profile) {
    const { canDelete, reason } = canManageUser(currentUserRole, user.role);
    if (!canDelete) {
      setFeedback({ type: 'error', message: reason || 'Un Directeur ne peut pas supprimer un compte Super Administrateur !' });
      return;
    }

    const ok = await confirm({
      title: 'Supprimer l\'utilisateur',
      message: `Êtes-vous sûr de vouloir supprimer définitivement le compte de ${user.first_name} ${user.last_name} ? Cette action supprimera tous ses accès.`,
      type: 'danger',
      confirmText: 'Supprimer le compte',
      cancelText: 'Annuler',
    });
    if (!ok) return;

    setActionLoadingId(user.id);
    try {
      const supabase = createClient();
      
      // Attempt clean delete through security definer RPC
      const { error: rpcError } = await supabase.rpc('delete_user_account', { target_user_id: user.id });
      
      if (rpcError) {
        // Fallback to direct table deletion
        const { error } = await supabase.from('profiles').delete().eq('id', user.id);
        if (error) throw error;
      }

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setFeedback({
        type: 'success',
        message: `Compte de ${user.first_name} ${user.last_name} supprimé avec succès.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de suppression';
      setFeedback({ type: 'error', message });
    } finally {
      setActionLoadingId(null);
    }
  }

  // Filtered lists
  const pendingUsers = users.filter((u) => !u.is_active);
  const activeUsers = users.filter((u) => u.is_active);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      `${u.first_name} ${u.last_name} ${u.email} ${u.phone || ''}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesRole = filterRole === 'ALL' || u.role === filterRole;

    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'PENDING' && !u.is_active) ||
      (filterStatus === 'ACTIVE' && u.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const roleLabels: Record<UserRole, { label: string; color: string }> = {
    SUPER_ADMIN: { label: 'Super Admin', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300' },
    ADMIN: { label: 'Directeur', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300' },
    TEACHER: { label: 'Enseignant', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300' },
    SUPERVISOR: { label: 'Surveillant Général', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300' },
    STOCK_MANAGER: { label: 'Gestionnaire Stock', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300' },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {t('users_roles')}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {dir === 'rtl' ? 'تفعيل الحسابات الجديدة وضبط الصلاحيات وأدوار المستخدمين.' : "Validation des nouvelles inscriptions et gestion des droits d'accès"}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{dir === 'rtl' ? 'تحديث' : 'Actualiser'}</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between text-sm animate-in fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs font-semibold underline hover:opacity-80"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => setFilterStatus('ALL')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              filterStatus === 'ALL'
                ? 'bg-white dark:bg-slate-800 border-sky-500 shadow-md ring-2 ring-sky-500/20'
                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {dir === 'rtl' ? 'مجموع الحسابات' : 'Total Comptes'}
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
              {users.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{dir === 'rtl' ? 'جميع الرتب والمستخدمين' : 'Tous rôles confondus'}</p>
          </div>

          <div
            onClick={() => setFilterStatus('PENDING')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              filterStatus === 'PENDING'
                ? 'bg-amber-500/10 border-amber-500 shadow-md ring-2 ring-amber-500/20'
                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                {dir === 'rtl' ? 'في انتظار التفعيل' : "En Attente d'Approbation"}
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
              {pendingUsers.length}
            </div>
            <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1">
              {dir === 'rtl' ? 'تسجيلات جديدة تتطلب التفعيل' : 'Nouvelles inscriptions à valider'}
            </p>
          </div>

          <div
            onClick={() => setFilterStatus('ACTIVE')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              filterStatus === 'ACTIVE'
                ? 'bg-emerald-500/10 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                {dir === 'rtl' ? 'الحسابات النشطة' : 'Comptes Actifs'}
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {activeUsers.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{dir === 'rtl' ? 'حسابات مفعلة ومرخص لها' : 'Accès autorisé à la plateforme'}</p>
          </div>
        </div>

        {/* Section: Pending Approvals Urgent Alert Box (if any pending) */}
        {pendingUsers.length > 0 && filterStatus !== 'ACTIVE' && (
          <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-400/40 dark:border-amber-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {dir === 'rtl' ? `طلبات تسجيل تتطلب تفعيلك (${pendingUsers.length})` : `Demandes d'inscription nécessitant votre validation (${pendingUsers.length})`}
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
              {dir === 'rtl' ? 'قام هؤلاء الموظفون بإنشاء حساباتهم، ولا يمكنهم الدخول حتى تقوم بتفعيل حساباتهم أدناه.' : "Ces collaborateurs se sont inscrits et ne peuvent pas se connecter tant que vous n'avez pas approuvé leur compte ci-dessous."}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingUsers.map((pUser) => (
                <div
                  key={pUser.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 shadow-sm flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {pUser.first_name} {pUser.last_name}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${roleLabels[pUser.role]?.color}`}>
                          {roleLabels[pUser.role]?.label || pUser.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <Mail className="w-3.5 h-3.5" />
                        <span>{pUser.email}</span>
                      </div>
                      {pUser.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <Phone className="w-3.5 h-3.5" />
                          <span>{pUser.phone}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-semibold border border-amber-300/50">
                      {dir === 'rtl' ? 'في الانتظار' : 'En Attente'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => handleApprove(pUser)}
                      disabled={actionLoadingId === pUser.id}
                      className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{dir === 'rtl' ? 'تفعيل الحساب' : 'Approuver & Activer'}</span>
                    </button>
                    <button
                      onClick={() => handleDelete(pUser)}
                      disabled={actionLoadingId === pUser.id}
                      className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer"
                      title={dir === 'rtl' ? 'رفض وحذف الطلب' : 'Rejeter / Supprimer la demande'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className={`w-4 h-4 text-slate-400 absolute ${dir === 'rtl' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={dir === 'rtl' ? 'بحث بالاسم، البريد...' : 'Rechercher par nom, email...'}
              className={`w-full ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500`}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>{dir === 'rtl' ? 'الرتبة :' : 'Rôle:'}</span>
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              <option value="ALL">{dir === 'rtl' ? 'جميع الرتب' : 'Tous les rôles'}</option>
              <option value="SUPER_ADMIN">{dir === 'rtl' ? 'المسؤول العام (Super Admin)' : 'Super Admin'}</option>
              <option value="ADMIN">{dir === 'rtl' ? 'المدير (Directeur)' : 'Directeur'}</option>
              <option value="TEACHER">{dir === 'rtl' ? 'أستاذ (Enseignant)' : 'Enseignant'}</option>
              <option value="SUPERVISOR">{dir === 'rtl' ? 'حارس عام (Surveillant Général)' : 'Surveillant Général'}</option>
              <option value="STOCK_MANAGER">{dir === 'rtl' ? 'مسؤول المخزن (Gestionnaire Stock)' : 'Gestionnaire Stock'}</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4">{dir === 'rtl' ? 'المستخدم' : 'Utilisateur'}</th>
                  <th className="px-6 py-4">{dir === 'rtl' ? 'معلومات الاتصال' : 'Contact'}</th>
                  <th className="px-6 py-4">{dir === 'rtl' ? 'الرتبة والصلاحيات' : 'Rôle & Permissions'}</th>
                  <th className="px-6 py-4">{dir === 'rtl' ? 'الحالة' : 'Statut'}</th>
                  <th className="px-6 py-4 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
                        <span>{t('loading')}</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-400">
                      {t('no_data')}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isPending = !u.is_active;

                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          isPending ? 'bg-amber-500/5' : ''
                        }`}
                      >
                        {/* Name & Avatar */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow-sm ${
                                isPending
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 ring-2 ring-amber-400'
                                  : 'bg-gradient-to-br from-sky-500 to-blue-600 text-white'
                              }`}
                            >
                              {u.first_name?.[0] || 'U'}
                              {u.last_name?.[0] || ''}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {u.first_name} {u.last_name}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {dir === 'rtl' ? 'تاريخ التسجيل :' : 'Inscrit le'} {new Date(u.created_at || Date.now()).toLocaleDateString(dir === 'rtl' ? 'ar-MA' : 'fr-FR')}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-slate-700 dark:text-slate-300">{u.email}</div>
                          <div className="text-[11px] text-slate-400">{u.phone || (dir === 'rtl' ? 'غير محدد' : 'Non renseigné')}</div>
                        </td>

                        {/* Role selection */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {currentUserRole === 'ADMIN' && u.role === 'SUPER_ADMIN' ? (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 inline-flex items-center gap-1.5">
                              <Lock className="w-3 h-3 text-purple-600" />
                              {dir === 'rtl' ? 'مسؤول عام (محمي)' : 'Super Admin (Protégé)'}
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <select
                                value={u.role}
                                onChange={(e) => handleChangeRole(u, e.target.value as UserRole)}
                                disabled={actionLoadingId === u.id}
                                className="text-xs font-semibold py-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer focus:ring-1 focus:ring-sky-500"
                              >
                                {currentUserRole === 'SUPER_ADMIN' && (
                                  <option value="SUPER_ADMIN">{dir === 'rtl' ? 'المسؤول العام' : 'Super Admin'}</option>
                                )}
                                <option value="ADMIN">{dir === 'rtl' ? 'المدير' : 'Directeur'}</option>
                                <option value="TEACHER">{dir === 'rtl' ? 'أستاذ' : 'Enseignant'}</option>
                                <option value="SUPERVISOR">{dir === 'rtl' ? 'حارس عام' : 'Surveillant Général'}</option>
                                <option value="STOCK_MANAGER">{dir === 'rtl' ? 'مسؤول المخزن' : 'Gestionnaire Stock'}</option>
                              </select>
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300">
                              <Clock className="w-3 h-3" />
                              {dir === 'rtl' ? 'في الانتظار' : 'En attente'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              {dir === 'rtl' ? 'نشط' : 'Actif'}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {currentUserRole === 'ADMIN' && u.role === 'SUPER_ADMIN' ? (
                            <div className="flex items-center justify-end">
                              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                                <Lock className="w-3 h-3 text-purple-500" />
                                <span>{dir === 'rtl' ? 'حساب محمي' : 'Compte Protégé'}</span>
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              {isPending ? (
                                <button
                                  onClick={() => handleApprove(u)}
                                  disabled={actionLoadingId === u.id}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Accepter</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleStatus(u, false)}
                                  disabled={actionLoadingId === u.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 text-slate-600 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                                  title="Désactiver ce compte"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Désactiver</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleDelete(u)}
                                disabled={actionLoadingId === u.id}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Supprimer définitivement"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
