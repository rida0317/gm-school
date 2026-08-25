'use client';

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { Student } from '@/types/database';
import {
  X,
  CreditCard,
  Banknote,
  Building2,
  Calendar,
  FileText,
  Printer,
  CheckCircle2,
  DollarSign,
  Bus,
  Coins
} from 'lucide-react';

export interface TuitionPaymentRecord {
  id?: string;
  student_id: string;
  class_id?: string;
  academic_year: string;
  month: string;
  amount: number;
  paid_amount: number;
  tuition_amount?: number;
  transport_amount?: number;
  has_transport?: boolean;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'PARTIAL';
  payment_method?: 'CASH' | 'CHECK' | 'TRANSFER' | 'CARD';
  payment_date?: string;
  receipt_number?: string;
  reference?: string;
  notes?: string;
  created_at?: string;
}

interface PaymentModalProps {
  student: Student;
  monthName: string;
  monthKey: string;
  academicYear: string;
  existingRecord?: TuitionPaymentRecord | null;
  defaultMonthlyFee?: number;
  onClose: () => void;
  onSave: (record: TuitionPaymentRecord, printReceiptImmediately?: boolean) => Promise<void>;
}

export function PaymentModal({
  student,
  monthName,
  monthKey,
  academicYear,
  existingRecord,
  defaultMonthlyFee = 1500,
  onClose,
  onSave,
}: PaymentModalProps) {
  const { dir } = useI18n();
  const { settings } = useSettings();

  // 1. Calculate base tuition fee (custom or by cycle)
  const baseTuitionFee = React.useMemo(() => {
    if (existingRecord?.tuition_amount !== undefined && existingRecord.tuition_amount !== null) {
      return Number(existingRecord.tuition_amount);
    }
    if (student.custom_tuition_fee !== undefined && student.custom_tuition_fee !== null && Number(student.custom_tuition_fee) > 0) {
      return Number(student.custom_tuition_fee);
    }
    const lvl = ((student.class?.level || '') + ' ' + (student.class?.name || '')).toUpperCase();
    if (['TPS', 'PS', 'MS', 'GS'].some(k => lvl.includes(k))) return Number(settings.tuition_fee_maternelle || 1300);
    if (['CP', 'CE1', 'CE2', 'CM1', 'CM2', '1AP', '2AP', '3AP', '4AP', '5AP', '6AP'].some(k => lvl.includes(k))) return Number(settings.tuition_fee_primaire || 1500);
    if (['1AC', '2AC', '3AC'].some(k => lvl.includes(k))) return Number(settings.tuition_fee_college || 1800);
    if (['TC', '1BAC', '2BAC'].some(k => lvl.includes(k))) return Number(settings.tuition_fee_lycee || 2200);
    return Number(settings.tuition_fee_primaire || 1500);
  }, [student, settings, existingRecord]);

  // 2. Calculate transport fee
  const hasTransport = existingRecord?.has_transport !== undefined ? Boolean(existingRecord.has_transport) : Boolean(student.has_transport);
  const baseTransportFee = hasTransport
    ? existingRecord?.transport_amount !== undefined
      ? Number(existingRecord.transport_amount)
      : student.transport_fee !== undefined && student.transport_fee !== null
      ? Number(student.transport_fee)
      : Number(settings.default_transport_fee || 400)
    : 0;

  const defaultTotalDue = baseTuitionFee + baseTransportFee;
  const initialAmount = existingRecord?.amount || defaultTotalDue;
  const initialPaid = existingRecord?.paid_amount !== undefined ? existingRecord.paid_amount : initialAmount;

  const [amount, setAmount] = useState<number>(initialAmount);
  const [paidAmount, setPaidAmount] = useState<number>(initialPaid);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHECK' | 'TRANSFER' | 'CARD'>(
    existingRecord?.payment_method || 'CASH'
  );
  const [paymentDate, setPaymentDate] = useState<string>(
    existingRecord?.payment_date || new Date().toISOString().split('T')[0]
  );
  const [reference, setReference] = useState<string>(existingRecord?.reference || '');
  const [notes, setNotes] = useState<string>(existingRecord?.notes || '');
  const [saving, setSaving] = useState<boolean>(false);

  // Generate or keep receipt number
  const receiptNumber =
    existingRecord?.receipt_number ||
    `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const handleSubmit = async (printImmediately = false) => {
    if (paidAmount <= 0) return;
    setSaving(true);

    const calculatedStatus: 'PAID' | 'PARTIAL' | 'PENDING' =
      paidAmount >= amount ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING';

    const record: TuitionPaymentRecord = {
      id: existingRecord?.id,
      student_id: student.id,
      class_id: student.class_id || undefined,
      academic_year: academicYear,
      month: monthKey,
      amount: Number(amount),
      paid_amount: Number(paidAmount),
      tuition_amount: baseTuitionFee,
      transport_amount: baseTransportFee,
      has_transport: hasTransport,
      status: calculatedStatus,
      payment_method: paymentMethod,
      payment_date: paymentDate,
      receipt_number: receiptNumber,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      await onSave(record, printImmediately);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto"
        dir={dir}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {dir === 'rtl' ? 'تسجيل أداء الواجب الشهري والنقل' : 'Enregistrer un Règlement'}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {monthName} &bull; {academicYear}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student Info Chip */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-sm">
              {student.first_name?.[0]}
              {student.last_name?.[0]}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {student.first_name} {student.last_name}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                <span>{student.student_code}</span>
                <span>&bull;</span>
                <span className="font-semibold text-sky-600 dark:text-sky-400">{student.class?.name || 'Sans Classe'}</span>
                {hasTransport && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-extrabold text-[10px]">
                    <Bus className="w-3 h-3" />
                    <span>Transport</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Reçu N°</span>
            <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">{receiptNumber}</span>
          </div>
        </div>

        {/* Breakdown Summary Banner */}
        <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-0.5">
            <span className="text-slate-500 text-[11px] block">{dir === 'rtl' ? 'واجب التمدرس (Scolarité) :' : 'Frais de Scolarité :'}</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{baseTuitionFee.toLocaleString()} MAD</span>
          </div>
          <div className="space-y-0.5 text-right sm:text-left">
            <span className="text-slate-500 text-[11px] block">{dir === 'rtl' ? 'النقل المدرسي (Transport) :' : 'Transport Scolaire :'}</span>
            <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
              {hasTransport ? `${baseTransportFee.toLocaleString()} MAD` : dir === 'rtl' ? 'غير مفعل' : 'Inactif (0 MAD)'}
            </span>
          </div>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {dir === 'rtl' ? 'إجمالي المستحق (MAD)' : 'Total Dû Mensuel (MAD)'}
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {dir === 'rtl' ? 'المبلغ المؤدى فعلياً (MAD)' : 'Montant Réglé (MAD)'}
            </label>
            <input
              type="number"
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 text-sm font-black text-emerald-700 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Payment Method Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            {dir === 'rtl' ? 'طريقة الأداء' : 'Mode de Paiement'}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { key: 'CASH', label: dir === 'rtl' ? 'نقداً (Espèces)' : 'Espèces', icon: Banknote },
              { key: 'CHECK', label: dir === 'rtl' ? 'شيك (Chèque)' : 'Chèque', icon: FileText },
              { key: 'TRANSFER', label: dir === 'rtl' ? 'تحويل (Virement)' : 'Virement', icon: Building2 },
              { key: 'CARD', label: dir === 'rtl' ? 'بطاقة (TPE)' : 'Carte Bancaire', icon: CreditCard },
            ].map((method) => {
              const Icon = method.icon;
              const isSelected = paymentMethod === method.key;
              return (
                <button
                  key={method.key}
                  type="button"
                  onClick={() => setPaymentMethod(method.key as any)}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[11px] truncate">{method.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date & Dynamic Reference Input */}
        <div className={`grid gap-3 ${paymentMethod === 'CASH' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 animate-in fade-in duration-200'}`}>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {dir === 'rtl' ? 'تاريخ الأداء' : 'Date de Règlement'}
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {paymentMethod === 'CHECK' && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>{dir === 'rtl' ? 'رقم الشيك البنكي' : 'Numéro du Chèque'}</span>
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={dir === 'rtl' ? 'مثال: CHQ-882341 (البنك الشعبي)...' : 'Ex: CHQ-882341 (Attijari / BP)...'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            </div>
          )}

          {paymentMethod === 'TRANSFER' && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <label className="block text-xs font-bold text-sky-700 dark:text-sky-400 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>{dir === 'rtl' ? 'مرجع التحويل البنكي' : 'Référence du Virement'}</span>
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={dir === 'rtl' ? 'مثال: VIR-2026-9041...' : 'Ex: VIR-2026-9041 (Banque...)'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-sky-300 dark:border-sky-700 bg-sky-50/40 dark:bg-sky-950/20 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                autoFocus
              />
            </div>
          )}

          {paymentMethod === 'CARD' && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-400 mb-1 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                <span>{dir === 'rtl' ? 'رقم التوصيل / العملية (TPE)' : 'N° Transaction / Ticket TPE'}</span>
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={dir === 'rtl' ? 'مثال: TPE-99412...' : 'Ex: TPE-99412...'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/20 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {dir === 'rtl' ? 'ملاحظات إضافية' : 'Notes ou Remarques'}
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Reçu délivré à la mère..."
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
          >
            {dir === 'rtl' ? 'إلغاء' : 'Annuler'}
          </button>

          <div className="flex-1 flex gap-2">
            <button
              type="button"
              disabled={saving || paidAmount <= 0}
              onClick={() => handleSubmit(false)}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Enregistrement...' : dir === 'rtl' ? 'حفظ الأداء' : 'Valider le Paiement'}</span>
            </button>

            <button
              type="button"
              disabled={saving || paidAmount <= 0}
              onClick={() => handleSubmit(true)}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20 disabled:opacity-50"
              title="Valider et imprimer le reçu"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{dir === 'rtl' ? 'حفظ وطباعة الوصل' : 'Valider & Imprimer'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
