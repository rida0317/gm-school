import React from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useHardRefresh } from './hooks/useHardRefresh'
import { AuthProvider } from './store/AuthContext'
import { SchoolDataProvider } from './store/SchoolDataContext'
import ErrorBoundary from './components/ErrorBoundary'
import ToastContainer from './components/ToastContainer'
import { setQueryClient } from './lib/queryClientSingleton'

import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Teachers from './components/Teachers'
import Classes from './components/Classes'
import Subjects from './components/Subjects'
import Salles from './components/Salles'
import Timetable from './components/Timetable'
import Replacements from './components/Replacements'
import Students from './components/Students'
import Grades from './components/Grades'
import Attendance from './components/Attendance'
import MassarGradesAnalytics from './components/MassarGradesAnalytics'
import SettingsExtended from './components/SettingsExtended'
import ReportCards from './components/ReportCards'
import Homework from './components/Homework'
import QRCodeGenerator from './components/QRCodeGenerator'
import QRCodeScanner from './components/QRCodeScanner'
import Library from './components/Library'
import Stock from './components/Stock'
import Login from './components/Auth/Login'
import Signup from './components/Auth/Signup'
import UserManagement from './components/admin/UserManagement'
import MonthlyPayments from './components/MonthlyPayments'
import DashboardPage from './components/DashboardPage'
import './components/Dashboard.css'

// React Query client with optimized caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes cache
      cacheTime: 10 * 60 * 1000, // 10 minutes retention
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
})

// Set global singleton for cross-module access
setQueryClient(queryClient)

function App() {
  useHardRefresh(true)

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <HashRouter>
          <ErrorBoundary>
            <AuthProvider>
              <ErrorBoundary>
                <SchoolDataProvider>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/" element={<Layout />}>
                      <Route index element={<Navigate to="/dashboard" replace />} />
                      <Route path="dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                      <Route path="teachers" element={<ProtectedRoute requiredPermission="canAccessTeachers"><Teachers /></ProtectedRoute>} />
                      <Route path="classes" element={<ProtectedRoute requiredPermission="canAccessClasses"><Classes /></ProtectedRoute>} />
                      <Route path="subjects" element={<ProtectedRoute requiredPermission="canAccessClasses"><Subjects /></ProtectedRoute>} />
                      <Route path="salles" element={<ProtectedRoute requiredPermission="canAccessClasses"><Salles /></ProtectedRoute>} />
                      <Route path="timetable" element={<ProtectedRoute requiredPermission="canAccessTimetable"><Timetable /></ProtectedRoute>} />
                      <Route path="replacements" element={<ProtectedRoute requiredPermission="canAccessReplacements"><Replacements /></ProtectedRoute>} />
                      <Route path="students" element={<ProtectedRoute requiredPermission="canAccessStudents"><Students /></ProtectedRoute>} />
                      <Route path="grades" element={<ProtectedRoute requiredPermission="canAccessGrades"><Grades /></ProtectedRoute>} />
                      <Route path="report-cards" element={<ProtectedRoute requiredPermission="canAccessReportCards"><ReportCards /></ProtectedRoute>} />
                      <Route path="homework" element={<ProtectedRoute requiredPermission="canAccessHomework"><Homework /></ProtectedRoute>} />
                      <Route path="qr-generate" element={<ProtectedRoute requiredPermission="canAccessQRCode"><QRCodeGenerator /></ProtectedRoute>} />
                      <Route path="attendance/scan" element={<ProtectedRoute requiredPermission="canScanQRCode"><QRCodeScanner /></ProtectedRoute>} />
                      <Route path="library" element={<ProtectedRoute requiredPermission="canAccessLibrary"><Library /></ProtectedRoute>} />
                      <Route path="attendance" element={<ProtectedRoute requiredPermission="canAccessStudents"><Attendance /></ProtectedRoute>} />
                      <Route path="massar-analytics" element={<ProtectedRoute requiredPermission="canViewStatistics"><MassarGradesAnalytics /></ProtectedRoute>} />
                      <Route path="settings" element={<ProtectedRoute requiredPermission="canAccessSettings"><SettingsExtended /></ProtectedRoute>} />
                      <Route path="stock" element={<ProtectedRoute requiredPermission="canAccessStock"><Stock /></ProtectedRoute>} />
                      <Route path="payments" element={<ProtectedRoute requiredPermission="canAccessDashboard"><MonthlyPayments /></ProtectedRoute>} />
                      <Route path="users" element={<ProtectedRoute allowedRoles={['admin', 'director']}><UserManagement /></ProtectedRoute>} />
                      {/* Catch all for invalid routes -> Redirect to Dashboard */}
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Route>
                  </Routes>
                  <ToastContainer />
                </SchoolDataProvider>
              </ErrorBoundary>
            </AuthProvider>
          </ErrorBoundary>
        </HashRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}

export default App

