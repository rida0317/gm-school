// src/lib/queryClientSingleton.ts - Singleton for React Query client access across non-React modules

import { QueryClient } from '@tanstack/react-query'

let queryClient: QueryClient | null = null

/**
 * Set the global QueryClient instance (call from App root)
 */
export const setQueryClient = (client: QueryClient) => {
  queryClient = client
}

/**
 * Get the global QueryClient instance
 * Returns null if not initialized yet
 */
export const getQueryClient = (): QueryClient | null => {
  return queryClient
}

/**
 * Invalidate queries safely
 */
export const invalidateQueries = (queryKey: unknown[]) => {
  const client = getQueryClient()
  if (client) {
    client.invalidateQueries({ queryKey })
  }
}
