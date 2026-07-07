// src/services/export.ts - Enhanced export functionality
// Now includes report card (bulletin de notes) generation

import type { SchoolData, Teacher, SchoolClass, Timetable, Student, Grade, StudentDetailAnalytics } from '../types'
import { generateReportCardPDF, generateSimpleReportCard, downloadPDF, generateReportCardFilename } from '../utils/pdfTemplates'

export interface ReportCardExportOptions {
  student: Student;
  grades: Grade[];
  analytics?: StudentDetailAnalytics;
  schoolName: string;
  academicYear: string;
  className: string;
  period: 'Trimestre 1' | 'Trimestre 2' | 'Trimestre 3' | 'Semestre 1' | 'Semestre 2';
  principalName?: string;
  includeDetails?: boolean;
}

export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv' | 'json';
  includeTeachers?: boolean;
  includeClasses?: boolean;
  includeTimetables?: boolean;
  includeStudents?: boolean;
  includeAnalytics?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  customFields?: string[];
  branding?: {
    schoolName: string;
    logo?: string;
    themeColor?: string;
  };
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'pdf' | 'excel' | 'csv';
  layout: 'standard' | 'detailed' | 'summary';
  customFields: string[];
  branding: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExportProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  downloadUrl?: string;
  error?: string;
}

export class ExportService {
  private schoolData: SchoolData;
  private templates: ExportTemplate[] = [];

  constructor(schoolData: SchoolData) {
    this.schoolData = schoolData;
    this.loadDefaultTemplates();
  }

  /**
   * Export data with specified options
   */
  public async exportData(options: ExportOptions): Promise<ExportProgress> {
    const progress: ExportProgress = {
      status: 'processing',
      progress: 0,
      message: 'Starting export...'
    };

    try {
      // Validate options
      this.validateExportOptions(options);

      // Update progress
      progress.progress = 10;
      progress.message = 'Validating export options...';

      // Generate export data
      const exportData = await this.generateExportData(options);
      progress.progress = 50;
      progress.message = 'Generating export data...';

      // Create export file
      const exportFile = await this.createExportFile(exportData, options);
      progress.progress = 90;
      progress.message = 'Creating export file...';

      // Generate download URL
      const downloadUrl = await this.generateDownloadUrl(exportFile, options);
      progress.progress = 100;
      progress.status = 'completed';
      progress.message = 'Export completed successfully!';
      progress.downloadUrl = downloadUrl;

      return progress;

    } catch (error) {
      progress.status = 'failed';
      progress.error = error instanceof Error ? error.message : 'Unknown error occurred';
      progress.message = 'Export failed';
      return progress;
    }
  }

