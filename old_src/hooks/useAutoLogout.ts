// src/hooks/useAutoLogout.ts - Auto-logout on inactivity and tab close
import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../store/AuthContext'

const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutes in milliseconds

export const useAutoLogout = () => {
  const { logout } = useAuth()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const handleLogout = useCallback(async () => {
    // Only logout if there is an active session

    try {
      await logout()
    } catch (error) {
      console.error('Auto-logout error:', error)
    }
  }, [logout])

  const resetTimeout = useCallback(() => {
    lastActivityRef.current = Date.now()

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      handleLogout()
    }, INACTIVITY_TIMEOUT)
  }, [handleLogout])

  useEffect(() => {
    // Activity events to listen for
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'keydown'
    ]

    const handleActivity = () => {
      resetTimeout()
    }

    // Add activity event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    // Initialize timeout
    resetTimeout()

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
    }
  }, [resetTimeout])
}

