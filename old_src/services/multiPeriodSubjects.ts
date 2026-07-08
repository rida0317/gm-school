// src/services/multiPeriodSubjects.ts - Multi-period subjects service

import type { SchoolClass, Timetable, TimetableSlot, ClassSubject } from '../types'

export interface MultiPeriodSubject {
  id: string
  name: string
  classId: string
  totalHours: number
  consecutiveHours: number
  daysOfWeek: string[]
  preferredTimeSlots: number[]
  isSplitAllowed: boolean
}

export interface MultiPeriodAssignment {
  id: string
  subjectId: string
  classId: string
  day: string
  startSlotIndex: number
  endSlotIndex: number
  teacherId: string
  roomId?: string
}

export interface MultiPeriodConflict {
  type: 'overlap' | 'teacher' | 'room' | 'consecutive'
  message: string
  details: {
    subjectId: string
    day: string
    slotIndex: number
    conflictingAssignment?: MultiPeriodAssignment
  }
}

export class MultiPeriodSubjectsService {
  private timetables: Timetable
  private classes: SchoolClass[]

  constructor(timetables: Timetable, classes: SchoolClass[]) {
    this.timetables = timetables
    this.classes = classes
  }

  /**
   * Create a multi-period subject configuration
   */
  public createMultiPeriodSubject(
    name: string,
    classId: string,
    totalHours: number,
    consecutiveHours: number,
    daysOfWeek: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    preferredTimeSlots: number[] = [],
    isSplitAllowed: boolean = false
  ): MultiPeriodSubject {
    return {
      id: this.generateId(),
      name,
      classId,
      totalHours,
      consecutiveHours,
      daysOfWeek,
      preferredTimeSlots,
      isSplitAllowed
    }
  }

  /**
   * Find optimal time slots for a multi-period subject
   */
  public findOptimalSlots(
    multiPeriodSubject: MultiPeriodSubject,
    availableTeachers: string[],
    preferredRoom?: string
  ): MultiPeriodAssignment[] {
    const assignments: MultiPeriodAssignment[] = []
    const remainingHours = multiPeriodSubject.totalHours
    const consecutiveHours = multiPeriodSubject.consecutiveHours
    const classId = multiPeriodSubject.classId

    // Get class timetable
    const classTimetable = this.timetables[classId] || {}
    const days = multiPeriodSubject.daysOfWeek

    // Strategy 1: Try to place consecutive periods first
    if (consecutiveHours > 1) {
      const consecutiveAssignments = this.findConsecutiveSlots(
        multiPeriodSubject,
        classTimetable,
        days,
        availableTeachers,
        preferredRoom,
        remainingHours
      )
      assignments.push(...consecutiveAssignments)
    }

    // Strategy 2: Fill remaining hours with single periods if split is allowed
    if (multiPeriodSubject.isSplitAllowed && assignments.length * consecutiveHours < remainingHours) {
      const remainingHoursNeeded = remainingHours - (assignments.length * consecutiveHours)
      const singlePeriodAssignments = this.findSingleSlots(
        multiPeriodSubject,
        classTimetable,
        days,
        availableTeachers,
        preferredRoom,
        remainingHoursNeeded
      )
      assignments.push(...singlePeriodAssignments)
    }

    return assignments
  }

  /**
   * Find consecutive time slots for multi-period subjects
   */
  private findConsecutiveSlots(
    multiPeriodSubject: MultiPeriodSubject,
    classTimetable: any,
    days: string[],
    availableTeachers: string[],
    preferredRoom: string | undefined,
    totalHours: number
  ): MultiPeriodAssignment[] {
    const assignments: MultiPeriodAssignment[] = []
    const consecutiveHours = multiPeriodSubject.consecutiveHours
    let hoursPlaced = 0

    // Sort days by preference
    const sortedDays = this.sortDaysByPreference(days, multiPeriodSubject.preferredTimeSlots)

    for (const day of sortedDays) {
      if (hoursPlaced >= totalHours) break

      const daySlots = classTimetable[day] || []
      
      // Find available consecutive slots
      for (let startSlot = 0; startSlot <= daySlots.length - consecutiveHours; startSlot++) {
        if (hoursPlaced >= totalHours) break

        // Check if all consecutive slots are available
        const isAvailable = this.checkConsecutiveAvailability(
          daySlots,
          startSlot,
          consecutiveHours,
          availableTeachers,
          preferredRoom
        )

        if (isAvailable) {
          // Find best teacher for this slot
          const bestTeacher = this.selectBestTeacher(
            availableTeachers,
            day,
            startSlot,
            consecutiveHours
          )

          if (bestTeacher) {
            assignments.push({
              id: this.generateId(),
              subjectId: multiPeriodSubject.id,
              classId: multiPeriodSubject.classId,
              day,
              startSlotIndex: startSlot,
              endSlotIndex: startSlot + consecutiveHours - 1,
              teacherId: bestTeacher,
              roomId: preferredRoom
            })

            hoursPlaced += consecutiveHours

            // Mark slots as occupied
            this.markConsecutiveSlotsOccupied(daySlots, startSlot, consecutiveHours)
          }
        }
      }
    }

    return assignments
  }

