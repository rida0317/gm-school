'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { UserRole } from '@/types/database';
import {
  Lock,
  Mail,
  User,
  Shield,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  ShieldCheck,
  Phone
} from 'lucide-react';

export default function SignUpPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'ADMIN' as UserRole,
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (formData.password.length < 6) {
      setErrorMsg('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const redirectUrl = typeof window !== 'undefined' && window.location.origin
        ? `${window.location.origin}/auth/callback`
        : 'https://generationsmontantes.com/auth/callback';

      // 1. Sign up user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim(),
            role: formData.role,
            phone: formData.phone.trim(),
          },
        },
      });

      if (authError) {
        throw authError;
      }

      // If user already exists in auth, identities array is empty
      if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
        setErrorMsg('Cette adresse email est déjà enregistrée. Veuillez vous connecter ou utiliser la récupération de mot de passe.');
        setLoading(false);
        return;
      }

      const userId = authData.user?.id;

      // 2. Insert or update profile row in public.profiles table if user ID exists
      if (userId) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: userId,
          email: formData.email.trim(),
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          role: formData.role,
          phone: formData.phone.trim() || null,
          is_active: false, // En attente d'approbation par l'administrateur
          updated_at: new Date().toISOString(),
        });

        if (profileError) {
          console.warn('Profile sync warning:', profileError.message);
        }

        // If registered as TEACHER, auto-link or create corresponding teacher record
        if (formData.role === 'TEACHER') {
          try {
            // Check for existing teacher record with matching email
            const { data: existingTeacher } = await supabase
              .from('teachers')
              .select('id, profile_id')
              .ilike('email', formData.email.trim())
              .maybeSingle();

            if (existingTeacher) {
              await supabase
                .from('teachers')
                .update({
                  profile_id: userId,
                  phone: formData.phone.trim() || undefined,
                })
                .eq('id', existingTeacher.id);
            } else {
              // Create new teacher record
              const teacherCode = `ENS-${Date.now().toString().slice(-4)}`;
              await supabase
                .from('teachers')
                .insert({
                  profile_id: userId,
                  teacher_code: teacherCode,
                  first_name: formData.firstName.trim(),
                  last_name: formData.lastName.trim(),
                  email: formData.email.trim(),
                  phone: formData.phone.trim() || null,
                  status: 'ACTIVE',
                });
            }
          } catch (teacherErr) {
            console.warn('Teacher record link warning:', teacherErr);
          }
        }

        // 3. Create admin notification
        try {
          await supabase.from('notifications').insert({
            title: 'Nouvelle Inscription en Attente',
            message: `${formData.firstName} ${formData.lastName} (${formData.role}) a demandé un compte. Approbation requise.`,
            type: 'WARNING',
            is_read: false,
            link_url: '/users',
            target_role: 'ADMIN',
          });
        } catch {
          // ignore
        }

        // 4. Record audit log
        try {
          await supabase.from('audit_logs').insert({
            action: 'USER_SIGNUP_PENDING',
            entity_type: 'profiles',
            entity_id: userId,
            details: {
              email: formData.email.trim(),
              role: formData.role,
              name: `${formData.firstName} ${formData.lastName}`,
              status: 'PENDING_APPROVAL',
            },
          });
        } catch {
          // ignore
        }
      }

      setSuccessMsg('Demande d\'inscription envoyée avec succès ! Votre compte doit être approuvé par l\'administrateur.');
      setTimeout(() => {
        router.push('/login?pending=true');
      }, 1800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création du compte';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
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
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-lg relative z-10 my-4">
        {/* Header with School Logo & Title */}
        <div className="text-center mb-6">
          <div className="relative inline-flex items-center justify-center p-2 mb-3 bg-white/95 rounded-3xl shadow-2xl shadow-sky-500/20 ring-4 ring-sky-500/20 hover:scale-105 transition-all duration-300">
            <Image
              src="/logo.png"
              alt="Logo Groupe Scolaire Des Générations Montantes"
              width={100}
              height={100}
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
            <span>Création de Compte Collaborateur</span>
          </div>
        </div>

        {/* Auth Box */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60">
          {/* Tabs switch */}
          <div className="flex bg-slate-950/60 p-1 rounded-2xl border border-slate-800/80 mb-6">
            <Link
              href="/login"
              className="flex-1 py-2 text-center text-xs sm:text-sm font-medium rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
            >
              Se Connecter
            </Link>
            <button
              type="button"
              className="flex-1 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md transition-all"
            >
              Créer un Compte
            </button>
          </div>

          {/* Feedback alerts */}
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Prénom
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Ahmed"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Nom de famille
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="El Idrissi"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Email field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Adresse Email Professionnelle
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="prenom.nom@gm-school.ma"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                />
              </div>
            </div>

            {/* Phone and Role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Téléphone (optionnel)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="06 12 34 56 78"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Rôle / Fonction
                </label>
                <div className="relative">
                  <Shield className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all cursor-pointer"
                  >
                    <option value="ADMIN" className="bg-slate-900 text-white">Directeur</option>
                    <option value="SUPER_ADMIN" className="bg-slate-900 text-white">Super Administrateur</option>
                    <option value="TEACHER" className="bg-slate-900 text-white">Enseignant</option>
                    <option value="SUPERVISOR" className="bg-slate-900 text-white">Surveillant Général</option>
                    <option value="STOCK_MANAGER" className="bg-slate-900 text-white">Gestionnaire de Stock</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Mot de Passe
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Confirmation
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:via-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Créer mon Compte</span>
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
            <span>Portail Administratif &bull; Groupe Scolaire Des Générations Montantes</span>
          </div>
          <p>© {new Date().getFullYear()} GM School. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  );
}
