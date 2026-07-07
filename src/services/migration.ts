/**
 * Migration Tool - Migrate localStorage data to Supabase Cloud
 * 
 * Run this once to transfer all existing data from localStorage to Supabase
 */

import { cloudSync } from './cloudSync'
import { smartLoad } from '../utils/storage'

interface MigrationResult {
  success: boolean
  migrated: {
    teachers: number
    classes: number
    students: number
    grades: number
    timetables: number
    replacements: number
    absences: number
    inventory: number
  }
  errors: string[]
}

/**
 * Migrate all data from localStorage to Supabase
 */
export async function migrateToCloud(
  userId: string,
  schoolId: string
): Promise<MigrationResult> {




  const result: MigrationResult = {
    success: true,
    migrated: {
      teachers: 0,
      classes: 0,
      students: 0,
      grades: 0,
      timetables: 0,
      replacements: 0,
      absences: 0,
      inventory: 0
    },
    errors: []
  }

  try {
    // Initialize cloud sync
    cloudSync.initialize(userId, schoolId)

    // Load data from localStorage
    const storedData = smartLoad('elite_school_data_v3')
    
    if (!storedData) {

      return result
    }



    // Migrate Teachers
    if (storedData.teachers && Array.isArray(storedData.teachers)) {

      for (const teacher of storedData.teachers) {
        try {
          await cloudSync.saveTeacher({
            ...teacher,
            school_id: schoolId,
            user_id: userId
          })
          result.migrated.teachers++
        } catch (error: any) {
          result.errors.push(`Teacher ${teacher.full_name}: ${error.message}`)
        }
      }
    }

    // Migrate Classes
    if (storedData.classes && Array.isArray(storedData.classes)) {

      for (const cls of storedData.classes) {
        try {
          await cloudSync.saveClass({
            ...cls,
            school_id: schoolId
          })
          result.migrated.classes++
        } catch (error: any) {
          result.errors.push(`Class ${cls.name}: ${error.message}`)
        }
      }
    }

    // Migrate Students
    if (storedData.students && Array.isArray(storedData.students)) {

      for (const student of storedData.students) {
        try {
          await cloudSync.saveStudent({
            ...student,
            school_id: schoolId
          })
          result.migrated.students++
        } catch (error: any) {
          result.errors.push(`Student ${student.full_name}: ${error.message}`)
        }
      }
    }

    // Migrate Timetables
    if (storedData.timetables) {

      try {
        await cloudSync.saveTimetables(storedData.timetables)
        result.migrated.timetables = 1
      } catch (error: any) {
        result.errors.push(`Timetables: ${error.message}`)
      }
    }

    // Migrate Replacements
    if (storedData.replacements && Array.isArray(storedData.replacements)) {

      for (const replacement of storedData.replacements) {
        try {
          await cloudSync.saveReplacement({
            ...replacement,
            school_id: schoolId
          })
          result.migrated.replacements++
        } catch (error: any) {
          result.errors.push(`Replacement: ${error.message}`)
        }
      }
    }

    // Migrate Absences
    if (storedData.absences && Array.isArray(storedData.absences)) {

      for (const absence of storedData.absences) {
        try {
          await cloudSync.saveAbsence({
            ...absence,
            school_id: schoolId
          })
          result.migrated.absences++
        } catch (error: any) {
          result.errors.push(`Absence: ${error.message}`)
        }
      }
    }

    // Migrate Inventory
    if (storedData.inventory) {

      try {
        if (storedData.inventory.items && Array.isArray(storedData.inventory.items)) {
          for (const item of storedData.inventory.items) {
            await cloudSync.saveStockItem({
              ...item,
              school_id: schoolId
            })
            result.migrated.inventory++
          }
        }
      } catch (error: any) {
        result.errors.push(`Inventory: ${error.message}`)
      }
    }

    // Mark migration as complete
    localStorage.setItem('cloud_migration_complete', 'true')
    localStorage.setItem('cloud_migration_date', new Date().toISOString())



    
    if (result.errors.length > 0) {
      console.warn('⚠️ Errors:', result.errors)
    }

    return result

  } catch (error: any) {
    console.error('❌ Migration failed:', error)
    result.success = false
    result.errors.push(error.message)
    return result
  }
}

/**
 * Check if migration has been completed
 */
export function needsMigration(): boolean {
  const migrated = localStorage.getItem('cloud_migration_complete')
  return migrated !== 'true'
}

/**
 * Get migration info
 */
export function getMigrationInfo(): { completed: boolean; date?: string } {
  const completed = localStorage.getItem('cloud_migration_complete') === 'true'
  const date = localStorage.getItem('cloud_migration_date')
  return { completed, date: date || undefined }
}

/**
 * Reset migration (for testing)
 */
export function resetMigration() {
  localStorage.removeItem('cloud_migration_complete')
  localStorage.removeItem('cloud_migration_date')

}

