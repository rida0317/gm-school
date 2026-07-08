// src/services/generator.ts - Timetable generation service (TypeScript version)

import type { Teacher, SchoolClass, Timetable, GenerationResult } from '../types'

const DAYS_LIST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

// All slots including breaks (for display)
const SLOTS_MON_THU_LIST = [
  { start: '08:30', end: '09:25', type: 'slot' as const },
  { start: '09:25', end: '10:20', type: 'slot' as const },
  { type: 'BREAK' as const, duration: 10 },
  { start: '10:30', end: '11:25', type: 'slot' as const },
  { start: '11:25', end: '12:20', type: 'slot' as const },
  { type: 'LUNCH' as const, start: '12:20', end: '13:00' },
  { start: '13:00', end: '13:55', type: 'slot' as const },
  { start: '13:55', end: '14:50', type: 'slot' as const },
  { type: 'BREAK' as const, duration: 10 },
  { start: '15:00', end: '15:55', type: 'slot' as const }
]

const SLOTS_FRI_LIST = [
  { start: '08:30', end: '09:25', type: 'slot' as const },
  { start: '09:25', end: '10:20', type: 'slot' as const },
  { type: 'BREAK' as const, duration: 10 },
  { start: '10:30', end: '11:25', type: 'slot' as const },
  { start: '11:25', end: '12:20', type: 'slot' as const }
]

// Only teaching slots (indices from the full list)
const WEEKDAY_TEACHING_INDICES = [0, 1, 3, 4, 6, 7, 9]
const FRIDAY_TEACHING_INDICES = [0, 1, 3, 4]

// Get number of teaching slots per day
const getTeachingSlotsCount = (day: string) => {
  return day === 'Friday' ? FRIDAY_TEACHING_INDICES.length : WEEKDAY_TEACHING_INDICES.length
}

// Convert teaching index to actual slot index
const getActualSlotIndex = (day: string, teachingIdx: number): number => {
  return day === 'Friday' ? FRIDAY_TEACHING_INDICES[teachingIdx] : WEEKDAY_TEACHING_INDICES[teachingIdx]
}

interface TeacherSchedule {
  [teacherId: string]: {
    [day: string]: number[]
  }
}

interface TeacherLoad {
  [teacherId: string]: number
}

interface TeacherDailyLoad {
  [teacherId: string]: {
    [day: string]: number
  }
}

interface RoomSchedule {
  [roomId: string]: {
    [day: string]: number[]
  }
}

// Track hours per teacher for each class-subject combination
interface TeacherClassSubjectLoad {
  [teacherId: string]: {
    [classId: string]: {
      [subject: string]: number
    }
  }
}

export class TimetableGenerator {
  private teachers: Teacher[]
  private classes: SchoolClass[]
  private existingTimetables: Timetable

  private timetables: Timetable = {}
  private teacherLoad: TeacherLoad = {}
  private teacherDailyLoad: TeacherDailyLoad = {}
  private teacherSchedule: TeacherSchedule = {}
  private roomSchedule: RoomSchedule = {}
  private teacherClassSubjectLoad: TeacherClassSubjectLoad = {}
  private unscheduled: { class: string; subject: string; hours: number }[] = []

  constructor(
    teachers: Teacher[],
    classes: SchoolClass[],
    existingTimetables: Timetable = {}
  ) {
    this.teachers = teachers
    this.classes = classes
    this.existingTimetables = existingTimetables
  }

  private _resetState() {
    this.timetables = {}
    this.teacherLoad = {}
    this.teacherDailyLoad = {}
    this.teacherSchedule = {}
    this.roomSchedule = {}
    this.teacherClassSubjectLoad = {}
    this.unscheduled = []

    // Initialize teacher schedules
    this.teachers.forEach(teacher => {
      this.teacherLoad[teacher.id] = 0
      this.teacherDailyLoad[teacher.id] = {}
      this.teacherSchedule[teacher.id] = {}
      this.teacherClassSubjectLoad[teacher.id] = {}
      DAYS_LIST.forEach(day => {
        this.teacherDailyLoad[teacher.id][day] = 0
        this.teacherSchedule[teacher.id][day] = []
      })
      // Initialize class-subject load for each teacher
      this.classes.forEach(cls => {
        this.teacherClassSubjectLoad[teacher.id][cls.id] = {}
        cls.subjects.forEach(subject => {
          this.teacherClassSubjectLoad[teacher.id][cls.id][subject.name] = 0
        })
      })
    })

    // Initialize room schedules
    this.classes.forEach(cls => {
      if (cls.roomId) {
        this.roomSchedule[cls.roomId] = {}
        DAYS_LIST.forEach(day => {
          this.roomSchedule[cls.roomId][day] = []
        })
      }
    })
  }

