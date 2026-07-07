import React from 'react'
import { clsx } from 'clsx'

interface SearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onClear?: () => void
  autoFocus?: boolean
}

export const Search: React.FC<SearchProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className,
  onClear,
  autoFocus,
}) => {
  return (
    <div className={clsx('relative', className)}>
      {/* Search Icon */}
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg
          className="h-5 w-5 text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Input */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={clsx(
          'w-full pl-10 pr-10 py-2 bg-card border border-border rounded-lg',
          'text-foreground placeholder-muted',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
          'transition-all duration-250'
        )}
      />

      {/* Clear Button */}
      {value && onClear && (
        <button
          onClick={onClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-foreground transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

