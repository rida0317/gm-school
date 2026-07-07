// src/store/homeworkStore.ts - Zustand store for homework management

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import homeworkService, { type Homework, type HomeworkStats, type HomeworkSubmission } from '../services/homework.service'
import type { Student } from '../types'

interface HomeworkState {
  homework: Homework[]
  submissions: HomeworkSubmission[]
  stats: HomeworkStats | null
  selectedClassId: string | null
  isLoading: boolean
  error: string | null
}

interface HomeworkActions {
  // CRUD
  createHomework: (homework: Omit<Homework, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<Homework>
  updateHomework: (homeworkId: string, updates: Partial<Homework>) => Promise<Homework | null>
  deleteHomework: (homeworkId: string) => Promise<boolean>
  
  // Filters
  getHomeworkByClass: (classId: string) => Homework[]
  getHomeworkByStudent: (student: Student) => Homework[]
  getUpcomingHomework: (days?: number) => Homework[]
  getOverdueHomework: () => Homework[]
  
  // Actions
  markAsCompleted: (homeworkId: string) => Promise<Homework | null>
  setSelectedClassId: (classId: string | null) => void
  
  // Stats
  refreshStats: () => void
  
  // State
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  subscribeToHomework: (classId?: string) => void
}

export type HomeworkStore = HomeworkState & HomeworkActions

const initialState: HomeworkState = {
  homework: [],
  submissions: [],
  stats: null,
  selectedClassId: null,
  isLoading: false,
  error: null
}

export const useHomeworkStore = create<HomeworkStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ========== CRUD ==========

      createHomework: async (homework) => {
        set({ isLoading: true, error: null })
        try {
          const newHomework = await homeworkService.createHomework(homework)
          set((state) => ({
            homework: [newHomework, ...state.homework],
            isLoading: false
          }))
          get().refreshStats()
          return newHomework
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create homework',
            isLoading: false
          })
          throw error
        }
      },

      updateHomework: async (homeworkId, updates) => {
        set({ isLoading: true, error: null })
        try {
          const updatedHomework = await homeworkService.updateHomework(homeworkId, updates)
          if (updatedHomework) {
            set((state) => ({
              homework: state.homework.map(h => h.id === homeworkId ? updatedHomework : h),
              isLoading: false
            }))
            get().refreshStats()
          }
          return updatedHomework
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update homework',
            isLoading: false
          })
          throw error
        }
      },

      deleteHomework: async (homeworkId) => {
        set({ isLoading: true, error: null })
        try {
          const success = await homeworkService.deleteHomework(homeworkId)
          if (success) {
            set((state) => ({
              homework: state.homework.filter(h => h.id !== homeworkId),
              isLoading: false
            }))
            get().refreshStats()
          }
          return success
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete homework',
            isLoading: false
          })
          throw error
        }
      },

      // ========== FILTERS ==========

      getHomeworkByClass: (classId) => {
        return homeworkService.getHomeworkByClass(classId)
      },

      getHomeworkByStudent: (student) => {
        return homeworkService.getHomeworkByStudent(student)
      },

      getUpcomingHomework: (days = 7) => {
        return homeworkService.getUpcomingHomework(days)
      },

      getOverdueHomework: () => {
        return homeworkService.getOverdueHomework()
      },

      // ========== ACTIONS ==========

      markAsCompleted: async (homeworkId) => {
        return await homeworkService.markAsCompleted(homeworkId)
      },

      setSelectedClassId: (classId) => {
        set({ selectedClassId: classId })
      },

      // ========== STATS ==========

      refreshStats: () => {
        const stats = homeworkService.getStats()
        set({ stats })
      },

      // ========== STATE ==========

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setError: (error) => {
        set({ error })
      },

      subscribeToHomework: (classId) => {
        // Supabase subscription is handled in the service
        get().refreshStats()
        return () => {} // No-op, Supabase handles realtime
      }
    }),
    {
      name: 'homework', // Use same key as service to avoid dual persistence
      partialize: (state) => ({
        homework: state.homework,
        selectedClassId: state.selectedClassId
      }),
      merge: (persistedState: any) => {
        // When loading from localStorage, also sync with service
        const serviceHomework = homeworkService.getHomeworkByClass(persistedState.selectedClassId || '')
        return {
          ...initialState,
          ...persistedState,
          homework: serviceHomework.length > 0 ? serviceHomework : persistedState.homework
        }
      }
    }
  )
)

// ========== SELECTOR HOOKS ==========

export const useHomework = () => useHomeworkStore((state) => state.homework)
export const useHomeworkStats = () => useHomeworkStore((state) => state.stats)
export const useSelectedHomeworkClass = () => useHomeworkStore((state) => state.selectedClassId)
export const useHomeworkLoading = () => useHomeworkStore((state) => state.isLoading)
export const useHomeworkError = () => useHomeworkStore((state) => state.error)

// ========== UTILITY FUNCTIONS ==========

export const createHomework = async (homework: Omit<Homework, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Homework> => {
  const { createHomework: create } = useHomeworkStore.getState()
  return create(homework)
}

export const updateHomework = async (homeworkId: string, updates: Partial<Homework>): Promise<Homework | null> => {
  const { updateHomework: update } = useHomeworkStore.getState()
  return update(homeworkId, updates)
}

export const deleteHomework = async (homeworkId: string): Promise<boolean> => {
  const { deleteHomework: del } = useHomeworkStore.getState()
  return del(homeworkId)
}


