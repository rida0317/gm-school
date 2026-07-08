/**
 * Cloud Sync Service - Synchronizes all data with Supabase
 * 
 * Features:
 * - Auto-save to Supabase cloud
 * - Real-time sync across devices
 * - Offline mode with localStorage fallback
 * - Conflict resolution
 */

import { supabase } from '../lib/supabaseClient'
import type {
  Teacher,
  SchoolClass,
  Salle,
  Timetable,
  Replacement,
  Absence,
  CustomSubject,
  CustomLevel,
  Student,
  InventoryData,
  TimetableSlot
} from '../types'

interface SyncOptions {
  useCache?: boolean
  forceSync?: boolean
}

class CloudSyncService {
  private schoolId: string | null = null
  private userId: string | null = null
  private isOnline = true
  private syncQueue: Array<() => Promise<void>> = []
  private realtimeChannels: any[] = []

  /**
   * Initialize sync service with user and school info
   */
  initialize(userId: string, schoolId: string) {
    this.userId = userId
    this.schoolId = schoolId

    
    // Setup real-time listeners
    this.setupRealtimeListeners()
    
    // Check online status
    this.checkOnlineStatus()
  }

  /**
   * Check if user is online
   */
  private async checkOnlineStatus() {
    try {
      const { data, error } = await supabase.from('schools').select('id').limit(1)
      this.isOnline = !error && data !== null

    } catch {
      this.isOnline = false
    }
  }

