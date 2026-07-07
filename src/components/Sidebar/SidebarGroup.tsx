import React from 'react'
import { clsx } from 'clsx'

interface SidebarGroupProps {
  title?: string
  children: React.ReactNode
  isCollapsed: boolean
  className?: string
}

export const SidebarGroup: React.FC<SidebarGroupProps> = ({
  title,
  children,
  isCollapsed,
  className,
}) => {
  return (
    <div className={clsx('mb-6', className)}>
      {!isCollapsed && title && (
        <h3 className="px-3 mb-2 text-xs font-semibold text-muted uppercase tracking-wider">
          {title}
        </h3>
      )}
      <div className="space-y-1">
        {children}
      </div>
    </div>
  )
}

