// src/types/school.ts - Multi-school platform types

export interface School {
  id: string;
  name: string;
  code: string; // Unique school code for URL/identification
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  academicYear: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  settings: SchoolSettings;
}

export interface SchoolSettings {
  language: 'fr' | 'ar' | 'en';
  currency: string;
  timezone: string;
  workingDays: number[]; // 0=Sunday, 1=Monday, etc.
  workingHours: {
    start: number;
    end: number;
  };
  levels: string[];
  subjects: string[];
  paymentMethods: string[];
  emailEnabled: boolean;
  // Fees settings
  feesSettings?: FeesSettings;
}

export interface FeesSettings {
  levelPrices: Record<string, number>; // prices per level: maternelle, primaire, college, lycee
  transportPrice: number;
  booksPrice: number;
  activitiesPrice: number;
  annualDiscount: number; // percentage, e.g., 10 = 10%
}

export interface SchoolUser {
  userId: string;
  schoolId: string;
  role: 'admin' | 'director' | 'teacher' | 'accountant' | 'secretary';
  permissions?: string[];
  joinedAt: string;
  isActive: boolean;
}

export interface UserSchools {
  userId: string;
  schools: SchoolUser[];
  defaultSchoolId?: string;
}

// Updated entities with schoolId
export interface SchoolTeacher {
  id: string;
  schoolId: string;
  name: string;
  maxHoursPerWeek: number;
  subjects: string[];
  levels: string[];
  availability: Record<string, number[]>;
  isVacataire: boolean;
  availableHours?: number[];
  email?: string;
  phone?: string;
}

export interface SchoolClass {
  id: string;
  schoolId: string;
  name: string;
  level: string;
  roomId?: string;
  subjects: ClassSubject[];
  teacherId?: string;
  maxStudents?: number;
}

export interface ClassSubject {
  name: string;
  hours: number;
}

export interface SchoolSalle {
  id: string;
  schoolId: string;
  name: string;
  type: 'Standard' | 'Labo' | 'Informatique';
  capacity?: number;
}

export interface SchoolStudent {
  id: string;
  schoolId: string;
  name: string;
  classId: string;
  academicYear: string;
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
  photo?: string;
}

export interface SchoolPayment {
  id: string;
  schoolId: string;
  studentId: string;
  amount: number;
  month: number;
  academicYear: string;
  paymentMethod: string;
  paymentDate: string;
  receiptNumber: string;
  createdAt: string;
}

