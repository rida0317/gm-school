// src/components/Salles.tsx - Room management component

import React, { useState } from 'react'
import { useSchoolStore } from '../store/schoolStore'
import { translations } from '../utils/translations'
import type { Salle } from '../types'
import './Salles.css'

const Salles: React.FC = () => {
  const { salles, addSalle, updateSalle, deleteSalle } = useSchoolStore()
  const t = (key: string) => translations[key]?.fr || key
  const [showModal, setShowModal] = useState(false)
  const [editingSalle, setEditingSalle] = useState<Salle | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    type: 'Standard' as 'Standard' | 'Labo' | 'Informatique',
  })

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'Standard',
    })
    setEditingSalle(null)
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (salle: Salle) => {
    setFormData({
      name: salle.name,
      type: salle.type,
    })
    setEditingSalle(salle)
    setShowModal(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingSalle) {
      updateSalle(editingSalle.id, formData)
    } else {
      addSalle(formData)
    }
    
    setShowModal(false)
    resetForm()
  }

  const getTypeIcon = (type: Salle['type']) => {
    switch (type) {
      case 'Labo': return '🧪'
      case 'Informatique': return '💻'
      default: return '🏫'
    }
  }

  const getTypeColor = (type: Salle['type']) => {
    switch (type) {
      case 'Labo': return '#dc3545'
      case 'Informatique': return '#0dcaf0'
      default: return '#198754'
    }
  }

  return (
    <div className="salles-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('salles.title')}</h1>
          <p className="page-subtitle">{t('salles.manageClassrooms')}</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          {t('salles.addRoom')}
        </button>
      </div>

      <div className="salles-grid">
        {salles.map((salle) => (
          <div key={salle.id} className="salle-card">
            <div className="salle-header">
              <div className="salle-icon" style={{ background: `${getTypeColor(salle.type)}20` }}>
                {getTypeIcon(salle.type)}
              </div>
              <div className="salle-info">
                <h3 className="salle-name">{salle.name}</h3>
                <span
                  className="salle-type"
                  style={{
                    background: `${getTypeColor(salle.type)}20`,
                    color: getTypeColor(salle.type)
                  }}
                >
                  {salle.type}
                </span>
              </div>
            </div>

            <div className="salle-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(salle)}>
                ✏️ {t('common.edit')}
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  if (confirm(`Delete ${salle.name}?`)) {
                    deleteSalle(salle.id)
                  }
                }}
              >
                🗑️ {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {salles.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">🏫</span>
          <h3>{t('salles.noRooms')}</h3>
          <p>{t('salles.createFirst')}</p>
          <button className="btn btn-primary" onClick={openAddModal}>
            {t('salles.addRoom')}
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingSalle ? t('salles.editRoom') : t('salles.addRoomTitle')}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="salle-form">
              <div className="form-group">
                <label className="form-label" htmlFor="roomName">{t('salles.roomName')}</label>
                <input
                  id="roomName"
                  name="roomName"
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('salles.room101')}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" id="roomTypeLabel">{t('salles.roomType')}</label>
                <div className="type-selector" role="radiogroup" aria-labelledby="roomTypeLabel">
                  {(['Standard', 'Labo', 'Informatique'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`type-option ${formData.type === type ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, type })}
                      role="radio"
                      aria-checked={formData.type === type}
                      aria-label={`${type} ${t('salles.roomTypeLabel')}`}
                    >
                      <span className="type-icon">{getTypeIcon(type)}</span>
                      <span className="type-label">{t(`salles.${type.toLowerCase() === 'labo' ? 'lab' : type.toLowerCase() === 'informatique' ? 'computer' : 'standard'}`)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSalle ? t('salles.updateRoom') : t('salles.createRoom')} {t('nav.salles')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Salles

