import * as XLSX from 'xlsx';
import { Student, ClassEntity, Subject, AcademicSemester } from '@/types/database';
import { SchoolSettings } from '@/lib/settings';
import { OFFICIAL_MASSAR_TEMPLATE_B64 } from './massar-template-b64';

export interface MassarExportOptions {
  activeClass: ClassEntity;
  students: Student[];
  subject?: Subject;
  semester: AcademicSemester;
  settings: Partial<SchoolSettings>;
}

// Convert Base64 string to Uint8Array safely in browser / Node
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = typeof window !== 'undefined' ? window.atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function exportMassarExcelTemplate({
  activeClass,
  students,
  subject,
  semester,
  settings,
}: MassarExportOptions) {
  try {
    const schoolName = settings.school_name || 'مجموعة مدارس الأجيال الصاعدة للتعليم المدرسي الخصوصي';
    const academicYear = settings.academic_year || '2025/2026';
    const semesterLabel = semester === 'S1' ? 'الدورة الأولى' : 'الدورة الثانية';
    const subjectName = subject?.name || 'المعلوميات';

    // 1. Load the authentic official Massar workbook template with full binary styling & borders
    const templateBytes = base64ToUint8Array(OFFICIAL_MASSAR_TEMPLATE_B64);
    const wb = XLSX.read(templateBytes, { type: 'array', cellStyles: true });

    const sheetName = wb.SheetNames[0] || 'NotesCC';
    const ws = wb.Sheets[sheetName];

    // 2. Set Official Header Info
    const setCellStr = (cellRef: string, text: string) => {
      ws[cellRef] = { t: 's', v: text, w: text };
    };

    setCellStr('O7', schoolName);
    setCellStr('D9', activeClass.level || 'الثانية إعدادي مسار دولي');
    setCellStr('I9', activeClass.name);
    setCellStr('D11', semesterLabel);
    setCellStr('O11', subjectName);
    setCellStr('D13', academicYear);

    // 3. Find template starting row and clean/fill student data
    const startRow = 18;
    const maxTemplateRows = 100; // clear up to 100 old template rows

    // Clear old template student data
    for (let r = startRow; r <= startRow + maxTemplateRows; r++) {
      ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'].forEach((col) => {
        delete ws[`${col}${r}`];
      });
    }

    // Populate students list with exact Massar format
    students.forEach((student, idx) => {
      const r = startRow + idx;
      const idNum = 10000000 + idx + 1;
      const massarCode = student.massar_code || student.student_code || `MASSAR-${idx + 1}`;
      const fullName = `${student.last_name} ${student.first_name}`.trim();
      const birthDate = student.date_of_birth || '';

      ws[`B${r}`] = { t: 'n', v: idNum, w: String(idNum) };
      ws[`C${r}`] = { t: 's', v: massarCode, w: massarCode };
      ws[`D${r}`] = { t: 's', v: fullName, w: fullName };
      ws[`F${r}`] = { t: 's', v: birthDate, w: birthDate };

      // Empty blank cells for grades (CC1, CC2, CC3, Activities, Comment)
      ws[`G${r}`] = { t: 's', v: '', w: '' };
      ws[`I${r}`] = { t: 's', v: '', w: '' };
      ws[`K${r}`] = { t: 's', v: '', w: '' };
      ws[`M${r}`] = { t: 's', v: '', w: '' };
    });

    // 4. Update Merges for Student Names (Cols D & E merged on every row)
    const existingMerges = (ws['!merges'] || []).filter((m) => m.s.r < 17);
    students.forEach((_, idx) => {
      const rowIdx = 17 + idx; // 0-indexed row 18
      existingMerges.push({
        s: { r: rowIdx, c: 3 }, // Col D
        e: { r: rowIdx, c: 4 }, // Col E
      });
    });
    ws['!merges'] = existingMerges;

    // 5. Update Worksheet Range (!ref)
    const endRow = Math.max(25, startRow + students.length);
    ws['!ref'] = `A1:P${endRow}`;

    // 6. Write and trigger download
    const cleanSubCode = (subject?.code || subjectName).replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
    const fileName = `export_notesCC_${activeClass.name}_${cleanSubCode}_${semester}.xlsx`;

    XLSX.writeFile(wb, fileName);
  } catch (err) {
    console.error('Failed to export Massar template using base template:', err);
    throw err;
  }
}
