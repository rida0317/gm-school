import { supabase } from "@/lib/supabase"
import { Class } from "../schemas"

export const getClasses = async (): Promise<Class[]> => {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

export const createClass = async (cls: Class): Promise<Class> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...newClass } = cls;
  const { data, error } = await supabase
    .from('classes')
    .insert([newClass])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const updateClass = async (cls: Class): Promise<Class> => {
  const { id, ...updates } = cls;
  const { data, error } = await supabase
    .from('classes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const deleteClass = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
