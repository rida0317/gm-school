// src/components/ErrorBoundary.tsx - Global error boundary component

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Ignore specific warnings from third-party scripts/extensions
    const ignoreMessages = [
      'DialogContent requires a DialogTitle',
      'DialogTitle',
      'radix-ui',
    ]
    const shouldIgnore = ignoreMessages.some(msg => 
      error.message?.includes(msg) || error.toString().includes(msg)
    )
    if (shouldIgnore) {
      return
    }

    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Update state with error info
    this.setState({
      error,
      errorInfo
    })

    // Log to console in development
    if (import.meta.env.DEV) {
      
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <h1 className="error-title">Oops! Something went wrong</h1>
            <p className="error-message">
              We're sorry, but something unexpected happened. Don't worry, your data is safe.
            </p>

            <div className="error-actions">
              <button onClick={this.handleRetry} className="btn btn-primary">
                Try Again
              </button>
              <button onClick={this.handleReload} className="btn btn-secondary">
                Reload Page
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="btn btn-outline"
              >
                Go to Dashboard
              </button>
            </div>

            <details className="error-details" style={{ marginTop: '2rem' }}>
              <summary style={{ cursor: 'pointer', color: '#dc2626', fontWeight: 'bold' }}>
                🔍 Click to see error details
              </summary>
              <pre className="error-stack" style={{ 
                background: '#f5f5f5', 
                padding: '1rem', 
                overflow: 'auto',
                fontSize: '0.85rem',
                marginTop: '0.5rem'
              }}>
                {this.state.error?.toString()}
                {'\n\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

