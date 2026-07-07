// src/store/teachersStore.ts - Teachers store (split from main school store)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Teacher } from '../types'

interface TeachersState {
  teachers: Teacher[]
  selectedTeacherId: string | null
  isLoading: boolean
  error: string | null
}

interface TeachersActions {
  addTeacher: (teacher: Omit<Teacher, 'id'>) => void
  updateTeacher: (id: string, teacher: Partial<Teacher>) => void
  deleteTeacher: (id: string) => void
  getTeacher: (id: string) => Teacher | undefined
  setSelectedTeacher: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

export type TeachersStore = TeachersState & TeachersActions

const initialState: TeachersState = {
  teachers: [],
  selectedTeacherId: null,
  isLoading: false,
  error: null
}

export const useTeachersStore = create<TeachersStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addTeacher: (teacher) => {
        const newTeacher: Teacher = { ...teacher, id: generateId() }
        set((state) => ({
          teachers: [...state.teachers, newTeacher],
          error: null
        }))
      },

      updateTeacher: (id, teacher) => {
        set((state) => ({
          teachers: state.teachers.map(t => t.id === id ? { ...t, ...teacher } : t),
          error: null
        }))
      },

      deleteTeacher: (id) => {
        set((state) => ({
          teachers: state.teachers.filter(t => t.id !== id),
          error: null
        }))
      },

      getTeacher: (id) => {
        return get().teachers.find(t => t.id === id)
      },

      setSelectedTeacher: (id) => {
        set({ selectedTeacherId: id })
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setError: (error) => {
        set({ error })
      },

      clearError: () => {
        set({ error: null })
      }
    }),
    {
      name: 'teachers-store',
      partialize: (state) => ({
        teachers: state.teachers
      })
    }
  )
)

// Helper function to generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Selector hooks for better performance
export const useTeachers = () => useTeachersStore((state) => state.teachers)
export const useSelectedTeacher = () => {
  const selectedTeacherId = useTeachersStore((state) => state.selectedTeacherId)
  const getTeacher = useTeachersStore((state) => state.getTeacher)
  return selectedTeacherId ? getTeacher(selectedTeacherId) : null
}
export const useTeachersLoading = () => useTeachersStore((state) => state.isLoading)
export const useTeachersError = () => useTeachersStore((state) => state.error)


