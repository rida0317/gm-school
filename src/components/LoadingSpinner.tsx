// src/components/LoadingSpinner.tsx - Loading spinner component

import React from 'react'
import './LoadingSpinner.css'

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  text?: string
  className?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  text, 
  className 
}) => {
  return (
    <div className={`loading-spinner ${className || ''} loading-spinner--${size}`}>
      <div className="loading-spinner__icon">
        <div className="spinner"></div>
      </div>
      {text && (
        <div className="loading-spinner__text">{text}</div>
      )}
    </div>
  )
}

export default LoadingSpinner

