// Attendance Dashboard Widget
// src/components/attendance/AttendanceDashboardWidget.tsx

import React, { useState, useEffect } from 'react';
import { useSchoolStore } from '../../store/schoolStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { attendanceService } from '../../services/attendance.service';
import { t } from '../../utils/translations';
import './AttendanceDashboardWidget.css';

export const AttendanceDashboardWidget: React.FC = () => {
  const { language, classes, students } = useSchoolStore();
  const { getClassAttendanceSummary } = useAttendanceStore();
  const [todayStats, setTodayStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lowAttendanceStudents, setLowAttendanceStudents] = useState<any[]>([]);

  useEffect(() => {
    loadTodayStats();
  }, []);

  const loadTodayStats = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // Calculate real stats from students and attendance data
      const totalStudents = students.length;
      
      // Get today's attendance for all classes
      let totalPresent = 0;
      let totalAbsent = 0;
      
      for (const classItem of classes) {
        try {
          const summary = await getClassAttendanceSummary(classItem.id, today);
          if (summary) {
            totalPresent += summary.present || 0;
            totalAbsent += summary.absent || 0;
          }
        } catch (error) {
          console.error(`Failed to get attendance for class ${classItem.id}:`, error);
        }
      }

      const overallRate = totalStudents > 0 
        ? Math.round((totalPresent / totalStudents) * 100 * 10) / 10 
        : 0;

      setTodayStats({
        total_students: totalStudents,
        total_present: totalPresent,
        total_absent: totalAbsent,
        overall_rate: overallRate
      });

      // Get students with low attendance (< 75%)
      const lowAttendanceList: any[] = [];
      
      for (const student of students) {
        try {
          const studentStats = await attendanceService.getStudentRecords(student.id);
          if (studentStats.data && studentStats.data.length > 0) {
            const totalSessions = studentStats.data.length;
            const presentCount = studentStats.data.filter((r: any) => r.status === 'present' || r.status === 'late').length;
            const attendanceRate = Math.round((presentCount / totalSessions) * 100 * 10) / 10;
            
            if (attendanceRate < 75) {
              const studentClass = classes.find(c => c.id === student.classId);
              lowAttendanceList.push({
                student_name: student.name,
                class_name: studentClass?.name || 'Unknown',
                attendance_rate: attendanceRate
              });
            }
          }
        } catch (error) {
          console.error(`Failed to get attendance for student ${student.id}:`, error);
        }
      }

      setLowAttendanceStudents(lowAttendanceList.slice(0, 5));
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="attendance-widget loading">
        <div className="spinner"></div>
        <p>Loading attendance data...</p>
      </div>
    );
  }

  return (
    <div className="attendance-widget">
      <div className="widget-header">
        <h3>📊 {t('attendance.today', language) || 'Today\'s Attendance'}</h3>
        <span className="date">{new Date().toLocaleDateString()}</span>
      </div>

      {/* Today's Stats */}
      <div className="today-stats">
        <div className="stat-card large">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-value">{todayStats?.total_students || 0}</div>
            <div className="stat-label">Total Students</div>
          </div>
        </div>

        <div className="stat-card present">
          <div className="stat-icon">✓</div>
          <div className="stat-content">
            <div className="stat-value">{todayStats?.total_present || 0}</div>
            <div className="stat-label">Present</div>
          </div>
        </div>

        <div className="stat-card absent">
          <div className="stat-icon">✗</div>
          <div className="stat-content">
            <div className="stat-value">{todayStats?.total_absent || 0}</div>
            <div className="stat-label">Absent</div>
          </div>
        </div>

        <div className={`stat-card rate ${todayStats?.overall_rate >= 90 ? 'excellent' : todayStats?.overall_rate >= 75 ? 'good' : 'warning'}`}>
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-value">{todayStats?.overall_rate || 0}%</div>
            <div className="stat-label">Attendance Rate</div>
          </div>
        </div>
      </div>

      {/* Low Attendance Alerts */}
      {lowAttendanceStudents.length > 0 && (
        <div className="low-attendance-alerts">
          <div className="alert-header">
            <h4>⚠️ {t('attendance.lowAttendance', language) || 'Low Attendance Alerts'}</h4>
            <span className="badge">{lowAttendanceStudents.length}</span>
          </div>

          <div className="alerts-list">
            {lowAttendanceStudents.map((student, index) => (
              <div key={index} className="alert-item">
                <div className="student-info">
                  <div className="avatar">
                    {student.student_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                  </div>
                  <div className="details">
                    <div className="name">{student.student_name}</div>
                    <div className="class">{student.class_name}</div>
                  </div>
                </div>
                <div className={`rate-badge ${student.attendance_rate < 70 ? 'critical' : 'warning'}`}>
                  {student.attendance_rate}%
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-link btn-block">
            View All Alerts →
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="action-btn">
          <span className="icon">📝</span>
          <span>Mark Attendance</span>
        </button>
        <button className="action-btn">
          <span className="icon">📊</span>
          <span>View Reports</span>
        </button>
        <button className="action-btn">
          <span className="icon">📱</span>
          <span>Send SMS</span>
        </button>
      </div>
    </div>
  );
};

export default AttendanceDashboardWidget;

