// src/components/Chatbot.tsx - AI Chatbot widget for school assistance

import React, { useState, useRef, useEffect } from 'react'
import { chatbotService, type ChatMessage } from '../services/chatbot.service'
import { useAuth } from '../store/AuthContext'
import './Chatbot.css'

const Chatbot: React.FC = () => {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Start new session
      const session = chatbotService.startSession(user?.id || 'anonymous')
      setMessages(session.messages)
    }
  }, [isOpen, user?.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async (text?: string) => {
    const messageText = text || inputValue.trim()
    if (!messageText) return

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: messageText,
      sender: 'user',
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)

    // Get bot response
    setTimeout(async () => {
      const response = await chatbotService.getResponse(messageText)
      setMessages(prev => [...prev, response])
      setIsTyping(false)
    }, 500 + Math.random() * 1000) // Simulate typing delay
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion)
  }

  const clearChat = () => {
    const session = chatbotService.startSession(user?.id || 'anonymous')
    setMessages(session.messages)
  }

  const toggleChat = () => {
    setIsOpen(!isOpen)
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <>
      {/* Chat Toggle Button */}
      <button className={`chat-toggle ${isOpen ? 'open' : ''}`} onClick={toggleChat}>
        {isOpen ? (
          <span className="toggle-icon">✕</span>
        ) : (
          <>
            <span className="toggle-icon">💬</span>
            <span className="toggle-label">Assistant</span>
          </>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window">
          {/* Chat Header */}
          <div className="chat-header">
            <div className="chat-header-info">
              <span className="chat-avatar">🤖</span>
              <div className="chat-header-text">
                <h3>Assistant IA</h3>
                <span className="chat-status">
                  <span className="status-dot"></span>
                  En ligne
                </span>
              </div>
            </div>
            <div className="chat-header-actions">
              <button className="chat-btn" onClick={clearChat} title="Effacer la conversation">
                🗑️
              </button>
              <button className="chat-btn" onClick={toggleChat} title="Fermer">
                ✕
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="chat-messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.sender === 'user' ? 'message-user' : 'message-bot'}`}
              >
                <div className="message-avatar">
                  {message.sender === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <div className="message-bubble">
                    {message.text}
                  </div>
                  <div className="message-time">
                    {formatTime(message.timestamp)}
                  </div>
                  
                  {/* Suggestions */}
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="message-suggestions">
                      {message.suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          className="suggestion-btn"
                          onClick={() => handleSuggestionClick(suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="message message-bot">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="message-bubble typing">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="chat-input-container">
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder="Posez votre question..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button
              className="chat-send"
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isTyping}
            >
              📤
            </button>
          </div>

          {/* Quick Questions */}
          <div className="chat-quick-questions">
            <span className="quick-label">Questions rapides:</span>
            <div className="quick-buttons">
              <button onClick={() => handleSendMessage('Comment voir les notes?')}>
                📊 Notes
              </button>
              <button onClick={() => handleSendMessage('Comment créer un devoir?')}>
                📚 Devoirs
              </button>
              <button onClick={() => handleSendMessage('Emploi du temps')}>
                📅 Emploi du temps
              </button>
              <button onClick={() => handleSendMessage('Envoyer SMS')}>
                📱 SMS
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Chatbot

