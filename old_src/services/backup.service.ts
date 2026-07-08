// src/services/backup.service.ts - Cloud backup service (Supabase Version)

import { supabase } from '../lib/supabaseClient'
import type { SchoolData } from '../types'

export interface Backup {
  id: string
  name: string
  description: string
  createdAt: string
  createdBy: string
  createdByName: string
  size: number // in bytes
  version: string
  data: {
    teachers?: any[]
    classes?: any[]
    students?: any[]
    grades?: any[]
    attendance?: any[]
    homework?: any[]
    payments?: any[]
    library?: any[]
    gamification?: any[]
    sms?: any[]
    [key: string]: any
  }
  status: 'pending' | 'completed' | 'failed'
  errorMessage?: string
  isAutoBackup: boolean
  expiresAt?: string // Auto-delete after 30 days
}

export interface BackupSettings {
  autoBackupEnabled: boolean
  autoBackupFrequency: 'daily' | 'weekly' | 'monthly'
  autoBackupTime: string // HH:MM format
  retentionDays: number
  lastBackupAt?: string
  nextBackupAt?: string
}

export interface BackupProgress {
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  progress: number // 0-100
  currentStep: string
  message: string
}

class BackupService {
  private settings: BackupSettings = {
    autoBackupEnabled: true,
    autoBackupFrequency: 'weekly',
    autoBackupTime: '02:00',
    retentionDays: 30,
    lastBackupAt: undefined,
    nextBackupAt: undefined
  }

  constructor() {
    this.loadSettings()
  }

  /**
   * Create a new backup
   */
  async createBackup(
    data: Partial<SchoolData> & { [key: string]: any },
    name: string,
    description: string,
    createdBy: string,
    createdByName: string,
    isAutoBackup: boolean = false
  ): Promise<Backup> {
    const backup: Backup = {
      id: this.generateId(),
      name,
      description,
      createdAt: new Date().toISOString(),
      createdBy,
      createdByName,
      size: this.calculateDataSize(data),
      version: '1.0.0',
      data: {
        teachers: data.teachers || [],
        classes: data.classes || [],
        students: data.students || [],
        grades: data.grades || [],
        attendance: data.attendance || [],
        homework: data.homework || [],
        payments: data.payments || [],
        library: data.library || [],
        gamification: data.gamification || [],
        sms: data.sms || []
      },
      status: 'pending',
      isAutoBackup,
      expiresAt: isAutoBackup
        ? new Date(Date.now() + this.settings.retentionDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined
    }

    // Save to Supabase
    try {
      const { error } = await supabase
        .from('backups')
        .insert({
          id: backup.id,
          name: backup.name,
          description: backup.description,
          created_at: backup.createdAt,
          created_by: backup.createdBy,
          created_by_name: backup.createdByName,
          size: backup.size,
          version: backup.version,
          data: backup.data,
          status: backup.status,
          is_auto_backup: backup.isAutoBackup,
          expires_at: backup.expiresAt
        })

      if (error) {
        console.error('Error saving backup to Supabase:', error)
        backup.status = 'failed'
        backup.errorMessage = error.message
      }
    } catch (error) {
      console.error('Error saving backup to Supabase:', error)
      backup.status = 'failed'
      backup.errorMessage = error instanceof Error ? error.message : 'Unknown error'
    }

    // Update settings
    if (!isAutoBackup) {
      this.settings.lastBackupAt = backup.createdAt
      this.calculateNextBackup()
      this.saveSettings()
    }

    // Save to localStorage as fallback
    this.saveBackupToLocal(backup)

    return backup
  }

  /**
   * Create backup with progress tracking
   */
  async createBackupWithProgress(
    data: Partial<SchoolData> & { [key: string]: any },
    name: string,
    description: string,
    createdBy: string,
    createdByName: string,
    onProgress: (progress: BackupProgress) => void
  ): Promise<Backup> {
    const steps = [
      { name: 'Préparation', weight: 10 },
      { name: 'Sauvegarde des professeurs', weight: 15 },
      { name: 'Sauvegarde des classes', weight: 10 },
      { name: 'Sauvegarde des élèves', weight: 20 },
      { name: 'Sauvegarde des notes', weight: 15 },
      { name: 'Sauvegarde des devoirs', weight: 10 },
      { name: 'Sauvegarde des paiements', weight: 10 },
      { name: 'Finalisation', weight: 10 }
    ]

    let totalProgress = 0

    onProgress({
      status: 'pending',
      progress: 0,
      currentStep: steps[0].name,
      message: 'Préparation de la sauvegarde...'
    })

    // Simulate progress (in real app, track actual upload progress)
    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 300))
      totalProgress += step.weight
      onProgress({
        status: 'uploading',
        progress: Math.min(totalProgress, 99),
        currentStep: step.name,
        message: `${step.name}... ${totalProgress}%`
      })
    }

    const backup = await this.createBackup(data, name, description, createdBy, createdByName)

    onProgress({
      status: 'completed',
      progress: 100,
      currentStep: 'Terminé',
      message: 'Sauvegarde terminée avec succès!'
    })

    return backup
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupId: string): Promise<boolean> {
    // Get backup from Supabase
    try {
      const { data: backup, error } = await supabase
        .from('backups')
        .select('*')
        .eq('id', backupId)
        .single()

      if (error) {
        console.error('Error fetching backup from Supabase:', error)
      }

      if (backup) {
        this.restoreDataToLocal(backup.data)
        return true
      }

      // Fallback to localStorage
      const localBackup = this.getBackupFromLocal(backupId)
      if (localBackup) {
        this.restoreDataToLocal(localBackup.data)
        return true
      }

      return false
    } catch (error) {
      console.error('Error restoring backup:', error)
      return false
    }
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      // Delete from Supabase
      const { error } = await supabase
        .from('backups')
        .delete()
        .eq('id', backupId)

      if (error) {
        console.error('Error deleting backup from Supabase:', error)
      }

      // Remove from localStorage
      const backups = this.getBackupsFromLocal()
      const filtered = backups.filter(b => b.id !== backupId)
      localStorage.setItem('backups', JSON.stringify(filtered))

      return true
    } catch (error) {
      console.error('Error deleting backup:', error)
      return false
    }
  }

  /**
   * Get all backups
   */
  async getBackups(limitCount: number = 20): Promise<Backup[]> {
    try {
      const { data: backups, error } = await supabase
        .from('backups')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limitCount)

      if (error) {
        console.error('Error getting backups from Supabase:', error)
        return this.getBackupsFromLocal()
      }

      if (backups && backups.length > 0) {
        return backups.map(backup => ({
          id: backup.id,
          name: backup.name,
          description: backup.description,
          createdAt: backup.created_at,
          createdBy: backup.created_by,
          createdByName: backup.created_by_name,
          size: backup.size,
          version: backup.version,
          data: backup.data,
          status: backup.status,
          errorMessage: backup.error_message,
          isAutoBackup: backup.is_auto_backup,
          expiresAt: backup.expires_at
        }))
      }

      return this.getBackupsFromLocal()
    } catch (error) {
      console.error('Error getting backups:', error)
      return this.getBackupsFromLocal()
    }
  }

  /**
   * Get backup by ID
   */
  async getBackup(backupId: string): Promise<Backup | null> {
    try {
      const { data: backup, error } = await supabase
        .from('backups')
        .select('*')
        .eq('id', backupId)
        .single()

      if (error) {
        console.error('Error getting backup from Supabase:', error)
        return this.getBackupFromLocal(backupId) || null
      }

      if (backup) {
        return {
          id: backup.id,
          name: backup.name,
          description: backup.description,
          createdAt: backup.created_at,
          createdBy: backup.created_by,
          createdByName: backup.created_by_name,
          size: backup.size,
          version: backup.version,
          data: backup.data,
          status: backup.status,
          errorMessage: backup.error_message,
          isAutoBackup: backup.is_auto_backup,
          expiresAt: backup.expires_at
        }
      }

      return this.getBackupFromLocal(backupId) || null
    } catch (error) {
      console.error('Error getting backup:', error)
      return this.getBackupFromLocal(backupId)
    }
  }

  /**
   * Update backup settings
   */
  updateSettings(settings: Partial<BackupSettings>): void {
    this.settings = {
      ...this.settings,
      ...settings
    }
    this.calculateNextBackup()
    this.saveSettings()
  }

  /**
   * Get current settings
   */
  getSettings(): BackupSettings {
    return { ...this.settings }
  }

  /**
   * Check if auto backup is due
   */
  isAutoBackupDue(): boolean {
    if (!this.settings.autoBackupEnabled) return false
    
    const now = new Date()
    const nextBackup = this.settings.nextBackupAt ? new Date(this.settings.nextBackupAt) : null
    
    if (!nextBackup) return true
    
    return now >= nextBackup
  }

  /**
   * Run auto backup
   */
  async runAutoBackup(
    data: Partial<SchoolData> & { [key: string]: any },
    createdBy: string,
    createdByName: string
  ): Promise<Backup | null> {
    if (!this.isAutoBackupDue()) return null

    const date = new Date().toLocaleDateString('fr-FR')
    const name = `Sauvegarde automatique - ${date}`
    
    try {
      const backup = await this.createBackup(
        data,
        name,
        'Sauvegarde automatique',
        createdBy,
        createdByName,
        true
      )
      
      return backup
    } catch (error) {
      console.error('Auto backup failed:', error)
      return null
    }
  }

  /**
   * Export backup to file
   */
  exportBackupToFile(backup: Backup): void {
    const blob = new Blob([JSON.stringify(backup.data, null, 2)], { 
      type: 'application/json' 
    })
    
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `backup_${backup.name.replace(/\s+/g, '_')}_${backup.createdAt.split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /**
   * Import backup from file
   */
  importBackupFromFile(file: File): Promise<Backup> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target?.result as string)
          const backup = await this.createBackup(
            data,
            `Import - ${new Date().toLocaleDateString('fr-FR')}`,
            'Importation depuis fichier',
            'system',
            'Système',
            false
          )
          resolve(backup)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  /**
   * Clean old backups
   */
  async cleanOldBackups(): Promise<number> {
    const now = new Date()
    const backups = await this.getBackups(100)
    let deletedCount = 0

    for (const backup of backups) {
      const backupDate = new Date(backup.createdAt)
      const ageInDays = (now.getTime() - backupDate.getTime()) / (1000 * 60 * 60 * 24)
      
      if (ageInDays > this.settings.retentionDays || 
          (backup.expiresAt && new Date(backup.expiresAt) < now)) {
        await this.deleteBackup(backup.id)
        deletedCount++
      }
    }

    return deletedCount
  }

  /**
   * Calculate data size
   */
  private calculateDataSize(data: any): number {
    return new Blob([JSON.stringify(data)]).size
  }

  /**
   * Calculate next backup date
   */
  private calculateNextBackup(): void {
    if (!this.settings.autoBackupEnabled) {
      this.settings.nextBackupAt = undefined
      return
    }

    const now = new Date()
    const [hours, minutes] = this.settings.autoBackupTime.split(':').map(Number)
    
    const nextBackup = new Date(now)
    nextBackup.setHours(hours, minutes, 0, 0)

    // If time already passed today, schedule for next period
    if (nextBackup <= now) {
      switch (this.settings.autoBackupFrequency) {
        case 'daily':
          nextBackup.setDate(nextBackup.getDate() + 1)
          break
        case 'weekly':
          nextBackup.setDate(nextBackup.getDate() + 7)
          break
        case 'monthly':
          nextBackup.setMonth(nextBackup.getMonth() + 1)
          break
      }
    }

    this.settings.nextBackupAt = nextBackup.toISOString()
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    localStorage.setItem('backup_settings', JSON.stringify(this.settings))
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): void {
    const saved = localStorage.getItem('backup_settings')
    if (saved) {
      this.settings = JSON.parse(saved)
      this.calculateNextBackup()
    }
  }

  /**
   * Save backup to localStorage (fallback)
   */
  private saveBackupToLocal(backup: Backup): void {
    const backups = this.getBackupsFromLocal()
    backups.unshift(backup)
    localStorage.setItem('backups', JSON.stringify(backups.slice(0, 20)))
  }

  /**
   * Get backups from localStorage
   */
  private getBackupsFromLocal(): Backup[] {
    const saved = localStorage.getItem('backups')
    return saved ? JSON.parse(saved) : []
  }

  /**
   * Get backup from localStorage
   */
  private getBackupFromLocal(backupId: string): Backup | undefined {
    const backups = this.getBackupsFromLocal()
    return backups.find(b => b.id === backupId)
  }

  /**
   * Restore data to localStorage
   */
  private restoreDataToLocal(data: any): void {
    if (data.teachers) localStorage.setItem('teachers', JSON.stringify(data.teachers))
    if (data.classes) localStorage.setItem('classes', JSON.stringify(data.classes))
    if (data.students) localStorage.setItem('students', JSON.stringify(data.students))
    if (data.grades) localStorage.setItem('grades', JSON.stringify(data.grades))
    // Add more as needed
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export singleton instance
export const backupService = new BackupService()

// Export factory function
export const createBackupService = (): BackupService => new BackupService()

export default backupService

