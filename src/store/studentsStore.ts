// src/store/studentsStore.ts - Students store with Supabase support

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Student } from '../types'
import { useSchoolStore } from './schoolStore'

import { supabase } from '../lib/supabaseClient'

interface StudentsState {
  students: Student[]
  selectedStudentId: string | null
  isLoading: boolean
  error: string | null
}

interface StudentsActions {
  fetchStudents: () => Promise<void>
  addStudent: (student: Omit<Student, 'id' | 'academicYear'>) => Promise<void>
  updateStudent: (id: string, student: Partial<Student>) => Promise<void>
  deleteStudent: (id: string) => Promise<void>
  getStudent: (id: string) => Student | undefined
  getStudentsByClass: (classId: string) => Student[]
  getStudentsBySchool: (schoolId?: string) => Student[]
  setSelectedStudent: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  clearAllStudents: () => void
  syncWithSupabase: () => Promise<void>
}

export type StudentsStore = StudentsState & StudentsActions

const initialState: StudentsState = {
  students: [],
  selectedStudentId: null,
  isLoading: false,
  error: null
}

export const useStudentsStore = create<StudentsStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      fetchStudents: async () => {
        const currentSchoolId = 'default'
        if (!currentSchoolId) return

        set({ isLoading: true, error: null })
        try {
          const { data, error } = await supabase
            .from('students')
            .select('*')
            .eq('school_id', currentSchoolId)

          if (error) throw error

          const mappedStudents: Student[] = data.map(s => ({
            id: s.id,
            name: s.full_name || s.name,
            classId: s.class_id,
            academicYear: s.academic_year,
            codeMassar: s.code_massar,
            gender: s.gender,
            parentName: s.parent_name,
            dateOfBirth: s.date_of_birth,
            phone: s.phone,
            address: s.address,
            schoolId: s.school_id
          }))

          set({ students: mappedStudents, isLoading: false })
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
        }
      },

      addStudent: async (student) => {
        const academicYear = useSchoolStore.getState().academicYear
        const currentSchoolId = 'default'
        if (!currentSchoolId) throw new Error('No school selected')

        set({ isLoading: true })
        try {
          const { data, error } = await supabase
            .from('students')
            .insert([{
              name: student.name,
              school_id: currentSchoolId,
              class_id: student.classId,
              academic_year: academicYear,
              code_massar: student.codeMassar,
              gender: student.gender,
              parent_name: student.parentName,
              date_of_birth: student.dateOfBirth,
              phone: student.phone,
              address: student.address
            }])
            .select()
            .single()

          if (error) throw error

          const newStudent: Student = {
            ...student,
            id: data.id,
            academicYear,
            schoolId: currentSchoolId
          }

          set((state) => ({
            students: [...state.students, newStudent],
            isLoading: false,
            error: null
          }))
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
        }
      },

      updateStudent: async (id, studentUpdates) => {
        set({ isLoading: true })
        try {
          const { error } = await supabase
            .from('students')
            .update({
              name: studentUpdates.name,
              class_id: studentUpdates.classId,
              code_massar: studentUpdates.codeMassar,
              gender: studentUpdates.gender,
              parent_name: studentUpdates.parentName,
              date_of_birth: studentUpdates.dateOfBirth,
              phone: studentUpdates.phone,
              address: studentUpdates.address
            })
            .eq('id', id)

          if (error) throw error

          set((state) => ({
            students: state.students.map(s => s.id === id ? { ...s, ...studentUpdates } : s),
            isLoading: false,
            error: null
          }))
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
        }
      },

      deleteStudent: async (id) => {
        set({ isLoading: true })
        try {
          const { error } = await supabase
            .from('students')
            .delete()
            .eq('id', id)

          if (error) throw error

          set((state) => ({
            students: state.students.filter(s => s.id !== id),
            isLoading: false,
            error: null
          }))
        } catch (error: any) {
          set({ error: error.message, isLoading: false })
        }
      },

      getStudent: (id) => {
        return get().students.find(s => s.id === id)
      },

      getStudentsByClass: (classId) => {
        return get().students.filter(s => s.classId === classId)
      },

      getStudentsBySchool: (schoolId) => {
        const currentSchoolId = schoolId || 'default'
        if (!currentSchoolId) return []
        return get().students.filter(s => s.schoolId === currentSchoolId)
      },

      setSelectedStudent: (id) => {
        set({ selectedStudentId: id })
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setError: (error) => {
        set({ error })
      },

      clearError: () => {
        set({ error: null })
      },

      clearAllStudents: () => {
        set({ students: [] })
      },

      syncWithSupabase: async () => {
        await get().fetchStudents()
      }
    }),
    {
      name: 'students-store',
      partialize: (state) => ({
        students: state.students
      })
    }
  )
)

// Selector hooks for better performance
export const useStudents = () => {
  // Read from schoolStore since fetchAllData populates it
  const allStudents = useSchoolStore((state) => state.students)
  // Show all students regardless of academic year
  return allStudents
}
export const useSelectedStudent = () => {
  const selectedStudentId = useStudentsStore((state) => state.selectedStudentId)
  const getStudent = useStudentsStore((state) => state.getStudent)
  return selectedStudentId ? getStudent(selectedStudentId) : null
}
export const useStudentsByClass = (classId: string) => {
  const getStudentsByClass = useStudentsStore((state) => state.getStudentsByClass)
  return getStudentsByClass(classId)
}
export const useStudentsLoading = () => useStudentsStore((state) => state.isLoading)
export const useStudentsError = () => useStudentsStore((state) => state.error)