  /**
   * Create custom export template
   */
  public createTemplate(template: Omit<ExportTemplate, 'id' | 'createdAt' | 'updatedAt'>): ExportTemplate {
    const newTemplate: ExportTemplate = {
      ...template,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.templates.push(newTemplate);
    this.saveTemplates();
    return newTemplate;
  }

  /**
   * Update existing template
   */
  public updateTemplate(templateId: string, updates: Partial<ExportTemplate>): ExportTemplate | null {
    const templateIndex = this.templates.findIndex(t => t.id === templateId);
    if (templateIndex === -1) {
      return null;
    }

    this.templates[templateIndex] = {
      ...this.templates[templateIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveTemplates();
    return this.templates[templateIndex];
  }

  /**
   * Delete template
   */
  public deleteTemplate(templateId: string): boolean {
    const templateIndex = this.templates.findIndex(t => t.id === templateId);
    if (templateIndex === -1) {
      return false;
    }

    this.templates.splice(templateIndex, 1);
    this.saveTemplates();
    return true;
  }

  /**
   * Get all templates
   */
  public getTemplates(): ExportTemplate[] {
    return this.templates;
  }

  /**
   * Get template by ID
   */
  public getTemplate(templateId: string): ExportTemplate | null {
    return this.templates.find(t => t.id === templateId) || null;
  }

  /**
   * Export using template
   */
  public async exportWithTemplate(templateId: string, customOptions?: Partial<ExportOptions>): Promise<ExportProgress> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const options: ExportOptions = {
      format: template.format,
      includeTeachers: template.customFields.includes('teachers'),
      includeClasses: template.customFields.includes('classes'),
      includeTimetables: template.customFields.includes('timetables'),
      includeStudents: template.customFields.includes('students'),
      includeAnalytics: template.customFields.includes('analytics'),
      branding: template.branding ? {
        schoolName: this.schoolData.schoolName,
        logo: this.schoolData.logo,
        themeColor: '#3498db'
      } : undefined,
      ...customOptions
    };

    return this.exportData(options);
  }

  /**
   * Generate PDF export
   */
  private async generatePDFExport(data: any, options: ExportOptions): Promise<Blob> {
    // This would use a PDF generation library like jsPDF
    // For now, return a mock PDF blob
    const content = this.formatPDFContent(data, options);
    return new Blob([content], { type: 'application/pdf' });
  }

  /**
   * Generate Excel export
   */
  private async generateExcelExport(data: any, options: ExportOptions): Promise<Blob> {
    // This would use a library like SheetJS (xlsx)
    // For now, return a mock Excel blob
    const content = this.formatExcelContent(data, options);
    return new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /**
   * Generate CSV export
   */
  private async generateCSVExport(data: any, options: ExportOptions): Promise<Blob> {
    const content = this.formatCSVContent(data, options);
    return new Blob([content], { type: 'text/csv' });
  }

  /**
   * Generate JSON export
   */
  private async generateJSONExport(data: any, options: ExportOptions): Promise<Blob> {
    const content = JSON.stringify(data, null, 2);
    return new Blob([content], { type: 'application/json' });
  }

  /**
   * Format PDF content
   */
  private formatPDFContent(data: any, options: ExportOptions): string {
    // This would use a PDF generation library
    // For now, return mock content
    return `
# ${options.branding?.schoolName || 'School Management System'} Export

## Export Details
- Format: PDF
- Date: ${new Date().toISOString()}
- Includes: ${Object.keys(data).join(', ')}

## Data Summary
${JSON.stringify(data, null, 2)}
    `;
  }

  /**
   * Format Excel content
   */
  private formatExcelContent(data: any, options: ExportOptions): string {
    // This would use a library like SheetJS
    // For now, return mock content
    return `School Management System Export\nDate: ${new Date().toISOString()}\nData: ${JSON.stringify(data)}`;
  }

  /**
   * Format CSV content
   */
  private formatCSVContent(data: any, options: ExportOptions): string {
    let csv = '';

    // Add headers
    if (data.teachers) {
      csv += 'Teachers\nName,Email,Max Hours,Subjects\n';
      data.teachers.forEach((teacher: Teacher) => {
        csv += `${teacher.name},${teacher.email || ''},${teacher.maxHoursPerWeek},${teacher.subjects.join(';')}\n`;
      });
      csv += '\n';
    }

    if (data.classes) {
      csv += 'Classes\nName,Level,Room,Subjects\n';
      data.classes.forEach((schoolClass: SchoolClass) => {
        csv += `${schoolClass.name},${schoolClass.level},${schoolClass.roomId || ''},${schoolClass.subjects.map(s => s.name).join(';')}\n`;
      });
      csv += '\n';
    }

    if (data.students) {
      csv += 'Students\nName,Class,Email,Phone\n';
      data.students.forEach((student: Student) => {
        csv += `${student.name},${student.classId},${student.email || ''},${student.phone || ''}\n`;
      });
      csv += '\n';
    }

    if (data.inventory) {
      csv += 'Inventory\nName,Category,Quantity,Location\n';
      data.inventory.items.forEach((item: InventoryItem) => {
        csv += `${item.name},${item.category},${item.quantity},${item.location || ''}\n`;
      });
    }

    return csv;
  }

  /**
   * Generate export data based on options
   */
  private async generateExportData(options: ExportOptions): Promise<any> {
    const exportData: any = {};

    if (options.includeTeachers) {
      exportData.teachers = this.schoolData.teachers;
    }

    if (options.includeClasses) {
      exportData.classes = this.schoolData.classes;
    }

    if (options.includeTimetables) {
      exportData.timetables = this.schoolData.timetables;
    }

    if (options.includeStudents) {
      exportData.students = this.schoolData.students;
    }

    if (options.includeInventory) {
      exportData.inventory = this.schoolData.inventory;
    }

    if (options.includeAnalytics) {
      exportData.analytics = this.generateAnalyticsData();
    }

    // Add metadata
    exportData.metadata = {
      exportDate: new Date().toISOString(),
      schoolName: this.schoolData.schoolName,
      format: options.format,
      options
    };

    return exportData;
  }

  /**
   * Create export file based on format
   */
  private async createExportFile(data: any, options: ExportOptions): Promise<Blob> {
    switch (options.format) {
      case 'pdf':
        return this.generatePDFExport(data, options);
      case 'excel':
        return this.generateExcelExport(data, options);
      case 'csv':
        return this.generateCSVExport(data, options);
      case 'json':
        return this.generateJSONExport(data, options);
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Generate download URL
   */
  private async generateDownloadUrl(file: Blob, options: ExportOptions): Promise<string> {
    const filename = this.generateFilename(options);
    const url = URL.createObjectURL(file);

    // Store file metadata for cleanup
    this.storeFileMetadata(filename, url, file.size);

    return url;
  }

  /**
   * Generate filename based on options
   */
  private generateFilename(options: ExportOptions): string {
    const date = new Date().toISOString().split('T')[0];
    const format = options.format;
    const components = [];

    if (options.includeTeachers) components.push('teachers');
    if (options.includeClasses) components.push('classes');
    if (options.includeTimetables) components.push('timetables');
    if (options.includeStudents) components.push('students');
    if (options.includeAnalytics) components.push('analytics');

    const name = components.length > 0 ? components.join('_') : 'export';
    return `${this.schoolData.schoolName.replace(/\s+/g, '_')}_${name}_${date}.${format}`;
  }

  /**
   * Generate analytics data for export
   */
  private generateAnalyticsData(): any {
    // This would use the analytics service
    // For now, return mock data
    return {
      summary: {
        totalTeachers: this.schoolData.teachers.length,
        totalClasses: this.schoolData.classes.length,
        totalStudents: this.schoolData.students.length
      },
      workloadDistribution: this.schoolData.teachers.map(teacher => ({
        name: teacher.name,
        totalHours: teacher.maxHoursPerWeek,
        subjects: teacher.subjects.length
      })),
      classDistribution: this.schoolData.classes.map(schoolClass => ({
        name: schoolClass.name,
        level: schoolClass.level,
        subjects: schoolClass.subjects.length
      }))
    };
  }

  /**
   * Validate export options
   */
  private validateExportOptions(options: ExportOptions): void {
    if (!options.format) {
      throw new Error('Export format is required');
    }

    const validFormats = ['pdf', 'excel', 'csv', 'json'];
    if (!validFormats.includes(options.format)) {
      throw new Error(`Invalid format: ${options.format}. Valid formats: ${validFormats.join(', ')}`);
    }

    const hasData = options.includeTeachers || 
                   options.includeClasses || 
                   options.includeTimetables || 
                   options.includeStudents || 
                   options.includeAnalytics;

    if (!hasData) {
      throw new Error('At least one data type must be included in export');
    }
  }

  /**
   * Store file metadata for cleanup
   */
  private storeFileMetadata(filename: string, url: string, size: number): void {
    const metadata = {
      filename,
      url,
      size,
      createdAt: new Date().toISOString()
    };

    // Store in localStorage for cleanup
    const existingFiles = JSON.parse(localStorage.getItem('export_files') || '[]');
    existingFiles.push(metadata);
    localStorage.setItem('export_files', JSON.stringify(existingFiles));
  }

  /**
   * Load default templates
   */
  private loadDefaultTemplates(): void {
    const defaultTemplates: ExportTemplate[] = [
      {
        id: 'full_report',
        name: 'Full School Report',
        description: 'Complete export of all school data with analytics',
        format: 'pdf',
        layout: 'detailed',
        customFields: ['teachers', 'classes', 'timetables', 'students', 'analytics'],
        branding: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'teacher_schedule',
        name: 'Teacher Schedule',
        description: 'Export teacher schedules and workload information',
        format: 'excel',
        layout: 'standard',
        customFields: ['teachers', 'timetables'],
        branding: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'class_roster',
        name: 'Class Roster',
        description: 'Export class information and student lists',
        format: 'csv',
        layout: 'summary',
        customFields: ['classes', 'students'],
        branding: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'inventory_report',
        name: 'Inventory Report',
        description: 'Export inventory status and utilization',
        format: 'pdf',
        layout: 'detailed',
        customFields: ['inventory', 'analytics'],
        branding: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    this.templates = defaultTemplates;
  }

  /**
   * Save templates to storage
   */
  private saveTemplates(): void {
    localStorage.setItem('export_templates', JSON.stringify(this.templates));
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update school data
   */
  public updateSchoolData(schoolData: SchoolData): void {
    this.schoolData = schoolData;
  }
}

// ========== REPORT CARD GENERATION FUNCTIONS ==========

/**
 * Generate a report card (bulletin de notes) for a student
 */
export const generateReportCard = (options: ReportCardExportOptions): Blob => {
  const { student, grades, analytics, schoolName, academicYear, className, period, principalName, includeDetails = true } = options

  if (includeDetails && analytics) {
    // Generate full report card with analytics
    return generateReportCardPDF({
      student,
      analytics,
      schoolName,
      academicYear,
      className,
      period,
      principalName
    })
  } else {
    // Generate simple report card with just grades
    return generateSimpleReportCard(student, grades, schoolName, academicYear)
  }
}

/**
 * Generate report cards for multiple students (batch generation)
 */
export const generateBatchReportCards = (
  students: Student[],
  gradesByStudent: Map<string, Grade[]>,
  analyticsByStudent: Map<string, StudentDetailAnalytics>,
  schoolName: string,
  academicYear: string,
  className: string,
  period: 'Trimestre 1' | 'Trimestre 2' | 'Trimestre 3' | 'Semestre 1' | 'Semestre 2',
  principalName?: string
): { studentId: string; blob: Blob; filename: string }[] => {
  const reportCards: { studentId: string; blob: Blob; filename: string }[] = []

  students.forEach(student => {
    const grades = gradesByStudent.get(student.id) || []
    const analytics = analyticsByStudent.get(student.id)

    if (grades.length > 0) {
      const blob = generateReportCard({
        student,
        grades,
        analytics,
        schoolName,
        academicYear,
        className,
        period,
        principalName,
        includeDetails: true
      })

      const filename = generateReportCardFilename(student, period)

      reportCards.push({
        studentId: student.id,
        blob,
        filename
      })
    }
  })

  return reportCards
}

/**
 * Download a report card PDF
 */
export const downloadReportCard = (blob: Blob, student: Student, period: string): void => {
  const filename = generateReportCardFilename(student, period)
  downloadPDF(blob, filename)
}

/**
 * Download multiple report cards as a zip (future implementation)
 * For now, downloads them individually
 */
export const downloadBatchReportCards = (reportCards: { studentId: string; blob: Blob; filename: string }[]): void => {
  reportCards.forEach(({ blob, filename }) => {
    // Add delay between downloads to avoid browser blocking
    setTimeout(() => {
      downloadPDF(blob, filename)
    }, 500)
  })
}

// Utility function to create export service
export const createExportService = (schoolData: SchoolData): ExportService => {
  return new ExportService(schoolData);
}

export default ExportService

