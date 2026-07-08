// src/store/classesStore.ts - Classes store (split from main school store)

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SchoolClass } from '../types'

interface ClassesState {
  classes: SchoolClass[]
  selectedClassId: string | null
  isLoading: boolean
  error: string | null
}

interface ClassesActions {
  addClass: (schoolClass: Omit<SchoolClass, 'id'>) => void
  updateClass: (id: string, schoolClass: Partial<SchoolClass>) => void
  deleteClass: (id: string) => void
  getClass: (id: string) => SchoolClass | undefined
  setSelectedClass: (id: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

export type ClassesStore = ClassesState & ClassesActions

const initialState: ClassesState = {
  classes: [],
  selectedClassId: null,
  isLoading: false,
  error: null
}

export const useClassesStore = create<ClassesStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addClass: (schoolClass) => {
        const newClass: SchoolClass = { ...schoolClass, id: generateId() }
        set((state) => ({
          classes: [...state.classes, newClass],
          error: null
        }))
      },

      updateClass: (id, schoolClass) => {
        set((state) => ({
          classes: state.classes.map(c => c.id === id ? { ...c, ...schoolClass } : c),
          error: null
        }))
      },

      deleteClass: (id) => {
        set((state) => ({
          classes: state.classes.filter(c => c.id !== id),
          error: null
        }))
      },

      getClass: (id) => {
        return get().classes.find(c => c.id === id)
      },

      setSelectedClass: (id) => {
        set({ selectedClassId: id })
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
      name: 'classes-store',
      partialize: (state) => ({
        classes: state.classes
      })
    }
  )
)

// Helper function to generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Selector hooks for better performance
export const useClasses = () => useClassesStore((state) => state.classes)
export const useSelectedClass = () => {
  const selectedClassId = useClassesStore((state) => state.selectedClassId)
  const getClass = useClassesStore((state) => state.getClass)
  return selectedClassId ? getClass(selectedClassId) : null
}
export const useClassesLoading = () => useClassesStore((state) => state.isLoading)
export const useClassesError = () => useClassesStore((state) => state.error)


