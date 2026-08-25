'use client';

import React, { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { Student } from '@/types/database';
import { TuitionPaymentRecord } from './PaymentModal';
import { logAuditEvent } from '@/lib/audit';
import {
  X,
  Printer,
  Receipt,
  Scissors
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

  const formattedTitle = React.useMemo(() => {
    const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
    const cleanStudentName = studentName.replace(/\s+/g, '_');
    const cleanMonth = (monthName || record.month || 'Mois').replace(/\s+/g, '_');
    return `Recu_${cleanStudentName}_${cleanMonth}`;
  }, [student, record, monthName]);

  useEffect(() => {
    const originalTitle = document.title;
    document.title = formattedTitle;

    // Log viewing of receipt
    logAuditEvent({
      action: 'TUITION_RECEIPT_GENERATED',
      entity_type: 'student_tuition_payments',
      entity_id: record.receipt_number || student.id,
      details: {
        receipt_number: record.receipt_number,
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        student_code: student.student_code,
        class_name: student.class?.name,
        month: record.month,
        month_name: monthName,
        paid_amount: record.paid_amount,
        total_amount: record.amount,
        payment_method: record.payment_method || 'CASH',
        reference: record.reference,
        format: 'DUPLICATA_A4',
      },
    });

    return () => {
      document.title = originalTitle;
    };
  }, [formattedTitle, record, student, monthName]);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = formattedTitle;

    // Log printing of receipt
    logAuditEvent({
      action: 'TUITION_RECEIPT_PRINTED',
      entity_type: 'student_tuition_payments',
      entity_id: record.receipt_number || student.id,
      details: {
        receipt_number: record.receipt_number,
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        student_code: student.student_code,
        class_name: student.class?.name,
        month: record.month,
        month_name: monthName,
        paid_amount: record.paid_amount,
        total_amount: record.amount,
        payment_method: record.payment_method || 'CASH',
        reference: record.reference,
        copies: '2_REÇUS_SUR_A4 (Parent + Établissement)',
      },
    });

    window.print();
    setTimeout(() => {
      document.title = formattedTitle;
    }, 1000);
  };

  const paymentMethodsLabels: Record<string, string> = {
    CASH: 'Espèces / نقداً',
    CHECK: 'Chèque Bancaire / شيك',
    TRANSFER: 'Virement Bancaire / تحويل بنكي',
    CARD: 'Carte Bancaire / TPE',
  };

  const methodLabel = record.payment_method ? paymentMethodsLabels[record.payment_method] || record.payment_method : 'Espèces';

  // Single Voucher Component
  const renderVoucher = (copyType: 'PARENT' | 'ADMIN') => {
    const isParent = copyType === 'PARENT';

    return (
      <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-300 text-slate-900 space-y-2.5 print:border print:border-slate-400 print:p-3 font-sans shadow-2xs">
        {/* 1. Header with Logo & School Info */}
        <div className="flex items-center justify-between pb-2 border-b-2 border-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg border border-slate-200 p-0.5 flex items-center justify-center bg-white shrink-0">
              <img
                src={settings.logo_url || '/logo.png'}
                alt="School Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-[11.5px] font-black text-slate-950 uppercase tracking-tight leading-tight">
                {settings.school_name || 'GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES'}
              </h1>
              <h2 className="text-[9.5px] font-bold text-slate-700 leading-tight">
                {settings.school_name_ar || 'مجموعة مدارس الأجيال الصاعدة'}
              </h2>
              <div className="text-[8px] text-slate-500 font-medium">
                {settings.address || 'Casablanca, Maroc'} &bull; Tél: {settings.phone || '+212 522-001122'}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div
              className={`inline-block px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider ${
                isParent ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
              }`}
            >
              {isParent ? 'REÇU • EXEMPLAIRE PARENT' : 'REÇU • EXEMPLAIRE ÉTABLISSEMENT'}
            </div>
            <div className="mt-0.5 font-mono text-[9px] font-black text-slate-900">
              N° {record.receipt_number || 'REC-2026-0001'}
            </div>
            <div className="text-[8.5px] text-slate-500 font-semibold">
              Date : {record.payment_date || new Date().toISOString().split('T')[0]}
            </div>
          </div>
        </div>

        {/* 2. Student & Academic Details */}
        <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[10.5px]">
          <div className="space-y-0.5">
            <div>
              <span className="text-slate-500 font-semibold">Élève : </span>
              <span className="font-extrabold text-slate-950 text-[11px]">
                {student.first_name} {student.last_name}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold">Matricule / Massar : </span>
              <span className="font-mono font-bold text-slate-800">{student.student_code}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold">Classe : </span>
              <span className="font-bold text-sky-800">{student.class?.name || 'Non assigné'}</span>
            </div>
          </div>

          <div className="space-y-0.5 text-right sm:text-left">
            <div>
              <span className="text-slate-500 font-semibold">Année Scolaire : </span>
              <span className="font-bold text-slate-800">{record.academic_year || '2025-2026'}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold">Mois de Règlement : </span>
              <span className="font-extrabold text-indigo-700 uppercase">{monthName}</span>
            </div>
            <div className="truncate">
              <span className="text-slate-500 font-semibold">Tuteur : </span>
              <span className="font-medium text-slate-800">{student.guardian_name || 'Tuteur légal'} ({student.guardian_phone || student.phone || 'N/A'})</span>
            </div>
          </div>
        </div>

        {/* 3. Payment Breakdown Table */}
        <div className="overflow-hidden border border-slate-300 rounded-lg">
          <table className="w-full text-left text-[10px] border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold uppercase text-[9px]">
                <th className="py-1 px-2.5">Désignation</th>
                <th className="py-1 px-2.5 text-center">Période</th>
                <th className="py-1 px-2.5 text-right">Montant Dû</th>
                <th className="py-1 px-2.5 text-right">Montant Réglé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              {/* Tuition Fee Row */}
              <tr>
                <td className="py-1.5 px-2.5">
                  <div className="font-bold text-slate-900">Frais de Scolarité & Enseignement</div>
                  <div className="text-[8.5px] text-slate-500">Mode : {methodLabel} {record.reference ? `(Réf: ${record.reference})` : ''}</div>
                </td>
                <td className="py-1.5 px-2.5 text-center font-bold text-slate-700">{monthName}</td>
                <td className="py-1.5 px-2.5 text-right font-mono font-semibold">
                  {(record.tuition_amount !== undefined && record.tuition_amount !== null
                    ? record.tuition_amount
                    : record.has_transport && record.transport_amount
                    ? record.amount - record.transport_amount
                    : record.amount
                  ).toLocaleString()} MAD
                </td>
                <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
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
                  <td className="py-1 px-2.5">
                    <div className="font-bold text-amber-900">🚌 Frais de Transport Scolaire</div>
                  </td>
                  <td className="py-1 px-2.5 text-center font-bold text-slate-700">{monthName}</td>
                  <td className="py-1 px-2.5 text-right font-mono font-semibold text-amber-900">
                    {(record.transport_amount || 400).toLocaleString()} MAD
                  </td>
                  <td className="py-1 px-2.5 text-right font-mono font-bold text-amber-900">
                    {(record.transport_amount || 400).toLocaleString()} MAD
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-300 font-bold">
                <td colSpan={3} className="py-1.5 px-2.5 text-right text-[9.5px] uppercase text-slate-600">
                  Total Encaissé (TTC) :
                </td>
                <td className="py-1.5 px-2.5 text-right font-mono font-black text-xs text-emerald-800">
                  {record.paid_amount.toLocaleString()} MAD
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Remaining Balance if partial */}
        {record.paid_amount < record.amount && (
          <div className="p-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[9.5px] flex items-center justify-between">
            <span className="font-semibold">⚠️ Reste à payer sur ce mois :</span>
            <span className="font-mono font-black text-[11px] text-rose-600">
              {(record.amount - record.paid_amount).toLocaleString()} MAD
            </span>
          </div>
        )}

        {/* 4. Signatures Area */}
        <div className="grid grid-cols-2 gap-4 pt-1.5 border-t border-slate-200 text-[9px]">
          <div>
            <div className="font-bold text-slate-500 uppercase">Signature du Tuteur / Parent :</div>
            <div className="h-8 border-b border-dashed border-slate-300 mt-1" />
          </div>

          <div className="text-right">
            <div className="font-bold text-slate-500 uppercase">Cachet & Signature Établissement :</div>
            <div className="h-8 border-b border-dashed border-slate-300 mt-1 flex items-center justify-center text-slate-300 text-[8.5px] italic">
              (Direction Pédagogique / Financière)
            </div>
          </div>
        </div>

        {/* Footer Notice */}
        <div className="text-center text-[7.5px] text-slate-400">
          Ce reçu certifie le règlement des frais de scolarité. Conservez ce document précieusement.
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      {/* Container with print specific styles */}
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[96vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:p-0 print:m-0 print:bg-white print:text-black">
        
        {/* Modal Top Control Bar (Hidden in Print) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 print:hidden">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Receipt className="w-5 h-5" />
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                {dir === 'rtl' ? 'معاينة وطباعة الوصل المزدوج (2 في 1)' : 'Reçu de Paiement Duplicata (2 Reçus / Page A4)'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {dir === 'rtl' ? 'نسخة للولي + نسخة للإدارة في نفس ورقة A4 مع خط تقطيع وسطي' : '1 exemplaire pour le parent + 1 exemplaire pour l\'école sur la même feuille A4'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-sky-600/25 transition-all cursor-pointer transform active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>{dir === 'rtl' ? 'طباعة الورقة A4' : 'Imprimer sur 1 Page A4'}</span>
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

        {/* Printable Official Sheet: 2 Vouchers on 1 Page with Cut Line */}
        <div className="space-y-3 print:space-y-2">
          {/* Top Voucher: Exemplaire Parent */}
          {renderVoucher('PARENT')}

          {/* Cutting Line Separator */}
          <div className="relative flex items-center justify-center my-2 print:my-1.5">
            <div className="w-full border-t-2 border-dashed border-slate-400 dark:border-slate-600" />
            <div className="absolute px-3 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase flex items-center gap-1.5 print:bg-white print:text-slate-600">
              <Scissors className="w-3 h-3 text-slate-600 dark:text-slate-300" />
              <span>{dir === 'rtl' ? '✂ خط التقطيع / Ligne de Découpe ✂' : '✂ LIGNE DE DÉCOUPE / COUPER ICI ✂'}</span>
            </div>
          </div>

          {/* Bottom Voucher: Exemplaire Administration */}
          {renderVoucher('ADMIN')}
        </div>
      </div>
    </div>
  );
}
