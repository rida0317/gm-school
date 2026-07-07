// src/services/payments.service.ts - Payment management service for school fees (Supabase Version)

import { supabase } from '../lib/supabaseClient'


export interface Payment {
  id: string
  studentId: string
  schoolId: string
  amount: number
  paidAmount: number
  remainingAmount: number
  type: 'inscription' | 'mensualite' | 'transport' | 'cantine' | 'autre'
  status: 'paid' | 'partial' | 'pending' | 'overdue' | 'cancelled'
  dueDate: string
  paymentDate?: string
  academicYear: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface PaymentRecord {
  id: string
  paymentId: string
  studentId: string
  amount: number
  paymentDate: string
  paymentMethod: 'cash' | 'check' | 'bank_transfer' | 'online'
  receiptNumber: string
  notes?: string
  recordedBy: string
  createdAt: string
}

class PaymentService {
  /**
   * Create new payment expectation (frais à payer)
   */
  async createPayment(payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'paidAmount' | 'remainingAmount' | 'status'>): Promise<Payment> {
    const schoolId = 'default';
    if (!schoolId) throw new Error('No school selected');

    const { data, error } = await supabase
      .from('payments')
      .insert([{
        student_id: payment.studentId,
        school_id: schoolId,
        amount: payment.amount,
        paid_amount: 0,
        remaining_amount: payment.amount,
        type: payment.type,
        status: 'pending',
        due_date: payment.dueDate,
        academic_year: payment.academicYear,
        notes: payment.notes
      }])
      .select()
      .single();

    if (error) throw error;
    return this.mapPayment(data);
  }

  /**
   * Record a payment transaction
   */
  async recordPayment(
    paymentId: string,
    amount: number,
    paymentMethod: 'cash' | 'check' | 'bank_transfer' | 'online',
    recordedBy: string,
    notes?: string
  ): Promise<PaymentRecord> {
    const schoolId = 'default';
    if (!schoolId) throw new Error('No school selected');

    // 1. Get current payment state
    const { data: payment, error: pError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();
    
    if (pError) throw pError;

    // 2. Create payment record (transaction)
    const receiptNumber = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const { data: record, error: rError } = await supabase
      .from('payment_records')
      .insert([{
        payment_id: paymentId,
        student_id: payment.student_id,
        school_id: schoolId,
        amount: amount,
        payment_method: paymentMethod,
        receipt_number: receiptNumber,
        notes: notes,
        recorded_by: recordedBy
      }])
      .select()
      .single();

    if (rError) throw rError;

    // 3. Update parent payment status
    const newPaidAmount = (payment.paid_amount || 0) + amount;
    const newRemainingAmount = payment.amount - newPaidAmount;
    let newStatus = 'pending';

    if (newPaidAmount >= payment.amount) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }

    const { error: uError } = await supabase
      .from('payments')
      .update({
        paid_amount: newPaidAmount,
        remaining_amount: newRemainingAmount,
        status: newStatus,
        payment_date: newStatus === 'paid' ? new Date().toISOString() : payment.payment_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (uError) throw uError;

    return this.mapRecord(record);
  }

  /**
   * Get payments for a student
   */
  async getPaymentsByStudent(studentId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(p => this.mapPayment(p));
  }

  /**
   * Helper to map DB record to Payment interface
   */
  private mapPayment(p: any): Payment {
    return {
      id: p.id,
      studentId: p.student_id,
      schoolId: p.school_id,
      amount: p.amount,
      paidAmount: p.paid_amount,
      remainingAmount: p.remaining_amount,
      type: p.type,
      status: p.status,
      dueDate: p.due_date,
      paymentDate: p.payment_date,
      academicYear: p.academic_year,
      notes: p.notes,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    };
  }

  /**
   * Helper to map DB record to PaymentRecord interface
   */
  private mapRecord(r: any): PaymentRecord {
    return {
      id: r.id,
      paymentId: r.payment_id,
      studentId: r.student_id,
      amount: r.amount,
      paymentDate: r.payment_date,
      paymentMethod: r.payment_method,
      receiptNumber: r.receipt_number,
      notes: r.notes,
      recordedBy: r.recorded_by,
      createdAt: r.created_at
    };
  }
}

export const paymentService = new PaymentService();
export default paymentService;

