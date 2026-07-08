import { supabase } from "@/lib/supabase"
import { Book } from "../schemas"

export const getBooks = async (): Promise<Book[]> => {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

export const createBook = async (book: Book): Promise<Book> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...newBook } = book;
  const { data, error } = await supabase
    .from('books')
    .insert([newBook])
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const updateBook = async (book: Book): Promise<Book> => {
  const { id, ...updates } = book;
  const { data, error } = await supabase
    .from('books')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export const deleteBook = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('books')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}
