// src/components/Teachers.tsx - Teacher management component

import React, { useState, useEffect } from 'react'
import { useSchoolStore } from '../store/schoolStore'
import type { Teacher } from '../types'
import { translations } from '../utils/translations'
import './Teachers.css'

const Teachers: React.FC = () => {
  const { teachers, customSubjects, addTeacher, updateTeacher, deleteTeacher, fetchTeachers } = useSchoolStore()
  const t = (key: string) => translations[key]?.fr || key()
  const [showModal, setShowModal] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Fetch teachers on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await fetchTeachers()
      setIsLoading(false)
    }
    loadData()
  }, [fetchTeachers])

  const [formData, setFormData] = useState({
    name: '',
    maxHoursPerWeek: 24,
    subjects: [] as string[],
    levels: [] as string[],
    isVacataire: false,
    availability: {} as Record<string, number[]>, // day -> available hours
  })

  // ... (rest of slots config stays same)
  const commonLevels = ['CP', 'CE1', 'CE2', 'CM1', 'CM2', '2BAC', '1BAC', 'TC', '3AC', '2AC', '1AC']

  const weekdaySlots = [
    { label: '08:30-09:25', value: 0 },
    { label: '09:25-10:20', value: 1 },
    { label: 'BREAK', value: 'break1', disabled: true },
    { label: '10:30-11:25', value: 2 },
    { label: '11:25-12:20', value: 3 },
    { label: 'LUNCH', value: 'lunch', disabled: true },
    { label: '13:00-13:55', value: 4 },
    { label: '13:55-14:50', value: 5 },
    { label: 'BREAK', value: 'break2', disabled: true },
    { label: '15:00-15:55', value: 6 },
    { label: '15:55-16:50', value: 7 },
  ]

  const fridaySlots = [
    { label: '08:30-09:25', value: 0 },
    { label: '09:25-10:20', value: 1 },
    { label: 'BREAK', value: 'break1', disabled: true },
    { label: '10:30-11:25', value: 2 },
    { label: '11:25-12:20', value: 3 },
    { label: '---', value: 'na1', disabled: true },
    { label: '---', value: 'na2', disabled: true },
    { label: '---', value: 'na3', disabled: true },
    { label: '---', value: 'na4', disabled: true },
    { label: '---', value: 'na5', disabled: true },
    { label: '---', value: 'na6', disabled: true },
  ]

  const resetForm = () => {
    setFormData({
      name: '',
      maxHoursPerWeek: 24,
      subjects: [],
      levels: [],
      isVacataire: false,
      availability: {},
    })
    setEditingTeacher(null)
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (teacher: Teacher) => {
    setFormData({
      name: teacher.name,
      maxHoursPerWeek: teacher.maxHoursPerWeek,
      subjects: teacher.subjects,
      levels: teacher.levels,
      isVacataire: teacher.isVacataire,
      availability: teacher.availability || {},
    })
    setEditingTeacher(teacher)
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      if (editingTeacher) {
        await updateTeacher(editingTeacher.id, formData)
      } else {
        await addTeacher({
          ...formData,
          availability: {},
        })
      }
      setShowModal(false)
      resetForm()
    } catch (error) {
      alert('❌ Failed to save teacher data')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSubject = (subject: string) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject]
    }))
  }

  const toggleLevel = (level: string) => {
    setFormData(prev => ({
      ...prev,
      levels: prev.levels.includes(level)
        ? prev.levels.filter(l => l !== level)
        : [...prev.levels, level]
    }))
  }

  const toggleAvailability = (day: string, slotIndex: number) => {
    setFormData(prev => {
      const daySlots = prev.availability[day] || []
      const newDaySlots = daySlots.includes(slotIndex)
        ? daySlots.filter(s => s !== slotIndex)
        : [...daySlots, slotIndex]
      return {
        ...prev,
        availability: {
          ...prev.availability,
          [day]: newDaySlots,
        },
      }
    })
  }

  const filteredTeachers = teachers.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="teachers-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('teachers.title')}</h1>
          <p className="page-subtitle">{t('teachers.manageStaff')}</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          {t('teachers.addTeacher')}
        </button>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <input
          type="text"
          className="input"
          placeholder={t('teachers.search')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Teachers Grid */}
      <div className="teachers-grid">
        {filteredTeachers.map((teacher) => (
          <div key={teacher.id} className="teacher-card">
            <div className="teacher-header">
              <div className="teacher-avatar">
                {teacher.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <div className="teacher-info">
                <h3 className="teacher-name">{teacher.name}</h3>
                <span className={`teacher-type ${teacher.isVacataire ? 'vacataire' : 'full-time'}`}>
                  {teacher.isVacataire ? t('teachers.vacataire') : t('teachers.fullTime')}
                </span>
              </div>
            </div>

            <div className="teacher-details">
              <div className="teacher-stat">
                <span className="stat-label">{t('teachers.maxHours')}</span>
                <span className="stat-value">{teacher.maxHoursPerWeek}{t('teachers.perWeek')}</span>
              </div>
              <div className="teacher-stat">
                <span className="stat-label">{t('teachers.subjects')}</span>
                <span className="stat-value">{teacher.subjects.length}</span>
              </div>
              <div className="teacher-stat">
                <span className="stat-label">{t('teachers.levels')}</span>
                <span className="stat-value">{teacher.levels.length}</span>
              </div>
            </div>

            <div className="teacher-subjects">
              {teacher.subjects.slice(0, 3).map(subject => (
                <span key={subject} className="badge">{subject}</span>
              ))}
              {teacher.subjects.length > 3 && (
                <span className="badge badge-more">+{teacher.subjects.length - 3}</span>
              )}
            </div>

            <div className="teacher-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(teacher)}>
                {t('teachers.edit')}
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  if (confirm(`Delete ${teacher.name}?`)) {
                    deleteTeacher(teacher.id)
                  }
                }}
              >
                {t('teachers.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredTeachers.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">👨‍🏫</span>
          <h3>{t('teachers.noTeachers')}</h3>
          <p>{t('teachers.addFirst')}</p>
          <button className="btn btn-primary" onClick={openAddModal}>
            {t('teachers.addTeacher')}
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTeacher ? t('teachers.editClass') : t('teachers.addTeacher')}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="teacher-form">
              <div className="form-group">
                <label className="form-label" htmlFor="teacherName">{t('teachers.fullName')}</label>
                <input
                  id="teacherName"
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="maxHours">{t('teachers.maxHoursPerWeek')}</label>
                <input
                  id="maxHours"
                  type="number"
                  className="input"
                  value={formData.maxHoursPerWeek}
                  onChange={(e) => setFormData({ ...formData, maxHoursPerWeek: parseInt(e.target.value) })}
                  min="1"
                  max="40"
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('teachers.subjects')}</label>
                <div className="checkbox-grid">
                  {(customSubjects.length > 0 ? customSubjects.map(s => s.name) : ['Maths', 'French', 'Arabic', 'Physics', 'PC', 'SVT', 'English', 'History', 'Geography']).map((subject) => (
                    <label key={subject} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.subjects.includes(subject)}
                        onChange={() => toggleSubject(subject)}
                      />
                      <span>{subject}</span>
                    </label>
                  ))}
                </div>
                {customSubjects.length === 0 && <p className="form-hint">{t('teachers.noteAddSubjects')}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">{t('teachers.levels')}</label>
                <div className="checkbox-grid">
                  {commonLevels.map((level) => (
                    <label key={level} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.levels.includes(level)}
                        onChange={() => toggleLevel(level)}
                      />
                      <span>{level}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isVacataire}
                    onChange={(e) => setFormData({ ...formData, isVacataire: e.target.checked })}
                  />
                  <span>{t('teachers.vacatairePartTime')}</span>
                </label>
              </div>

              {formData.isVacataire && (
                <div className="form-group vacataire-hours-widget">
                  <label className="form-label">{t('teachers.availabilitySchedule')}</label>
                  <p className="form-hint">{t('teachers.selectTimeSlots')}</p>
                  <div className="availability-timetable">
                    <div className="timetable-header-row">
                      <div className="timetable-cell header-cell">Day</div>
                      {weekdaySlots.map((slot) => (
                        <div 
                          key={slot.value} 
                          className={`timetable-cell header-cell hour-header ${slot.disabled ? 'slot-disabled' : ''}`}
                        >
                          {slot.label}
                        </div>
                      ))}
                    </div>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday'].map((day) => (
                      <div key={day} className="timetable-row">
                        <div className="timetable-cell day-cell">{day}</div>
                        {weekdaySlots.map((slot) => (
                          <label
                            key={slot.value}
                            className={`timetable-cell hour-cell ${slot.disabled ? 'slot-disabled' : ''} ${slot.value === 'lunch' ? 'lunch-slot' : ''} ${(formData.availability[day] || []).includes(slot.value as number) ? 'selected' : ''}`}
                          >
                            {slot.disabled ? (
                              <>
                                <span className="coffee-icon">{slot.value === 'lunch' ? '🍽️' : '☕'}</span>
                                <span style={{fontSize: '0.55rem'}}>{slot.label}</span>
                              </>
                            ) : (
                              <input
                                type="checkbox"
                                checked={(formData.availability[day] || []).includes(slot.value as number)}
                                onChange={() => toggleAvailability(day, slot.value as number)}
                              />
                            )}
                          </label>
                        ))}
                      </div>
                    ))}
                    <div className="timetable-row">
                      <div className="timetable-cell day-cell">Friday</div>
                      {fridaySlots.map((slot) => (
                        <label
                          key={slot.value}
                          className={`timetable-cell hour-cell ${slot.disabled ? 'slot-disabled' : ''} ${slot.value.toString().startsWith('na') ? 'na-slot' : ''} ${(formData.availability['Friday'] || []).includes(slot.value as number) ? 'selected' : ''}`}
                        >
                          {slot.disabled ? (
                            <>
                              <span className="coffee-icon">{slot.value.toString().startsWith('na') ? '✖️' : '☕'}</span>
                              <span style={{fontSize: '0.55rem'}}>{slot.label}</span>
                            </>
                          ) : (
                            <input
                              type="checkbox"
                              checked={(formData.availability['Friday'] || []).includes(slot.value as number)}
                              onChange={() => toggleAvailability('Friday', slot.value as number)}
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="hours-summary">
                    <strong>{t('teachers.selectedHours')}</strong>{' '}
                    {Object.entries(formData.availability)
                      .filter(([_, hours]) => hours.length > 0)
                      .map(([day, hours]) => {
                        const slotLabels = hours.map(h => {
                          const slots = day === 'Friday' ? fridaySlots : weekdaySlots
                          return slots.find(s => s.value === h)?.label || ''
                        }).filter(Boolean)
                        return `${day}: ${slotLabels.join(', ')}`
                      })
                      .join(' | ') || t('teachers.noneSelected')}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {t('teachers.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTeacher ? t('teachers.update') : t('teachers.create')} {t('nav.teachers')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Teachers

