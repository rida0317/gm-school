// Attendance Hook
// src/hooks/useAttendance.ts

import { useCallback } from 'react';
import { useAttendanceStore } from '../store/attendanceStore';
import { attendanceService } from '../services/attendance.service';

/**
 * Custom hook for attendance operations
 * Provides convenient methods for common attendance tasks
 */
export const useAttendance = () => {
  const {
    sessions,
    records,
    statistics,
    classSummary,
    loading,
    error,
    fetchSessions,
    createSession,
    updateSession,
    deleteSession,
    markAttendance,
    getSessionRecords,
    getStudentStatistics,
    getClassAttendanceSummary,
    submitJustification,
    reviewJustification,
    clearAttendance
  } = useAttendanceStore();

  /**
   * Quick method to mark all students as present
   */
  const markAllPresent = useCallback(async (sessionId: string, studentIds: string[]) => {
    const records = studentIds.map(id => ({
      student_id: id,
      status: 'present' as const
    }));
    await markAttendance(sessionId, records);
  }, [markAttendance]);

  /**
   * Quick method to mark attendance from a list
   */
  const markAttendanceFromList = useCallback(async (
    sessionId: string,
    presentIds: string[],
    absentIds: string[] = [],
    lateIds: string[] = []
  ) => {
    const records = [
      ...presentIds.map(id => ({ student_id: id, status: 'present' as const })),
      ...absentIds.map(id => ({ student_id: id, status: 'absent' as const })),
      ...lateIds.map(id => ({ student_id: id, status: 'late' as const }))
    ];
    await markAttendance(sessionId, records);
  }, [markAttendance]);

  /**
   * Get today's attendance summary for a class
   */
  const getTodaySummary = useCallback(async (classId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return getClassAttendanceSummary(classId, today);
  }, [getClassAttendanceSummary]);

  /**
   * Check if a student has low attendance
   */
  const hasLowAttendance = useCallback(async (studentId: string, threshold = 75) => {
    try {
      const stats = await getStudentStatistics(studentId);
      return stats.attendance_rate < threshold;
    } catch {
      return false;
    }
  }, [getStudentStatistics]);

  /**
   * Submit a medical justification
   */
  const submitMedicalJustification = useCallback(async (
    studentId: string,
    startDate: string,
    endDate: string,
    reason: string,
    documentUrl?: string
  ) => {
    await submitJustification({
      student_id: studentId,
      start_date: startDate,
      end_date: endDate,
      reason,
      justification_type: 'medical',
      document_url: documentUrl
    });
  }, [submitJustification]);

  /**
   * Approve a justification
   */
  const approveJustification = useCallback(async (id: string, notes?: string) => {
    await reviewJustification(id, { status: 'approved', review_notes: notes });
  }, [reviewJustification]);

  /**
   * Reject a justification
   */
  const rejectJustification = useCallback(async (id: string, notes?: string) => {
    await reviewJustification(id, { status: 'rejected', review_notes: notes });
  }, [reviewJustification]);

  /**
   * Create a session for today
   */
  const createTodaySession = useCallback(async (
    classId: string,
    subjectId: string,
    teacherId: string,
    period: number,
    startTime?: string,
    endTime?: string,
    roomId?: string
  ) => {
    const today = new Date().toISOString().split('T')[0];
    return createSession({
      class_id: classId,
      subject_id: subjectId,
      teacher_id: teacherId,
      date: today,
      period,
      start_time: startTime,
      end_time: endTime,
      room_id: roomId
    });
  }, [createSession]);

  /**
   * Get attendance rate as a formatted string
   */
  const getAttendanceRate = useCallback((stats: any) => {
    if (!stats || !stats.attendance_rate) return 'N/A';
    return `${stats.attendance_rate.toFixed(1)}%`;
  }, []);

  /**
   * Get status color for UI
   */
  const getStatusColor = useCallback((status: string) => {
    const colors: Record<string, string> = {
      present: '#28a745',
      absent: '#dc3545',
      late: '#ffc107',
      excused: '#17a2b8'
    };
    return colors[status] || '#6c757d';
  }, []);

  /**
   * Check if date is in the past
   */
  const isPastDate = useCallback((date: string) => {
    const today = new Date().toISOString().split('T')[0];
    return date < today;
  }, []);

  /**
   * Calculate attendance streak (consecutive present days)
   */
  const calculateStreak = useCallback((studentRecords: any[]) => {
    if (!studentRecords || studentRecords.length === 0) return 0;

    let streak = 0;
    const sorted = [...studentRecords].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    for (const record of sorted) {
      if (record.status === 'present') {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }, []);

  return {
    // State
    sessions,
    records,
    statistics,
    classSummary,
    loading,
    error,

    // Basic operations
    fetchSessions,
    createSession,
    updateSession,
    deleteSession,
    markAttendance,
    getSessionRecords,
    getStudentStatistics,
    getClassAttendanceSummary,
    submitJustification,
    reviewJustification,
    clearAttendance,

    // Convenience methods
    markAllPresent,
    markAttendanceFromList,
    getTodaySummary,
    hasLowAttendance,
    submitMedicalJustification,
    approveJustification,
    rejectJustification,
    createTodaySession,
    getAttendanceRate,
    getStatusColor,
    isPastDate,
    calculateStreak,

    // Service direct access (for advanced usage)
    service: attendanceService
  };
};

export default useAttendance;