  private _initializeClassTimetable(classId: string): { [day: string]: any[] } {
    const timetable: { [day: string]: any[] } = {}
    DAYS_LIST.forEach(day => {
      // Use full slot array size to match the display timetable
      const slotsCount = day === 'Friday' ? SLOTS_FRI_LIST.length : SLOTS_MON_THU_LIST.length
      timetable[day] = Array(slotsCount).fill(null)
    })
    return timetable
  }

  private _findBestTeacher(
    classId: string,
    subName: string,
    level: string,
    day: string,
    slotIdx: number,
    ignoreBalance: boolean = false,
    ignoreAvail: boolean = false,
    ignoreLoad: boolean = false,
    ignoreLevel: boolean = false,
    ignorePedagogy: boolean = false
  ): Teacher | null {
    // Convert actual slot index to teaching index for availability check
    const teachingIndices = day === 'Friday' ? FRIDAY_TEACHING_INDICES : WEEKDAY_TEACHING_INDICES
    const teachingIdx = teachingIndices.indexOf(slotIdx)

    const candidates = this.teachers.filter(t => {
      // Subject check is mandatory
      if (!t.subjects.includes(subName)) return false

      // STRICT CHECK: Teacher level - NEVER ignore this (teachers can only teach their assigned levels)
      if (!ignoreLevel && t.levels && t.levels.length > 0 && !t.levels.includes(level)) return false

      // STRICT CHECK: Teacher max hours per week - NEVER ignore this
      if (this.teacherLoad[t.id] >= t.maxHoursPerWeek) return false

      // STRICT CHECK: Teacher already has enough hours for this class-subject combination
      const currentClassSubjectHours = this.teacherClassSubjectLoad[t.id][classId]?.[subName] || 0
      const classObj = this.classes.find(c => c.id === classId)
      const requiredHours = classObj?.subjects.find(s => s.name === subName)?.hours || 0
      if (currentClassSubjectHours >= requiredHours) return false

      // Schedule collision
      if (this.teacherSchedule[t.id][day].includes(slotIdx)) return false

      // Availability check - check if teacher is available at this slot
      // Teacher availability is stored as teaching indices (0-6 for weekday, 0-4 for Friday)
      if (!ignoreAvail && t.availability?.[day]) {
        const teacherAvailIndices = t.availability[day]
        // Check if the current teaching index is in teacher's availability
        if (teachingIdx !== -1 && !teacherAvailIndices.includes(teachingIdx)) {
          return false
        }
      }

      // Workload checks (only if not ignoring balance)
      if (!ignoreBalance && !t.isVacataire && (this.teacherDailyLoad[t.id][day] >= Math.ceil(t.maxHoursPerWeek / 5) + 1)) return false

      // Rule: NO GAPS (Consecutive preferred)
      if (!ignoreBalance && !t.isVacataire && this.teacherDailyLoad[t.id][day] > 0) {
        const hasNearby = this.teacherSchedule[t.id][day].some(idx => Math.abs(idx - slotIdx) <= 2)
        if (!hasNearby && Math.random() > 0.3) return false
      }

      // Rule: Max 2h per teacher per class per day
      if (!ignorePedagogy) {
        const classDaySched = this.timetables[classId]?.[day] || []
        const teacherHoursInClassToday = classDaySched.filter(slot => slot && slot.teacherId === t.id).length
        if (teacherHoursInClassToday >= 2) return false
      }

      return true
    })

    if (candidates.length === 0) return null

    return candidates.sort((a, b) =>
      (this.teacherDailyLoad[a.id][day] - this.teacherDailyLoad[b.id][day]) ||
      (this.teacherLoad[a.id] - this.teacherLoad[b.id])
    )[0]
  }

