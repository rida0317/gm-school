import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { SidebarItem } from './SidebarItem'
import { SidebarGroup } from './SidebarGroup'
import { Avatar } from '../ui/Avatar'
import { Dropdown, DropdownItem } from '../ui/Dropdown'
import { Tooltip } from '../ui/Tooltip'

interface MenuItem {
  path: string
  label: string
  icon: React.ReactNode
  permission?: string
  badge?: number | string
}

interface MenuGroup {
  title: string
  items: MenuItem[]
}

interface SidebarProps {
  menuGroups: MenuGroup[]
  schoolName?: string
  schoolLogo?: string
  academicYear?: string
  user?: {
    name?: string
    email?: string
    avatar?: string
  }
  onLogout: () => void
  onSettings: () => void
  darkMode: boolean
  onToggleDarkMode: () => void
  className?: string
}

export const Sidebar: React.FC<SidebarProps> = ({
  menuGroups,
  schoolName = 'School Manager',
  schoolLogo,
  academicYear,
  user,
  onLogout,
  onSettings,
  darkMode,
  onToggleDarkMode,
  className,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        className={clsx(
          'fixed top-4 right-4 z-50 p-2 bg-primary text-white rounded-lg shadow-lg lg:hidden',
          isMobileOpen && 'bg-danger'
        )}
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle menu"
      >
        {isMobileOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden animation-fade-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed left-0 top-0 h-full bg-card border-r border-border-light transition-all duration-300 z-40',
          'lg:translate-x-0',
          isCollapsed ? 'w-[70px]' : 'w-[280px]',
          !isMobileOpen && '-translate-x-full lg:translate-x-0',
          className
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className={clsx('p-4 border-b border-border-light', isCollapsed ? 'text-center' : '')}>
            <Link to="/" className="flex items-center gap-3">
              {schoolLogo ? (
                <img
                  src={schoolLogo}
                  alt="Logo"
                  className="w-10 h-10 object-contain rounded-lg"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-secondary to-secondary-hover rounded-lg flex items-center justify-center text-xl">
                  🏫
                </div>
              )}

              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <h1 className="text-base font-bold text-foreground truncate">{schoolName}</h1>
                  {academicYear && (
                    <p className="text-xs text-muted">{academicYear}</p>
                  )}
                </div>
              )}
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin">
            {menuGroups.map((group, groupIndex) => (
              <SidebarGroup
                key={group.title || groupIndex}
                title={group.title}
                isCollapsed={isCollapsed}
              >
                {group.items.map((item) => (
                  <SidebarItem
                    key={item.path}
                    {...item}
                    isCollapsed={isCollapsed}
                  />
                ))}
              </SidebarGroup>
            ))}
          </nav>

          {/* Footer */}
          <div className={clsx('p-3 border-t border-border-light', isCollapsed ? 'text-center' : '')}>
            {/* Dark Mode Toggle */}
            <Tooltip content={darkMode ? 'Light Mode' : 'Dark Mode'} position={isCollapsed ? 'right' : 'top'}>
              <button
                onClick={onToggleDarkMode}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  isCollapsed ? 'justify-center' : '',
                  'text-muted hover:bg-hover hover:text-foreground'
                )}
              >
                <span className="w-5 h-5 flex items-center justify-center text-lg">
                  {darkMode ? '☀️' : '🌙'}
                </span>
                {!isCollapsed && <span className="text-sm font-medium">Dark Mode</span>}
              </button>
            </Tooltip>

            {/* User Menu */}
            <div className={clsx('mt-2', isCollapsed ? 'flex justify-center' : '')}>
              <Dropdown
                trigger={
                  <button
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                      'text-muted hover:bg-hover hover:text-foreground'
                    )}
                  >
                    <Avatar
                      name={user?.name}
                      src={user?.avatar}
                      size={isCollapsed ? 'md' : 'sm'}
                      status="online"
                    />
                    {!isCollapsed && (
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {user?.name || 'User'}
                        </p>
                        <p className="text-xs text-muted truncate">{user?.email}</p>
                      </div>
                    )}
                  </button>
                }
                position={isCollapsed ? 'right' : 'top-right'}
              >
                <div className="p-3 border-b border-border-light">
                  <p className="text-sm font-medium text-foreground">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted truncate">{user?.email}</p>
                </div>
                <DropdownItem
                  icon="⚙️"
                  onClick={onSettings}
                >
                  Settings
                </DropdownItem>
                <DropdownItem divider />
                <DropdownItem
                  icon="🚪"
                  onClick={onLogout}
                  danger
                >
                  Logout
                </DropdownItem>
              </Dropdown>
            </div>

            {/* Collapse Toggle (Desktop Only) */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex w-full items-center justify-center gap-2 mt-2 px-3 py-2 text-muted hover:bg-hover rounded-lg transition-colors"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg
                className={clsx('w-5 h-5 transition-transform duration-300', isCollapsed && 'rotate-180')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

