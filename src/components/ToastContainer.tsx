// src/components/ToastContainer.tsx - Toast container component

import React, { useEffect, useState } from 'react'
import Toast from './Toast'
import { ToastType } from './Toast'

interface ToastData {
  id: string
  message: string
  type: ToastType
  duration?: number
}

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    // Listen for global toast events
    const handleToastAdded = (event: CustomEvent) => {
      const toastData = event.detail
      setToasts(prev => [...prev, toastData])
    }

    const handleToastRemoved = (event: CustomEvent) => {
      const { id } = event.detail
      setToasts(prev => prev.filter(toast => toast.id !== id))
    }

    const handleToastsCleared = () => {
      setToasts([])
    }

    window.addEventListener('toast-added', handleToastAdded as EventListener)
    window.addEventListener('toast-removed', handleToastRemoved as EventListener)
    window.addEventListener('toasts-cleared', handleToastsCleared)

    return () => {
      window.removeEventListener('toast-added', handleToastAdded as EventListener)
      window.removeEventListener('toast-removed', handleToastRemoved as EventListener)
      window.removeEventListener('toasts-cleared', handleToastsCleared)
    }
  }, [])

  const handleCloseToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={handleCloseToast}
        />
      ))}
    </div>
  )
}

export default ToastContainer

