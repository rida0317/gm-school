import React from 'react'
import { clsx } from 'clsx'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  helperText?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, rightIcon, helperText, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            className={clsx(
              'w-full px-4 py-2 bg-card border rounded-lg',
              'text-foreground placeholder-muted',
              'focus:outline-none focus:ring-2 focus:border-transparent',
              'transition-all duration-250',
              error 
                ? 'border-danger focus:ring-danger/20' 
                : 'border-border focus:ring-primary/20',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted">
              {rightIcon}
            </div>
          )}
        </div>
        
        {error && (
          <p className="mt-1 text-sm text-danger">{error}</p>
        )}
        
        {helperText && !error && (
          <p className="mt-1 text-sm text-muted">{helperText}</p>
        )}
      </div>
    )
  }
)

Input.display_name = 'Input'

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, helperText, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {label}
          </label>
        )}
        
        <textarea
          ref={ref}
          className={clsx(
            'w-full px-4 py-2 bg-card border rounded-lg',
            'text-foreground placeholder-muted',
            'focus:outline-none focus:ring-2 focus:border-transparent',
            'transition-all duration-250 resize-y',
            error 
              ? 'border-danger focus:ring-danger/20' 
              : 'border-border focus:ring-primary/20',
            className
          )}
          {...props}
        />
        
        {error && (
          <p className="mt-1 text-sm text-danger">{error}</p>
        )}
        
        {helperText && !error && (
          <p className="mt-1 text-sm text-muted">{helperText}</p>
        )}
      </div>
    )
  }
)

TextArea.display_name = 'TextArea'

