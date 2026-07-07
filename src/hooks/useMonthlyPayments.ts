// src/hooks/useMonthlyPayments.ts - React Query hook for monthly payments with caching

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import type { MonthlyPayment } from '../store/monthlyPaymentsStore'

const PAYMENTS_QUERY_KEY = 'monthly-payments'

export interface MonthlyPaymentsData {
  payments: MonthlyPayment[]
  lastSyncTime: string
  totalCount: number
}

// Fetch payments from Supabase with academic year filter
const fetchMonthlyPayments = async (academicYear: string): Promise<MonthlyPaymentsData> => {
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
    payerType: p.payer_type as 'parent' | 'student' | 'other',
    payerName: p.payer_name,
    createdAt: p.created_at,
    updatedAt: p.updated_at
  }))

  return {
    payments,
    lastSyncTime: new Date().toISOString(),
    totalCount: payments.length
  }
}

// Hook for fetching monthly payments with intelligent caching
export const useMonthlyPayments = (academicYear: string) => {
  return useQuery<MonthlyPaymentsData, Error>({
    queryKey: [PAYMENTS_QUERY_KEY, academicYear],
    queryFn: () => fetchMonthlyPayments(academicYear),
    staleTime: 2 * 60 * 1000, // 2 minutes - data considered fresh
    cacheTime: 10 * 60 * 1000, // 10 minutes - keep in cache after unmount
    gcTime: 10 * 60 * 1000, // Garbage collection time (new React Query name)
    retry: 1, // Retry failed requests once
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Refetch when reconnecting
    enabled: !!academicYear, // Only fetch if academicYear is provided
  })
}

// Hook for fetching payments with suspense (for lazy loading)
export const useMonthlyPaymentsSuspense = (academicYear: string) => {
  return useQuery<MonthlyPaymentsData, Error>({
    queryKey: [PAYMENTS_QUERY_KEY, academicYear],
    queryFn: () => fetchMonthlyPayments(academicYear),
    staleTime: 2 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    suspense: true, // Enable suspense for automatic loading states
    enabled: !!academicYear,
  })
}

// Invalidate payments cache (call after mutations)
export const invalidatePaymentsCache = () => {
  // This will be called from stores after mutations
  // The query client will be available via context
  window.location.reload() // Fallback - better to use queryClient.invalidateQueries
}

// Helper to calculate monthly payment stats
export const calculateMonthlyStats = (payments: MonthlyPayment[], month: number, year: number) => {
  const monthlyPayments = payments.filter(p => {
    if (!p.paymentDate) return false
    const date = new Date(p.paymentDate)
    return date.getMonth() === month && date.getFullYear() === year
  })

  const totalAmount = monthlyPayments.reduce((sum, p) => sum + p.paidAmount, 0)
  const paymentCount = monthlyPayments.length

  return {
    totalAmount,
    paymentCount,
    monthlyPayments
  }
}

// Helper to get last N payments sorted by date
export const getLastPayments = (payments: MonthlyPayment[], count: number = 5) => {
  return [...payments]
    .filter(p => p && p.paymentDate)
    .sort((a, b) => new Date(b.paymentDate!).getTime() - new Date(a.paymentDate!).getTime())
    .slice(0, count)
}
