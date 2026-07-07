// src/config/permissions.ts - Configuration des permissions par rôle

import type { UserRole } from '../types'

export interface Permissions {
  // Navigation - Modules
  canAccessDashboard: boolean
  canAccessTeachers: boolean
  canAccessClasses: boolean
  canAccessStudents: boolean
  canAccessTimetable: boolean
  canAccessReplacements: boolean
  canAccessGrades: boolean
  canAccessHomework: boolean
  canAccessQRCode: boolean
  canAccessGamification: boolean
  canAccessPayments: boolean
  canAccessMonthlyPayments: boolean
  canAccessLibrary: boolean
  canAccessReportCards: boolean
  canAccessAnalytics: boolean
  canAccessSettings: boolean
  canAccessStock: boolean

  // Actions
  canCreateTeacher: boolean
  canCreateClass: boolean
  canCreateStudent: boolean
  canEditGrades: boolean
  canRecordPayment: boolean
  canPrintReceipt: boolean
  canScanQRCode: boolean
  canEditTimetable: boolean
  canEditSettings: boolean
  canDeleteData: boolean

  // Vue
  canViewAllStudents: boolean
  canViewAllTeachers: boolean
  canViewAllPayments: boolean
  canViewStatistics: boolean
  canViewReports: boolean
}

