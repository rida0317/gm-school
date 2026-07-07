// src/services/replacementGenerator.ts - Replacement generation service

import type { Teacher, SchoolClass, Timetable, Replacement } from '../types'

const DAYS_LIST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

// Teaching slot indices (excluding breaks/lunch)
const WEEKDAY_TEACHING_INDICES = [0, 1, 3, 4, 6, 7, 9]
const FRIDAY_TEACHING_INDICES = [0, 1, 3, 4]

interface TeacherSchedule {
  [teacherId: string]: {
    [day: string]: number[]
  }
}

interface TeacherLoad {
  [teacherId: string]: number
}

// Track replacements per teacher per day
interface TeacherDailyReplacements {
  [teacherId: string]: {
    [day: string]: number
  }
}

interface ReplacementCandidate {
  teacherId: string
  teacherName: string
  subject: string
  classId: string
  className: string
  day: string
  slotIndex: number
  score: number
}

export type { ReplacementCandidate }

export class ReplacementGenerator {
  private teachers: Teacher[]
  private classes: SchoolClass[]
  private timetables: Timetable
  private existingReplacements: Replacement[]

  private teacherSchedule: TeacherSchedule = {}
  private teacherLoad: TeacherLoad = {}
  private teacherDailyReplacements: TeacherDailyReplacements = {}

  constructor(
    teachers: Teacher[],
    classes: SchoolClass[],
    timetables: Timetable,
    existingReplacements: Replacement[] = []
  ) {
    this.teachers = teachers
    this.classes = classes
    this.timetables = timetables
    this.existingReplacements = existingReplacements
  }

  private _initializeTeacherSchedules() {
    this.teacherSchedule = {}
    this.teacherLoad = {}
    this.teacherDailyReplacements = {}

    // Build teacher schedules from timetables
    Object.entries(this.timetables).forEach(([_classId, classTimetable]) => {
      Object.entries(classTimetable).forEach(([day, daySlots]) => {
        daySlots.forEach((slot, slotIndex) => {
          if (slot && slot.teacherId) {
            if (!this.teacherSchedule[slot.teacherId]) {
              this.teacherSchedule[slot.teacherId] = {}
            }
            if (!this.teacherSchedule[slot.teacherId][day]) {
              this.teacherSchedule[slot.teacherId][day] = []
            }
            this.teacherSchedule[slot.teacherId][day].push(slotIndex)

            // Track load
            if (!this.teacherLoad[slot.teacherId]) {
              this.teacherLoad[slot.teacherId] = 0
            }
            this.teacherLoad[slot.teacherId]++
          }
        })
      })
    })

    // Initialize daily replacements tracker
    this.teachers.forEach(teacher => {
      this.teacherDailyReplacements[teacher.id] = {}
      DAYS_LIST.forEach(day => {
        this.teacherDailyReplacements[teacher.id][day] = 0
      })
    })

    // Also count existing replacements
    this.existingReplacements.forEach(repl => {
      if (!this.teacherLoad[repl.substituteTeacherId]) {
        this.teacherLoad[repl.substituteTeacherId] = 0
      }
      this.teacherLoad[repl.substituteTeacherId]++
      
      // Track daily replacements
      const replDate = new Date(repl.date)
      const dayIndex = replDate.getDay()
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const dayName = days[dayIndex]
      if (!this.teacherDailyReplacements[repl.substituteTeacherId]) {
        this.teacherDailyReplacements[repl.substituteTeacherId] = {}
      }
      if (!this.teacherDailyReplacements[repl.substituteTeacherId][dayName]) {
        this.teacherDailyReplacements[repl.substituteTeacherId][dayName] = 0
      }
      this.teacherDailyReplacements[repl.substituteTeacherId][dayName]++
    })
  }

  /**
   * Get all slots for an absent teacher on a specific day
   */
  public getAbsentTeacherSlots(teacherId: string, day: string): { 
    slotIndex: number
    subject: string
    classId: string
    className: string
  }[] {
    const slots: { 
      slotIndex: number
      subject: string
      classId: string
      className: string
    }[] = []

    Object.entries(this.timetables).forEach(([classId, classTimetable]) => {
      const daySlots = classTimetable[day]
      if (!daySlots) return

      const cls = this.classes.find(c => c.id === classId)
      
      daySlots.forEach((slot, slotIndex) => {
        if (slot && slot.teacherId === teacherId) {
          slots.push({
            slotIndex,
            subject: slot.subject,
            classId,
            className: cls?.name || 'Unknown'
          })
        }
      })
    })

    return slots
  }