  private _assignSlot(
    classId: string,
    subject: string,
    teacher: Teacher,
    day: string,
    slotIdx: number
  ) {
    // STRICT VALIDATION: Never exceed teacher's max hours per week
    if (this.teacherLoad[teacher.id] >= teacher.maxHoursPerWeek) {
      console.warn(`⚠️ Cannot assign slot: Teacher ${teacher.name} has reached max hours (${teacher.maxHoursPerWeek})`)
      return
    }

    // STRICT VALIDATION: Check if teacher already has enough hours for this class-subject combination
    const currentClassSubjectHours = this.teacherClassSubjectLoad[teacher.id][classId]?.[subject] || 0
    const classObj = this.classes.find(c => c.id === classId)
    const requiredHours = classObj?.subjects.find(s => s.name === subject)?.hours || 0
    
    if (currentClassSubjectHours >= requiredHours) {
      console.warn(`⚠️ Cannot assign slot: Teacher ${teacher.name} already has ${currentClassSubjectHours}/${requiredHours} hours for ${subject} in ${classObj?.name}`)
      return
    }

    if (!this.timetables[classId]) {
      this.timetables[classId] = this._initializeClassTimetable(classId)
    }

    this.timetables[classId][day][slotIdx] = {
      subject,
      teacherId: teacher.id,
    }

    this.teacherLoad[teacher.id]++
    this.teacherDailyLoad[teacher.id][day]++
    this.teacherSchedule[teacher.id][day].push(slotIdx)
    
    // Track hours for this teacher-class-subject combination
    if (!this.teacherClassSubjectLoad[teacher.id][classId]) {
      this.teacherClassSubjectLoad[teacher.id][classId] = {}
    }
    if (!this.teacherClassSubjectLoad[teacher.id][classId][subject]) {
      this.teacherClassSubjectLoad[teacher.id][classId][subject] = 0
    }
    this.teacherClassSubjectLoad[teacher.id][classId][subject]++
  }

  private _fillDay(cls: SchoolClass, day: string, quota: { [subject: string]: number }, specials: string[]) {
    const teachingIndices = day === 'Friday' ? FRIDAY_TEACHING_INDICES : WEEKDAY_TEACHING_INDICES

    for (const idx of teachingIndices) {
      if (this.timetables[cls.id][day][idx]) continue

      const candidates = specials.filter(s => quota[s] > 0)
      for (const subName of candidates) {
        const t = this._findBestTeacher(cls.id, subName, cls.level, day, idx)
        if (t) {
          this._assignSlot(cls.id, subName, t, day, idx)
          quota[subName]--
          break
        }
      }
    }
  }

  private _fillMorningCore(cls: SchoolClass, day: string, quota: { [subject: string]: number }, coreSubjects: string[]) {
    const morningSlotIndices = [0, 1, 3, 4] // Before Lunch
    
    for (const idx of morningSlotIndices) {
      if (this.timetables[cls.id][day][idx]) continue

      const candidates = coreSubjects.filter(s => quota[s] > 0)
      for (const subName of candidates) {
        const t = this._findBestTeacher(cls.id, subName, cls.level, day, idx, false, false, false)
        if (t) {
          this._assignSlot(cls.id, subName, t, day, idx)
          quota[subName]--
          break
        }
      }
    }
  }

  private _fillBlocks(cls: SchoolClass, day: string, quota: { [subject: string]: number }, specials: string[]) {
    const teachingIndices = day === 'Friday' ? FRIDAY_TEACHING_INDICES : WEEKDAY_TEACHING_INDICES

    for (const idx of teachingIndices) {
      if (this.timetables[cls.id][day][idx]) continue

      const candidates = specials.filter(s => quota[s] > 0)
      for (const subName of candidates) {
        const t = this._findBestTeacher(cls.id, subName, cls.level, day, idx, true, false, false)
        if (t) {
          this._assignSlot(cls.id, subName, t, day, idx)
          quota[subName]--
          break
        }
      }
    }
  }

  private _fillRemainingSlots(cls: SchoolClass, day: string, quota: { [subject: string]: number }) {
    const teachingIndices = day === 'Friday' ? FRIDAY_TEACHING_INDICES : WEEKDAY_TEACHING_INDICES

    for (const idx of teachingIndices) {
      if (this.timetables[cls.id][day][idx]) continue

      const anySubject = Object.keys(quota).find(s => quota[s] > 0)
      if (anySubject) {
        const t = this._findBestTeacher(cls.id, anySubject, cls.level, day, idx, true, true, true)
        if (t) {
          this._assignSlot(cls.id, anySubject, t, day, idx)
          quota[anySubject]--
        }
      }
    }
  }

  private _emergencyFillPass(
    cls: SchoolClass,
    quota: { [subject: string]: number },
    ignoreBalance: boolean,
    ignoreAvail: boolean,
    ignoreLoad: boolean,
    ignoreLevel: boolean,
    ignorePedagogy: boolean
  ) {
    DAYS_LIST.forEach(day => {
      const teachingIndices = day === 'Friday' ? FRIDAY_TEACHING_INDICES : WEEKDAY_TEACHING_INDICES
      for (const idx of teachingIndices) {
        if (this.timetables[cls.id][day][idx]) continue

        const subject = Object.keys(quota).find(s => quota[s] > 0)
        if (subject) {
          const t = this._findBestTeacher(
            cls.id, subject, cls.level, day, idx,
            ignoreBalance, ignoreAvail, ignoreLoad, ignoreLevel, ignorePedagogy
          )
          if (t) {
            this._assignSlot(cls.id, subject, t, day, idx)
            quota[subject]--
          }
        }
      }
    })
  }

