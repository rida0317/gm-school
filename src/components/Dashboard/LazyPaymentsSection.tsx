// src/components/Dashboard/LazyPaymentsSection.tsx - Lazy loaded recent payments widget

import React from 'react'
import { Link } from 'react-router-dom'
import type { MonthlyPayment } from '../../store/monthlyPaymentsStore'

interface LazyPaymentsSectionProps {
  payments: MonthlyPayment[]
}

// Get the last 5 payments
const getLastPayments = (payments: MonthlyPayment[]) => {
  return [...payments]
    .filter(p => p && p.paymentDate)
    .sort((a, b) => new Date(b.paymentDate!).getTime() - new Date(a.paymentDate!).getTime())
    .slice(0, 5)
}

export const LazyPaymentsSection: React.FC<LazyPaymentsSectionProps> = ({ payments }) => {
  const lastPayments = getLastPayments(payments)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Derniers paiements</h3>
        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
          <span className="text-blue-600 text-sm">💰</span>
        </div>
      </div>
      <div className="space-y-3">
        {lastPayments.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">Aucun paiement récent</p>
        ) : (
          lastPayments.map(payment => (
            <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div>
                <p className="font-medium text-gray-800">{payment.payerName || 'N/A'}</p>
                <p className="text-xs text-gray-500">
                  {new Date(payment.paymentDate || payment.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <span className="font-semibold text-emerald-600">
                {(payment.paidAmount || 0).toLocaleString('fr-FR')} DH
              </span>
            </div>
          ))
        )}
      </div>
      <Link
        to="/payments"
        className="block text-center mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        Voir tous les paiements →
      </Link>
    </div>
  )
}

export default LazyPaymentsSection
