// src/components/Dashboard/LazyQuickActions.tsx - Lazy loaded quick actions widget

import React from 'react'

interface QuickAction {
  icon: React.ReactNode
  label: string
  onClick: () => void
  color: string
}

interface LazyQuickActionsProps {
  actions: QuickAction[]
}

export const LazyQuickActions: React.FC<LazyQuickActionsProps> = ({ actions }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Accès rapides</h3>
        <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
          <span className="text-purple-600 text-sm">⚡</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 hover:shadow-md transition-all group"
          >
            <div 
              className="rounded-full p-3 mb-2 group-hover:scale-110 transition-transform"
              style={{ backgroundColor: `${action.color}20` }}
            >
              <span style={{ color: action.color }}>
                {action.icon}
              </span>
            </div>
            <span className="text-xs font-medium text-gray-700 text-center">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default LazyQuickActions
