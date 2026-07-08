// src/utils/pdfTemplates.ts - PDF templates for report cards (bulletins de notes)
// Uses jsPDF library to generate professional report cards

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Student, StudentDetailAnalytics, Grade } from '../types'

export interface ReportCardOptions {
  student: Student
  analytics: StudentDetailAnalytics
  schoolName: string
  schoolLogo?: string
  academicYear: string
  className: string
  period: 'Trimestre 1' | 'Trimestre 2' | 'Trimestre 3' | 'Semestre 1' | 'Semestre 2'
  language?: 'fr' | 'ar' | 'en'
  principalName?: string
  principalSignature?: string
}

export interface PDFSize {
  width: number
  height: number
}

// A4 dimensions in mm
const A4: PDFSize = { width: 210, height: 297 }

/**
 * Generate a professional report card (bulletin de notes) in PDF format
 */
export const generateReportCardPDF = (options: ReportCardOptions): Blob => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const { student, analytics, schoolName, schoolLogo, academicYear, className, period, language = 'fr' } = options
  let yPos = 15 // Starting Y position

  // ========== HEADER ==========
  yPos = addHeader(doc, schoolName, academicYear, yPos, schoolLogo)

  // ========== TITLE ==========
  yPos = addTitle(doc, period, className, yPos)

  // ========== STUDENT INFO ==========
  yPos = addStudentInfo(doc, student, yPos)

  // ========== SUMMARY TABLE ==========
  yPos = addSummaryTable(doc, analytics, yPos)

  // ========== SUBJECTS TABLE ==========
  yPos = addSubjectsTable(doc, analytics, yPos)

  // ========== GRADES DETAILS ==========
  yPos = addGradesDetails(doc, analytics, yPos)

  // ========== APPRECIATIONS ==========
  yPos = addAppreciations(doc, analytics, yPos)

  // ========== SIGNATURES ==========
  addSignatures(doc, options, yPos)

  // ========== FOOTER ==========
  addFooter(doc, schoolName, academicYear)

  return doc.output('blob')
}

/**
 * Add school header
 */
const addHeader = (doc: jsPDF, schoolName: string, academicYear: string, yPos: number, logo?: string): number => {
  // Add Logo if available
  if (logo) {
    try {
      // If it's a URL, jsPDF might need it as base64 or it should be already pre-loaded
      // For now, we assume it's a valid image source (base64 or local path)
      doc.addImage(logo, 'PNG', 15, yPos - 5, 20, 20)
    } catch (e) {

    }
  }

  // School name
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(41, 128, 185) // Blue color
  doc.text(schoolName.toUpperCase(), A4.width / 2 + (logo ? 10 : 0), yPos, { align: 'center' })

  // Academic year
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(`Année Scolaire: ${academicYear}`, A4.width / 2 + (logo ? 10 : 0), yPos + 7, { align: 'center' })

  // Line separator
  doc.setDrawColor(41, 128, 185)
  doc.setLineWidth(0.5)
  doc.line(15, yPos + 12, A4.width - 15, yPos + 12)

  return yPos + 18
}

/**
 * Add report card title
 */
