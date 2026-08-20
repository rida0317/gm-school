'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

export type StatCardColor = 'cyan' | 'blue' | 'orange' | 'gold' | 'emerald' | 'amber' | 'rose' | 'purple';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: StatCardColor;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  trend,
}: StatCardProps) {
  const colorStyles: Record<StatCardColor, string> = {
    cyan: 'from-sky-500/10 via-sky-500/5 to-transparent text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-900/50 hover:border-sky-400',
    blue: 'from-blue-600/10 via-blue-600/5 to-transparent text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50 hover:border-blue-400',
    orange: 'from-orange-500/10 via-orange-500/5 to-transparent text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900/50 hover:border-orange-400',
    gold: 'from-amber-500/10 via-amber-500/5 to-transparent text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 hover:border-amber-400',
    amber: 'from-amber-500/10 via-amber-500/5 to-transparent text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 hover:border-amber-400',
    emerald: 'from-emerald-500/10 via-emerald-500/5 to-transparent text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-400',
    rose: 'from-rose-500/10 via-rose-500/5 to-transparent text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:border-rose-400',
    purple: 'from-purple-500/10 via-purple-500/5 to-transparent text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/50 hover:border-purple-400',
  };

  const iconBgStyles: Record<StatCardColor, string> = {
    cyan: 'bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/30',
    blue: 'bg-gradient-to-tr from-blue-700 to-sky-500 text-white shadow-lg shadow-blue-600/30',
    orange: 'bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-lg shadow-orange-500/30',
    gold: 'bg-gradient-to-tr from-amber-600 to-yellow-400 text-white shadow-lg shadow-amber-500/30',
    amber: 'bg-gradient-to-tr from-amber-600 to-yellow-400 text-white shadow-lg shadow-amber-500/30',
    emerald: 'bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-lg shadow-emerald-500/30',
    rose: 'bg-gradient-to-tr from-rose-600 to-pink-500 text-white shadow-lg shadow-rose-500/30',
    purple: 'bg-gradient-to-tr from-purple-700 to-indigo-500 text-white shadow-lg shadow-purple-500/30',
  };

  return (
    <div
      className={`relative overflow-hidden p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900/90 border bg-gradient-to-br ${colorStyles[color]} shadow-xs hover:shadow-xl transition-all duration-300 group h-full min-h-[145px] flex flex-col justify-between`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1 leading-tight break-words">
            {title}
          </p>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-snug break-words">
            {value}
          </h3>

          {subtitle && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-tight break-words">
              {subtitle}
            </p>
          )}

          {trend && (
            <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  trend.isPositive
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                }`}
              >
                {trend.isPositive ? '↑' : '↓'} {trend.value}
              </span>
              <span className="text-slate-400 text-[10px] leading-tight">vs mois d&apos;avant</span>
            </div>
          )}
        </div>

        <div
          className={`p-2.5 sm:p-3 rounded-2xl ${iconBgStyles[color]} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shrink-0`}
        >
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      </div>
    </div>
  );
}
