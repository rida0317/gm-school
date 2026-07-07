// src/types/index.ts - All TypeScript type definitions

export interface Teacher {
  id: string;
  name: string;
  maxHoursPerWeek: number;
  subjects: string[];
  levels: string[];
  availability: Record<string, number[]>; // day -> slot indices
  isVacataire: boolean;
  availableHours?: number[]; // hours when vacataire is available (8-19)
}

export interface ClassSubject {
  name: string;
  hours: number;
}

export interface SchoolClass {
  id: string;
  name: string;
  level: string;
  roomId?: string;
  subjects: ClassSubject[];
}

export interface Salle {
  id: string;
  name: string;
  type: 'Standard' | 'Labo' | 'Informatique';
}

export interface TimetableSlot {
  subject: string;
  teacherId: string;
  roomId?: string;
  classId?: string;
  isMultiPeriod?: boolean;
  periodCount?: number;
  periodIndex?: number; // 0 for first period, 1 for second, etc.
}

export interface Timetable {
  [classId: string]: {
    [day: string]: (TimetableSlot | null)[];
  };
}

export interface Replacement {
  id: string;
  originalTeacherId: string;
  substituteTeacherId: string;
  classId: string;
  date: string;
  slotIndex: number;
  subject: string;
}

export interface Absence {
  id: string;
  teacherId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface CustomSubject {
  id: string;
  name: string;
}

export interface CustomLevel {
  id: string;
  name: string;
}

export interface Student {
  id: string;
  name: string;
  classId: string;
  academicYear: string;
  schoolId?: string;
  codeMassar?: string;
  gender?: 'Male' | 'Female';
  parentName?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  email?: string;
  phone?: string;
  address?: string;
  guardianName?: string;
  guardianPhone?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  price?: number;
  supplierId?: string;
  location?: string;
  lastUpdated?: string;
}

export type ResourceMetrics = number;

export interface SchoolData {
  teachers: Teacher[];
  classes: SchoolClass[];
  salles: Salle[];
  timetables: Timetable;
  replacements: Replacement[];
  absences: Absence[];
  customSubjects: CustomSubject[];
  customLevels: CustomLevel[];
  students: Student[];
  inventory: { 
    items: InventoryItem[]; 
    transactions: any[]; 
    suppliers: any[]; 
    categories: any[]; 
    assignments: any[] 
  };
  logo: string;
  schoolName: string;
  academicYear: string;
  language: 'en' | 'fr' | 'ar';
}

export interface TimeSlot {
  start: string;
  end: string;
  type?: 'BREAK' | 'LUNCH';
  duration?: number;
}

export interface GenerationResult {
  timetables: Timetable;
  unscheduled: { class: string; subject: string; hours: number }[];
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  organizationId?: string;
  role?: UserRole;
  status?: UserStatus;
  createdAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export type UserRole = 'admin' | 'director' | 'teacher' | 'guard' | 'assistant';
export type UserStatus = 'pending' | 'active' | 'suspended';

export interface Translation {
  [key: string]: string;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  recipientType: 'user' | 'class' | 'all';
  subject: string;
  content: string;
  timestamp: string;
  read: boolean;
  priority: 'normal' | 'urgent' | 'high';
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  type: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  timestamp: string;
  expiresAt?: string;
  audience: 'all' | 'teachers' | 'students' | 'parents';
  attachments?: MessageAttachment[];
}

export interface Notification {
  id: string;
  userId: string;
  type: 'message' | 'announcement' | 'timetable_change' | 'replacement' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  priority: 'normal' | 'high' | 'urgent';
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessageId: string;
  lastMessageTime: string;
  unreadCount: number;
}

// Grades & Analytics Types
export type ExamType = 'Controle 1' | 'Controle 2' | 'Examen' | 'Devoir' | 'Quiz' | 'Final';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface Grade {
  id: string;
  studentId: string;
  subject: string;
  examType: ExamType;
  grade: number; // 0-20
  classId: string;
  date: string;
  academicYear: string;
  coefficient?: number;
  teacherId?: string;
  comment?: string;
}

export interface GradeInput {
  studentId: string;
  subject: string;
  examType: ExamType;
  grade: number;
  classId: string;
  date: string;
  coefficient?: number;
  teacherId?: string;
  comment?: string;
}

export interface ClassAnalytics {
  classId: string;
  className: string;
  totalStudents: number;
  averageGrade: number;
  highestGrade: number;
  lowestGrade: number;
  successRate: number; // percentage >= 10
  riskStudents: number;
  averageStudents: number;
  goodStudents: number;
  subjectAverages: SubjectAverage[];
  examAverages: ExamAverage[];
}

export interface SubjectAverage {
  subject: string;
  average: number;
  studentCount: number;
}

export interface ExamAverage {
  examType: ExamType;
  average: number;
  studentCount: number;
}

export interface StudentPerformance {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  grades: StudentGrade[];
  averageGrade: number;
  trend: 'improving' | 'declining' | 'stable';
  riskLevel: RiskLevel;
  subjectAverages: SubjectAverage[];
}

// Enhanced Student Detail Analytics
export interface StudentDetailAnalytics {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  codeMassar?: string;
  
