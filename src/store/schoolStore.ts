// src/store/schoolStore.ts - Zustand store for school data management with Supabase Sync

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
  SchoolData,
  TimetableSlot
} from '../types'
import { smartSave, smartLoad } from '../utils/storage'

const STORE_KEY = 'elite_school_data_v3'
const BACKUP_KEY = 'elite_school_backup_v3'
const DEFAULT_SCHOOL_ID = '00000000-0000-0000-0000-000000000001'

interface SchoolStore extends SchoolData {
  // Actions
  setSchoolInfo: (name: string, logo: string, academicYear?: string, skipSave?: boolean) => void
  setLanguage: (lang: 'en' | 'fr' | 'ar') => void
  setAcademicYear: (year: string) => void
  fetchAllData: () => Promise<void>

  // Teacher actions
  addTeacher: (teacher: Omit<Teacher, 'id'>) => Promise<void>
  updateTeacher: (id: string, teacher: Partial<Teacher>) => Promise<void>
  deleteTeacher: (id: string) => Promise<void>
  getTeacher: (id: string) => Teacher | undefined
  fetchTeachers: () => Promise<void>

  // Class actions
  addClass: (schoolClass: Omit<SchoolClass, 'id'>) => Promise<void>
  updateClass: (id: string, schoolClass: Partial<SchoolClass>) => Promise<void>
  deleteClass: (id: string) => Promise<void>
  getClass: (id: string) => SchoolClass | undefined
  fetchClasses: () => Promise<void>

  // Student actions
  addStudent: (student: Omit<Student, 'id'>) => Promise<void>
  addBulkStudents: (students: Omit<Student, 'id'>[]) => Promise<{ success: number; errors: number }>
  updateStudent: (id: string, student: Partial<Student>) => Promise<void>
  deleteStudent: (id: string) => Promise<void>
  getStudent: (id: string) => Student | undefined
  fetchStudents: () => Promise<void>

  // Salle actions
  addSalle: (salle: Omit<Salle, 'id'>) => Promise<void>
  updateSalle: (id: string, salle: Partial<Salle>) => Promise<void>
  deleteSalle: (id: string) => Promise<void>
  fetchSalles: () => Promise<void>

  // Timetable actions
  saveTimetables: (timetables: Timetable) => Promise<void>
  getTimetable: (classId: string) => { [day: string]: (TimetableSlot | null)[] } | undefined
  clearAllTimetables: () => void

  // Replacement actions
  addReplacement: (replacement: Omit<Replacement, 'id'>) => Promise<void>
  deleteReplacement: (id: string) => Promise<void>
  clearAllReplacements: () => void

  // Absence actions
  addAbsence: (absence: Omit<Absence, 'id'>) => Promise<void>
  deleteAbsence: (id: string) => Promise<void>

  // Custom subjects/levels
  addCustomSubject: (subject: string) => Promise<void>
  deleteCustomSubject: (id: string) => Promise<void>
  addCustomLevel: (level: string) => Promise<void>

  // Backup/Restore
  exportBackup: () => string
  importBackup: (backupData: string) => boolean
  syncAllToSupabase: () => Promise<void>
  _autoBackup: () => void
  forceSave: () => void
}

// Default data
const getDefaultData = (): SchoolData => ({
  teachers: [],
  classes: [],
  salles: [],
  timetables: {},
  replacements: [],
  absences: [],
  customSubjects: [],
  customLevels: [],
  students: [],
  inventory: { items: [], transactions: [], suppliers: [], categories: [], assignments: [] },
  logo: 'https://cdn-icons-png.flaticon.com/512/2859/2859706.png',
  schoolName: 'Les Generations Montantes',
  academicYear: '2025-2026',
  language: 'en'
})

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Custom storage with smart save/load
const customStorage = {
  getItem: async (name: string) => {
    const data = await smartLoad(name)
    return data
  },
  setItem: async (name: string, value: any) => {
    const data = typeof value === 'string' ? JSON.parse(value) : value
    const dataOnly: any = {}
    const stateToProcess = data.state || data
    for (const key in stateToProcess) {
      if (typeof stateToProcess[key] !== 'function') {
        dataOnly[key] = stateToProcess[key]
      }
    }
    const storageValue = { state: dataOnly, version: 0 }
    await smartSave(name, storageValue)
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name)
    localStorage.removeItem(name + '_source')
  }
}

