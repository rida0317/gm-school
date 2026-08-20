'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { Expense, Budget, ExpenseCategory } from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useNotify } from '@/lib/modal-service';
import {
  Wallet,
  Plus,
  TrendingDown,
  FileText,
  AlertTriangle,
  X
} from 'lucide-react';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    category: 'SUPPLIES' as ExpenseCategory,
    amount: 1500,
    date: new Date().toISOString().split('T')[0],
    description: '',
    invoice_number: '',
  });

  const notify = useNotify();

  async function loadData() {
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: exp }, { data: bud }] = await Promise.all([
        supabase.from('expenses').select('*, supplier:suppliers(*)').order('date', { ascending: false }),
        supabase.from('budgets').select('*'),
      ]);

      if (exp) setExpenses(exp);
      if (bud) setBudgets(bud);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const supabase = createClient();
      const { error } = await supabase.from('expenses').insert([
        {
          category: formData.category,
          amount: Number(formData.amount),
          date: formData.date,
          description: formData.description,
          invoice_number: formData.invoice_number || null,
        },
      ]);
      if (error) {
        notify({ title: 'Erreur', message: error.message, type: 'danger' });
        return;
      }
      setShowModal(false);
      setFormData({
        category: 'SUPPLIES',
        amount: 1500,
        date: new Date().toISOString().split('T')[0],
        description: '',
        invoice_number: '',
      });
      notify({ title: 'Succès', message: 'Dépense enregistrée avec succès !', type: 'success' });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      notify({ title: 'Erreur', message: msg, type: 'danger' });
    }
  };

  const totalSpent = budgets.reduce((acc, b) => acc + Number(b.spent_amount || 0), 0);
  const totalAllocated = budgets.reduce((acc, b) => acc + Number(b.allocated_amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              <Wallet className="w-4 h-4" />
              Finances & Budget
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Gestion des Dépenses & Budget
            </h1>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm shadow-md shadow-rose-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            Enregistrer une Dépense
          </button>
        </div>

        {/* Budget Allocation Progress Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {budgets.map((b) => {
            const pct = Math.min(Math.round((b.spent_amount / b.allocated_amount) * 100), 100);
            const isNearLimit = pct > 80;

            return (
              <div
                key={b.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {b.category}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                      isNearLimit
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    }`}
                  >
                    {pct}% Consommé
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(b.spent_amount)}
                  </span>
                  <span className="text-xs text-slate-400">
                    sur {formatCurrency(b.allocated_amount)}
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isNearLimit ? 'bg-rose-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="text-[11px] text-slate-500">{b.notes}</div>
              </div>
            );
          })}
        </div>

        {/* Expenses List Table */}
        <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Historique des Factures & Dépenses
            </h3>
            <span className="text-xs text-slate-500">Total : {expenses.length} opérations</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Catégorie</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">N° Facture</th>
                  <th className="px-6 py-4 text-right">Montant (MAD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      Chargement des dépenses...
                    </td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      Aucune dépense enregistrée récemment.
                    </td>
                  </tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">
                        {formatDate(e.date)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {e.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {e.description}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400">
                        {e.invoice_number || '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                        {formatCurrency(e.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Expense */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Nouvelle Dépense
                </h3>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Catégorie
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as ExpenseCategory })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold"
                  >
                    <option value="SUPPLIES">Fournitures (SUPPLIES)</option>
                    <option value="EQUIPMENT">Équipement (EQUIPMENT)</option>
                    <option value="MAINTENANCE">Maintenance (MAINTENANCE)</option>
                    <option value="SALARIES">Salaires (SALARIES)</option>
                    <option value="ELECTRICITY">Électricité</option>
                    <option value="WATER">Eau</option>
                    <option value="INTERNET">Internet & Télécoms</option>
                    <option value="TRANSPORT">Transport</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Montant (MAD)
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description / Objet de la dépense
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Réparation climatiseur Bâtiment A"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    N° Facture / Bon
                  </label>
                  <input
                    type="text"
                    placeholder="ex: FACT-2026-089"
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono"
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
                    className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 rounded-xl shadow-md hover:bg-rose-700"
                  >
                    Enregistrer Dépense
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