  // Overall Metrics
  overallAverage: number;
  classRank: number;
  totalStudents: number;
  percentile: number;
  trend: 'improving' | 'declining' | 'stable';
  trendPercentage: number;
  riskLevel: RiskLevel;
  totalAssessments: number;
  
  // Subject Breakdown
  subjectBreakdown: SubjectPerformance[];
  topSubjects: SubjectPerformance[];
  weakSubjects: SubjectPerformance[];
  
  // Grade Evolution
  gradeEvolution: GradeTimeline[];
  
  // Exam Type Performance
  examTypePerformance: ExamPerformance[];
  bestExamType: string;
  worstExamType: string;

  // Detailed Grades
  allGrades: DetailedGrade[];

  // Comparative
  classAverage: number;
  differenceFromClassAverage: number;
}

export interface SubjectPerformance {
  subject: string;
  average: number;
  gradeCount: number;
  trend: 'improving' | 'declining' | 'stable';
  rank: number;
  color: string;
}

export interface GradeTimeline {
  date: string;
  subject: string;
  examType: ExamType;
  grade: number;
  coefficient: number;
  classAverage?: number;
}

export interface ExamPerformance {
  examType: ExamType;
  average: number;
  gradeCount: number;
  highestGrade: number;
  lowestGrade: number;
}

export interface DetailedGrade {
  id: string;
  date: string;
  subject: string;
  examType: ExamType;
  grade: number;
  coefficient: number;
  classAverage?: number;
  observation: string;
}

export interface StudentGrade {
  gradeId: string;
  subject: string;
  examType: ExamType;
  grade: number;
  date: string;
  coefficient: number;
}

export interface GradeDistribution {
  range: string;
  count: number;
  percentage: number;
}

export interface ClassReport {
  classId: string;
  className: string;
  totalStudents: number;
  averageGrade: number;
  successRate: number;
  topStudent: {
    id: string;
    name: string;
    average: number;
  } | null;
  lowestStudent: {
    id: string;
    name: string;
    average: number;
  } | null;
  subjectPerformance: SubjectAverage[];
  gradeDistribution: GradeDistribution[];
  generatedAt: string;
}

// LMS Integration Types
export interface LMSConnection {
  id: string;
  name: string;
  type: 'moodle' | 'canvas' | 'blackboard' | 'google_classroom';
  baseUrl: string;
  apiKey: string;
  clientId?: string;
  clientSecret?: string;
  isActive: boolean;
  lastSync?: string;
  syncStatus: 'idle' | 'syncing' | 'error';
  error?: string;
}

export interface LMSCourse {
  id: string;
  name: string;
  code: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  teacherId?: string;
  externalId?: string;
}

export interface LMSUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'teacher' | 'student' | 'admin';
  externalId?: string;
  lmsId?: string;
}

export interface LMSGrade {
  id: string;
  studentId: string;
  assignmentId: string;
  grade: number;
  maxGrade: number;
  submittedAt: string;
  externalId?: string;
}

export interface LMSSyncOptions {
  syncCourses: boolean;
  syncUsers: boolean;
  syncGrades: boolean;
  syncAssignments?: boolean;
}

// Calendar Integration Types
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: string[];
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate?: string;
  };
  color?: string;
}

export interface CalendarProvider {
  name: string;
  isConnected: boolean;
  lastSync?: string;
}

export interface ExportOptions {
  format: 'google' | 'outlook' | 'ical';
  includeTeachers?: boolean;
  includeRooms?: boolean;
  includeDescription?: boolean;
  startDate?: string;
  endDate?: string;
  colorBy?: 'subject' | 'teacher' | 'class';
}

// Automation Types
export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  type: 'scheduling' | 'notification' | 'reporting' | 'optimization';
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  priority: number;
  enabled: boolean;
  lastExecuted?: string;
  executionCount: number;
}

export interface AutomationCondition {
  type: 'time' | 'event' | 'data_change' | 'threshold';
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'between';
  value: any;
  field?: string;
  comparison?: 'and' | 'or';
}

export interface AutomationAction {
  type: 'schedule_optimization' | 'send_notification' | 'generate_report' | 'update_data' | 'trigger_workflow';
  parameters: Record<string, any>;
  priority: number;
}

// Teacher Preferences Types
export interface TeacherPreference {
  teacherId: string;
  preferredDays: string[];
  preferredTimeSlots: number[];
  avoidDays: string[];
  avoidTimeSlots: number[];
  maxConsecutiveHours: number;
  preferredSubjects: string[];
  avoidSubjects: string[];
  maxDailyHours: number;
  minDailyHours: number;
  preferredRooms: string[];
  avoidRooms: string[];
}

// AI & Predictive Analytics Types
export interface Prediction {
  id: string;
  type: 'workload' | 'performance' | 'resource_demand' | 'schedule_optimization';
  confidence: number;
  prediction: number;
  factors: string[];
  recommendations: string[];
  timestamp: string;
}

export interface MLModel {
  id: string;
  name: string;
  type: 'regression' | 'classification' | 'clustering' | 'time_series';
  accuracy: number;
  features: string[];
  trainingDataSize: number;
  lastTrained: string;
  isActive: boolean;
}

export interface AISettings {
  enablePredictions: boolean;
  enableAutoOptimization: boolean;
  notificationPriority: 'all' | 'urgent' | 'none';
  modelRefreshInterval: number;
}

