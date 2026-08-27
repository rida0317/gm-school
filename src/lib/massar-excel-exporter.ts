import * as XLSX from 'xlsx';
import { Student, ClassEntity, Subject, AcademicSemester } from '@/types/database';
import { SchoolSettings } from '@/lib/settings';

export interface MassarExportOptions {
  activeClass: ClassEntity;
  students: Student[];
  subject?: Subject;
  semester: AcademicSemester;
  settings: Partial<SchoolSettings>;
}

export function exportMassarExcelTemplate({
  activeClass,
  students,
  subject,
  semester,
  settings,
}: MassarExportOptions) {
  const schoolName = settings.school_name || 'مجموعة مدارس الأجيال الصاعدة للتعليم المدرسي الخصوصي';
  const academicYear = settings.academic_year || '2025/2026';
  const semesterLabel = semester === 'S1' ? 'الدورة الأولى' : 'الدورة الثانية';
  const subjectName = subject?.name || 'جميع المواد';

  // Build 2D Cell Matrix exactly mirroring official Massar structure
  const wsData: any[][] = [];

  // Row 1 & 2: Technical header (for official Massar import compatibility)
  wsData.push(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P']);
  wsData.push(['sgs', 'sgs', 'sgs', 'sgs', 'sgs', 'sgs', 10, 'sgs', 'sgs', 'sgs', 'sgs', 'sgs', 'sgs', 'sgs', 'sgs', 'sgs']);
  wsData.push([]);

  // Row 4: Main Title
  wsData.push(['', '', '', '', '', 'نقط المراقبة المستمرة']);

  // Row 5: Massar hash code
  wsData.push(['', '', '55976T', '', '1fcabb4c-45d0-4307-be0c-f7f42a4b34af', '', 2, '', 0, '', '#0030#', '', 18, '', '2A32101110']);
  wsData.push([]);

  // Row 7: Academy, Delegation, School Name
  wsData.push([
    '',
    '',
    'أكاديمية :',
    'مراكش - آسفي',
    '',
    '',
    'م.الإقليمية : ',
    '',
    'عمالة: مراكش',
    '',
    '',
    'مؤسسة',
    '',
    '',
    schoolName,
  ]);
  wsData.push([]);

  // Row 9: Level, Class, Teacher
  wsData.push([
    '',
    '',
    'المستوى  :  ',
    activeClass.level || 'الثانية إعدادي مسار دولي',
    '',
    '',
    'القسم  :',
    '',
    activeClass.name,
    '',
    '',
    'الاستاذ',
    '',
    '',
    '',
  ]);
  wsData.push([]);

  // Row 11: Semester, Subject
  wsData.push([
    '',
    '',
    'الدورة  :',
    semesterLabel,
    '',
    '',
    'نقط :',
    '',
    '',
    '',
    '',
    'المادة',
    '',
    '',
    subjectName,
  ]);
  wsData.push([]);

  // Row 13: Academic Year
  wsData.push(['', '', 'السنة الدراسية :', academicYear]);
  wsData.push([]);

  // Row 15: Evaluation markers
  wsData.push(['', '', '', '', '', '', '#1#', '', '#2#', '', '#3#', '', '#4#', '', '#100#']);

  // Row 16: Table Headers (Level 1)
  wsData.push([
    '',
    'ID',
    'رقم  التلميذ  ',
    'إسم التلميذ  ',
    '',
    ' تاريخ الإزدياد',
    'الفرض الأول',
    'الفرض الأول',
    'الفرض الثاني',
    'الفرض الثاني',
    'الفرض الثالث',
    'الفرض الثالث',
    'الأنشطة المندمجة',
    'الأنشطة المندمجة',
    'ملاحظات الأستاذ',
    'ملاحظات الأستاذ',
  ]);

  // Row 17: Table Sub-Headers (Level 2: النقطة / التغيب)
  wsData.push([
    '',
    '',
    '',
    '',
    '',
    '',
    'النقطة',
    'التغيب',
    'النقطة',
    'التغيب',
    'النقطة',
    'التغيب',
    'النقطة',
    'التغيب',
    '-',
    'التغيب',
  ]);

  // Data rows (Row 18 onwards)
  students.forEach((student, idx) => {
    const studentCode = student.massar_code || student.student_code || `MASSAR-${idx + 1}`;
    const studentFullName = `${student.last_name} ${student.first_name}`;
    const birthDate = student.date_of_birth || '01-01-2013';

    wsData.push([
      '',
      10000000 + idx + 1,
      studentCode,
      studentFullName,
      '',
      birthDate,
      '', // CC1 score (blank for teacher to fill)
      '', // CC1 absent
      '', // CC2 score
      '', // CC2 absent
      '', // CC3 score
      '', // CC3 absent
      '', // Activities score
      '', // Activities absent
      '', // Comment
      '',
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set Right-to-Left (RTL) view for Arabic presentation
  ws['!views'] = [{ rightToLeft: true }];

  // Column Widths for professional layout
  ws['!cols'] = [
    { wch: 3 },  // A (technical)
    { wch: 10, hidden: true }, // B: ID (hidden)
    { wch: 16 }, // C: رقم التلميذ (Code Massar)
    { wch: 26 }, // D: إسم التلميذ (Nom)
    { wch: 4 },  // E: spacer
    { wch: 14 }, // F: تاريخ الإزدياد
    { wch: 11 }, // G: الفرض 1 النقطة
    { wch: 8 },  // H: الفرض 1 التغيب
    { wch: 11 }, // I: الفرض 2 النقطة
    { wch: 8 },  // J: الفرض 2 التغيب
    { wch: 11 }, // K: الفرض 3 النقطة
    { wch: 8 },  // L: الفرض 3 التغيب
    { wch: 14 }, // M: الأنشطة المندمجة
    { wch: 8 },  // N: الأنشطة التغيب
    { wch: 22 }, // O: ملاحظات الأستاذ
    { wch: 8 },  // P
  ];

  // Set Merges for headers matching Massar
  const merges: XLSX.Range[] = [
    // Main Title "نقط المراقبة المستمرة"
    { s: { r: 3, c: 5 }, e: { r: 3, c: 8 } },

    // Header info merges
    { s: { r: 6, c: 3 }, e: { r: 6, c: 5 } },
    { s: { r: 6, c: 8 }, e: { r: 6, c: 10 } },
    { s: { r: 6, c: 14 }, e: { r: 6, c: 18 } },

    { s: { r: 8, c: 3 }, e: { r: 8, c: 5 } },
    { s: { r: 8, c: 8 }, e: { r: 8, c: 10 } },
    { s: { r: 8, c: 14 }, e: { r: 8, c: 18 } },

    { s: { r: 10, c: 3 }, e: { r: 10, c: 5 } },
    { s: { r: 10, c: 14 }, e: { r: 10, c: 18 } },

    { s: { r: 12, c: 3 }, e: { r: 12, c: 5 } },

    // Evaluation sub-header markers (#1#, #2#, #3#, #4#)
    { s: { r: 14, c: 6 }, e: { r: 14, c: 7 } },
    { s: { r: 14, c: 8 }, e: { r: 14, c: 9 } },
    { s: { r: 14, c: 10 }, e: { r: 14, c: 11 } },
    { s: { r: 14, c: 12 }, e: { r: 14, c: 13 } },
    { s: { r: 14, c: 14 }, e: { r: 14, c: 15 } },

    // Table Header merges
    { s: { r: 15, c: 2 }, e: { r: 16, c: 2 } }, // رقم التلميذ (Rows 16-17)
    { s: { r: 15, c: 3 }, e: { r: 16, c: 4 } }, // إسم التلميذ (Cols D-E, Rows 16-17)
    { s: { r: 15, c: 5 }, e: { r: 16, c: 5 } }, // تاريخ الإزدياد
    { s: { r: 15, c: 6 }, e: { r: 15, c: 7 } }, // الفرض الأول
    { s: { r: 15, c: 8 }, e: { r: 15, c: 9 } }, // الفرض الثاني
    { s: { r: 15, c: 10 }, e: { r: 15, c: 11 } }, // الفرض الثالث
    { s: { r: 15, c: 12 }, e: { r: 15, c: 13 } }, // الأنشطة المندمجة
    { s: { r: 15, c: 14 }, e: { r: 15, c: 15 } }, // ملاحظات الأستاذ
  ];

  // Student name column merges for each student row (Cols D & E)
  students.forEach((_, idx) => {
    const rowIdx = 17 + idx;
    merges.push({ s: { r: rowIdx, c: 3 }, e: { r: rowIdx, c: 4 } });
  });

  ws['!merges'] = merges;

  // Append sheet and download file
  XLSX.utils.book_append_sheet(wb, ws, 'NotesCC');

  const fileName = `export_notesCC_${activeClass.name}_${subject?.code || subjectName}_${semester}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
