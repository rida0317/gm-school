// src/services/conflictDetection.ts - Smart conflict detection service

import type { Teacher, SchoolClass, Timetable, TimetableSlot, TimeSlot } from '../types'

export interface Conflict {
  type: 'teacher' | 'room' | 'class' | 'availability' | 'workload'
  severity: 'error' | 'warning'
  message: string
  details: {
    teacherId?: string
    classId?: string
    roomId?: string
    day: string
    slotIndex: number
    conflictingSlot?: TimetableSlot
  }
}

export interface ConflictDetectionResult {
  conflicts: Conflict[]
  suggestions: ConflictResolutionSuggestion[]
  summary: {
    totalConflicts: number
    errorConflicts: number
    warningConflicts: number
    byType: Record<string, number>
  }
}

export interface ConflictResolutionSuggestion {
  type: 'move' | 'swap' | 'split'
  priority: 'high' | 'medium' | 'low'
  description: string
  action: {
    from: { day: string; slotIndex: number; classId: string }
    to: { day: string; slotIndex: number; classId: string }
  }
  reason: string
}

interface ScheduleContext {
  teachers: Teacher[]
  classes: SchoolClass[]
  timetables: Timetable
  timeSlots: TimeSlot[]
}

export class ConflictDetectionService {
  private context: ScheduleContext

  constructor(context: ScheduleContext) {
    this.context = context
  }

  /**
   * Detect all conflicts in the current timetable
   */
  public detectConflicts(): ConflictDetectionResult {
    const conflicts: Conflict[] = []
    const suggestions: ConflictResolutionSuggestion[] = []

    // Check each class timetable
    Object.entries(this.context.timetables).forEach(([classId, classTimetable]) => {
      Object.entries(classTimetable).forEach(([day, daySlots]) => {
        daySlots.forEach((slot, slotIndex) => {
          if (!slot) return

          // Check teacher conflicts
          const teacherConflicts = this.checkTeacherConflicts(classId, day, slotIndex, slot)
          conflicts.push(...teacherConflicts)

          // Check room conflicts
          const roomConflicts = this.checkRoomConflicts(classId, day, slotIndex, slot)
          conflicts.push(...roomConflicts)

          // Check class conflicts (multiple subjects at same time)
          const classConflicts = this.checkClassConflicts(classId, day, slotIndex, slot)
          conflicts.push(...classConflicts)

          // Check availability conflicts
          const availabilityConflicts = this.checkAvailabilityConflicts(classId, day, slotIndex, slot)
          conflicts.push(...availabilityConflicts)

          // Check workload conflicts
          const workloadConflicts = this.checkWorkloadConflicts(classId, day, slotIndex, slot)
          conflicts.push(...workloadConflicts)
        })
      })
    })

    // Generate suggestions for conflict resolution
    suggestions.push(...this.generateConflictSuggestions(conflicts))

    // Create summary
    const summary = this.createConflictSummary(conflicts)

    return {
      conflicts,
      suggestions,
      summary
    }
  }

  /**
   * Check for teacher scheduling conflicts
   */
  private checkTeacherConflicts(classId: string, day: string, slotIndex: number, slot: TimetableSlot): Conflict[] {
    const conflicts: Conflict[] = []
    const teacher = this.context.teachers.find(t => t.id === slot.teacherId)
    
    if (!teacher) {
      conflicts.push({
        type: 'teacher',
        severity: 'error',
        message: `Teacher with ID ${slot.teacherId} not found`,
        details: { teacherId: slot.teacherId, classId, day, slotIndex }
      })
      return conflicts
    }

    // Check if teacher is already scheduled elsewhere
    Object.entries(this.context.timetables).forEach(([otherClassId, otherTimetable]) => {
      if (otherClassId === classId) return

      const otherSlot = otherTimetable[day]?.[slotIndex]
      if (otherSlot && otherSlot.teacherId === slot.teacherId) {
        conflicts.push({
          type: 'teacher',
          severity: 'error',
          message: `Teacher ${teacher.name} is already scheduled in class ${otherClassId}`,
          details: { 
            teacherId: slot.teacherId, 
            classId, 
            day, 
            slotIndex,
            conflictingSlot: otherSlot
          }
        })
      }
    })

    // Check if teacher has availability for this slot
    if (teacher.availability?.[day]?.includes(slotIndex)) {
      conflicts.push({
        type: 'availability',
        severity: 'error',
        message: `Teacher ${teacher.name} is not available for this time slot`,
        details: { teacherId: slot.teacherId, classId, day, slotIndex }
      })
    }

    return conflicts
  }

