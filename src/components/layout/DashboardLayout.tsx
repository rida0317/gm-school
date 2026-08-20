'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { hasRouteAccess, ROLE_CONFIGS } from '@/lib/permissions';
import { ShieldAlert, ArrowLeft, Lock, Loader2 } from 'lucide-react';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { dir } = useI18n();
  const { user, profile, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  // Loading state: Show a clean, branded loading screen while checking authentication
  if (loading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-4 animate-in fade-in duration-500">
          <div className="w-16 h-16 rounded-2xl bg-white/10 p-2.5 backdrop-blur-md border border-white/20 shadow-xl flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="GM School"
              width={48}
              height={48}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <div className="flex items-center gap-2 text-sky-400 text-sm font-semibold">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Vérification de session...</span>
          </div>
        </div>
      </div>
    );
  }

  const isPendingApproval = profile && profile.is_active === false;
  const currentRole = profile?.role || 'TEACHER';
  const roleConfig = ROLE_CONFIGS[currentRole as keyof typeof ROLE_CONFIGS] || ROLE_CONFIGS.TEACHER;
  const isAllowed = hasRouteAccess(currentRole, pathname);

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 flex flex-col antialiased print:bg-white print:text-black print:min-h-0 relative">
      {/* 1. School building background image with slight blur */}
      <div
        className="fixed inset-0 pointer-events-none -z-20 bg-cover bg-center bg-no-repeat filter blur-[2px] scale-105"
        style={{ backgroundImage: "url('/school-bg.png')" }}
        aria-hidden="true"
      />

      {/* 2. Soft semi-transparent tint overlay for perfect text contrast & readability */}
      <div
        className="fixed inset-0 pointer-events-none -z-10 bg-slate-100/85 dark:bg-slate-950/90"
        aria-hidden="true"
      />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col ${dir === 'rtl' ? 'lg:pr-72 lg:pl-0' : 'lg:pl-72 lg:pr-0'} print:pl-0 print:pr-0 print:m-0 transition-all`}>
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto print:p-0 print:m-0 print:max-w-none print:w-full animate-in fade-in duration-300">
          {isPendingApproval ? (
            <div className="min-h-[60vh] flex items-center justify-center p-4">
              <div className="max-w-md w-full p-8 rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-amber-300 dark:border-amber-900/50 shadow-2xl text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">
                    Compte en Attente d&apos;Approbation
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Votre adresse email est confirmée, mais votre compte (<span className="font-bold text-slate-900 dark:text-white">{profile.first_name} {profile.last_name}</span> &bull; <span className="font-bold text-amber-600">{roleConfig.label}</span>) est actuellement en attente d&apos;activation par la Direction ou le Super Administrateur.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-left text-xs space-y-1">
                  <div className="font-bold text-amber-900 dark:text-amber-300">
                    💡 Que faire ?
                  </div>
                  <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                    L&apos;administrateur a reçu votre demande. Dès que votre compte sera approuvé dans la section « Utilisateurs &amp; Accès », vous pourrez vous connecter normalement.
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => signOut()}
                    className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    <span>Retour à la Page de Connexion</span>
                  </button>
                </div>
              </div>
            </div>
          ) : isAllowed ? (
            children
          ) : (
            <div className="min-h-[60vh] flex items-center justify-center p-4">
              <div className="max-w-md w-full p-8 rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-rose-200 dark:border-rose-900/40 shadow-2xl text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">
                    Accès Réservé
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Votre profil actuel (<span className="font-bold text-rose-600 dark:text-rose-400">{roleConfig.label}</span>) ne dispose pas des droits nécessaires pour consulter cette page.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left text-xs space-y-1">
                  <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Module Protégé :</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 truncate">{pathname}</div>
                </div>

                <div className="pt-2">
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Retour à Mon Espace Autorisé</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
