'use client';

import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  FileBarChart,
  Download,
  GraduationCap,
  Users,
  CalendarDays,
  Boxes,
  Wallet,
  FileSpreadsheet,
  Printer
} from 'lucide-react';

export default function ReportsPage() {
  const reportCategories = [
    {
      title: 'Rapports Scolaires & Élèves',
      icon: GraduationCap,
      color: 'blue',
      items: [
        { name: 'Liste Complète des Élèves par Classe', format: 'Excel (.xlsx)', size: '24 KB' },
        { name: 'Statistiques Globales d\'Assiduité & Retards', format: 'PDF Document', size: '145 KB' },
        { name: 'Bilan Mensuel des Justifications d\'Absence', format: 'CSV', size: '18 KB' },
      ],
    },
    {
      title: 'Rapports Enseignants & Charge Horaire',
      icon: Users,
      color: 'emerald',
      items: [
        { name: 'Récapitulatif des Heures & Volumes par Matière', format: 'Excel (.xlsx)', size: '32 KB' },
        { name: 'Historique des Remplacements & Suppléances', format: 'PDF Document', size: '95 KB' },
      ],
    },
    {
      title: 'Rapports Logistique & Stock',
      icon: Boxes,
      color: 'amber',
      items: [
        { name: 'État de l\'Inventaire & Valorisation Globale', format: 'Excel (.xlsx)', size: '48 KB' },
        { name: 'Journal des Mouvements (Entrées / Sorties)', format: 'CSV', size: '60 KB' },
        { name: 'Liste des Articles sous Seuil d\'Alerte', format: 'PDF Document', size: '40 KB' },
      ],
    },
    {
      title: 'Rapports Financiers & Dépenses',
      icon: Wallet,
      color: 'rose',
      items: [
        { name: 'Bilan Analytique des Dépenses par Catégorie', format: 'PDF Document', size: '180 KB' },
        { name: 'Suivi de Consommation Budgétaire 2025-2026', format: 'Excel (.xlsx)', size: '55 KB' },
      ],
    },
  ];

  const handleDownload = (reportName: string) => {
    // Generate sample CSV download
    const csvContent = `data:text/csv;charset=utf-8,Rapport: ${reportName}\nDate: ${new Date().toLocaleDateString()}\nStatut: Genere avec succes\n`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${reportName.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <FileBarChart className="w-4 h-4" />
              Intelligence & Décision
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Centre de Rapports & Exports
            </h1>
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm shadow-md hover:bg-slate-800 transition-all"
          >
            <Printer className="w-4 h-4" />
            Imprimer la Vue
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reportCategories.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
              >
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {cat.title}
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {cat.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between transition-colors group"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Format : {item.format} • {item.size}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDownload(item.name)}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:border-blue-500 shadow-xs transition-colors"
                        title="Télécharger"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