const addTitle = (doc: jsPDF, period: string, className: string, yPos: number): number => {
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(`BULLETIN DE NOTES - ${period}`, A4.width / 2, yPos, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Classe: ${className}`, A4.width / 2, yPos + 7, { align: 'center' })

  return yPos + 15
}

/**
 * Add student information section
 */
const addStudentInfo = (doc: jsPDF, student: Student, yPos: number): number => {
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)

  const infoTable = [
    ['Nom et Prénom:', student.name],
    ['Code Massar:', student.codeMassar || 'N/A'],
    ['Date de naissance:', student.dateOfBirth ? formatDate(student.dateOfBirth) : 'N/A'],
    ['Lieu de naissance:', student.placeOfBirth || 'N/A'],
    ['Téléphone:', student.phone || student.parentName || 'N/A']
  ]

  autoTable(doc, {
    startY: yPos,
    body: infoTable,
    theme: 'plain',
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 100 }
    },
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 1 }
  })

  return (doc as any).lastAutoTable?.finalY + 8 || yPos + 20
}

/**
 * Add summary metrics table
 */
const addSummaryTable = (doc: jsPDF, analytics: StudentDetailAnalytics, yPos: number): number => {
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(41, 128, 185)
  doc.text('RÉSUMÉ DES PERFORMANCES', 15, yPos)

  const summaryData = [
    ['Moyenne Générale', `${analytics.overallAverage}/20`, getMention(analytics.overallAverage)],
    ['Rang/Classe', `${analytics.classRank}/${analytics.totalStudents}`, `${analytics.percentile}% percentile`],
    ['Moyenne de Classe', `${analytics.classAverage}/20`, analytics.differenceFromClassAverage >= 0 ? `+${analytics.differenceFromClassAverage}` : analytics.differenceFromClassAverage],
    ['Nombre de Devoirs', analytics.totalAssessments.toString(), '']
  ]

  autoTable(doc, {
    startY: yPos + 2,
    body: summaryData,
    theme: 'grid',
    head: [['Métrique', 'Valeur', 'Observation']],
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold' },
      1: { cellWidth: 50, halign: 'center' },
      2: { cellWidth: 65 }
    }
  })

  return (doc as any).lastAutoTable?.finalY + 10 || yPos + 30
}

/**
 * Add detailed subjects table
 */
const addSubjectsTable = (doc: jsPDF, analytics: StudentDetailAnalytics, yPos: number): number => {
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(41, 128, 185)
  doc.text('DÉTAIL PAR MATIÈRE', 15, yPos)

  const subjectsData = analytics.subjectBreakdown.map((subject, index) => [
    index + 1,
    subject.subject,
    subject.average.toFixed(2),
    subject.gradeCount.toString(),
    getSubjectAppreciation(subject.average)
  ])

  autoTable(doc, {
    startY: yPos + 2,
    head: [['#', 'Matière', 'Moyenne', 'Devoirs', 'Appréciation']],
    body: subjectsData,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: { fontSize: 8 },
    margin: { left: 15, right: 15 },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 50, fontStyle: 'bold' },
      2: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 70 }
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 2) {
        const value = parseFloat(data.cell.raw as string)
        if (value >= 16) {
          data.cell.styles.textColor = [76, 175, 80] // Green
        } else if (value >= 12) {
          data.cell.styles.textColor = [33, 150, 243] // Blue
        } else if (value >= 10) {
          data.cell.styles.textColor = [255, 152, 0] // Orange
        } else {
          data.cell.styles.textColor = [244, 67, 54] // Red
        }
      }
    }
  })

  return (doc as any).lastAutoTable?.finalY + 10 || yPos + 30
}

/**
 * Add recent grades details
 */
const addGradesDetails = (doc: jsPDF, analytics: StudentDetailAnalytics, yPos: number): number => {
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(41, 128, 185)
  doc.text('DERNIÈRES NOTES', 15, yPos)

  // Take last 10 grades
  const recentGrades = analytics.allGrades.slice(0, 10)
  const gradesData = recentGrades.map((grade, index) => [
    formatDate(grade.date),
    grade.subject,
    grade.examType,
    `${grade.grade}/20`,
    grade.coefficient.toString(),
    grade.observation.split(' - ')[0] // Take only French part
  ])

  autoTable(doc, {
    startY: yPos + 2,
    head: [['Date', 'Matière', 'Type', 'Note', 'Coeff', 'Observation']],
    body: gradesData,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8
    },
    bodyStyles: { fontSize: 8 },
    margin: { left: 15, right: 15 },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 40, fontStyle: 'bold' },
      2: { cellWidth: 30 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 55 }
    }
  })

  return (doc as any).lastAutoTable?.finalY + 10 || yPos + 30
}

/**
 * Add appreciations and recommendations
 */
const addAppreciations = (doc: jsPDF, analytics: StudentDetailAnalytics, yPos: number): number => {
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(41, 128, 185)
  doc.text('APPRÉCIATIONS GÉNÉRALES', 15, yPos)

  // Overall appreciation
  const overallAppreciation = getOverallAppreciation(analytics.overallAverage, analytics.trend)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0)

  const splitText = doc.splitTextToSize(`Appréciation: ${overallAppreciation}`, 180)
  doc.text(splitText, 15, yPos + 7)

  // Recommendations (optional - may not be available in all analytics objects)
  if ('recommendations' in analytics && Array.isArray(analytics.recommendations) && analytics.recommendations.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.text('Recommandations:', 15, yPos + 15)

    doc.setFont('helvetica', 'normal')
    const recommendations = analytics.recommendations.map((rec: string, i: number) => `${i + 1}. ${rec}`)
    const recommendationsText = doc.splitTextToSize(recommendations.join('\n\n'), 180)
    doc.text(recommendationsText, 15, yPos + 22)
  }

  return yPos + 45
}

/**
 * Add signatures section
 */
const addSignatures = (doc: jsPDF, options: ReportCardOptions, yPos: number): void => {
  const pageHeight = A4.height
  const signatureY = pageHeight - 50

  // Left signature - Class Professor
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Le Professeur Principal', 30, signatureY)
  doc.text(options.principalName || '', 30, signatureY + 15)

  // Signature line
  doc.line(20, signatureY + 5, 60, signatureY + 5)

  // Right signature - School Administration
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('La Direction', A4.width - 50, signatureY)
  doc.text('(Cachet et Signature)', A4.width - 50, signatureY + 15)

  // Signature line
  doc.line(A4.width - 70, signatureY + 5, A4.width - 30, signatureY + 5)

  // Date
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text(`Fait le ${formatDate(new Date().toISOString())}`, A4.width / 2, signatureY + 25, { align: 'center' })
}

/**
 * Add footer
 */
const addFooter = (doc: jsPDF, schoolName: string, academicYear: string): void => {
  const pageHeight = A4.height
  const footerY = pageHeight - 10

  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(150)
  doc.text(`${schoolName} - ${academicYear}`, A4.width / 2, footerY, { align: 'center' })

  // Page number
  const pageCount = (doc as any).internal.getNumberOfPages?.() || 1
  doc.text(`Page 1 sur ${pageCount}`, A4.width - 15, footerY, { align: 'right' })
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Get mention based on grade
 */
const getMention = (grade: number): string => {
  if (grade >= 18) return 'Excellent - ممتاز'
  if (grade >= 16) return 'Très Bien - جيد جدا'
  if (grade >= 14) return 'Bien - جيد'
  if (grade >= 12) return 'Assez Bien - حسن'
  if (grade >= 10) return 'Passable - مقبول'
  return 'À renforcer - يحتاج للتحسين'
}

/**
 * Get appreciation for subject
 */
const getSubjectAppreciation = (grade: number): string => {
  if (grade >= 16) return 'Excellent travail'
  if (grade >= 14) return 'Très bon travail'
  if (grade >= 12) return 'Bon travail'
  if (grade >= 10) return 'Peut mieux faire'
  return 'Nécessite des efforts'
}

/**
 * Get overall appreciation
 */
const getOverallAppreciation = (grade: number, trend: 'improving' | 'declining' | 'stable'): string => {
  let appreciation = ''

  if (grade >= 16) {
    appreciation = 'Félicitations pour ces excellents résultats. Continuez ainsi!'
  } else if (grade >= 14) {
    appreciation = 'Très bon travail. Vous êtes sur la bonne voie.'
  } else if (grade >= 12) {
    appreciation = 'Bon travail général. Encore quelques efforts pour progresser.'
  } else if (grade >= 10) {
    appreciation = 'Résultats passables. Il faut travailler davantage pour progresser.'
  } else {
    appreciation = 'Résultats insuffisants. Un travail sérieux et régulier est nécessaire.'
  }

  if (trend === 'improving') {
    appreciation += ' Belle progression ce trimestre!'
  } else if (trend === 'declining') {
    appreciation += ' Attention, une baisse des résultats est constatée.'
  }

  return appreciation
}

/**
 * Format date string
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

/**
 * Generate simple report card (simplified version)
 */
export const generateSimpleReportCard = (
  student: Student,
  grades: Grade[],
  schoolName: string,
  academicYear: string
): Blob => {
  const doc = new jsPDF()

  // Title
  doc.setFontSize(16)
  doc.text(schoolName, 105, 20, { align: 'center' })
  doc.setFontSize(12)
  doc.text(`Année Scolaire: ${academicYear}`, 105, 30, { align: 'center' })

  // Student info
  doc.setFontSize(10)
  doc.text(`Élève: ${student.name}`, 20, 45)
  if (student.codeMassar) {
    doc.text(`Code Massar: ${student.codeMassar}`, 20, 52)
  }

  // Grades table
  const tableData = grades.map((g, i) => [
    i + 1,
    g.subject,
    g.examType,
    `${g.grade}/20`,
    g.coefficient || 1,
    formatDate(g.date)
  ])

  autoTable(doc, {
    startY: 60,
    head: [['#', 'Matière', 'Type', 'Note', 'Coeff', 'Date']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] }
  })

  // Calculate average
  const avg = grades.reduce((sum, g) => sum + g.grade, 0) / grades.length
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`Moyenne: ${avg.toFixed(2)}/20`, 20, (doc as any).lastAutoTable?.finalY + 20 || 200)

  return doc.output('blob')
}

/**
 * Download PDF file
 */
export const downloadPDF = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate filename for report card
 */
export const generateReportCardFilename = (student: Student, period: string): string => {
  const sanitizedName = student.name.replace(/[^a-zA-Z0-9]/g, '_')
  const date = new Date().toISOString().split('T')[0]
  return `Bulletin_${sanitizedName}_${period.replace(/\s/g, '_')}_${date}.pdf`
}

