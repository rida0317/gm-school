// src/components/admin/UserModal.tsx - Modal pour modifier un utilisateur

import React, { useState } from 'react'
import type { User, UserStatus, UserRole } from '../../types'
import './UserModal.css'

interface UserModalProps {
  user: User & { id: string }
  onClose: () => void
  onSave: (user: User & { id: string }) => Promise<void>
  canChangeRoles: boolean
}

const UserModal: React.FC<UserModalProps> = ({ user, onClose, onSave, canChangeRoles }) => {
  const [formData, setFormData] = useState({
    displayName: user.display_name || '',
    email: user.email,
    role: user.role || 'teacher',
    status: user.status || 'pending'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await onSave({
        ...user,
        ...formData
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  const getStatusOptions = () => {
    const options = [
      { value: 'active', label: '✅ Actif', disabled: false },
      { value: 'pending', label: '⏳ En attente', disabled: false },
      { value: 'suspended', label: '❌ Suspendu', disabled: false }
    ]
    return options
  }

  const getRoleOptions = () => {
    const options = [
      { value: 'admin', label: '👑 Administrateur', disabled: !canChangeRoles },
      { value: 'director', label: '👨‍💼 Directeur', disabled: false },
      { value: 'teacher', label: '👨‍🏫 Professeur', disabled: false },
      { value: 'guard', label: '👮 Garde', disabled: false }
    ]
    return options
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="user-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✏️ Modifier l'utilisateur</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label>Nom complet</label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="Nom complet"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
                required
              />
              <small className="form-hint">L'email ne peut pas être modifié</small>
            </div>

            <div className="form-group">
              <label>Rôle</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                disabled={!canChangeRoles}
              >
                {getRoleOptions().map(opt => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label} {opt.disabled && '(Réservé aux admins)'}
                  </option>
                ))}
              </select>
              {!canChangeRoles && (
                <small className="form-hint">⚠️ Seuls les admins peuvent changer les rôles</small>
              )}
            </div>

            <div className="form-group">
              <label>Statut du compte</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as UserStatus })}
              >
                {getStatusOptions().map(opt => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="status-help">
                <p><strong>⏳ En attente:</strong> L'utilisateur ne peut pas se connecter</p>
                <p><strong>✅ Actif:</strong> L'utilisateur peut se connecter normalement</p>
                <p><strong>❌ Suspendu:</strong> L'utilisateur est temporairement bloqué</p>
              </div>
            </div>

            <div className="user-info">
              <h4>Informations supplémentaires</h4>
              <div className="info-row">
                <span>ID:</span>
                <code>{user.id}</code>
              </div>
              {user.createdAt && (
                <div className="info-row">
                  <span>Créé le:</span>
                  <span>{new Date(user.createdAt).toLocaleString('fr-FR')}</span>
                </div>
              )}
              {user.verifiedAt && (
                <div className="info-row">
                  <span>Vérifié le:</span>
                  <span>{new Date(user.verifiedAt).toLocaleString('fr-FR')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Annuler
            </button>
            <button type="submit" className="btn-save" disabled={loading}>
              {loading ? '⏳ Enregistrement...' : '💾 Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UserModal

