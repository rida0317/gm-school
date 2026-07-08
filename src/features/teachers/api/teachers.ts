import { supabase } from "@/lib/supabase"
import { Teacher } from "../schemas"

export const getTeachers = async (): Promise<Teacher[]> => {
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

export const createTeacher = async (teacher: Teacher): Promise<Teacher> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...newTeacher } = teacher;
  const { data, error } = await supabase
    .from('teachers')
    .insert([newTeacher])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const updateTeacher = async (teacher: Teacher): Promise<Teacher> => {
  const { id, ...updates } = teacher;
  const { data, error } = await supabase
    .from('teachers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const deleteTeacher = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('teachers')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
