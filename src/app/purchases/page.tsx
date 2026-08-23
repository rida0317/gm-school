'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { PurchaseOrder, Supplier, POStatus } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useNotify } from '@/lib/modal-service';
import { logAuditEvent } from '@/lib/audit';
import {
  ShoppingCart,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  FileCheck,
  X
} from 'lucide-react';

export default function PurchasesPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    supplier_id: '',
    total_amount: 2500,
    notes: 'Commande fournitures scolaires & papeterie',
  });

  const notify = useNotify();

  async function loadData() {
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: ords }, { data: sups }] = await Promise.all([
        supabase.from('purchase_orders').select('*, supplier:suppliers(*)').order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*'),
      ]);

      if (ords) setOrders(ords);
      if (sups) {
        setSuppliers(sups);
        if (sups.length > 0 && !formData.supplier_id) {
          setFormData((prev) => ({ ...prev, supplier_id: sups[0].id }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const supabase = createClient();
      const orderNumber = `BC-${Date.now().toString().slice(-4)}`;
      const { error } = await supabase.from('purchase_orders').insert([
        {
          order_number: orderNumber,
          supplier_id: formData.supplier_id || (suppliers[0]?.id ?? null),
          order_date: new Date().toISOString().split('T')[0],
          status: 'PENDING',
          total_amount: Number(formData.total_amount),
          notes: formData.notes,
        },
      ]);
      if (error) {
        notify({ title: 'Erreur', message: error.message, type: 'danger' });
        return;
      }

      logAuditEvent({
        action: 'PURCHASE_ORDER_CREATED',
        entity_type: 'purchase_orders',
        details: {
          order_number: orderNumber,
          total_amount: formData.total_amount,
          supplier_id: formData.supplier_id,
        },
      });

      setShowModal(false);
      notify({ title: 'Succès', message: 'Bon de commande créé avec succès !', type: 'success' });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: POStatus) => {
    try {
      const supabase = createClient();
      await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', id);

      logAuditEvent({
        action: 'PURCHASE_ORDER_STATUS_UPDATED',
        entity_type: 'purchase_orders',
        entity_id: id,
        details: { new_status: newStatus },
      });

      notify({ title: 'Statut mis à jour', message: `Bon de commande passé à: ${newStatus}`, type: 'success' });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <ShoppingCart className="w-4 h-4" />
              Approvisionnements
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Bons de Commande & Achats
            </h1>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nouveau Bon de Commande
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">N° Commande</th>
                  <th className="px-6 py-4">Fournisseur</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Montant Total</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      Aucune commande d&apos;achat active.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {order.order_number}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                        {order.supplier?.name || 'Fournisseur non spécifié'}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">{formatDate(order.order_date)}</td>
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            order.status === 'RECEIVED'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : order.status === 'APPROVED'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {order.status !== 'RECEIVED' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'RECEIVED')}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            Réceptionner (+Stock)
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Add Purchase */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Nouveau Bon de Commande
                </h3>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrder} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fournisseur
                  </label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.company || 'Général'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Montant Estimé (MAD)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.total_amount}
                    onChange={(e) => setFormData({ ...formData, total_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Remarques / Contenu
                  </label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 rounded-xl"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl shadow-md hover:bg-blue-700"
                  >
                    Créer le Bon
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
