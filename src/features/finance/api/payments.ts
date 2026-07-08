import { supabase } from "@/lib/supabase"
import { Payment } from "../schemas"

export const getPayments = async (): Promise<Payment[]> => {
  const { data, error } = await supabase
    .from('monthly_payments')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

export const createPayment = async (payment: Payment): Promise<Payment> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...newPayment } = payment;
  const { data, error } = await supabase
    .from('monthly_payments')
    .insert([newPayment])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const updatePayment = async (payment: Payment): Promise<Payment> => {
  const { id, ...updates } = payment;
  const { data, error } = await supabase
    .from('monthly_payments')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const deletePayment = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('monthly_payments')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