  private _ghostFillPass(cls: SchoolClass, quota: { [subject: string]: number }) {
    // Last resort: assign any available teacher (but STILL respect max hours and class-subject hours)
    DAYS_LIST.forEach(day => {
      const teachingIndices = day === 'Friday' ? FRIDAY_TEACHING_INDICES : WEEKDAY_TEACHING_INDICES
      for (const idx of teachingIndices) {
        if (this.timetables[cls.id][day][idx]) continue

        const subject = Object.keys(quota).find(s => quota[s] > 0)
        if (subject) {
          const requiredHours = cls.subjects.find(s => s.name === subject)?.hours || 0

          const t = this.teachers.find(teach =>
            teach.subjects.includes(subject) &&
            (!teach.levels || teach.levels.length === 0 || teach.levels.includes(cls.level)) &&  // STRICT: Respect teacher levels
            !this.teacherSchedule[teach.id][day].includes(idx) &&
            this.teacherLoad[teach.id] < teach.maxHoursPerWeek &&  // STRICT: Respect max hours
            (this.teacherClassSubjectLoad[teach.id][cls.id]?.[subject] || 0) < requiredHours  // STRICT: Respect class-subject hours
          )
          if (t) {
            this._assignSlot(cls.id, subject, t, day, idx)
            quota[subject]--
          }
        }
      }
    })
  }

  private _globalBackfill() {
    // Try to fill any remaining gaps
    this.classes.forEach(cls => {
      DAYS_LIST.forEach(day => {
        const teachingIndices = day === 'Friday' ? FRIDAY_TEACHING_INDICES : WEEKDAY_TEACHING_INDICES
        for (const idx of teachingIndices) {
          if (!this.timetables[cls.id][day][idx]) {
            // Leave empty or mark as free period
            this.timetables[cls.id][day][idx] = null
          }
        }
      })
    })
  }

  public generate(): GenerationResult {
    this._resetState()
    
    const specials = ['Arabic', 'Maths', 'French', 'Physics', 'PC', 'SVT', 'English']
    
    // Sort classes by total hours (descending)
    const sortedClasses = [...this.classes].sort((a, b) =>
      (b.subjects?.reduce((sum, s) => sum + s.hours, 0) || 0) -
      (a.subjects?.reduce((sum, s) => sum + s.hours, 0) || 0)
    )

    // Check for subjects with no teachers
    const allTeacherSubjects = new Set<string>()
    this.teachers.forEach(t => {
      t.subjects.forEach(s => allTeacherSubjects.add(s))
    })

    const classSubjects = new Set<string>()
    this.classes.forEach(c => {
      c.subjects.forEach(s => {
        if (s.name) classSubjects.add(s.name)
      })
    })

    const missingSubjects = Array.from(classSubjects).filter(s => !allTeacherSubjects.has(s))
    if (missingSubjects.length > 0) {
      console.warn('⚠️ Subjects with no teachers:', missingSubjects)
    }

    // Generate for each class
    for (const cls of sortedClasses) {
      this.timetables[cls.id] = this._initializeClassTimetable(cls.id)

      // Calculate quota (hours needed per subject)
      const quota: { [subject: string]: number } = {}
      cls.subjects.forEach(s => {
        let assigned = 0
        Object.values(this.timetables[cls.id]).forEach(day => {
          day.forEach(slot => {
            if (slot && slot.subject === s.name) assigned++
          })
        })
        quota[s.name] = Math.max(0, s.hours - assigned)
      })

      // Calculate total hours needed vs available slots
      const totalHoursNeeded = Object.values(quota).reduce((sum, h) => sum + h, 0)
      const totalAvailableSlots = DAYS_LIST.reduce((sum, day) => {
        return sum + (day === 'Friday' ? FRIDAY_TEACHING_INDICES.length : WEEKDAY_TEACHING_INDICES.length)
      }, 0)

      if (totalHoursNeeded > totalAvailableSlots) {
        console.warn(`⚠️ Class ${cls.name} needs ${totalHoursNeeded} hours but only ${totalAvailableSlots} slots available`)
      }

      // Pass 1: Friday (Critical Constraints)
      this._fillDay(cls, 'Friday', quota, specials)

      // Pass 2: Morning Core Subjects (Mon-Thu)
      const monToThu = ['Monday', 'Tuesday', 'Wednesday', 'Thursday']
      for (const day of monToThu) {
        this._fillMorningCore(cls, day, quota, specials)
      }

      // Pass 3: Mon-Thu 2-Hour Blocks
      for (const day of monToThu) {
        this._fillBlocks(cls, day, quota, specials)
      }

      // Pass 4: Normal Filling - Fill ALL remaining slots
      const randomizedDays = [...DAYS_LIST].sort(() => Math.random() - 0.5)
      for (const day of randomizedDays) {
        this._fillRemainingSlots(cls, day, quota)
      }

      // Pass 5: Aggressive Fill - Fill ANY remaining empty slots with ANY subject
      for (const day of DAYS_LIST) {
        this._aggressiveFill(cls, day, quota)
      }

      // Emergency Passes - Try harder to fill remaining hours
      const hasMissing = () => Object.values(quota).some(h => h > 0)

      if (hasMissing()) {
        this._emergencyFillPass(cls, quota, false, false, false, false, false)
      }
      if (hasMissing()) {
        this._emergencyFillPass(cls, quota, true, true, true, true, true)
      }
      if (hasMissing()) {
        this._ghostFillPass(cls, quota)
      }

      // Final Pass: Fill any remaining empty slots with placeholder
      this._fillEmptySlots(cls, quota)

      // Track unscheduled hours
      Object.entries(quota).forEach(([sub, hours]) => {
        if (hours > 0) {
          this.unscheduled.push({ class: cls.name, subject: sub, hours })
        }
      })
    }

    this._globalBackfill()

    return {
      timetables: JSON.parse(JSON.stringify(this.timetables)),
      unscheduled: [...this.unscheduled]
    }
  }

