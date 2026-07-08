// src/store/massarGradesStore.ts - Massar Grades Store with Analytics

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MassarGrade } from '../utils/massarGradesParser'

export interface ClassAnalytics {
  classId: string
  className: string
  subject: string
  examType: string
  totalStudents: number
  averageGrade: number // معدل القسم
  highestGrade: number // أعلى نقطة
  lowestGrade: number // أقل نقطة
  successRate: number // نسبة النجاح
  excellentCount: number // متفوقون (>16)
  averageCount: number // متوسطون (10-16)
  strugglingCount: number // متعثرون (<10)
  gradeDistribution: GradeDistribution[]
}

export interface GradeDistribution {
  range: string
  rangeAr: string
  count: number
  percentage: number
}

export interface StudentAnalysis {
  studentCode: string
  studentName: string
  grade: number
  performanceLevel: 'excellent' | 'average' | 'struggling'
  performanceLevelAr: 'متفوق' | 'متوسط' | 'متعثر'
  rank: number
}

export interface MassarGradesStore {
  grades: MassarGrade[]
  isLoading: boolean
  error: string | null
  
  // Actions
  addMassarGrades: (grades: MassarGrade[]) => void
  clearGrades: () => void
  deleteGrade: (studentCode: string) => void
  
  // Analytics
  getClassAnalytics: (classId: string, subject?: string) => ClassAnalytics | null
  getStudentAnalysis: (classId: string, subject?: string) => StudentAnalysis[]
  getTopStudents: (classId: string, limit?: number) => StudentAnalysis[]
  getStrugglingStudents: (classId: string) => StudentAnalysis[]
  
  // Export
  generateReportData: (classId: string) => ReportData
}

export interface ReportData {
  className: string
  subject: string
  examType: string
  totalStudents: number
  averageGrade: number
  successRate: number
  highestGrade: number
  lowestGrade: number
  topStudents: StudentAnalysis[]
  strugglingStudents: StudentAnalysis[]
  gradeDistribution: GradeDistribution[]
  generatedAt: string
}

export const useMassarGradesStore = create<MassarGradesStore>()(
  persist(
    (set, get) => ({
      grades: [],
      isLoading: false,
      error: null,

      addMassarGrades: (grades) => {
        set((state) => {
          // Merge with existing grades, avoiding duplicates
          const existingCodes = new Set(state.grades.map(g => g.studentCode))
          const newGrades = grades.filter(g => !existingCodes.has(g.studentCode))
          
          return {
            grades: [...state.grades, ...newGrades],
            error: null
          }
        })
      },

      clearGrades: () => {
        set({ grades: [], error: null })
      },

      deleteGrade: (studentCode) => {
        set((state) => ({
          grades: state.grades.filter(g => g.studentCode !== studentCode)
        }))
      },

      getClassAnalytics: (classId, subject) => {
        const state = get()
        const classGrades = state.grades.filter(g => 
          g.classId === classId && (!subject || g.subject === subject)
        )

        if (classGrades.length === 0) return null

        const grades = classGrades.map(g => g.grade)
        const totalStudents = classGrades.length
        
        // Calculate average - معدل القسم
        const averageGrade = grades.reduce((sum, g) => sum + g, 0) / totalStudents
        
        // Highest and lowest - أعلى وأقل نقطة
        const highestGrade = Math.max(...grades)
        const lowestGrade = Math.min(...grades)
        
        // Success rate - نسبة النجاح (>= 10)
        const successCount = grades.filter(g => g >= 10).length
        const successRate = (successCount / totalStudents) * 100
        
        // Performance levels
        const excellentCount = grades.filter(g => g > 16).length // متفوقون
        const averageCount = grades.filter(g => g >= 10 && g <= 16).length // متوسطون
        const strugglingCount = grades.filter(g => g < 10).length // متعثرون
        
        // Grade distribution - توزيع النقط
        const gradeDistribution: GradeDistribution[] = [
          { range: '0-4', rangeAr: '0-4', count: grades.filter(g => g >= 0 && g < 4).length, percentage: 0 },
          { range: '4-8', rangeAr: '4-8', count: grades.filter(g => g >= 4 && g < 8).length, percentage: 0 },
          { range: '8-12', rangeAr: '8-12', count: grades.filter(g => g >= 8 && g < 12).length, percentage: 0 },
          { range: '12-16', rangeAr: '12-16', count: grades.filter(g => g >= 12 && g < 16).length, percentage: 0 },
          { range: '16-20', rangeAr: '16-20', count: grades.filter(g => g >= 16 && g <= 20).length, percentage: 0 }
        ]
        
        // Calculate percentages
        gradeDistribution.forEach(d => {
          d.percentage = (d.count / totalStudents) * 100
        })

        const firstGrade = classGrades[0]

        return {
          classId,
          className: firstGrade.classId,
          subject: firstGrade.subject,
          examType: firstGrade.examType,
          totalStudents,
          averageGrade: Number(averageGrade.toFixed(2)),
          highestGrade,
          lowestGrade,
          successRate: Number(successRate.toFixed(2)),
          excellentCount,
          averageCount,
          strugglingCount,
          gradeDistribution
        }
      },

      getStudentAnalysis: (classId, subject) => {
        const state = get()
        const classGrades = state.grades.filter(g => 
          g.classId === classId && (!subject || g.subject === subject)
        )

        if (classGrades.length === 0) return []

        // Sort by grade descending
        const sorted = [...classGrades].sort((a, b) => b.grade - a.grade)

        return sorted.map((grade, index) => ({
          studentCode: grade.studentCode,
          studentName: grade.studentName,
          grade: grade.grade,
          performanceLevel: grade.grade > 16 ? 'excellent' : grade.grade >= 10 ? 'average' : 'struggling',
          performanceLevelAr: grade.grade > 16 ? 'متفوق' : grade.grade >= 10 ? 'متوسط' : 'متعثر',
          rank: index + 1
        }))
      },

      getTopStudents: (classId, limit = 10) => {
        const analysis = get().getStudentAnalysis(classId)
        return analysis.filter(s => s.performanceLevel === 'excellent').slice(0, limit)
      },

      getStrugglingStudents: (classId) => {
        const analysis = get().getStudentAnalysis(classId)
        return analysis.filter(s => s.performanceLevel === 'struggling')
      },

      generateReportData: (classId) => {
        const analytics = get().getClassAnalytics(classId)
        
        if (!analytics) {
          throw new Error('No data available for this class')
        }

        return {
          className: analytics.className,
          subject: analytics.subject,
          examType: analytics.examType,
          totalStudents: analytics.totalStudents,
          averageGrade: analytics.averageGrade,
          successRate: analytics.successRate,
          highestGrade: analytics.highestGrade,
          lowestGrade: analytics.lowestGrade,
          topStudents: get().getTopStudents(classId, 5),
          strugglingStudents: get().getStrugglingStudents(classId),
          gradeDistribution: analytics.gradeDistribution,
          generatedAt: new Date().toISOString()
        }
      }
    }),
    {
      name: 'massar-grades-storage'
    }
  )
)

