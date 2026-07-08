import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { Tooltip } from '../ui/Tooltip'

interface SidebarItemProps {
  icon: React.ReactNode
  label: string
  path: string
  isCollapsed: boolean
  isActive?: boolean
  badge?: number | string
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  icon,
  label,
  path,
  isCollapsed,
  isActive,
  badge,
}) => {
  const location = useLocation()
  const active = isActive ?? location.pathname === path

  const item = (
    <Link
      to={path}
      className={clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-250 group',
        isCollapsed ? 'justify-center' : 'justify-start',
        active
          ? 'bg-primary text-white shadow-md'
          : 'text-muted hover:bg-hover hover:text-foreground'
      )}
    >
      <span
        className={clsx(
          'flex-shrink-0 w-5 h-5 flex items-center justify-center',
          active ? 'text-white' : 'text-current'
        )}
      >
        {icon}
      </span>

      {!isCollapsed && (
        <>
          <span className={clsx('text-sm font-medium flex-1', active && 'font-semibold')}>
            {label}
          </span>

          {badge && (
            <span
              className={clsx(
                'px-2 py-0.5 text-xs rounded-full',
                active
                  ? 'bg-white/20 text-white'
                  : 'bg-danger text-white'
              )}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  )

  if (isCollapsed) {
    return (
      <Tooltip content={label} position="right">
        {item}
      </Tooltip>
    )
  }

  return item
}

