// src/utils/logger.ts - Unified logging utility (only logs in development)

const isDev = import.meta.env.DEV

// In production, all logging is disabled for performance
export const logger = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  warn: (...args: unknown[]) => isDev && console.warn(...args),
  error: (...args: unknown[]) => console.error(...args), // Always log errors
  info: (...args: unknown[]) => isDev && console.info(...args),
  debug: (...args: unknown[]) => isDev && console.debug(...args)
}

export default logger

