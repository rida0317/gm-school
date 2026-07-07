import React, { Suspense, lazy } from 'react'
import { useSchoolStore } from '../store/schoolStore'
import { useMonthlyPaymentsStore } from '../store/monthlyPaymentsStore'
import { StatCard } from './Dashboard/StatCard'
import { ChartCard } from './Dashboard/ChartCard'
import { Users, UserCheck, Building2, DollarSign, BookOpen, Calendar, FileText, CreditCard } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useMonthlyPayments } from '../hooks/useMonthlyPayments'

// Lazy load heavy sections for better initial render
const LazyPaymentsSection = lazy(() => import('./Dashboard/LazyPaymentsSection'))
const LazyQuickActions = lazy(() => import('./Dashboard/LazyQuickActions'))

// Loading fallbacks
const PaymentsSectionFallback = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
    <div className="flex items-center justify-between mb-4">
      <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
    </div>
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  </div>
)

const QuickActionsFallback = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
    <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="p-4 bg-gray-50 rounded-lg space-y-3">
          <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse mx-auto" />
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  </div>
)

const DashboardPage: React.FC = () => {
  // Get base data from stores (these are already cached/simple)
  const students = useSchoolStore(state => state.students) || []
  const teachers = useSchoolStore(state => state.teachers) || []
  const classes = useSchoolStore(state => state.classes) || []
  
  // Get academic year from store for filtering
  const academicYear = useMonthlyPaymentsStore(state => state.academicYear)
  
  // Fetch payments using React Query with intelligent caching
  const { data: paymentsData, isLoading: isPaymentsLoading } = useMonthlyPayments(academicYear || undefined)
  const payments = paymentsData?.payments || []

  // Calculate basic stats
  const totalStudents = students?.length || 0
  const totalTeachers = teachers?.length || 0
  const totalClasses = classes?.length || 0

  // Paiements du mois courant
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const monthlyPayments = (payments || []).filter(p => {
    if (!p || !p.paymentDate) return false
    const date = new Date(p.paymentDate)
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  })
  const totalMonthlyPayments = monthlyPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0)

  // Données pour graphique présences (7 derniers jours)
  const attendanceData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short' })
    return {
      name: dayName,
      present: Math.floor(Math.random() * (totalStudents * 0.9)) + Math.floor(totalStudents * 0.6),
      absent: Math.floor(Math.random() * (totalStudents * 0.2)) + 5,
    }
  })

  // Raccourcis rapides
  const quickActions = [
    { icon: <Users size={24} />, label: 'Élèves', onClick: () => window.location.hash = '#/students', color: '#3b82f6' },
    { icon: <UserCheck size={24} />, label: 'Professeurs', onClick: () => window.location.hash = '#/teachers', color: '#22c55e' },
    { icon: <BookOpen size={24} />, label: 'Notes', onClick: () => window.location.hash = '#/grades', color: '#a855f7' },
    { icon: <Calendar size={24} />, label: 'Emploi du temps', onClick: () => window.location.hash = '#/timetable', color: '#f97316' },
    { icon: <Building2 size={24} />, label: 'Classes', onClick: () => window.location.hash = '#/classes', color: '#06b6d4' },
    { icon: <FileText size={24} />, label: 'Bulletins', onClick: () => window.location.hash = '#/report-cards', color: '#ec4899' },
    { icon: <CreditCard size={24} />, label: 'Paiements', onClick: () => window.location.hash = '#/payments', color: '#10b981' },
    { icon: <Calendar size={24} />, label: 'Présences', onClick: () => window.location.hash = '#/attendance', color: '#f59e0b' },
  ]

  // Show minimal spinner only while payments are loading if no data yet
  if (isPaymentsLoading && payments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600" />
          <p className="text-gray-500 text-sm">Chargement du tableau de bord...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Tableau de bord</h1>
        <span className="text-sm text-gray-500">
          Dernière mise à jour: {new Date().toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>

      {/* Cartes Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Élèves total"
          value={totalStudents}
          icon={Users}
          trend="+12 ce mois"
          trendUp={true}
          color="bg-blue-500"
        />
        <StatCard
          title="Professeurs"
          value={totalTeachers}
          icon={UserCheck}
          trend="3 actifs aujourd'hui"
          trendUp={true}
          color="bg-green-500"
        />
        <StatCard
          title="Classes"
          value={totalClasses}
          icon={Building2}
          trend=""
          trendUp={true}
          color="bg-purple-500"
        />
        <StatCard
          title="Paiements du mois"
          value={`${totalMonthlyPayments.toLocaleString('fr-FR')} DH`}
          icon={DollarSign}
          trend={`${monthlyPayments.length} paiements`}
          trendUp={true}
          color="bg-emerald-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graphique Présences */}
        <div className="lg:col-span-2">
          <ChartCard title="Présences des 7 derniers jours">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar dataKey="present" name="Présents" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" name="Absents" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Derniers paiements - Lazy loaded */}
        <Suspense fallback={<PaymentsSectionFallback />}>
          <LazyPaymentsSection payments={payments} />
        </Suspense>
      </div>

      {/* Raccourcis rapides - Lazy loaded */}
      <Suspense fallback={<QuickActionsFallback />}>
        <LazyQuickActions actions={quickActions} />
      </Suspense>
    </div>
  )
}

export default DashboardPage