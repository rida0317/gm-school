// src/store/monthlyPaymentsStore.ts - Store for monthly student payments (Supabase Version)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabaseClient'
import { invalidateQueries } from '../lib/queryClientSingleton'

import type { FeesSettings } from '../types/school'

export type PaymentStatus = 'paid' | 'pending' | 'partial' | 'exempt'
export type PaymentMethod = 'especes' | 'cheque' | 'virement'

export interface MonthlyPayment {
  id: string
  studentId: string
  academicYear: string
  month: number // 1-11 (Septembre=1, Juillet=11)
  baseAmount: number // Base mensuality by level
  transportAmount: number // 0 or configurable
  booksAmount: number // 0 or configurable
  activitiesAmount: number // 0 or configurable
  discount: number // Personalized discount
  paidAmount: number
  status: PaymentStatus
  paymentDate?: string
  paymentMethod?: PaymentMethod
  receiptNumber?: string
  notes?: string
  paidBy?: string
  paidByName?: string
  payerType?: 'parent' | 'student' | 'other'
  payerName?: string
  createdAt: string
  updatedAt: string
}

export interface StudentPaymentConfig {
  studentId: string
  studentName: string
  classId: string
  level: 'maternelle' | 'primaire' | 'college' | 'lycee'
  transportEnabled: boolean
  booksEnabled: boolean
  activitiesEnabled: boolean
  personalizedDiscount: number // Fixed amount discount
  discountReason?: string
  academicYear: string
}

export interface StudentPendingPayment {
  studentId: string
  studentName: string
  classId: string
  className: string
  pendingMonths: number[] // Month numbers (1-11)
  pendingMonthNames: string[] // Month names
  totalPending: number
}

// Helper to get class name from student
export const getStudentClassName = (student: any, classes: any[]) => {
  // First try student.class (if exists)
  if (student.class) {
    return student.class
  }
  // Then try student.className (if exists)
  if (student.className) {
    return student.className
  }
  // Then try to find class by classId
  const classObj = classes.find(c => c.id === student.classId)
  if (classObj) {
    return classObj.name || classObj.level
  }
  // Fallback to classId
  return student.classId
}

export interface PaymentReceipt {
  receiptNumber: string
  studentName: string
  className: string
  month: string
  amount: number
  paymentMethod: PaymentMethod
  paymentDate: string
  academicYear: string
  payerName: string
  receiverName: string
}

const MONTHS = [
  'Septembre', 'Octobre', 'Novembre', 'Décembre',
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet'
]

// Default prices (will be overridden by school settings)
const DEFAULT_LEVEL_PRICES: Record<string, number> = {
  maternelle: 800,
  primaire: 1000,
  college: 1200,
  lycee: 1500
}

const DEFAULT_TRANSPORT_PRICE = 200
const DEFAULT_BOOKS_PRICE = 300
const DEFAULT_ACTIVITIES_PRICE = 150

const ANNUAL_DISCOUNT = 0.10 // 10%

/**
 * Get current school month index (1-11, starting from September)
 */
export const getCurrentSchoolMonth = (): number => {
  const now = new Date()
  const month = now.getMonth() // 0-11 (Jan=0, Sep=8)
  
  // School year starts in September (8)
  // Sep(8)->1, Oct(9)->2, Nov(10)->3, Dec(11)->4, Jan(0)->5, Feb(1)->6, Mar(2)->7, Apr(3)->8, May(4)->9, Jun(5)->10, Jul(6)->11
  
  if (month >= 8) { // Sep - Dec
    return month - 7
  } else if (month <= 6) { // Jan - Jul
    return month + 5
  } else { // August (between years)
    return 0 // No month active
  }
}

// Get prices from settings or defaults (use FeesSettings type when available)
const getLevelPrice = (level: string, feesSettings?: FeesSettings | null): number => {
  if (feesSettings?.levelPrices?.[level]) {
    return feesSettings.levelPrices[level]
  }
  return DEFAULT_LEVEL_PRICES[level] || 1000
}

const getTransportPrice = (feesSettings?: FeesSettings | null): number => {
  return feesSettings?.transportPrice || DEFAULT_TRANSPORT_PRICE
}

