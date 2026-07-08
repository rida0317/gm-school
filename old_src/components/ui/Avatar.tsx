import React from 'react'
import { clsx } from 'clsx'

interface AvatarProps {
  src?: string
  alt?: string
  name?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  status?: 'online' | 'offline' | 'busy' | 'away'
  className?: string
  onClick?: () => void
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  name,
  size = 'md',
  status,
  className,
  onClick,
}) => {
  const sizes = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
  }

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    busy: 'bg-red-500',
    away: 'bg-yellow-500',
  }

  const statusSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4',
  }

  const getInitials = (name?: string) => {
    if (!name) return '?'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div
      className={clsx('relative inline-flex items-center justify-center', className)}
      onClick={onClick}
    >
      {src ? (
        <img
          src={src}
          alt={alt || name || 'Avatar'}
          className={clsx('rounded-full object-cover', sizes[size])}
        />
      ) : (
        <div
          className={clsx(
            'rounded-full bg-gradient-to-br from-secondary to-secondary-hover flex items-center justify-center font-bold text-primary',
            sizes[size]
          )}
        >
          {getInitials(name)}
        </div>
      )}
      
      {status && (
        <span
          className={clsx(
            'absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-card',
            statusSizes[size],
            statusColors[status]
          )}
        />
      )}
    </div>
  )
}

