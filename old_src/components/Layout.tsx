// src/components/Layout.tsx - Main application layout with sidebar

import React, { useState, useEffect } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { useSchoolStore } from '../store/schoolStore'

import { hasPermission } from '../config/permissions'
import NotificationBell from './NotificationBell'
import { translations } from '../utils/translations'
import SchoolSwitcher from './SchoolSwitcher'
import { useAutoLogout } from '../hooks/useAutoLogout'
import './SidebarFooter.css'

// SVG Icons Components
const DashboardIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>;
const AnalyticsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>;
const TeachersIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>;
const ClassesIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>;
const SubjectsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>;
const SallesIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>;
const TimetableIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>;
const ReplacementsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>;
const StudentsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>;
const AttendanceIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>;
const GradesIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41z"/></svg>;
const BulletinsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>;
const DevoirsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>;
const QRCodeIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h6v6H3V3zm2 2v2h2V5H5zm8-2h6v6h-6V3zm2 2v2h2V5h-2zM3 13h6v6H3v-6zm2 2v2h2v-2H5zm13-2h3v2h-3v-2zm-3 0h2v2h-2v-2zm-3 6h2v2h-2v-2zm3 0h2v2h-2v-2zm3 0h3v2h-3v-2z"/></svg>;
const VisioIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>;
const LibraryIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg>;
const StockIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>;
const UsersIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>;
const PaymentsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.56-3.5 3.55 0 2.27 2.25 3.15 5 3.15 2.88 0 4.5-1.02 4.5-3.15 0-1.54-1.24-2.09-2.76-2.57V9.1c1.07.36 2.49.86 4.19.86 1.37 0 2.52-.44 2.8-1.28.3-.89.02-1.69-.8-2.28-1.06-.77-2.79-.93-4.19-.34v2.3c1.34.49 2.5 1.24 2.5 2.64 0 1.03-.81 1.71-2.41 1.71zm2.21-4.9h2.2c.02-1.14-.52-1.94-1.74-1.94-1.1 0-1.8.72-1.96 1.94zM6 14.5c0-2.63 2.24-4.23 5.27-4.23 3.02 0 5.23 1.6 5.23 4.23s-2.21 4.27-5.23 4.27c-3.03 0-5.27-1.64-5.27-4.27z"/></svg>;
const SettingsIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>;
const ChevronDownIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>;
const MenuIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-4h18V9H3v2z"/></svg>;
const CloseIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>;

