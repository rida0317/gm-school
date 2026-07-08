// src/services/homework.service.ts - Homework management service (Supabase Version)

import { supabase } from '../lib/supabaseClient'
import type { Student } from '../types'

export interface Homework {
  id: string
  classId: string
  className: string
  subject: string
  teacherId: string
  teacherName: string
  title: string
  description: string
  dueDate: string
  assignedDate: string
  status: 'active' | 'completed' | 'expired'
  attachments?: HomeworkAttachment[]
  notifyParents?: boolean
  createdAt: string
  updatedAt: string
}

export interface HomeworkAttachment {
  id: string
  filename: string
  url: string
  size: number
  type: string
}

export interface HomeworkSubmission {
  id: string
  homeworkId: string
  studentId: string
  studentName: string
  submittedAt: string
  status: 'pending' | 'submitted' | 'graded'
  grade?: number
  feedback?: string
  attachments?: HomeworkAttachment[]
}

export interface HomeworkStats {
  totalActive: number
  totalCompleted: number
  totalExpired: number
  submissionRate: number
  averageGrade: number
  bySubject: Record<string, number>
  byClass: Record<string, number>
}

class HomeworkService {
  private homework: Homework[] = []
  private submissions: HomeworkSubmission[] = []

  constructor() {
    this.loadFromLocalStorage()
  }

