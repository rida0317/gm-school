// src/components/Grades.tsx - Main Grades & Analytics Component

import React, { useState, useMemo, useEffect } from 'react'
import { useGradesStore, useGrades } from '../store/gradesStore'
import { useSchoolStore } from '../store/schoolStore'
import { t } from '../utils/translations'
import { showToast } from '../hooks/useToast'
import type { Grade, GradeInput, ExamType } from '../types'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import './Grades.css'

// Helper function to save PDF - browser download
const savePDF = async (doc: jsPDF, filename: string) => {
  // Browser download
  doc.save(filename)
}

// Helper function to export analytics to Excel
const exportAnalyticsToExcel = (analytics: any, className: string, schoolName: string) => {
  const wb = XLSX.utils.book_new()
  
  // Summary Sheet
  const summaryData = [
    ['School Analytics Report'],
    ['School:', schoolName],
    ['Class:', className],
    ['Generated:', new Date().toLocaleDateString()],
    [],
    ['Summary Statistics'],
    ['Total Students', analytics.totalStudents],
    ['Class Average', analytics.averageGrade],
    ['Highest Grade', analytics.highestGrade],
    ['Lowest Grade', analytics.lowestGrade],
    ['Success Rate', `${analytics.successRate}%`],
    ['Students Below Average', analytics.belowAverage],
    ['Students at Risk', analytics.riskStudents]
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')
  
  // Grade Distribution Sheet
  const distributionData = analytics.gradeDistribution.map((d: any) => [
    d.range, d.count, `${d.percentage}%`
  ])
  distributionData.unshift(['Grade Range', 'Count', 'Percentage'])
  const wsDistribution = XLSX.utils.aoa_to_sheet(distributionData)
  XLSX.utils.book_append_sheet(wb, wsDistribution, 'Grade Distribution')
  
  // Subject Performance Sheet
  const subjectData = analytics.subjectAverages.map((s: any) => [
    s.subject, s.average, s.studentCount
  ])
  subjectData.unshift(['Subject', 'Average', 'Student Count'])
  const wsSubject = XLSX.utils.aoa_to_sheet(subjectData)
  XLSX.utils.book_append_sheet(wb, wsSubject, 'Subject Performance')
  
  // Student List Sheet
  const studentData = analytics.students.map((s: any) => [
    s.name, s.average, s.classRank, s.riskLevel
  ])
  studentData.unshift(['Student Name', 'Average', 'Class Rank', 'Risk Level'])
  const wsStudents = XLSX.utils.aoa_to_sheet(studentData)
  XLSX.utils.book_append_sheet(wb, wsStudents, 'Students')
  
  // Export file
  XLSX.writeFile(wb, `Analytics_${className}_${new Date().toISOString().split('T')[0]}.xlsx`)
}

const EXAM_TYPES: ExamType[] = ['Controle 1', 'Controle 2', 'Examen', 'Devoir', 'Quiz', 'Final']

const Grades: React.FC = () => {
  const grades = useGrades()
  const { fetchGrades, addGrade, updateGrade, deleteGrade, getClassAnalytics, getStudentPerformance, getClassReport, getStudentDetailAnalytics, addGradesBulk, clearGrades } = useGradesStore()
  const { students, classes, schoolName, logo, language = 'en', academicYear } = useSchoolStore()

  // Fetch grades from Supabase on mount
  useEffect(() => {
    fetchGrades()
  }, [fetchGrades])

  const [activeTab, setActiveTab] = useState<'manage' | 'import' | 'analytics'>('manage')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showStudentDetailModal, setShowStudentDetailModal] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const [formData, setFormData] = useState<GradeInput>({
    studentId: '',
    subject: '',
    examType: 'Controle 1',
    grade: 0,
    classId: '',
    date: new Date().toISOString().split('T')[0],
    coefficient: 1
  })

  // Get unique subjects from grades
  const uniqueSubjects = useMemo(() => {
    const subjects = new Set(grades.map(g => g.subject))
    return Array.from(subjects).sort()
  }, [grades])

  // Filter grades
  const filteredGrades = useMemo(() => {
    return grades.filter(g => {
      if (selectedClassId && g.classId !== selectedClassId) return false
      if (selectedSubject && g.subject !== selectedSubject) return false
      return true
    })
  }, [grades, selectedClassId, selectedSubject])

  // Get student name
  const getStudentName = (studentId: string) => {
    return students.find(s => s.id === studentId)?.name || studentId
  }

  // Get class name
  const getClassName = (classId: string) => {
    return classes.find(c => c.id === classId)?.name || classId
  }

  // Get student with grades aggregated by exam type
  const getStudentsWithGrades = () => {
    const classStudents = selectedClassId 
      ? students.filter(s => s.classId === selectedClassId)
      : students

    return classStudents.map(student => {
      const studentGrades = grades.filter(g => g.studentId === student.id)
      
      const controle1 = studentGrades.find(g => g.examType === 'Controle 1')?.grade ?? null
      const controle2 = studentGrades.find(g => g.examType === 'Controle 2')?.grade ?? null
      const examen = studentGrades.find(g => g.examType === 'Examen')?.grade ?? null
      
      // Calculate average (assuming equal weights)
      const validGrades = [controle1, controle2, examen].filter(g => g !== null) as number[]
      const average = validGrades.length > 0 
        ? validGrades.reduce((sum, g) => sum + g, 0) / validGrades.length 
        : 0

      return {
        student,
        controle1,
        controle2,
        examen,
        average
      }
    }).sort((a, b) => a.student.name.localeCompare(b.student.name))
  }

  // Get observation based on average
  const getObservation = (average: number): string => {
    if (average >= 16) return 'ممتاز - Excellent'
    if (average >= 14) return 'جيد جدا - Très Bien'
    if (average >= 12) return 'جيد - Bien'
    if (average >= 10) return 'مقبول - Assez Bien'
    if (average >= 8) return 'ضعيف - Faible'
    return 'ضعيف جدا - Très Faible'
  }

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.grade < 0 || formData.grade > 20) {
      showToast('Grade must be between 0 and 20', 'error')
      return
    }

    if (editingGrade) {
      updateGrade(editingGrade.id, formData as Partial<Grade>)
    } else {
      addGrade(formData)
    }

    // Auto-save after add/update
    setTimeout(() => {
      setLastSaved(new Date())
    }, 100)

    setShowModal(false)
    resetForm()
  }

  const handleSave = () => {
    setLastSaved(new Date())
    // Show success message
    const originalTitle = document.title
    document.title = '✅ Saved!'
    setTimeout(() => {
      document.title = originalTitle
    }, 2000)
  }

  const handleClearGrades = () => {
    if (confirm('Are you sure you want to clear ALL grades? This action cannot be undone!')) {
      clearGrades()
      setLastSaved(new Date())
      showToast('✅ All grades cleared successfully!', 'success')
    }
  }

  const handleDeleteGrade = (id: string) => {
    if (confirm('Delete this grade?')) {
      deleteGrade(id)
      setTimeout(() => {
        setLastSaved(new Date())
      }, 100)
    }
  }

  const resetForm = () => {
    setFormData({
      studentId: '',
      subject: '',
      examType: 'Controle 1',
      grade: 0,
      classId: '',
      date: new Date().toISOString().split('T')[0],
      coefficient: 1
    })
    setEditingGrade(null)
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (grade: Grade) => {
    setFormData({
      studentId: grade.studentId,
      subject: grade.subject,
      examType: grade.examType,
      grade: grade.grade,
      classId: grade.classId,
      date: grade.date,
      coefficient: grade.coefficient || 1
    })
    setEditingGrade(grade)
    setShowModal(true)
  }

  // Generate PDF Report
  const generatePDFReport = async () => {
    if (!selectedClassId) {
      showToast('Please select a class first', 'warning')
      return
    }

    const report = getClassReport(selectedClassId, getClassName(selectedClassId))
    const analytics = getClassAnalytics(selectedClassId, getClassName(selectedClassId))

    const doc = new jsPDF()
    let yPos = 15

    // Add School Logo and Name
    if (logo) {
      try {
        const format = logo.includes('image/png') ? 'PNG' : 'JPEG'
        doc.addImage(logo, format, 14, 10, 20, 20)
        doc.setFontSize(18)
        doc.setTextColor(40)
        doc.text(schoolName, 40, 20)
        doc.setFontSize(14)
        doc.setTextColor(100)
        doc.text(`Class Report - ${report.className}`, 40, 28)
        yPos = 40
      } catch (e) {
        console.error('Could not add logo to PDF:', e)
        // Fallback without logo
        doc.setFontSize(18)
        doc.setTextColor(40)
        doc.text(schoolName, 14, yPos)
        yPos += 8
        doc.setFontSize(14)
        doc.setTextColor(100)
        doc.text(`Class Report - ${report.className}`, 14, yPos)
        yPos += 10
      }
    } else {
      // No logo - simple header
      doc.setFontSize(18)
      doc.setTextColor(40)
      doc.text(schoolName, 14, yPos)
      yPos += 8
      doc.setFontSize(14)
      doc.setTextColor(100)
      doc.text(`Class Report - ${report.className}`, 14, yPos)
      yPos += 10
    }

    // Summary
    doc.setFontSize(12)
    doc.setTextColor(80)
    doc.text(`Generated: ${new Date(report.generatedAt).toLocaleDateString()}`, 14, yPos)
    yPos += 10

    // Statistics
    const stats = [
      ['Total Students', report.totalStudents.toString()],
      ['Average Grade', report.averageGrade.toString()],
      ['Success Rate', `${report.successRate}%`],
      ['Highest Grade', analytics.highestGrade.toString()],
      ['Lowest Grade', analytics.lowestGrade.toString()]
    ]

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: stats,
      theme: 'striped'
    })

    yPos = (doc as any).lastAutoTable.finalY + 10

    // Top Student
    if (report.topStudent) {
      doc.text(`Top Student: ${report.topStudent.name} (${report.topStudent.average}/20)`, 14, yPos)
      yPos += 10
    }

    // Subject Performance
    doc.text('Subject Performance', 14, yPos)
    yPos += 5
    autoTable(doc, {
      startY: yPos,
      head: [['Subject', 'Average', 'Students']],
      body: report.subjectPerformance.map(s => [s.subject, s.average.toString(), s.studentCount.toString()]),
      theme: 'striped'
    })

    yPos = (doc as any).lastAutoTable.finalY + 10

    // Grade Distribution
    doc.text('Grade Distribution', 14, yPos)
    yPos += 5
    autoTable(doc, {
      startY: yPos,
      head: [['Range', 'Count', 'Percentage']],
      body: report.gradeDistribution.map(d => [d.range, d.count.toString(), `${d.percentage}%`]),
      theme: 'striped'
    })

    await savePDF(doc, `Class_Report_${report.className}_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  return (
    <div className="grades-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('grades.title', language)}</h1>
          <p className="page-subtitle">
            {t('grades.manage', language)}
            {lastSaved && (
              <span className="last-saved">
                {' '}• {t('grades.lastSaved', language)}: {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={handleSave}
            title={t('grades.saveChanges', language)}
          >
            {t('grades.save', language)}
          </button>
          <button
            className="btn btn-danger"
            onClick={handleClearGrades}
            disabled={grades.length === 0}
            title={t('grades.clearAllGrades', language)}
          >
            {t('grades.clearAll', language)}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'manage' ? 'active' : ''}`}
          onClick={() => setActiveTab('manage')}
        >
          {t('grades.gradesManagement', language)}
        </button>
        <button
          className={`tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          {t('grades.importGrades', language)}
        </button>
        <button
          className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          {t('grades.analyticsDashboard', language)}
        </button>
      </div>

      {/* Filters */}
      <div className="filters">
        <select
          className="select"
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
        >
          <option value="">{t('grades.allClasses', language)}</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          className="select"
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
        >
          <option value="">{t('grades.allSubjects', language)}</option>
          {uniqueSubjects.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {activeTab === 'analytics' && selectedClassId && (
          <button className="btn btn-secondary" onClick={generatePDFReport}>
            {t('grades.exportPDF', language)}
          </button>
        )}
      </div>

      {/* Manage Tab */}
      {activeTab === 'manage' && (
        <div className="grades-section">
          <div className="section-header">
            <h2>{t('grades.allGrades', language)} ({filteredGrades.length})</h2>
            <button className="btn btn-primary" onClick={openAddModal}>
              {t('grades.addGrade', language)}
            </button>
          </div>

          {/* Massar Header Info */}
          <div className="massar-header">
            <div className="massar-header-row">
              <div className="massar-title">{t('grades.continuousAssessment', language)}</div>
            </div>
            <div className="massar-info-grid">
              <div className="massar-info-item">
                <span className="info-label">{t('grades.academy', language)}</span>
                <span className="info-value">{t('grades.marrakechAsfi', language)}</span>
              </div>
              <div className="massar-info-item">
                <span className="info-label">{t('grades.institution', language)}</span>
                <span className="info-value">{schoolName || t('grades.defaultSchoolName', language)}</span>
              </div>
              <div className="massar-info-item">
                <span className="info-label">{t('grades.level', language)}</span>
                <span className="info-value">{t('grades.secondaryLevel', language)}</span>
              </div>
              <div className="massar-info-item">
                <span className="info-label">{t('grades.district', language)}</span>
                <span className="info-value">{t('grades.marrakech', language)}</span>
              </div>
              <div className="massar-info-item">
                <span className="info-label">{t('grades.division', language)}</span>
                <span className="info-value">{selectedClassId ? getClassName(selectedClassId) : '2APIC-1'}</span>
              </div>
              <div className="massar-info-item">
                <span className="info-label">{t('grades.cycle', language)}</span>
                <span className="info-value">{t('grades.secondCycle', language)}</span>
              </div>
              <div className="massar-info-item">
                <span className="info-label">{t('grades.subject_label', language)}</span>
                <span className="info-value">{selectedSubject || t('grades.good', language).split(' ')[0]}</span>
              </div>
              <div className="massar-info-item">
                <span className="info-label">{t('grades.teacher_label', language)}</span>
                <span className="info-value">{t('grades.teacher', language)}</span>
              </div>
              <div className="massar-info-item">
                <span className="info-label">{t('grades.schoolYear', language)}</span>
                <span className="info-value">{academicYear}</span>
              </div>
            </div>
          </div>

          <div className="massar-table-container">
            <table className="massar-grades-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="rtl-header">رقم التلميذ</th>
                  <th rowSpan={2} className="rtl-header">إسم التلميذ</th>
                  <th rowSpan={2} className="rtl-header">تاريخ الازدياد</th>
                  <th colSpan={3} className="rtl-header">الفرض الأول</th>
                  <th colSpan={3} className="rtl-header">الفرض الثاني</th>
                  <th colSpan={3} className="rtl-header">الفرض الثالث</th>
                  <th rowSpan={2} className="rtl-header">المعدل</th>
                  <th rowSpan={2} className="rtl-header">ملاحظات</th>
                </tr>
                <tr>
                  {/* Controle 1 */}
                  <th className="rtl-header">النقطة</th>
                  <th className="rtl-header">20</th>
                  <th className="rtl-header">/</th>
                  {/* Controle 2 */}
                  <th className="rtl-header">النقطة</th>
                  <th className="rtl-header">20</th>
                  <th className="rtl-header">/</th>
                  {/* Examen */}
                  <th className="rtl-header">النقطة</th>
                  <th className="rtl-header">20</th>
                  <th className="rtl-header">/</th>
                </tr>
              </thead>
              <tbody>
                {getStudentsWithGrades().map((studentData) => (
                  <tr 
                    key={studentData.student.id}
                    className="clickable-row"
                    onClick={() => {
                      setSelectedStudentId(studentData.student.id)
                      setShowStudentDetailModal(true)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="rtl-text">{studentData.student.codeMassar || '-'}</td>
                    <td className="rtl-text">{studentData.student.name}</td>
                    <td className="rtl-text">{studentData.student.dateOfBirth ? new Date(studentData.student.dateOfBirth).toLocaleDateString('ar-MA') : '-'}</td>
                    {/* Controle 1 */}
                    <td className={`grade-cell ${studentData.controle1 !== null ? getGradeClass(studentData.controle1!) : ''}`}>{studentData.controle1 !== null ? studentData.controle1.toFixed(2) : '-'}</td>
                    <td className="grade-max">20</td>
                    <td className="grade-separator">/</td>
                    {/* Controle 2 */}
                    <td className={`grade-cell ${studentData.controle2 !== null ? getGradeClass(studentData.controle2!) : ''}`}>{studentData.controle2 !== null ? studentData.controle2.toFixed(2) : '-'}</td>
                    <td className="grade-max">20</td>
                    <td className="grade-separator">/</td>
                    {/* Examen */}
                    <td className={`grade-cell ${studentData.examen !== null ? getGradeClass(studentData.examen!) : ''}`}>{studentData.examen !== null ? studentData.examen.toFixed(2) : '-'}</td>
                    <td className="grade-max">20</td>
                    <td className="grade-separator">/</td>
                    {/* Average */}
                    <td className={`average-cell ${getGradeClass(studentData.average)}`}>{studentData.average.toFixed(2)}</td>
                    {/* Observation */}
                    <td className="observation-cell">{getObservation(studentData.average)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {getStudentsWithGrades().length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">📊</span>
              <h3>{t('grades.noGrades', language)}</h3>
              <p>{t('grades.addFirstGrade', language)}</p>
              <button className="btn btn-primary" onClick={openAddModal}>
                {t('grades.addGrade', language)}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <GradesImport onImport={addGradesBulk} onGradeSaved={() => setLastSaved(new Date())} language={language} />
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && selectedClassId && (
        <AnalyticsDashboard
          classId={selectedClassId}
          className={getClassName(selectedClassId)}
          getClassAnalytics={getClassAnalytics}
          getStudentPerformance={getStudentPerformance}
          grades={grades}
          students={students}
          schoolName={schoolName}
          logo={logo}
          language={language}
        />
      )}

      {activeTab === 'analytics' && !selectedClassId && (
        <div className="empty-state">
          <span className="empty-icon">📈</span>
          <h3>{t('grades.selectClassForAnalytics', language)}</h3>
          <p>{t('grades.chooseClassForAnalytics', language)}</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingGrade ? 'Edit Grade' : 'Add Grade'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="grade-form">
              <div className="form-group">
                <label className="form-label">Student</label>
                <select
                  className="input"
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  required
                >
                  <option value="">Select Student</option>
                  {students.filter(s => s.classId === formData.classId || !formData.classId).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Class</label>
                <select
                  className="input"
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  required
                >
                  <option value="">Select Class</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Subject</label>
                <input
                  type="text"
                  className="input"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g., Math, French, English"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Exam Type</label>
                <select
                  className="input"
                  value={formData.examType}
                  onChange={(e) => setFormData({ ...formData, examType: e.target.value as ExamType })}
                  required
                >
                  {EXAM_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Grade (0-20)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    className="input"
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Coefficient</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={formData.coefficient}
                    onChange={(e) => setFormData({ ...formData, coefficient: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="input"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingGrade ? 'Update' : 'Add'} Grade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudentId && selectedClassId && (
        <StudentDetailModal
          studentId={selectedStudentId}
          classId={selectedClassId}
          isOpen={showStudentDetailModal}
          onClose={() => {
            setShowStudentDetailModal(false)
            setSelectedStudentId('')
          }}
          getStudentDetailAnalytics={getStudentDetailAnalytics}
          students={students}
        />
      )}
    </div>
  )
}

// Helper functions
const getExamTypeColor = (type: ExamType): string => {
  switch (type) {
    case 'Controle 1':
    case 'Controle 2':
      return 'blue'
    case 'Examen':
    case 'Final':
      return 'red'
    case 'Devoir':
      return 'green'
    case 'Quiz':
      return 'orange'
    default:
      return 'gray'
  }
}

const getGradeClass = (grade: number): string => {
  if (grade >= 16) return 'grade-excellent'
  if (grade >= 12) return 'grade-good'
  if (grade >= 10) return 'grade-pass'
  return 'grade-fail'
}

// Grades Import Component - Massar Style (Based on export_notesCC file)
const GradesImport: React.FC<{ onImport: (grades: GradeInput[]) => void; onGradeSaved?: () => void; language?: string }> = ({ onImport, onGradeSaved, language = 'en' }) => {
  const { students, classes, customSubjects } = useSchoolStore()
  const [importData, setImportData] = useState<GradeInput[]>([])
  const [summary, setSummary] = useState({ total: 0, success: 0, errors: 0 })
  const [selectedClassId, setSelectedClassId] = useState('')
  const [subject, setSubject] = useState('')

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          cellNF: true,
          cellText: true
        })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: false
        })

        const parsedGrades: GradeInput[] = []
        let errors = 0
        let dataRowStart = -1

        // Find the header row (contains "ID" or "رقم التلميذ")
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i]
          if (row.some(cell => 
            String(cell).includes('ID') || 
            String(cell).includes('رقم التلميذ') ||
            String(cell).includes('إسم التلميذ')
          )) {
            dataRowStart = i + 1
            break
          }
        }

        if (dataRowStart === -1) {
          showToast('Could not find header row. Please make sure the file has the correct Massar format.', 'warning')
          return
        }

        // Parse student data rows
        for (let i = dataRowStart; i < jsonData.length; i++) {
          const row = jsonData[i]
          
          // Skip empty rows
          if (!row || row.length === 0 || row.every(cell => !cell || cell === '')) {
            continue
          }

          try {
            // Based on the actual file format:
            // Column B (index 1): Internal ID
            // Column C (index 2): Code Massar (رقم التلميذ)
            // Column D (index 3): Student Name (إسم التلميذ)
            // Column F (index 5): Date of Birth (تاريخ الإزدياد)
            // Column G (index 6): Controle 1 (الفرض الأول)
            // Column I (index 8): Controle 2 (الفرض الثاني)
            // Column K (index 10): Final Grade (الأنشطة المندمجة / النقطة المستحقة)

            const codeMassar = String(row[2] || '').trim()
            const studentName = String(row[3] || '').trim()
            const controle1 = parseFloat(String(row[6] || '0').replace(',', '.'))
            const controle2 = parseFloat(String(row[8] || '0').replace(',', '.'))
            const finalGrade = parseFloat(String(row[10] || '0').replace(',', '.'))

            // Use current date as base (will be adjusted for each exam type)
            const baseDate = new Date()
            const todayStr = baseDate.toISOString().split('T')[0]

            // Find student by Code Massar or Name
            let studentId = ''
            let classId = selectedClassId

            if (codeMassar && codeMassar !== '0') {
              const studentByCode = students.find(s => s.codeMassar === codeMassar)
              if (studentByCode) {
                studentId = studentByCode.id
                classId = studentByCode.classId
              }
            }

            // If not found by code, try by name
            if (!studentId && studentName) {
              const studentByName = students.find(s =>
                s.name.toLowerCase() === studentName.toLowerCase() ||
                s.name.toLowerCase().includes(studentName.toLowerCase()) ||
                studentName.toLowerCase().includes(s.name.toLowerCase())
              )
              if (studentByName) {
                studentId = studentByName.id
                classId = studentByName.classId
              }
            }

            if (!studentId) {
              console.error(`Student not found at row ${i + 1}: ${studentName} (Code: ${codeMassar})`)
              errors++
              continue
            }

            // Get subject from state or default
            const subjectValue = subject || 'Unknown'

            // Create grade entries for Controle 1 (use date from 2 weeks ago)
            if (!isNaN(controle1) && controle1 >= 0 && controle1 <= 20) {
              const controle1Date = new Date(baseDate)
              controle1Date.setDate(controle1Date.getDate() - 14)
              parsedGrades.push({
                studentId,
                subject: subjectValue,
                examType: 'Controle 1',
                grade: controle1,
                classId,
                date: controle1Date.toISOString().split('T')[0],
                coefficient: 1
              })
            }

            // Create grade entries for Controle 2 (use date from 1 week ago)
            if (!isNaN(controle2) && controle2 >= 0 && controle2 <= 20) {
              const controle2Date = new Date(baseDate)
              controle2Date.setDate(controle2Date.getDate() - 7)
              parsedGrades.push({
                studentId,
                subject: subjectValue,
                examType: 'Controle 2',
                grade: controle2,
                classId,
                date: controle2Date.toISOString().split('T')[0],
                coefficient: 1
              })
            }

            // Create grade entries for Final Grade if exists (use today's date)
            if (!isNaN(finalGrade) && finalGrade >= 0 && finalGrade <= 20 && finalGrade > 0) {
              parsedGrades.push({
                studentId,
                subject: subjectValue,
                examType: 'Examen',
                grade: finalGrade,
                classId,
                date: todayStr,
                coefficient: 2
              })
            }
          } catch (error) {
            console.error('Error parsing row:', error, 'Row:', row)
            errors++
          }
        }

        setImportData(parsedGrades)
        setSummary({ total: jsonData.length - dataRowStart, success: parsedGrades.length, errors })
      } catch (error) {
        showToast('Error reading file. Please check the format.', 'error')
        console.error('Import error:', error)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = () => {
    if (importData.length === 0) return
    onImport(importData)
    // Auto-save after import
    if (onGradeSaved) {
      setTimeout(() => {
        onGradeSaved()
      }, 100)
    }
    showToast(`✅ Imported ${importData.length} grades successfully!`, 'success')
    setImportData([])
    setSummary({ total: 0, success: 0, errors: 0 })
  }

  const handleDownloadTemplate = () => {
    // Massar-style template matching the exact image format
    const sampleData = [
      {
        'رقم التلميذ': 'D161096088',
        'إسم التلميذ': 'الزناكي ادم',
        'تاريخ الإزدياد': '2010-06-08',
        'الفرض الأول': 14.00,
        'الفرض الثاني': 15.50,
        'النقطة المستحقة': 17.00
      },
      {
        'رقم التلميذ': 'D173002653',
        'إسم التلميذ': 'الزكارية هبة',
        'تاريخ الإزدياد': '2012-01-02',
        'الفرض الأول': 18.00,
        'الفرض الثاني': 17.00,
        'النقطة المستحقة': 19.00
      },
      {
        'رقم التلميذ': 'G164099318',
        'إسم التلميذ': 'بوجكنة زياد',
        'تاريخ الإزدياد': '2010-11-09',
        'الفرض الأول': 14.00,
        'الفرض الثاني': 16.00,
        'النقطة المستحقة': 17.00
      },
      {
        'رقم التلميذ': 'G173115059',
        'إسم التلميذ': 'سدون ريان',
        'تاريخ الإزدياد': '2012-01-29',
        'الفرض الأول': 14.50,
        'الفرض الثاني': 16.50,
        'النقطة المستحقة': 17.00
      }
    ]

    const ws = XLSX.utils.json_to_sheet(sampleData)
    
    // Set column widths and RTL for Arabic
    ws['!cols'] = [
      { wch: 18 }, // رقم التلميذ
      { wch: 25 }, // إسم التلميذ
      { wch: 15 }, // تاريخ الإزدياد
      { wch: 14 }, // الفرض الأول
      { wch: 14 }, // الفرض الثاني
      { wch: 18 }  // النقطة المستحقة
    ]
    ws['!dir'] = 'rtl'

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Grades')
    XLSX.writeFile(wb, 'Grades_Import_Massar_Template.xlsx', {
      bookType: 'xlsx',
      bookSST: true,
      cellStyles: true
    })
  }

  return (
    <div className="import-section">
      <h2>{t('grades.importFromExcel', language)}</h2>
      <p className="import-description">
        {t('grades.importDescription', language)}
      </p>

      <div className="import-content">
        <div className="form-row-massar">
          <div className="form-group">
            <label className="form-label">{t('grades.selectClass', language)}</label>
            <select
              className="input"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              <option value="">-- {t('grades.selectClass', language)} --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t('grades.subject', language)}</label>
            <select
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            >
              <option value="">-- {t('grades.selectSubject', language)} --</option>
              {customSubjects.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{t('grades.uploadFile', language)}</label>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem' }}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="input"
              style={{ flex: 1 }}
            />
          </div>
          <p className="help-text">
            📋 <strong>{t('grades.expectedFormat', language)}</strong> Massar export file (export_notesCC*.xlsx)<br/>
            💡 {t('grades.studentsMatched', language)}<br/>
            📊 {t('grades.eachRowCreates', language)}
          </p>
        </div>

        {importData.length > 0 && (
          <div className="import-preview">
            <h3>{t('grades.preview', language)} ({Math.round(importData.length / 3)} {t('grades.students', language)}, {importData.length} {t('grades.grades', language)})</h3>
            <div className="import-summary">
              <div className="summary-item">{t('grades.totalRows', language)} {summary.total}</div>
              <div className="summary-item success">{t('grades.validGrades', language)} {summary.success}</div>
              <div className="summary-item error">{t('grades.errors', language)} {summary.errors}</div>
            </div>
            <div className="import-table-wrapper">
              <table className="import-table">
                <thead>
                  <tr>
                    <th>Code Massar</th>
                    <th>Student Name</th>
                    <th>Subject</th>
                    <th>Exam Type</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {importData.slice(0, 10).map((grade, idx) => {
                    const student = students.find(s => s.id === grade.studentId)
                    return (
                      <tr key={idx}>
                        <td>{student?.codeMassar || '-'}</td>
                        <td>{student?.name || '-'}</td>
                        <td>{grade.subject}</td>
                        <td>{grade.examType}</td>
                        <td className={getGradeClass(grade.grade)}>{grade.grade}/20</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {importData.length > 10 && (
                <p className="more-rows">... and {importData.length - 10} more grades</p>
              )}
            </div>
            <button className="btn btn-primary" onClick={handleImport}>
              📥 Import {importData.length} Grades
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Analytics Dashboard Component - Modern & Comprehensive
const AnalyticsDashboard: React.FC<{
  classId: string
  className: string
  getClassAnalytics: any
  getStudentPerformance: any
  grades: Grade[]
  students: any[]
  schoolName: string
  logo?: string
  language?: string
}> = ({ classId, className, getClassAnalytics, getStudentPerformance, grades, students, schoolName, logo, language = 'en' }) => {
  const analytics = getClassAnalytics(classId, className)
  
  // State for filters
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedExam, setSelectedExam] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  })
  const [showExportMenu, setShowExportMenu] = useState(false)

  // Get unique subjects from grades
  const availableSubjects = useMemo(() => {
    const subjects = new Set(grades.filter(g => g.classId === classId).map(g => g.subject))
    return Array.from(subjects).sort()
  }, [grades, classId])

  // Filter grades based on selected filters
  const filteredGrades = useMemo(() => {
    return grades.filter(g => {
      if (g.classId !== classId) return false
      if (selectedSubject !== 'all' && g.subject !== selectedSubject) return false
      if (selectedExam !== 'all' && g.examType !== selectedExam) return false
      if (dateRange.start && new Date(g.date) < new Date(dateRange.start)) return false
      if (dateRange.end && new Date(g.date) > new Date(dateRange.end)) return false
      return true
    })
  }, [grades, classId, selectedSubject, selectedExam, dateRange])

  // Calculate filtered analytics
  const filteredAnalytics = useMemo(() => {
    // Group grades by student
    const studentGrades: Record<string, number[]> = {}
    filteredGrades.forEach(g => {
      if (!studentGrades[g.studentId]) studentGrades[g.studentId] = []
      studentGrades[g.studentId].push(g.grade)
    })

    // Calculate averages
    const studentAverages = Object.entries(studentGrades).map(([studentId, gradeList]) => ({
      studentId,
      average: gradeList.reduce((a, b) => a + b, 0) / gradeList.length,
      gradeCount: gradeList.length
    }))

    const allAverages = studentAverages.map(s => s.average)
    const classAverage = allAverages.length > 0
      ? allAverages.reduce((a, b) => a + b, 0) / allAverages.length
      : 0
    const highestGrade = allAverages.length > 0 ? Math.max(...allAverages) : 0
    const lowestGrade = allAverages.length > 0 ? Math.min(...allAverages) : 0
    const belowAverage = studentAverages.filter(s => s.average < classAverage).length
    const riskStudents = studentAverages.filter(s => s.average < 8).length

    // Grade distribution - based on ALL individual grades (not just averages)
    const allIndividualGrades = filteredGrades.map(g => g.grade)
    const distribution = {
      '0-2': allIndividualGrades.filter(g => g >= 0 && g <= 2).length,
      '3-4': allIndividualGrades.filter(g => g >= 3 && g <= 4).length,
      '5-6': allIndividualGrades.filter(g => g >= 5 && g <= 6).length,
      '7-8': allIndividualGrades.filter(g => g >= 7 && g <= 8).length,
      '9-10': allIndividualGrades.filter(g => g >= 9 && g <= 10).length,
      '11-12': allIndividualGrades.filter(g => g >= 11 && g <= 12).length,
      '13-14': allIndividualGrades.filter(g => g >= 13 && g <= 14).length,
      '15-16': allIndividualGrades.filter(g => g >= 15 && g <= 16).length,
      '17-18': allIndividualGrades.filter(g => g >= 17 && g <= 18).length,
      '19-20': allIndividualGrades.filter(g => g >= 19 && g <= 20).length
    }

    return {
      totalStudents: Object.keys(studentGrades).length,
      totalGrades: allIndividualGrades.length,
      averageGrade: classAverage.toFixed(2),
      highestGrade: highestGrade.toFixed(2),
      lowestGrade: lowestGrade.toFixed(2),
      belowAverage,
      riskStudents,
      gradeDistribution: [
        { range: '0-2', count: distribution['0-2'], percentage: ((distribution['0-2'] / (allIndividualGrades.length || 1)) * 100).toFixed(1) },
        { range: '3-4', count: distribution['3-4'], percentage: ((distribution['3-4'] / (allIndividualGrades.length || 1)) * 100).toFixed(1) },
        { range: '5-6', count: distribution['5-6'], percentage: ((distribution['5-6'] / (allIndividualGrades.length || 1)) * 100).toFixed(1) },
        { range: '7-8', count: distribution['7-8'], percentage: ((distribution['7-8'] / (allIndividualGrades.length || 1)) * 100).toFixed(1) },
        { range: '9-10', count: distribution['9-10'], percentage: ((distribution['9-10'] / (allIndividualGrades.length || 1)) * 100).toFixed(1) },
        { range: '11-12', count: distribution['11-12'], percentage: ((distribution['11-12'] / (allIndividualGrades.length || 1)) * 100).toFixed(1) },
        { range: '13-14', count: distribution['13-14'], percentage: ((distribution['13-14'] / (allIndividualGrades.length || 1)) * 100).toFixed(1) },
        { range: '15-16', count: distribution['15-16'], percentage: ((distribution['15-16'] / (allIndividualGrades.length || 1)) * 100).toFixed(1) },
        { range: '17-18', count: distribution['17-18'], percentage: ((distribution['17-18'] / (allIndividualGrades.length || 1)) * 100).toFixed(1) },
        { range: '19-20', count: distribution['19-20'], percentage: ((distribution['19-20'] / (allIndividualGrades.length || 1)) * 100).toFixed(1) }
      ],
      students: studentAverages.map((s, i) => ({
        ...s,
        name: students.find(st => st.id === s.studentId)?.name || 'Unknown',
        classRank: i + 1,
        riskLevel: s.average < 8 ? 'At Risk' : s.average < 12 ? 'Average' : 'Good'
      }))
    }
  }, [filteredGrades, classId, students])

  // Student progress data for line charts
  const studentProgressData = useMemo(() => {
    return filteredAnalytics.students.slice(0, 10).map(student => {
      const studentGrades = filteredGrades
        .filter(g => g.studentId === student.studentId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      return {
        name: student.name.split(' ')[0],
        grades: studentGrades.map((g) => ({
          exam: g.examType, // Use actual exam type (Controle 1, Controle 2, Examen, etc.)
          grade: g.grade,
          date: g.date
        }))
      }
    })
  }, [filteredAnalytics.students, filteredGrades])

  // Create unified data structure for the chart with all exam types
  const chartData = useMemo(() => {
    // Get all unique exam types in order
    const allExamTypes = Array.from(new Set(filteredGrades.map(g => g.examType)))
    
    // Create data points for each exam type
    return allExamTypes.map(examType => {
      const dataPoint: any = { exam: examType }
      
      // Add each student's grade for this exam
      studentProgressData.forEach((student, index) => {
        const studentGrade = student.grades.find(g => g.exam === examType)
        dataPoint[`student_${index}`] = studentGrade ? studentGrade.grade : null
      })
      
      return dataPoint
    })
  }, [studentProgressData, filteredGrades])

  // Subject performance data
  const subjectPerformanceData = useMemo(() => {
    const subjectStats: Record<string, { sum: number; count: number }> = {}
    filteredGrades.forEach(g => {
      if (!subjectStats[g.subject]) subjectStats[g.subject] = { sum: 0, count: 0 }
      subjectStats[g.subject].sum += g.grade
      subjectStats[g.subject].count += 1
    })
    
    return Object.entries(subjectStats).map(([subject, stats]) => ({
      subject,
      average: (stats.sum / stats.count).toFixed(2),
      studentCount: stats.count
    }))
  }, [filteredGrades])

  // Export complete dashboard to PDF with all charts
  const handleExportPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4')
    let yPos = 20 // Start at 20mm (top margin)
    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height
    const margin = 15 // 15mm margin on left and right (≈ 2.5rem)
    const contentWidth = pageWidth - (margin * 2)

    // Add School Logo and Name
    if (logo) {
      try {
        const format = logo.includes('image/png') ? 'PNG' : 'JPEG'
        doc.addImage(logo, format, margin, 10, 20, 20)
        doc.setFontSize(18)
        doc.setTextColor(40)
        doc.text(schoolName, margin + 25, 18)
        doc.setFontSize(16)
        doc.setTextColor(100)
        doc.text(`Analytics Dashboard Report`, margin + 25, 26)
        yPos = 38
      } catch (e) {
        console.error('Could not add logo to PDF:', e)
        doc.setFontSize(18)
        doc.setTextColor(40)
        doc.text(schoolName, margin, yPos)
        yPos += 10
        doc.setFontSize(16)
        doc.setTextColor(100)
        doc.text(`Analytics Dashboard Report`, margin, yPos)
        yPos += 10
      }
    } else {
      doc.setFontSize(18)
      doc.setTextColor(40)
      doc.text(schoolName, margin, yPos)
      yPos += 10
      doc.setFontSize(16)
      doc.setTextColor(100)
      doc.text(`Analytics Dashboard Report`, margin, yPos)
      yPos += 10
    }

    // Class and Filter Info
    doc.setFontSize(12)
    doc.setTextColor(80)
    doc.text(`Class: ${className}`, margin, yPos)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, yPos + 6)
    doc.text(`Filters: Subject=${selectedSubject === 'all' ? 'All' : selectedSubject}, Exam=${selectedExam === 'all' ? 'All' : selectedExam}`, margin, yPos + 12)
    yPos += 30

    // Summary Statistics
    doc.setFontSize(14)
    doc.setTextColor(40)
    doc.setFont(undefined, 'bold')
    doc.text('Summary Statistics', margin, yPos)
    doc.setFont(undefined, 'normal')
    yPos += 8

    const stats = [
      ['Total Students', filteredAnalytics.totalStudents.toString()],
      ['Class Average', filteredAnalytics.averageGrade],
      ['Highest Grade', filteredAnalytics.highestGrade],
      ['Lowest Grade', filteredAnalytics.lowestGrade],
      ['Students Below Average', filteredAnalytics.belowAverage.toString()],
      ['Students at Risk', filteredAnalytics.riskStudents.toString()],
      ['Success Rate', `${analytics.successRate || 0}%`]
    ]

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: stats,
      theme: 'striped',
      headStyles: { fillColor: [13, 110, 253] },
      margin: { left: margin, right: margin }
    })

    yPos = (doc as any).lastAutoTable.finalY + 15

    // Grade Distribution Chart (Visual Bar Chart) - CENTERED
    if (yPos > pageHeight - 90) {
      doc.addPage()
      yPos = 20
    }
    
    doc.setFontSize(14)
    doc.setTextColor(40)
    doc.setFont(undefined, 'bold')
    doc.text('Grade Distribution', margin, yPos)
    doc.setFont(undefined, 'normal')
    yPos += 10

    // Create visual bar chart for grade distribution - CENTERED
    const barWidth = 14
    const barGap = 6
    const maxCount = Math.max(...filteredAnalytics.gradeDistribution.map(d => d.count), 1)
    const chartHeight = 50
    
    // Calculate total chart width and center it
    const totalChartWidth = (filteredAnalytics.gradeDistribution.length * barWidth) + ((filteredAnalytics.gradeDistribution.length - 1) * barGap)
    const chartStartX = (pageWidth - totalChartWidth) / 2 - barWidth / 2
    
    filteredAnalytics.gradeDistribution.forEach((d, index) => {
      const barHeight = d.count > 0 ? (d.count / maxCount) * chartHeight : 1
      const x = chartStartX + (index * (barWidth + barGap))
      const y = yPos + chartHeight - barHeight
      
      // Draw bar
      if (d.count > 0) {
        doc.setFillColor(13, 110, 253)
        doc.rect(x, y, barWidth, barHeight, 'F')
        
        // Draw count on top
        doc.setFontSize(9)
        doc.setTextColor(40)
        doc.text(d.count.toString(), x + barWidth / 2, y - 2, { align: 'center' })
      }
      
      // Draw range label below
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text(d.range, x + barWidth / 2, yPos + chartHeight + 5, { align: 'center' })
    })

    yPos += chartHeight + 25

    // Subject Performance Chart (Visual Bar Chart)
    if (subjectPerformanceData.length > 0) {
      if (yPos > pageHeight - 90) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(14)
      doc.setTextColor(40)
      doc.setFont(undefined, 'bold')
      doc.text('Subject Performance', margin, yPos)
      doc.setFont(undefined, 'normal')
      yPos += 10

      // Create visual bar chart for subject performance - CENTERED
      const subjectsToShow = Math.min(subjectPerformanceData.length, 6)
      const subjectBarWidth = 16
      const subjectGap = 8
      const subjectChartHeight = 50
      const maxSubjectAvg = 20
      
      // Calculate total chart width and center it
      const totalSubjectWidth = (subjectsToShow * subjectBarWidth) + ((subjectsToShow - 1) * subjectGap)
      const subjectChartStartX = (pageWidth - totalSubjectWidth) / 2 - subjectBarWidth / 2
      
      subjectPerformanceData.slice(0, subjectsToShow).forEach((s, index) => {
        const avg = parseFloat(s.average)
        const barHeight = (avg / maxSubjectAvg) * subjectChartHeight
        const x = subjectChartStartX + (index * (subjectBarWidth + subjectGap))
        const y = yPos + subjectChartHeight - barHeight
        
        // Color based on performance
        const fillColor = avg >= 16 ? [76, 175, 80] : avg >= 12 ? [33, 150, 243] : avg >= 10 ? [255, 193, 7] : [244, 67, 54]
        doc.setFillColor(...fillColor)
        doc.rect(x, y, subjectBarWidth, barHeight, 'F')
        
        // Draw average on top
        doc.setFontSize(8)
        doc.setTextColor(40)
        doc.text(s.average, x + subjectBarWidth / 2, y - 2, { align: 'center' })
        
        // Draw subject name (abbreviated) below
        doc.setFontSize(7)
        const shortName = s.subject.length > 10 ? s.subject.substring(0, 10) : s.subject
        doc.text(shortName, x + subjectBarWidth / 2, yPos + subjectChartHeight + 5, { align: 'center' })
      })

      yPos += subjectChartHeight + 30
    }

    // Risk Students Table
    if (filteredAnalytics.riskStudents > 0) {
      if (yPos > pageHeight - 60) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(14)
      doc.setTextColor(200)
      doc.setFont(undefined, 'bold')
      doc.text('Students at Academic Risk (Average < 8)', margin, yPos)
      doc.setFont(undefined, 'normal')
      yPos += 8

      const atRiskStudents = filteredAnalytics.students.filter(s => s.average < 8)
      autoTable(doc, {
        startY: yPos,
        head: [['Student Name', 'Average', 'Risk Level']],
        body: atRiskStudents.map(s => [s.name, s.average.toFixed(2), s.riskLevel]),
        theme: 'striped',
        headStyles: { fillColor: [244, 67, 54] },
        margin: { left: margin, right: margin }
      })

      yPos = (doc as any).lastAutoTable.finalY + 15
    }

    // Student Progress Data Table
    if (studentProgressData.length > 0 && studentProgressData.some(s => s.grades.length > 0)) {
      if (yPos > pageHeight - 60) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(14)
      doc.setTextColor(40)
      doc.setFont(undefined, 'bold')
      doc.text('Student Progress Tracking', margin, yPos)
      doc.setFont(undefined, 'normal')
      yPos += 8

      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(`Showing progress for ${Math.min(studentProgressData.length, 10)} students`, margin, yPos)
      yPos += 8

      // Create progress table for each student
      const progressData = studentProgressData.slice(0, 10).flatMap(student => {
        if (student.grades.length === 0) return []
        return student.grades.map((g, idx) => [
          idx === 0 ? student.name : '',
          g.exam,
          g.grade.toFixed(2),
          g.date ? new Date(g.date).toLocaleDateString() : '-'
        ])
      })

      if (progressData.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Student Name', 'Exam', 'Grade', 'Date']],
          body: progressData,
          theme: 'striped',
          headStyles: { fillColor: [13, 110, 253] },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 25 },
            2: { cellWidth: 18 },
            3: { cellWidth: 'auto' }
          },
          styles: { fontSize: 9 },
          margin: { left: margin, right: margin }
        })
      }

      yPos = (doc as any).lastAutoTable.finalY + 15
    }

    // Class Evolution Chart (Visual Line Chart representation)
    if (evolutionData.length > 0) {
      if (yPos > pageHeight - 80) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(14)
      doc.setTextColor(40)
      doc.setFont(undefined, 'bold')
      doc.text('Class Performance Evolution', margin, yPos)
      doc.setFont(undefined, 'normal')
      yPos += 10

      // Create visual line chart for evolution - CENTERED
      const pointRadius = 3
      const evolutionChartHeight = 50
      const evolutionWidth = contentWidth
      
      evolutionData.forEach((e, index) => {
        const x = margin + (index / (evolutionData.length - 1 || 1)) * evolutionWidth
        const avg = parseFloat(e.average)
        const y = yPos + evolutionChartHeight - (avg / 20) * evolutionChartHeight
        
        // Draw point
        doc.setFillColor(13, 110, 253)
        doc.circle(x, y, pointRadius, 'F')
        
        // Draw average value
        doc.setFontSize(9)
        doc.setTextColor(40)
        doc.text(e.average.toFixed(1), x, y - 6, { align: 'center' })
        
        // Draw exam type
        doc.setFontSize(8)
        const shortExam = e.exam.length > 12 ? e.exam.substring(0, 12) + '..' : e.exam
        doc.text(shortExam, x, yPos + evolutionChartHeight + 5, { align: 'center' })
        
        // Draw line to previous point
        if (index > 0) {
          const prevAvg = parseFloat(evolutionData[index - 1].average)
          const prevY = yPos + evolutionChartHeight - (prevAvg / 20) * evolutionChartHeight
          const prevX = margin + ((index - 1) / (evolutionData.length - 1 || 1)) * evolutionWidth
          doc.setDrawColor(13, 110, 253)
          doc.setLineWidth(1)
          doc.line(prevX, prevY, x, y)
        }
      })

      yPos += evolutionChartHeight + 30
    }

    // Footer with generation info
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(
        `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
        margin,
        pageHeight - 10
      )
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 5, pageHeight - 10)
    }

    await savePDF(doc, `Analytics_Dashboard_${className}_${new Date().toISOString().split('T')[0]}.pdf`)
    showToast('Dashboard exported successfully!', 'success')
  }

  // Export to Excel
  const handleExportExcel = () => {
    exportAnalyticsToExcel(filteredAnalytics, className, schoolName)
  }

  // Risk level data for pie chart
  const riskData = [
    { name: t('grades.atRisk', language), value: filteredAnalytics.riskStudents, color: '#f44336' },
    { name: t('grades.average_range', language), value: analytics.averageStudents || 0, color: '#ff9800' },
    { name: t('grades.good_range', language), value: analytics.goodStudents || 0, color: '#4caf50' }
  ]

  // Grade distribution chart data
  const gradeDistributionChartData = filteredAnalytics.gradeDistribution.map(d => ({
    range: d.range,
    count: d.count,
    percentage: parseFloat(d.percentage)
  }))

  // Class evolution data
  const evolutionData = analytics.examAverages?.map((e: any) => ({
    exam: e.examType,
    average: e.average
  })) || []

  return (
    <div className="analytics-dashboard">
      {/* Dashboard Header with Export */}
      <div className="dashboard-header">
        <h2>📊 {t('grades.analyticsDashboard', language)}</h2>
        <div className="dashboard-actions">
          <div className="export-dropdown">
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              📥 {t('grades.export', language) || 'Export'}
            </button>
            {showExportMenu && (
              <div className="export-menu">
                <button onClick={handleExportPDF}>📄 PDF Report</button>
                <button onClick={handleExportExcel}>📊 Excel File</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filter-group">
          <label>📚 {t('grades.subject', language)}</label>
          <select 
            className="select" 
            value={selectedSubject} 
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            <option value="all">{t('grades.allSubjects', language)}</option>
            {availableSubjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>📝 {t('grades.examType', language)}</label>
          <select 
            className="select" 
            value={selectedExam} 
            onChange={(e) => setSelectedExam(e.target.value)}
          >
            <option value="all">{t('grades.allExams', language)}</option>
            {EXAM_TYPES.map(exam => (
              <option key={exam} value={exam}>{exam}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>📅 {t('grades.dateRange', language)}</label>
          <div className="date-range-inputs">
            <input 
              type="date" 
              className="input" 
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              placeholder="Start"
            />
            <input 
              type="date" 
              className="input" 
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              placeholder="End"
            />
          </div>
        </div>
        {(selectedSubject !== 'all' || selectedExam !== 'all' || dateRange.start || dateRange.end) && (
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              setSelectedSubject('all')
              setSelectedExam('all')
              setDateRange({ start: '', end: '' })
            }}
          >
            🔄 {t('grades.clearFilters', language) || 'Clear Filters'}
          </button>
        )}
      </div>

      {/* Summary Cards - Top Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <div className="stat-value">{filteredAnalytics.totalStudents}</div>
            <div className="stat-label">{t('grades.totalStudents', language)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <div className="stat-value">{filteredAnalytics.averageGrade}</div>
            <div className="stat-label">{t('grades.classAverage', language)}</div>
          </div>
        </div>

        <div className="stat-card highlight">
          <div className="stat-icon">📈</div>
          <div className="stat-info">
            <div className="stat-value">{filteredAnalytics.highestGrade}</div>
            <div className="stat-label">{t('grades.highestGrade', language)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📉</div>
          <div className="stat-info">
            <div className="stat-value">{filteredAnalytics.lowestGrade}</div>
            <div className="stat-label">{t('grades.lowestGrade', language)}</div>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <div className="stat-value">{filteredAnalytics.belowAverage}</div>
            <div className="stat-label">{t('grades.belowAverage', language)}</div>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value">{analytics.successRate || 0}%</div>
            <div className="stat-label">{t('grades.successRate', language)}</div>
          </div>
        </div>
      </div>

      {/* Risk Alert System */}
      {filteredAnalytics.riskStudents > 0 && (
        <div className="alert-card warning">
          <div className="alert-header">
            <span className="alert-icon">🚨</span>
            <h3>{t('grades.studentsAtRisk', language)}</h3>
          </div>
          <p>{t('grades.riskMessage', language).replace('{count}', filteredAnalytics.riskStudents.toString())}</p>
          <div className="risk-students-list">
            {filteredAnalytics.students
              .filter(s => s.average < 8)
              .map(s => (
                <div key={s.studentId} className="risk-student-badge">
                  <span className="student-name">{s.name}</span>
                  <span className="student-average">{s.average.toFixed(2)}/20</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Charts Row 1 - Grade Distribution & Risk */}
      <div className="charts-row">
        {/* Grade Distribution Chart */}
        <div className="chart-card">
          <h3>📊 {t('grades.gradeDistribution', language) || 'Grade Distribution'}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={gradeDistributionChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis 
                label={{ 
                  value: t('grades.numberOfStudents', language) || 'Number of Students', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '600' }
                }}
                domain={[0, Math.max(filteredAnalytics.totalStudents, 1)]}
                ticks={Array.from({ length: Math.max(filteredAnalytics.totalStudents, 1) + 1 }, (_, i) => i)}
                allowDecimals={false}
              />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#4a90d9" name={t('grades.numberOfStudents', language) || 'Students'} />
            </BarChart>
          </ResponsiveContainer>
          <div className="chart-stats">
            {gradeDistributionChartData.map(d => (
              <div key={d.range} className="stat-item">
                <span className="stat-range">{d.range}</span>
                <span className="stat-count">{d.count} ({d.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Distribution Pie Chart */}
        <div className="chart-card">
          <h3>⚠️ {t('grades.riskDistribution', language)}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={riskData.filter(d => d.value > 0)}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, percent, value }: any) => {
                  const total = riskData.reduce((sum, d) => sum + d.value, 0)
                  if (total === 0) return ''
                  const percentage = ((value / total) * 100).toFixed(1)
                  return `${name}: ${value} (${percentage}%)`
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
              >
                {riskData.filter(d => d.value > 0).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value} ${language === 'ar' ? 'تلميذ' : language === 'fr' ? 'élèves' : 'students'}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 - Subject Performance */}
      <div className="charts-row">
        <div className="chart-card full-width">
          <h3>📚 {t('grades.subjectPerformance', language)}</h3>
          {subjectPerformanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={subjectPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" />
                <YAxis domain={[0, 20]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="average" fill="#4a90d9" name={t('grades.averageGrade', language)} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-chart">
              <p>{t('grades.noDataAvailable', language) || 'No data available for selected filters'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 3 - Class Evolution */}
      {evolutionData.length > 0 && (
        <div className="charts-row">
          <div className="chart-card full-width">
            <h3>📈 {t('grades.classEvolution', language)}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="exam" />
                <YAxis domain={[0, 20]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="average" stroke="#4a90d9" strokeWidth={2} name={t('grades.classAverage', language)} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Charts Row 4 - Student Progress */}
      {studentProgressData.length > 0 && studentProgressData.some(s => s.grades.length > 0) && (
        <div className="charts-row">
          <div className="chart-card full-width">
            <h3>👥 {t('grades.studentProgress', language) || 'Student Progress'}</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="exam" />
                <YAxis domain={[0, 20]} />
                <Tooltip />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value) => {
                    // Find the student name from the index
                    const index = parseInt(value.replace('student_', ''))
                    return studentProgressData[index]?.name || value
                  }}
                />
                {studentProgressData.map((student, index) => (
                  <Line
                    key={index}
                    type="monotone"
                    dataKey={`student_${index}`}
                    stroke={`hsl(${index * 36}, 70%, 50%)`}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name={student.name}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <p className="chart-note">
              {t('grades.showingProgressFor', language) || 'Showing progress for'} {Math.min(studentProgressData.length, 10)} {t('grades.students', language) || 'students'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// Student Detail Modal Component
const StudentDetailModal: React.FC<{
  studentId: string
  classId: string
  isOpen: boolean
  onClose: () => void
  getStudentDetailAnalytics: (studentId: string, classId: string) => any
  students: any[]
}> = ({ studentId, classId, isOpen, onClose, getStudentDetailAnalytics, students }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'evolution' | 'subjects' | 'grades' | 'recommendations'>('overview')
  
  const student = students.find(s => s.id === studentId)
  const analytics = getStudentDetailAnalytics(studentId, classId)
  
  if (!isOpen || !student) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="student-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Student Header */}
        <div className="student-detail-header">
          <div className="student-avatar-large">
            {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
          </div>
          <div className="student-info-header">
            <h2>{student.name}</h2>
            <p className="student-code">Code Massar: {student.codeMassar || 'N/A'}</p>
            <div className="student-metrics">
              <div className="metric-badge">
                <span className="metric-label">Average</span>
                <span className={`metric-value ${analytics.overallAverage >= 12 ? 'good' : analytics.overallAverage >= 8 ? 'warning' : 'danger'}`}>
                  {analytics.overallAverage}/20
                </span>
              </div>
              <div className="metric-badge">
                <span className="metric-label">Class Rank</span>
                <span className="metric-value">#{analytics.classRank}/{analytics.totalStudents}</span>
              </div>
              <div className="metric-badge">
                <span className="metric-label">Trend</span>
                <span className={`metric-value ${analytics.trend === 'improving' ? 'good' : analytics.trend === 'declining' ? 'danger' : ''}`}>
                  {analytics.trend === 'improving' ? '↑' : analytics.trend === 'declining' ? '↓' : '→'} {analytics.trendPercentage > 0 ? '+' : ''}{analytics.trendPercentage}
                </span>
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="student-detail-tabs">
          <button
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          <button
            className={`tab ${activeTab === 'evolution' ? 'active' : ''}`}
            onClick={() => setActiveTab('evolution')}
          >
            📈 Evolution
          </button>
          <button
            className={`tab ${activeTab === 'subjects' ? 'active' : ''}`}
            onClick={() => setActiveTab('subjects')}
          >
            📚 Subjects
          </button>
          <button
            className={`tab ${activeTab === 'grades' ? 'active' : ''}`}
            onClick={() => setActiveTab('grades')}
          >
            📝 All Grades
          </button>
          <button
            className={`tab ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
          >
            💡 Recommendations
          </button>
        </div>

        {/* Tab Content */}
        <div className="student-detail-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="stats-row">
                <div className="stat-box">
                  <div className="stat-label">Class Average</div>
                  <div className="stat-value">{analytics.classAverage}/20</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Difference</div>
                  <div className={`stat-value ${analytics.differenceFromClassAverage > 0 ? 'good' : 'danger'}`}>
                    {analytics.differenceFromClassAverage > 0 ? '+' : ''}{analytics.differenceFromClassAverage}
                  </div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Percentile</div>
                  <div className="stat-value">{analytics.percentile}%</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Risk Level</div>
                  <div className={`stat-value ${analytics.riskLevel === 'high' ? 'danger' : analytics.riskLevel === 'medium' ? 'warning' : 'good'}`}>
                    {analytics.riskLevel.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="charts-section">
                <div className="chart-box">
                  <h4>Subject Performance (Radar)</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={analytics.subjectBreakdown}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 20]} />
                      <Radar
                        name="Student Average"
                        dataKey="average"
                        stroke="#4a90d9"
                        fill="#4a90d9"
                        fillOpacity={0.6}
                      />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="strengths-weaknesses">
                  <div className="analysis-section">
                    <h4>🏆 Top Subjects</h4>
                    <ul className="analysis-list">
                      {analytics.topSubjects.map((s: any, i: number) => (
                        <li key={i} className="analysis-item good">
                          <span className="item-icon">⭐</span>
                          <span className="item-text">{s.subject}: {s.average}/20</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="analysis-section">
                    <h4>⚠️ Areas for Improvement</h4>
                    <ul className="analysis-list">
                      {analytics.weakSubjects.filter((s: any) => s.average < 12).map((s: any, i: number) => (
                        <li key={i} className="analysis-item warning">
                          <span className="item-icon">📚</span>
                          <span className="item-text">{s.subject}: {s.average}/20</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Evolution Tab */}
          {activeTab === 'evolution' && (
            <div className="evolution-tab">
              <h4>Grade Evolution Over Time</h4>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={analytics.gradeEvolution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString()} />
                  <YAxis domain={[0, 20]} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as any
                        return (
                          <div className="custom-tooltip" style={{
                            background: 'rgba(255, 255, 255, 0.98)',
                            padding: '12px',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            fontSize: '13px'
                          }}>
                            <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#333' }}>
                              {new Date(label).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            <p style={{ margin: '4px 0', color: '#4a90d9' }}>
                              <strong>Grade:</strong> {data.grade}/20
                            </p>
                            {data.subject && (
                              <p style={{ margin: '4px 0', color: '#666' }}>
                                <strong>Subject:</strong> {data.subject}
                              </p>
                            )}
                            {data.examType && (
                              <p style={{ margin: '4px 0', color: '#666' }}>
                                <strong>Type:</strong> {data.examType}
                              </p>
                            )}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="grade"
                    stroke="#4a90d9"
                    strokeWidth={2}
                    name="Grade"
                    dot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Subjects Tab */}
          {activeTab === 'subjects' && (
            <div className="subjects-tab">
              <h4>Performance by Subject</h4>
              <div className="subject-bars">
                {analytics.subjectBreakdown.map((s: any, i: number) => (
                  <div key={i} className="subject-bar-container">
                    <div className="subject-info">
                      <span className="subject-name">{s.subject}</span>
                      <span className={`subject-grade ${s.average >= 12 ? 'good' : s.average >= 8 ? 'warning' : 'danger'}`}>
                        {s.average}/20
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className={`progress-fill ${s.average >= 16 ? 'excellent' : s.average >= 12 ? 'good' : s.average >= 8 ? 'warning' : 'danger'}`}
                        style={{ width: `${(s.average / 20) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grades Tab */}
          {activeTab === 'grades' && (
            <div className="grades-tab">
              <h4>All Assessments</h4>
              <div className="grades-table-small">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Subject</th>
                      <th>Exam Type</th>
                      <th>Grade</th>
                      <th>Observation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.allGrades.map((g: any, i: number) => (
                      <tr key={i}>
                        <td>{new Date(g.date).toLocaleDateString()}</td>
                        <td>{g.subject}</td>
                        <td><span className="badge">{g.examType}</span></td>
                        <td className={`grade-value ${g.grade >= 12 ? 'good' : g.grade >= 8 ? 'warning' : 'danger'}`}>
                          {g.grade}/20
                        </td>
                        <td>{g.observation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recommendations Tab */}
          {activeTab === 'recommendations' && (
            <div className="recommendations-tab">
              <h4>📋 Personalized Recommendations</h4>
              <div className="recommendations-list">
                {analytics.recommendations.map((rec: string, i: number) => (
                  <div key={i} className="recommendation-item">
                    <span className="rec-icon">💡</span>
                    <span className="rec-text">{rec}</span>
                  </div>
                ))}
              </div>

              {analytics.strengths.length > 0 && (
                <div className="analysis-section">
                  <h4>✅ Strengths</h4>
                  <ul className="analysis-list">
                    {analytics.strengths.map((s: string, i: number) => (
                      <li key={i} className="analysis-item good">
                        <span className="item-icon">✓</span>
                        <span className="item-text">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analytics.weaknesses.length > 0 && (
                <div className="analysis-section">
                  <h4>⚠️ Areas Needing Attention</h4>
                  <ul className="analysis-list">
                    {analytics.weaknesses.map((w: string, i: number) => (
                      <li key={i} className="analysis-item warning">
                        <span className="item-icon">!</span>
                        <span className="item-text">{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper functions for import
const findColumnValue = (row: any, possibleNames: string[]): string => {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null) {
      const value = String(row[name]).trim()
      if (value !== '') return value
    }
  }
  return ''
}

const normalizeExamType = (value: string): ExamType => {
  const lower = value.toLowerCase().trim()
  if (lower.includes('controle 1') || lower.includes('control 1')) return 'Controle 1'
  if (lower.includes('controle 2') || lower.includes('control 2')) return 'Controle 2'
  if (lower.includes('examen') || lower.includes('final')) return 'Examen'
  if (lower.includes('devoir')) return 'Devoir'
  if (lower.includes('quiz')) return 'Quiz'
  return 'Controle 1'
}

const normalizeDate = (value: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (!isNaN(date.getTime())) return date.toISOString().split('T')[0]
  return new Date().toISOString().split('T')[0]
}

export default Grades

