/**
 * Clear all localStorage data for the app
 * Run this in browser console or call from code
 */

// Clear all app storage
export function clearAppStorage() {

  
  // Store keys to clear
  const keysToClear = [
    'school_data',
    'currentSchoolId',
    'elite_school_data_v3',
    'supabase.auth.token',
    'theme',
    'darkMode',
    'sidebarCollapsed',
    'userPreferences'
  ]
  
  // Clear specific keys
  keysToClear.forEach(key => {
    localStorage.removeItem(key)

  })
  
  // Or clear everything (uncomment if needed)
  // localStorage.clear()
  

}

// Clear everything including Supabase session
export function clearAllStorage() {

  localStorage.clear()

}

// Auto-run if called directly
if (typeof window !== 'undefined') {
  (window as any).clearAppStorage = clearAppStorage;
  (window as any).clearAllStorage = clearAllStorage;

}