  /**
   * Find available substitute teachers for a specific slot
   * Priority: 1) Same subject 2) Same level 3) One replacement per day per teacher 4) No vacataires
   */
  public findSubstituteTeachers(
    absentTeacherId: string,
    day: string,
    slotIndex: number,
    subject: string,
    classId: string
  ): Teacher[] {
    const absentTeacher = this.teachers.find(t => t.id === absentTeacherId)
    const cls = this.classes.find(c => c.id === classId)

    if (!absentTeacher || !cls) return []

    const teachingIndices = day === 'Friday' ? FRIDAY_TEACHING_INDICES : WEEKDAY_TEACHING_INDICES
    const teachingIdx = teachingIndices.indexOf(slotIndex)

    console.log('🔎 Searching for substitute with criteria:', {
      subject,
      classLevel: cls.level,
      day,
      slotIndex,
      teachingIdx
    })

    const candidates = this.teachers.filter(t => {
      const reasons: string[] = []
      
      // Rule 4: NO VACATAIRE teachers for replacements
      if (t.isVacataire) {
        reasons.push('is vacataire (not eligible for replacements)')
        return false
      }

      // Cannot substitute for themselves
      if (t.id === absentTeacherId) {
        reasons.push('is the absent teacher')
        return false
      }

      // Must be available at this time slot (not teaching)
      if (this.teacherSchedule[t.id]?.[day]?.includes(slotIndex)) {
        reasons.push(`busy at this time on ${day}`)
        return false
      }

      // Rule 3: Maximum ONE replacement per day per teacher
      const dailyReplacements = this.teacherDailyReplacements[t.id]?.[day] || 0
      if (dailyReplacements >= 1) {
        reasons.push(`already has ${dailyReplacements} replacement today (max 1 per day)`)
        return false
      }

      // Must have capacity (not exceeded max hours)
      const currentLoad = this.teacherLoad[t.id] || 0
      if (currentLoad >= t.maxHoursPerWeek) {
        reasons.push(`exceeded max hours (${currentLoad}/${t.maxHoursPerWeek})`)
        return false
      }

      // Rule 1 & 2: Must teach the subject OR the level
      const teachesSubject = t.subjects.includes(subject)
      const teachesLevel = !t.levels || t.levels.length === 0 || t.levels.includes(cls.level)
      
      if (!teachesSubject && !teachesLevel) {
        reasons.push(`doesn't teach ${subject} and doesn't teach level ${cls.level}`)
        return false
      }

      // Check availability preferences if set
      if (t.availability?.[day] && !t.availability[day].includes(teachingIdx)) {
        reasons.push(`not available on ${day} slot ${teachingIdx}`)
        return false
      }

      if (reasons.length > 0) {
        console.log(`  ❌ Teacher ${t.name} rejected: ${reasons.join(', ')}`)
      }
      
      return true
    })

    // Sort by priority: 1) Same subject 2) Same level 3) Lighter load
    const sortedCandidates = candidates.sort((a, b) => {
      const aTeachesSubject = a.subjects.includes(subject)
      const bTeachesSubject = b.subjects.includes(subject)
      
      const aTeachesLevel = !a.levels || a.levels.length === 0 || a.levels.includes(cls.level)
      const bTeachesLevel = !b.levels || b.levels.length === 0 || b.levels.includes(cls.level)

      // Priority 1: Same subject
      if (aTeachesSubject && !bTeachesSubject) return -1
      if (!aTeachesSubject && bTeachesSubject) return 1

      // Priority 2: Same level
      if (aTeachesLevel && !bTeachesLevel) return -1
      if (!aTeachesLevel && bTeachesLevel) return 1

      // Priority 3: Lighter load
      return (this.teacherLoad[a.id] || 0) - (this.teacherLoad[b.id] || 0)
    })

    console.log(`✅ Found ${sortedCandidates.length} valid candidates (sorted by priority):`, 
      sortedCandidates.map(c => ({ 
        name: c.name, 
        subjects: c.subjects, 
        levels: c.levels,
        teachesSubject: c.subjects.includes(subject),
        teachesLevel: !c.levels || c.levels.length === 0 || c.levels.includes(cls.level)
      }))
    )

    return sortedCandidates
  }

