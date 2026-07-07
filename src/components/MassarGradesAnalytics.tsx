// src/components/MassarGradesAnalytics.tsx - Massar Grades Analytics with Arabic Support

import React, { useState } from 'react'
import { useMassarGradesStore } from '../store/massarGradesStore'
import { parseMassarGradesFile } from '../utils/massarGradesParser'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import './MassarGradesAnalytics.css'

// Arabic translations
const ARABIC_LABELS = {
  title: 'تحليل نتائج التلاميذ',
  subtitle: 'نظام تحليل نتائج التلاميذ من ملفات مسار',
  importTab: 'استيراد النتائج',
  analyticsTab: 'لوحة التحليلات',
  studentsTab: 'تحليل التلاميذ',
  uploadTitle: 'رفع ملف مسار Excel',
  uploadHint: 'اسحب الملف وأفلته هنا أو انقر للاختيار',
  uploadFormats: 'الصيغ المدعومة: .xlsx, .xls',
  totalRows: 'إجمالي الصفوف',
  validGrades: 'النتائج الصالحة',
  errors: 'الأخطاء',
  warnings: 'التحذيرات',
  classAverage: 'معدل القسم',
  highestGrade: 'أعلى نقطة',
  lowestGrade: 'أقل نقطة',
  successRate: 'نسبة النجاح',
  totalStudents: 'عدد التلاميذ',
  excellent: 'متفوقون',
  average: 'متوسطون',
  struggling: 'متعثررون',
  gradeDistribution: 'توزيع النقط',
  performanceLevels: 'مستويات الأداء',
  rank: 'الترتيب',
  studentCode: 'رقم التلميذ',
  studentName: 'إسم التلميذ',
  grade: 'النقطة',
  performance: 'المستوى',
  clearAll: 'مسح الكل',
  save: 'حفظ',
  noData: 'لا توجد بيانات',
  loading: 'جاري المعالجة...',
  selectClass: 'اختر القسم'
}

