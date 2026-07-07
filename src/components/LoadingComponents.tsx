// src/components/LoadingComponents.tsx - Reusable loading states

import React from 'react'
import { Loader2 } from 'lucide-react'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
    xl: 'h-16 w-16 border-4'
  }

  return (
    <Loader2
      className={`animate-spin text-blue-600 ${sizeClasses[size]} ${className}`}
    />
  )
}

interface SkeletonProps {
  className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`bg-gray-200 rounded animate-pulse ${className}`} />
)

export const CardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>
    <Skeleton className="h-10 w-32" />
    <Skeleton className="h-3 w-16" />
  </div>
)

export const ChartSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
    <Skeleton className="h-6 w-48 mb-6" />
    <div className="h-[300px] flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  </div>
)

export const PaymentsListSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
    <Skeleton className="h-6 w-48 mb-4" />
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  </div>
)

export const QuickActionsSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
    <Skeleton className="h-6 w-32 mb-4" />
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="p-4 bg-gray-50 rounded-lg space-y-3">
          <Skeleton className="h-8 w-8 rounded-full mx-auto" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  </div>
)

// Full page loading component
export const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center space-y-4">
      <Spinner size="xl" />
      <p className="text-gray-500 text-sm">Chargement en cours...</p>
    </div>
  </div>
)

// Inline loading for sections
export const InlineLoader: React.FC<{ message?: string }> = ({ message = 'Chargement...' }) => (
  <div className="flex items-center justify-center py-8">
    <div className="flex items-center space-x-2 text-gray-500">
      <Spinner size="sm" />
      <span className="text-sm">{message}</span>
    </div>
  </div>
)
