// Attendance Store (Zustand)
// src/store/attendanceStore.ts

import { create } from 'zustand';
import { attendanceService } from '../services/attendance.service';

export interface AttendanceSession {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  date: string;
  period: number;
  start_time?: string;
  end_time?: string;
  room_id?: string;
  is_cancelled: boolean;
  cancellation_reason?: string;
  created_at: string;
  class_name?: string;
  subject_name?: string;
  teacher_name?: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  school_id?: string;
  class_id?: string;
  date?: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  reason?: string; // Maps to 'notes' in the UI
  // Note: session_id, check_in_time, check_out_time, justified_by, justification_date, updated_at
  // are defined in the interface but not yet supported by the Supabase schema
  session_id?: string; // Future: needs schema update
  check_in_time?: string; // Future: needs schema update
  check_out_time?: string; // Future: needs schema update
  justified_by?: string; // Future: needs schema update
  justification_date?: string; // Future: needs schema update
  notes?: string; // Legacy field, maps to 'reason' in DB
  created_at?: string;
  updated_at?: string; // Future: needs schema update
  student_name?: string;
  code_massar?: string;
}

export interface AttendanceStatistics {
  student_id: string;
  total_sessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_rate: number;
  unexcused_absences: number;
  by_month: any[];
  by_subject: any[];
}

export interface ClassAttendanceSummary {
  class_id: string;
  class_name: string;
  date: string;
  total_students: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_rate: number;
  students_with_absences: any[];
}

interface AttendanceState {
  // Data
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  statistics: AttendanceStatistics | null;
  classSummary: ClassAttendanceSummary | null;
  
  // Loading states
  loading: boolean;
  error: string | null;
  
  // Actions - Sessions
  fetchSessions: (filters?: any) => Promise<void>;
  createSession: (session: any) => Promise<AttendanceSession>;
  updateSession: (id: string, updates: any) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  getSessionsByDate: (classId: string, date: string) => Promise<AttendanceSession[]>;
  
  // Actions - Records
  markAttendance: (sessionId: string, records: any[]) => Promise<void>;
  getSessionRecords: (sessionId: string) => Promise<AttendanceRecord[]>;
  getStudentRecords: (studentId: string, filters?: any) => Promise<AttendanceRecord[]>;
  getClassRecords: (classId: string, date: string) => Promise<AttendanceRecord[]>;
  
  // Actions - Statistics
  getStudentStatistics: (studentId: string, academicYear?: string) => Promise<AttendanceStatistics>;
  getClassAttendanceSummary: (classId: string, date: string) => Promise<ClassAttendanceSummary>;
  getClassAttendanceByDateRange: (classId: string, startDate: string, endDate: string) => Promise<any[]>;
  
  // Actions - Justifications
  submitJustification: (data: any) => Promise<void>;
  getStudentJustifications: (studentId: string) => Promise<any[]>;
  reviewJustification: (id: string, data: any) => Promise<void>;
  
  // Clear
  clearAttendance: () => void;
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  // Initial state
  sessions: [],
  records: [],
  statistics: null,
  classSummary: null,
  loading: false,
  error: null,

  // Fetch all sessions with filters
  fetchSessions: async (filters = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await attendanceService.getSessions(filters);
      set({ sessions: response.data, loading: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to fetch attendance sessions',
        loading: false 
      });
    }
  },

  // Create a new attendance session
  createSession: async (session) => {
    set({ loading: true, error: null });
    try {
      const response = await attendanceService.createSession(session);
      set((state) => ({
        sessions: [...state.sessions, response.data],
        loading: false
      }));
      return response.data;
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to create session',
        loading: false 
      });
      throw error;
    }
  },

  // Update attendance session
  updateSession: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const response = await attendanceService.updateSession(id, updates);
      set((state) => ({
        sessions: state.sessions.map(s => s.id === id ? response.data : s),
        loading: false
      }));
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to update session',
        loading: false 
      });
    }
  },

  // Delete attendance session
  deleteSession: async (id) => {
    set({ loading: true, error: null });
    try {
      await attendanceService.deleteSession(id);
      set((state) => ({
        sessions: state.sessions.filter(s => s.id !== id),
        loading: false
      }));
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to delete session',
        loading: false 
      });
    }
  },

  // Get sessions for a specific date and class
  getSessionsByDate: async (classId, date) => {
    try {
      const response = await attendanceService.getSessionsByDate(classId, date);
      return response.data;
    } catch (error: any) {
      console.error('Failed to get sessions by date:', error);
      throw error;
    }
  },

  // Mark attendance for a session
  markAttendance: async (sessionId, records) => {
    set({ loading: true, error: null });
    try {
      await attendanceService.markAttendance(sessionId, records);
      set({ loading: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to mark attendance',
        loading: false 
      });
      throw error;
    }
  },

  // Get attendance records for a session
  getSessionRecords: async (sessionId) => {
    set({ loading: true, error: null });
    try {
      const response = await attendanceService.getSessionRecords(sessionId);
      set({ records: response.data, loading: false });
      return response.data;
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to fetch records',
        loading: false 
      });
      return [];
    }
  },

  // Get attendance records for a student
  getStudentRecords: async (studentId, filters = {}) => {
    try {
      const response = await attendanceService.getStudentRecords(studentId, filters);
      return response.data;
    } catch (error: any) {
      console.error('Failed to get student records:', error);
      return [];
    }
  },

  // Get attendance records for a class on a date
  getClassRecords: async (classId, date) => {
    try {
      const response = await attendanceService.getClassRecords(classId, date);
      return response.data;
    } catch (error: any) {
      console.error('Failed to get class records:', error);
      return [];
    }
  },

  // Get attendance statistics for a student
  getStudentStatistics: async (studentId, academicYear) => {
    try {
      const response = await attendanceService.getStudentStatistics(studentId, academicYear);
      set({ statistics: response.data });
      return response.data;
    } catch (error: any) {
      console.error('Failed to get student statistics:', error);
      throw error;
    }
  },

  // Get class attendance summary for a date
  getClassAttendanceSummary: async (classId, date) => {
    try {
      const response = await attendanceService.getClassAttendanceSummary(classId, date);
      set({ classSummary: response.data });
      return response.data;
    } catch (error: any) {
      console.error('Failed to get class summary:', error);
      throw error;
    }
  },

  // Get class attendance over a date range
  getClassAttendanceByDateRange: async (classId, startDate, endDate) => {
    try {
      const response = await attendanceService.getClassAttendanceByDateRange(classId, startDate, endDate);
      return response.data;
    } catch (error: any) {
      console.error('Failed to get date range data:', error);
      return [];
    }
  },

  // Submit absence justification
  submitJustification: async (data) => {
    try {
      await attendanceService.submitJustification(data);
    } catch (error: any) {
      console.error('Failed to submit justification:', error);
      throw error;
    }
  },

  // Get justifications for a student
  getStudentJustifications: async (studentId) => {
    try {
      const response = await attendanceService.getStudentJustifications(studentId);
      return response.data;
    } catch (error: any) {
      console.error('Failed to get justifications:', error);
      return [];
    }
  },

  // Review absence justification
  reviewJustification: async (id, data) => {
    try {
      await attendanceService.reviewJustification(id, data);
    } catch (error: any) {
      console.error('Failed to review justification:', error);
      throw error;
    }
  },

  // Clear all attendance data
  clearAttendance: () => {
    set({
      sessions: [],
      records: [],
      statistics: null,
      classSummary: null,
      error: null,
      loading: false
    });
  }
}));


