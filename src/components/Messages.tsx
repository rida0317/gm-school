// src/components/Messages.tsx - Internal messaging and announcements
// Enhanced with Supabase integration and Zustand store

import React, { useState, useEffect } from 'react'
import { useAuth } from '../store/AuthContext'
import { 
  useMessagesStore, 
  useMessages, 
  useUnreadMessagesCount
} from '../store/messagesStore'
import { showToast } from '../hooks/useToast'
import type { Message } from '../types'
import './Messages.css'

const Messages: React.FC = () => {
  const { user } = useAuth()
  const messages = useMessages()
  const unreadCount = useUnreadMessagesCount()
  const { 
    sendMessage, 
    markAsRead, 
    deleteMessage, 
    subscribeToMessages
  } = useMessagesStore()
  
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'unread'>('inbox')
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [showComposeModal, setShowComposeModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [composeData, setComposeData] = useState({
    recipientId: '',
    subject: '',
    content: '',
    priority: 'normal' as 'normal' | 'urgent' | 'high'
  })

  // Subscribe to messages when user logs in
  useEffect(() => {
    if (user?.id) {
      const unsubscribe = subscribeToMessages(user.id)
      return unsubscribe
    }
  }, [user?.id, subscribeToMessages])

  // Filter messages based on active tab
  const filteredMessages = messages.filter(msg => {
    if (!user?.id) return []
    
    if (activeTab === 'inbox') {
      if (msg.recipientId !== user.id) return false
    } else if (activeTab === 'sent') {
      if (msg.senderId !== user.id) return false
    } else if (activeTab === 'unread') {
      if (msg.recipientId !== user.id || msg.read) return false
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return msg.subject.toLowerCase().includes(search) || 
             msg.content.toLowerCase().includes(search)
    }

    return true
  })

  const handleComposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!composeData.recipientId || !composeData.subject || !composeData.content) {
      showToast('Veuillez remplir tous les champs obligatoires', 'warning')
      return
    }

    try {
      await sendMessage(
        composeData.recipientId,
        composeData.subject,
        composeData.content,
        composeData.priority
      )
      
      setShowComposeModal(false)
      setComposeData({ recipientId: '', subject: '', content: '', priority: 'normal' })
      showToast('✅ Message envoyé avec succès!', 'success')
    } catch (error) {
      showToast('Erreur lors de l\'envoi du message', 'error')
    }
  }

  const handleMessageClick = (message: Message) => {
    setSelectedMessage(message)
    if (!message.read && message.recipientId === user?.id) {
      markAsRead(message.id)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce message?')) {
      await deleteMessage(messageId)
      if (selectedMessage?.id === messageId) setSelectedMessage(null)
    }
  }

  const handleReply = () => {
    if (!selectedMessage) return
    setComposeData({
      recipientId: selectedMessage.senderId,
      subject: `Re: ${selectedMessage.subject}`,
      content: '',
      priority: selectedMessage.priority
    })
    setShowComposeModal(true)
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent': return '🔴 URGENT'
      case 'high': return '🟠 HIGH'
      default: return ''
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    if (days === 1) return 'Hier'
    if (days < 7) return date.toLocaleDateString('fr-FR', { weekday: 'long' })
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div className="messages-container">
      <div className="messages-header">
        <div className="header-content">
          <h1>💬 Messages</h1>
          {unreadCount > 0 && <span className="unread-badge">{unreadCount} non lu(s)</span>}
        </div>
        <button className="btn-compose" onClick={() => setShowComposeModal(true)}>
          ✏️ Nouveau message
        </button>
      </div>

      <div className="messages-tabs">
        <button className={`tab ${activeTab === 'inbox' ? 'active' : ''}`} onClick={() => setActiveTab('inbox')}>
          📥 Boîte de réception
        </button>
        <button className={`tab ${activeTab === 'sent' ? 'active' : ''}`} onClick={() => setActiveTab('sent')}>
          📤 Envoyés
        </button>
        <button className={`tab ${activeTab === 'unread' ? 'active' : ''}`} onClick={() => setActiveTab('unread')}>
          📫 Non lus {unreadCount > 0 && <span className="tab-badge">{unreadCount}</span>}
        </button>
      </div>

      <div className="messages-search">
        <input
          type="text"
          placeholder="🔍 Rechercher un message..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="messages-content">
        {filteredMessages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>Aucun message</h3>
            <p>Vous n'avez aucun message pour le moment</p>
          </div>
        ) : (
          <div className="messages-list">
            {filteredMessages.map((message) => (
              <div
                key={message.id}
                className={`message-item ${!message.read ? 'unread' : ''} ${selectedMessage?.id === message.id ? 'selected' : ''}`}
                onClick={() => handleMessageClick(message)}
              >
                <div className="message-avatar">
                  {(message.senderId.charAt(0) || 'U').toUpperCase()}
                </div>
                <div className="message-content">
                  <div className="message-header">
                    <span className="message-sender">
                      {message.senderId === user?.id ? 'Moi' : message.senderId}
                    </span>
                    <span className="message-time">{formatTime(message.timestamp)}</span>
                  </div>
                  <div className="message-subject">{message.subject}</div>
                  <div className="message-preview">{message.content.substring(0, 100)}...</div>
                  <div className="message-footer">
                    {getPriorityBadge(message.priority)}
                    {!message.read && <span className="unread-dot">🔵</span>}
                  </div>
                </div>
                <button
                  className="delete-btn"
                  onClick={(e) => { e.stopPropagation(); handleDeleteMessage(message.id) }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedMessage && (
        <div className="message-detail">
          <div className="detail-header">
            <h2>{selectedMessage.subject}</h2>
            <div className="detail-actions">
              {getPriorityBadge(selectedMessage.priority)}
              <button className="btn-reply" onClick={handleReply}>↩️ Répondre</button>
              <button className="btn-delete" onClick={() => handleDeleteMessage(selectedMessage.id)}>🗑️</button>
            </div>
          </div>
          <div className="detail-meta">
            <p><strong>De:</strong> {selectedMessage.senderId === user?.id ? 'Moi' : selectedMessage.senderId}</p>
            <p><strong>À:</strong> {selectedMessage.recipientId === user?.id ? 'Moi' : selectedMessage.recipientId}</p>
            <p><strong>Date:</strong> {new Date(selectedMessage.timestamp).toLocaleString('fr-FR')}</p>
          </div>
          <div className="detail-content">{selectedMessage.content}</div>
        </div>
      )}

      {showComposeModal && (
        <div className="compose-modal" onClick={() => setShowComposeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ Nouveau message</h2>
              <button className="close-btn" onClick={() => setShowComposeModal(false)}>×</button>
            </div>
            <form onSubmit={handleComposeSubmit}>
              <div className="form-group">
                <label>Destinataire (ID):</label>
                <input
                  type="text"
                  value={composeData.recipientId}
                  onChange={(e) => setComposeData({ ...composeData, recipientId: e.target.value })}
                  placeholder="ID du destinataire"
                  required
                />
              </div>
              <div className="form-group">
                <label>Sujet:</label>
                <input
                  type="text"
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  placeholder="Sujet du message"
                  required
                />
              </div>
              <div className="form-group">
                <label>Priorité:</label>
                <select
                  value={composeData.priority}
                  onChange={(e) => setComposeData({ ...composeData, priority: e.target.value as any })}
                >
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              <div className="form-group">
                <label>Message:</label>
                <textarea
                  value={composeData.content}
                  onChange={(e) => setComposeData({ ...composeData, content: e.target.value })}
                  placeholder="Votre message..."
                  rows={6}
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowComposeModal(false)}>Annuler</button>
                <button type="submit" className="btn-send">📤 Envoyer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Messages

