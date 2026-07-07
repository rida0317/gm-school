// src/hooks/useSessionTimeout.ts - Session timeout hook

import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../store/AuthContext'

interface UseSessionTimeoutOptions {
  timeout: number // Timeout in milliseconds (default: 30 minutes)
  warningTime: number // Warning time in milliseconds (default: 5 minutes)
  onTimeout: () => void
  onWarning: () => void
}

export const useSessionTimeout = (options: UseSessionTimeoutOptions) => {
  const { timeout = 30 * 60 * 1000, warningTime = 5 * 60 * 1000, onTimeout, onWarning } = options
  const timeoutRef = useRef<NodeJS.Timeout>()
  const warningRef = useRef<NodeJS.Timeout>()
  const lastActivityRef = useRef<number>(Date.now())
  const isWarningActive = useRef(false)

  const resetTimeout = useCallback(() => {
    lastActivityRef.current = Date.now()
    
    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current)
    }
    
    // Set warning timeout
    warningRef.current = setTimeout(() => {
      if (!isWarningActive.current) {
        isWarningActive.current = true
        onWarning()
      }
    }, timeout - warningTime)
    
    // Set logout timeout
    timeoutRef.current = setTimeout(() => {
      onTimeout()
    }, timeout)
  }, [timeout, warningTime, onTimeout, onWarning])

  const extendSession = useCallback(() => {
    isWarningActive.current = false
    resetTimeout()
  }, [resetTimeout])

  useEffect(() => {
    // Initialize timeout on mount
    resetTimeout()

    // Activity events to listen for
    const activityEvents = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'
    ]

    const handleActivity = () => {
      const now = Date.now()
      const timeSinceLastActivity = now - lastActivityRef.current
      
      // Only reset if there was significant inactivity
      if (timeSinceLastActivity > 1000) {
        resetTimeout()
      }
    }

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (warningRef.current) {
        clearTimeout(warningRef.current)
      }
      
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
    }
  }, [resetTimeout])

  return {
    extendSession,
    isWarningActive: isWarningActive.current
  }
}

// Hook for automatic session management with Supabase auth
export const useAutoSessionTimeout = () => {
  const { logout } = useAuth()

  const handleTimeout = useCallback(async () => {
    try {
      await logout()
      // Show timeout message

    } catch (error) {
      console.error('Error during session timeout:', error)
    }
  }, [logout])

  const handleWarning = useCallback(() => {
    // You can dispatch a custom event or use a toast notification
    window.dispatchEvent(new CustomEvent('session-warning', {
      detail: { message: 'Your session will expire soon due to inactivity' }
    }))
  }, [])

  return useSessionTimeout({
    timeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 5 * 60 * 1000, // 5 minutes warning
    onTimeout: handleTimeout,
    onWarning: handleWarning
  })
}

export default useSessionTimeout

