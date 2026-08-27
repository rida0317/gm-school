'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { Supplier } from '@/types/database';
import { useConfirm, useNotify } from '@/lib/modal-service';
import { logAuditEvent } from '@/lib/audit';
import {
  Truck,
  Plus,
  Phone,
  PhoneCall,
  MessageCircle,
  Mail,
  MapPin,
  FileText,
  Trash2,
  Edit2,
  X,
  Building2,
  CheckCircle2
} from 'lucide-react';

function formatPhoneForWhatsApp(phone: string) {
  let p = phone.replace(/[\s\-\(\)\.]/g, '');
  if (p.startsWith('0') && p.length === 10) {
    p = '212' + p.substring(1);
  } else if (p.startsWith('+')) {
    p = p.substring(1);
  }
  return p;
}

export default function SuppliersPage() {
  const { t, dir } = useI18n();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    address: '',
    tax_id: '',
  });

  const confirm = useConfirm();
  const notify = useNotify();

  async function loadSuppliers() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('suppliers').select('*').order('name');
      if (data) setSuppliers(data);
      if (error) console.error(error);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      company: '',
      phone: '',
      email: '',
      address: '',
      tax_id: '',
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name || '',
      company: supplier.company || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      tax_id: supplier.tax_id || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const supabase = createClient();

      if (editingSupplier) {
        // UPDATE
        const { error } = await supabase
          .from('suppliers')
          .update({
            name: formData.name.trim(),
            company: formData.company.trim() || null,
            phone: formData.phone.trim() || null,
            email: formData.email.trim() || null,
            address: formData.address.trim() || null,
            tax_id: formData.tax_id.trim() || null,
          })
          .eq('id', editingSupplier.id);

        if (error) throw error;

        logAuditEvent({
          action: 'SUPPLIER_UPDATED',
          entity_type: 'suppliers',
          entity_id: editingSupplier.id,
          details: {
            name: formData.name,
            company: formData.company,
            phone: formData.phone,
          },
        });

        notify({
          title: 'Fournisseur Mis à Jour',
          message: `Les coordonnées de "${formData.name}" ont été modifiées avec succès.`,
          type: 'success',
        });
      } else {
        // INSERT
        const { error } = await supabase.from('suppliers').insert([
          {
            name: formData.name.trim(),
            company: formData.company.trim() || null,
            phone: formData.phone.trim() || null,
            email: formData.email.trim() || null,
            address: formData.address.trim() || null,
            tax_id: formData.tax_id.trim() || null,
            status: 'ACTIVE',
          },
        ]);

        if (error) throw error;

        logAuditEvent({
          action: 'SUPPLIER_CREATED',
          entity_type: 'suppliers',
          details: {
            name: formData.name,
            company: formData.company,
            phone: formData.phone,
          },
        });

        notify({
          title: 'Nouveau Fournisseur Enregistré',
          message: `Le fournisseur "${formData.name}" a été ajouté.`,
          type: 'success',
        });
      }
      setShowModal(false);
      loadSuppliers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const handleToggleStatus = async (supplier: Supplier) => {
    const currentStatus = supplier.status || 'ACTIVE';
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('suppliers')
        .update({ status: nextStatus })
        .eq('id', supplier.id);

      if (error) throw error;

      setSuppliers((prev) =>
        prev.map((s) => (s.id === supplier.id ? { ...s, status: nextStatus } : s))
      );

      logAuditEvent({
        action: 'SUPPLIER_STATUS_TOGGLED',
        entity_type: 'suppliers',
        entity_id: supplier.id,
        details: {
          supplier: supplier.name,
          new_status: nextStatus,
        },
      });

      notify({
        title: nextStatus === 'ACTIVE' ? 'Fournisseur Activé' : 'Fournisseur Désactivé',
        message: `Le fournisseur "${supplier.name}" est désormais ${nextStatus === 'ACTIVE' ? 'Actif (🟢)' : 'Désactivé (🔴)'}.`,
        type: nextStatus === 'ACTIVE' ? 'success' : 'warning',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du changement de statut';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const handleDelete = async (id: string, name?: string) => {
    const ok = await confirm({
      title: 'Supprimer le fournisseur',
      message: name
        ? `Êtes-vous sûr de vouloir supprimer le fournisseur "${name}" ?`
        : 'Supprimer ce fournisseur ?',
      type: 'danger',
      confirmText: 'Supprimer définitivement',
      cancelText: 'Annuler',
    });
    if (!ok) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;

      logAuditEvent({
        action: 'SUPPLIER_DELETED',
        entity_type: 'suppliers',
        entity_id: id,
        details: { name: name || id },
      });

      notify({ title: 'Supprimé', message: 'Fournisseur supprimé avec succès.', type: 'success' });
      loadSuppliers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de suppression';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <Truck className="w-4 h-4" />
              {t('suppliers')}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('suppliers_page_title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {dir === 'rtl' ? 'تدبير الموردين، الشركاء، العناوين ومعرفات الشركات.' : "Coordonnées, raisons sociales, identifiants fiscaux et gestion des partenaires de l'école."}
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('add_supplier')}</span>
          </button>
        </div>

        {/* Suppliers Grid */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-semibold bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            {t('loading')}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-semibold bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            {t('no_data')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {suppliers.map((s) => (
              <div
                key={s.id}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                      <Truck className="w-6 h-6" />
                    </div>
                    {/* Status Toggle Button (Actif 🟢 / Désactivé 🔴) */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(s)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shadow-xs ${
                        (s.status || 'ACTIVE') === 'ACTIVE'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/80 border border-emerald-300/40'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/80 border border-rose-300/40'
                      }`}
                      title={(s.status || 'ACTIVE') === 'ACTIVE' ? 'Cliquer pour désactiver ce fournisseur' : 'Cliquer pour réactiver ce fournisseur'}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          (s.status || 'ACTIVE') === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                        }`}
                      />
                      <span>
                        {(s.status || 'ACTIVE') === 'ACTIVE'
                          ? dir === 'rtl' ? 'نشط' : 'Actif'
                          : dir === 'rtl' ? 'غير نشط' : 'Désactivé'}
                      </span>
                    </button>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white truncate" title={s.name}>
                    {s.name}
                  </h3>
                  <div className="text-xs text-slate-500 font-medium truncate" title={s.company || (dir === 'rtl' ? 'شركة / مقاولة' : 'Entreprise')}>
                    {s.company || (dir === 'rtl' ? 'شركة / مقاولة' : 'Entreprise')}
                  </div>

                  <div className="mt-4 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                    {/* Phone & Direct Contact Bar */}
                    {s.phone ? (
                      <div className="flex items-center justify-between p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Phone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="truncate font-black text-slate-800 dark:text-slate-200 text-xs tracking-tight">
                            {s.phone}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* WhatsApp Button */}
                          <a
                            href={`https://wa.me/${formatPhoneForWhatsApp(s.phone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-[11px] shadow-xs shadow-emerald-500/25 transition-all hover:scale-105"
                            title={dir === 'rtl' ? 'مراسلة عبر واتساب 📲' : 'Discuter sur WhatsApp 📲'}
                          >
                            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>WhatsApp</span>
                          </a>

                          {/* Direct Call Button */}
                          <a
                            href={`tel:${s.phone.replace(/[\s\-\(\)]/g, '')}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-[11px] shadow-xs shadow-blue-600/25 transition-all hover:scale-105"
                            title={dir === 'rtl' ? 'اتصال هاتفي مباشر 📞' : 'Appeler directement 📞'}
                          >
                            <PhoneCall className="w-3.5 h-3.5 shrink-0" />
                            <span>{dir === 'rtl' ? 'اتصال' : 'Appel'}</span>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                        <span className="italic text-[11px]">{dir === 'rtl' ? 'لا يوجد رقم هاتف' : 'Aucun numéro renseigné'}</span>
                      </div>
                    )}

                    {s.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{s.email}</span>
                      </div>
                    )}
                    {s.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{s.address}</span>
                      </div>
                    )}
                    {s.tax_id && (
                      <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span>{dir === 'rtl' ? 'رقم التعريف الموحد ICE :' : 'ICE :'} {s.tax_id}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                  {/* Quick communication mini badge if phone exists */}
                  <div className="text-[11px] text-slate-400 font-medium">
                    {s.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        {dir === 'rtl' ? 'متاح للطلبيات' : 'Opérationnel'}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">
                        {dir === 'rtl' ? 'موقف مؤقتاً' : 'Suspendu'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Modifier Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(s)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/60 font-bold text-xs transition-colors cursor-pointer"
                      title={dir === 'rtl' ? 'تعديل بيانات المورد' : 'Modifier les coordonnées du fournisseur'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>{t('edit')}</span>
                    </button>

                    {/* Supprimer Button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id, s.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title={dir === 'rtl' ? 'حذف المورد نهائياً' : 'Supprimer définitivement'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Create / Edit Supplier */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
            <div className="w-[95vw] max-w-lg md:max-w-xl bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 space-y-4 my-auto">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 min-w-0">
                  <div className="p-2.5 rounded-2xl bg-blue-500/15 shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                      {editingSupplier
                        ? dir === 'rtl' ? 'تعديل بيانات المورد' : 'Modifier le Fournisseur'
                        : dir === 'rtl' ? 'إضافة مورد جديد' : 'Nouveau Fournisseur'}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      {editingSupplier
                        ? dir === 'rtl' ? `تحديث معلومات ${editingSupplier.name}` : `Mise à jour des coordonnées de ${editingSupplier.name}`
                        : dir === 'rtl' ? 'تسجيل شريك ومورد جديد' : "Enregistrement d'un nouveau partenaire"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-3.5 w-full">
                <div className="w-full min-w-0">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    {dir === 'rtl' ? 'اسم المورد / جهة الاتصال *' : "Nom de l'Enseigne / Contact *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                    placeholder={dir === 'rtl' ? 'مثال: مكتبة الأطلس، شركة النظافة...' : 'Ex: CleanPro Hygiène, Librairie Atlas...'}
                  />
                </div>

                <div className="w-full min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    {dir === 'rtl' ? 'اسم الشركة / المقاولة' : 'Raison Sociale / Entreprise'}
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                    placeholder={dir === 'rtl' ? 'مثال: شركة أطلس للخدمات ش.م.م' : 'Ex: CleanPro Services SARL'}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      {t('phone')}
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                      placeholder="+212 524-..."
                    />
                  </div>
                  <div className="w-full min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      {t('email')}
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                      placeholder="contact@fournisseur.ma"
                    />
                  </div>
                </div>

                <div className="w-full min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    {t('address')}
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                    placeholder={dir === 'rtl' ? 'الحي، المدينة...' : 'Quartier, Ville...'}
                  />
                </div>

                <div className="w-full min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    {dir === 'rtl' ? 'رقم التعريف الموحد للمقاولة (ICE)' : "Numéro ICE (Identifiant Commun de l'Entreprise)"}
                  </label>
                  <input
                    type="text"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                    placeholder="001234567000089"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800 w-full">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md transition-all cursor-pointer shrink-0"
                  >
                    {editingSupplier
                      ? dir === 'rtl' ? 'حفظ التعديلات' : 'Enregistrer les Modifications'
                      : dir === 'rtl' ? 'حفظ المورد' : 'Enregistrer'}
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
