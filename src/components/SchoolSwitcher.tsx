// src/components/SchoolSwitcher.tsx - School selector component

import React from 'react'
import { useAuth } from '../store/AuthContext'
import './SchoolSwitcher.css'

const SchoolSwitcher: React.FC = () => {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return null
}

export default SchoolSwitcher