// src/components/Subjects.tsx - Subject management component

import React, { useState } from 'react'
import { useSchoolStore } from '../store/schoolStore'
import { translations } from '../utils/translations'
import './Subjects.css'

const Subjects: React.FC = () => {
  const {
    customSubjects,
    teachers,
    classes,
    addCustomSubject,
    deleteCustomSubject
  } = useSchoolStore()
  const t = (key: string) => translations[key]?.fr || key()
  const [showModal, setShowModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [newSubjectName, setNewSubjectName] = useState('')

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubjectName.trim()) return
    
    if (customSubjects.some(s => s.name.toLowerCase() === newSubjectName.trim().toLowerCase())) {
      alert('❌ This subject already exists.')
      return
    }

    addCustomSubject(newSubjectName.trim())
    setNewSubjectName('')
    setShowModal(false)
    alert('✅ Subject added successfully!')
  }

  const getTeachersForSubject = (subjectName: string) => {
    return teachers.filter(t => t.subjects.includes(subjectName))
  }

  const getClassesForSubject = (subjectName: string) => {
    return classes.filter(c => c.subjects.some(s => s.name === subjectName))
  }

  const filteredSubjects = customSubjects.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="subjects-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('subjects.title')}</h1>
          <p className="page-subtitle">{t('subjects.manageTrack')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          {t('subjects.addSubject')}
        </button>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <input
          type="text"
          className="input"
          placeholder={t('subjects.search')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Subjects Grid */}
      <div className="subjects-grid">
        {filteredSubjects.map((subject) => {
          const subjectTeachers = getTeachersForSubject(subject.name)
          const subjectClasses = getClassesForSubject(subject.name)

          return (
            <div key={subject.id} className="subject-card">
              <div className="subject-header">
                <div className="subject-avatar">
                  {subject.name.charAt(0).toUpperCase()}
                </div>
                <div className="subject-info">
                  <h3 className="subject-name">{subject.name}</h3>
                  <span className="subject-badge">{t('subjects.active')}</span>
                </div>
              </div>

              <div className="subject-stats">
                <div className="stat-col">
                  <span className="stat-header">{t('subjects.teachers')}</span>
                  <span className="stat-number">{subjectTeachers.length}</span>
                </div>
                <div className="stat-col">
                  <span className="stat-header">{t('subjects.classes')}</span>
                  <span className="stat-number">{subjectClasses.length}</span>
                </div>
                <div className="stat-col">
                  <span className="stat-header">{t('subjects.id')}</span>
                  <span className="stat-number">{subject.id.slice(0, 3)}</span>
                </div>
              </div>

              <div className="subject-tags">
                {subjectTeachers.length > 0 ? (
                  subjectTeachers.slice(0, 2).map(t => (
                    <span key={t.id} className="tag">{t.name}</span>
                  ))
                ) : (
                  <span className="tag-empty">{t('subjects.noTeachersAssigned')}</span>
                )}
              </div>

              <div className="subject-actions">
                <button className="btn-edit">
                  ✏️ {t('common.edit')}
                </button>
                <button
                  className="btn-delete"
                  onClick={() => {
                    if (confirm(`Delete subject "${subject.name}"?`)) {
                      deleteCustomSubject(subject.id)
                    }
                  }}
                >
                  🗑️ {t('common.delete')}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {filteredSubjects.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📚</span>
          <h3>{t('subjects.noSubjects')}</h3>
          <p>{t('subjects.addFirst')}</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            {t('subjects.addSubject')}
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('subjects.addNewSubject')}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAddSubject} className="subject-form">
              <div className="form-group">
                <label className="form-label" htmlFor="subjectNameInput">{t('subjects.subjectName')}</label>
                <input
                  id="subjectNameInput"
                  name="subjectName"
                  type="text"
                  className="input"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder={t('subjects.e.gMathematics')}
                  required
                  autoFocus
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {t('subjects.addSubjectBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Subjects

