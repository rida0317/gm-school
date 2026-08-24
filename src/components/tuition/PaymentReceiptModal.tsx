'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { Student } from '@/types/database';
import { TuitionPaymentRecord } from './PaymentModal';
import {
  X,
  Printer,
  CheckCircle2,
  Building,
  Calendar,
  Receipt,
  Download
} from 'lucide-react';

interface PaymentReceiptModalProps {
  student: Student;
  record: TuitionPaymentRecord;
  monthName: string;
  onClose: () => void;
}

export function PaymentReceiptModal({
  student,
  record,
  monthName,
  onClose,
}: PaymentReceiptModalProps) {
  const { t, dir } = useI18n();
  const { settings } = useSettings();

  const handlePrint = () => {
    window.print();
  };

  const paymentMethodsLabels: Record<string, string> = {
    CASH: 'Espèces / نقداً',
    CHECK: 'Chèque Bancaire / شيك',
    TRANSFER: 'Virement Bancaire / تحويل بنكي',
    CARD: 'Carte Bancaire / TPE',
  };

  const methodLabel = record.payment_method ? paymentMethodsLabels[record.payment_method] || record.payment_method : 'Espèces';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      {/* Container with print specific styles */}
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 max-h-[95vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:p-0 print:m-0 print:bg-white print:text-black">
        {/* Modal Top Control Bar (Hidden in Print) */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 print:hidden">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Receipt className="w-5 h-5" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {dir === 'rtl' ? 'معاينة وطباعة وصل الأداء' : 'Reçu de Paiement Officiel'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-sky-600/25 transition-all cursor-pointer transform active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>{dir === 'rtl' ? 'طباعة الوصل (Imprimer)' : 'Imprimer le Reçu'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Receipt Sheet Area */}
        <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-xs text-slate-900 space-y-6 print:border-none print:p-0 print:shadow-none font-sans">
          {/* 1. Header with Logo & School Info */}
          <div className="flex items-center justify-between pb-5 border-b-2 border-slate-900/80">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-16 rounded-xl border border-slate-200 p-1 flex items-center justify-center bg-white shadow-2xs">
                <img
                  src={settings.logo_url || '/logo.png'}
                  alt="School Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black text-slate-950 uppercase tracking-tight">
                  {settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES'}
                </h1>
                <h2 className="text-xs font-bold text-slate-700">
                  {settings.school_name_ar || 'مجموعة مدارس الأجيال الصاعدة'}
                </h2>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {settings.address || 'Casablanca, Maroc'} &bull; Tél: {settings.phone || '+212 522-001122'}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-black uppercase tracking-wider">
                REÇU DE PAIEMENT
              </div>
              <div className="mt-1 font-mono text-xs font-bold text-slate-800">
                N° {record.receipt_number || 'REC-2026-0001'}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                Date : {record.payment_date || new Date().toISOString().split('T')[0]}
              </div>
            </div>
          </div>

          {/* 2. Student & Academic Details */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div className="space-y-1.5">
              <div>
                <span className="text-slate-500 font-semibold">Nom & Prénom de l&apos;Élève : </span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {student.first_name} {student.last_name}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">Matricule / Code Massar : </span>
                <span className="font-mono font-bold text-slate-800">{student.student_code}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">Classe / Niveau : </span>
                <span className="font-bold text-sky-800">{student.class?.name || 'Non assigné'}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-right sm:text-left">
              <div>
                <span className="text-slate-500 font-semibold">Année Scolaire : </span>
                <span className="font-bold text-slate-800">{record.academic_year || '2025-2026'}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">Mois Règlement : </span>
                <span className="font-extrabold text-indigo-700 uppercase">{monthName}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">Tuteur / Téléphone : </span>
                <span className="font-medium text-slate-800">{student.guardian_name || 'Tuteur légal'} ({student.guardian_phone || student.phone || 'N/A'})</span>
              </div>
            </div>
          </div>

          {/* 3. Payment Breakdown Table */}
          <div className="overflow-hidden border border-slate-300 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Désignation</th>
                  <th className="py-2.5 px-3 text-center">Période</th>
                  <th className="py-2.5 px-3 text-right">Montant Total</th>
                  <th className="py-2.5 px-3 text-right">Montant Réglé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {/* Tuition Fee Row */}
                <tr>
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">Frais de Scolarité & Enseignement</div>
                    <div className="text-[10px] text-slate-500">Mode : {methodLabel} {record.reference ? `(Réf: ${record.reference})` : ''}</div>
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-slate-700">{monthName}</td>
                  <td className="py-3 px-3 text-right font-mono font-semibold">
                    {(record.tuition_amount !== undefined && record.tuition_amount !== null
                      ? record.tuition_amount
                      : record.has_transport && record.transport_amount
                      ? record.amount - record.transport_amount
                      : record.amount
                    ).toLocaleString()} MAD
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    {(record.tuition_amount !== undefined && record.tuition_amount !== null
                      ? record.tuition_amount
                      : record.has_transport && record.transport_amount
                      ? record.amount - record.transport_amount
                      : record.amount
                    ).toLocaleString()} MAD
                  </td>
                </tr>

                {/* Transport Fee Row (if active) */}
                {(record.has_transport || (record.transport_amount !== undefined && record.transport_amount > 0)) && (
                  <tr className="bg-amber-50/40">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-amber-900 flex items-center gap-1.5">
                        <span>🚌 Frais de Transport Scolaire</span>
                      </div>
                      <div className="text-[10px] text-amber-700">Abonnement mensuel transport</div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-700">{monthName}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-amber-900">
                      {(record.transport_amount || 400).toLocaleString()} MAD
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-900">
                      {(record.transport_amount || 400).toLocaleString()} MAD
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                  <td colSpan={3} className="py-2.5 px-3 text-right text-xs uppercase text-slate-600">
                    Total Encaissé (TTC) :
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-base text-emerald-800">
                    {record.paid_amount.toLocaleString()} MAD
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Remaining Balance if partial */}
          {record.paid_amount < record.amount && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
              <span className="font-semibold">⚠️ Reste à payer sur ce mois :</span>
              <span className="font-mono font-black text-sm text-rose-600">
                {(record.amount - record.paid_amount).toLocaleString()} MAD
              </span>
            </div>
          )}

          {/* 4. Signatures & Stamp Area */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-200 text-xs">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase">Signature du Tuteur / Parent :</div>
              <div className="h-16 border-b border-dashed border-slate-300 mt-2" />
            </div>

            <div className="text-right">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Cachet & Signature de l&apos;Établissement :</div>
              <div className="h-16 border-b border-dashed border-slate-300 mt-2 flex items-center justify-center text-slate-300 text-[10px] italic">
                (Cachet de la Direction)
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div className="text-center pt-2 text-[9px] text-slate-400 border-t border-slate-100">
            Ce reçu certifie le règlement des frais de scolarité pour la période indiquée. Conservez ce document précieusement.
          </div>
        </div>
      </div>
    </div>
  );
}