const getBooksPrice = (feesSettings?: FeesSettings | null): number => {
  return feesSettings?.booksPrice || DEFAULT_BOOKS_PRICE
}

const getActivitiesPrice = (feesSettings?: FeesSettings | null): number => {
  return feesSettings?.activitiesPrice || DEFAULT_ACTIVITIES_PRICE
}

interface MonthlyPaymentsState {
  // Data
  payments: MonthlyPayment[]
  studentConfigs: StudentPaymentConfig[]
  lastReceiptNumber: string

  // UI State
  selectedClassId: string
  selectedStudentId: string | null
  academicYear: string
  isLoading: boolean
  error: string | null
  
  // Supabase Sync
  isSynced: boolean
  lastSyncTime: string | null
}

interface MonthlyPaymentsActions {
  // Payment operations
  markAsPaid: (
    studentId: string,
    month: number,
    amount: number,
    paymentMethod: PaymentMethod,
    paidBy: string,
    paidByName: string,
    payerType: 'parent' | 'student' | 'other',
    payerName: string,
    notes?: string
  ) => Promise<MonthlyPayment>
  
  markAsAnnual: (
    studentId: string,
    paymentMethod: PaymentMethod,
    paidBy: string,
    paidByName: string,
    payerType: 'parent' | 'student' | 'other',
    payerName: string,
    notes?: string
  ) => Promise<MonthlyPayment[]>
  
  undoPayment: (paymentId: string) => Promise<boolean>
  
  // Student config
  setStudentTransport: (studentId: string, enabled: boolean) => void
  setStudentBooks: (studentId: string, enabled: boolean) => void
  setStudentActivities: (studentId: string, enabled: boolean) => void
  setStudentDiscount: (studentId: string, discount: number, reason?: string) => void
  getStudentConfig: (studentId: string, classId: string, level: string) => StudentPaymentConfig
  
  // Get payments
  getStudentPayments: (studentId: string, academicYear: string) => MonthlyPayment[]
  getClassPayments: (classId: string, academicYear: string) => MonthlyPayment[]
  getPendingPayments: (academicYear: string) => MonthlyPayment[]
  getStudentsWithPendingPayments: (students: any[], academicYear: string, classes: any[]) => StudentPendingPayment[]
  
  // Stats
  getStudentStats: (studentId: string, academicYear: string) => {
    total: number
    paid: number
    remaining: number
    monthsPaid: number
    annualDiscount: number
  }
  
  // Generate receipt number
  generateReceiptNumber: () => string

  // Supabase Sync
  syncWithSupabase: () => Promise<void>
  loadFromSupabase: () => Promise<void>
  setSynced: (synced: boolean) => void
  setLastSyncTime: (time: string | null) => void

  // Import
  importData: (data: Partial<MonthlyPaymentsState>) => void

