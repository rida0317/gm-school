// src/components/Classes.tsx - Class management component

import React, { useState, useEffect } from 'react'
import { useSchoolStore } from '../store/schoolStore'
import type { SchoolClass, ClassSubject } from '../types'
import { translations } from '../utils/translations'
import './Classes.css'

const Classes: React.FC = () => {
  const { classes, salles, teachers, customSubjects, addClass, updateClass, deleteClass, fetchAllData } = useSchoolStore()
  const t = (key: string) => translations[key]?.fr || key()
  const [showModal, setShowModal] = useState(false)
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null)

  // Sync with Supabase on mount
  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  const [formData, setFormData] = useState({
    name: '',
    level: '',
    roomId: '',
    subjects: [] as ClassSubject[],
  })

  const commonLevels = ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '2BAC', '1BAC', 'TC', '3AC', '2AC', '1AC']

  const resetForm = () => {
    setFormData({
      name: '',
      level: '',
      roomId: '',
      subjects: [],
    })
    setEditingClass(null)
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (schoolClass: SchoolClass) => {
    setFormData({
      name: schoolClass.name,
      level: schoolClass.level,
      roomId: schoolClass.roomId || '',
      subjects: schoolClass.subjects,
    })
    setEditingClass(schoolClass)
    setShowModal(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingClass) {
      updateClass(editingClass.id, formData)
    } else {
      addClass(formData)
    }
    
    setShowModal(false)
    resetForm()
  }

  const addSubject = () => {
    setFormData(prev => ({
      ...prev,
      subjects: [...prev.subjects, { name: '', hours: 1 }]
    }))
  }

  const updateSubject = (index: number, field: keyof ClassSubject, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.map((s, i) => 
        i === index ? { ...s, [field]: value } : s
      )
    }))
  }

  const removeSubject = (index: number) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.filter((_, i) => i !== index)
    }))
  }

  const getTotalHours = () => {
    return formData.subjects.reduce((sum, s) => sum + (s.hours || 0), 0)
  }

  return (
    <div className="classes-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('classes.title')}</h1>
          <p className="page-subtitle">{t('classes.manageClasses')}</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          {t('classes.addClass')}
        </button>
      </div>

      <div className="classes-grid">
        {classes.map((schoolClass) => {
          const room = salles.find(s => s.id === schoolClass.roomId)
          const totalHours = schoolClass.subjects.reduce((sum, s) => sum + s.hours, 0)

          return (
            <div key={schoolClass.id} className="class-card">
              <div className="class-header">
                <div className="class-icon">📚</div>
                <div className="class-info">
                  <h3 className="class-name">{schoolClass.name}</h3>
                  <span className="class-level">{schoolClass.level}</span>
                </div>
              </div>

              <div className="class-details">
                <div className="class-detail">
                  <span className="detail-label">{t('classes.room')}:</span>
                  <span className="detail-value">{room?.name || t('classes.notAssigned')}</span>
                </div>
                <div className="class-detail">
                  <span className="detail-label">{t('classes.totalHours')}:</span>
                  <span className="detail-value">{totalHours}{t('classes.hoursPerWeek')}</span>
                </div>
                <div className="class-detail">
                  <span className="detail-label">{t('classes.subjects')}:</span>
                  <span className="detail-value">{schoolClass.subjects.length}</span>
                </div>
              </div>

              <div className="class-subjects">
                <h4>{t('classes.subjects')}</h4>
                <div className="subject-list">
                  {schoolClass.subjects.slice(0, 4).map((subject, idx) => (
                    <span key={idx} className="subject-badge">
                      {subject.name} ({subject.hours}h)
                    </span>
                  ))}
                  {schoolClass.subjects.length > 4 && (
                    <span className="subject-badge more">
                      +{schoolClass.subjects.length - 4} {t('classes.more')}
                    </span>
                  )}
                </div>
              </div>

              <div className="class-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(schoolClass)}>
                  ✏️ {t('common.edit')}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (confirm(`Delete ${schoolClass.name}?`)) {
                      deleteClass(schoolClass.id)
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

      {classes.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📚</span>
          <h3>{t('classes.noClasses')}</h3>
          <p>{t('classes.createClass')}</p>
          <button className="btn btn-primary" onClick={openAddModal}>
            {t('classes.addClass')}
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingClass ? t('classes.editClass') : t('classes.addClassTitle')}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="class-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="className">{t('classes.className')}</label>
                  <input
                    id="className"
                    name="className"
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Class A"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="classLevel">{t('classes.classLevel')}</label>
                  <select
                    id="classLevel"
                    name="classLevel"
                    className="input"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    required
                  >
                    <option value="">{t('classes.selectLevel')}</option>
                    {commonLevels.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="classRoom">{t('classes.room')}</label>
                  <select
                    id="classRoom"
                    name="classRoom"
                    className="input"
                    value={formData.roomId}
                    onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                  >
                    <option value="">{t('classes.noRoom')}</option>
                    {salles.map(salle => (
                      <option key={salle.id} value={salle.id}>{salle.name} ({salle.type})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <div className="subject-header">
                  <label className="form-label">{t('classes.subjectsAndHours')}</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addSubject} aria-label={t('classes.addSubject')}>
                    ➕ {t('classes.addSubject')}
                  </button>
                </div>

                <div className="subjects-list">
                  {formData.subjects.map((subject, index) => (
                    <div key={index} className="subject-row">
                      <select
                        className="input"
                        value={subject.name}
                        onChange={(e) => updateSubject(index, 'name', e.target.value)}
                        required
                        aria-label={`${t('classes.subject')} ${index + 1}`}
                      >
                        <option value="">{t('classes.selectSubject')}</option>
                        {(customSubjects.length > 0 ? customSubjects.map(s => s.name) : ['Maths', 'French', 'Arabic', 'Physics', 'PC', 'SVT', 'English', 'History', 'Geography', 'Islamic Education']).map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        className="input input-small"
                        value={subject.hours}
                        onChange={(e) => updateSubject(index, 'hours', parseInt(e.target.value) || 0)}
                        min="0"
                        max="20"
                        placeholder={t('classes.hours')}
                        aria-label={`${t('classes.hours')} ${index + 1}`}
                      />
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeSubject(index)}
                        aria-label={`${t('common.remove')} ${index + 1}`}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>

                {formData.subjects.length > 0 && (
                  <div className="total-hours">
                    <strong>{t('classes.totalHours')}:</strong> {getTotalHours()} {t('classes.hoursPerWeek')}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingClass ? t('classes.updateClass') : t('classes.createClassTitle')} {t('nav.classes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Classes

