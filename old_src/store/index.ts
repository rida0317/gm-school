// src/store/index.ts - Main store aggregator

// Import all focused stores
import { useTeachersStore, useTeachers, useSelectedTeacher, useTeachersLoading, useTeachersError } from './teachersStore'
import { useClassesStore, useClasses, useSelectedClass, useClassesLoading, useClassesError } from './classesStore'
import { useStudentsStore, useStudents, useSelectedStudent, useStudentsByClass, useStudentsLoading, useStudentsError } from './studentsStore'

// Re-export them
export { useTeachersStore, useTeachers, useSelectedTeacher, useTeachersLoading, useTeachersError }
export { useClassesStore, useClasses, useSelectedClass, useClassesLoading, useClassesError }
export { useStudentsStore, useStudents, useSelectedStudent, useStudentsByClass, useStudentsLoading, useStudentsError }

// Import existing stores
export { useAuth } from './AuthContext'
export { useSchoolStore } from './schoolStore'

// Combined store hooks for convenience
export const useSchoolData = () => {
  const teachers = useTeachers()
  const classes = useClasses()
  const students = useStudents()

  return {
    teachers,
    classes,
    students,
    inventory: { items: [] }
  }
}

export const useSchoolStats = () => {
  const teachers = useTeachers()
  const classes = useClasses()
  const students = useStudents()

  return {
    teacherCount: teachers.length,
    classCount: classes.length,
    studentCount: students.length,
    inventoryItemCount: 0,
    lowStockItems: 0
  }
}

// Store initialization and cleanup
export const initializeStores = () => {
  // Initialize any store-specific setup here

}

export const cleanupStores = () => {
  // Cleanup any store-specific resources here

}

// Export types for convenience
export type { TeachersStore } from './teachersStore'
export type { ClassesStore } from './classesStore'
export type { StudentsStore } from './studentsStore'

