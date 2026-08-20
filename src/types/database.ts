export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'SUPERVISOR' | 'STOCK_MANAGER';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export type SubstitutionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';
export type StockMovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER' | 'RETURN';
export type POStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'RECEIVED' | 'CANCELLED';
export type ExpenseCategory = 'SALARIES' | 'SUPPLIES' | 'MAINTENANCE' | 'ELECTRICITY' | 'WATER' | 'INTERNET' | 'EQUIPMENT' | 'TRANSPORT' | 'OTHER';
export type NotificationType = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

export interface Term {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
}

export interface Room {
  id: string;
  room_number: string;
  name: string;
  capacity: number;
  type: string;
  equipment?: Record<string, unknown> | Array<unknown>;
  is_active: boolean;
}

export type EducationCycle = 'MATERNELLE' | 'PRIMAIRE' | 'COLLEGE' | 'LYCEE' | 'ALL';

export interface CycleSubjectConfig {
  weekly_hours: number;
  coefficient: number;
  levels?: string[];
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  weekly_hours: number;
  coefficient: number;
  color_code: string;
  cycle?: EducationCycle;
  cycles?: EducationCycle[];
  levels?: string[];
  room_type?: string;
  cycle_configs?: Partial<Record<EducationCycle, CycleSubjectConfig>>;
  created_at?: string;
}

export type TeacherContractType = 'PLEIN_TEMPS' | 'VACATAIRE';

export interface TeacherAvailabilitySlot {
  day_of_week: number;
  period_id: string;
  start_time: string;
  end_time: string;
}

export interface Teacher {
  id: string;
  profile_id?: string;
  teacher_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  specialization?: string;
  contract_type?: TeacherContractType;
  teaching_levels?: string[];
  availability?: TeacherAvailabilitySlot[];
  weekly_hours_target?: number;
  hire_date?: string;
  status: string;
  photo_url?: string;
  created_at: string;
}

export interface ClassEntity {
  id: string;
  name: string;
  level: string;
  group_name?: string;
  academic_year_id?: string;
  main_teacher_id?: string;
  room_id?: string;
  capacity: number;
  is_active: boolean;
  main_teacher?: Teacher;
  room?: Room;
}

export interface Student {
  id: string;
  student_code: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: 'M' | 'F' | string;
  class_id?: string;
  photo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  status: string;
  class?: ClassEntity;
  created_at: string;
}

export interface TimetableSlot {
  id: string;
  timetable_id: string;
  class_id: string;
  teacher_id: string;
  subject_id: string;
  room_id: string;
  day_of_week: number; // 1 (Mon) to 6 (Sat)
  start_time: string; // "08:00"
  end_time: string; // "10:00"
  class?: ClassEntity;
  teacher?: Teacher;
  subject?: Subject;
  room?: Room;
}

export interface StudentAttendance {
  id: string;
  student_id: string;
  class_id?: string;
  timetable_slot_id?: string;
  date: string;
  status: AttendanceStatus;
  check_in_time?: string;
  expected_time?: string;
  late_minutes?: number;
  is_justified?: boolean;
  justification_reason?: string;
  notes?: string;
  reason?: string;
  comment?: string;
  student?: Student;
}

export interface TeacherAttendance {
  id: string;
  teacher_id: string;
  date: string;
  status: AttendanceStatus;
  reason?: string;
  late_minutes?: number;
  check_in_time?: string;
  check_out_time?: string;
  is_justified?: boolean;
  justification_reason?: string;
  teacher?: Teacher;
}

export type StaffCategory =
  | 'ENSEIGNANT'
  | 'ADMINISTRATION'
  | 'ASSISTANTE'
  | 'CHAUFFEUR'
  | 'AGENT_ENTRETIEN'
  | 'SECURITE_GARDIEN';

export interface StaffMember {
  id: string;
  staff_code: string;
  first_name: string;
  last_name: string;
  category: StaffCategory;
  role_title: string;
  phone?: string;
  email?: string;
  contract_type?: string;
  is_active: boolean;
  photo_url?: string;
}

export interface StaffAttendanceRecord {
  id: string;
  staff_id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  check_in_time?: string; // e.g. "08:35"
  expected_time?: string; // e.g. "08:00"
  check_out_time?: string; // e.g. "17:00"
  late_minutes: number; // e.g. 35
  is_justified: boolean;
  justification_reason?: string;
  notes?: string;
  created_at?: string;
  staff?: StaffMember;
}

export interface SubstitutionRequest {
  id: string;
  absent_teacher_id: string;
  replacement_teacher_id?: string;
  timetable_slot_id?: string;
  date: string;
  status: SubstitutionStatus;
  notes?: string;
  absent_teacher?: Teacher;
  replacement_teacher?: Teacher;
  timetable_slot?: TimetableSlot;
}

export interface StockCategory {
  id: string;
  name: string;
  description?: string;
}

export interface StockLocation {
  id: string;
  name: string;
  description?: string;
}

export interface StockProduct {
  id: string;
  name: string;
  sku: string;
  category_id?: string;
  location_id?: string;
  quantity: number;
  minimum_quantity: number;
  unit: string;
  purchase_price: number;
  value_price: number;
  status: string;
  image_url?: string;
  icon_name?: string;
  category?: StockCategory;
  location?: StockLocation;
}

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: StockMovementType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reason?: string;
  reference_id?: string;
  requested_by?: string; // e.g. "M. Benjelloun (Prof Maths)", "Administration", "Classe CP-A"
  department?: string; // e.g. "Pédagogique", "Entretien", "Administration", "Sciences"
  voucher_number?: string;
  notes?: string;
  created_at: string;
  product?: StockProduct;
}

export interface Supplier {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_id?: string;
  status: string;
}

export interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier_id?: string;
  order_date: string;
  status: POStatus;
  total_amount: number;
  notes?: string;
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product?: StockProduct;
}

export interface Budget {
  id: string;
  academic_year_id?: string;
  category: ExpenseCategory;
  allocated_amount: number;
  spent_amount: number;
  notes?: string;
}

export interface Expense {
  id: string;
  budget_id?: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string;
  supplier_id?: string;
  invoice_number?: string;
  attachment_url?: string;
  supplier?: Supplier;
}

export interface Notification {
  id: string;
  user_id?: string;
  target_role?: UserRole;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  link_url?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}