export const useSchoolStore = create<SchoolStore>()(
  persist(
    (set, get) => ({
      ...getDefaultData(),

      setSchoolInfo: async (name, logo, academicYear, skipSave = false) => {
        // ✅ CORRECTION BUG ZUSTAND: évite l'appel implicite sans paramètres
        if (!name && !logo && !academicYear) return
        
        const currentSchoolId = 'default'


        // Update local state immediately for UI responsiveness
        set((state) => ({ schoolName: name, logo, academicYear: academicYear || state.academicYear }))

        // Save to Supabase (skip if loading from database to prevent loops)
        if (!skipSave) {
          try {
            const { data, error } = await supabase
              .from('schools')
              .update({
                name,
                logo_url: logo || null,
                academic_year: academicYear || null
              })
              .eq('id', currentSchoolId)

            if (error) {
              console.error('❌ Supabase update error:', error.code, error.message)
              throw error
            }

          } catch (err) {
            console.error('❌ Failed to save school info to database:', err)
            throw err
          }
        }
        
        get().forceSave()
      },

      setAcademicYear: (year) => {
        set({ academicYear: year })
        get().forceSave()
      },

      setLanguage: (lang) => {
        set({ language: lang })
        document.documentElement.lang = lang
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
        localStorage.setItem('school_language', lang)
        get().forceSave()
      },

      fetchAllData: async () => {
        try {
          const currentSchoolId = 'default'


          // Import grades store to sync grades too
          const { useGradesStore } = await import('./gradesStore')

          const [
            { data: schoolData },
            { data: teachers },
            { data: classes },
            { data: students },
            { data: salles },
            { data: subjects },
            { data: levels },
            { data: grades },
            { data: timetables }
          ] = await Promise.all([
            supabase.from('schools').select('*').eq('id', currentSchoolId).single(),
            supabase.from('teachers').select('*').eq('school_id', currentSchoolId).eq('is_active', true),
            supabase.from('classes').select('*').eq('school_id', currentSchoolId).eq('is_active', true),
            supabase.from('students').select('*').eq('school_id', currentSchoolId).eq('is_active', true),
            supabase.from('salles').select('*').eq('school_id', currentSchoolId).eq('is_active', true),
            supabase.from('subjects').select('*').eq('school_id', currentSchoolId).eq('is_active', true),
            supabase.from('levels').select('*').eq('school_id', currentSchoolId).eq('is_active', true),
            supabase.from('grades').select('*').eq('school_id', currentSchoolId),
            supabase.from('timetables').select('*').eq('school_id', currentSchoolId)
          ])

          // Update school info from database
          if (schoolData) {
            set({
              schoolName: schoolData.name || get().schoolName,
              logo: schoolData.logo_url || get().logo,
              academicYear: schoolData.academic_year || get().academicYear
            })

          }

          // Update grades store
          if (grades && grades.length > 0) {
            const mappedGrades = grades.map(g => ({
              id: g.id,
              studentId: g.student_id,
              classId: g.class_id,
              subject: g.subject,
              examType: g.exam_type,
              grade: g.grade,
              academicYear: g.academic_year,
              coefficient: g.coefficient,
              teacherId: g.teacher_id,
              comment: g.comment,
              date: g.date
            }))
            useGradesStore.getState().grades = mappedGrades
            useGradesStore.setState({ grades: mappedGrades })
          }

          set({
            teachers: (teachers || []).map((t: any) => ({
              id: t.id, name: t.full_name, maxHoursPerWeek: t.max_hours_per_week,
              subjects: t.subjects || [], levels: t.levels || [], isVacataire: t.is_vacataire, availability: t.availability || {}
            })),
            classes: (classes || []).map((c: any) => ({
              id: c.id, name: c.name, level: c.level, room_id: c.room_id, teacher_id: c.teacher_id,
              max_students: c.max_students, subjects: c.subjects || [], schedule: c.schedule || {}
            })),
            students: (students || []).map((s: any) => ({
              id: s.id,
              name: s.full_name || s.name,
              classId: s.class_id,
              codeMassar: s.code_massar,
              parentPhone: s.parent_phone,
              academicYear: s.academic_year || useSchoolStore.getState().academicYear,
              is_active: s.is_active
            })),
            salles: (salles || []).map((s: any) => ({
              id: s.id, name: s.name, capacity: s.capacity, type: s.type
            })),
            customSubjects: (subjects || []).map((s: any) => ({ id: s.id, name: s.name })),
            customLevels: (levels || []).map((l: any) => ({ id: l.id, name: l.name })),
            timetables: (timetables || []).reduce((acc: any, t: any) => {
              acc[t.class_id] = t.schedule
              return acc
            }, {})
          })

        } catch (error) {
          console.error('❌ Sync failed:', error)
        }
      },

      // Teachers
      fetchTeachers: async () => {
        const currentSchoolId = 'default'
        const { data } = await supabase.from('teachers').select('*').eq('school_id', currentSchoolId).eq('is_active', true)
        if (data) set({ teachers: data.map((t: any) => ({
          id: t.id, name: t.full_name, maxHoursPerWeek: t.max_hours_per_week,
          subjects: t.subjects || [], levels: t.levels || [], isVacataire: t.is_vacataire, availability: t.availability || {}
        }))})
      },

      addTeacher: async (teacher) => {
        try {
          const currentSchoolId = 'default'
          const { data, error } = await supabase.from('teachers').insert([{
            school_id: currentSchoolId, full_name: teacher.name, max_hours_per_week: teacher.maxHoursPerWeek,
            subjects: teacher.subjects, levels: teacher.levels, is_vacataire: teacher.isVacataire,
            availability: teacher.availability || {}, is_active: true
          }]).select().single()
          
          if (error) {
            console.error('❌ Supabase Add Teacher Error:', error)
            alert('Error adding teacher: ' + error.message)
            return
          }

          if (data) {
            set((state) => ({ teachers: [...state.teachers, { ...teacher, id: data.id }] }))

          }
        } catch (err) {
          console.error('❌ Unexpected Error:', err)
        }
      },

      updateTeacher: async (id, teacher) => {
        try {
          const updates: any = {}
          if (teacher.name) updates.full_name = teacher.name
          if (teacher.maxHoursPerWeek !== undefined) updates.max_hours_per_week = teacher.maxHoursPerWeek
          if (teacher.subjects) updates.subjects = teacher.subjects
          if (teacher.levels) updates.levels = teacher.levels
          if (teacher.isVacataire !== undefined) updates.is_vacataire = teacher.isVacataire
          if (teacher.availability) updates.availability = teacher.availability
          
          const { error } = await supabase.from('teachers').update(updates).eq('id', id)
          
          if (error) {
            console.error('❌ Supabase Update Teacher Error:', error)
            return
          }

          set((state) => ({ teachers: state.teachers.map(t => t.id === id ? { ...t, ...teacher } : t) }))

        } catch (err) {
          console.error('❌ Unexpected Error:', err)
        }
      },

      deleteTeacher: async (id) => {
        await supabase.from('teachers').update({ is_active: false }).eq('id', id)
        set((state) => ({ teachers: state.teachers.filter(t => t.id !== id) }))
      },

      getTeacher: (id) => get().teachers.find(t => t.id === id),

      // Classes
      fetchClasses: async () => {
        const currentSchoolId = 'default'
        const { data } = await supabase.from('classes').select('*').eq('school_id', currentSchoolId).eq('is_active', true)
        if (data) set({ classes: data.map((c: any) => ({
          id: c.id, name: c.name, level: c.level, room_id: c.room_id, teacher_id: c.teacher_id,
          max_students: c.max_students, subjects: c.subjects || [], schedule: c.schedule || {}
        }))})
      },

      addClass: async (schoolClass) => {
        const currentSchoolId = 'default'

        const classData: any = {
          school_id: currentSchoolId,
          name: schoolClass.name,
          level: schoolClass.level,
          is_active: true
        }

        const { data, error } = await supabase.from('classes').insert([classData]).select().single()

        if (error) {
          console.error('❌ addClass error:', error)
          throw error
        }

        if (data) {
          set((state) => ({
            classes: [...state.classes, {
              id: data.id,
              name: data.name,
              level: data.level,
              subjects: data.subjects || []
            }]
          }))
        }
      },

      updateClass: async (id, schoolClass) => {
        const updates: any = {}
        if (schoolClass.name) updates.name = schoolClass.name
        if (schoolClass.level) updates.level = schoolClass.level

        const { error } = await supabase.from('classes').update(updates).eq('id', id)
        
        if (error) {
          console.error('❌ updateClass error:', error)
          throw error
        }

        set((state) => ({
          classes: state.classes.map(c => c.id === id ? { ...c, ...schoolClass } : c)
        }))
      },

      deleteClass: async (id) => {
        await supabase.from('classes').update({ is_active: false }).eq('id', id)
        set((state) => ({ classes: state.classes.filter(c => c.id !== id) }))
      },

      getClass: (id) => get().classes.find(c => c.id === id),

      // Students
      fetchStudents: async () => {
        const currentSchoolId = 'default'
        const { data } = await supabase.from('students').select('*').eq('school_id', currentSchoolId).eq('is_active', true)
        if (data) set({ students: data.map((s: any) => ({
          id: s.id, name: s.full_name, classId: s.class_id, codeMassar: s.code_massar, parentPhone: s.parent_phone, is_active: s.is_active
        }))})
      },

      addStudent: async (student) => {
        try {
          const currentSchoolId = 'default'
          const currentAcademicYear = get().academicYear
          
          const { data, error } = await supabase.from('students').insert([{
            school_id: currentSchoolId, 
            full_name: student.name, 
            class_id: student.classId || null,
            code_massar: (student as any).code_massar || student.codeMassar || null, 
            parent_phone: student.parentPhone || null, 
            academic_year: currentAcademicYear,
            is_active: true
          }]).select().single()
          
          if (error) {
            console.error('❌ Supabase Add Student Error:', error)
            alert('Error adding student: ' + error.message)
            throw error
          }
          
          if (data) {
            set((state) => ({ students: [...state.students, { ...student, id: data.id }] }))

          }
        } catch (err) {
          console.error('❌ Unexpected Error adding student:', err)
          throw err
        }
      },

      addBulkStudents: async (studentsToImport) => {
        try {
          const currentSchoolId = 'default'
          const currentAcademicYear = get().academicYear

          // 🔍 Debug: Log Supabase configuration
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
          const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
          

          // Validate input
          if (!studentsToImport || studentsToImport.length === 0) {
            return { success: 0, errors: 0, message: 'No students to import' }
          }

          const studentsToInsert = studentsToImport.map(student => ({
            school_id: currentSchoolId,
            full_name: student.name,
            class_id: student.classId || null,
            code_massar: student.codeMassar || (student as any).code_massar || null,  // ✅ camelCase first, then snake_case fallback
            parent_phone: student.parentPhone || null,
            academic_year: currentAcademicYear,
            is_active: true
          }))



          const { data, error } = await supabase
            .from('students')
            .insert(studentsToInsert)
            .select()

          if (error) {
            console.error('❌ Bulk Import Error:', {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            })
            throw new Error(`Supabase insert failed: ${error.message}`)
          }

          if (data && data.length > 0) {
            const newStudents = data.map((s: any) => ({
              id: s.id,
              name: s.full_name,
              classId: s.class_id,
              codeMassar: s.code_massar,  // ✅ DB snake_case → TS camelCase
              parentPhone: s.parent_phone,
              is_active: s.is_active
            }))

            set((state) => ({
              students: [...state.students, ...newStudents]
            }))


            return { success: data.length, errors: 0, message: `Imported ${data.length} students` }
          }

          console.warn('⚠️ No data returned from insert')
          return { success: 0, errors: 0, message: 'No data returned from insert' }
        } catch (error: any) {
          console.error('❌ Bulk Import Exception:', {
            message: error.message,
            stack: error.stack
          })
          return { 
            success: 0, 
            errors: studentsToImport.length,
            message: error.message || 'Failed to import students'
          }
        }
      },

      updateStudent: async (id, student) => {
        const updates: any = {}
        if (student.name) updates.full_name = student.name
        if (student.classId) updates.class_id = student.classId
        if (student.codeMassar) updates.code_massar = student.codeMassar  // ✅ camelCase → snake_case
        if (student.parentPhone) updates.parent_phone = student.parentPhone
        await supabase.from('students').update(updates).eq('id', id)
        set((state) => ({ students: state.students.map(s => s.id === id ? { ...s, ...student } : s) }))
      },

      deleteStudent: async (id) => {
        await supabase.from('students').update({ is_active: false }).eq('id', id)
        set((state) => ({ students: state.students.filter(s => s.id !== id) }))
      },

      getStudent: (id) => get().students.find(s => s.id === id),

      // Salles
      fetchSalles: async () => {
        const currentSchoolId = 'default'
        const { data } = await supabase.from('salles').select('*').eq('school_id', currentSchoolId).eq('is_active', true)
        if (data) set({ salles: data.map((s: any) => ({ id: s.id, name: s.name, capacity: s.capacity, type: s.type }))})
      },

      addSalle: async (salle) => {
        const currentSchoolId = 'default'
        const { data } = await supabase.from('salles').insert([{
          school_id: currentSchoolId, name: salle.name, capacity: salle.capacity, type: salle.type, is_active: true
        }]).select().single()
        if (data) set((state) => ({ salles: [...state.salles, { ...salle, id: data.id }] }))
      },

      updateSalle: async (id, salle) => {
        const updates: any = {}
        if (salle.name) updates.name = salle.name
        if (salle.capacity !== undefined) updates.capacity = salle.capacity
        if (salle.type) updates.type = salle.type
        await supabase.from('salles').update(updates).eq('id', id)
        set((state) => ({ salles: state.salles.map(s => s.id === id ? { ...s, ...salle } : s) }))
      },

      deleteSalle: async (id) => {
        await supabase.from('salles').update({ is_active: false }).eq('id', id)
        set((state) => ({ salles: state.salles.filter(s => s.id !== id) }))
      },

      // Timetables
      saveTimetables: async (timetables) => {
        const currentSchoolId = 'default'

        // Save to Supabase
        try {
          // Convert timetables object to array for storage
          const timetableEntries = Object.entries(timetables).map(([classId, schedule]) => ({
            id: `timetable-${currentSchoolId}-${classId}`,
            school_id: currentSchoolId,
            class_id: classId,
            schedule: schedule,
            updated_at: new Date().toISOString()
          }))

          // Upsert timetables (insert or update)
          const { error } = await supabase
            .from('timetables')
            .upsert(timetableEntries, {
              onConflict: 'id'
            })

          if (error) {
            if (error.code === '42P01') {
              console.warn('⚠️ timetables table does not exist. Please create it in Supabase.')
            } else if (error.code === '23505') {
              console.error('❌ Duplicate key error. Make sure timetables table has a unique constraint on id column.')
            } else {
              console.error('Error saving timetables to Supabase:', error)
            }
          }
        } catch (error) {
          console.error('Error saving timetables to Supabase:', error)
        }

        // Also update local state
        set({ timetables })
        get().forceSave()
      },
      getTimetable: (classId) => get().timetables[classId],
      clearAllTimetables: () => { set({ timetables: {} }); get().forceSave() },

      // Replacements, Absences, etc. (Can be implemented similarly)
      addReplacement: async (replacement) => { set((state) => ({ replacements: [...state.replacements, { ...replacement, id: generateId() }] })); get().forceSave() },
      deleteReplacement: async (id) => { set((state) => ({ replacements: state.replacements.filter(r => r.id !== id) })); get().forceSave() },
      clearAllReplacements: () => { set({ replacements: [] }); get().forceSave() },
      addAbsence: async (absence) => { set((state) => ({ absences: [...state.absences, { ...absence, id: generateId() }] })); get().forceSave() },
      deleteAbsence: async (id) => { set((state) => ({ absences: state.absences.filter(a => a.id !== id) })); get().forceSave() },

      // Custom subjects/levels
      addCustomSubject: async (name) => {
        const currentSchoolId = 'default'
        const { data } = await supabase.from('subjects').insert([{ school_id: currentSchoolId, name, is_active: true }]).select().single()
        if (data) set((state) => ({ customSubjects: [...state.customSubjects, { id: data.id, name }] }))
      },
      deleteCustomSubject: async (id) => {
        await supabase.from('subjects').update({ is_active: false }).eq('id', id)
        set((state) => ({ customSubjects: state.customSubjects.filter(s => s.id !== id) }))
      },
      addCustomLevel: async (name) => {
        const currentSchoolId = 'default'
        const { data } = await supabase.from('levels').insert([{ school_id: currentSchoolId, name, is_active: true }]).select().single()
        if (data) set((state) => ({ customLevels: [...state.customLevels, { id: data.id, name }] }))
      },

      syncAllToSupabase: async () => {
        const state = get()
        const currentSchoolId = 'default'
        const academicYear = state.academicYear
        


        try {
          // 1. Sync Subjects first (no dependencies)
          const subjectMap: Record<string, string> = {}
          if (state.customSubjects.length > 0) {

            for (const s of state.customSubjects) {
              const { data, error } = await supabase.from('subjects')
                .upsert({ school_id: currentSchoolId, name: s.name, is_active: true }, { onConflict: 'school_id,name' })
                .select().single()
              if (data) subjectMap[s.name] = data.id
            }
          }

          // 2. Sync Teachers
          if (state.teachers.length > 0) {

            const teachersToSync = state.teachers.map(t => ({
              school_id: currentSchoolId,
              full_name: t.name,
              max_hours_per_week: t.maxHoursPerWeek,
              subjects: t.subjects,
              levels: t.levels,
              is_vacataire: t.isVacataire,
              availability: t.availability || {},
              is_active: true
            }))
            await supabase.from('teachers').upsert(teachersToSync, { onConflict: 'school_id,full_name' })
          }

          // 3. Sync Classes (Important: we need these IDs for students)

          const classIdMap: Record<string, string> = {}
          for (const c of state.classes) {
            const { data, error } = await supabase.from('classes')
              .upsert({
                school_id: currentSchoolId,
                name: c.name,
                level: c.level,
                max_students: c.max_students || 30,
                is_active: true
              }, { onConflict: 'school_id,name' })
              .select().single()
            
            if (data) {
              classIdMap[c.id] = data.id // Map old local ID to new Supabase UUID
            } else if (error) {
              console.error(`Error syncing class ${c.name}:`, error)
            }
          }

          // 4. Sync Students (Using the new class IDs)
          if (state.students.length > 0) {

            const studentsToSync = state.students.map(s => ({
              school_id: currentSchoolId,
              full_name: s.name,
              class_id: classIdMap[s.classId || ''] || null, // Map to new UUID
              code_massar: s.codeMassar || (s as any).code_massar || null,
              parent_phone: s.parentPhone || null,
              academic_year: academicYear,
              is_active: true
            }))
            
            // Chunk students to avoid large payload errors
            const chunkSize = 50
            for (let i = 0; i < studentsToSync.length; i += chunkSize) {
              const chunk = studentsToSync.slice(i, i + chunkSize)
              const { error } = await supabase.from('students').upsert(chunk, { onConflict: 'school_id,full_name,academic_year' })
              if (error) console.error('Error syncing student chunk:', error)
            }
          }

          // 5. Sync Salles
          if (state.salles.length > 0) {

            const sallesToSync = state.salles.map(s => ({
              school_id: currentSchoolId,
              name: s.name,
              capacity: s.capacity,
              type: s.type,
              is_active: true
            }))
            await supabase.from('salles').upsert(sallesToSync, { onConflict: 'school_id,name' })
          }

          // 6. Sync Timetables
          if (state.timetables && Object.keys(state.timetables).length > 0) {

            const timetablesToSync = Object.entries(state.timetables).map(([classId, schedule]) => ({
              school_id: currentSchoolId,
              class_id: classIdMap[classId] || classId,
              schedule: schedule,
              academic_year: academicYear
            }))
            await supabase.from('timetables').upsert(timetablesToSync, { onConflict: 'school_id,class_id,academic_year' })
          }

          // 7. Sync Replacements
          if (state.replacements && state.replacements.length > 0) {

            const replacementsToSync = state.replacements.map(r => ({
              school_id: currentSchoolId,
              teacher_id: r.teacherId,
              replacing_teacher_id: r.replacingTeacherId,
              class_id: classIdMap[r.classId] || r.classId,
              date: r.date,
              period: r.period,
              academic_year: academicYear
            }))
            await supabase.from('replacements').upsert(replacementsToSync)
          }


        } catch (error) {
          console.error('❌ Bulk sync failed:', error)
          throw error
        }
      },

      forceSave: () => {
        const state = get()
        const dataOnly: any = {}
        Object.keys(state).forEach(key => { if (typeof (state as any)[key] !== 'function') dataOnly[key] = (state as any)[key] })
        customStorage.setItem(STORE_KEY, { state: dataOnly, version: 0 })
      },

      exportBackup: () => JSON.stringify(get()),
      importBackup: (backupData) => {
        try {
          const parsed = JSON.parse(backupData)
          // Handle both wrapped {state: {...}} and direct {...} formats
          const actualData = parsed.state || parsed
          

          
          if (!actualData || typeof actualData !== 'object') {
            throw new Error('Invalid backup format')
          }

          set((state) => ({
            ...state,
            ...actualData,
            // Ensure functions are not overwritten
            forceSave: state.forceSave,
            fetchAllData: state.fetchAllData,
            importBackup: state.importBackup,
            syncAllToSupabase: state.syncAllToSupabase
          }))
          
          return true
        } catch (err) {
          console.error('❌ Import Backup Error:', err)
          return false
        }
      },
      _autoBackup: () => { try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ data: get(), timestamp: new Date().toISOString() })) } catch (e) { console.warn('Auto-backup failed:', e) } }
    }),
    {
      name: STORE_KEY,
      storage: customStorage,
      onRehydrateStorage: () => (state) => {
        // Always fetch from Supabase, even if localStorage is empty (first visit)
        setTimeout(() => useSchoolStore.getState().fetchAllData(), 0)
        if (state) {
          setInterval(() => state._autoBackup(), 5 * 60 * 1000)
        }
      }
    }
  )
)


