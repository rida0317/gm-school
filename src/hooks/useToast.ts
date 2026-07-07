// src/hooks/useToast.ts - Toast notification hook NOW INTEGRATED WITH NOTIFICATION SYSTEM

import { useCallback } from 'react'
import { ToastType } from '../components/Toast'
import { useNotificationsStore } from '../store/notificationsStore'

// Convert toast type to notification type
const getNotificationType = (type: ToastType): 'system' | 'announcement' => {
  return type === 'error' || type === 'warning' ? 'announcement' : 'system'
}

const getNotificationPriority = (type: ToastType): 'normal' | 'high' | 'urgent' => {
  if (type === 'error') return 'high'
  if (type === 'warning') return 'high'
  return 'normal'
}

const getNotificationTitle = (type: ToastType): string => {
  switch (type) {
    case 'success': return '✅ Succès'
    case 'error': return '❌ Erreur'
    case 'warning': return '⚠️ Attention'
    case 'info': return 'ℹ️ Information'
    default: return 'Notification'
  }
}

export const useToast = () => {
  const addNotification = useNotificationsStore(state => state.addNotification)

  const addToast = useCallback((message: string, type: ToastType, _duration?: number) => {
    addNotification({
      userId: 'all',
      type: getNotificationType(type),
      title: getNotificationTitle(type),
      message: message,
      priority: getNotificationPriority(type),
      actionUrl: undefined
    })
  }, [addNotification])

  const showSuccess = useCallback((message: string, duration?: number) => {
    addToast(message, 'success', duration)
  }, [addToast])

  const showError = useCallback((message: string, duration?: number) => {
    addToast(message, 'error', duration)
  }, [addToast])

  const showWarning = useCallback((message: string, duration?: number) => {
    addToast(message, 'warning', duration)
  }, [addToast])

  const showInfo = useCallback((message: string, duration?: number) => {
    addToast(message, 'info', duration)
  }, [addToast])

  const clearAll = useCallback(() => {
    // Clear handled by notifications store
  }, [])

  return {
    toasts: [], // Empty for backwards compatibility
    addToast,
    removeToast: () => {},
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearAll
  }
}

// Global toast instance for use outside React components
export const showToast = (message: string, type: ToastType, _duration?: number) => {
  const { addNotification } = useNotificationsStore.getState()
  addNotification({
    userId: 'all',
    type: getNotificationType(type),
    title: getNotificationTitle(type),
    message: message,
    priority: getNotificationPriority(type),
    actionUrl: undefined
  })
}

export const removeGlobalToast = () => {}
export const clearGlobalToasts = () => {}
export const getGlobalToasts = () => []

export default useToast

