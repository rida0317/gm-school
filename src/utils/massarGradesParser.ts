// src/utils/massarGradesParser.ts - Professional Massar Arabic Excel Parser

import * as XLSX from 'xlsx'

export interface MassarGrade {
  studentCode: string
  studentName: string
  birthDate?: string
  grade: number
  teacherComment?: string
  classId: string
  subject: string
  examType: string
}

export interface ParseResult {
  grades: MassarGrade[]
  errors: ParseError[]
  warnings: ParseWarning[]
  summary: ParseSummary
}

export interface ParseError {
  row: number
  field: string
  value: string | undefined
  message: string
  messageAr?: string
}

export interface ParseWarning {
  row: number
  field: string
  value: string | undefined
  message: string
  messageAr?: string
}

export interface ParseSummary {
  totalRows: number
  validGrades: number
  errors: number
  warnings: number
  className?: string
  subject?: string
  examType?: string
}

// Arabic column name mappings
const ARABIC_COLUMN_MAPPINGS: Record<string, keyof MassarGrade> = {
  // Student Code
  'رقم التلميذ': 'studentCode',
  'رقم': 'studentCode',
  'كود': 'studentCode',
  'code': 'studentCode',
  'massar': 'studentCode',
  
  // Student Name
  'إسم التلميذ': 'studentName',
  'اسم التلميذ': 'studentName',
  'إسم': 'studentName',
  'اسم': 'studentName',
  'nom': 'studentName',
  'name': 'studentName',
  
  // Birth Date
  'تاريخ الازدياد': 'birthDate',
  'تاريخ الميلاد': 'birthDate',
  'تاريخ': 'birthDate',
  'naissance': 'birthDate',
  'birth': 'birthDate',
  'date': 'birthDate',
  
  // Grade
  'المعلومات النقطة': 'grade',
  'النقطة': 'grade',
  'العلامة': 'grade',
  'note': 'grade',
  'grade': 'grade',
  'mark': 'grade',
  'points': 'grade',
  
  // Teacher Comment
  'ملاحظات الأستاذ': 'teacherComment',
  'ملاحظات': 'teacherComment',
  'تعليق': 'teacherComment',
  'observation': 'teacherComment',
  'comment': 'teacherComment',
  'remark': 'teacherComment',
  
  // Class
  'القسم': 'classId',
  'الفوج': 'classId',
  'classe': 'classId',
  'class': 'classId',
  
  // Subject
  'المادة': 'subject',
  'مادة': 'subject',
  'matiere': 'subject',
  'subject': 'subject',
  
  // Exam Type
  'نوع الامتحان': 'examType',
  'الامتحان': 'examType',
  'type': 'examType',
  'exam': 'examType'
}

// Common Arabic school terms
const ARABIC_SCHOOL_TERMS = {
  levels: [
    'ابتدائي', 'إعدادي', 'ثانوي',
    'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس',
    'الأول إعدادي', 'الثاني إعدادي', 'الثالث إعدادي',
    'الجذع المشترك', 'الأولى باك', 'الثانية باك'
  ],
  examTypes: [
    'الفرض الأول', 'الفرض الثاني', 'الفرض الثالث',
    'الإمتحان المحلي', 'الإمتحان الجهوي', 'الإمتحان الوطني',
    'Controle 1', 'Controle 2', 'Examen'
  ]
}

/**
 * Parse Massar Excel file with Arabic support
 */
export function parseMassarGradesFile(file: File, defaultClassId?: string, defaultSubject?: string, defaultExamType?: string): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        
        // Read with Arabic encoding support
        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          cellNF: true,
          cellText: true,
          raw: false,
          codepage: 65001 // UTF-8
        })

        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // Convert to JSON with Arabic support
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: false
        })

        // Find the header row
        const headerRowIndex = findHeaderRow(rows)
        
        if (headerRowIndex === -1) {
          resolve({
            grades: [],
            errors: [{
              row: 0,
              field: 'header',
              value: undefined,
              message: 'Could not detect table headers. Make sure the file contains Arabic column names like "رقم التلميذ" or "إسم التلميذ"',
              messageAr: 'لم يتم العثور على رؤوس الأعمدة. تأكد من أن الملف يحتوي على أسماء أعمدة عربية مثل "رقم التلميذ" أو "إسم التلميذ"'
            }],
            warnings: [],
            summary: {
              totalRows: rows.length,
              validGrades: 0,
              errors: 1,
              warnings: 0
            }
          })
          return
        }

        // Extract class info from headers if available
        const classInfo = extractClassInfo(rows, headerRowIndex)
        
        // Parse student grades
        const result = parseStudentGrades(
          rows,
          headerRowIndex,
          defaultClassId || classInfo.classId || 'unknown',
          defaultSubject || classInfo.subject || 'unknown',
          defaultExamType || classInfo.examType || 'unknown'
        )

        resolve(result)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Find the row containing table headers
 */
