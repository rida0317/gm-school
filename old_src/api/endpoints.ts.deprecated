// API Endpoints Configuration
// src/api/endpoints.ts

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
    REFRESH: `${API_BASE_URL}/auth/refresh`,
    LOGOUT: `${API_BASE_URL}/auth/logout`,
    ME: `${API_BASE_URL}/auth/me`
  },

  // Users
  USERS: `${API_BASE_URL}/users`,

  // Schools
  SCHOOLS: `${API_BASE_URL}/schools`,

  // Students
  STUDENTS: `${API_BASE_URL}/students`,

  // Teachers
  TEACHERS: `${API_BASE_URL}/teachers`,

  // Classes
  CLASSES: `${API_BASE_URL}/classes`,

  // Subjects
  SUBJECTS: `${API_BASE_URL}/subjects`,

  // Grades
  GRADES: {
    LIST: `${API_BASE_URL}/grades`,
    IMPORT: `${API_BASE_URL}/grades/import`,
    EXPORT_MASSAR: `${API_BASE_URL}/grades/export/massar`,
    ANALYTICS: `${API_BASE_URL}/analytics`
  },

  // Attendance
  ATTENDANCE: {
    SESSIONS: `${API_BASE_URL}/attendance/sessions`,
    MARK: `${API_BASE_URL}/attendance/mark`,
    STUDENTS: `${API_BASE_URL}/attendance/students`,
    CLASSES: `${API_BASE_URL}/attendance/classes`,
    SCHOOL: `${API_BASE_URL}/attendance/school`,
    ALERTS: `${API_BASE_URL}/attendance/alerts`,
    JUSTIFICATIONS: `${API_BASE_URL}/attendance/justifications`,
    REPORTS: `${API_BASE_URL}/attendance/reports`,
    ANOMALIES: `${API_BASE_URL}/attendance/anomalies`
  },

  // Timetable
  TIMETABLE: `${API_BASE_URL}/timetable`,

  // Replacements
  REPLACEMENTS: `${API_BASE_URL}/replacements`,

  // Messages
  MESSAGES: `${API_BASE_URL}/messages`,

  // Analytics
  ANALYTICS: {
    DASHBOARD: `${API_BASE_URL}/analytics/dashboard`,
    CLASS: `${API_BASE_URL}/analytics/class`,
    STUDENT: `${API_BASE_URL}/analytics/student`
  },

  // Reports
  REPORTS: {
    BULLETIN: `${API_BASE_URL}/reports/bulletin`,
    CLASS: `${API_BASE_URL}/reports/class`,
    ATTENDANCE: `${API_BASE_URL}/reports/attendance`
  },

  // Massar
  MASSAR: {
    IMPORT: `${API_BASE_URL}/massar/import`,
    EXPORT: `${API_BASE_URL}/massar/export`
  },

  // Files
  FILES: {
    UPLOAD: `${API_BASE_URL}/files/upload`,
    DOWNLOAD: `${API_BASE_URL}/files`
  }
} as const;

export default ENDPOINTS;
