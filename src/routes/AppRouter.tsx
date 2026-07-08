import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Loader2 } from 'lucide-react';

// Lazy loaded pages
const Login = lazy(() => import('@/pages/auth/Login'));
const Overview = lazy(() => import('@/pages/dashboard/Overview'));
const StudentsPage = lazy(() => import('@/pages/dashboard/students/StudentsPage'));
const TeachersPage = lazy(() => import('@/pages/dashboard/teachers/TeachersPage'));
const ClassesPage = lazy(() => import('@/pages/dashboard/classes/ClassesPage'));
const FinancePage = lazy(() => import('@/pages/dashboard/finance/FinancePage'));
const SchoolsPage = lazy(() => import('@/pages/dashboard/schools/SchoolsPage'));
const GradesPage = lazy(() => import('@/pages/dashboard/grades/GradesPage'));
const LibraryPage = lazy(() => import('@/pages/dashboard/library/LibraryPage'));

const PageLoader = () => (
  <div className="flex h-[50vh] w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

export function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Public/Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="login" element={<Login />} />
        </Route>

        {/* Protected/Dashboard Routes */}
        <Route path="dashboard" element={<DashboardLayout />}>
          <Route index element={<Overview />} />
          <Route path="schools" element={<SchoolsPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="teachers" element={<TeachersPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="grades" element={<GradesPage />} />
          <Route path="library" element={<LibraryPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
