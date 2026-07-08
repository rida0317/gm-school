// Attendance Calendar Component
// src/components/attendance/AttendanceCalendar.tsx

import React, { useState, useEffect } from 'react';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useSchoolStore } from '../../store/schoolStore';
import { t } from '../../utils/translations';
import { AttendanceCalendarProps, StudentAttendanceRecord } from './types';
import './AttendanceCalendar.css';

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
  classId,
  date,
  onAttendanceMarked
}) => {
  const { language } = useSchoolStore();
  const {
    sessions,
    records,
    loading,
    error,
    getSessionsByDate,
    getSessionRecords,
    markAttendance
  } = useAttendanceStore();

  const [selectedSession, setSelectedSession] = useState<string>('');
  const [attendanceData, setAttendanceData] = useState<StudentAttendanceRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch sessions for the selected date
  useEffect(() => {
    if (classId && date) {
      loadSessionsForDate(classId, date);
    }
  }, [classId, date]);

  // Load attendance records when session is selected
  useEffect(() => {
    if (selectedSession) {
      loadAttendanceRecords(selectedSession);
    }
  }, [selectedSession]);

  const loadSessionsForDate = async (clsId: string, selectedDate: string) => {
    try {
      const sessionsData = await getSessionsByDate(clsId, selectedDate);
      if (sessionsData.length > 0) {
        setSelectedSession(sessionsData[0].id);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const loadAttendanceRecords = async (sessionId: string) => {
    try {
      const recordsData = await getSessionRecords(sessionId);
      setAttendanceData(recordsData);
    } catch (error) {
      console.error('Failed to load attendance records:', error);
    }
  };

  const handleStatusChange = (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    setAttendanceData(prev =>
      prev.map(record =>
        record.student_id === studentId
          ? { ...record, status }
          : record
      )
    );
  };

  const handleSaveAttendance = async () => {
    if (!selectedSession) return;

    setIsSaving(true);
    try {
      const recordsToSave = attendanceData.map(record => ({
        student_id: record.student_id,
        status: record.status,
        notes: record.notes
      }));

      await markAttendance(selectedSession, recordsToSave);
      
      if (onAttendanceMarked) {
        onAttendanceMarked();
      }
    } catch (error) {
      console.error('Failed to save attendance:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getAttendanceStats = () => {
    const total = attendanceData.length;
    const present = attendanceData.filter(r => r.status === 'present').length;
    const absent = attendanceData.filter(r => r.status === 'absent').length;
    const late = attendanceData.filter(r => r.status === 'late').length;
    const excused = attendanceData.filter(r => r.status === 'excused').length;

    return { total, present, absent, late, excused };
  };

  const stats = getAttendanceStats();

  if (loading) {
    return (
      <div className="attendance-calendar-loading">
        <div className="spinner"></div>
        <p>{t('common.loading', language)}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="attendance-calendar-empty">
        <div className="empty-icon">📅</div>
        <h3>{t('attendance.noSessions', language) || 'No sessions found'}</h3>
        <p>{t('attendance.createSessionFirst', language) || 'Create a session for this date first'}</p>
      </div>
    );
  }

  return (
    <div className="attendance-calendar">
      {/* Session Selector */}
      <div className="session-selector">
        <label>{t('attendance.selectSession', language) || 'Select Session'}</label>
        <select
          value={selectedSession}
          onChange={(e) => setSelectedSession(e.target.value)}
        >
          {sessions.map(session => (
            <option key={session.id} value={session.id}>
              {session.period} - {session.subject_name || 'N/A'} ({session.start_time} - {session.end_time})
            </option>
          ))}
        </select>
      </div>

      {/* Stats Cards */}
      <div className="attendance-stats">
        <div className="stat-card stat-total">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">{t('attendance.totalStudents', language)}</div>
        </div>
        <div className="stat-card stat-present">
          <div className="stat-value">{stats.present}</div>
          <div className="stat-label">{t('attendance.present', language)}</div>
        </div>
        <div className="stat-card stat-absent">
          <div className="stat-value">{stats.absent}</div>
          <div className="stat-label">{t('attendance.absent', language)}</div>
        </div>
        <div className="stat-card stat-late">
          <div className="stat-value">{stats.late}</div>
          <div className="stat-label">{t('attendance.late', language)}</div>
        </div>
        <div className="stat-card stat-excused">
          <div className="stat-value">{stats.excused}</div>
          <div className="stat-label">{t('attendance.excused', language)}</div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="attendance-table-container">
        <table className="attendance-table">
          <thead>
            <tr>
              <th className="col-student">{t('attendance.student', language)}</th>
              <th className="col-status">{t('attendance.status', language)}</th>
              <th className="col-notes">{t('attendance.notes', language)}</th>
            </tr>
          </thead>
          <tbody>
            {attendanceData.map((record) => (
              <tr key={record.student_id} className={`status-${record.status}`}>
                <td className="student-info">
                  <div className="student-name">{record.student_name}</div>
                  {record.code_massar && (
                    <div className="student-code">{record.code_massar}</div>
                  )}
                </td>
                <td>
                  <div className="status-buttons">
                    <button
                      className={`status-btn present ${record.status === 'present' ? 'active' : ''}`}
                      onClick={() => handleStatusChange(record.student_id, 'present')}
                      title={t('attendance.present', language)}
                    >
                      ✓
                    </button>
                    <button
                      className={`status-btn absent ${record.status === 'absent' ? 'active' : ''}`}
                      onClick={() => handleStatusChange(record.student_id, 'absent')}
                      title={t('attendance.absent', language)}
                    >
                      ✗
                    </button>
                    <button
                      className={`status-btn late ${record.status === 'late' ? 'active' : ''}`}
                      onClick={() => handleStatusChange(record.student_id, 'late')}
                      title={t('attendance.late', language)}
                    >
                      L
                    </button>
                    <button
                      className={`status-btn excused ${record.status === 'excused' ? 'active' : ''}`}
                      onClick={() => handleStatusChange(record.student_id, 'excused')}
                      title={t('attendance.excused', language)}
                    >
                      E
                    </button>
                  </div>
                </td>
                <td>
                  <input
                    type="text"
                    className="notes-input"
                    placeholder={t('attendance.addNotes', language) || 'Add notes...'}
                    value={record.notes || ''}
                    onChange={(e) => {
                      setAttendanceData(prev =>
                        prev.map(r =>
                          r.student_id === record.student_id
                            ? { ...r, notes: e.target.value }
                            : r
                        )
                      );
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save Button */}
      <div className="attendance-actions">
        <button
          className="btn btn-primary btn-save"
          onClick={handleSaveAttendance}
          disabled={isSaving || attendanceData.length === 0}
        >
          {isSaving ? '⏳ Saving...' : '💾 Save Attendance'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

export default AttendanceCalendar;