const Layout: React.FC = () => {
  const [darkMode, setDarkMode] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const { user, logout, userData, hasPermission: checkPermission } = useAuth()
  const { schoolName, logo, academicYear } = useSchoolStore()

  const t = (key: string) => translations[key]?.fr || key
  const dir = 'ltr'
  const location = useLocation()
  const navigate = useNavigate()

  // 🔒 Auto-logout on inactivity (1 min) and tab close
  useAutoLogout()

  // Initialize schools when user logs in


  const displaySchoolName = schoolName || 'School Manager'
  const displayLogo = logo
  const displayAcademicYear = academicYear

  // Menu items groups with required permissions
  const menuGroups = [
    {
      title: 'Général',
      items: [
        { path: '/dashboard', label: t('nav.dashboard'), icon: <DashboardIcon />, permission: 'canAccessDashboard' },
        { path: '/analytics', label: t('nav.analytics'), icon: <AnalyticsIcon />, permission: 'canAccessAnalytics' },
      ]
    },
    {
      title: 'Académique',
      items: [
        { path: '/teachers', label: t('nav.teachers'), icon: <TeachersIcon />, permission: 'canAccessTeachers' },
        { path: '/classes', label: t('nav.classes'), icon: <ClassesIcon />, permission: 'canAccessClasses' },
        { path: '/subjects', label: t('nav.subjects'), icon: <SubjectsIcon />, permission: 'canAccessClasses' },
        { path: '/salles', label: t('nav.salles'), icon: <SallesIcon />, permission: 'canAccessClasses' },
        { path: '/timetable', label: t('nav.timetable'), icon: <TimetableIcon />, permission: 'canAccessTimetable' },
        { path: '/replacements', label: t('nav.replacements'), icon: <ReplacementsIcon />, permission: 'canAccessReplacements' },
      ]
    },
    {
      title: 'Élèves & Suivi',
      items: [
        { path: '/students', label: t('nav.students'), icon: <StudentsIcon />, permission: 'canAccessStudents' },
        { path: '/attendance', label: t('nav.attendance'), icon: <AttendanceIcon />, permission: 'canAccessStudents' },
        { path: '/grades', label: t('nav.grades'), icon: <GradesIcon />, permission: 'canAccessGrades' },
        { path: '/report-cards', label: 'Bulletins', icon: <BulletinsIcon />, permission: 'canAccessReportCards' },
        { path: '/homework', label: 'Devoirs', icon: <DevoirsIcon />, permission: 'canAccessHomework' },
      ]
    },
    {
      title: 'Outils',
      items: [
        { path: '/video', label: 'Visio', icon: <VisioIcon />, permission: 'canAccessTimetable' },
        { path: '/library', label: 'Bibliothèque', icon: <LibraryIcon />, permission: 'canAccessLibrary' },
        { path: '/stock', label: 'Stock', icon: <StockIcon />, permission: 'canAccessStock' },
        { path: '/qr-generate', label: 'QR Codes', icon: <QRCodeIcon />, permission: 'canAccessQRCode' },
      ]
    },
    {
      title: 'Finance',
      items: [
        { path: '/payments', label: 'Paiements', icon: <PaymentsIcon />, permission: 'canAccessDashboard' },
      ]
    },
    {
      title: 'Système',
      items: [
        { path: '/users', label: 'Utilisateurs', icon: <UsersIcon />, permission: 'canAccessSettings' },
        { path: '/settings', label: 'Paramètres', icon: <SettingsIcon />, permission: 'canAccessSettings' },
      ]
    }
  ]

  // Filter groups based on user permissions
  const filteredGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // 🛡️ Always show if user is admin or director (master override)
      if (userData?.role === 'admin' || userData?.role === 'director') return true
      
      // 🛡️ If userData is not fully loaded yet, show items by default to avoid empty sidebar
      // This is crucial for initial mobile loads
      if (!userData || !userData.role) return true
      
      // 🛡️ Check specific permission if defined
      if (item.permission) {
        return checkPermission(item.permission as any)
      }
      
      return true
    })
  })).filter(group => group.items.length > 0)

  const handleLogout = async () => {

    // Clear ALL storage first

    localStorage.clear()
    
    // Call logout (will also clear)
    await logout()

    
    // Navigate to login
    navigate('/login', { replace: true })
  }

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    document.body.classList.toggle('dark-mode')
  }

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const handleUserMenuClick = () => {
    setUserMenuOpen(!userMenuOpen)
    setActiveDropdown(null)
  }

  const handleProfileClick = () => {
    navigate('/settings')
    setUserMenuOpen(false)
  }

  const handleLogoutClick = async () => {
    await handleLogout()
    setUserMenuOpen(false)
  }

  const handleGroupClick = (groupTitle: string) => {
    setActiveDropdown(activeDropdown === groupTitle ? null : groupTitle)
  }

  // Close all menus when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.sidebar-container') && !target.closest('.top-bar')) {
        setUserMenuOpen(false)
        setActiveDropdown(null)
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [])

  return (
    <div className={`app-container ${darkMode ? 'dark-mode' : ''}`} dir={dir}>
      {/* Main Layout */}
      <div className="main-wrapper">
        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div
            className="mobile-menu-overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`sidebar-container ${(sidebarCollapsed && !mobileMenuOpen) ? 'sidebar-collapsed' : ''} ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
          <div className="sidebar-header">
            {/* Logo + School Info */}
            <div className="sidebar-brand-section">
              <div className="sidebar-brand">
                {displayLogo ? (
                  <img src={displayLogo} alt="Logo" className="sidebar-logo" />
                ) : (
                  <div className="sidebar-logo-icon">🏫</div>
                )}
                {!sidebarCollapsed && (
                  <div className="sidebar-school-info">
                    {displayAcademicYear && (
                      <span className="sidebar-year-badge">{displayAcademicYear}</span>
                    )}
                    <span className="sidebar-title">{displaySchoolName}</span>
                  </div>
                )}
              </div>
            </div>
            {/* Mobile Menu Toggle Button (inside sidebar header, right side) */}
            <button
              className="mobile-menu-toggle-btn sidebar-mobile-close"
              onClick={(e) => {
                e.stopPropagation()
                setMobileMenuOpen(!mobileMenuOpen)
              }}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
            <button
              className="sidebar-collapse-btn"
              onClick={(e) => {
                e.stopPropagation()
                toggleSidebar()
              }}
              title={sidebarCollapsed ? 'Expand' : 'Collapse'}
            >
              {sidebarCollapsed ? '→' : '←'}
            </button>
          </div>

          <nav className="sidebar-nav">
            {filteredGroups.map((group) => (
              <div key={group.title} className="sidebar-group">
                {(!sidebarCollapsed || mobileMenuOpen) && (
                  <div className="sidebar-group-title">{group.title}</div>
                )}
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`sidebar-item ${isActive ? 'active' : ''}`}
                      style={isActive ? {
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        color: '#ffffff',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                      } : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                      title={sidebarCollapsed ? item.label : ''}
                    >
                      <span className="sidebar-item-icon" style={isActive ? { color: '#ffffff' } : undefined}>{item.icon}</span>
                      {(!sidebarCollapsed || mobileMenuOpen) && (
                        <span className="sidebar-item-label" style={isActive ? { color: '#ffffff', fontWeight: 600 } : undefined}>{item.label}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Sidebar Footer - School Switcher Only */}
          <div className="sidebar-footer">
            <SchoolSwitcher />
          </div>
        </aside>

        {/* Main Content */}
        <main className={`main-content ${sidebarCollapsed ? 'main-expanded' : ''}`}>
          {/* Top Bar - User Actions (Outside Sidebar) */}
          <div className="top-user-actions">
            {!mobileMenuOpen && (
              <button
                className="mobile-menu-toggle-btn mobile-menu-open-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setMobileMenuOpen(!mobileMenuOpen)
                }}
                aria-label="Open menu"
              >
                <MenuIcon />
              </button>
            )}
            <button onClick={toggleDarkMode} className="top-action-btn" title={darkMode ? 'Light Mode' : 'Dark Mode'}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            <NotificationBell />
            <div className="user-menu-container">
              <button
                className="user-avatar-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleUserMenuClick()
                }}
              >
                <span className="user-avatar">
                  {(user?.display_name || user?.email || 'U')[0].toUpperCase()}
                </span>
              </button>

              {userMenuOpen && (
                <div className="user-menu-dropdown top-user-dropdown">
                  <div className="user-menu-header">
                    <div className="user-menu-avatar">
                      {(user?.display_name || user?.email || 'U')[0].toUpperCase()}
                    </div>
                    <div className="user-menu-info">
                      <div className="user-menu-name">{user?.display_name || user?.email}</div>
                      <div className="user-menu-email">{user?.email}</div>
                      <div className="user-menu-role">{userData?.role || 'User'}</div>
                    </div>
                  </div>

                  <div className="user-menu-divider"></div>

                  <div className="user-menu-footer">
                    <button className="user-menu-btn" onClick={handleProfileClick}>
                      ⚙️ {t('nav.settings')}
                    </button>
                    <button className="user-menu-btn logout" onClick={handleLogoutClick}>
                      🚪 {t('nav.logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="page-content">
            <Outlet />
          </div>
        </main>

        {/* Copyright Footer */}
        <footer className="copyright-footer">
          <div className="footer-content">
            <p className="copyright-text">
              <span className="copyright-year">© {new Date().getFullYear()} Developed by </span>
              <span className="developer-name">Mohamed Reda Nahlaoui</span>
              <span className="footer-separator"> • </span>
              <span className="footer-contact-item">
                Email: <a href="mailto:nahlaoui17@gmail.com" className="footer-link">nahlaoui17@gmail.com</a>
              </span>
              <span className="footer-separator"> • </span>
              <span className="footer-contact-item">
                Phone: <a href="tel:+212612450137" className="footer-link">0612450137</a>
              </span>
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default Layout

