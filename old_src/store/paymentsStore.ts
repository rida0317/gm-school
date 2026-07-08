// src/store/paymentsStore.ts - Zustand store for payment management

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabaseClient'

import paymentService, { type Payment, type PaymentRecord, type PaymentStats, type PaymentReminder } from '../services/payments.service'
import type { Student } from '../types'

interface PaymentsState {
  // Data
  payments: Payment[]
  records: PaymentRecord[]
  stats: PaymentStats | null
  reminders: PaymentReminder[]
  
  // Settings
  academicYear: string
  selectedClassId: string | null
  selectedStudentId: string | null
  
  // UI State
  isLoading: boolean
  error: string | null
}

interface PaymentsActions {
  // Fetch from Supabase
  fetchPayments: () => Promise<void>
  
  // CRUD Payments
  createPayment: (payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'paidAmount' | 'remainingAmount' | 'status'>) => Promise<Payment>
  updatePayment: (paymentId: string, updates: Partial<Payment>) => Promise<Payment | null>
  deletePayment: (paymentId: string) => Promise<boolean>
  
  // Record Payments
  recordPayment: (
    paymentId: string,
    amount: number,
    paymentMethod: 'cash' | 'check' | 'bank_transfer' | 'online',
    recordedBy: string,
    recordedByName: string,
    notes?: string
  ) => Promise<PaymentRecord>
  
  // Get Payments
  getPaymentsByStudent: (studentId: string) => Payment[]
  getPaymentsByClass: (classId: string) => Payment[]
  getOverduePayments: () => Payment[]
  getDueSoonPayments: (days?: number) => Payment[]
  getReminders: () => PaymentReminder[]
  
  // Settings
  setAcademicYear: (year: string) => void
  setSelectedClassId: (classId: string | null) => void
  setSelectedStudentId: (studentId: string | null) => void
  
  // State
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  refreshStats: () => void
  subscribeToPayments: (studentId?: string) => void
  subscribeToRecords: (paymentId?: string) => void
}

export type PaymentsStore = PaymentsState & PaymentsActions

const currentAcademicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`

const initialState: PaymentsState = {
  payments: [],
  records: [],
  stats: null,
  reminders: [],
  academicYear: currentAcademicYear,
  selectedClassId: null,
  selectedStudentId: null,
  isLoading: false,
  error: null
}

export const usePaymentsStore = create<PaymentsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ========== FETCH PAYMENTS FROM SUPABASE ==========

      fetchPayments: async () => {
        const currentSchoolId = 'default'
        if (!currentSchoolId) return

        set({ isLoading: true, error: null })
        try {
          const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('school_id', currentSchoolId)
            .order('created_at', { ascending: false })

          if (error) throw error

          const mappedPayments: Payment[] = (data || []).map(p => ({
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
          }))

          set({ payments: mappedPayments, isLoading: false })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch payments',
            isLoading: false
          })
        }
      },

      // ========== CRUD PAYMENTS ==========

      createPayment: async (payment) => {
        set({ isLoading: true, error: null })
        try {
          const newPayment = await paymentService.createPayment(payment)
          set((state) => ({
            payments: [newPayment, ...state.payments],
            isLoading: false
          }))
          get().refreshStats()
          return newPayment
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create payment',
            isLoading: false
          })
          throw error
        }
      },

      updatePayment: async (paymentId, updates) => {
        set({ isLoading: true, error: null })
        try {
          const updatedPayment = await paymentService.updatePayment(paymentId, updates)
          if (updatedPayment) {
            set((state) => ({
              payments: state.payments.map(p => p.id === paymentId ? updatedPayment : p),
              isLoading: false
            }))
            get().refreshStats()
          }
          return updatedPayment
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update payment',
            isLoading: false
          })
          throw error
        }
      },

      deletePayment: async (paymentId) => {
        set({ isLoading: true, error: null })
        try {
          const success = await paymentService.deletePayment(paymentId)
          if (success) {
            set((state) => ({
              payments: state.payments.filter(p => p.id !== paymentId),
              isLoading: false
            }))
            get().refreshStats()
          }
          return success
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete payment',
            isLoading: false
          })
          throw error
        }
      },

      // ========== RECORD PAYMENTS ==========

      recordPayment: async (paymentId, amount, paymentMethod, recordedBy, recordedByName, notes) => {
        set({ isLoading: true, error: null })
        try {
          const record = await paymentService.recordPayment(
            paymentId,
            amount,
            paymentMethod,
            recordedBy,
            recordedByName,
            notes
          )
          
          // Update the payment in the store with new paid/remaining amounts
          const payment = get().payments.find(p => p.id === paymentId)
          if (payment) {
            const newPaidAmount = (payment.paidAmount || 0) + amount
            const newRemainingAmount = payment.amount - newPaidAmount
            let newStatus = 'pending'
            
            if (newPaidAmount >= payment.amount) {
              newStatus = 'paid'
            } else if (newPaidAmount > 0) {
              newStatus = 'partial'
            }
            
            const updatedPayment = {
              ...payment,
              paidAmount: newPaidAmount,
              remainingAmount: newRemainingAmount,
              status: newStatus as any,
              paymentDate: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : payment.paymentDate
            }
            
            set((state) => ({
              payments: state.payments.map(p => p.id === paymentId ? updatedPayment : p),
              records: [record, ...state.records],
              isLoading: false
            }))
          } else {
            set((state) => ({
              records: [record, ...state.records],
              isLoading: false
            }))
          }
          
          get().refreshStats()
          
          // Refresh from Supabase to ensure consistency
          setTimeout(() => get().fetchPayments(), 500)
          
          return record
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to record payment',
            isLoading: false
          })
          throw error
        }
      },

      // ========== GET PAYMENTS ==========

      getPaymentsByStudent: (studentId) => {
        return paymentService.getPaymentsByStudent(studentId, get().academicYear)
      },

      getPaymentsByClass: (classId) => {
        return paymentService.getPaymentsByClass(classId)
      },

      getOverduePayments: () => {
        return paymentService.getOverduePayments()
      },

      getDueSoonPayments: (days = 7) => {
        return paymentService.getDueSoonPayments(days)
      },

      getReminders: () => {
        return paymentService.getPaymentReminders()
      },

      // ========== SETTINGS ==========

      setAcademicYear: (year) => {
        set({ academicYear: year })
      },

      setSelectedClassId: (classId) => {
        set({ selectedClassId: classId })
      },

      setSelectedStudentId: (studentId) => {
        set({ selectedStudentId: studentId })
      },

      // ========== STATE ==========

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setError: (error) => {
        set({ error })
      },

      refreshStats: () => {
        const stats = paymentService.getStats(get().academicYear)
        const reminders = paymentService.getPaymentReminders()
        set({ stats, reminders })
      },

      subscribeToPayments: (studentId) => {
        const unsubscribe = paymentService.subscribeToPayments(studentId || undefined)
        get().refreshStats()
        return unsubscribe
      },

      subscribeToRecords: (paymentId) => {
        const unsubscribe = paymentService.subscribeToRecords(paymentId || undefined)
        return unsubscribe
      }
    }),
    {
      name: 'payments-store',
      partialize: (state) => ({
        academicYear: state.academicYear,
        payments: state.payments.slice(0, 50)
      })
    }
  )
)

// ========== SELECTOR HOOKS ==========

export const usePayments = () => usePaymentsStore((state) => state.payments)
export const usePaymentRecords = () => usePaymentsStore((state) => state.records)
export const usePaymentStats = () => usePaymentsStore((state) => state.stats)
export const usePaymentReminders = () => usePaymentsStore((state) => state.reminders)
export const useAcademicYear = () => usePaymentsStore((state) => state.academicYear)
export const usePaymentsLoading = () => usePaymentsStore((state) => state.isLoading)
export const usePaymentsError = () => usePaymentsStore((state) => state.error)

// ========== UTILITY FUNCTIONS ==========

export const createPayment = async (payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'paidAmount' | 'remainingAmount' | 'status'>): Promise<Payment> => {
  const { createPayment: create } = usePaymentsStore.getState()
  return create(payment)
}

export const recordPayment = async (
  paymentId: string,
  amount: number,
  paymentMethod: 'cash' | 'check' | 'bank_transfer' | 'online',
  recordedBy: string,
  recordedByName: string,
  notes?: string
): Promise<PaymentRecord> => {
  const { recordPayment: record } = usePaymentsStore.getState()
  return record(paymentId, amount, paymentMethod, recordedBy, recordedByName, notes)
}

export const updatePayment = async (paymentId: string, updates: Partial<Payment>): Promise<Payment | null> => {
  const { updatePayment: update } = usePaymentsStore.getState()
  return update(paymentId, updates)
}

export const deletePayment = async (paymentId: string): Promise<boolean> => {
  const { deletePayment: del } = usePaymentsStore.getState()
  return del(paymentId)
}


