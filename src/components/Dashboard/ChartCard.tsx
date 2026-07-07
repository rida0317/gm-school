import React from 'react'
import { clsx } from 'clsx'

interface ChartCardProps {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  icon,
  children,
  className,
  action,
}) => {
  return (
    <div className={clsx('bg-card rounded-xl border border-border-light shadow-sm p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-10 h-10 rounded-lg bg-primary-light text-primary flex items-center justify-center">
              {icon}
            </div>
          )}
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        </div>
        
        {action && <div>{action}</div>}
      </div>
      
      {children}
    </div>
  )
}

