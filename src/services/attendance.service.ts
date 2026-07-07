// src/services/attendance.service.ts - Attendance API Service (Supabase Version)

import { supabase } from '../lib/supabaseClient';


export const attendanceService = {
  // ============================================
  // ATTENDANCE SESSIONS
  // ============================================

  /**
   * Get all attendance sessions with filters
   */
  async getSessions(filters?: {
    classId?: string;
    teacherId?: string;
    subjectId?: string;
    startDate?: string;
    endDate?: string;
    academicYear?: string;
  }) {
    let query = supabase
      .from('attendance_sessions')
      .select(`
        *,
        classes(name),
        teachers(name),
        subjects(name)
      `);

    if (filters?.classId) query = query.eq('class_id', filters.classId);
    if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId);
    if (filters?.subjectId) query = query.eq('subject_id', filters.subjectId);
    if (filters?.startDate) query = query.gte('date', filters.startDate);
    if (filters?.endDate) query = query.lte('date', filters.endDate);

    const { data, error } = await query.order('date', { ascending: false });
    if (error) throw error;
    return { data };
  },

  /**
   * Create a new attendance session
   */
  async createSession(session: {
    class_id: string;
    subject_id: string;
    teacher_id: string;
    date: string;
    period: number;
    start_time?: string;
    end_time?: string;
    room_id?: string;
  }) {
    const schoolId = 'default';
    if (!schoolId) throw new Error('No school selected');

    const { data, error } = await supabase
      .from('attendance_sessions')
      .insert([{
        ...session,
        school_id: schoolId
      }])
      .select()
      .single();

    if (error) throw error;
    return { data };
  },

  /**
   * Get a specific attendance session
   */
  async getSessionById(id: string) {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select(`
        *,
        classes(name),
        teachers(name),
        subjects(name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return { data };
  },

  /**
   * Update an attendance session
   */
  async updateSession(id: string, updates: any) {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { data };
  },

  /**
   * Delete an attendance session
   */
  async deleteSession(id: string) {
    const { error } = await supabase
      .from('attendance_sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { data: { success: true } };
  },

  // ============================================
  // MARK ATTENDANCE
  // ============================================

  /**
   * Mark attendance for a session
   */
  async markAttendance(sessionId: string, records: Array<{
    student_id: string;
    status: 'present' | 'absent' | 'late' | 'justified';
    check_in_time?: string;
    check_out_time?: string;
    notes?: string;
  }>) {
    const schoolId = 'default';
    if (!schoolId) throw new Error('No school selected');

    // Fetch session info to get class_id and date
    const { data: session } = await this.getSessionById(sessionId);

    const formattedRecords = records.map(record => ({
      student_id: record.student_id,
      school_id: schoolId,
      class_id: session.class_id,
      date: session.date,
      status: record.status,
      reason: record.notes, // Mapping notes to reason
      // NOTE: session_id is NOT stored in the attendance table due to schema limitation
      // Records are linked indirectly via class_id + date + period matching
      // TODO: Add session_id column to attendance table for direct linking
    }));

    const { data, error } = await supabase
      .from('attendance')
      .upsert(formattedRecords)
      .select();

    if (error) throw error;
    return { data };
  },

  /**
   * Get attendance records for a student
   */
  async getStudentRecords(studentId: string, filters?: {
    startDate?: string;
    endDate?: string;
  }) {
    let query = supabase
      .from('attendance')
      .select('*')
      .eq('student_id', studentId);

    if (filters?.startDate) query = query.gte('date', filters.startDate);
    if (filters?.endDate) query = query.lte('date', filters.endDate);

    const { data, error } = await query.order('date', { ascending: false });
    if (error) throw error;
    return { data };
  }
};