  /**
   * Create new homework assignment
   */
  async createHomework(homework: Omit<Homework, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Homework> {
    const newHomework: Homework = {
      ...homework,
      id: this.generateId(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Save to Supabase
    try {
      const { error } = await supabase
        .from('homework')
        .insert({
          id: newHomework.id,
          school_id: newHomework.classId, // Using classId as school_id fallback
          class_id: newHomework.classId,
          class_name: newHomework.className,
          subject: newHomework.subject,
          teacher_id: newHomework.teacherId,
          teacher_name: newHomework.teacherName,
          title: newHomework.title,
          description: newHomework.description,
          due_date: newHomework.dueDate,
          assigned_date: newHomework.assignedDate,
          status: 'active',
          notify_parents: newHomework.notifyParents,
          created_at: newHomework.createdAt,
          updated_at: newHomework.updatedAt
        })

      if (error) {
        console.error('Error saving homework to Supabase:', error)
      }
    } catch (error) {
      console.error('Error saving homework:', error)
    }

    // Update local state
    this.homework.unshift(newHomework)
    this.saveToLocalStorage()

    return newHomework
  }

  /**
   * Update homework
   */
  async updateHomework(homeworkId: string, updates: Partial<Homework>): Promise<Homework | null> {
    const index = this.homework.findIndex(h => h.id === homeworkId)
    if (index === -1) return null

    const updatedHomework = {
      ...this.homework[index],
      ...updates,
      updatedAt: new Date().toISOString()
    }

    // Update Supabase
    try {
      const { error } = await supabase
        .from('homework')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', homeworkId)

      if (error) {
        console.error('Error updating homework in Supabase:', error)
      }
    } catch (error) {
      console.error('Error updating homework:', error)
    }

    this.homework[index] = updatedHomework
    this.saveToLocalStorage()

    return updatedHomework
  }

  /**
   * Delete homework
   */
  async deleteHomework(homeworkId: string): Promise<boolean> {
    const index = this.homework.findIndex(h => h.id === homeworkId)
    if (index === -1) return false

    // Delete from Supabase
    try {
      const { error } = await supabase
        .from('homework')
        .delete()
        .eq('id', homeworkId)

      if (error) {
        console.error('Error deleting homework from Supabase:', error)
      }
    } catch (error) {
      console.error('Error deleting homework:', error)
    }

    this.homework.splice(index, 1)
    this.saveToLocalStorage()

    return true
  }

  /**
   * Get homework by class
   */
  getHomeworkByClass(classId: string, includeExpired: boolean = false): Homework[] {
    let homework = this.homework.filter(h => h.classId === classId)
    
    if (!includeExpired) {
      homework = homework.filter(h => h.status !== 'expired')
    }

    return homework.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
  }

  /**
   * Get homework by teacher
   */
  getHomeworkByTeacher(teacherId: string): Homework[] {
    return this.homework
      .filter(h => h.teacherId === teacherId)
      .sort((a, b) => new Date(b.assignedDate).getTime() - new Date(a.assignedDate).getTime())
  }

  /**
   * Get homework by student (via class)
   */
  getHomeworkByStudent(student: Student): Homework[] {
    return this.homework
      .filter(h => h.classId === student.classId && h.status === 'active')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  }

  /**
   * Get upcoming homework (due soon)
   */
  getUpcomingHomework(days: number = 7): Homework[] {
    const now = new Date()
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    return this.homework
      .filter(h => {
        const dueDate = new Date(h.dueDate)
        return h.status === 'active' && dueDate >= now && dueDate <= future
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  }

  /**
   * Get overdue homework
   */
  getOverdueHomework(): Homework[] {
    const now = new Date()

    return this.homework
      .filter(h => h.status === 'active' && new Date(h.dueDate) < now)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  }

  /**
   * Mark homework as completed
   */
  async markAsCompleted(homeworkId: string): Promise<Homework | null> {
    return this.updateHomework(homeworkId, { status: 'completed' })
  }

  /**
   * Update homework status (auto-expire overdue)
   */
  updateHomeworkStatuses(): void {
    const now = new Date()

    this.homework.forEach(homework => {
      if (homework.status === 'active') {
        const dueDate = new Date(homework.dueDate)
        if (dueDate < now) {
          homework.status = 'expired'
          homework.updatedAt = now.toISOString()
        }
      }
    })

    this.saveToLocalStorage()
  }

  /**
   * Get homework statistics
   */
  getStats(): HomeworkStats {
    const active = this.homework.filter(h => h.status === 'active')
    const completed = this.homework.filter(h => h.status === 'completed')
    const expired = this.homework.filter(h => h.status === 'expired')

    const bySubject: Record<string, number> = {}
    const byClass: Record<string, number> = {}

    this.homework.forEach(h => {
      bySubject[h.subject] = (bySubject[h.subject] || 0) + 1
      byClass[h.classId] = (byClass[h.classId] || 0) + 1
    })

    return {
      totalActive: active.length,
      totalCompleted: completed.length,
      totalExpired: expired.length,
      submissionRate: completed.length / (this.homework.length || 1) * 100,
      averageGrade: 0, // Would calculate from submissions
      bySubject,
      byClass
    }
  }

  /**
   * Fetch homework from Supabase
   */
  async fetchHomework(schoolId: string): Promise<Homework[]> {
    try {
      const { data, error } = await supabase
        .from('homework')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching homework from Supabase:', error)
        return this.homework
      }

      if (data) {
        this.homework = data.map(item => ({
          id: item.id,
          classId: item.class_id,
          className: item.class_name,
          subject: item.subject,
          teacherId: item.teacher_id,
          teacherName: item.teacher_name,
          title: item.title,
          description: item.description,
          dueDate: item.due_date,
          assignedDate: item.assigned_date,
          status: item.status,
          notifyParents: item.notify_parents,
          createdAt: item.created_at,
          updatedAt: item.updated_at
        }))
        this.saveToLocalStorage()
      }

      return this.homework
    } catch (error) {
      console.error('Error fetching homework:', error)
      return this.homework
    }
  }

  /**
   * Generate homework report for parents
   */
  generateHomeworkReport(student: Student): { upcoming: Homework[]; overdue: Homework[]; completed: Homework[] } {
    const allStudentHomework = this.getHomeworkByStudent(student)

    const now = new Date()
    const upcoming = allStudentHomework.filter(h => new Date(h.dueDate) >= now)
    const overdue = allStudentHomework.filter(h => new Date(h.dueDate) < now)
    const completed = this.homework.filter(h => h.classId === student.classId && h.status === 'completed')

    return { upcoming, overdue, completed }
  }

  /**
   * Load from localStorage
   */
  private loadFromLocalStorage(): void {
    const saved = localStorage.getItem('homework')
    if (saved) {
      this.homework = JSON.parse(saved)
      this.updateHomeworkStatuses()
    }
  }

  /**
   * Save to localStorage
   */
  private saveToLocalStorage(): void {
    localStorage.setItem('homework', JSON.stringify(this.homework.slice(0, 100)))
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

// Export singleton instance
export const homeworkService = new HomeworkService()

// Export factory function
export const createHomeworkService = (): HomeworkService => new HomeworkService()

export default homeworkService

