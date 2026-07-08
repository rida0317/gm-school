import { supabase } from "@/lib/supabase"
import { Grade } from "../schemas"

export const getGrades = async (): Promise<Grade[]> => {
  const { data, error } = await supabase
    .from('grades')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

export const createGrade = async (grade: Grade): Promise<Grade> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...newGrade } = grade;
  const { data, error } = await supabase
    .from('grades')
    .insert([newGrade])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const updateGrade = async (grade: Grade): Promise<Grade> => {
  const { id, ...updates } = grade;
  const { data, error } = await supabase
    .from('grades')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const deleteGrade = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('grades')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
