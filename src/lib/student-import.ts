import * as XLSX from 'xlsx';
import { ClassEntity } from '@/types/database';

export interface ParsedStudentRow {
  student_code: string;
  first_name: string;
  last_name: string;
  raw_name: string;
  gender: 'M' | 'F';
  phone?: string;
  guardian_phone?: string;
  all_phones: string[];
  class_id?: string;
  matched_class_name?: string;
  raw_class_group: string;
  status: 'ACTIVE';
  isValid: boolean;
  error?: string;
}

export interface ParsedImportResult {
  totalRows: number;
  validRows: ParsedStudentRow[];
  invalidRows: ParsedStudentRow[];
  classStats: Record<string, number>;
  phoneStats: {
    zero: number;
    single: number;
    double: number;
    multiple: number;
  };
}

/**
 * Extracts and cleans all phone numbers from raw text.
 * Handles single, double, or multiple numbers with any separators (spaces, slashes, commas, dashes, +212, etc.)
 */
export function extractPhoneNumbers(str: string | number | undefined | null): string[] {
  if (!str) return [];
  const raw = String(str).trim();
  if (!raw) return [];

  // Match Moroccan & standard phone number patterns
  const regex = /(\+212[\s\.\-]?\d[\s\.\-]?\d{2}[\s\.\-]?\d{2}[\s\.\-]?\d{2}[\s\.\-]?\d{2}|0[5-7](?:[\s\.\-]?\d{2}){4}|0[5-7]\d{8}|\d{10})/g;
  const matches = raw.match(regex) || [];
  const normalized = matches
    .map((m) => m.replace(/[^\d+]/g, '').trim())
    .filter((m) => m.length >= 9);

  // Fallback splitting if regex didn't catch (e.g. space-separated irregular numbers)
  if (normalized.length === 0) {
    const parts = raw.split(/[\s,;/|\n\r]+/).filter(Boolean);
    parts.forEach((p) => {
      const c = p.replace(/[^\d+]/g, '');
      if (c.length >= 9) normalized.push(c);
    });
  }

  // Deduplicate while preserving order and normalizing +212 -> 0
  const unique: string[] = [];
  normalized.forEach((p) => {
    let std = p;
    if (std.startsWith('+212')) std = '0' + std.slice(4);
    if (std.length === 9 && (std.startsWith('6') || std.startsWith('7') || std.startsWith('5'))) {
      std = '0' + std;
    }
    if (!unique.includes(std)) {
      unique.push(std);
    }
  });

  return unique;
}

/**
 * Splits raw student full name into first_name and last_name.
 */
export function splitStudentName(rawName: string): { firstName: string; lastName: string } {
  const clean = String(rawName || '').trim().replace(/\s+/g, ' ');
  if (!clean) return { lastName: 'Élève', firstName: 'Inconnu' };

  const parts = clean.split(' ');
  if (parts.length === 1) {
    return { lastName: parts[0].toUpperCase(), firstName: parts[0] };
  }
  if (parts.length === 2) {
    return { lastName: parts[0].toUpperCase(), firstName: parts[1] };
  }

  // If 3 or more words, standard Moroccan pattern: Family name usually first words (e.g. "EL DAHBI JANNAT" -> "EL DAHBI", "JANNAT")
  // Or "AIT BOUKHIMA MOHAMED ZIADE" -> "AIT BOUKHIMA", "MOHAMED ZIADE"
  const mid = Math.max(1, parts.length - 1);
  return {
    lastName: parts.slice(0, mid).join(' ').toUpperCase(),
    firstName: parts.slice(mid).join(' '),
  };
}

/**
 * Matches raw class / group string (e.g. "CM1- GB", "6ème- GA", "CE2- GA", "CP- GB") to an existing ClassEntity.
 */