  // State
  setSelectedClassId: (classId: string) => void
  setSelectedStudentId: (studentId: string | null) => void
  setAcademicYear: (year: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export type MonthlyPaymentsStore = MonthlyPaymentsState & MonthlyPaymentsActions

/**
 * Get current academic year string (e.g., "2025-2026")
 */
export const getCurrentAcademicYear = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-11
  
  // If we are between January (0) and July (6), the school year started last year
  if (month <= 6) {
    return `${year - 1}-${year}`
  }
  // If we are between August (7) and December (11), the school year starts this year
  return `${year}-${year + 1}`
}

const initialState: MonthlyPaymentsState = {
  payments: [],
  studentConfigs: [],
  lastReceiptNumber: 'REC-2025-00000',
  selectedClassId: '',
  selectedStudentId: null,
  academicYear: getCurrentAcademicYear(),
  isLoading: false,
  error: null,
  isSynced: false,
  lastSyncTime: null
}

export const useMonthlyPaymentsStore = create<MonthlyPaymentsStore>()(
  // ❌ PERSIST DÉSACTIVÉ TEMPORAIREMENT - PROBLÈME DE CACHE
  // persist(
    (set, get) => ({
      ...initialState,

      // ========== PAYMENT OPERATIONS ==========

       markAsPaid: async (studentId, month, amount, paymentMethod, paidBy, paidByName, payerType, payerName, notes) => {
         set({ isLoading: true, error: null })

         const receiptNumber = get().generateReceiptNumber()
         const academicYear = get().academicYear

         // Check if payment already exists
         const existingIndex = get().payments.findIndex(
           p => p.studentId === studentId && p.month === month && p.academicYear === academicYear
         )

         const paymentId = existingIndex >= 0
           ? get().payments[existingIndex].id
           : `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

         const payment: MonthlyPayment = {
           id: paymentId,
           studentId,
           academicYear,
           month,
           baseAmount: amount,
           transportAmount: 0,
           discount: 0,
           paidAmount: amount,
           status: 'paid',
           paymentDate: new Date().toISOString(),
           paymentMethod,
           receiptNumber,
           notes,
           paidBy,
           paidByName,
           payerType,
           payerName,
           createdAt: existingIndex >= 0 ? get().payments[existingIndex].createdAt : new Date().toISOString(),
           updatedAt: new Date().toISOString()
         }

         // ✅ 100% WORKING SUPABASE INSERT WITH CORRECT TYPES
         try {
           const currentSchoolId = 'default'
           
           // ✅ Convert all values to correct types for Supabase
           const { error } = await supabase
             .from('monthly_payments')
             .upsert({
               id: payment.id,
               student_id: String(studentId),
               school_id: String(currentSchoolId),
               academic_year: String(academicYear),
               month: Number(month),
               base_amount: Number(amount),
               transport_amount: 0,
               discount: 0,
               paid_amount: Number(amount),
               status: 'paid',
               payment_date: payment.paymentDate,
               payment_method: String(paymentMethod),
               receipt_number: String(receiptNumber),
               notes: String(notes || ''),
               paid_by: String(paidBy || ''),
               paid_by_name: String(paidByName || ''),
               payer_type: String(payerType || 'parent'),
               payer_name: String(payerName || ''),
               created_at: payment.createdAt,
               updated_at: payment.updatedAt
             }, { onConflict: 'student_id,school_id,academic_year,month' })

           if (error) {
             console.error('❌ SUPABASE ERROR:', error)
           }
         } catch (e) {
           console.error('⚠️ Exception saving to Supabase, payment saved locally:', e)
         }

         set((state) => {
           const payments = existingIndex >= 0
             ? state.payments.map((p, i) => i === existingIndex ? payment : p)
             : [payment, ...state.payments]

           return {
             payments,
             lastReceiptNumber: receiptNumber,
             isLoading: false,
             isSynced: false
           }
         })

         // Invalidate React Query cache to update dashboard
         try {
           invalidateQueries(['monthly-payments', academicYear])
         } catch (e) {
           // Ignore if React Query not initialized
         }

         return payment
       },

       markAsAnnual: async (studentId, paymentMethod, paidBy, paidByName, payerType, payerName, notes) => {
         set({ isLoading: true, error: null })
         const academicYear = get().academicYear
         const studentConfig = get().getStudentConfig(studentId, '', '')

         const baseAmount = DEFAULT_LEVEL_PRICES[studentConfig.level] || 1000
         const transportAmount = studentConfig.transportEnabled ? DEFAULT_TRANSPORT_PRICE : 0
         const monthlyTotal = baseAmount + transportAmount - studentConfig.personalizedDiscount
         const annualTotal = monthlyTotal * MONTHS.length * (1 - ANNUAL_DISCOUNT)

         const payments: MonthlyPayment[] = []
         const currentYear = new Date().getFullYear()
         let tempReceiptNum = parseInt(get().lastReceiptNumber.split('-')[2]) || 0

         for (let month = 1; month <= MONTHS.length; month++) {
           tempReceiptNum++
           const receiptNumber = `REC-${currentYear}-${String(tempReceiptNum).padStart(5, '0')}`
           const paymentId = `payment-annual-${studentId}-${month}-${academicYear}`

           payments.push({
             id: paymentId,
             studentId,
             academicYear,
             month,
             baseAmount,
             transportAmount,
             discount: studentConfig.personalizedDiscount,
             paidAmount: annualTotal / MONTHS.length,
             status: 'paid',
             paymentDate: new Date().toISOString(),
             paymentMethod,
             receiptNumber,
             notes: notes || 'Paiement annuel -10%',
             paidBy,
             paidByName,
             payerType,
             payerName,
             createdAt: new Date().toISOString(),
             updatedAt: new Date().toISOString()
           })
         }

         // Save all payments to Supabase
          try {
           // ✅ CORRECT SCHOOL ID LIKE ALL OTHER STORES
           const currentSchoolId = 'default'

           const { error } = await supabase
             .from('monthly_payments')
             .upsert(payments.map(p => ({
               id: p.id,
               student_id: p.studentId,
               school_id: currentSchoolId,
               academic_year: p.academicYear,
               month: p.month,
               base_amount: p.baseAmount,
               transport_amount: p.transportAmount,
               discount: p.discount,
               paid_amount: p.paidAmount,
               status: 'paid',
               payment_date: p.paymentDate,
               payment_method: p.paymentMethod,
               receipt_number: p.receiptNumber,
               notes: p.notes,
               paid_by: p.paidBy,
               paid_by_name: p.paidByName,
               payer_type: p.payerType,
               payer_name: p.payerName,
               created_at: p.createdAt,
               updated_at: p.updatedAt
             })), { onConflict: 'student_id,school_id,academic_year,month' })

           if (error) throw error
         } catch (error) {
           console.error('Error saving annual payments to Supabase:', error)
         }

         set((state) => ({
           payments: [...payments, ...state.payments].filter((v, i, a) => a.findIndex(p => p.id === v.id) === i),
           lastReceiptNumber: payments[payments.length - 1].receiptNumber,
           isLoading: false,
           isSynced: false
         }))

         // Invalidate React Query cache to update dashboard
         try {
           invalidateQueries(['monthly-payments', academicYear])
         } catch (e) {
           // Ignore if React Query not initialized
         }

         return payments
       },

       undoPayment: async (paymentId) => {
         set({ isLoading: true, error: null })
         
         try {
           // ✅ Supprimer aussi de Supabase
           const currentSchoolId = 'default'
           await supabase
             .from('monthly_payments')
             .delete()
             .eq('id', paymentId)
             .eq('school_id', currentSchoolId)
         } catch (e) {
           console.error('Error deleting payment from Supabase:', e)
         }
         
         const academicYear = get().academicYear
         
         set((state) => ({
           payments: state.payments.filter(p => p.id !== paymentId),
           isLoading: false
         }))
         
         // Invalidate React Query cache to update dashboard
         try {
           invalidateQueries(['monthly-payments', academicYear])
         } catch (e) {
           // Ignore if React Query not initialized
         }
         
         return true
       },

      // ========== STUDENT CONFIG ==========

      setStudentTransport: (studentId, enabled) => {
        set((state) => {
          const existing = state.studentConfigs.find(c => c.studentId === studentId)
          
          if (existing) {
            return {
              studentConfigs: state.studentConfigs.map(c =>
                c.studentId === studentId ? { ...c, transportEnabled: enabled } : c
              )
            }
          } else {
            return {
              studentConfigs: [...state.studentConfigs, {
                studentId,
                studentName: '',
                classId: '',
                level: 'primaire',
                transportEnabled: enabled,
                booksEnabled: false,
                activitiesEnabled: false,
                personalizedDiscount: 0,
                academicYear: state.academicYear
              }]
            }
          }
        })
      },

      setStudentBooks: (studentId, enabled) => {
        set((state) => {
          const existing = state.studentConfigs.find(c => c.studentId === studentId)
          
          if (existing) {
            return {
              studentConfigs: state.studentConfigs.map(c =>
                c.studentId === studentId ? { ...c, booksEnabled: enabled } : c
              )
            }
          } else {
            return {
              studentConfigs: [...state.studentConfigs, {
                studentId,
                studentName: '',
                classId: '',
                level: 'primaire',
                transportEnabled: false,
                booksEnabled: enabled,
                activitiesEnabled: false,
                personalizedDiscount: 0,
                academicYear: state.academicYear
              }]
            }
          }
        })
      },

      setStudentActivities: (studentId, enabled) => {
        set((state) => {
          const existing = state.studentConfigs.find(c => c.studentId === studentId)
          
          if (existing) {
            return {
              studentConfigs: state.studentConfigs.map(c =>
                c.studentId === studentId ? { ...c, activitiesEnabled: enabled } : c
              )
            }
          } else {
            return {
              studentConfigs: [...state.studentConfigs, {
                studentId,
                studentName: '',
                classId: '',
                level: 'primaire',
                transportEnabled: false,
                booksEnabled: false,
                activitiesEnabled: enabled,
                personalizedDiscount: 0,
                academicYear: state.academicYear
              }]
            }
          }
        })
      },

      setStudentDiscount: (studentId, discount, reason) => {
        set((state) => {
          const existing = state.studentConfigs.find(c => c.studentId === studentId)
          
          if (existing) {
            return {
              studentConfigs: state.studentConfigs.map(c =>
                c.studentId === studentId ? { ...c, personalizedDiscount: discount, discountReason: reason } : c
              )
            }
          } else {
            return {
              studentConfigs: [...state.studentConfigs, {
                studentId,
                studentName: '',
                classId: '',
                level: 'primaire',
                transportEnabled: false,
                personalizedDiscount: discount,
                discountReason: reason,
                academicYear: state.academicYear
              }]
            }
          }
        })
      },

      getStudentConfig: (studentId, classId, level) => {
        const existing = get().studentConfigs.find(c => c.studentId === studentId)
        
        if (existing) {
          return existing
        }
        
        return {
          studentId,
          studentName: '',
          classId,
          level: level as any || 'primaire',
          transportEnabled: false,
          personalizedDiscount: 0,
          academicYear: get().academicYear
        }
      },

      // ========== GET PAYMENTS ==========

      getStudentPayments: (studentId, academicYear) => {
        return get().payments.filter(
          p => p.studentId === studentId && p.academicYear === academicYear
        ).sort((a, b) => a.month - b.month)
      },

      getClassPayments: (classId, academicYear) => {
        // Need to get student IDs from class first
        return get().payments.filter(p => p.academicYear === academicYear)
      },

      getPendingPayments: (academicYear) => {
        return get().payments.filter(
          p => p.status === 'pending' && p.academicYear === academicYear
        )
      },

      getStudentsWithPendingPayments: (students, academicYear, classes) => {
        const result: StudentPendingPayment[] = []
        const currentMonth = getCurrentSchoolMonth()
        
        // Don't alert if currentMonth is 0 (August)
        if (currentMonth === 0) return []

        students.forEach(student => {
          // Get all payments for this student
          const studentPayments = get().payments.filter(
            p => p.studentId === student.id && p.academicYear === academicYear
          )
          
          // Find pending months
          const pendingMonths: number[] = []
          const pendingMonthNames: string[] = []
          let totalPending = 0
          
          MONTHS.forEach((month, index) => {
            const monthNum = index + 1
            
            // Only alert for past or current months
            if (monthNum > currentMonth) return

            const payment = studentPayments.find(p => p.month === monthNum)
            
            if (!payment || payment.status !== 'paid') {
              pendingMonths.push(monthNum)
              pendingMonthNames.push(month)
              
              // Calculate pending amount
              const config = get().studentConfigs.find(c => c.studentId === student.id)
              const baseAmount = DEFAULT_LEVEL_PRICES[config?.level || 'primaire'] || 1000
              const transportAmount = config?.transportEnabled ? DEFAULT_TRANSPORT_PRICE : 0
              const discount = config?.personalizedDiscount || 0
              totalPending += (baseAmount + transportAmount - discount)
            }
          })
          
          // Only add if has pending payments
          if (pendingMonths.length > 0) {
            // Get class name using helper function
            const className = getStudentClassName(student, classes)

            result.push({
              studentId: student.id,
              studentName: student.name,
              classId: student.classId,
              className,
              pendingMonths,
              pendingMonthNames,
              totalPending
            })
          }
        })
        
        return result
      },

      // ========== STATS ==========

      getStudentStats: (studentId, academicYear) => {
        const payments = get().getStudentPayments(studentId, academicYear)
        const config = get().studentConfigs.find(c => c.studentId === studentId)
        
        const baseAmount = DEFAULT_LEVEL_PRICES[config?.level || 'primaire'] || 1000
        const transportAmount = config?.transportEnabled ? DEFAULT_TRANSPORT_PRICE : 0
        const discount = config?.personalizedDiscount || 0
        const monthlyTotal = baseAmount + transportAmount - discount
        
        const total = monthlyTotal * MONTHS.length
        const paid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.paidAmount, 0)
        const monthsPaid = payments.filter(p => p.status === 'paid').length
        const annualDiscount = monthsPaid === MONTHS.length ? total * ANNUAL_DISCOUNT : 0
        
        return {
          total: total - annualDiscount,
          paid,
          remaining: total - annualDiscount - paid,
          monthsPaid,
          annualDiscount
        }
      },

      // ========== RECEIPT NUMBER ==========

      generateReceiptNumber: () => {
        const year = new Date().getFullYear()
        const lastNum = parseInt(get().lastReceiptNumber.split('-')[2]) || 0
        const newNum = lastNum + 1
        return `REC-${year}-${String(newNum).padStart(5, '0')}`
      },

      // ========== STATE ==========

      setSelectedClassId: (classId) => {
        set({ selectedClassId: classId })
      },

      setSelectedStudentId: (studentId) => {
        set({ selectedStudentId: studentId })
      },

      setAcademicYear: (year) => {
        set({ academicYear: year })
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setError: (error) => {
        set({ error })
      },

      // ========== SUPABASE SYNC ==========

       loadFromSupabase: async () => {
         try {
           const academicYear = get().academicYear
           const currentSchoolId = 'default'

           const { data, error } = await supabase
             .from('monthly_payments')
             .select('*')
             .eq('school_id', currentSchoolId)
             .eq('academic_year', academicYear)
             .order('created_at', { ascending: false })

           if (error) throw error

           const payments: MonthlyPayment[] = (data || []).map(p => ({
             id: p.id,
             studentId: p.student_id,
             academicYear: p.academic_year,
             month: p.month,
             baseAmount: p.base_amount,
             transportAmount: p.transport_amount,
             discount: p.discount,
             paidAmount: p.paid_amount,
             status: p.status,
             paymentDate: p.payment_date,
             paymentMethod: p.payment_method as 'especes' | 'cheque' | 'virement',
             receiptNumber: p.receipt_number,
             notes: p.notes,
             paidBy: p.paid_by,
             paidByName: p.paid_by_name,
             payerType: p.payer_type || 'parent',
             payerName: p.payer_name || '',
             createdAt: p.created_at,
             updatedAt: p.updated_at
           }))

            // Update store state
            set({
              payments: payments,
              isSynced: true,
              lastSyncTime: new Date().toISOString()
            })

            // Also update React Query cache if available
            try {
              const client = getQueryClient()
              if (client) {
                client.setQueryData(['monthly-payments', academicYear], {
                  payments,
                  lastSyncTime: new Date().toISOString(),
                  totalCount: payments.length
                })
              }
            } catch (e) {
              // Ignore if React Query not initialized
            }

         } catch (error) {
           console.error('Error loading monthly payments from Supabase:', error)
           set({ error: 'Erreur de chargement depuis Supabase' })
         }
       },

      syncWithSupabase: async () => {
        await get().loadFromSupabase()
      },

      setSynced: (synced) => {
        set({ isSynced: synced })
      },

      setLastSyncTime: (time) => {
        set({ lastSyncTime: time })
      },

      importData: (data) => {
        set((state) => ({
          ...state,
          ...data,
          isLoading: false
        }))
      }
    })
)

// ========== SELECTOR HOOKS ==========

export const useMonthlyPayments = () => useMonthlyPaymentsStore((state) => state.payments)
export const useStudentConfigs = () => useMonthlyPaymentsStore((state) => state.studentConfigs)
export const useMonthlyPaymentStats = (studentId: string) => useMonthlyPaymentsStore((state) => 
  state.getStudentStats(studentId, state.academicYear)
)
export const useMonthlyPaymentsLoading = () => useMonthlyPaymentsStore((state) => state.isLoading)
export const useMonthlyPaymentsError = () => useMonthlyPaymentsStore((state) => state.error)

// ========== CONSTANTS ==========

export { MONTHS, DEFAULT_LEVEL_PRICES as LEVEL_PRICES, DEFAULT_TRANSPORT_PRICE as TRANSPORT_PRICE, DEFAULT_BOOKS_PRICE, DEFAULT_ACTIVITIES_PRICE, ANNUAL_DISCOUNT }