  /**
   * Check for room scheduling conflicts
   */
  private checkRoomConflicts(classId: string, day: string, slotIndex: number, slot: TimetableSlot): Conflict[] {
    const conflicts: Conflict[] = []
    
    if (!slot.roomId) return conflicts

    // Check if room is already occupied
    Object.entries(this.context.timetables).forEach(([otherClassId, otherTimetable]) => {
      if (otherClassId === classId) return

      const otherSlot = otherTimetable[day]?.[slotIndex]
      if (otherSlot && otherSlot.roomId === slot.roomId) {
        const otherClass = this.context.classes.find(c => c.id === otherClassId)
        const currentClass = this.context.classes.find(c => c.id === classId)
        
        conflicts.push({
          type: 'room',
          severity: 'error',
          message: `Room is already occupied by ${otherClass?.name || otherClassId}`,
          details: { 
            roomId: slot.roomId, 
            classId, 
            day, 
            slotIndex,
            conflictingSlot: otherSlot
          }
        })
      }
    })

    return conflicts
  }

  /**
   * Check for class scheduling conflicts
   */
  private checkClassConflicts(classId: string, day: string, slotIndex: number, slot: TimetableSlot): Conflict[] {
    // This would check if the same class has multiple subjects at the same time
    // Since we're checking per class, this is less likely, but could happen with data corruption
    return []
  }

  /**
   * Check for teacher availability conflicts
   */
  private checkAvailabilityConflicts(classId: string, day: string, slotIndex: number, slot: TimetableSlot): Conflict[] {
    const conflicts: Conflict[] = []
    const teacher = this.context.teachers.find(t => t.id === slot.teacherId)
    
    if (!teacher) return conflicts

    // Check if this creates an unreasonable gap in teacher's schedule
    const daySchedule = this.getDayScheduleForTeacher(slot.teacherId, day)
    const currentPeriod = slotIndex
    
    // Check for excessive gaps (more than 2 periods)
    const gaps = this.analyzeTeacherGaps(daySchedule, currentPeriod)
    if (gaps.hasExcessiveGaps) {
      conflicts.push({
        type: 'availability',
        severity: 'warning',
        message: `This scheduling creates excessive gaps in ${teacher.name}'s schedule`,
        details: { teacherId: slot.teacherId, classId, day, slotIndex }
      })
    }

    return conflicts
  }

  /**
   * Check for teacher workload conflicts
   */
  private checkWorkloadConflicts(classId: string, day: string, slotIndex: number, slot: TimetableSlot): Conflict[] {
    const conflicts: Conflict[] = []
    const teacher = this.context.teachers.find(t => t.id === slot.teacherId)
    
    if (!teacher) return conflicts

    // Check daily workload limit
    const dailyHours = this.getTeacherDailyHours(slot.teacherId, day)
    const maxDailyHours = Math.ceil(teacher.maxHoursPerWeek / 5) + (teacher.isVacataire ? 1 : 0)
    
    if (dailyHours >= maxDailyHours) {
      conflicts.push({
        type: 'workload',
        severity: 'warning',
        message: `${teacher.name} is approaching daily workload limit`,
        details: { teacherId: slot.teacherId, classId, day, slotIndex }
      })
    }

    // Check weekly workload
    const weeklyHours = this.getTeacherWeeklyHours(slot.teacherId)
    if (weeklyHours >= teacher.maxHoursPerWeek) {
      conflicts.push({
        type: 'workload',
        severity: 'error',
        message: `${teacher.name} has exceeded weekly workload limit`,
        details: { teacherId: slot.teacherId, classId, day, slotIndex }
      })
    }

    return conflicts
  }

