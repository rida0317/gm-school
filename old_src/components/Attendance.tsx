// src/components/Attendance.tsx - Main attendance marking page

import React, { useState, useEffect } from 'react'
import { useSchoolStore } from '../store/schoolStore'
import { useAttendanceStore } from '../store/attendanceStore'
import { useStudentsStore } from '../store/studentsStore'
import { t } from '../utils/translations'
import { showToast } from '../hooks/useToast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './Attendance.css'

interface StudentAttendance {
  studentId: string
  studentName: string
  codeMassar?: string
  status: 'present' | 'absent' | 'late' | 'excused'
  notes: string
}

const Attendance: React.FC = () => {
  const { classes, students, schoolName, logo, language = 'en' } = useSchoolStore()
  const { createSession, markAttendance, getSessionsByDate, getSessionRecords } = useAttendanceStore()
  
  // State
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [period, setPeriod] = useState<number>(1)
  const [subject, setSubject] = useState<string>('')
  const [attendanceRecords, setAttendanceRecords] = useState<StudentAttendance[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionExists, setSessionExists] = useState(false)

  // Get class students
  const classStudents = students.filter(s => s.classId === selectedClassId)

  // Initialize attendance records
  const initializeAttendanceRecords = () => {
    const records: StudentAttendance[] = classStudents.map(student => ({
      studentId: student.id,
      studentName: student.name,
      codeMassar: student.codeMassar,
      status: 'present',
      notes: ''
    }))
    setAttendanceRecords(records)
    setLoading(false)
  }

  // Check for existing session
  const checkExistingSession = async () => {
    if (!selectedClassId || !selectedDate) return
    
    try {
      const sessions = await getSessionsByDate(selectedClassId, selectedDate)
      if (sessions && sessions.length > 0) {
        const session = sessions[0]
        setSessionId(session.id)
        setSessionExists(true)
        setPeriod(session.period)
        
        try {
          const records = await getSessionRecords(session.id)
          if (records && records.length > 0) {
            const existingRecords: StudentAttendance[] = records.map(record => ({
              studentId: record.student_id,
              studentName: record.student_name || '',
              codeMassar: record.code_massar,
              status: record.status,
              notes: record.notes || ''
            }))
            setAttendanceRecords(existingRecords)
            setLoading(false)
            return
          }
        } catch (recordsError) {
          console.error('Error loading records:', recordsError)
        }
      }
      
      // Try to load from localStorage
      const localKey = `local-${selectedClassId}-${selectedDate}-1`
      const localData = localStorage.getItem(`attendance-${localKey}`)
      if (localData) {
        try {
          const parsed = JSON.parse(localData)
          setSessionId(localKey)
          setSessionExists(true)
          setPeriod(parsed.period || 1)
          const existingRecords: StudentAttendance[] = parsed.records.map((r: any) => ({
            studentId: r.student_id,
            studentName: students.find(s => s.id === r.student_id)?.name || '',
            codeMassar: students.find(s => s.id === r.student_id)?.codeMassar,
            status: r.status,
            notes: r.notes || ''
          }))
          setAttendanceRecords(existingRecords)
          setLoading(false)
          return
        } catch (e) {
          console.error('Error loading local attendance:', e)
        }
      }
      
      // No data found - initialize fresh
      setSessionId(null)
      setSessionExists(false)
      initializeAttendanceRecords()
    } catch (error) {
      console.error('Error checking existing session:', error)
      // Try localStorage as fallback
      const localKey = `local-${selectedClassId}-${selectedDate}-1`
      const localData = localStorage.getItem(`attendance-${localKey}`)
      if (localData) {
        try {
          const parsed = JSON.parse(localData)
          setSessionId(localKey)
          setSessionExists(true)
          setPeriod(parsed.period || 1)
          const existingRecords: StudentAttendance[] = parsed.records.map((r: any) => ({
            studentId: r.student_id,
            studentName: students.find(s => s.id === r.student_id)?.name || '',
            codeMassar: students.find(s => s.id === r.student_id)?.codeMassar,
            status: r.status,
            notes: r.notes || ''
          }))
          setAttendanceRecords(existingRecords)
          setLoading(false)
          return
        } catch (e) {
          console.error('Error loading local attendance:', e)
        }
      }
      initializeAttendanceRecords()
    }
  }

  // Initialize when class or date changes
  useEffect(() => {
    if (!selectedClassId) {
      setLoading(false)
      return
    }
    
    if (classStudents.length === 0) {
      setLoading(false)
      return
    }
    
    setLoading(true)
    // Use setTimeout to avoid blocking UI
    const timer = setTimeout(() => {
      checkExistingSession()
    }, 50)
    
    return () => clearTimeout(timer)
  }, [selectedClassId, selectedDate])

  const updateStudentStatus = (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    setAttendanceRecords(prev =>
      prev.map(record =>
        record.studentId === studentId ? { ...record, status } : record
      )
    )
  }

  const updateStudentNotes = (studentId: string, notes: string) => {
    setAttendanceRecords(prev =>
      prev.map(record =>
        record.studentId === studentId ? { ...record, notes } : record
      )
    )
  }

  const markAllPresent = () => {
    setAttendanceRecords(prev =>
      prev.map(record => ({ ...record, status: 'present' }))
    )
  }

  const clearAll = () => {
    setAttendanceRecords(prev =>
      prev.map(record => ({ ...record, status: 'present', notes: '' }))
    )
  }

  const handleSaveAttendance = async () => {
    if (!selectedClassId || !subject) {
      showToast(t('attendance.selectClassAndSubject', language) || 'Please select class and subject', 'error')
      return
    }

    try {
      setSaving(true)
      
      let currentSessionId = sessionId
      
      // Create session if it doesn't exist
      if (!currentSessionId) {
        try {
          const newSession = await createSession({
            class_id: selectedClassId,
            subject_id: subject,
            teacher_id: '', // Could be current user
            date: selectedDate,
            period: period,
            is_cancelled: false
          })
          currentSessionId = newSession.id
          setSessionId(currentSessionId)
          setSessionExists(true)
        } catch (sessionError: any) {
          console.error('Error creating session:', sessionError)
          // Generate a local session ID for demo purposes
          currentSessionId = `local-${selectedClassId}-${selectedDate}-${period}`
          setSessionId(currentSessionId)
          setSessionExists(true)
        }
      }

      // Mark attendance
      const records = attendanceRecords.map(record => ({
        student_id: record.studentId,
        status: record.status,
        notes: record.notes
      }))

      try {
        await markAttendance(currentSessionId, records)
        showToast(t('attendance.savedSuccessfully', language) || 'Attendance saved successfully!', 'success')
      } catch (markError: any) {
        console.error('Error marking attendance:', markError)
        // Save to localStorage as fallback
        const attendanceData = {
          sessionId: currentSessionId,
          classId: selectedClassId,
          subject: subject,
          date: selectedDate,
          period: period,
          records: records,
          savedAt: new Date().toISOString()
        }
        localStorage.setItem(`attendance-${currentSessionId}`, JSON.stringify(attendanceData))
        showToast('Attendance saved locally!', 'success')
      }
    } catch (error: any) {
      console.error('Error saving attendance:', error)
      // Even if everything fails, save locally
      const currentSessionId = sessionId || `local-${selectedClassId}-${selectedDate}-${period}`
      const records = attendanceRecords.map(record => ({
        student_id: record.studentId,
        status: record.status,
        notes: record.notes
      }))
      const attendanceData = {
        sessionId: currentSessionId,
        classId: selectedClassId,
        subject: subject,
        date: selectedDate,
        period: period,
        records: records,
        savedAt: new Date().toISOString()
      }
      localStorage.setItem(`attendance-${currentSessionId}`, JSON.stringify(attendanceData))
      showToast('Attendance saved locally!', 'success')
    } finally {
      setSaving(false)
    }
  }

  const getStatusCount = (status: string) => {
    return attendanceRecords.filter(r => r.status === status).length
  }

  const getAttendanceRate = () => {
    if (attendanceRecords.length === 0) return 0
    const present = getStatusCount('present') + getStatusCount('late')
    return ((present / attendanceRecords.length) * 100).toFixed(1)
  }

  const handleExportPDF = async () => {
    if (!selectedClassId || attendanceRecords.length === 0) {
      showToast(t('attendance.noDataToExport', language) || 'No attendance data to export', 'error')
      return
    }

    const doc = new jsPDF('p', 'mm', 'a4')
    let yPos = 15

    // Add School Logo and Name
    if (logo) {
      try {
        const format = logo.includes('image/png') ? 'PNG' : 'JPEG'
        doc.addImage(logo, format, 14, 10, 20, 20)
        doc.setFontSize(16)
        doc.setTextColor(40)
        doc.text(schoolName, 40, 18)
        doc.setFontSize(14)
        doc.setTextColor(100)
        doc.text('Attendance Report', 40, 26)
        yPos = 38
      } catch (e) {
        console.error('Could not add logo to PDF:', e)
        doc.setFontSize(16)
        doc.setTextColor(40)
        doc.text(schoolName, 14, yPos)
        yPos += 8
        doc.setFontSize(14)
        doc.setTextColor(100)
        doc.text('Attendance Report', 14, yPos)
        yPos += 10
      }
    } else {
      doc.setFontSize(16)
      doc.setTextColor(40)
      doc.text(schoolName, 14, yPos)
      yPos += 8
      doc.setFontSize(14)
      doc.setTextColor(100)
      doc.text('Attendance Report', 14, yPos)
      yPos += 10
    }

    // Class and Date Info
    doc.setFontSize(12)
    doc.setTextColor(80)
    const className = classes.find(c => c.id === selectedClassId)?.name || 'Unknown'
    doc.text(`Class: ${className}`, 14, yPos)
    doc.text(`Date: ${new Date(selectedDate).toLocaleDateString()}`, 14, yPos + 6)
    doc.text(`Period: ${period}`, 14, yPos + 12)
    doc.text(`Subject: ${subject || 'N/A'}`, 14, yPos + 18)
    yPos += 30

    // Summary Statistics
    doc.setFontSize(14)
    doc.setTextColor(40)
    doc.text('Summary', 14, yPos)
    yPos += 8

    const summaryData = [
      ['Total Students', attendanceRecords.length.toString()],
      ['Present', getStatusCount('present').toString()],
      ['Absent', getStatusCount('absent').toString()],
      ['Late', getStatusCount('late').toString()],
      ['Excused', getStatusCount('excused').toString()],
      ['Attendance Rate', `${getAttendanceRate()}%`]
    ]

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'striped',
      headStyles: { fillColor: [13, 110, 253] },
      margin: { left: 14, right: 14 }
    })

    yPos = (doc as any).lastAutoTable.finalY + 15

    // Student Details
    doc.setFontSize(14)
    doc.setTextColor(40)
    doc.text('Student Details', 14, yPos)
    yPos += 8

    const studentData = attendanceRecords.map((record, index) => {
      const statusEmoji = {
        'present': '✅',
        'absent': '❌',
        'late': '⏰',
        'excused': '📝'
      }
      return [
        (index + 1).toString(),
        record.studentName,
        record.codeMassar || '-',
        `${statusEmoji[record.status]} ${record.status.charAt(0).toUpperCase() + record.status.slice(1)}`,
        record.notes || '-'
      ]
    })

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Student Name', 'Code Massar', 'Status', 'Notes']],
      body: studentData,
      theme: 'striped',
      headStyles: { fillColor: [13, 110, 253] },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 50 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 'auto' }
      },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 }
    })

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(
        `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
        14,
        doc.internal.pageSize.height - 10
      )
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 28, doc.internal.pageSize.height - 10)
    }

    // Save PDF
    const filename = `Attendance_${className}_${selectedDate}.pdf`
    doc.save(filename)
    showToast(t('attendance.exportedSuccessfully', language) || 'Report exported successfully!', 'success')
  }

  const selectedClass = classes.find(c => c.id === selectedClassId)
  const classSubject = selectedClass?.subjects.find(s => s.name === subject)

  return (
    <div className="attendance-page">
      <div className="page-header">
        <div>
          <h1>✅ {t('attendance.title', language) || 'Attendance Tracking'}</h1>
          <p className="page-subtitle">{t('attendance.subtitle', language) || 'Mark and manage student attendance'}</p>
        </div>
      </div>

      {/* Selection Controls */}
      <div className="attendance-controls">
        <div className="control-group">
          <label className="control-label">
            📚 {t('attendance.selectClass', language) || 'Select Class'} *
          </label>
          <select
            className="select control-input"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="">{t('attendance.chooseClass', language) || 'Choose a class'}</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name} - {cls.level}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">
            📅 {t('attendance.date', language) || 'Date'} *
          </label>
          <input
            type="date"
            className="input control-input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="control-group">
          <label className="control-label">
            📖 {t('attendance.subject', language) || 'Subject'} *
          </label>
          <select
            className="select control-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={!selectedClassId}
          >
            <option value="">{t('attendance.chooseSubject', language) || 'Choose subject'}</option>
            {selectedClass?.subjects.map(sub => (
              <option key={sub.name} value={sub.name}>{sub.name} ({sub.hours}h)</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">
            ⏰ {t('attendance.period', language) || 'Period'}
          </label>
          <select
            className="select control-input"
            value={period}
            onChange={(e) => setPeriod(parseInt(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7].map(p => (
              <option key={p} value={p}>Period {p}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>{t('attendance.loading', language) || 'Loading attendance data...'}</p>
        </div>
      ) : selectedClassId && classStudents.length > 0 ? (
        <>
          {/* Quick Actions */}
          <div className="quick-actions">
            <button
              className="btn btn-secondary"
              onClick={markAllPresent}
              disabled={attendanceRecords.length === 0}
            >
              ✅ {t('attendance.markAllPresent', language) || 'Mark All Present'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={clearAll}
              disabled={attendanceRecords.length === 0}
            >
              🔄 {t('attendance.clearAll', language) || 'Clear All'}
            </button>
            <button
              className="btn btn-success"
              onClick={handleExportPDF}
              disabled={!selectedClassId || attendanceRecords.length === 0}
            >
              📄 {t('attendance.exportReport', language) || 'Export PDF'}
            </button>
            <div className="session-info">
              {sessionExists && (
                <span className="badge badge-info">
                  ℹ️ {t('attendance.existingSession', language) || 'Existing session loaded'}
                </span>
              )}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="attendance-summary">
            <div className="summary-card present">
              <div className="summary-icon">✅</div>
              <div className="summary-content">
                <div className="summary-value">{getStatusCount('present')}</div>
                <div className="summary-label">{t('attendance.present', language) || 'Present'}</div>
              </div>
            </div>
            <div className="summary-card absent">
              <div className="summary-icon">❌</div>
              <div className="summary-content">
                <div className="summary-value">{getStatusCount('absent')}</div>
                <div className="summary-label">{t('attendance.absent', language) || 'Absent'}</div>
              </div>
            </div>
            <div className="summary-card late">
              <div className="summary-icon">⏰</div>
              <div className="summary-content">
                <div className="summary-value">{getStatusCount('late')}</div>
                <div className="summary-label">{t('attendance.late', language) || 'Late'}</div>
              </div>
            </div>
            <div className="summary-card excused">
              <div className="summary-icon">📝</div>
              <div className="summary-content">
                <div className="summary-value">{getStatusCount('excused')}</div>
                <div className="summary-label">{t('attendance.excused', language) || 'Excused'}</div>
              </div>
            </div>
            <div className={`summary-card rate ${parseFloat(getAttendanceRate()) >= 90 ? 'excellent' : parseFloat(getAttendanceRate()) >= 75 ? 'good' : 'warning'}`}>
              <div className="summary-icon">📈</div>
              <div className="summary-content">
                <div className="summary-value">{getAttendanceRate()}%</div>
                <div className="summary-label">{t('attendance.attendanceRate', language) || 'Attendance Rate'}</div>
              </div>
            </div>
          </div>

          {/* Student List */}
          <div className="students-attendance-container">
            <div className="students-header">
              <div className="student-info">
                <span className="student-number">#</span>
                <span className="student-name-header">{t('attendance.studentName', language) || 'Student Name'}</span>
                <span className="student-code-header">{t('attendance.codeMassar', language) || 'Code Massar'}</span>
              </div>
              <div className="student-status-header">{t('attendance.status', language) || 'Status'}</div>
              <div className="student-notes-header">{t('attendance.notes', language) || 'Notes'}</div>
            </div>

            <div className="students-list">
              {attendanceRecords.map((record, index) => (
                <div key={record.studentId} className="student-attendance-row">
                  <div className="student-info">
                    <span className="student-number">{index + 1}</span>
                    <div className="student-details">
                      <span className="student-name">{record.studentName}</span>
                      <span className="student-code">{record.codeMassar || '-'}</span>
                    </div>
                  </div>
                  <div className="student-status">
                    <button
                      className={`status-btn present ${record.status === 'present' ? 'active' : ''}`}
                      onClick={() => updateStudentStatus(record.studentId, 'present')}
                      title={t('attendance.present', language) || 'Present'}
                    >
                      ✅
                    </button>
                    <button
                      className={`status-btn absent ${record.status === 'absent' ? 'active' : ''}`}
                      onClick={() => updateStudentStatus(record.studentId, 'absent')}
                      title={t('attendance.absent', language) || 'Absent'}
                    >
                      ❌
                    </button>
                    <button
                      className={`status-btn late ${record.status === 'late' ? 'active' : ''}`}
                      onClick={() => updateStudentStatus(record.studentId, 'late')}
                      title={t('attendance.late', language) || 'Late'}
                    >
                      ⏰
                    </button>
                    <button
                      className={`status-btn excused ${record.status === 'excused' ? 'active' : ''}`}
                      onClick={() => updateStudentStatus(record.studentId, 'excused')}
                      title={t('attendance.excused', language) || 'Excused'}
                    >
                      📝
                    </button>
                  </div>
                  <div className="student-notes">
                    <input
                      type="text"
                      className="input notes-input"
                      placeholder={t('attendance.addNote', language) || 'Add note...'}
                      value={record.notes}
                      onChange={(e) => updateStudentNotes(record.studentId, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="save-section">
            <button
              className="btn btn-primary btn-large"
              onClick={handleSaveAttendance}
              disabled={saving || !subject}
            >
              {saving ? '⏳' : '💾'} {saving ? (t('attendance.saving', language) || 'Saving...') : (t('attendance.saveAttendance', language) || 'Save Attendance')}
            </button>
          </div>
        </>
      ) : selectedClassId ? (
        <div className="empty-state">
          <span className="empty-icon">👥</span>
          <h3>{t('attendance.noStudents', language) || 'No students found'}</h3>
          <p>{t('attendance.addStudentsToClass', language) || 'Add students to this class first'}</p>
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">📅</span>
          <h3>{t('attendance.selectClassToBegin', language) || 'Select a class to begin'}</h3>
          <p>{t('attendance.chooseClassFromDropdown', language) || 'Choose a class from the dropdown above'}</p>
        </div>
      )}
    </div>
  )
}

export default Attendance

