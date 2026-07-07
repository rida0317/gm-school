import { useEffect, useCallback } from 'react'

export const useHardRefresh = (enabled: boolean = true) => {
  const performHardRefresh = useCallback(() => {

    window.location.reload()
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault()

        window.location.reload()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, performHardRefresh])

  return { performHardRefresh }
}

export default useHardRefresh

