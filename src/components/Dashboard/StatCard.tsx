import React from 'react'
import { clsx } from 'clsx'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  color: 'primary' | 'success' | 'warning' | 'danger'
  className?: string
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  color,
  className,
}) => {
  const colors = {
    primary: 'bg-primary-light text-primary',
    success: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    danger: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <div
      className={clsx(
        'bg-card rounded-xl p-6 border border-border-light shadow-sm hover:shadow-md transition-all duration-250',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          
          {trend && (
            <div className="flex items-center gap-1">
              <svg
                className={clsx('w-4 h-4', trend.isPositive ? 'text-green-500' : 'text-red-500')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {trend.isPositive ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                )}
              </svg>
              <span className={clsx('text-sm font-medium', trend.isPositive ? 'text-green-500' : 'text-red-500')}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-sm text-muted">vs last month</span>
            </div>
          )}
        </div>

        <div className={clsx('w-14 h-14 rounded-xl flex items-center justify-center', colors[color])}>
          <span className="w-7 h-7">{icon}</span>
        </div>
      </div>
    </div>
  )
}

