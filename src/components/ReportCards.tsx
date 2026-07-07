// src/components/ReportCards.tsx - Report card (bulletin de notes) generation component

import React, { useState } from 'react'
import { useSchoolStore } from '../store/schoolStore'
import { useStudentsStore } from '../store/studentsStore'
import { useGradesStore } from '../store/gradesStore'
import { generateReportCard, downloadReportCard, generateBatchReportCards } from '../services/export'
import type { Student } from '../types'
import './ReportCards.css'

type Period = 'Trimestre 1' | 'Trimestre 2' | 'Trimestre 3' | 'Semestre 1' | 'Semestre 2'

const ReportCards: React.FC = () => {
  const { schoolName, academicYear, classes } = useSchoolStore()
  const students = useStudentsStore((state) => state.students)
  const getGradesByStudent = useGradesStore((state) => state.getGradesByStudent)
  const getStudentDetailAnalytics = useGradesStore((state) => state.getStudentDetailAnalytics)

  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('Trimestre 1')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [principalName, setPrincipalName] = useState('')

  // Filter students by class
  const filteredStudents = selectedClassId
    ? students.filter(s => s.classId === selectedClassId)
    : students

  // Get class name
  const selectedClass = classes.find(c => c.id === selectedClassId)

  // Generate report card for single student
  const handleGenerateSingle = (student: Student) => {
    try {
      setIsGenerating(true)
      const grades = getGradesByStudent(student.id)

      if (grades.length === 0) {
        alert(`⚠️ ${student.name} n'a pas encore de notes`)
        setIsGenerating(false)
        return
      }

      const analytics = getStudentDetailAnalytics(student.id, student.classId)
      
      const blob = generateReportCard({
        student,
        grades,
        analytics,
        schoolName: schoolName || 'École',
        academicYear,
        className: selectedClass?.name || student.classId,
        period: selectedPeriod,
        principalName,
        includeDetails: true
      })

      downloadReportCard(blob, student, selectedPeriod)
      setIsGenerating(false)
    } catch (error) {
      console.error('Error generating report card:', error)
      alert('❌ Erreur lors de la génération du bulletin')
      setIsGenerating(false)
    }
  }

  // Generate report cards for all filtered students
  const handleGenerateBatch = async () => {
    if (filteredStudents.length === 0) {
      alert('⚠️ Aucun élève à traiter')
      return
    }

    try {
      setIsGenerating(true)
      
      const gradesMap = new Map<string, any[]>()
      const analyticsMap = new Map<string, any>()

      filteredStudents.forEach(student => {
        const grades = getGradesByStudent(student.id)
        if (grades.length > 0) {
          gradesMap.set(student.id, grades)
          const analytics = getStudentDetailAnalytics(student.id, student.classId)
          analyticsMap.set(student.id, analytics)
        }
      })

      if (gradesMap.size === 0) {
        alert('⚠️ Aucun élève n\'a de notes pour cette classe')
        setIsGenerating(false)
        return
      }

      const reportCards = generateBatchReportCards(
        filteredStudents.filter(s => gradesMap.has(s.id)),
        gradesMap,
        analyticsMap,
        schoolName || 'École',
        academicYear,
        selectedClass?.name || '',
        selectedPeriod,
        principalName
      )

      // Download all report cards
      reportCards.forEach(({ blob, filename }, index) => {
        setTimeout(() => {
          const link = document.createElement('a')
          link.href = URL.createObjectURL(blob)
          link.download = filename
          link.click()
          URL.revokeObjectURL(link.href)
        }, index * 300) // 300ms delay between each download
      })

      setIsGenerating(false)
      alert(`✅ ${reportCards.length} bulletins générés avec succès!`)
    } catch (error) {
      console.error('Error generating batch report cards:', error)
      alert('❌ Erreur lors de la génération des bulletins')
      setIsGenerating(false)
    }
  }

  // Preview report card
  const handlePreview = (student: Student) => {
    const grades = getGradesByStudent(student.id)
    
    if (grades.length === 0) {
      alert(`⚠️ ${student.name} n'a pas encore de notes`)
      return
    }

    setSelectedStudent(student)
    setShowPreview(true)
  }

  return (
    <div className="report-cards-container">
      <div className="report-cards-header">
        <div className="header-content">
          <h1>📄 Bulletins de Notes</h1>
          <p>Générez les bulletins de notes des élèves en format PDF</p>
        </div>
      </div>

      {/* Controls */}
      <div className="report-cards-controls">
        <div className="control-group">
          <label>Classe:</label>
          <select 
            value={selectedClassId} 
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="">Toutes les classes</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Période:</label>
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value as Period)}
          >
            <option value="Trimestre 1">Trimestre 1</option>
            <option value="Trimestre 2">Trimestre 2</option>
            <option value="Trimestre 3">Trimestre 3</option>
            <option value="Semestre 1">Semestre 1</option>
            <option value="Semestre 2">Semestre 2</option>
          </select>
        </div>

        <div className="control-group">
          <label>Nom du Professeur Principal:</label>
          <input
            type="text"
            value={principalName}
            onChange={(e) => setPrincipalName(e.target.value)}
            placeholder="Ex: M. Ahmed"
          />
        </div>

        <div className="control-actions">
          <button
            className="btn-batch"
            onClick={handleGenerateBatch}
            disabled={!selectedClassId || isGenerating}
          >
            {isGenerating ? '⏳ Génération...' : `📥 Télécharger tous (${filteredStudents.length})`}
          </button>
        </div>
      </div>

      {/* Students list */}
      <div className="report-cards-list">
        {filteredStudents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>Aucun élève trouvé</h3>
            <p>Sélectionnez une classe pour voir les élèves</p>
          </div>
        ) : (
          <div className="students-grid">
            {filteredStudents.map(student => {
              const grades = getGradesByStudent(student.id)
              const hasGrades = grades.length > 0
              const average = hasGrades 
                ? (grades.reduce((sum, g) => sum + g.grade, 0) / grades.length).toFixed(2)
                : 'N/A'

              return (
                <div key={student.id} className="student-card">
                  <div className="student-info">
                    <div className="student-avatar">
                      {(student.name.charAt(0) || 'E').toUpperCase()}
                    </div>
                    <div className="student-details">
                      <h3>{student.name}</h3>
                      <p className="class-name">{student.classId}</p>
                      {student.codeMassar && (
                        <p className="massar-code">Massar: {student.codeMassar}</p>
                      )}
                    </div>
                  </div>

                  <div className="student-stats">
                    <div className="stat-item">
                      <span className="stat-label">Devoirs</span>
                      <span className="stat-value">{grades.length}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Moyenne</span>
                      <span className={`stat-value ${Number(average) >= 10 ? 'good' : Number(average) >= 8 ? 'average' : 'bad'}`}>
                        {average}/20
                      </span>
                    </div>
                  </div>

                  <div className="student-actions">
                    <button
                      className="btn-preview"
                      onClick={() => handlePreview(student)}
                      disabled={!hasGrades}
                      title={!hasGrades ? 'Aucune note disponible' : 'Aperçu'}
                    >
                      👁️ Aperçu
                    </button>
                    <button
                      className="btn-download"
                      onClick={() => handleGenerateSingle(student)}
                      disabled={!hasGrades || isGenerating}
                      title={!hasGrades ? 'Aucune note disponible' : 'Télécharger le bulletin'}
                    >
                      {isGenerating ? '⏳' : '📥'} PDF
                    </button>
                  </div>

                  {!hasGrades && (
                    <div className="no-grades-warning">
                      ⚠️ Aucune note disponible
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && selectedStudent && (
        <div className="preview-modal" onClick={() => setShowPreview(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Aperçu du bulletin - {selectedStudent.name}</h2>
              <button className="close-btn" onClick={() => setShowPreview(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="preview-info">
                <p><strong>Élève:</strong> {selectedStudent.name}</p>
                <p><strong>Classe:</strong> {selectedClass?.name || selectedStudent.classId}</p>
                <p><strong>Période:</strong> {selectedPeriod}</p>
                <p><strong>Nombre de notes:</strong> {getGradesByStudent(selectedStudent.id).length}</p>
              </div>

              <div className="preview-grades">
                <h3>Dernières notes:</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Matière</th>
                      <th>Type</th>
                      <th>Note</th>
                      <th>Coeff</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getGradesByStudent(selectedStudent.id).slice(0, 5).map((grade, i) => (
                      <tr key={i}>
                        <td>{grade.subject}</td>
                        <td>{grade.examType}</td>
                        <td className={grade.grade >= 10 ? 'good-grade' : 'bad-grade'}>
                          {grade.grade}/20
                        </td>
                        <td>{grade.coefficient || 1}</td>
                        <td>{new Date(grade.date).toLocaleDateString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowPreview(false)}>
                Fermer
              </button>
              <button 
                className="btn-download" 
                onClick={() => handleGenerateSingle(selectedStudent)}
              >
                📥 Télécharger le bulletin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportCards

