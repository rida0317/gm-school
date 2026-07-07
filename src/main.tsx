import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Load saved language and apply on startup
try {
  const savedLanguage = localStorage.getItem('school_language') || 'en'
  document.documentElement.lang = savedLanguage
  document.documentElement.dir = savedLanguage === 'ar' ? 'rtl' : 'ltr'
  document.body.style.direction = savedLanguage === 'ar' ? 'rtl' : 'ltr'

  // Apply appropriate font
  if (savedLanguage === 'ar') {
    document.body.style.fontFamily = "'Tajawal', 'Segoe UI', Tahoma, sans-serif"
  } else if (savedLanguage === 'fr') {
    document.body.style.fontFamily = "'Roboto', 'Segoe UI', sans-serif"
  } else {
    document.body.style.fontFamily = "'Inter', 'Segoe UI', sans-serif"
  }
} catch (error) {
  console.warn('⚠️ Language initialization failed:', error)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