function findHeaderRow(rows: any[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i]
    const rowText = row.join(' ').toLowerCase()
    
    // Check for Arabic column names
    const hasArabicHeaders = Object.keys(ARABIC_COLUMN_MAPPINGS).some(arabic =>
      rowText.includes(arabic.toLowerCase())
    )
    
    // Check for French/English column names
    const hasLatinHeaders = row.some(cell => {
      const text = String(cell).toLowerCase()
      return text.includes('code') || text.includes('nom') || 
             text.includes('note') || text.includes('grade') ||
             text.includes('student')
    })
    
    if (hasArabicHeaders || hasLatinHeaders) {
      return i
    }
  }
  
  return -1
}

/**
 * Extract class information from file headers
 */
function extractClassInfo(rows: any[][], headerRowIndex: number): { classId?: string; subject?: string; examType?: string } {
  const info: { classId?: string; subject?: string; examType?: string } = {}
  
  // Look at rows above the header for class info
  for (let i = 0; i < headerRowIndex; i++) {
    const rowText = rows[i].join(' ')
    
    // Try to extract class name
    for (const level of ARABIC_SCHOOL_TERMS.levels) {
      if (rowText.includes(level)) {
        info.classId = rowText.match(new RegExp(`${level}[^,;]*`))?.[0]?.trim()
        break
      }
    }
    
    // Try to extract subject
    if (rowText.includes('المادة') || rowText.includes('مادة')) {
      info.subject = rowText.match(/المادة\s*[:-]?\s*([^\s,;]+)/)?.[1]?.trim()
    }
    
    // Try to extract exam type
    for (const exam of ARABIC_SCHOOL_TERMS.examTypes) {
      if (rowText.includes(exam)) {
        info.examType = exam
        break
      }
    }
  }
  
  return info
}

/**
 * Parse student grades from rows
 */
function parseStudentGrades(
  rows: any[][],
  headerRowIndex: number,
  classId: string,
  subject: string,
  examType: string
): ParseResult {
  const headerRow = rows[headerRowIndex]
  const columnMap = buildColumnMap(headerRow)
  
  const grades: MassarGrade[] = []
  const errors: ParseError[] = []
  const warnings: ParseWarning[] = []
  const studentCodes = new Set<string>()
  
  // Parse data rows
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    
    // Skip empty rows
    if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
      continue
    }
    
    const grade = extractGradeFromRow(row, columnMap, classId, subject, examType)
    
    // Validate grade
    const validation = validateGrade(grade, i + 1, studentCodes)
    
    if (validation.errors.length > 0) {
      errors.push(...validation.errors)
    }
    
    warnings.push(...validation.warnings)
    
    if (validation.errors.length === 0 && grade.studentCode && grade.studentName) {
      grades.push(grade)
      studentCodes.add(grade.studentCode)
    }
  }
  
  return {
    grades,
    errors,
    warnings,
    summary: {
      totalRows: rows.length - headerRowIndex - 1,
      validGrades: grades.length,
      errors: errors.length,
      warnings: warnings.length,
      className: classId,
      subject,
      examType
    }
  }
}

/**
 * Build column index map from header row
 */
function buildColumnMap(headerRow: any[]): Record<string, number> {
  const columnMap: Record<string, number> = {}
  
  headerRow.forEach((cell, index) => {
    const text = String(cell).trim().toLowerCase()
    
    // Try to match with Arabic column names
    for (const [arabic, field] of Object.entries(ARABIC_COLUMN_MAPPINGS)) {
      if (text.includes(arabic.toLowerCase()) && !(field in columnMap)) {
        columnMap[field] = index
      }
    }
    
    // Try French/English matches
    if (text.includes('code') && !('studentCode' in columnMap)) {
      columnMap.studentCode = index
    }
    if ((text.includes('nom') || text.includes('name')) && !('studentName' in columnMap)) {
      columnMap.studentName = index
    }
    if ((text.includes('note') || text.includes('grade')) && !('grade' in columnMap)) {
      columnMap.grade = index
    }
  })
  
  return columnMap
}

