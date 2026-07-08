// src/components/Students.tsx - Student management component with Supabase Sync

import React, { useState, useEffect } from 'react'
import { useSchoolStore } from '../store/schoolStore'
import type { Student as StudentType } from '../types'
import { translations } from '../utils/translations'
import * as XLSX from 'xlsx'
import MassarImport from './MassarImport'
import './Students.css'

interface MassarStudent {
  codeMassar: string;
  nom: string;
  prenom: string;
  genre: string;
  dateNaissance?: string;
  lieuNaissance?: string;
}

const Students: React.FC = () => {
  const { 
    classes, 
    students, 
    schoolName, 
    addStudent, 
    addBulkStudents,
    updateStudent, 
    deleteStudent, 
    fetchAllData 
  } = useSchoolStore()
  
  const t = (key: string) => translations[key]?.fr || key()
  const [showModal, setShowModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<StudentType | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [showMassarImport, setShowMassarImport] = useState(false)
  const [importData, setImportData] = useState<any[]>([])
  const [importClassId, setImportClassId] = useState('')
  const [importSummary, setImportSummary] = useState({ total: 0, success: 0, errors: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState('')

  // Sync with Supabase on mount
  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  const [formData, setFormData] = useState({
    name: '',
    classId: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    guardianName: '',
    guardianPhone: '',
  })

  const resetForm = () => {
    setFormData({
      name: '',
      classId: '',
      email: '',
      phone: '',
      address: '',
      dateOfBirth: '',
      guardianName: '',
      guardianPhone: '',
    })
    setEditingStudent(null)
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (student: StudentType) => {
    setFormData({
      name: student.name,
      classId: student.classId,
      email: student.email || '',
      phone: student.phone || '',
      address: student.address || '',
      dateOfBirth: student.dateOfBirth || '',
      guardianName: student.guardianName || '',
      guardianPhone: student.parentPhone || '',
    })
    setEditingStudent(student)
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (editingStudent) {
        await updateStudent(editingStudent.id, {
          name: formData.name,
          classId: formData.classId,
          code_massar: (editingStudent as any).code_massar || null,
          parentName: formData.guardianName || null,
          parentPhone: formData.guardianPhone || null
        })
      } else {
        await addStudent({
          name: formData.name,
          classId: formData.classId || null,
          code_massar: null,
          parentName: formData.guardianName || null,
          parentPhone: formData.guardianPhone || null
        })
      }
      setShowModal(false)
      resetForm()
    } catch (error) {
      console.error('Save error:', error)
      alert('❌ Failed to save student to Supabase')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteStudent = async (id: string, name: string) => {
    if (confirm(`Delete ${name}?`)) {
      setIsLoading(true)
      try {
        await deleteStudent(id)
      } catch (error) {
        alert('❌ Failed to delete student')
      } finally {
        setIsLoading(false)
      }
    }
  }

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.classId && classes.find(c => c.id === s.classId)?.name.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesClass = !selectedClassId || s.classId === selectedClassId
    
    return matchesSearch && matchesClass
  })

  const getClassName = (classId: string) => {
    return classes.find(c => c.id === classId)?.name || 'Unknown'
  }

  // Helper to parse name
  const parseName = (fullName: string) => {
    if (!fullName) return { nom: '', prenom: '' }
    const parts = fullName.split(' ').filter(p => p.trim().length > 0)
    if (parts.length === 0) return { nom: '', prenom: '' }
    if (parts.length === 1) return { nom: parts[0], prenom: '' }
    return { nom: parts.slice(0, 1).join(' '), prenom: parts.slice(1).join(' ') }
  }

  return (
    <div className="students-page">
      {isLoading && <div className="loading-overlay">Syncing with Supabase...</div>}
      
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('students.title')}</h1>
          <p className="page-subtitle">{t('students.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setShowMassarImport(true)}>
            📥 Import Massar
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            {t('students.add')}
          </button>
        </div>
      </div>

      <div className="search-filters">
        <div className="filter-group">
          <label className="filter-label">{t('students.class')}:</label>
          <select
            className="filter-select"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="">Toutes les classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <input
            type="text"
            className="input"
            placeholder={t('students.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="massar-students-container">
        <table className="massar-students-table">
          <thead>
            <tr>
              <th>N.O</th>
              <th>Nom & Prénom</th>
              <th>Classe</th>
              <th>Téléphone</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student, index) => (
              <tr key={student.id}>
                <td>{index + 1}</td>
                <td>{student.name}</td>
                <td>{getClassName(student.classId)}</td>
                <td>{student.parentPhone || '-'}</td>
                <td>
                  <div className="actions-cell">
                    <button className="btn-icon" onClick={() => openEditModal(student)}>✏️</button>
                    <button className="btn-icon btn-icon-danger" onClick={() => handleDeleteStudent(student.id, student.name)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingStudent ? t('students.edit') : t('students.add')}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="student-form">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
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
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Guardian Phone</label>
                <input
                  type="tel"
                  className="input"
                  value={formData.guardianPhone}
                  onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? 'Saving...' : (editingStudent ? 'Update' : 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMassarImport && (
        <MassarImport
          onImport={async (massarStudents) => {
            // Get selected class ID from the filter or import state
            const targetClassId = selectedClassId || importClassId || (classes.length > 0 ? classes[0].id : null)

            // Map Massar students to our Student type
            const studentsToImport = massarStudents.map(student => ({
              name: `${student.nom} ${student.prenom}`,
              classId: targetClassId,
              codeMassar: student.codeMassar,  // ✅ camelCase for TypeScript type
              parentPhone: null
            })) as any[]

            // Bulk insert
            const result = await addBulkStudents(studentsToImport)



            // Refresh students list
            await fetchAllData()

            setShowMassarImport(false)

            const className = classes.find(c => c.id === targetClassId)?.name || 'Unknown'
            
            // Show detailed result
            if (result.success > 0) {
              alert(`✅ Massar import completed for class: ${className}\n\n✅ Success: ${result.success} students imported\n❌ Errors: ${result.errors}\n\n📝 Note: ${result.message || 'Import completed successfully'}`)
            } else {
              alert(`❌ Massar import failed!\n\n⚠️ Success: ${result.success}\n❌ Errors: ${result.errors}\n\n📝 Error: ${result.message || 'Unknown error. Check console for details.'}`)
            }
          }}
          onClose={() => setShowMassarImport(false)}
        />
      )}
    </div>
  )
}

export default Students

