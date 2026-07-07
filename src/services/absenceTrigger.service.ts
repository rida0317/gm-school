/**
 * Absence Trigger Service
 * Automatically sends WhatsApp notifications when students are marked absent
 */

import { whatsappService } from './whatsapp.service'
import type { Student } from '../types'

export interface AbsenceRecord {
  id: string
  studentId: string
  studentName: string
  classId: string
  className: string
  date: string
  reason: string
  justified: boolean
  justificationDocument?: string
  createdAt: string
  createdBy: string // Teacher ID
  notificationSent: boolean
  notificationSentAt?: string
}

export interface AbsenceTriggerConfig {
  enabled: boolean
  sendOnMark: boolean // Send immediately when absence is marked
  sendOnJustify: boolean // Send when absence is justified
  language: 'fr' | 'ar'
  schoolName: string
  delayMinutes: number // Delay before sending (0 = immediate)
}

class AbsenceTriggerService {
  private config: AbsenceTriggerConfig
  private pendingNotifications: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    this.config = this.loadConfig()
  }

  /**
   * Load trigger configuration
   */
  private loadConfig(): AbsenceTriggerConfig {
    const saved = localStorage.getItem('absence_trigger_config')
    if (saved) {
      return JSON.parse(saved)
    }

    return {
      enabled: true,
      sendOnMark: true,
      sendOnJustify: false,
      language: 'fr',
      schoolName: 'École',
      delayMinutes: 0
    }
  }

  /**
   * Save trigger configuration
   */
  private saveConfig(): void {
    localStorage.setItem('absence_trigger_config', JSON.stringify(this.config))
  }

  /**
   * Mark student absent and trigger notification
   */
  async markAbsent(
    student: Student,
    date: string,
    reason: string,
    classId: string,
    className: string,
    teacherId: string
  ): Promise<AbsenceRecord> {
    const absence: AbsenceRecord = {
      id: this.generateId(),
      studentId: student.id,
      studentName: student.name,
      classId,
      className,
      date,
      reason,
      justified: false,
      createdAt: new Date().toISOString(),
      createdBy: teacherId,
      notificationSent: false
    }

    // Save absence to storage
    this.saveAbsence(absence)

    // Trigger WhatsApp notification if enabled
    if (this.config.enabled && this.config.sendOnMark) {
      await this.triggerNotification(absence, student)
    }

    return absence
  }

  /**
   * Trigger WhatsApp notification for absence
   */
  private async triggerNotification(
    absence: AbsenceRecord,
    student: Student
  ): Promise<void> {
    const sendNotification = async () => {
      try {
        const result = await whatsappService.sendAbsenceNotification(
          student,
          absence.date,
          absence.reason,
          this.config.schoolName,
          this.config.language
        )

        // Update absence record
        absence.notificationSent = true
        absence.notificationSentAt = result.timestamp
        this.updateAbsence(absence)

        
      } catch (error) {
        console.error('❌ Failed to send absence notification:', error)
        absence.notificationSent = false
        this.updateAbsence(absence)
      }
    }

    // Check if delay is configured
    if (this.config.delayMinutes > 0) {
      // Schedule notification with delay
      const timeoutId = setTimeout(sendNotification, this.config.delayMinutes * 60 * 1000)
      this.pendingNotifications.set(absence.id, timeoutId)
    } else {
      // Send immediately
      await sendNotification()
    }
  }

  /**
   * Justify an absence
   */
  async justifyAbsence(
    absenceId: string,
    justificationDocument?: string
  ): Promise<AbsenceRecord | null> {
    const absence = this.getAbsence(absenceId)
    if (!absence) {
      return null
    }

    absence.justified = true
    absence.justificationDocument = justificationDocument
    this.updateAbsence(absence)

    // Send notification if configured
    if (this.config.enabled && this.config.sendOnJustify) {
      const student = await this.getStudent(absence.studentId)
      if (student) {
        try {
          await whatsappService.sendWhatsAppMessage({
            to: student.guardianPhone || student.phone,
            body: `Bonjour, l'absence de ${absence.studentName} du ${absence.date} a été justifiée. Cordialement, ${this.config.schoolName}`,
            studentId: student.id,
            studentName: student.name,
            parentName: student.guardianName,
            type: 'absence'
          })
        } catch (error) {
          console.error('Failed to send justification notification:', error)
        }
      }
    }

    return absence
  }

  /**
   * Cancel a scheduled notification
   */
  cancelScheduledNotification(absenceId: string): void {
    const timeoutId = this.pendingNotifications.get(absenceId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      this.pendingNotifications.delete(absenceId)
    }
  }

  /**
   * Get absence by ID
   */
  getAbsence(absenceId: string): AbsenceRecord | null {
    const absences = this.getAllAbsences()
    return absences.find(a => a.id === absenceId) || null
  }

  /**
   * Get all absences with optional filters
   */
  getAllAbsences(filters?: {
    studentId?: string
    classId?: string
    startDate?: string
    endDate?: string
    justified?: boolean
    notificationSent?: boolean
  }): AbsenceRecord[] {
    const absences: AbsenceRecord[] = this.loadAbsences()

    let result = absences

    if (filters?.studentId) {
      result = result.filter(a => a.studentId === filters.studentId)
    }

    if (filters?.classId) {
      result = result.filter(a => a.classId === filters.classId)
    }

    if (filters?.startDate) {
      result = result.filter(a => a.date >= filters.startDate!)
    }

    if (filters?.endDate) {
      result = result.filter(a => a.date <= filters.endDate!)
    }

    if (filters?.justified !== undefined) {
      result = result.filter(a => a.justified === filters.justified)
    }

    if (filters?.notificationSent !== undefined) {
      result = result.filter(a => a.notificationSent === filters.notificationSent)
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  /**
   * Get absences for a student
   */
  getStudentAbsences(studentId: string): AbsenceRecord[] {
    return this.getAllAbsences({ studentId })
  }

  /**
   * Get absences for a class
   */
  getClassAbsences(classId: string): AbsenceRecord[] {
    return this.getAllAbsences({ classId })
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalAbsences: number
    justifiedAbsences: number
    unjustifiedAbsences: number
    notificationsSent: number
    notificationsFailed: number
    byClass: Record<string, number>
    byStudent: Record<string, number>
  } {
    const absences = this.getAllAbsences()

    return {
      totalAbsences: absences.length,
      justifiedAbsences: absences.filter(a => a.justified).length,
      unjustifiedAbsences: absences.filter(a => !a.justified).length,
      notificationsSent: absences.filter(a => a.notificationSent).length,
      notificationsFailed: absences.filter(a => !a.notificationSent && a.createdAt).length,
      byClass: absences.reduce((acc, a) => {
        acc[a.className] = (acc[a.className] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byStudent: absences.reduce((acc, a) => {
        acc[a.studentName] = (acc[a.studentName] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AbsenceTriggerConfig>): void {
    this.config = { ...this.config, ...config }
    this.saveConfig()
  }

  /**
   * Get current configuration
   */
  getConfig(): AbsenceTriggerConfig {
    return { ...this.config }
  }

  /**
   * Save absence to storage
   */
  private saveAbsence(absence: AbsenceRecord): void {
    const absences = this.loadAbsences()
    absences.unshift(absence)
    localStorage.setItem('absences', JSON.stringify(absences))
  }

  /**
   * Update absence in storage
   */
  private updateAbsence(absence: AbsenceRecord): void {
    const absences = this.loadAbsences()
    const index = absences.findIndex(a => a.id === absence.id)
    if (index !== -1) {
      absences[index] = absence
      localStorage.setItem('absences', JSON.stringify(absences))
    }
  }

  /**
   * Load absences from storage
   */
  private loadAbsences(): AbsenceRecord[] {
    const saved = localStorage.getItem('absences')
    if (saved) {
      return JSON.parse(saved)
    }
    return []
  }

  /**
   * Get student by ID (would normally come from students store)
   */
  private async getStudent(studentId: string): Promise<Student | null> {
    // Try to get from localStorage first
    const studentsData = localStorage.getItem('students')
    if (studentsData) {
      const students: Student[] = JSON.parse(studentsData)
      return students.find(s => s.id === studentId) || null
    }

    // In real app, this would fetch from API/Supabase
    return null
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `abs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Clear all absences (for testing)
   */
  clearAll(): void {
    localStorage.removeItem('absences')
    this.pendingNotifications.forEach(timeoutId => clearTimeout(timeoutId))
    this.pendingNotifications.clear()
  }
}

// Export singleton instance
export const absenceTriggerService = new AbsenceTriggerService()

// Export factory for testing
export const createAbsenceTriggerService = (): AbsenceTriggerService =>
  new AbsenceTriggerService()

export default absenceTriggerService