export function matchClassEntity(rawClassGroup: string, existingClasses: ClassEntity[]): ClassEntity | null {
  if (!rawClassGroup) return null;
  const raw = String(rawClassGroup).trim();

  // 1. Direct exact name match
  const exact = existingClasses.find((c) => c.name.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;

  // 2. Normalized level and group analysis
  const norm = raw.toUpperCase().replace(/\s+/g, '').replace(/È/g, 'E').replace(/É/g, 'E');

  // Extract level
  let level = '';
  if (norm.includes('TPS')) level = 'TPS';
  else if (norm.includes('PS')) level = 'PS';
  else if (norm.includes('MS')) level = 'MS';
  else if (norm.includes('GS')) level = 'GS';
  else if (norm.includes('CP')) level = 'CP';
  else if (norm.includes('CE1')) level = 'CE1';
  else if (norm.includes('CE2')) level = 'CE2';
  else if (norm.includes('CM1')) level = 'CM1';
  else if (norm.includes('CM2')) level = 'CM2';
  else if (norm.includes('6') || norm.includes('CE6') || norm.includes('6EME') || norm.includes('6AEP')) level = 'CE6';
  else if (norm.includes('1AC') || norm.includes('7AP')) level = '1AC';
  else if (norm.includes('2AC') || norm.includes('8AP')) level = '2AC';
  else if (norm.includes('3AC') || norm.includes('9AP')) level = '3AC';
  else if (norm.includes('TC') || norm.includes('TCS')) level = 'TC';
  else if (norm.includes('1BAC')) level = '1BAC';
  else if (norm.includes('2BAC')) level = '2BAC';

  // Extract group
  let group = 'A';
  if (
    norm.includes('GB') ||
    norm.includes('-B') ||
    norm.endsWith('B') ||
    norm.includes('GRB') ||
    norm.includes('GROUPB') ||
    norm.includes('GROUPEB')
  ) {
    group = 'B';
  } else if (
    norm.includes('GA') ||
    norm.includes('-A') ||
    norm.endsWith('A') ||
    norm.includes('GRA') ||
    norm.includes('GROUPA') ||
    norm.includes('GROUPEA')
  ) {
    group = 'A';
  }

  // 3. Match against level & group_name or class name
  const matched = existingClasses.find(
    (c) =>
      (c.level === level || (level === 'CE6' && (c.level === 'CE6' || c.name.includes('CE6') || c.name.includes('6')))) &&
      (c.group_name === group || c.name.endsWith(`-${group}`) || c.name.endsWith(` ${group}`) || c.name.endsWith(group))
  );

  if (matched) return matched;

  // 4. Secondary fallback: check if level is contained in name
  const fallback = existingClasses.find(
    (c) =>
      c.name.toUpperCase().includes(level) &&
      (c.name.toUpperCase().includes(group) || c.group_name === group)
  );

  return fallback || null;
}

/**
 * Parses Excel workbook data (Buffer or ArrayBuffer) and returns parsed students list with full integrity checks.
 */
export function parseStudentsExcel(
  data: ArrayBuffer | Uint8Array,
  existingClasses: ClassEntity[]
): ParsedImportResult {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Le fichier Excel ne contient aucune feuille de calcul.');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

  const validRows: ParsedStudentRow[] = [];
  const invalidRows: ParsedStudentRow[] = [];
  const classStats: Record<string, number> = {};
  const phoneStats = { zero: 0, single: 0, double: 0, multiple: 0 };

  rawRows.forEach((row, idx) => {
    // Find column keys flexibly
    const keys = Object.keys(row);
    const findVal = (...aliases: string[]) => {
      for (const alias of aliases) {
        const foundKey = keys.find(
          (k) =>
            k.toLowerCase().trim() === alias.toLowerCase().trim() ||
            k.toLowerCase().replace(/[\s\/\_\-\.]/g, '') === alias.toLowerCase().replace(/[\s\/\_\-\.]/g, '')
        );
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
          return String(row[foundKey]).trim();
        }
      }
      return '';
    };

    const rawClassGroup = findVal('Classe/Groupe', 'Classe', 'Groupe', 'Class', 'Group', 'Division');
    const rawName = findVal('Elve', 'Élève', 'Eleve', 'Nom', 'Nom Complet', 'Nom et Prénom', 'Student Name', 'Full Name');
    let rawCode = findVal('Identifiant', 'Code Massar', 'Massar', 'Code', 'CNE', 'Student Code', 'Matricule');
    const rawTel = findVal('Tel Parent', 'Tel', 'Telephone', 'Téléphone', 'Phone', 'Gsm', 'Contact');

    // Skip totally empty rows
    if (!rawClassGroup && !rawName && !rawCode && !rawTel) {
      return;
    }

    // Clean code
    rawCode = rawCode.replace(/\.+$/, '').trim();
    if (!rawCode) {
      // Auto-generate a fallback student code if missing
      rawCode = `GM-${new Date().getFullYear()}-${String(idx + 1).padStart(4, '0')}`;
    }

    const { firstName, lastName } = splitStudentName(rawName);
    const phones = extractPhoneNumbers(rawTel);
    const matchedClass = matchClassEntity(rawClassGroup, existingClasses);

    // Phone stats
    if (phones.length === 0) phoneStats.zero++;
    else if (phones.length === 1) phoneStats.single++;
    else if (phones.length === 2) phoneStats.double++;
    else phoneStats.multiple++;

    // Prepare primary phone & guardian phone
    const primaryPhone = phones[0] || undefined;
    const guardianPhone =
      phones.length > 1
        ? phones.slice(1).join(' / ')
        : (phones.length === 1 ? phones[0] : undefined);

    const parsedRow: ParsedStudentRow = {
      student_code: rawCode,
      first_name: firstName,
      last_name: lastName,
      raw_name: rawName,
      gender: 'M',
      phone: primaryPhone,
      guardian_phone: guardianPhone,
      all_phones: phones,
      class_id: matchedClass?.id,
      matched_class_name: matchedClass?.name,
      raw_class_group: rawClassGroup,
      status: 'ACTIVE',
      isValid: Boolean(matchedClass && firstName && lastName),
      error: !matchedClass
        ? `Classe non trouvée pour "${rawClassGroup}"`
        : !rawName
        ? 'Nom de l\'élève manquant'
        : undefined,
    };

    if (parsedRow.isValid) {
      validRows.push(parsedRow);
      const cName = matchedClass?.name || 'Inconnue';
      classStats[cName] = (classStats[cName] || 0) + 1;
    } else {
      invalidRows.push(parsedRow);
    }
  });

  return {
    totalRows: validRows.length + invalidRows.length,
    validRows,
    invalidRows,
    classStats,
    phoneStats,
  };
}

