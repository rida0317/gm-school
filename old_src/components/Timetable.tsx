// src/components/Timetable.tsx - Timetable generation and display component

import React, { useState } from 'react'
import { useAuth } from '../store/AuthContext'
import { useSchoolStore } from '../store/schoolStore'
import { useNotificationsStore } from '../store/notificationsStore'
import { t } from '../utils/translations'
import { TimetableGenerator } from '../services/generator'
import type { Timetable, TimetableSlot } from '../types'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { read, utils, write } from 'xlsx'
import './Timetable.css'

// Helper function to save PDF - browser download
const savePDF = async (doc: jsPDF, filename: string) => {
  // Browser download
  doc.save(filename)
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

// Time slots with break/lunch indicators
const WEEKDAY_SLOTS = [
  { time: '08:30-09:25', type: 'slot' },
  { time: '09:25-10:20', type: 'slot' },
  { time: '10:20-10:30', type: 'break', label: '☕ Break' },
  { time: '10:30-11:25', type: 'slot' },
  { time: '11:25-12:20', type: 'slot' },
  { time: '12:20-13:00', type: 'lunch', label: '🍽️ Lunch' },
  { time: '13:00-13:55', type: 'slot' },
  { time: '13:55-14:50', type: 'slot' },
  { time: '14:50-15:00', type: 'break', label: '☕ Break' },
  { time: '15:00-15:55', type: 'slot' },
]

const FRIDAY_SLOTS = [
  { time: '08:30-09:25', type: 'slot' },
  { time: '09:25-10:20', type: 'slot' },
  { time: '10:20-10:30', type: 'break', label: '☕ Break' },
  { time: '10:30-11:25', type: 'slot' },
  { time: '11:25-12:20', type: 'slot' },
]

// Actual teaching slot indices (excluding breaks/lunch)
const WEEKDAY_TEACHING_INDICES = [0, 1, 3, 4, 6, 7, 9]
const FRIDAY_TEACHING_INDICES = [0, 1, 3, 4]

// Translation function for days
const getDayTranslation = (day: string, lang: string) => {
  const translations: Record<string, Record<string, string>> = {
    'Monday': { en: 'Monday', fr: 'Lundi', ar: 'الإثنين' },
    'Tuesday': { en: 'Tuesday', fr: 'Mardi', ar: 'الثلاثاء' },
    'Wednesday': { en: 'Wednesday', fr: 'Mercredi', ar: 'الأربعاء' },
    'Thursday': { en: 'Thursday', fr: 'Jeudi', ar: 'الخميس' },
    'Friday': { en: 'Friday', fr: 'Vendredi', ar: 'الجمعة' }
  }
  return translations[day]?.[lang] || translations[day]?.en || day
}

const Timetable: React.FC = () => {
  const { user } = useAuth()
  const { classes, teachers, timetables, saveTimetables, clearAllTimetables, schoolName, logo, language = 'en' } = useSchoolStore()
  const { addNotification } = useNotificationsStore()
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('')
  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class')
  const [generatedTimetable, setGeneratedTimetable] = useState<typeof timetables | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationResult, setGenerationResult] = useState<{ unscheduled: any[] } | null>(null)
  const [draggedSlot, setDraggedSlot] = useState<{ day: string; slotIndex: number; slot: TimetableSlot } | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualSlotData, setManualSlotData] = useState<{ day: string; slotIndex: number } | null>(null)
  const [manualFormData, setManualFormData] = useState({
    subject: '',
    teacherId: ''
  })
  const [showImportModal, setShowImportModal] = useState(false)
  const [importedData, setImportedData] = useState<Timetable | null>(null)
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' })
  const [importFile, setImportFile] = useState<File | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<'json' | 'excel'>('json')
  const [exportScope, setExportScope] = useState<'current' | 'all'>('current')

  const selectedClass = classes.find(c => c.id === selectedClassId)
  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId)
  const currentTimetable = generatedTimetable || timetables

  const handleOpenManualModal = (day: string, slotIndex: number, existingSlot?: TimetableSlot | null) => {
    if (!isEditMode || viewMode !== 'class' || !selectedClassId) return
    setManualSlotData({ day, slotIndex })
    setManualFormData({
      subject: existingSlot?.subject || '',
      teacherId: existingSlot?.teacherId || ''
    })
    setShowManualModal(true)
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualSlotData || !selectedClassId) return

    const { day, slotIndex } = manualSlotData
    const newTimetable = { ...currentTimetable }

    if (!newTimetable[selectedClassId]) {
      newTimetable[selectedClassId] = {}
    }
    if (!newTimetable[selectedClassId][day]) {
      newTimetable[selectedClassId][day] = Array(10).fill(null)
    }

    if (manualFormData.subject && manualFormData.teacherId) {
      newTimetable[selectedClassId][day][slotIndex] = {
        subject: manualFormData.subject,
        teacherId: manualFormData.teacherId
      }
    } else {
      newTimetable[selectedClassId][day][slotIndex] = null
    }

    if (generatedTimetable) {
      setGeneratedTimetable(newTimetable)
    } else {
      saveTimetables(newTimetable)
    }

    setShowManualModal(false)
    setManualSlotData(null)
  }

  // Import functions
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)
    setImportStatus({ type: 'idle', message: '' })

    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    
    if (fileExtension === 'json') {
      handleJSONImport(file)
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      handleExcelImport(file)
    } else {
      setImportStatus({ type: 'error', message: '⚠️ Unsupported file format. Please upload JSON or Excel file.' })
    }
  }

  const handleJSONImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        
        // Validate timetable structure
        if (!data.timetables || typeof data.timetables !== 'object') {
          setImportStatus({ type: 'error', message: '⚠️ Invalid timetable format. Expected "timetables" object.' })
          return
        }

        setImportedData(data.timetables)
        setImportStatus({ type: 'success', message: `✅ Successfully imported ${Object.keys(data.timetables).length} class timetable(s)!` })
      } catch (error) {
        setImportStatus({ type: 'error', message: '⚠️ Failed to parse JSON file. Please check the format.' })
      }
    }
    reader.readAsText(file)
  }

  // Helper function to find slot index by time string
  const findSlotIndexByTime = (timeStr: string): number => {
    const timeMap: { [key: string]: number } = {
      '08:30-09:25': 0,
      '09:25-10:20': 1,
      '10:30-11:25': 3,
      '11:25-12:20': 4,
      '13:00-13:55': 6,
      '13:55-14:50': 7,
      '15:00-15:55': 9
    }
    
    // Try exact match first
    const exactMatch = Object.keys(timeMap).find(key => timeStr.includes(key))
    if (exactMatch) return timeMap[exactMatch]
    
    // Try partial match
    for (const [key, index] of Object.entries(timeMap)) {
      if (timeStr.includes(key.split('-')[0]) || timeStr.includes(key.split('-')[1])) {
        return index
      }
    }
    
    return -1
  }

  const handleExcelImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = read(data, { type: 'array' })
        const timetableData: Timetable = {}

        // Process each sheet as a class
        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName]
          const jsonData: any[][] = utils.sheet_to_json(worksheet, { header: 1 })
          const classTimetable: { [day: string]: (TimetableSlot | null)[] } = {}

          // Initialize days with empty slots
          for (const day of DAYS) {
            classTimetable[day] = Array(10).fill(null)
          }

          // Skip header row and process data rows
          for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex++) {
            const row = jsonData[rowIndex]
            if (!row || row.length === 0) continue

            const timeCell = String(row[0] || '')
            if (!timeCell) continue

            const slotIndex = findSlotIndexByTime(timeCell)
            if (slotIndex === -1) continue

            // Process each day column
            for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex++) {
              const cellValue = String(row[dayIndex + 1] || '')
              if (cellValue && cellValue.trim() !== '' && cellValue !== 'Free') {
                const lines = cellValue.split('\n')
                const subject = lines[0]?.trim()
                const teacherName = lines[1]?.trim()

                if (subject && teacherName) {
                  const teacher = teachers.find(t => t.name === teacherName)
                  if (teacher) {
                    classTimetable[DAYS[dayIndex]][slotIndex] = {
                      subject,
                      teacherId: teacher.id
                    }
                  }
                }
              }
            }
          }

          const classByName = classes.find(c => c.name === sheetName)
          const classId = classByName?.id || sheetName
          timetableData[classId] = classTimetable
        }

        if (Object.keys(timetableData).length === 0) {
          setImportStatus({ type: 'error', message: '⚠️ No valid timetable data found in Excel file.' })
          return
        }

        setImportedData(timetableData)
        setImportStatus({ type: 'success', message: `✅ Successfully imported ${Object.keys(timetableData).length} class timetable(s)!` })
      } catch (error) {
        console.error('Excel import error:', error)
        setImportStatus({ type: 'error', message: '⚠️ Failed to parse Excel file. Please check the format.' })
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleConfirmImport = () => {
    if (!importedData) return

    // Merge or replace based on user preference
    const newTimetable = { ...currentTimetable, ...importedData }
    
    if (generatedTimetable) {
      setGeneratedTimetable(newTimetable)
    } else {
      saveTimetables(newTimetable)
    }

    // Send notification
    addNotification({
      userId: 'system',
      type: 'timetable_change',
      title: 'Timetable Imported',
      message: `${Object.keys(importedData).length} timetable(s) imported successfully`,
      priority: 'normal'
    })

    handleResetImport()
    alert('✅ Timetable imported successfully! You can now modify it using Edit Mode.')
  }

  const handleResetImport = () => {
    setShowImportModal(false)
    setImportedData(null)
    setImportFile(null)
    setImportStatus({ type: 'idle', message: '' })
  }

  // Export functions
  const handleExportTimetable = () => {
    if (exportFormat === 'json') {
      handleExportJSON()
    } else {
      handleExportExcel()
    }
  }

  const handleExportJSON = () => {
    const dataToExport = exportScope === 'current' && selectedClassId
      ? { [selectedClassId]: currentTimetable[selectedClassId] }
      : currentTimetable

    const exportData = {
      timetables: dataToExport,
      exportedAt: new Date().toISOString(),
      schoolName: schoolName,
      version: '1.0'
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const filename = exportScope === 'current' && selectedClassId
      ? `Timetable_${selectedClass?.name || 'current'}_${new Date().toISOString().split('T')[0]}.json`
      : `All_Timetables_${new Date().toISOString().split('T')[0]}.json`

    downloadFile(url, filename)
    setShowExportModal(false)
    alert('✅ Timetable exported successfully as JSON!')
  }

  const handleExportExcel = () => {
    const dataToExport = exportScope === 'current' && selectedClassId
      ? { [selectedClassId]: currentTimetable[selectedClassId] }
      : currentTimetable

    const workbook = utils.book_new()

    Object.entries(dataToExport).forEach(([classId, classTimetable]) => {
      const className = classes.find(c => c.id === classId)?.name || classId
      const worksheetData: any[][] = [['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']]

      // Add rows for each time slot
      WEEKDAY_SLOTS.forEach((slot, slotIndex) => {
        if (slot.type === 'break' || slot.type === 'lunch') {
          worksheetData.push([slot.time, slot.label, '', '', '', ''])
        } else {
          const teachingIndex = WEEKDAY_TEACHING_INDICES.indexOf(slotIndex)
          if (teachingIndex !== -1) {
            const row: any[] = [slot.time]
            DAYS.forEach((day) => {
              const actualIndex = getActualSlotIndex(day, teachingIndex)
              const slotData = classTimetable[day]?.[actualIndex]
              if (slotData) {
                const teacherName = getTeacherName(slotData.teacherId)
                row.push(`${slotData.subject}\n${teacherName}`)
              } else {
                row.push('Free')
              }
            })
            worksheetData.push(row)
          }
        }
      })

      const worksheet = utils.aoa_to_sheet(worksheetData)
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 15 }, // Time column
        { wch: 20 }, // Monday
        { wch: 20 }, // Tuesday
        { wch: 20 }, // Wednesday
        { wch: 20 }, // Thursday
        { wch: 20 }  // Friday
      ]

      utils.book_append_sheet(workbook, worksheet, className.substring(0, 31))
    })

    const filename = exportScope === 'current' && selectedClassId
      ? `Timetable_${selectedClass?.name || 'current'}_${new Date().toISOString().split('T')[0]}.xlsx`
      : `All_Timetables_${new Date().toISOString().split('T')[0]}.xlsx`

    const excelBuffer = write(workbook, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)

    downloadFile(url, filename)
    setShowExportModal(false)
    alert('✅ Timetable exported successfully as Excel!')
  }

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Debug: Log data availability
  React.useEffect(() => {
    console.log('📦 Timetable Data:', {
      classesCount: classes.length,
      teachersCount: teachers.length,
      selectedClassId,
      selectedClass: selectedClass?.name,
      selectedClassSubjects: selectedClass?.subjects,
      hasTimetables: Object.keys(timetables).length > 0
    })
  }, [selectedClassId, classes, teachers, timetables])

  const handleGenerateAll = async () => {
    if (teachers.length === 0) {
      alert('⚠️ No teachers available. Please add teachers first!')
      return
    }

    if (classes.length === 0) {
      alert('⚠️ No classes available. Please add classes first!')
      return
    }

    const classesWithoutSubjects = classes.filter(c => !c.subjects || c.subjects.length === 0)
    if (classesWithoutSubjects.length > 0) {
      alert(`⚠️ The following classes have no subjects configured: ${classesWithoutSubjects.map(c => c.name).join(', ')}. Please add subjects to these classes first!`)
      return
    }

    setIsGenerating(true)
    setGenerationResult(null)

    await new Promise(resolve => setTimeout(resolve, 100))

    try {
      const generator = new TimetableGenerator(
        teachers,
        classes,
        timetables
      )

      const result = generator.generate()
      setGeneratedTimetable(result.timetables)

      const unscheduledCount = result.unscheduled?.length || 0
      const generatedCount = Object.keys(result.timetables).length

      if (unscheduledCount > 0) {
        setGenerationResult({ unscheduled: result.unscheduled })
        alert(`⚠️ Generated ${generatedCount} timetables. ${unscheduledCount} subject(s) could not be scheduled. Check constraints.`)
      } else {
        alert(`✅ Successfully generated ${generatedCount} timetables!`)
      }
    } catch (error) {
      console.error('❌ Generation error:', error)
      alert('Failed to generate timetables. Please check constraints.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedClassId) {
      alert('⚠️ Please select a class first!')
      return
    }

    if (teachers.length === 0) {
      alert('⚠️ No teachers available. Please add teachers first!')
      return
    }

    if (classes.length === 0) {
      alert('⚠️ No classes available. Please add classes first!')
      return
    }

    const selectedClass = classes.find(c => c.id === selectedClassId)
    if (!selectedClass?.subjects || selectedClass.subjects.length === 0) {
      alert('⚠️ Selected class has no subjects configured. Please add subjects to the class first!')
      return
    }

    setIsGenerating(true)
    setGenerationResult(null)

    await new Promise(resolve => setTimeout(resolve, 100))

    try {
      const generator = new TimetableGenerator(
        teachers,
        classes,
        timetables
      )

      const result = generator.generate()
      setGeneratedTimetable(result.timetables)

      if (result.unscheduled && result.unscheduled.length > 0) {
        setGenerationResult({ unscheduled: result.unscheduled })
      } else {
        setGenerationResult(null)
      }
    } catch (error) {
      console.error('❌ Generation error:', error)
      alert('Failed to generate timetable. Please check constraints.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleClearTimetable = () => {
    if (!selectedClassId) return

    if (confirm(`Are you sure you want to clear the timetable for ${selectedClass?.name}?`)) {
      const newTimetable = { ...currentTimetable }
      delete newTimetable[selectedClassId]

      if (generatedTimetable) {
        setGeneratedTimetable(newTimetable)
      } else {
        saveTimetables(newTimetable)
      }

      // Send notification
      addNotification({
        userId: user?.id || 'all',
        type: 'timetable_change',
        title: 'Timetable Cleared',
        message: `Timetable for ${selectedClass?.name} has been cleared`,
        priority: 'high'
      })

      setGenerationResult(null)
    }
  }

  const handleClearAllTimetables = () => {
    if (confirm('Are you sure you want to clear ALL timetables for ALL classes? This action cannot be undone.')) {
      clearAllTimetables()
      setGeneratedTimetable(null)
      setGenerationResult(null)
      
      // Send notification
      addNotification({
        userId: user?.id || 'all',
        type: 'timetable_change',
        title: 'All Timetables Cleared',
        message: 'All class timetables have been cleared',
        priority: 'urgent'
      })
      
      alert('✅ All timetables cleared successfully!')
    }
  }

  const handleExportPDF = () => {
    if (viewMode === 'teacher') {
      exportTeacherPDF()
    } else {
      exportClassPDF()
    }
  }

  const exportClassPDF = async () => {
    if (!selectedClassId || !currentTimetable[selectedClassId]) return
    const doc = new jsPDF('l', 'mm', 'a4')

    // Add School Logo & Name
    if (logo) {
      try {
        // Assume PNG format for data URLs, or handle accordingly
        const format = logo.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(logo, format, 14, 10, 20, 20)
      } catch (e) {
        console.error('Could not add logo to PDF:', e)
      }
    }

    doc.setFontSize(20)
    doc.setTextColor(40)
    doc.text(schoolName, logo ? 40 : 14, 20)

    doc.setFontSize(14)
    doc.setTextColor(100)
    doc.text(`Timetable - ${selectedClass?.name} (${selectedClass?.level})`, logo ? 40 : 14, 28)

    const tableColumn = ['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    const tableRows: any[] = []

    WEEKDAY_SLOTS.forEach((slot, slotIndex) => {
      if (slot.type === 'break' || slot.type === 'lunch') {
        tableRows.push([
          { content: slot.time },
          { content: slot.label, colSpan: 5, styles: { halign: 'center', fillColor: [255, 243, 205] } }
        ])
        return
      }

      const teachingIndex = WEEKDAY_TEACHING_INDICES.indexOf(slotIndex)
      if (teachingIndex === -1) return

      const row: any[] = [slot.time]
      DAYS.forEach((day) => {
        const actualIndex = getActualSlotIndex(day, teachingIndex)
        const slotData = currentTimetable[selectedClassId][day]?.[actualIndex]
        if (slotData) {
          row.push(`${slotData.subject}\n${getTeacherName(slotData.teacherId)}`)
        } else {
          row.push('Free')
        }
      })
      tableRows.push(row)
    })

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid'
    })
    await savePDF(doc, `Timetable_${selectedClass?.name}.pdf`)
  }

  const exportTeacherPDF = async () => {
    if (!selectedTeacherId) return
    const doc = new jsPDF('l', 'mm', 'a4')

    // Add School Logo & Name
    if (logo) {
      try {
        const format = logo.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(logo, format, 14, 10, 20, 20)
      } catch (e) {
        console.error('Could not add logo to PDF:', e)
      }
    }

    doc.setFontSize(20)
    doc.setTextColor(40)
    doc.text(schoolName, logo ? 40 : 14, 20)

    doc.setFontSize(14)
    doc.setTextColor(100)
    doc.text(`Teacher Schedule - ${selectedTeacher?.name}`, logo ? 40 : 14, 28)

    const tableColumn = ['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    const tableRows: any[] = []

    WEEKDAY_SLOTS.forEach((slot, slotIndex) => {
      if (slot.type === 'break' || slot.type === 'lunch') {
        tableRows.push([
          { content: slot.time },
          { content: slot.label, colSpan: 5, styles: { halign: 'center', fillColor: [255, 243, 205] } }
        ])
        return
      }

      const teachingIndex = WEEKDAY_TEACHING_INDICES.indexOf(slotIndex)
      if (teachingIndex === -1) return

      const row: any[] = [slot.time]
      DAYS.forEach((day) => {
        const actualIndex = getActualSlotIndex(day, teachingIndex)
        const schedule = getTeacherSchedule(day, actualIndex)
        if (schedule) {
          row.push(`${schedule.subject}\n${schedule.className}`)
        } else {
          row.push('Free')
        }
      })
      tableRows.push(row)
    })

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid'
    })
    await savePDF(doc, `Teacher_${selectedTeacher?.name}.pdf`)
  }

  const handleBulkExportPDF = async () => {
    const classesWithTimetables = classes.filter(cls => currentTimetable[cls.id])
    if (classesWithTimetables.length === 0) {
      alert('⚠️ No timetables available to export. Please generate timetables first.')
      return
    }

    const doc = new jsPDF('l', 'mm', 'a4')
    let isFirstPage = true

    for (const cls of classesWithTimetables) {
      if (!isFirstPage) doc.addPage()
      isFirstPage = false

      // Add Header
      if (logo) {
        try {
          const format = logo.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(logo, format, 14, 10, 15, 15)
        } catch (e) {
          console.warn('Failed to add logo to PDF:', e)
        }
      }
      doc.setFontSize(16)
      doc.setTextColor(40)
      doc.text(schoolName, logo ? 32 : 14, 18)
      doc.setFontSize(12)
      doc.setTextColor(100)
      doc.text(`Timetable: ${cls.name} (${cls.level})`, logo ? 32 : 14, 24)

      const tableColumn = ['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      const tableRows: any[] = []

      WEEKDAY_SLOTS.forEach((slot, slotIndex) => {
        if (slot.type === 'break' || slot.type === 'lunch') {
          tableRows.push([
            { content: slot.time },
            { content: slot.label, colSpan: 5, styles: { halign: 'center', fillColor: [255, 243, 205] } }
          ])
          return
        }

        const teachingIndex = WEEKDAY_TEACHING_INDICES.indexOf(slotIndex)
        if (teachingIndex === -1) return

        const row: any[] = [slot.time]
        DAYS.forEach((day) => {
          const actualIndex = getActualSlotIndex(day, teachingIndex)
          const slotData = currentTimetable[cls.id][day]?.[actualIndex]
          if (slotData) {
            row.push(`${slotData.subject}\n${getTeacherName(slotData.teacherId)}`)
          } else {
            row.push('Free')
          }
        })
        tableRows.push(row)
      })

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 }
      })
    }

    await savePDF(doc, `All_Class_Timetables_${new Date().toISOString().split('T')[0]}.pdf`)
    alert(`✅ Successfully exported ${classesWithTimetables.length} timetables in one PDF!`)
  }

  const handleBulkTeacherExportPDF = async () => {
    const teachersWithSchedule = teachers.filter(t => {
      for (const classTimetable of Object.values(currentTimetable)) {
        for (const day of DAYS) {
          const slots = classTimetable[day] || []
          for (const slot of slots) {
            if (slot && slot.teacherId === t.id) return true
          }
        }
      }
      return false
    })

    if (teachersWithSchedule.length === 0) {
      alert('⚠️ No teacher schedules available.')
      return
    }

    const doc = new jsPDF('l', 'mm', 'a4')
    let isFirstPage = true

    for (const teacher of teachersWithSchedule) {
      if (!isFirstPage) doc.addPage()
      isFirstPage = false

      // Add Header
      if (logo) {
        try {
          const format = logo.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(logo, format, 14, 10, 15, 15)
        } catch (e) {
          console.warn('Failed to add logo to PDF:', e)
        }
      }
      doc.setFontSize(16)
      doc.setTextColor(40)
      doc.text(schoolName, logo ? 32 : 14, 18)
      doc.setFontSize(12)
      doc.setTextColor(100)
      doc.text(`Teacher Schedule: ${teacher.name}`, logo ? 32 : 14, 24)

      const tableColumn = ['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      const tableRows: any[] = []

      WEEKDAY_SLOTS.forEach((slot, slotIndex) => {
        if (slot.type === 'break' || slot.type === 'lunch') {
          tableRows.push([
            { content: slot.time },
            { content: slot.label, colSpan: 5, styles: { halign: 'center', fillColor: [255, 243, 205] } }
          ])
          return
        }

        const teachingIndex = WEEKDAY_TEACHING_INDICES.indexOf(slotIndex)
        if (teachingIndex === -1) return

        const row: any[] = [slot.time]
        DAYS.forEach((day) => {
          const actualIndex = getActualSlotIndex(day, teachingIndex)

          let schedule: { subject: string; className: string } | null = null
          for (const [classId, classTimetable] of Object.entries(currentTimetable)) {
            const slotData = classTimetable[day]?.[actualIndex]
            if (slotData && slotData.teacherId === teacher.id) {
              const cls = classes.find(c => c.id === classId)
              schedule = { subject: slotData.subject, className: cls?.name || 'Unknown' }
              break
            }
          }

          if (schedule) {
            row.push(`${schedule.subject}\n${schedule.className}`)
          } else {
            row.push('Free')
          }
        })
        tableRows.push(row)
      })

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 30,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 }
      })
    }

    await savePDF(doc, `All_Teacher_Schedules_${new Date().toISOString().split('T')[0]}.pdf`)
    alert('✅ All teacher schedules exported successfully!')
  }

  const handleExportSinglePagePDF = () => exportClassPDF()
  const handleExportTeacherSinglePagePDF = () => exportTeacherPDF()

  const handleSave = () => {
    if (generatedTimetable) {
      saveTimetables(generatedTimetable)
      
      // Send notification for timetable save
      if (selectedClass) {
        addNotification({
          userId: user?.id || 'all',
          type: 'timetable_change',
          title: 'Timetable Saved',
          message: `Timetable for ${selectedClass.name} has been saved successfully`,
          priority: 'normal'
        })
      }
      
      setGeneratedTimetable(null)
      setGenerationResult(null)
      alert('✅ Timetable saved successfully!')
    }
  }

  const getSlot = (day: string, slotIndex: number): TimetableSlot | null | undefined => {
    if (!selectedClassId || !currentTimetable[selectedClassId]) return null
    return currentTimetable[selectedClassId][day]?.[slotIndex]
  }

  const getTeacherSchedule = (day: string, slotIndex: number): { subject: string; className: string; classId: string } | null => {
    if (!selectedTeacherId) return null
    for (const [classId, classTimetable] of Object.entries(currentTimetable)) {
      const slot = classTimetable[day]?.[slotIndex]
      if (slot && slot.teacherId === selectedTeacherId) {
        const cls = classes.find(c => c.id === classId)
        return { subject: slot.subject, className: cls?.name || 'Unknown', classId }
      }
    }
    return null
  }

  const getTeacherName = (teacherId: string) => teachers.find(t => t.id === teacherId)?.name || 'Unknown'
  const getClassName = (classId: string) => classes.find(c => c.id === classId)?.name || 'Unknown'

  const getActualSlotIndex = (day: string, teachingIndex: number): number => {
    return day === 'Friday' ? FRIDAY_TEACHING_INDICES[teachingIndex] : WEEKDAY_TEACHING_INDICES[teachingIndex]
  }

  const handleDragStart = (e: React.DragEvent, day: string, slotIndex: number, slot: TimetableSlot) => {
    if (!isEditMode) return
    setDraggedSlot({ day, slotIndex, slot })
    e.currentTarget.classList.add('dragging')
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditMode) return
    e.preventDefault()
    e.currentTarget.classList.add('drag-over')
  }

  const handleDragLeave = (e: React.DragEvent) => e.currentTarget.classList.remove('drag-over')

  const handleDrop = (e: React.DragEvent, targetDay: string, targetSlotIndex: number, isTeacherView = false) => {
    if (!isEditMode || !draggedSlot) return
    e.preventDefault()
    e.currentTarget.classList.remove('drag-over')

    const sourceDay = draggedSlot.day
    const sourceSlotIndex = draggedSlot.slotIndex
    const newTimetable = { ...currentTimetable }

    if (isTeacherView && selectedTeacherId) {
      const teacherId = selectedTeacherId
      const affectedClasses: string[] = []
      for (const [classId, classTimetable] of Object.entries(newTimetable)) {
        if (classTimetable[sourceDay]?.[sourceSlotIndex]?.teacherId === teacherId) {
          affectedClasses.push(classId)
        }
      }

      if (affectedClasses.length === 0) return

      // Conflict check
      for (const [classId, classTimetable] of Object.entries(newTimetable)) {
        if (!affectedClasses.includes(classId) && classTimetable[targetDay]?.[targetSlotIndex]?.teacherId === teacherId) {
          alert('⚠️ Conflict: Teacher is busy at target time.')
          return
        }
      }

      affectedClasses.forEach(classId => {
        const slot = newTimetable[classId][sourceDay][sourceSlotIndex]
        if (!newTimetable[classId][targetDay]) newTimetable[classId][targetDay] = Array(10).fill(null)
        const targetSlot = newTimetable[classId][targetDay][targetSlotIndex]
        newTimetable[classId][targetDay][targetSlotIndex] = slot
        newTimetable[classId][sourceDay][sourceSlotIndex] = targetSlot
      })
    } else if (selectedClassId) {
      const classId = selectedClassId
      if (!newTimetable[classId][targetDay]) newTimetable[classId][targetDay] = Array(10).fill(null)
      const sourceSlot = draggedSlot.slot
      const targetSlot = newTimetable[classId][targetDay][targetSlotIndex]
      newTimetable[classId][targetDay][targetSlotIndex] = sourceSlot
      newTimetable[classId][sourceDay][sourceSlotIndex] = targetSlot
    }

    if (generatedTimetable) setGeneratedTimetable(newTimetable)
    else saveTimetables(newTimetable)
    setDraggedSlot(null)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('dragging')
    setDraggedSlot(null)
  }

  return (
    <div className="timetable-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.timetable', language)}</h1>
          <p className="page-subtitle">{t('timetable.manageSchedules', language)}</p>
        </div>
      </div>

      <div className="timetable-controls">
        <div className="control-group">
          <label className="control-label">{t('timetable.viewMode', language)}</label>
          <div className="view-mode-toggle">
            <button className={`mode-btn ${viewMode === 'class' ? 'active' : ''}`} onClick={() => setViewMode('class')}>{t('timetable.classView', language)}</button>
            <button className={`mode-btn ${viewMode === 'teacher' ? 'active' : ''}`} onClick={() => setViewMode('teacher')}>{t('timetable.teacherView', language)}</button>
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">{viewMode === 'class' ? t('timetable.selectClass', language) : t('timetable.selectTeacher', language)}</label>
          <select
            className="input"
            value={viewMode === 'class' ? selectedClassId : selectedTeacherId}
            onChange={(e) => viewMode === 'class' ? setSelectedClassId(e.target.value) : setSelectedTeacherId(e.target.value)}
          >
            <option value="">-- {t('timetable.selectClass', language)} --</option>
            {(viewMode === 'class' ? classes : teachers).map(item => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>

        <div className="control-actions">
          <button className={`btn ${isEditMode ? 'btn-danger' : 'btn-secondary'}`} onClick={() => setIsEditMode(!isEditMode)}>
            {isEditMode ? t('timetable.cancelEdit', language) : t('timetable.editModeBtn', language)}
          </button>
          {viewMode === 'class' && (
            <>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={!selectedClassId || isGenerating || isEditMode}>
                {isGenerating ? t('timetable.generating', language) : t('timetable.generateBtn', language)}
              </button>
              <button className="btn btn-success" onClick={handleGenerateAll} disabled={isGenerating || isEditMode}>
                {isGenerating ? t('timetable.generating', language) : t('timetable.generateAll', language)}
              </button>
            </>
          )}
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)} disabled={isEditMode}>
            {t('timetable.import', language)}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowExportModal(true)} disabled={isEditMode || (viewMode === 'teacher' && !selectedTeacherId)}>
            {t('timetable.export', language)}
          </button>
          <button className="btn btn-secondary" onClick={handleExportPDF} disabled={isEditMode || (viewMode === 'class' && !selectedClassId) || (viewMode === 'teacher' && !selectedTeacherId)}>
            {t('timetable.exportPDF', language)}
          </button>
          {viewMode === 'class' && selectedClassId && currentTimetable[selectedClassId] && (
            <button className="btn btn-danger" onClick={handleClearTimetable} disabled={isEditMode}>
              {t('timetable.clearCurrent', language)}
            </button>
          )}
          {Object.keys(currentTimetable).length > 0 && (
            <button className="btn btn-danger" onClick={handleClearAllTimetables} disabled={isEditMode}>
              {t('timetable.clearAllBtn', language)}
            </button>
          )}
          {generatedTimetable && <button className="btn btn-success" onClick={handleSave}>{t('timetable.save', language)}</button>}
        </div>

        {/* Bulk Export Section */}
        {Object.keys(currentTimetable).length > 0 && (
          <div className="bulk-export-section">
            <button className="btn btn-success" onClick={handleBulkExportPDF}>
              {t('timetable.exportAllClasses', language)}
            </button>
            <button className="btn btn-success" onClick={handleBulkTeacherExportPDF}>
              {t('timetable.exportAllTeachers', language)}
            </button>
          </div>
        )}
      </div>

      {isEditMode && (
        <div className="edit-mode-banner">
          <span>✏️ Edit Mode: {viewMode === 'class' ? 'Click to fill slots, or drag to swap' : 'Drag to rearrange teacher schedule'}</span>
        </div>
      )}

      {/* Grid Rendering */}
      {((viewMode === 'class' && selectedClassId) || (viewMode === 'teacher' && selectedTeacherId)) ? (
        <div className="timetable-container">
          <div className="timetable-grid">
            <div className="timetable-row header-row">
              <div className="timetable-cell header-cell">Time</div>
              {DAYS.map(day => <div key={day} className="timetable-cell header-cell">{day}</div>)}
            </div>

            {WEEKDAY_SLOTS.map((slot, slotIndex) => {
              if (slot.type !== 'slot') {
                return (
                  <div key={slotIndex} className="timetable-row break-row">
                    <div className="timetable-cell time-cell">{slot.time}</div>
                    <div className="timetable-cell break-cell" style={{ gridColumn: 'span 5', textAlign: 'center' }}>{slot.label}</div>
                  </div>
                )
              }

              const teachingIndex = WEEKDAY_TEACHING_INDICES.indexOf(slotIndex)
              return (
                <div key={slotIndex} className="timetable-row">
                  <div className="timetable-cell time-cell">{slot.time}</div>
                  {DAYS.map(day => {
                    const actualIndex = getActualSlotIndex(day, teachingIndex)
                    const slotData = viewMode === 'class' ? getSlot(day, actualIndex) : getTeacherSchedule(day, actualIndex)
                    
                    return (
                      <div
                        key={day}
                        className={`timetable-cell ${slotData ? 'slot-filled' : 'slot-empty'} ${isEditMode ? 'editable-slot' : ''}`}
                        draggable={isEditMode && !!slotData}
                        onDragStart={(e) => slotData && handleDragStart(e, day, actualIndex, viewMode === 'class' ? (slotData as TimetableSlot) : { subject: (slotData as any).subject, teacherId: selectedTeacherId })}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, day, actualIndex, viewMode === 'teacher')}
                        onClick={() => {
                          if (viewMode !== 'class') return
                          if (!selectedClassId) {
                            alert('Please select a class first!')
                            return
                          }
                          if (!isEditMode) {
                            alert('Please enable Edit Mode first to modify slots!')
                            return
                          }
                          handleOpenManualModal(day, actualIndex, slotData as TimetableSlot)
                        }}
                      >
                        {slotData ? (
                          <div className="slot-content">
                            <div className="slot-subject">{(slotData as any).subject}</div>
                            <div className="slot-teacher">{viewMode === 'class' ? getTeacherName((slotData as TimetableSlot).teacherId) : (slotData as any).className}</div>
                          </div>
                        ) : (
                          <span className="empty-text">{isEditMode && viewMode === 'class' ? '➕ Fill' : 'Free'}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="empty-state"><h3>Select a {viewMode} to view timetable</h3></div>
      )}

      {/* Manual Modal */}
      {showManualModal && (
        <div className="modal-overlay" onClick={() => setShowManualModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Manual Assignment</h2></div>
            <form onSubmit={handleManualSubmit}>
              <div className="form-group">
                <label>Subject</label>
                <select className="input" value={manualFormData.subject} onChange={e => setManualFormData({...manualFormData, subject: e.target.value})} required>
                  <option value="">-- Select --</option>
                  {selectedClass?.subjects.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Teacher</label>
                <select className="input" value={manualFormData.teacherId} onChange={e => setManualFormData({...manualFormData, teacherId: e.target.value})} required>
                  <option value="">-- Select --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowManualModal(false)}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={() => {
                  if (manualSlotData && selectedClassId) {
                    const { day, slotIndex } = manualSlotData;
                    const newTimetable = { ...currentTimetable };
                    if (newTimetable[selectedClassId] && newTimetable[selectedClassId][day]) {
                      newTimetable[selectedClassId][day][slotIndex] = null;
                      if (generatedTimetable) setGeneratedTimetable(newTimetable);
                      else saveTimetables(newTimetable);
                    }
                    setShowManualModal(false);
                  }
                }}>🗑️ Clear Slot</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={handleResetImport}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>📥 Import Timetable</h2>
            </div>
            
            <div className="import-section">
              <p className="import-description">
                Import timetable from a JSON or Excel file. You can modify the imported timetable using Edit Mode.
              </p>

              {/* File Upload */}
              <div className="file-upload-area">
                <label className="file-upload-label">
                  <input
                    type="file"
                    accept=".json,.xlsx,.xls"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <div className="upload-box">
                    <span className="upload-icon">📁</span>
                    <span className="upload-text">
                      {importFile ? importFile.name : 'Click to upload JSON or Excel file'}
                    </span>
                    <span className="upload-hint">Supports: .json, .xlsx, .xls</span>
                  </div>
                </label>
              </div>

              {/* Status Message */}
              {importStatus.type !== 'idle' && (
                <div className={`status-message ${importStatus.type}`}>
                  {importStatus.type === 'success' && <span>✅</span>}
                  {importStatus.type === 'error' && <span>⚠️</span>}
                  {importStatus.message}
                </div>
              )}

              {/* Preview */}
              {importedData && (
                <div className="import-preview">
                  <h4>📋 Import Preview</h4>
                  <ul className="preview-list">
                    {Object.entries(importedData).map(([classId, timetable]) => {
                      const className = classes.find(c => c.id === classId)?.name || classId
                      const slotCount = Object.values(timetable).reduce((acc, day) => acc + (day ? Object.values(day).filter(Boolean).length : 0), 0)
                      return (
                        <li key={classId} className="preview-item">
                          <span className="preview-class">{className}</span>
                          <span className="preview-count">{slotCount} slots</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {/* Import Format Guide */}
              <div className="import-guide">
                <h4>📝 Format Guide</h4>
                <details>
                  <summary>JSON Format</summary>
                  <pre>{`{
  "timetables": {
    "classId": {
      "Monday": [
        {"subject": "Math", "teacherId": "teacherId"},
        null,
        ...
      ],
      "Tuesday": [...]
    }
  }
}`}</pre>
                </details>
                <details>
                  <summary>Excel Format</summary>
                  <p>Each sheet = one class. Columns: Time, Monday, Tuesday, Wednesday, Thursday, Friday</p>
                  <p>Cell format: "Subject\\nTeacher Name"</p>
                </details>
              </div>
            </div>

            {/* Actions */}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={handleResetImport}>
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleConfirmImport}
                disabled={!importedData}
              >
                ✅ Confirm Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>📤 Export Timetable</h2>
            </div>

            <div className="export-section">
              <p className="export-description">
                Export timetable in JSON or Excel format. The exported file can be re-imported later.
              </p>

              {/* Export Format Selection */}
              <div className="form-group">
                <label className="control-label">Export Format</label>
                <div className="format-selector">
                  <button
                    type="button"
                    className={`format-btn ${exportFormat === 'json' ? 'active' : ''}`}
                    onClick={() => setExportFormat('json')}
                  >
                    📄 JSON
                  </button>
                  <button
                    type="button"
                    className={`format-btn ${exportFormat === 'excel' ? 'active' : ''}`}
                    onClick={() => setExportFormat('excel')}
                  >
                    📊 Excel
                  </button>
                </div>
              </div>

              {/* Export Scope Selection */}
              <div className="form-group">
                <label className="control-label">Export Scope</label>
                <div className="scope-selector">
                  <button
                    type="button"
                    className={`scope-btn ${exportScope === 'current' ? 'active' : ''}`}
                    onClick={() => setExportScope('current')}
                    disabled={viewMode !== 'class' || !selectedClassId}
                  >
                    📚 Current {viewMode === 'class' && selectedClassId ? selectedClass?.name : 'Class'}
                  </button>
                  <button
                    type="button"
                    className={`scope-btn ${exportScope === 'all' ? 'active' : ''}`}
                    onClick={() => setExportScope('all')}
                  >
                    📦 All Classes ({Object.keys(currentTimetable).length})
                  </button>
                </div>
              </div>

              {/* Export Preview */}
              <div className="export-preview">
                <h4>📋 Export Summary</h4>
                <div className="preview-info">
                  <div className="info-row">
                    <span className="info-label">Format:</span>
                    <span className="info-value">{exportFormat.toUpperCase()}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Scope:</span>
                    <span className="info-value">
                      {exportScope === 'current' && selectedClassId
                        ? `Single Class: ${selectedClass?.name}`
                        : `All ${Object.keys(currentTimetable).length} Classes`}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">File Type:</span>
                    <span className="info-value">.{exportFormat}</span>
                  </div>
                </div>
              </div>

              {/* Format Info */}
              <div className="format-info">
                <details>
                  <summary>ℹ️ Format Differences</summary>
                  <div className="info-content">
                    <p><strong>JSON:</strong> Best for backup and re-import. Contains all data in a structured format.</p>
                    <p><strong>Excel:</strong> Best for sharing and printing. Each class in a separate sheet with formatted timetable.</p>
                  </div>
                </details>
              </div>
            </div>

            {/* Actions */}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExportTimetable}
              >
                ✅ Export {exportFormat === 'json' ? 'JSON' : 'Excel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Timetable
