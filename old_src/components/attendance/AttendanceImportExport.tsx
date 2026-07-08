// Attendance Import/Export Component
// src/components/attendance/AttendanceImportExport.tsx

import React, { useState } from 'react';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useSchoolStore } from '../../store/schoolStore';
import { t } from '../../utils/translations';
import './AttendanceImportExport.css';

interface AttendanceImportExportProps {
  classId: string;
  onSuccess?: () => void;
}

export const AttendanceImportExport: React.FC<AttendanceImportExportProps> = ({
  classId,
  onSuccess
}) => {
  const { language } = useSchoolStore();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showTemplateDownload, setShowTemplateDownload] = useState(false);
  const [templateDate, setTemplateDate] = useState(new Date().toISOString().split('T')[0]);
  const [templatePeriod, setTemplatePeriod] = useState(1);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!importFile || !classId) return;

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('classId', classId);
      formData.append('academicYear', '2024-2025');

      // API call would go here
      // const response = await attendanceService.importFromExcel(formData);
      // setImportResult(response.data);
      
      // Mock response for demo
      setImportResult({
        success: true,
        imported: 25,
        failed: 2,
        summary: {
          total: 27,
          present: 23,
          absent: 2,
          late: 1,
          excused: 1
        },
        errors: [
          { row: 15, error: 'Student not found' }
        ]
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // API call would go here
      // const blob = await attendanceService.exportToExcel(classId, startDate, endDate);
      
      // Mock download
      const link = document.createElement('a');
      link.href = '#';
      link.download = `attendance_export_${classId}_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      // API call would go here
      const link = document.createElement('a');
      link.href = '#';
      link.download = `attendance_template_${classId}.xlsx`;
      link.click();
    } catch (error) {
      console.error('Template download failed:', error);
    }
  };

  return (
    <div className="attendance-import-export">
      <div className="ie-header">
        <h3>{t('attendance.importExport', language) || 'Import/Export'}</h3>
      </div>

      {/* Import Section */}
      <div className="ie-section">
        <h4>📥 {t('attendance.import', language) || 'Import from Excel'}</h4>
        
        <div className="import-controls">
          <div className="file-input-wrapper">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              id="import-file"
              disabled={isImporting}
            />
            <label htmlFor="import-file" className="file-label">
              {importFile ? importFile.name : t('attendance.chooseFile', language) || 'Choose File'}
            </label>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!importFile || isImporting || !classId}
          >
            {isImporting ? '⏳ Importing...' : '📥 Import'}
          </button>
        </div>

        <div className="template-section">
          <button
            className="btn btn-link"
            onClick={() => setShowTemplateDownload(!showTemplateDownload)}
          >
            📋 {t('attendance.downloadTemplate', language) || 'Download Template'}
          </button>

          {showTemplateDownload && (
            <div className="template-options">
              <div className="option-row">
                <label>{t('attendance.date', language) || 'Date'}:</label>
                <input
                  type="date"
                  value={templateDate}
                  onChange={(e) => setTemplateDate(e.target.value)}
                />
              </div>
              <div className="option-row">
                <label>{t('attendance.period', language) || 'Period'}:</label>
                <select
                  value={templatePeriod}
                  onChange={(e) => setTemplatePeriod(parseInt(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(p => (
                    <option key={p} value={p}>Period {p}</option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleDownloadTemplate}
              >
                📥 Download Template
              </button>
            </div>
          )}
        </div>

        {importResult && (
          <div className={`import-result ${importResult.success ? 'success' : 'error'}`}>
            <div className="result-header">
              {importResult.success ? '✅ Import Successful' : '⚠️ Import with Errors'}
            </div>
            <div className="result-stats">
              <div className="stat">Imported: {importResult.imported}</div>
              <div className="stat failed">Failed: {importResult.failed}</div>
            </div>
            {importResult.summary && (
              <div className="result-summary">
                <span className="present">✓ Present: {importResult.summary.present}</span>
                <span className="absent">✗ Absent: {importResult.summary.absent}</span>
                <span className="late">L Late: {importResult.summary.late}</span>
                <span className="excused">E Excused: {importResult.summary.excused}</span>
              </div>
            )}
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="result-errors">
                <strong>Errors:</strong>
                <ul>
                  {importResult.errors.map((err: any, i: number) => (
                    <li key={i}>
                      Row {err.row}: {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export Section */}
      <div className="ie-section">
        <h4>📤 {t('attendance.export', language) || 'Export to Excel'}</h4>
        <p className="help-text">
          {t('attendance.exportHelp', language) || 'Export attendance data for a date range'}
        </p>
        
        <button
          className="btn btn-success"
          onClick={handleExport}
          disabled={isExporting || !classId}
        >
          {isExporting ? '⏳ Exporting...' : '📤 Export'}
        </button>
      </div>
    </div>
  );
};

export default AttendanceImportExport;