  // Fill any remaining empty slots to ensure no gaps
  private _fillEmptySlots(cls: SchoolClass, quota: { [subject: string]: number }) {
    DAYS_LIST.forEach(day => {
      const teachingIndices = day === 'Friday' ? FRIDAY_TEACHING_INDICES : WEEKDAY_TEACHING_INDICES

      for (const slotIdx of teachingIndices) {
        if (!this.timetables[cls.id][day][slotIdx]) {
          // Find any teacher available at this time (STILL respect max hours, class-subject hours, and levels)
          const availableTeacher = this.teachers.find(t =>
            !this.teacherSchedule[t.id][day].includes(slotIdx) &&
            t.subjects.length > 0 &&
            this.teacherLoad[t.id] < t.maxHoursPerWeek &&  // STRICT: Respect max hours
            (!t.levels || t.levels.length === 0 || t.levels.includes(cls.level)) &&  // STRICT: Respect teacher levels
            // Check if teacher can still teach this subject to this class
            t.subjects.some(sub => {
              const requiredHours = cls.subjects.find(s => s.name === sub)?.hours || 0
              return (this.teacherClassSubjectLoad[t.id][cls.id]?.[sub] || 0) < requiredHours
            })
          )

          if (availableTeacher) {
            // Use a subject that this teacher can still teach to this class
            const subject = availableTeacher.subjects.find(sub => {
              const requiredHours = cls.subjects.find(s => s.name === sub)?.hours || 0
              return (this.teacherClassSubjectLoad[availableTeacher.id][cls.id]?.[sub] || 0) < requiredHours
            }) || 'Study Hall'
            
            this._assignSlot(cls.id, subject, availableTeacher, day, slotIdx)
          }
        }
      }
    })
  }

  // Aggressive fill - fill all remaining slots in a day
  private _aggressiveFill(cls: SchoolClass, day: string, quota: { [subject: string]: number }) {
    const teachingIndices = day === 'Friday' ? FRIDAY_TEACHING_INDICES : WEEKDAY_TEACHING_INDICES

    for (const idx of teachingIndices) {
      if (this.timetables[cls.id][day][idx]) continue

      // Try to fill with subjects that still need hours
      const candidates = Object.keys(quota).filter(s => quota[s] > 0)

      for (const subName of candidates) {
        // Note: _findBestTeacher ALWAYS checks maxHoursPerWeek (even with ignoreLoad=true)
        const t = this._findBestTeacher(cls.id, subName, cls.level, day, idx, true, true, true, true, true)
        if (t) {
          this._assignSlot(cls.id, subName, t, day, idx)
          quota[subName]--
          break
        }
      }
    }
  }
}

export default TimetableGenerator

