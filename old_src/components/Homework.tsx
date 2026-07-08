// src/components/Homework.tsx - Homework management component

import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { useHomeworkStore, useHomework, useHomeworkStats } from '../store/homeworkStore'
import { useSchoolStore } from '../store/schoolStore'
import { useStudents } from '../store/studentsStore'
import { useAuth } from '../store/AuthContext'
import { showToast } from '../hooks/useToast'
import type { Homework } from '../services/homework.service'
import './Homework.css'

const Homework: React.FC = () => {
  const { user } = useAuth()
  const { classes, schoolName } = useSchoolStore()
  const students = useStudents()
  const homework = useHomework()
  const stats = useHomeworkStats()
  
  const { createHomework, deleteHomework, markAsCompleted, setSelectedClassId } = useHomeworkStore()

  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list')
  const [selectedClassId, setSelectedClass] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null)
  
  const [formData, setFormData] = useState({
    classId: '',
    subject: '',
    title: '',
    description: '',
    dueDate: '',
    notifyParents: false
  })

  const filteredHomework = selectedClassId
    ? homework.filter(h => h.classId === selectedClassId)
    : homework

  const handleCreateHomework = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.classId || !formData.subject || !formData.title || !formData.dueDate) {
      showToast('Veuillez remplir tous les champs obligatoires', 'warning')
      return
    }

    try {
      const classObj = classes.find(c => c.id === formData.classId)
      
      await createHomework({
        classId: formData.classId,
        className: classObj?.name || formData.classId,
        subject: formData.subject,
        teacherId: user?.id || '',
        teacherName: user?.display_name || user?.email || 'Professeur',
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate,
        assignedDate: new Date().toISOString(),
        notifyParents: formData.notifyParents
      })

      showToast('✅ Devoir créé avec succès!', 'success')
      resetForm()
      setShowModal(false)
    } catch (error) {
      showToast('Erreur lors de la création du devoir', 'error')
      console.error(error)
    }
  }

  const handleDeleteHomework = async (homeworkId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce devoir?')) {
      try {
        await deleteHomework(homeworkId)
        showToast('✅ Devoir supprimé', 'success')
      } catch (error) {
        showToast('Erreur lors de la suppression', 'error')
      }
    }
  }

  const handleMarkAsCompleted = async (homeworkId: string) => {
    try {
      await markAsCompleted(homeworkId)
      showToast('✅ Devoir marqué comme terminé', 'success')
    } catch (error) {
      showToast('Erreur', 'error')
    }
  }

  const resetForm = () => {
    setFormData({
      classId: '',
      subject: '',
      title: '',
      description: '',
      dueDate: '',
      notifyParents: false
    })
  }

  const getStatusColor = (status: Homework['status']) => {
    switch (status) {
      case 'active': return 'status-active'
      case 'completed': return 'status-completed'
      case 'expired': return 'status-expired'
    }
  }

  const getDaysUntilDue = (dueDate: string): number => {
    const now = new Date()
    const due = new Date(dueDate)
    const diff = due.getTime() - now.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="homework-container">
      <div className="homework-header">
        <div className="header-content">
          <h1>📚 Devoirs</h1>
          <p>Gérez les devoirs et communiquez avec les élèves</p>
        </div>
        <button 
          className="btn-create"
          onClick={() => setShowModal(true)}
        >
          ✏️ Nouveau devoir
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="homework-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.totalActive}</div>
            <div className="stat-label">Devoirs actifs</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalCompleted}</div>
            <div className="stat-label">Terminés</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalExpired}</div>
            <div className="stat-label">Expirés</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="homework-filters">
        <select
          value={selectedClassId}
          onChange={(e) => {
            setSelectedClass(e.target.value)
            setSelectedClassId(e.target.value || null)
          }}
        >
          <option value="">Toutes les classes</option>
          {classes.map(cls => (
            <option key={cls.id} value={cls.id}>{cls.name}</option>
          ))}
        </select>
      </div>

      {/* Homework List */}
      <div className="homework-list">
        {filteredHomework.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <h3>Aucun devoir</h3>
            <p>Créez un nouveau devoir pour commencer</p>
          </div>
        ) : (
          <div className="homework-grid">
            {filteredHomework.map(hw => {
              const daysUntilDue = getDaysUntilDue(hw.dueDate)
              const isOverdue = daysUntilDue < 0
              const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 3

              return (
                <div key={hw.id} className={`homework-card ${getStatusColor(hw.status)}`}>
                  <div className="card-header">
                    <div className="class-badge">{hw.className}</div>
                    <div className={`status-badge status-${hw.status}`}>
                      {hw.status === 'active' && '🟢 Actif'}
                      {hw.status === 'completed' && '✅ Terminé'}
                      {hw.status === 'expired' && '🔴 Expiré'}
                    </div>
                  </div>

                  <div className="card-body">
                    <h3 className="homework-title">{hw.title}</h3>
                    <div className="homework-subject">
                      📖 {hw.subject}
                    </div>
                    <p className="homework-description">{hw.description}</p>
                    
                    <div className="homework-meta">
                      <div className="due-date">
                        📅 Échéance: {new Date(hw.dueDate).toLocaleDateString('fr-FR')}
                      </div>
                      {isOverdue && (
                        <div className="overdue-warning">
                          ⚠️ En retard de {Math.abs(daysUntilDue)} jours
                        </div>
                      )}
                      {isDueSoon && !isOverdue && (
                        <div className="due-soon-warning">
                          ⏰ Dans {daysUntilDue} jours
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card-footer">
                    <span className="teacher-name">
                      👨‍🏫 {hw.teacherName}
                    </span>
                    <div className="card-actions">
                      {hw.status === 'active' && (
                        <button
                          className="btn-complete"
                          onClick={() => handleMarkAsCompleted(hw.id)}
                        >
                          ✅ Marquer comme fait
                        </button>
                      )}
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteHomework(hw.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Modal - Using React Portal */}
      {showModal && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--card-bg)',
            borderRadius: 'var(--radius-lg)',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
            position: 'relative',
            zIndex: 100000
          }}>
            <div className="modal-header">
              <h2>✏️ Nouveau devoir</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleCreateHomework}>
              <div className="form-group">
                <label>Classe *</label>
                <select
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  required
                >
                  <option value="">-- Sélectionner une classe --</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Matière *</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Ex: Mathématiques"
                  required
                />
              </div>

              <div className="form-group">
                <label>Titre du devoir *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Chapitre 5 - Exercices 1-10"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description détaillée du devoir..."
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label>Date d'échéance *</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.notifyParents}
                    onChange={(e) => setFormData({ ...formData, notifyParents: e.target.checked })}
                  />
                  📱 Envoyer une notification SMS aux parents
                </label>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-submit">
                  📤 Créer le devoir
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </div>
  )
}

export default Homework

