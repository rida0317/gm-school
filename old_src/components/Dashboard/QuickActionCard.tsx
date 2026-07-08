import React from 'react'
import { clsx } from 'clsx'

interface QuickActionCardProps {
  title: string
  icon: React.ReactNode
  color: string
  onClick: () => void
  className?: string
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  icon,
  color,
  onClick,
  className,
}) => {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'group flex flex-col items-center justify-center p-6 rounded-xl border-2 border-border-light',
        'hover:border-primary hover:shadow-lg hover:-translate-y-1',
        'transition-all duration-250',
        className
      )}
    >
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform duration-250"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {icon}
      </div>
      <span className="text-sm font-medium text-foreground text-center">{title}</span>
    </button>
  )
}

