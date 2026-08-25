'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useNotify } from '@/lib/modal-service';
import { useI18n } from '@/lib/i18n';
import { logAuditEvent } from '@/lib/audit';
import {
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  GraduationCap,
  Clock
} from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const { t, dir } = useI18n();
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered');
  const pending = searchParams.get('pending');
  const confirmed = searchParams.get('confirmed');
  const notify = useNotify();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);

  // Live 60s countdown timer for rate-limit protection
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          setErrorMsg(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const [infoMsg, setInfoMsg] = useState<string | null>(
    confirmed
      ? '✅ Votre adresse email a été confirmée avec succès ! Veuillez vous connecter avec vos identifiants pour accéder à votre espace.'
      : pending
      ? 'Votre demande d\'inscription a été soumise avec succès. Votre compte est actuellement en attente d\'approbation par l\'administrateur.'
      : registered
      ? 'Compte créé avec succès ! Veuillez vous connecter.'
      : null
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        throw error;
      }

      if (data?.user) {
        // Verify account approval status
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_active, role, first_name, last_name')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile && profile.is_active === false) {
          await supabase.auth.signOut();
          setErrorMsg(
            'Accès refusé : Votre compte est en attente d\'approbation par l\'administrateur. Veuillez patienter que votre compte soit activé.'
          );
          setLoading(false);
          return;
        }

        logAuditEvent({
          action: 'USER_LOGIN',
          entity_type: 'auth',
          user_id: data.user.id,
          details: {
            email: data.user.email,
            role: profile?.role || 'UNKNOWN',
          },
        });
      }

      setSuccessMsg('Connexion réussie ! Redirection en cours...');
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion';
      if (
        message.toLowerCase().includes('rate limit') ||
        message.toLowerCase().includes('rate_limit') ||
        message.toLowerCase().includes('exceeded') ||
        message.toLowerCase().includes('too many requests')
      ) {
        setCooldown(60);
        setErrorMsg('⏳ Limite d\'envoi atteinte par sécurité. Veuillez patienter 60 secondes avant de réessayer.');
      } else if (message.toLowerCase().includes('invalid login credentials')) {
        setErrorMsg('Email ou mot de passe incorrect.');
      } else if (message.toLowerCase().includes('email not confirmed')) {
        setErrorMsg('Veuillez confirmer votre adresse email.');
      } else {
        setErrorMsg(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleDemoLogin() {
    setEmail('admin@gm-school.ma');
    setPassword('Admin@123456');
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 relative overflow-hidden selection:bg-sky-500 selection:text-white">
      {/* School building background image */}
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-15 bg-cover bg-center bg-no-repeat filter blur-[3px] scale-105"
        style={{ backgroundImage: "url('/school-bg.png')" }}
        aria-hidden="true"
      />

      {/* Decorative background glow circles */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md relative z-10">
        {/* Header with School Logo & Title */}
        <div className="text-center mb-6">
          <div className="relative inline-flex items-center justify-center p-2 mb-3 bg-white/95 rounded-3xl shadow-2xl shadow-sky-500/20 ring-4 ring-sky-500/20 hover:scale-105 transition-all duration-300">
            <Image
              src="/logo.png"
              alt="Logo Groupe Scolaire Des Générations Montantes"
              width={110}
              height={110}
              priority
              className="object-contain drop-shadow"
            />
          </div>

          <h1 className="text-lg md:text-xl font-extrabold text-white tracking-tight uppercase leading-snug">
            GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES
          </h1>
          <p className="text-sm font-semibold text-sky-300 mt-1 font-arabic" dir="rtl">
            مجموعة مدارس الأجيال الصاعدة
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2.5 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-300 text-xs font-medium">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Portail de Gestion & Administration Scolaire</span>
          </div>
        </div>

        {/* Auth Box */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60">
          {/* Tabs switch */}
          <div className="flex bg-slate-950/60 p-1 rounded-2xl border border-slate-800/80 mb-6">
            <button
              type="button"
              className="flex-1 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md transition-all"
            >
              Se Connecter
            </button>
            <Link
              href="/signup"
              className="flex-1 py-2 text-center text-xs sm:text-sm font-medium rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
            >
              Créer un Compte
            </Link>
          </div>

          {/* Feedback alerts */}
          {infoMsg && (
            <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>{infoMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1">
                <span>
                  {cooldown > 0
                    ? `⏳ Limite d'envoi atteinte par sécurité. Veuillez patienter encore ${cooldown}s avant de réessayer.`
                    : errorMsg}
                </span>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Adresse Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@gm-school.ma"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Mot de Passe
                </label>
                <button
                  type="button"
                  onClick={() =>
                    notify({
                      title: 'Réinitialisation de Mot de Passe',
                      message: 'Veuillez contacter l\'administrateur du système pour réinitialiser votre mot de passe.',
                      type: 'info',
                    })
                  }
                  className="text-xs text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                >
                  Oublié ?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:via-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : cooldown > 0 ? (
                <span>⏳ Patienter ({cooldown}s)</span>
              ) : (
                <>
                  <span>Connexion à l&apos;Espace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-slate-500">
          <div className="flex items-center justify-center gap-1.5 mb-1 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>Plateforme Sécurisée &bull; Accès Réservé au Personnel GM</span>
          </div>
          <p>© {new Date().getFullYear()} Groupe Scolaire Des Générations Montantes. Tous droits réservés.<br/>Released by Mohamed Reda Nahlaoui</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