  /**
   * Generate suggestions for conflict resolution
   */
  private generateConflictSuggestions(conflicts: Conflict[]): ConflictResolutionSuggestion[] {
    const suggestions: ConflictResolutionSuggestion[] = []

    conflicts.forEach(conflict => {
      switch (conflict.type) {
        case 'teacher':
          suggestions.push(...this.generateTeacherConflictSuggestions(conflict))
          break
        case 'room':
          suggestions.push(...this.generateRoomConflictSuggestions(conflict))
          break
        case 'availability':
          suggestions.push(...this.generateAvailabilityConflictSuggestions(conflict))
          break
      }
    })

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  /**
   * Generate teacher conflict resolution suggestions
   */
  private generateTeacherConflictSuggestions(conflict: Conflict): ConflictResolutionSuggestion[] {
    const suggestions: ConflictResolutionSuggestion[] = []
    const { classId, day, slotIndex } = conflict.details

    if (!classId || !day || slotIndex === undefined) return suggestions

    // Find alternative time slots for this teacher
    const teacherId = conflict.details.teacherId
    const availableSlots = this.findAvailableSlotsForTeacher(teacherId!, classId, day, slotIndex)

    availableSlots.forEach(availableSlot => {
      suggestions.push({
        type: 'move',
        priority: 'high',
        description: `Move ${classId} to ${availableSlot.day} period ${availableSlot.slotIndex + 1}`,
        action: {
          from: { day, slotIndex, classId },
          to: { day: availableSlot.day, slotIndex: availableSlot.slotIndex, classId }
        },
        reason: 'Teacher availability conflict resolution'
      })
    })

    return suggestions
  }

  /**
   * Generate room conflict resolution suggestions
   */
  private generateRoomConflictSuggestions(conflict: Conflict): ConflictResolutionSuggestion[] {
    const suggestions: ConflictResolutionSuggestion[] = []
    const { classId, day, slotIndex, roomId } = conflict.details

    if (!classId || !day || slotIndex === undefined || !roomId) return suggestions

    // Find alternative rooms
    const availableRooms = this.findAvailableRooms(classId, day, slotIndex)
    
    availableRooms.forEach(availableRoom => {
      suggestions.push({
        type: 'move',
        priority: 'medium',
        description: `Move ${classId} to room ${availableRoom}`,
        action: {
          from: { day, slotIndex, classId },
          to: { day, slotIndex, classId }
        },
        reason: 'Room availability conflict resolution'
      })
    })

    return suggestions
  }

  /**
   * Generate availability conflict resolution suggestions
   */
  private generateAvailabilityConflictSuggestions(conflict: Conflict): ConflictResolutionSuggestion[] {
    const suggestions: ConflictResolutionSuggestion[] = []
    const { classId, day, slotIndex } = conflict.details

    if (!classId || !day || slotIndex === undefined) return suggestions

    // Find alternative time slots when teacher is available
    const teacherId = conflict.details.teacherId
    const availableSlots = this.findAvailableSlotsForTeacher(teacherId!, classId, day, slotIndex)

    availableSlots.forEach(availableSlot => {
      suggestions.push({
        type: 'move',
        priority: 'high',
        description: `Reschedule to ${availableSlot.day} period ${availableSlot.slotIndex + 1} when teacher is available`,
        action: {
          from: { day, slotIndex, classId },
          to: { day: availableSlot.day, slotIndex: availableSlot.slotIndex, classId }
        },
        reason: 'Teacher availability requirement'
      })
    })

    return suggestions
  }

  /**
   * Helper methods for conflict detection
   */
  private getDayScheduleForTeacher(teacherId: string, day: string): TimetableSlot[] {
    const slots: TimetableSlot[] = []
    
    Object.entries(this.context.timetables).forEach(([classId, classTimetable]) => {
      const daySlots = classTimetable[day]
      if (daySlots) {
        daySlots.forEach((slot, index) => {
          if (slot && slot.teacherId === teacherId) {
            slots.push({ ...slot, day, slotIndex: index })
          }
        })
      }
    })

    return slots.sort((a, b) => (a.slotIndex || 0) - (b.slotIndex || 0))
  }

  private analyzeTeacherGaps(daySchedule: TimetableSlot[], currentPeriod: number): { hasExcessiveGaps: boolean } {
    // Simple gap analysis - could be enhanced with more sophisticated logic
    const periods = daySchedule.map(s => s.slotIndex || 0).sort((a, b) => a - b)
    
    for (let i = 0; i < periods.length - 1; i++) {
      if (periods[i + 1] - periods[i] > 2) {
        return { hasExcessiveGaps: true }
      }
    }

    return { hasExcessiveGaps: false }
  }

  private getTeacherDailyHours(teacherId: string, day: string): number {
    let hours = 0
    Object.entries(this.context.timetables).forEach(([classId, classTimetable]) => {
      const daySlots = classTimetable[day]
      if (daySlots) {
        hours += daySlots.filter(slot => slot && slot.teacherId === teacherId).length
      }
    })
    return hours
  }

  private getTeacherWeeklyHours(teacherId: string): number {
    let hours = 0
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    
    days.forEach(day => {
      hours += this.getTeacherDailyHours(teacherId, day)
    })
    
    return hours
  }

  private findAvailableSlotsForTeacher(teacherId: string, classId: string, currentDay: string, currentSlot: number): Array<{ day: string; slotIndex: number }> {
    const availableSlots: Array<{ day: string; slotIndex: number }> = []
    const teacher = this.context.teachers.find(t => t.id === teacherId)
    
    if (!teacher) return availableSlots

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    
    days.forEach(day => {
      const daySlots = this.context.timetables[classId]?.[day] || []
      
      daySlots.forEach((slot, slotIndex) => {
        // Skip current slot
        if (day === currentDay && slotIndex === currentSlot) return
        
        // Check if slot is empty and teacher is available
        if (!slot && (!teacher.availability?.[day]?.includes(slotIndex))) {
          // Check if teacher is free at this time
          const isTeacherFree = this.isTeacherFreeAtTime(teacherId, day, slotIndex)
          if (isTeacherFree) {
            availableSlots.push({ day, slotIndex })
          }
        }
      })
    })

    return availableSlots
  }

  private findAvailableRooms(classId: string, day: string, slotIndex: number): string[] {
    const availableRooms: string[] = []
    const usedRooms = new Set<string>()

    // Find all rooms currently in use at this time
    Object.entries(this.context.timetables).forEach(([otherClassId, otherTimetable]) => {
      if (otherClassId === classId) return
      const slot = otherTimetable[day]?.[slotIndex]
      if (slot?.roomId) {
        usedRooms.add(slot.roomId)
      }
    })

    // Get all available rooms from classes
    this.context.classes.forEach(cls => {
      if (cls.roomId && !usedRooms.has(cls.roomId)) {
        availableRooms.push(cls.roomId)
      }
    })

    return availableRooms
  }

  private isTeacherFreeAtTime(teacherId: string, day: string, slotIndex: number): boolean {
    let isFree = true
    
    Object.entries(this.context.timetables).forEach(([classId, classTimetable]) => {
      const slot = classTimetable[day]?.[slotIndex]
      if (slot && slot.teacherId === teacherId) {
        isFree = false
      }
    })

    return isFree
  }

  private createConflictSummary(conflicts: Conflict[]): ConflictDetectionResult['summary'] {
    const summary = {
      totalConflicts: conflicts.length,
      errorConflicts: 0,
      warningConflicts: 0,
      byType: {} as Record<string, number>
    }

    conflicts.forEach(conflict => {
      if (conflict.severity === 'error') summary.errorConflicts++
      else summary.warningConflicts++

      summary.byType[conflict.type] = (summary.byType[conflict.type] || 0) + 1
    })

    return summary
  }
}

// Utility function to create conflict detection service
export const createConflictDetector = (context: ScheduleContext): ConflictDetectionService => {
  return new ConflictDetectionService(context)
}

export default ConflictDetectionService

