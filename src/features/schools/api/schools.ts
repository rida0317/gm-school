import { supabase } from "@/lib/supabase"
import { School } from "../schemas"

export const getSchools = async (): Promise<School[]> => {
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

export const createSchool = async (school: School): Promise<School> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...newSchool } = school;
  const { data, error } = await supabase
    .from('schools')
    .insert([newSchool])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const updateSchool = async (school: School): Promise<School> => {
  const { id, ...updates } = school;
  const { data, error } = await supabase
    .from('schools')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const deleteSchool = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('schools')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
