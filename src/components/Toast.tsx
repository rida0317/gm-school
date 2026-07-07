// src/components/Toast.tsx - Toast notification component

import React, { useEffect, useState } from 'react'
import './Toast.css'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastProps {
  id: string
  message: string
  type: ToastType
  duration?: number
  onClose: (id: string) => void
}

const Toast: React.FC<ToastProps> = ({ id, message, type, duration = 5000, onClose }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Auto-dismiss after duration
    const timer = setTimeout(() => {
      handleClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => onClose(id), 300) // Wait for exit animation
  }

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
      default: return 'ℹ️'
    }
  }

  const getClassName = () => {
    const baseClass = 'toast'
    const typeClass = `toast--${type}`
    const visibilityClass = isVisible && !isExiting ? 'toast--visible' : 'toast--hidden'
    const exitClass = isExiting ? 'toast--exiting' : ''
    
    return `${baseClass} ${typeClass} ${visibilityClass} ${exitClass}`.trim()
  }

  return (
    <div className={getClassName()}>
      <div className="toast__icon">{getIcon(type)}</div>
      <div className="toast__content">
        <p className="toast__message">{message}</p>
      </div>
      <button 
        className="toast__close"
        onClick={handleClose}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  )
}

export default Toast