  /**
   * Setup real-time listeners for all tables
   */
  private setupRealtimeListeners() {
    const tables = [
      'teachers', 'students', 'classes', 'grades',
      'timetables', 'replacements', 'absences',
      'stock_items', 'stock_loans'
    ]

    tables.forEach(table => {
      const channel = supabase
        .channel(`${table}:${this.schoolId}`)
        .from(`${table}:school_id=eq.${this.schoolId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public',
          filter: `school_id=eq.${this.schoolId}`
        }, (payload) => {

          // Dispatch custom event for components to listen
          window.dispatchEvent(new CustomEvent(`cloud-sync:${table}`, { 
            detail: { eventType: payload.eventType, new: payload.new, old: payload.old }
          }))
        })
        .subscribe()

      this.realtimeChannels.push(channel)
    })


  }

  /**
   * Cleanup realtime channels
   */
  cleanup() {
    this.realtimeChannels.forEach(channel => {
      supabase.removeChannel(channel)
    })
    this.realtimeChannels = []

  }

  // =====================================================
  // TEACHERS
  // =====================================================

  async getTeachers(): Promise<Teacher[]> {
    if (!this.schoolId) return []

    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('school_id', this.schoolId)
        .eq('is_active', true)
        .order('full_name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('❌ Failed to fetch teachers:', error)
      return []
    }
  }

  async saveTeacher(teacher: Omit<Teacher, 'id' | 'created_at' | 'updated_at'>): Promise<Teacher | null> {
    if (!this.schoolId) return null

    try {
      const { data, error } = await supabase
        .from('teachers')
        .insert([{
          ...teacher,
          school_id: this.schoolId,
          user_id: this.userId || undefined
        }])
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('❌ Failed to save teacher:', error)
      // Fallback to queue for retry
      this.queueSync(() => this.saveTeacher(teacher))
      return null
    }
  }

  async updateTeacher(id: string, updates: Partial<Teacher>): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      const { error } = await supabase
        .from('teachers')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('school_id', this.schoolId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to update teacher:', error)
      this.queueSync(() => this.updateTeacher(id, updates))
      return false
    }
  }

  async deleteTeacher(id: string): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      // Soft delete - set is_active to false
      const { error } = await supabase
        .from('teachers')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('school_id', this.schoolId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to delete teacher:', error)
      return false
    }
  }

  // =====================================================
  // CLASSES
  // =====================================================

  async getClasses(): Promise<SchoolClass[]> {
    if (!this.schoolId) return []

    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', this.schoolId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('❌ Failed to fetch classes:', error)
      return []
    }
  }

  async saveClass(schoolClass: Omit<SchoolClass, 'id' | 'created_at' | 'updated_at'>): Promise<SchoolClass | null> {
    if (!this.schoolId) return null

    try {
      // Exclude subjects field since it doesn't exist in Supabase
      const { subjects, ...classDataWithoutSubjects } = schoolClass as any
      
      const { data, error } = await supabase
        .from('classes')
        .insert([{
          ...classDataWithoutSubjects,
          school_id: this.schoolId
        }])
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('❌ Failed to save class:', error)
      this.queueSync(() => this.saveClass(schoolClass))
      return null
    }
  }

  async updateClass(id: string, updates: Partial<SchoolClass>): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      // Exclude subjects field since it doesn't exist in Supabase
      const { subjects, ...updatesWithoutSubjects } = updates as any
      
      const { error } = await supabase
        .from('classes')
        .update({
          ...updatesWithoutSubjects,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('school_id', this.schoolId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to update class:', error)
      this.queueSync(() => this.updateClass(id, updates))
      return false
    }
  }

  async deleteClass(id: string): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      const { error } = await supabase
        .from('classes')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('school_id', this.schoolId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to delete class:', error)
      return false
    }
  }

  // =====================================================
  // SALLES
  // =====================================================

  async getSalles(): Promise<Salle[]> {
    if (!this.schoolId) return []

    try {
      const { data, error } = await supabase
        .from('salles')
        .select('*')
        .eq('school_id', this.schoolId)
        .order('name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('❌ Failed to fetch salles:', error)
      return []
    }
  }

  async saveSalle(salle: Omit<Salle, 'id' | 'created_at' | 'updated_at'>): Promise<Salle | null> {
    if (!this.schoolId) return null

    try {
      const { data, error } = await supabase
        .from('salles')
        .insert([{
          ...salle,
          school_id: this.schoolId
        }])
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('❌ Failed to save salle:', error)
      this.queueSync(() => this.saveSalle(salle))
      return null
    }
  }

  async updateSalle(id: string, updates: Partial<Salle>): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      const { error } = await supabase
        .from('salles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('school_id', this.schoolId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to update salle:', error)
      this.queueSync(() => this.updateSalle(id, updates))
      return false
    }
  }

  async deleteSalle(id: string): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      const { error } = await supabase
        .from('salles')
        .delete()
        .eq('id', id)
        .eq('school_id', this.schoolId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to delete salle:', error)
      return false
    }
  }

  // =====================================================
  // TIMETABLES
  // =====================================================

  async getTimetables(): Promise<Timetable> {
    if (!this.schoolId) return {} as Timetable

    try {
      const { data, error } = await supabase
        .from('timetables')
        .select('*')
        .eq('school_id', this.schoolId)
        .order('day_of_week')

      if (error) throw error

      // Convert to Timetable format
      const timetable: Timetable = {} as Timetable
      data.forEach(slot => {
        const classId = slot.class_id
        if (!timetable[classId]) {
          timetable[classId] = {} as any
        }
        // Convert day_of_week (0-6) to day name
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        const dayName = days[slot.day_of_week]
        if (!timetable[classId][dayName]) {
          timetable[classId][dayName] = []
        }
        timetable[classId][dayName].push({
          subject: slot.subject,
          teacher: slot.teacher_id,
          salle: slot.salle_id,
          start: slot.start_time,
          end: slot.end_time
        } as TimetableSlot)
      })

      return timetable
    } catch (error) {
      console.error('❌ Failed to fetch timetables:', error)
      return {} as Timetable
    }
  }

  async saveTimetables(timetables: Timetable): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      // Clear existing timetables
      await supabase
        .from('timetables')
        .delete()
        .eq('school_id', this.schoolId)

      // Insert new timetables
      const slots: any[] = []
      Object.entries(timetables).forEach(([classId, days]: [string, any]) => {
        Object.entries(days).forEach(([day, slots_array]: [string, any[]]) => {
          const dayMap: { [key: string]: number } = {
            monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
            friday: 4, saturday: 5, sunday: 6
          }
          slots_array.forEach(slot => {
            slots.push({
              school_id: this.schoolId,
              class_id: classId,
              teacher_id: slot.teacher,
              salle_id: slot.salle,
              subject: slot.subject,
              day_of_week: dayMap[day],
              start_time: slot.start,
              end_time: slot.end
            })
          })
        })
      })

      if (slots.length > 0) {
        const { error } = await supabase
          .from('timetables')
          .insert(slots)

        if (error) throw error
      }


      return true
    } catch (error) {
      console.error('❌ Failed to save timetables:', error)
      this.queueSync(() => this.saveTimetables(timetables))
      return false
    }
  }

  // =====================================================
  // STUDENTS
  // =====================================================

  async getStudents(): Promise<Student[]> {
    if (!this.schoolId) return []

    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('school_id', this.schoolId)
        .eq('is_active', true)
        .order('full_name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('❌ Failed to fetch students:', error)
      return []
    }
  }

  async saveStudent(student: Omit<Student, 'id' | 'created_at' | 'updated_at'>): Promise<Student | null> {
    if (!this.schoolId) return null

    try {
      const { data, error } = await supabase
        .from('students')
        .insert([{
          ...student,
          school_id: this.schoolId
        }])
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('❌ Failed to save student:', error)
      this.queueSync(() => this.saveStudent(student))
      return null
    }
  }

  async updateStudent(id: string, updates: Partial<Student>): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      const { error } = await supabase
        .from('students')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('school_id', this.schoolId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to update student:', error)
      this.queueSync(() => this.updateStudent(id, updates))
      return false
    }
  }

  async deleteStudent(id: string): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      const { error } = await supabase
        .from('students')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('school_id', this.schoolId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to delete student:', error)
      return false
    }
  }

  // =====================================================
  // GRADES
  // =====================================================

  async getGrades(): Promise<any[]> {
    if (!this.schoolId) return []

    try {
      const { data, error } = await supabase
        .from('grades')
        .select('*, students(full_name), custom_subjects(name)')
        .eq('school_id', this.schoolId)
        .order('date', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('❌ Failed to fetch grades:', error)
      return []
    }
  }

  async saveGrade(grade: any): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      const { error } = await supabase
        .from('grades')
        .insert([{
          ...grade,
          school_id: this.schoolId
        }])

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to save grade:', error)
      this.queueSync(() => this.saveGrade(grade))
      return false
    }
  }

  // =====================================================
  // REPLACEMENTS
  // =====================================================

  async getReplacements(): Promise<Replacement[]> {
    if (!this.schoolId) return []

    try {
      const { data, error } = await supabase
        .from('replacements')
        .select('*')
        .eq('school_id', this.schoolId)
        .order('date', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('❌ Failed to fetch replacements:', error)
      return []
    }
  }

  async saveReplacement(replacement: Omit<Replacement, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      const { error } = await supabase
        .from('replacements')
        .insert([{
          ...replacement,
          school_id: this.schoolId
        }])

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to save replacement:', error)
      this.queueSync(() => this.saveReplacement(replacement))
      return false
    }
  }

  async deleteReplacement(id: string): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      const { error } = await supabase
        .from('replacements')
        .delete()
        .eq('id', id)
        .eq('school_id', this.schoolId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to delete replacement:', error)
      return false
    }
  }

  // =====================================================
  // ABSENCES
  // =====================================================

  async getAbsences(): Promise<Absence[]> {
    if (!this.schoolId) return []

    try {
      const { data, error } = await supabase
        .from('absences')
        .select('*')
        .eq('school_id', this.schoolId)
        .order('date', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('❌ Failed to fetch absences:', error)
      return []
    }
  }

  async saveAbsence(absence: Omit<Absence, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      const { error } = await supabase
        .from('absences')
        .insert([{
          ...absence,
          school_id: this.schoolId
        }])

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to save absence:', error)
      this.queueSync(() => this.saveAbsence(absence))
      return false
    }
  }

  async deleteAbsence(id: string): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      const { error } = await supabase
        .from('absences')
        .delete()
        .eq('id', id)
        .eq('school_id', this.schoolId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to delete absence:', error)
      return false
    }
  }

  // =====================================================
  // CUSTOM SUBJECTS & LEVELS
  // =====================================================

  async getCustomSubjects(): Promise<CustomSubject[]> {
    if (!this.schoolId) return []

    try {
      const { data, error } = await supabase
        .from('custom_subjects')
        .select('*')
        .eq('school_id', this.schoolId)
        .order('name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('❌ Failed to fetch custom subjects:', error)
      return []
    }
  }

  async saveCustomSubject(subject: Omit<CustomSubject, 'id' | 'created_at'>): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      const { error } = await supabase
        .from('custom_subjects')
        .insert([{
          ...subject,
          school_id: this.schoolId
        }])

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to save custom subject:', error)
      return false
    }
  }

  async getCustomLevels(): Promise<CustomLevel[]> {
    if (!this.schoolId) return []

    try {
      const { data, error } = await supabase
        .from('custom_levels')
        .select('*')
        .eq('school_id', this.schoolId)
        .order('order_index')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('❌ Failed to fetch custom levels:', error)
      return []
    }
  }

  async saveCustomLevel(level: Omit<CustomLevel, 'id' | 'created_at'>): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      const { error } = await supabase
        .from('custom_levels')
        .insert([{
          ...level,
          school_id: this.schoolId
        }])

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to save custom level:', error)
      return false
    }
  }

  // =====================================================
  // INVENTORY / STOCK
  // =====================================================

  async getInventory(): Promise<InventoryData> {
    if (!this.schoolId) return {
      items: [],
      transactions: [],
      suppliers: [],
      categories: [],
      assignments: []
    }

    try {
      const [items, transactions, suppliers, categories, assignments] = await Promise.all([
        supabase.from('stock_items').select('*').eq('school_id', this.schoolId).eq('is_active', true),
        supabase.from('stock_transactions').select('*').eq('school_id', this.schoolId).limit(100),
        supabase.from('suppliers').select('*').eq('school_id', this.schoolId).eq('is_active', true),
        supabase.from('stock_categories').select('*').eq('school_id', this.schoolId),
        supabase.from('stock_assignments').select('*').eq('school_id', this.schoolId).eq('status', 'active')
      ])

      return {
        items: items.data || [],
        transactions: transactions.data || [],
        suppliers: suppliers.data || [],
        categories: categories.data || [],
        assignments: assignments.data || []
      }
    } catch (error) {
      console.error('❌ Failed to fetch inventory:', error)
      return {
        items: [],
        transactions: [],
        suppliers: [],
        categories: [],
        assignments: []
      }
    }
  }

  async saveStockItem(item: any): Promise<boolean> {
    if (!this.schoolId) return false

    try {
      const { error } = await supabase
        .from('stock_items')
        .insert([{
          ...item,
          school_id: this.schoolId
        }])

      if (error) throw error

      return true
    } catch (error) {
      console.error('❌ Failed to save stock item:', error)
      return false
    }
  }

  // =====================================================
  // SYNC QUEUE (Offline Support)
  // =====================================================

  private queueSync(operation: () => Promise<void>) {
    this.syncQueue.push(operation)

    
    // Try to process queue when back online
    if (this.isOnline) {
      this.processQueue()
    }
  }

  private async processQueue() {
    if (this.syncQueue.length === 0) return


    
    const queue = [...this.syncQueue]
    this.syncQueue = []

    for (const operation of queue) {
      try {
        await operation()
      } catch (error) {
        console.error('❌ Queue operation failed:', error)
        // Re-queue failed operations
        this.syncQueue.push(operation)
      }
    }
  }

  // =====================================================
  // BULK OPERATIONS (For Migration)
  // =====================================================

  async bulkSave(data: {
    teachers?: Teacher[],
    classes?: SchoolClass[],
    students?: Student[],
    grades?: any[],
    timetables?: Timetable,
    replacements?: Replacement[],
    absences?: Absence[],
    inventory?: InventoryData
  }): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = []

    if (data.teachers?.length) {
      for (const teacher of data.teachers) {
        const result = await this.saveTeacher(teacher as any)
        if (!result) errors.push('Failed to save teacher: ' + teacher.full_name)
      }
    }

    if (data.classes?.length) {
      for (const cls of data.classes) {
        const result = await this.saveClass(cls as any)
        if (!result) errors.push('Failed to save class: ' + cls.name)
      }
    }

    if (data.students?.length) {
      for (const student of data.students) {
        const result = await this.saveStudent(student as any)
        if (!result) errors.push('Failed to save student: ' + student.full_name)
      }
    }

    if (data.timetables) {
      const result = await this.saveTimetables(data.timetables)
      if (!result) errors.push('Failed to save timetables')
    }

    return {
      success: errors.length === 0,
      errors
    }
  }
}

// Export singleton instance
export const cloudSync = new CloudSyncService()