/**
 * Extract grade data from row
 */
function extractGradeFromRow(
  row: any[],
  columnMap: Record<string, number>,
  classId: string,
  subject: string,
  examType: string
): MassarGrade {
  const getCellValue = (field: keyof MassarGrade): string => {
    const index = columnMap[field]
    if (index !== undefined && row[index]) {
      return String(row[index]).trim()
    }
    return ''
  }
  
  return {
    studentCode: getCellValue('studentCode'),
    studentName: getCellValue('studentName'),
    birthDate: getCellValue('birthDate') || undefined,
    grade: parseGrade(getCellValue('grade')),
    teacherComment: getCellValue('teacherComment') || undefined,
    classId,
    subject,
    examType
  }
}

/**
 * Parse grade value to number
 */
function parseGrade(gradeStr: string): number {
  if (!gradeStr) return 0
  
  // Remove any non-numeric characters except decimal point
  const cleaned = gradeStr.replace(/[^\d.]/g, '')
  const grade = parseFloat(cleaned)
  
  return isNaN(grade) ? 0 : grade
}

/**
 * Validate grade data
 */
function validateGrade(
  grade: MassarGrade,
  rowNum: number,
  existingCodes: Set<string>
): { errors: ParseError[]; warnings: ParseWarning[] } {
  const errors: ParseError[] = []
  const warnings: ParseWarning[] = []
  
  // Validate student code
  if (!grade.studentCode) {
    errors.push({
      row: rowNum,
      field: 'studentCode',
      value: grade.studentCode,
      message: 'Student code is required',
      messageAr: 'رقم التلميذ مطلوب'
    })
  } else if (existingCodes.has(grade.studentCode)) {
    warnings.push({
      row: rowNum,
      field: 'studentCode',
      value: grade.studentCode,
      message: `Duplicate student code: ${grade.studentCode}`,
      messageAr: `رقم التلميذ مكرر: ${grade.studentCode}`
    })
  }
  
  // Validate student name
  if (!grade.studentName) {
    errors.push({
      row: rowNum,
      field: 'studentName',
      value: grade.studentName,
      message: 'Student name is required',
      messageAr: 'اسم التلميذ مطلوب'
    })
  }
  
  // Validate grade
  if (grade.grade < 0 || grade.grade > 20) {
    errors.push({
      row: rowNum,
      field: 'grade',
      value: String(grade.grade),
      message: `Invalid grade: ${grade.grade}. Must be between 0 and 20`,
      messageAr: `نقطة غير صحيحة: ${grade.grade}. يجب أن تكون بين 0 و 20`
    })
  }
  
  return { errors, warnings }
}

/**
 * Normalize exam type from Arabic/French to standard format
 */
export function normalizeExamType(examType: string): string {
  const normalized = examType.toLowerCase().trim()
  
  if (normalized.includes('الفرض الأول') || normalized.includes('controle 1')) {
    return 'Controle 1'
  }
  if (normalized.includes('الفرض الثاني') || normalized.includes('controle 2')) {
    return 'Controle 2'
  }
  if (normalized.includes('الفرض الثالث')) {
    return 'Controle 3'
  }
  if (normalized.includes('جهوي') || normalized.includes('regional')) {
    return 'Examen Régional'
  }
  if (normalized.includes('وطني') || normalized.includes('national')) {
    return 'Examen National'
  }
  if (normalized.includes('محلي') || normalized.includes('local')) {
    return 'Examen Local'
  }
  
  return examType
}

/**
 * Format date from various formats to YYYY-MM-DD
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  
  // Try DD/MM/YYYY format (common in Morocco)
  const ddmmyyyy = dateStr.match(/(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})/)
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  
  // Try YYYY-MM-DD format
  const yyyymmdd = dateStr.match(/(\d{4})[/. -](\d{1,2})[/. -](\d{1,2})/)
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  
  return dateStr
}