// Permissions par défaut pour chaque rôle
export const PERMISSIONS: Record<UserRole, Permissions> = {
  // ========== ADMIN ==========
  admin: {
    // Navigation
    canAccessDashboard: true,
    canAccessTeachers: true,
    canAccessClasses: true,
    canAccessStudents: true,
    canAccessTimetable: true,
    canAccessReplacements: true,
    canAccessGrades: true,
    canAccessHomework: true,
    canAccessQRCode: true,
    canAccessGamification: true,
    canAccessPayments: true,
    canAccessMonthlyPayments: true,
    canAccessLibrary: true,
    canAccessReportCards: true,
    canAccessAnalytics: true,
    canAccessSettings: true,
    canAccessStock: true,
    
    // Actions
    canCreateTeacher: true,
    canCreateClass: true,
    canCreateStudent: true,
    canEditGrades: true,
    canRecordPayment: true,
    canPrintReceipt: true,
    canScanQRCode: true,
    canEditTimetable: true,
    canEditSettings: true,
    canDeleteData: true,
    
    // Vue
    canViewAllStudents: true,
    canViewAllTeachers: true,
    canViewAllPayments: true,
    canViewStatistics: true,
    canViewReports: true
  },
  
  // ========== DIRECTEUR (Mudir) ==========
  director: {
    // Navigation
    canAccessDashboard: true,
    canAccessTeachers: true,
    canAccessClasses: true,
    canAccessStudents: true,
    canAccessTimetable: true,
    canAccessReplacements: true,
    canAccessGrades: true,
    canAccessHomework: true,
    canAccessQRCode: true,
    canAccessGamification: true,
    canAccessPayments: true,
    canAccessMonthlyPayments: true,
    canAccessLibrary: true,
    canAccessReportCards: true,
    canAccessAnalytics: true,
    canAccessSettings: true,
    canAccessStock: true,
    
    // Actions
    canCreateTeacher: true,
    canCreateClass: true,
    canCreateStudent: true,
    canEditGrades: true,
    canRecordPayment: true,
    canPrintReceipt: true,
    canScanQRCode: true,
    canEditTimetable: true,
    canEditSettings: true,
    canDeleteData: true,
    
    // Vue
    canViewAllStudents: true,
    canViewAllTeachers: true,
    canViewAllPayments: true,
    canViewStatistics: true,
    canViewReports: true
  },
  
  // ========== PROFESSEUR (Ostad) ==========
  teacher: {
    // Navigation
    canAccessDashboard: true,
    canAccessTeachers: false,
    canAccessClasses: true,
    canAccessStudents: true,
    canAccessTimetable: true,
    canAccessReplacements: true,
    canAccessGrades: true,
    canAccessHomework: true,
    canAccessQRCode: false,
    canAccessGamification: false,
    canAccessPayments: false,
    canAccessMonthlyPayments: false,
    canAccessLibrary: false,
    canAccessReportCards: true,
    canAccessAnalytics: false,
    canAccessSettings: false,
    canAccessStock: false,
    
    // Actions
    canCreateTeacher: false,
    canCreateClass: false,
    canCreateStudent: false,
    canEditGrades: true,
    canRecordPayment: false,
    canPrintReceipt: false,
    canScanQRCode: false,
    canEditTimetable: false,
    canEditSettings: false,
    canDeleteData: false,
    
    // Vue
    canViewAllStudents: false,
    canViewAllTeachers: false,
    canViewAllPayments: false,
    canViewStatistics: false,
    canViewReports: false
  },
  
  // ========== HARIS L3AM (Garde) ==========
  guard: {
    // Navigation
    canAccessDashboard: true,
    canAccessTeachers: true,
    canAccessClasses: true,
    canAccessStudents: true,
    canAccessTimetable: true,
    canAccessReplacements: true,
    canAccessGrades: true,
    canAccessHomework: true,
    canAccessQRCode: true,
    canAccessGamification: true,
    canAccessPayments: false, // ❌ Ne peut pas voir les paiements
    canAccessMonthlyPayments: false, // ❌ Ne peut pas voir les paiements mensuels
    canAccessLibrary: true,
    canAccessReportCards: true,
    canAccessAnalytics: true,
    canAccessSettings: false,
    canAccessStock: true,

    // Actions
    canCreateTeacher: false,
    canCreateClass: false,
    canCreateStudent: false,
    canEditGrades: false, // ❌ Ne peut pas modifier les notes
    canRecordPayment: false,
    canPrintReceipt: false,
    canScanQRCode: true, // ✅ Peut scanner QR
    canEditTimetable: false,
    canEditSettings: false,
    canDeleteData: false,
    
    // Vue
    canViewAllStudents: true, // ✅ Peut voir tous les élèves
    canViewAllTeachers: true, // ✅ Peut voir tous les professeurs
    canViewAllPayments: false, // ❌ Ne peut pas voir les paiements
    canViewStatistics: true, // ✅ Peut voir les statistiques
    canViewReports: true // ✅ Peut voir les rapports
  },
  
  // ========== ASSISTANTE ==========
  assistant: {
    // Navigation
    canAccessDashboard: true,
    canAccessTeachers: false,
    canAccessClasses: true,
    canAccessStudents: true,
    canAccessTimetable: false,
    canAccessReplacements: false,
    canAccessGrades: false, // ❌ Ne peut pas voir les notes
    canAccessHomework: false,
    canAccessQRCode: false,
    canAccessGamification: false,
    canAccessPayments: true, // ✅ Peut voir les paiements
    canAccessMonthlyPayments: true, // ✅ Peut voir les paiements mensuels
    canAccessLibrary: false,
    canAccessReportCards: false,
    canAccessAnalytics: true, // ✅ Peut voir les statistiques de paiement
    canAccessSettings: false,
    canAccessStock: true,
    
    // Actions
    canCreateTeacher: false,
    canCreateClass: false,
    canCreateStudent: false,
    canEditGrades: false,
    canRecordPayment: true, // ✅ Peut enregistrer les paiements
    canPrintReceipt: true, // ✅ Peut imprimer les reçus
    canScanQRCode: false,
    canEditTimetable: false,
    canEditSettings: false,
    canDeleteData: false,
    
    // Vue
    canViewAllStudents: true,
    canViewAllTeachers: false,
    canViewAllPayments: true, // ✅ Peut voir tous les paiements
    canViewStatistics: true, // ✅ Peut voir les statistiques de paiement
    canViewReports: false
  }
}

// Helper function pour vérifier les permissions
export const hasPermission = (role: UserRole, permission: keyof Permissions): boolean => {
  return PERMISSIONS[role]?.[permission] ?? false
}

// Helper function pour vérifier si un rôle a accès à un module
export const canAccessModule = (role: UserRole, module: string): boolean => {
  const permissionKey = `canAccess${module}` as keyof Permissions
  return hasPermission(role, permissionKey)
}

// Helper function pour vérifier le rôle
export const isRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(userRole)
}

// Helper function pour vérifier si l'utilisateur est admin ou directeur
export const isSuperUser = (role: UserRole): boolean => {
  return role === 'admin' || role === 'director'
}

