import { UserRole } from '@/types/database';

export interface RoleConfig {
  label: string;
  description: string;
  color: string;
  badgeBg: string;
  allowedPaths: string[];
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  SUPER_ADMIN: {
    label: 'Super Administrateur',
    description: 'Accès total et absolu à tous les modules, données et gestion des comptes',
    color: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300',
    allowedPaths: ['*'], // Accès total
  },
  ADMIN: {
    label: 'Directeur',
    description: 'Accès complet au site et gestion courante (Sans accès au Journal d\'Audit réservé au Super Admin)',
    color: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300',
    allowedPaths: ['*'], // Accès complet sauf Journal d'Audit et actions sur Super Admin
  },
  TEACHER: {
    label: 'Enseignant',
    description: 'Accès dédié : Élèves, présence, saisie des notes & bulletins de ses classes, consultation de son emploi du temps',
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300',
    allowedPaths: [
      '/dashboard',
      '/announcements',
      '/students',
      '/attendance/students',
      '/timetable',
      '/grades',
    ],
  },
  SUPERVISOR: {
    label: 'Surveillant Général',
    description: 'Accès au suivi des élèves, présences, retards, absences, annonces, remplacements et gestion du stock',
    color: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300',
    allowedPaths: [
      '/dashboard',
      '/announcements',
      '/students',
      '/staff',
      '/teachers',
      '/classes',
      '/rooms',
      '/timetable',
      '/attendance/students',
      '/attendance/staff',
      '/gardes',
      '/substitutions',
      '/stock',
      '/suppliers',
    ],
  },
  STOCK_MANAGER: {
    label: 'Gestionnaire de Stock',
    description: 'Accès dédié aux stocks, inventaire, réapprovisionnement, annonces et fournisseurs',
    color: 'text-indigo-600 dark:text-indigo-400',
    badgeBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300',
    allowedPaths: [
      '/dashboard',
      '/announcements',
      '/stock',
      '/suppliers',
    ],
  },
};

/**
 * Check if a given role is allowed to access a specific pathname
 */
export function hasRouteAccess(role: UserRole | string | undefined | null, pathname: string): boolean {
  if (!role) return true; // default open during loading
  const effectiveRole = (role as UserRole) in ROLE_CONFIGS ? (role as UserRole) : 'SUPER_ADMIN';

  const cleanPath = pathname.split('?')[0];

  // Strict restriction: /audit-logs is strictly reserved for SUPER_ADMIN only
  if (cleanPath === '/audit-logs' || cleanPath.startsWith('/audit-logs/')) {
    return effectiveRole === 'SUPER_ADMIN';
  }

  // Strict restriction: /timetable/generator is strictly reserved for Direction & Super Admin
  if (cleanPath === '/timetable/generator' || cleanPath.startsWith('/timetable/generator/')) {
    return effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'ADMIN';
  }

  if (effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'ADMIN') {
    return true;
  }

  const allowed = ROLE_CONFIGS[effectiveRole]?.allowedPaths || [];
  
  // Exact match or sub-path match (e.g. /attendance/students is matched by /attendance/students)
  return allowed.some((allowedPath) => {
    if (allowedPath === cleanPath) return true;
    if (allowedPath !== '/dashboard' && cleanPath.startsWith(allowedPath + '/')) return true;
    return false;
  });
}

/**
 * Check if the current user can modify/delete a target user
 * Strict rule: ADMIN cannot edit, deactivate, or delete a SUPER_ADMIN!
 */
export function canManageUser(
  currentUserRole: UserRole | string | undefined | null,
  targetUserRole: UserRole | string
): { canEdit: boolean; canDelete: boolean; reason?: string } {
  const current = (currentUserRole as UserRole) || 'SUPER_ADMIN';

  if (current === 'SUPER_ADMIN') {
    return { canEdit: true, canDelete: true };
  }

  if (current === 'ADMIN') {
    if (targetUserRole === 'SUPER_ADMIN') {
      return {
        canEdit: false,
        canDelete: false,
        reason: '🔒 Compte Super Administrateur Protégé (Non modifiable par un Directeur)',
      };
    }
    return { canEdit: true, canDelete: true };
  }

  // Non-admins cannot manage users
  return {
    canEdit: false,
    canDelete: false,
    reason: 'Droits insuffisants pour gérer les utilisateurs',
  };
}
