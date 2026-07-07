// src/components/Payments.tsx - Payment management for school fees

import React, { useState, useEffect } from 'react'
import { usePaymentsStore, usePayments, usePaymentStats, usePaymentReminders, createPayment, recordPayment } from '../store/paymentsStore'
import { useStudents } from '../store/studentsStore'
import { useSchoolStore } from '../store/schoolStore'
import { useAuth } from '../store/AuthContext'
import { showToast } from '../hooks/useToast'
import './Payments.css'

type PaymentType = 'inscription' | 'mensualite' | 'transport' | 'cantine' | 'autre'

const Payments: React.FC = () => {
  const { user } = useAuth()
  const students = useStudents()
  const { schoolName } = useSchoolStore()

  const payments = usePayments()
  const stats = usePaymentStats()
  const reminders = usePaymentReminders()

  const { createPayment: create, recordPayment: record, setAcademicYear, fetchPayments } = usePaymentsStore()

  // Fetch payments from Supabase on mount
  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const [activeTab, setActiveTab] = useState<'list' | 'new' | 'reminders'>('list')
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    studentId: '',
    type: 'mensualite' as PaymentType,
    amount: '',
    dueDate: '',
    notes: ''
  })

  const [recordFormData, setRecordFormData] = useState({
    amount: '',
    paymentMethod: 'cash' as 'cash' | 'check' | 'bank_transfer' | 'online',
    notes: ''
  })

  const academicYear = usePaymentsStore((s) => s.academicYear)

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.studentId || !formData.amount || !formData.dueDate) {
      showToast('Veuillez remplir tous les champs obligatoires', 'warning')
      return
    }

    const student = students.find(s => s.id === formData.studentId)
    if (!student) {
      return
    }

    try {
      await create({
        studentId: formData.studentId,
        studentName: student.name,
        classId: student.classId,
        amount: parseFloat(formData.amount),
        type: formData.type,
        dueDate: formData.dueDate,
        academicYear,
        notes: formData.notes,
        createdBy: user?.id || '',
        createdByName: user?.display_name || user?.email || 'Administration'
      })

      showToast('Frais créés avec succès!', 'success')
      setFormData({
        studentId: '',
        type: 'mensualite',
        amount: '',
        dueDate: '',
        notes: ''
      })
      setActiveTab('list')
    } catch (error) {
      console.error('❌ Error creating payment:', error)
      showToast('Erreur lors de la création: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error')
    }
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedPayment || !recordFormData.amount) {
      showToast('Veuillez sélectionner un paiement et entrer un montant', 'warning')
      return
    }

    try {
      const paymentRecord = await record(
        selectedPayment,
        parseFloat(recordFormData.amount),
        recordFormData.paymentMethod,
        user?.id || '',
        user?.display_name || user?.email || 'Administration',
        recordFormData.notes
      )

      showToast(`Paiement enregistré!\nReçu: ${paymentRecord.receiptNumber}`, 'success')
      setShowRecordModal(false)
      setRecordFormData({
        amount: '',
        paymentMethod: 'cash',
        notes: ''
      })
      setSelectedPayment(null)
    } catch (error) {
      showToast('Erreur lors de l\'enregistrement', 'error')
      console.error(error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <span className="status-badge paid">✅ Payé</span>
      case 'partial': return <span className="status-badge partial">⏳ Partiel</span>
      case 'pending': return <span className="status-badge pending">⏰ En attente</span>
      case 'overdue': return <span className="status-badge overdue">⚠️ En retard</span>
      default: return <span className="status-badge">{status}</span>
    }
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      inscription: '📝 Inscription',
      mensualite: '💰 Mensualité',
      transport: '🚌 Transport',
      cantine: '🍽️ Cantine',
      autre: '📌 Autre'
    }
    return labels[type] || type
  }

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: '💵 Espèces',
      check: '📝 Chèque',
      bank_transfer: '🏦 Virement',
      online: '💻 En ligne'
    }
    return labels[method] || method
  }

  return (
    <div className="payments-container">
      <div className="payments-header">
        <div className="header-content">
          <h1>💳 Gestion des Paiements</h1>
          <p>Suivi des frais scolaires et paiements</p>
        </div>
        <div className="header-actions">
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="year-select"
          >
            <option value="2024-2025">2024-2025</option>
            <option value="2025-2026">2025-2026</option>
            <option value="2026-2027">2026-2027</option>
          </select>
          <button 
            className="btn-new"
            onClick={() => setActiveTab('new')}
          >
            ➕ Nouveaux frais
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="payments-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.totalExpected.toFixed(0)} DH</div>
            <div className="stat-label">Total attendu</div>
          </div>
          <div className="stat-card paid">
            <div className="stat-value">{stats.totalPaid.toFixed(0)} DH</div>
            <div className="stat-label">Total payé</div>
          </div>
          <div className="stat-card remaining">
            <div className="stat-value">{stats.totalRemaining.toFixed(0)} DH</div>
            <div className="stat-label">Restant</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.paymentRate.toFixed(1)}%</div>
            <div className="stat-label">Taux de paiement</div>
          </div>
          <div className="stat-card overdue">
            <div className="stat-value">{stats.studentsOverdue}</div>
            <div className="stat-label">En retard</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="payments-tabs">
        <button
          className={`tab ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          📋 Liste des paiements
        </button>
        <button
          className={`tab ${activeTab === 'new' ? 'active' : ''}`}
          onClick={() => setActiveTab('new')}
        >
          ➕ Nouveaux frais
        </button>
        <button
          className={`tab ${activeTab === 'reminders' ? 'active' : ''}`}
          onClick={() => setActiveTab('reminders')}
        >
          ⚠️ Retards ({reminders.length})
        </button>
      </div>

      {/* List Tab */}
      {activeTab === 'list' && (
        <div className="payments-list">
          {payments.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              <h3>Aucun paiement</h3>
              <p>Créez de nouveaux frais pour commencer</p>
            </div>
          ) : (
            <table className="payments-table">
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Classe</th>
                  <th>Type</th>
                  <th>Montant</th>
                  <th>Payé</th>
                  <th>Restant</th>
                  <th>Échéance</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="student-name">{payment.studentName}</td>
                    <td>{payment.classId}</td>
                    <td>{getTypeLabel(payment.type)}</td>
                    <td className="amount">{payment.amount.toFixed(0)} DH</td>
                    <td className="paid">{payment.paidAmount.toFixed(0)} DH</td>
                    <td className="remaining">{payment.remainingAmount.toFixed(0)} DH</td>
                    <td>{new Date(payment.dueDate).toLocaleDateString('fr-FR')}</td>
                    <td>{getStatusBadge(payment.status)}</td>
                    <td>
                      <div className="actions">
                        {payment.status !== 'paid' && (
                          <button
                            className="btn-record"
                            onClick={() => {
                              setSelectedPayment(payment.id)
                              setShowRecordModal(true)
                            }}
                            title="Enregistrer un paiement"
                          >
                            💳
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* New Payment Tab */}
      {activeTab === 'new' && (
        <div className="new-payment-form">
          <div className="form-card">
            <h2>➕ Créer de nouveaux frais</h2>
            <form onSubmit={handleCreatePayment}>
              <div className="form-group">
                <label>Élève *</label>
                <select
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  required
                >
                  <option value="">-- Sélectionner un élève --</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.classId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Type de frais *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as PaymentType })}
                  required
                >
                  <option value="inscription">📝 Inscription</option>
                  <option value="mensualite">💰 Mensualité</option>
                  <option value="transport">🚌 Transport</option>
                  <option value="cantine">🍽️ Cantine</option>
                  <option value="autre">📌 Autre</option>
                </select>
              </div>

              <div className="form-group">
                <label>Montant (DH) *</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Ex: 500"
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label>Date d'échéance *</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Notes (optionnel)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Informations complémentaires..."
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-submit">
                  ✅ Créer les frais
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reminders Tab */}
      {activeTab === 'reminders' && (
        <div className="reminders-list">
          <h2>⚠️ Paiements en retard ({reminders.length})</h2>
          {reminders.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">✅</span>
              <h3>Aucun retard!</h3>
              <p>Tous les paiements sont à jour</p>
            </div>
          ) : (
            <table className="reminders-table">
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Classe</th>
                  <th>Montant dû</th>
                  <th>Date d'échéance</th>
                  <th>Retard</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((reminder) => (
                  <tr key={reminder.id}>
                    <td className="student-name">{reminder.studentName}</td>
                    <td>{reminder.classId}</td>
                    <td className="amount">{reminder.amount.toFixed(0)} DH</td>
                    <td>{new Date(reminder.dueDate).toLocaleDateString('fr-FR')}</td>
                    <td className="days-overdue">{reminder.daysOverdue} jours</td>
                    <td>
                      <button
                        className="btn-reminder"
                        onClick={() => {
                          setSelectedPayment(reminder.id)
                          setShowRecordModal(true)
                        }}
                      >
                        💳 Enregistrer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      {showRecordModal && (
        <div className="modal-overlay" onClick={() => setShowRecordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💳 Enregistrer un paiement</h2>
              <button className="close-btn" onClick={() => setShowRecordModal(false)}>×</button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="form-group">
                <label>Montant (DH) *</label>
                <input
                  type="number"
                  value={recordFormData.amount}
                  onChange={(e) => setRecordFormData({ ...recordFormData, amount: e.target.value })}
                  placeholder="Ex: 200"
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label>Méthode de paiement *</label>
                <select
                  value={recordFormData.paymentMethod}
                  onChange={(e) => setRecordFormData({ ...recordFormData, paymentMethod: e.target.value as any })}
                  required
                >
                  <option value="cash">💵 Espèces</option>
                  <option value="check">📝 Chèque</option>
                  <option value="bank_transfer">🏦 Virement bancaire</option>
                  <option value="online">💻 En ligne</option>
                </select>
              </div>

              <div className="form-group">
                <label>Notes (optionnel)</label>
                <textarea
                  value={recordFormData.notes}
                  onChange={(e) => setRecordFormData({ ...recordFormData, notes: e.target.value })}
                  placeholder="Numéro de chèque, référence..."
                  rows={3}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowRecordModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-submit">
                  ✅ Enregistrer le paiement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Payments

