// src/config/sentry.ts - Sentry error monitoring configuration
// 🔒 SECURITY: Error tracking and monitoring

import * as Sentry from '@sentry/react'

// Sentry DSN (Data Source Name)
// Replace with your actual Sentry DSN from sentry.io
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || ''

// Initialize Sentry
export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn('⚠️ Sentry DSN not configured. Error monitoring disabled.')
    return
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Performance Monitoring
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Performance monitoring sample rate
    tracesSampleRate: 0.1, // 10% of transactions

    // Session replay sample rate
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of error sessions

    // Environment
    environment: import.meta.env.MODE || 'development',

    // Release version
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',

    // Before sending event, filter sensitive data
    beforeSend(event, hint) {
      // Don't send events in development
      if (import.meta.env.DEV) {

        return null
      }

      // Filter out sensitive information
      if (event.request) {
        delete event.request.cookies
        delete event.request.headers
      }

      return event
    },

    // Ignore specific errors
    ignoreErrors: [
      // Dialog accessibility (from third-party scripts/extensions)
      'DialogContent requires a DialogTitle',
      
      // Browser extensions
      'top.GLOBALS',
      'chrome-extension://',
      'moz-extension://',
      
      // Network errors
      'NetworkError',
      'Network request failed',
      
      // Random plugins/extensions
      'atomicFindClose',
      'fb_xd_fragment',
      
      // Other plugins
      'CanvasRenderingContext2D',
    ],

    // Deny URLs (third-party scripts)
    denyUrls: [
      // Facebook flx content
      /baidu\.com/i,
      /google\.com/i,
      /facebook\.com/i,
      
      // Chrome extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
    ],
  })
}

// Set user context for error tracking
export function setSentryUser(userId: string, email: string, role?: string) {
  if (!SENTRY_DSN) return

  Sentry.setUser({
    id: userId,
    email,
    role,
  })
}

// Clear user context on logout
export function clearSentryUser() {
  if (!SENTRY_DSN) return
  Sentry.setUser(null)
}

// Manual error reporting
export function reportError(error: Error, context?: {
  level?: Sentry.SeverityLevel
  tags?: Record<string, string>
  extra?: Record<string, any>
}) {
  if (!SENTRY_DSN) {
    console.error('Error:', error)
    return
  }

  Sentry.captureException(error, {
    level: context?.level || 'error',
    tags: context?.tags,
    extra: context?.extra,
  })
}

// Manual message reporting
export function reportMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (!SENTRY_DSN) {

    return
  }

  Sentry.captureMessage(message, level)
}

export default Sentry

