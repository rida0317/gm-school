import React, { useState, useRef, useEffect } from 'react'
import { clsx } from 'clsx'

interface DropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
  className?: string
  closeOnClick?: boolean
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  children,
  position = 'bottom-right',
  className,
  closeOnClick = true,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const positionStyles = {
    'bottom-left': 'bottom-full left-0 mb-2',
    'bottom-right': 'bottom-full right-0 mb-2',
    'top-left': 'top-full left-0 mt-2',
    'top-right': 'top-full right-0 mt-2',
  }

  const handleTriggerClick = () => {
    setIsOpen(!isOpen)
  }

  const handleChildClick = () => {
    if (closeOnClick) {
      setIsOpen(false)
    }
  }

  return (
    <div ref={dropdownRef} className="relative inline-block">
      <div onClick={handleTriggerClick}>{trigger}</div>
      
      {isOpen && (
        <div
          className={clsx(
            'absolute z-50 min-w-[200px] bg-card rounded-lg shadow-lg border border-border-light animation-slide-down',
            positionStyles[position],
            className
          )}
        >
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement, {
                onClick: (e: React.MouseEvent) => {
                  child.props.onClick?.(e)
                  handleChildClick()
                },
              })
            }
            return child
          })}
        </div>
      )}
    </div>
  )
}

interface DropdownItemProps {
  children: React.ReactNode
  icon?: React.ReactNode
  divider?: boolean
  danger?: boolean
  onClick?: () => void
  className?: string
}

export const DropdownItem: React.FC<DropdownItemProps> = ({
  children,
  icon,
  divider = false,
  danger = false,
  onClick,
  className,
}) => {
  if (divider) {
    return <div className="my-2 border-t border-border-light" />
  }

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full px-4 py-2 flex items-center gap-3 text-sm transition-colors',
        danger 
          ? 'text-danger hover:bg-red-50 dark:hover:bg-red-900/20' 
          : 'text-foreground hover:bg-hover',
        className
      )}
    >
      {icon && <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{icon}</span>}
      {children}
    </button>
  )
}