/**
 * Generates and downloads a clean, pre-formatted Excel template for students import.
 */
export function generateStudentExcelTemplate(): Uint8Array {
  const sampleData = [
    {
      'Classe/Groupe': 'CP- GA',
      'Elve': 'BENANI YOUSSEF',
      'Identifiant': 'G244012345',
      'Tel Parent': '0661123456  0672987654',
    },
    {
      'Classe/Groupe': 'CP- GB',
      'Elve': 'EL ALAMI HIDAYA',
      'Identifiant': 'G244067890',
      'Tel Parent': '0663855668',
    },
    {
      'Classe/Groupe': 'CE1- GA',
      'Elve': 'CHRAIBI MEHDI',
      'Identifiant': 'G235011223',
      'Tel Parent': '0670112233  0660445566 / 0712334455',
    },
    {
      'Classe/Groupe': 'CE2- GA',
      'Elve': 'IDRISSI GHITA',
      'Identifiant': 'G226099887',
      'Tel Parent': '',
    },
    {
      'Classe/Groupe': 'CM1- GB',
      'Elve': 'TAZI RAYANE',
      'Identifiant': 'G219055443',
      'Tel Parent': '0665998877',
    },
    {
      'Classe/Groupe': '6ème- GA',
      'Elve': 'BERRADA KENZA',
      'Identifiant': 'G198144332',
      'Tel Parent': '0662513703  0679650400',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  // Column widths
  worksheet['!cols'] = [
    { wch: 18 }, // Classe/Groupe
    { wch: 32 }, // Elve
    { wch: 16 }, // Identifiant
    { wch: 35 }, // Tel Parent
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Liste Élèves');
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(excelBuffer);
}
