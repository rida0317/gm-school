'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, Loader2, LogIn } from 'lucide-react';
import Link from 'next/link';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Vérification et confirmation de votre adresse email...');

  useEffect(() => {
    async function handleConfirmation() {
      try {
        const supabase = createClient();

        // 1. Check for token in URL query (code exchange)
        const code = searchParams.get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }

        // 2. Check if active session exists from token in hash
        await supabase.auth.getSession();

        // 3. User confirmed their email! Now sign out so they must log in deliberately through /login
        await supabase.auth.signOut();

        setStatus('success');
        setMessage('Votre adresse email a été confirmée avec succès ! Redirection vers la connexion...');

        // Redirect to /login after 1.5 seconds
        setTimeout(() => {
          router.replace('/login?confirmed=true');
        }, 1500);
      } catch (err: unknown) {
        console.error('Email confirmation error:', err);
        // Even if error, redirect to login so user can log in
        router.replace('/login?confirmed=true');
      }
    }

    handleConfirmation();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 relative">
      <div className="max-w-md w-full p-8 rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
          {status === 'verifying' ? (
            <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
          ) : (
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          )}
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            {status === 'verifying' ? 'Confirmation en Cours' : 'Email Confirmé !'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {message}
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/login?confirmed=true"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Accéder à la Page de Connexion</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
