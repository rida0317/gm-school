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
    label: 'Administrateur',
    description: 'Accès complet au site et gestion courante (Ne peut pas modifier le Super Admin)',
    color: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300',
    allowedPaths: ['*'], // Accès complet sauf actions destructives sur Super Admin
  },
  TEACHER: {
    label: 'Enseignant',
    description: 'Accès restreint à l\'emploi du temps, aux classes et à son pointage',
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300',
    allowedPaths: [
      '/dashboard',
      '/timetable',
      '/classes',
      '/attendance/staff',
      '/stock',
    ],
  },
  SUPERVISOR: {
    label: 'Surveillant Général',
    description: 'Accès au suivi des élèves, présences, retards, absences et remplacements',
    color: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300',
    allowedPaths: [
      '/dashboard',
      '/students',
      '/teachers',
      '/classes',
      '/rooms',
      '/timetable',
      '/attendance/students',
      '/attendance/staff',
      '/substitutions',
    ],
  },
  STOCK_MANAGER: {
    label: 'Gestionnaire de Stock',
    description: 'Accès dédié aux stocks, inventaire, réapprovisionnement et fournisseurs',
    color: 'text-indigo-600 dark:text-indigo-400',
    badgeBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300',
    allowedPaths: [
      '/dashboard',
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

  if (effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'ADMIN') {
    return true;
  }

  const allowed = ROLE_CONFIGS[effectiveRole]?.allowedPaths || [];
  
  // Exact match or sub-path match (e.g. /attendance/students is matched by /attendance/students)
  return allowed.some((allowedPath) => {
    if (allowedPath === pathname) return true;
    if (allowedPath !== '/dashboard' && pathname.startsWith(allowedPath + '/')) return true;
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
        reason: '🔒 Compte Super Administrateur Protégé (Non modifiable par un Administrateur)',
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
