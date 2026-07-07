// src/components/admin/UserManagement.tsx - Gestion des utilisateurs (Supabase Version)

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../store/AuthContext'
import type { UserStatus, UserRole } from '../../types'
import UserModal from './UserModal'
import './UserManagement.css'

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  status: UserStatus
  created_at: string
}

const UserManagement: React.FC = () => {
  const { user, userData: currentUser, verifyUser } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const canManageUsers = currentUser?.role === 'admin' || currentUser?.role === 'director'
  const canDeleteUsers = currentUser?.role === 'admin'
  const canChangeRoles = currentUser?.role === 'admin'

  useEffect(() => {
    if (!canManageUsers) {
      setMessage({ type: 'error', text: '❌ Vous n\'avez pas les permissions nécessaires.' })
      return
    }
    loadProfiles()
  }, [])

  const loadProfiles = async () => {
    try {
      setLoading(true)

      
      // Simple query - just get basic fields
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, status, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error loading profiles:', error)
        // Don't throw - just show empty state
        setProfiles([])
        setMessage({ 
          type: 'error', 
          text: `❌ Erreur: ${error.message}. Vérifiez les permissions RLS dans Supabase.`
        })
        return
      }


      setProfiles(data as unknown as Profile[])
      setMessage(null)
    } catch (error: any) {
      console.error('❌ Error loading profiles:', error)
      setMessage({ 
        type: 'error', 
        text: `❌ Erreur lors du chargement: ${error.message || 'Vérifiez votre connexion Supabase'}`
      })
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (userId: string, newStatus: UserStatus) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', userId)

      if (error) throw error

      setMessage({ 
        type: 'success', 
        text: `✅ Utilisateur ${newStatus === 'active' ? 'activé' : 'suspendu'} avec succès` 
      })
      await loadProfiles()
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Erreur lors de la mise à jour' })
    }
  }

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!canDeleteUsers) return
    if (!confirm(`⚠️ Êtes-vous sûr de vouloir supprimer ${userEmail}? Cette action est irréversible.`)) {
      return
    }

    try {
      setLoading(true)
      const { error } = await supabase.from('profiles').delete().eq('id', userId)
      if (error) throw error
      
      setMessage({ type: 'success', text: `✅ Utilisateur ${userEmail} supprimé avec succès.` })
      await loadProfiles()
    } catch (error: any) {
      setMessage({ type: 'error', text: `❌ Erreur lors de la suppression: ${error.message}` })
    } finally {
      setLoading(false)
    }
  }

  const handleEditUser = (profile: Profile) => {
    setSelectedUser(profile)
    setIsModalOpen(true)
  }

  const handleModalSave = async (updatedProfile: any) => {
    try {
      setLoading(true)
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: updatedProfile.display_name,
          role: updatedProfile.role,
          status: updatedProfile.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedProfile.id)

      if (error) throw error

      setMessage({ type: 'success', text: '✅ Utilisateur mis à jour avec succès' })
      await loadProfiles()
      setIsModalOpen(false)
    } catch (error: any) {
      setMessage({ type: 'error', text: `❌ Erreur lors de la mise à jour: ${error.message}` })
    } finally {
      setLoading(false)
    }
  }

  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = filterRole === 'all' || p.role === filterRole
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus
    return matchesSearch && matchesRole && matchesStatus
  })

  // Badge Helpers
  const getStatusBadge = (status: UserStatus) => {
    const badges: Record<string, { label: string; class: string }> = {
      pending: { label: '⏳ En attente', class: 'status-pending' },
      active: { label: '✅ Actif', class: 'status-active' },
      suspended: { label: '❌ Suspendu', class: 'status-suspended' }
    }
    return badges[status] || badges.pending
  }

  const getRoleBadge = (role: UserRole) => {
    const badges: Record<string, { label: string; class: string }> = {
      admin: { label: '👑 Admin', class: 'role-admin' },
      director: { label: '👨‍💼 Directeur', class: 'role-director' },
      teacher: { label: '👨‍🏫 Professeur', class: 'role-teacher' },
      guard: { label: '👮 Garde', class: 'role-guard' },
      assistant: { label: '🤝 Assistant', class: 'role-assistant' }
    }
    return badges[role] || badges.teacher
  }

  if (!canManageUsers) {
    return (
      <div className="user-management-page">
        <div className="unauthorized">
          <h1>🚫 Accès Non Autorisé</h1>
          <p>Seuls les administrateurs et directeurs peuvent gérer les utilisateurs.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="user-management-page">
      <div className="page-header">
        <h1>👥 Gestion des Utilisateurs</h1>
        <p>Gérez les comptes, rôles et statuts des utilisateurs (Supabase)</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>\u00D7</button>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Rechercher par nom ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="all">Tous les rôles</option>
            <option value="admin">👑 Admin</option>
            <option value="director">👨‍ Directeur</option>
            <option value="teacher">👨‍🏫 Professeur</option>
            <option value="guard">👮 Garde</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">Tous les statuts</option>
            <option value="active">✅ Actif</option>
            <option value="pending">⏳ En attente</option>
            <option value="suspended">❌ Suspendu</option>
          </select>
        </div>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>Créé le</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="loading">⏳ Chargement...</td></tr>
            ) : filteredProfiles.length === 0 ? (
              <tr><td colSpan={6} className="no-results">😕 Aucun utilisateur trouvé</td></tr>
            ) : (
              filteredProfiles.map(p => {
                const statusBadge = getStatusBadge(p.status)
                const roleBadge = getRoleBadge(p.role)
                return (
                  <tr key={p.id}>
                    <td>{p.full_name || 'N/A'}</td>
                    <td>{p.email}</td>
                    <td><span className={`role-badge ${roleBadge.class}`}>{roleBadge.label}</span></td>
                    <td><span className={`status-badge ${statusBadge.class}`}>{statusBadge.label}</span></td>
                    <td>{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="actions">
                      <button className="btn-action" onClick={() => handleEditUser(p)}>✏️</button>
                      {p.status !== 'active' && <button className="btn-action" onClick={() => handleStatusChange(p.id, 'active')}>✅</button>}
                      {p.status === 'active' && p.id !== currentUser?.id && <button className="btn-action" onClick={() => handleStatusChange(p.id, 'suspended')}>⏸️</button>}
                      {canDeleteUsers && p.id !== currentUser?.id && <button className="btn-action" onClick={() => handleDeleteUser(p.id, p.email)}>🗑️</button>}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && selectedUser && (
        <UserModal
          user={selectedUser as any}
          onClose={() => setIsModalOpen(false)}
          onSave={handleModalSave}
          canChangeRoles={canChangeRoles}
        />
      )}
    </div>
  )
}

export default UserManagement

