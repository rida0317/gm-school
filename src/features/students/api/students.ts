import { supabase } from "@/lib/supabase"
import { Student } from "../schemas"

export const getStudents = async (): Promise<Student[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

export const createStudent = async (student: Student): Promise<Student> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...newStudent } = student;
  const { data, error } = await supabase
    .from('students')
    .insert([newStudent])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const updateStudent = async (student: Student): Promise<Student> => {
  const { id, ...updates } = student;
  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const deleteStudent = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
