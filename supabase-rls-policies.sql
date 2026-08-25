-- ==============================================================================
-- GM SCHOOL MANAGEMENT SYSTEM — ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Ce script configure la sécurité au niveau des lignes (RLS) pour PostgreSQL/Supabase.
-- Il garantit que chaque utilisateur n'accède qu'aux données autorisées selon son rôle :
-- SUPER_ADMIN, ADMIN, SUPERVISOR, TEACHER, STOCK_MANAGER
-- ==============================================================================

-- 1. Helper function pour récupérer le rôle de l'utilisateur connecté
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS text AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Helper function pour vérifier si l'utilisateur est Super Admin ou Admin
CREATE OR REPLACE FUNCTION auth.is_admin_or_super()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ==============================================================================
-- TABLE: profiles
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Tout utilisateur authentifié peut voir les profils (pour les listes et mentions)
CREATE POLICY "Profiles viewable by authenticated users" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- L'utilisateur peut mettre à jour son propre profil (nom, avatar, téléphone)
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid() 
  -- Empêcher l'auto-élévation de privilèges de rôle
  AND (role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
);

-- Seul SUPER_ADMIN et ADMIN peuvent créer ou modifier les rôles d'autres utilisateurs
CREATE POLICY "Admins can manage all profiles" 
ON public.profiles FOR ALL 
TO authenticated 
USING (auth.is_admin_or_super())
WITH CHECK (auth.is_admin_or_super());

-- ==============================================================================
-- TABLE: school_settings
-- ==============================================================================
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings viewable by all authenticated" 
ON public.school_settings FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Settings modifiable by Admins only" 
ON public.school_settings FOR ALL 
TO authenticated 
USING (auth.is_admin_or_super())
WITH CHECK (auth.is_admin_or_super());

-- ==============================================================================
-- TABLE: students & classes & rooms & subjects
-- ==============================================================================
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Lecture autorisée pour tout le personnel de l'école
CREATE POLICY "Pedagogic data viewable by staff" 
ON public.students FOR SELECT TO authenticated USING (true);

CREATE POLICY "Classes viewable by staff" 
ON public.classes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Rooms viewable by staff" 
ON public.rooms FOR SELECT TO authenticated USING (true);

CREATE POLICY "Subjects viewable by staff" 
ON public.subjects FOR SELECT TO authenticated USING (true);

-- Modification par Admin, Super Admin et Surveillant Général
CREATE POLICY "Students manageable by Admin and Supervisor" 
ON public.students FOR ALL TO authenticated 
USING (auth.get_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'))
WITH CHECK (auth.get_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'));

CREATE POLICY "Classes manageable by Admin" 
ON public.classes FOR ALL TO authenticated 
USING (auth.is_admin_or_super())
WITH CHECK (auth.is_admin_or_super());

CREATE POLICY "Rooms manageable by Admin" 
ON public.rooms FOR ALL TO authenticated 
USING (auth.is_admin_or_super())
WITH CHECK (auth.is_admin_or_super());

CREATE POLICY "Subjects manageable by Admin" 
ON public.subjects FOR ALL TO authenticated 
USING (auth.is_admin_or_super())
WITH CHECK (auth.is_admin_or_super());

-- ==============================================================================
-- TABLE: attendance (students, teachers, staff)
-- ==============================================================================
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student attendance viewable by staff" 
ON public.student_attendance FOR SELECT TO authenticated USING (true);

CREATE POLICY "Student attendance insertable by teachers and supervisors" 
ON public.student_attendance FOR INSERT TO authenticated 
WITH CHECK (auth.get_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'TEACHER'));

CREATE POLICY "Student attendance updatable by supervisors and admins" 
ON public.student_attendance FOR UPDATE TO authenticated 
USING (auth.get_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'));

CREATE POLICY "Staff attendance viewable by staff" 
ON public.staff_attendance_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff attendance manageable by admin and supervisor" 
ON public.staff_attendance_records FOR ALL TO authenticated 
USING (auth.get_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'));

-- ==============================================================================
-- TABLE: stock, suppliers, purchase_orders
-- ==============================================================================
ALTER TABLE public.stock_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stock viewable by staff" 
ON public.stock_products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Stock manageable by Stock Manager and Admin" 
ON public.stock_products FOR ALL TO authenticated 
USING (auth.get_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER'))
WITH CHECK (auth.get_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER'));

CREATE POLICY "Stock movements manageable by Stock Manager and Admin" 
ON public.stock_movements FOR ALL TO authenticated 
USING (auth.get_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER'))
WITH CHECK (auth.get_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER'));

CREATE POLICY "Suppliers manageable by Admin and Stock Manager" 
ON public.suppliers FOR ALL TO authenticated 
USING (auth.get_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER'))
WITH CHECK (auth.get_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'STOCK_MANAGER'));

-- ==============================================================================
-- TABLE: finances (tuition_payments, expenses, budgets)
-- ==============================================================================
ALTER TABLE public.tuition_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finances strictly managed by Admins" 
ON public.tuition_payments FOR ALL TO authenticated 
USING (auth.is_admin_or_super())
WITH CHECK (auth.is_admin_or_super());

CREATE POLICY "Expenses strictly managed by Admins" 
ON public.expenses FOR ALL TO authenticated 
USING (auth.is_admin_or_super())
WITH CHECK (auth.is_admin_or_super());

CREATE POLICY "Budgets strictly managed by Admins" 
ON public.budgets FOR ALL TO authenticated 
USING (auth.is_admin_or_super())
WITH CHECK (auth.is_admin_or_super());

-- ==============================================================================
-- TABLE: audit_logs (Journal de Sécurité)
-- ==============================================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Insertion permise pour tout utilisateur authentifié (journalisation automatique des actions)
CREATE POLICY "Audit logs insertable by any authenticated action" 
ON public.audit_logs FOR INSERT TO authenticated 
WITH CHECK (true);

-- Lecture strictement réservée au SUPER_ADMIN
CREATE POLICY "Audit logs viewable exclusively by SUPER_ADMIN" 
ON public.audit_logs FOR SELECT TO authenticated 
USING (auth.get_user_role() = 'SUPER_ADMIN');

-- Verrouillage : Personne ne peut modifier ou supprimer l'historique d'audit !
CREATE POLICY "Audit logs immutable" 
ON public.audit_logs FOR UPDATE TO authenticated USING (false);