  /**
   * Find single time slots for remaining hours
   */
  private findSingleSlots(
    multiPeriodSubject: MultiPeriodSubject,
    classTimetable: any,
    days: string[],
    availableTeachers: string[],
    preferredRoom: string | undefined,
    remainingHours: number
  ): MultiPeriodAssignment[] {
    const assignments: MultiPeriodAssignment[] = []
    let hoursPlaced = 0

    const sortedDays = this.sortDaysByPreference(days, multiPeriodSubject.preferredTimeSlots)

    for (const day of sortedDays) {
      if (hoursPlaced >= remainingHours) break

      const daySlots = classTimetable[day] || []

      for (let slotIndex = 0; slotIndex < daySlots.length; slotIndex++) {
        if (hoursPlaced >= remainingHours) break

        if (!daySlots[slotIndex]) {
          const bestTeacher = this.selectBestTeacher(
            availableTeachers,
            day,
            slotIndex,
            1
          )

          if (bestTeacher) {
            assignments.push({
              id: this.generateId(),
              subjectId: multiPeriodSubject.id,
              classId: multiPeriodSubject.classId,
              day,
              startSlotIndex: slotIndex,
              endSlotIndex: slotIndex,
              teacherId: bestTeacher,
              roomId: preferredRoom
            })

            hoursPlaced += 1
            daySlots[slotIndex] = { subject: multiPeriodSubject.name, teacherId: bestTeacher, roomId: preferredRoom }
          }
        }
      }
    }

    return assignments
  }

  /**
   * Check if consecutive slots are available
   */
  private checkConsecutiveAvailability(
    daySlots: (TimetableSlot | null)[],
    startSlot: number,
    consecutiveHours: number,
    availableTeachers: string[],
    preferredRoom?: string
  ): boolean {
    // Check if all slots in the consecutive range are empty
    for (let i = 0; i < consecutiveHours; i++) {
      if (daySlots[startSlot + i]) {
        return false
      }
    }

    // Check if we have enough available teachers for this time block
    // This is a simplified check - in reality, you'd want to check teacher availability
    return availableTeachers.length > 0
  }

  /**
   * Select the best teacher for a time slot
   */
  private selectBestTeacher(
    availableTeachers: string[],
    day: string,
    slotIndex: number,
    duration: number
  ): string | null {
    // Simple selection logic - could be enhanced with preferences, workload, etc.
    if (availableTeachers.length === 0) return null

    // For now, just return the first available teacher
    // In a real implementation, you'd consider:
    // - Teacher preferences for this time slot
    // - Current workload
    // - Subject expertise
    // - Availability constraints

    return availableTeachers[0]
  }

  /**
   * Mark consecutive slots as occupied
   */
  private markConsecutiveSlotsOccupied(
    daySlots: (TimetableSlot | null)[],
    startSlot: number,
    consecutiveHours: number
  ): void {
    for (let i = 0; i < consecutiveHours; i++) {
      daySlots[startSlot + i] = {
        subject: 'Multi-Period',
        teacherId: 'temp',
        isMultiPeriod: true,
        periodCount: consecutiveHours,
        periodIndex: i
      }
    }
  }

  /**
   * Sort days by preference based on preferred time slots
   */
  private sortDaysByPreference(days: string[], preferredTimeSlots: number[]): string[] {
    // Simple sorting - days with preferred time slots first
    return days.sort((a, b) => {
      const aHasPreferred = preferredTimeSlots.length > 0
      const bHasPreferred = preferredTimeSlots.length > 0
      return aHasPreferred === bHasPreferred ? 0 : (aHasPreferred ? -1 : 1)
    })
  }

  /**
   * Validate multi-period subject assignments
   */
  public validateAssignments(assignments: MultiPeriodAssignment[]): MultiPeriodConflict[] {
    const conflicts: MultiPeriodConflict[] = []

    // Check for overlaps within the same class
    const classAssignments = new Map<string, MultiPeriodAssignment[]>()

    assignments.forEach(assignment => {
      if (!classAssignments.has(assignment.classId)) {
        classAssignments.set(assignment.classId, [])
      }
      classAssignments.get(assignment.classId)!.push(assignment)
    })

    classAssignments.forEach((classAssignmentsList, classId) => {
      // Sort by day and start time
      classAssignmentsList.sort((a, b) => {
        const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
        return dayDiff !== 0 ? dayDiff : a.startSlotIndex - b.startSlotIndex
      })

      // Check for overlaps
      for (let i = 0; i < classAssignmentsList.length - 1; i++) {
        const current = classAssignmentsList[i]
        const next = classAssignmentsList[i + 1]

        if (current.day === next.day) {
          if (current.endSlotIndex >= next.startSlotIndex) {
            conflicts.push({
              type: 'overlap',
              message: `Multi-period subject assignments overlap in ${classId} on ${current.day}`,
              details: {
                subjectId: current.subjectId,
                day: current.day,
                slotIndex: current.startSlotIndex
              }
            })
          }
        }
      }
    })

    return conflicts
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get multi-period subject statistics
   */
  public getMultiPeriodStats(assignments: MultiPeriodAssignment[]): {
    totalSubjects: number
    totalHours: number
    averageConsecutiveHours: number
    conflicts: number
  } {
    const subjectIds = new Set(assignments.map(a => a.subjectId))
    const totalHours = assignments.reduce((sum, a) => sum + (a.endSlotIndex - a.startSlotIndex + 1), 0)
    const consecutiveHours = assignments.reduce((sum, a) => sum + (a.endSlotIndex - a.startSlotIndex + 1), 0)
    const conflicts = this.validateAssignments(assignments).length

    return {
      totalSubjects: subjectIds.size,
      totalHours,
      averageConsecutiveHours: assignments.length > 0 ? consecutiveHours / assignments.length : 0,
      conflicts
    }
  }
}

// Utility function to create multi-period subjects service
export const createMultiPeriodService = (timetables: Timetable, classes: SchoolClass[]): MultiPeriodSubjectsService => {
  return new MultiPeriodSubjectsService(timetables, classes)
}

export default MultiPeriodSubjectsService