const MassarGradesAnalytics: React.FC = () => {
  const { 
    grades, 
    addMassarGrades, 
    clearGrades, 
    getClassAnalytics, 
    getStudentAnalysis
  } = useMassarGradesStore()

  const [activeTab, setActiveTab] = useState<'import' | 'analytics' | 'students'>('import')
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [parseResult, setParseResult] = useState<any>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Get unique classes
  const uniqueClasses = Array.from(new Set(grades.map(g => g.classId)))

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsParsing(true)
    try {
      const result = await parseMassarGradesFile(file)
      setParseResult(result)
    } catch (error) {
      console.error('Parse error:', error)
      setParseResult({
        grades: [],
        errors: [{ message: 'Failed to parse file', messageAr: 'فشل معالجة الملف' }],
        warnings: [],
        summary: { totalRows: 0, validGrades: 0, errors: 1, warnings: 0 }
      })
    } finally {
      setIsParsing(false)
    }
  }

  // Handle import
  const handleImport = () => {
    if (parseResult?.grades?.length > 0) {
      addMassarGrades(parseResult.grades)
      setLastSaved(new Date())
      setActiveTab('analytics')
      setParseResult(null)
    }
  }

  // Handle clear
  const handleClear = () => {
    if (window.confirm('هل أنت متأكد من مسح جميع النتائج؟')) {
      clearGrades()
      setLastSaved(new Date())
    }
  }

  // Handle save
  const handleSave = () => {
    setLastSaved(new Date())
    const originalTitle = document.title
    document.title = '✅ تم الحفظ'
    setTimeout(() => {
      document.title = originalTitle
    }, 2000)
  }

  // Get analytics for selected class
  const analytics = selectedClassId ? getClassAnalytics(selectedClassId) : null
  const studentAnalysis = selectedClassId ? getStudentAnalysis(selectedClassId) : []

  return (
    <div className="massar-grades-page" dir="rtl">
      <div className="page-header">
        <div>
          <h1 className="page-title">{ARABIC_LABELS.title}</h1>
          <p className="page-subtitle">
            {ARABIC_LABELS.subtitle}
            {lastSaved && (
              <span className="last-saved">
                {' '}• {ARABIC_LABELS.save}: {lastSaved.toLocaleTimeString('ar-MA')}
              </span>
            )}
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleSave}>
            💾 {ARABIC_LABELS.save}
          </button>
          <button 
            className="btn btn-danger" 
            onClick={handleClear}
            disabled={grades.length === 0}
          >
            🗑️ {ARABIC_LABELS.clearAll}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          📥 {ARABIC_LABELS.importTab}
        </button>
        <button
          className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
          disabled={grades.length === 0}
        >
          📊 {ARABIC_LABELS.analyticsTab}
        </button>
        <button
          className={`tab ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
          disabled={grades.length === 0}
        >
          👨‍🎓 {ARABIC_LABELS.studentsTab}
        </button>
      </div>

      {/* Class Filter */}
      {uniqueClasses.length > 0 && (
        <div className="class-filter">
          <label>{ARABIC_LABELS.totalStudents.split(' ')[1]}:</label>
          <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
            <option value="">{ARABIC_LABELS.selectClass}</option>
            {uniqueClasses.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="import-section">
          <h2>{ARABIC_LABELS.uploadTitle}</h2>
          
          <div className="upload-area">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={isParsing}
            />
            <p className="hint">{ARABIC_LABELS.uploadHint}</p>
            <p className="formats">{ARABIC_LABELS.uploadFormats}</p>
          </div>

          {isParsing && (
            <div className="loading">
              <div className="spinner"></div>
              <p>{ARABIC_LABELS.loading}</p>
            </div>
          )}

          {parseResult && (
            <div className="parse-result">
              <div className="summary-cards">
                <div className="card">
                  <div className="card-value">{parseResult.summary.totalRows}</div>
                  <div className="card-label">{ARABIC_LABELS.totalRows}</div>
                </div>
                <div className="card success">
                  <div className="card-value">{parseResult.summary.validGrades}</div>
                  <div className="card-label">{ARABIC_LABELS.validGrades}</div>
                </div>
                <div className="card error">
                  <div className="card-value">{parseResult.summary.errors}</div>
                  <div className="card-label">{ARABIC_LABELS.errors}</div>
                </div>
                <div className="card warning">
                  <div className="card-value">{parseResult.summary.warnings}</div>
                  <div className="card-label">{ARABIC_LABELS.warnings}</div>
                </div>
              </div>

              {parseResult.errors.length > 0 && (
                <div className="errors-section">
                  <h3>❌ {ARABIC_LABELS.errors}</h3>
                  <div className="errors-list">
                    {parseResult.errors.slice(0, 5).map((error: any, i: number) => (
                      <div key={i} className="error-item">
                        <span>الصف {error.row}:</span>
                        <span>{error.messageAr || error.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button className="btn btn-primary" onClick={handleImport}>
                📥 استيراد {parseResult.summary.validGrades} نتيجة
              </button>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && analytics && (
        <div className="analytics-section">
          {/* Summary Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <div className="stat-value">{analytics.averageGrade}</div>
                <div className="stat-label">{ARABIC_LABELS.classAverage}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📈</div>
              <div className="stat-info">
                <div className="stat-value">{analytics.highestGrade}</div>
                <div className="stat-label">{ARABIC_LABELS.highestGrade}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📉</div>
              <div className="stat-info">
                <div className="stat-value">{analytics.lowestGrade}</div>
                <div className="stat-label">{ARABIC_LABELS.lowestGrade}</div>
              </div>
            </div>

            <div className="stat-card success">
              <div className="stat-icon">✅</div>
              <div className="stat-info">
                <div className="stat-value">{analytics.successRate}%</div>
                <div className="stat-label">{ARABIC_LABELS.successRate}</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">👨‍🎓</div>
              <div className="stat-info">
                <div className="stat-value">{analytics.totalStudents}</div>
                <div className="stat-label">{ARABIC_LABELS.totalStudents}</div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="charts-grid">
            {/* Grade Distribution */}
            <div className="chart-card">
              <h3>{ARABIC_LABELS.gradeDistribution}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.gradeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rangeAr" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4a90d9" name="عدد التلاميذ" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Performance Levels */}
            <div className="chart-card">
              <h3>{ARABIC_LABELS.performanceLevels}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: ARABIC_LABELS.excellent, value: analytics.excellentCount, color: '#4caf50' },
                      { name: ARABIC_LABELS.average, value: analytics.averageCount, color: '#ff9800' },
                      { name: ARABIC_LABELS.struggling, value: analytics.strugglingCount, color: '#f44336' }
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#4caf50" />
                    <Cell fill="#ff9800" />
                    <Cell fill="#f44336" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Students Tab */}
      {activeTab === 'students' && selectedClassId && (
        <div className="students-section">
          <h2>{ARABIC_LABELS.studentsTab}</h2>
          
          <div className="students-table-container">
            <table className="students-table">
              <thead>
                <tr>
                  <th>{ARABIC_LABELS.rank}</th>
                  <th>{ARABIC_LABELS.studentCode}</th>
                  <th>{ARABIC_LABELS.studentName}</th>
                  <th>{ARABIC_LABELS.grade}</th>
                  <th>{ARABIC_LABELS.performance}</th>
                </tr>
              </thead>
              <tbody>
                {studentAnalysis.map((student) => (
                  <tr key={student.studentCode}>
                    <td>{student.rank}</td>
                    <td className="code-cell">{student.studentCode}</td>
                    <td>{student.studentName}</td>
                    <td className={`grade-value ${student.grade >= 10 ? 'grade-pass' : 'grade-fail'}`}>
                      {student.grade}/20
                    </td>
                    <td>
                      <span className={`badge badge-${student.performanceLevel}`}>
                        {student.performanceLevelAr}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedClassId && grades.length > 0 && activeTab !== 'import' && (
        <div className="empty-state">
          <span className="empty-icon">📊</span>
          <h3>{ARABIC_LABELS.noData}</h3>
          <p>الرجاء اختيار القسم لعرض التحليلات</p>
        </div>
      )}
    </div>
  )
}

export default MassarGradesAnalytics

