// src/store/backupStore.ts - Zustand store for cloud backup

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import backupService, { type Backup, type BackupSettings, type BackupProgress } from '../services/backup.service'
import type { SchoolData } from '../types'

interface BackupState {
  // Data
  backups: Backup[]
  settings: BackupSettings
  currentBackup: Backup | null
  
  // UI State
  isCreating: boolean
  isRestoring: boolean
  progress: BackupProgress | null
  error: string | null
}

interface BackupActions {
  // Backup operations
  createBackup: (
    data: Partial<SchoolData> & { [key: string]: any },
    name: string,
    description: string,
    createdBy: string,
    createdByName: string
  ) => Promise<Backup>
  
  createBackupWithProgress: (
    data: Partial<SchoolData> & { [key: string]: any },
    name: string,
    description: string,
    createdBy: string,
    createdByName: string,
    onProgress?: (progress: BackupProgress) => void
  ) => Promise<Backup>
  
  restoreBackup: (backupId: string) => Promise<boolean>
  deleteBackup: (backupId: string) => Promise<boolean>
  
  // Settings
  updateSettings: (settings: Partial<BackupSettings>) => void
  
  // Export/Import
  exportBackupToFile: (backup: Backup) => void
  importBackupFromFile: (file: File) => Promise<Backup>
  
  // State
  refreshBackups: () => Promise<void>
  checkAutoBackup: (
    data: Partial<SchoolData> & { [key: string]: any },
    createdBy: string,
    createdByName: string
  ) => Promise<void>
  cleanOldBackups: () => Promise<number>
}

export type BackupStore = BackupState & BackupActions

const initialState: BackupState = {
  backups: [],
  settings: {
    autoBackupEnabled: true,
    autoBackupFrequency: 'weekly',
    autoBackupTime: '02:00',
    retentionDays: 30
  },
  currentBackup: null,
  isCreating: false,
  isRestoring: false,
  progress: null,
  error: null
}

export const useBackupStore = create<BackupStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ========== BACKUP OPERATIONS ==========

      createBackup: async (data, name, description, createdBy, createdByName) => {
        set({ isCreating: true, error: null })
        try {
          const backup = await backupService.createBackup(
            data,
            name,
            description,
            createdBy,
            createdByName
          )
          set((state) => ({
            backups: [backup, ...state.backups],
            currentBackup: backup,
            isCreating: false
          }))
          return backup
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create backup',
            isCreating: false
          })
          throw error
        }
      },

      createBackupWithProgress: async (data, name, description, createdBy, createdByName, onProgress) => {
        set({ isCreating: true, error: null })
        
        const progressCallback = (progress: BackupProgress) => {
          set({ progress })
          onProgress?.(progress)
        }
        
        try {
          const backup = await backupService.createBackupWithProgress(
            data,
            name,
            description,
            createdBy,
            createdByName,
            progressCallback
          )
          set((state) => ({
            backups: [backup, ...state.backups],
            currentBackup: backup,
            isCreating: false,
            progress: null
          }))
          return backup
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create backup',
            isCreating: false,
            progress: null
          })
          throw error
        }
      },

      restoreBackup: async (backupId) => {
        set({ isRestoring: true, error: null })
        try {
          const success = await backupService.restoreBackup(backupId)
          set({ isRestoring: false })
          return success
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to restore backup',
            isRestoring: false
          })
          throw error
        }
      },

      deleteBackup: async (backupId) => {
        set({ error: null })
        try {
          const success = await backupService.deleteBackup(backupId)
          if (success) {
            set((state) => ({
              backups: state.backups.filter(b => b.id !== backupId)
            }))
          }
          return success
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete backup'
          })
          throw error
        }
      },

      // ========== SETTINGS ==========

      updateSettings: (settings) => {
        backupService.updateSettings(settings)
        set((state) => ({
          settings: {
            ...state.settings,
            ...settings
          }
        }))
      },

      // ========== EXPORT/IMPORT ==========

      exportBackupToFile: (backup) => {
        backupService.exportBackupToFile(backup)
      },

      importBackupFromFile: async (file) => {
        set({ isCreating: true, error: null })
        try {
          const backup = await backupService.importBackupFromFile(file)
          set((state) => ({
            backups: [backup, ...state.backups],
            isCreating: false
          }))
          return backup
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to import backup',
            isCreating: false
          })
          throw error
        }
      },

      // ========== STATE ==========

      refreshBackups: async () => {
        const backups = await backupService.getBackups()
        set({ backups })
      },

      checkAutoBackup: async (data, createdBy, createdByName) => {
        if (backupService.isAutoBackupDue()) {
          await backupService.runAutoBackup(data, createdBy, createdByName)
          get().refreshBackups()
        }
      },

      cleanOldBackups: async () => {
        const deletedCount = await backupService.cleanOldBackups()
        if (deletedCount > 0) {
          get().refreshBackups()
        }
        return deletedCount
      }
    }),
    {
      name: 'backup-store',
      partialize: (state) => ({
        settings: state.settings,
        backups: state.backups.slice(0, 10)
      })
    }
  )
)

// ========== SELECTOR HOOKS ==========

export const useBackups = () => useBackupStore((state) => state.backups)
export const useBackupSettings = () => useBackupStore((state) => state.settings)
export const useCurrentBackup = () => useBackupStore((state) => state.currentBackup)
export const useBackupProgress = () => useBackupStore((state) => state.progress)
export const useBackupCreating = () => useBackupStore((state) => state.isCreating)
export const useBackupRestoring = () => useBackupStore((state) => state.isRestoring)
export const useBackupError = () => useBackupStore((state) => state.error)

// ========== UTILITY FUNCTIONS ==========

export const createBackup = async (
  data: Partial<SchoolData> & { [key: string]: any },
  name: string,
  description: string,
  createdBy: string,
  createdByName: string
): Promise<Backup> => {
  const { createBackup: create } = useBackupStore.getState()
  return create(data, name, description, createdBy, createdByName)
}

export const restoreBackup = async (backupId: string): Promise<boolean> => {
  const { restoreBackup: restore } = useBackupStore.getState()
  return restore(backupId)
}

export const deleteBackup = async (backupId: string): Promise<boolean> => {
  const { deleteBackup: del } = useBackupStore.getState()
  return del(backupId)
}

export const updateBackupSettings = (settings: Partial<BackupSettings>): void => {
  const { updateSettings: update } = useBackupStore.getState()
  update(settings)
}