  /**
   * Generate all replacements for an absent teacher on a specific day
   */
  public generateReplacements(
    absentTeacherId: string,
    day: string
  ): {
    replacements: ReplacementCandidate[]
    unscheduled: { subject: string; className: string; slotIndex: number }[]
  } {
    console.log('🔍 Generating replacements for teacher:', absentTeacherId, 'on day:', day)
    
    this._initializeTeacherSchedules()

    const slots = this.getAbsentTeacherSlots(absentTeacherId, day)
    console.log('📋 Found slots to fill:', slots.length, slots)
    
    const replacements: ReplacementCandidate[] = []
    const unscheduled: { subject: string; className: string; slotIndex: number }[] = []

    const absentTeacher = this.teachers.find(t => t.id === absentTeacherId)
    if (!absentTeacher) {
      console.error('❌ Absent teacher not found:', absentTeacherId)
      return { replacements: [], unscheduled: [] }
    }

    for (const slot of slots) {
      console.log('🔎 Finding substitute for:', slot)
      
      const candidates = this.findSubstituteTeachers(
        absentTeacherId,
        day,
        slot.slotIndex,
        slot.subject,
        slot.classId
      )
      
      console.log('👥 Found candidates:', candidates.length, candidates.map(c => c.name))

      if (candidates.length > 0) {
        const bestCandidate = candidates[0] // Already sorted by priority
        const cls = this.classes.find(c => c.id === slot.classId)

        console.log('✅ Selected best candidate:', bestCandidate.name, {
          teachesSubject: bestCandidate.subjects.includes(slot.subject),
          teachesLevel: !bestCandidate.levels || !cls || bestCandidate.levels.includes(cls.level)
        })

        replacements.push({
          teacherId: bestCandidate.id,
          teacherName: bestCandidate.name,
          subject: slot.subject,
          classId: slot.classId,
          className: slot.className,
          day,
          slotIndex: slot.slotIndex,
          score: 100 - (this.teacherLoad[bestCandidate.id] || 0)
        })

        // Update load for next iteration
        this.teacherLoad[bestCandidate.id] = (this.teacherLoad[bestCandidate.id] || 0) + 1
        
        // Track daily replacement (max 1 per day)
        if (!this.teacherDailyReplacements[bestCandidate.id]) {
          this.teacherDailyReplacements[bestCandidate.id] = {}
        }
        if (!this.teacherDailyReplacements[bestCandidate.id][day]) {
          this.teacherDailyReplacements[bestCandidate.id][day] = 0
        }
        this.teacherDailyReplacements[bestCandidate.id][day]++
        
        console.log(`📊 Teacher ${bestCandidate.name} now has ${this.teacherDailyReplacements[bestCandidate.id][day]} replacement(s) today`)
      } else {
        console.warn('⚠️ No candidates found for slot:', slot)
        unscheduled.push({
          subject: slot.subject,
          className: slot.className,
          slotIndex: slot.slotIndex
        })
      }
    }

    console.log('✅ Generation complete. Replacements:', replacements.length, 'Unscheduled:', unscheduled.length)
    return { replacements, unscheduled }
  }

  /**
   * Generate replacements for multiple absent teachers on a specific day
   */
  public generateMultipleReplacements(
    absentTeacherIds: string[],
    day: string
  ): {
    replacements: ReplacementCandidate[]
    unscheduled: { subject: string; className: string; slotIndex: number; absentTeacherId: string }[]
  } {
    this._initializeTeacherSchedules()

    const allReplacements: ReplacementCandidate[] = []
    const allUnscheduled: { subject: string; className: string; slotIndex: number; absentTeacherId: string }[] = []

    for (const teacherId of absentTeacherIds) {
      const result = this.generateReplacements(teacherId, day)
      allReplacements.push(...result.replacements)
      
      result.unscheduled.forEach(u => {
        allUnscheduled.push({
          ...u,
          absentTeacherId: teacherId
        })
      })
    }

    return {
      replacements: allReplacements,
      unscheduled: allUnscheduled
    }
  }

  /**
   * Convert replacement candidates to actual Replacement objects
   */
  public convertToReplacements(candidates: ReplacementCandidate[], date: string): Omit<Replacement, 'id'>[] {
    return candidates.map(candidate => ({
      originalTeacherId: this._findOriginalTeacher(candidate.classId, candidate.day, candidate.slotIndex),
      substituteTeacherId: candidate.teacherId,
      classId: candidate.classId,
      date,
      slotIndex: candidate.slotIndex,
      subject: candidate.subject
    }))
  }

  private _findOriginalTeacher(classId: string, day: string, slotIndex: number): string {
    const classTimetable = this.timetables[classId]
    if (!classTimetable) return ''
    
    const daySlots = classTimetable[day]
    if (!daySlots) return ''
    
    const slot = daySlots[slotIndex]
    return slot?.teacherId || ''
  }
}

export default ReplacementGenerator
