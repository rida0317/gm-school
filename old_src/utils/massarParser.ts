// src/utils/massarParser.ts
// 🔒 SECURITY: Enhanced validation for Massar file imports

import * as XLSX from "xlsx";

// 🔒 SECURITY: Constants for validation
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_ROWS = 1000 // Maximum number of students per import
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream' // Fallback for some browsers
]

// 🔒 SECURITY: Regex patterns for validation
const CODE_MASSAR_REGEX = /^[A-Za-z0-9]{8,12}$/
const NOM_PRENOM_REGEX = /^[\p{L}\p{M}'\- ]+$/u // Unicode letters, apostrophes, hyphens, spaces

export interface Student {
  codeMassar: string;
  nom: string;
  prenom: string;
  genre: string;
  dateNaissance?: string;
  lieuNaissance?: string;
}

export interface ParseResult {
  students: Student[];
  errors: ParseError[];
  warnings: ParseError[];
}

export interface ParseError {
  row: number;
  field: string;
  value: string | undefined;
  message: string;
}

/**
 * 🔒 SECURITY: Validate file before parsing
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB. Your file: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    }
  }

  // Check file extension
  const fileName = file.name.toLowerCase()
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
    return {
      valid: false,
      error: 'Invalid file format. Only .xlsx and .xls files are allowed'
    }
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type) && file.type !== '') {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Only Excel files are allowed`
    }
  }

  return { valid: true }
}

/**
 * 🔒 SECURITY: Sanitize string to prevent XSS
 */
function sanitizeString(str: any): string {
  if (str === null || str === undefined) return ''
  
  const stringVal = String(str).trim()
  
  // Remove potential XSS patterns
  return stringVal
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
    .substring(0, 100) // Limit length
}

/**
 * 🔒 SECURITY: Validate Code Massar format
 */
function validateCodeMassar(code: string): { valid: boolean; error?: string } {
  if (!code || code.trim().length === 0) {
    return { valid: false, error: 'Code Massar is required' }
  }
  
  const cleanedCode = code.trim().toUpperCase()
  
  if (cleanedCode.length < 8 || cleanedCode.length > 12) {
    return { valid: false, error: 'Code Massar must be between 8 and 12 characters' }
  }
  
  if (!CODE_MASSAR_REGEX.test(cleanedCode)) {
    return { valid: false, error: 'Code Massar contains invalid characters' }
  }
  
  return { valid: true }
}

/**
 * 🔒 SECURITY: Validate Nom/Prénom
 */
function validateName(name: string, field: 'nom' | 'prenom'): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: `${field.charAt(0).toUpperCase() + field.slice(1)} is required` }
  }
  
  const sanitizedName = sanitizeString(name)
  
  if (sanitizedName.length < 2) {
    return { valid: false, error: `${field.charAt(0).toUpperCase() + field.slice(1)} must be at least 2 characters` }
  }
  
  if (sanitizedName.length > 50) {
    return { valid: false, error: `${field.charAt(0).toUpperCase() + field.slice(1)} is too long (max 50 characters)` }
  }
  
  // Allow Arabic/French characters
  if (!NOM_PRENOM_REGEX.test(sanitizedName)) {
    return { valid: false, error: `${field.charAt(0).toUpperCase() + field.slice(1)} contains invalid characters` }
  }
  
  return { valid: true }
}

/**
 * 🔒 SECURITY: Validate Genre
 */
function validateGenre(genre: string): { valid: boolean; error?: string } {
  if (!genre || genre.trim().length === 0) {
    return { valid: false, error: 'Genre is required' }
  }
  
  const normalized = genre.trim().toLowerCase()
  
  if (!['m', 'f', 'garçon', 'fille', 'male', 'female', 'boy', 'girl'].includes(normalized)) {
    return { valid: false, error: 'Genre must be M or F' }
  }
  
  return { valid: true }
}

/**
 * 🔒 SECURITY: Professional Massar Excel Parser with enhanced validation
 * Automatically detects header row and extracts student data
 */
export async function parseMassarFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    // 🔒 SECURITY: Validate file before parsing
    const fileValidation = validateFile(file)
    if (!fileValidation.valid) {
      resolve({
        students: [],
        errors: [
          {
            row: 0,
            field: 'file',
            value: file.name,
            message: fileValidation.error!
          }
        ],
        warnings: []
      })
      return
    }

    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        // 🔒 Read with cellDates to properly parse Excel dates
        const workbook = XLSX.read(data, { 
          type: 'array',
          cellDates: true, // Convert date cells to Date objects
          cellNF: true, // Keep number format
          cellText: true // Get formatted text
        })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]

        // Convert sheet to JSON array with raw values
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { 
          header: 1,
          raw: false, // Get formatted values (dates as strings)
          dateNF: 'yyyy/mm/dd' // Force date format
        })

        // 🔒 SECURITY: Check number of rows
        if (rows.length > MAX_ROWS) {
          resolve({
            students: [],
            errors: [
              {
                row: 0,
                field: 'file',
                value: undefined,
                message: `File contains ${rows.length} rows. Maximum allowed is ${MAX_ROWS}. Please split your file.`
              }
            ],
            warnings: []
          })
          return
        }

        // Find header row (contains "Code" and "Nom")
        const headerIndex = rows.findIndex(
          (row) =>
            row.some((cell) =>
              cell?.toString().toLowerCase().includes('code')
            ) &&
            row.some((cell) =>
              cell?.toString().toLowerCase().includes('nom')
            )
        )

        if (headerIndex === -1) {
          resolve({
            students: [],
            errors: [
              {
                row: 0,
                field: 'header',
                value: undefined,
                message:
                  "Could not find header row. Make sure the file contains 'Code' and 'Nom' columns."
              }
            ],
            warnings: []
          })
          return
        }

        // Get headers from the header row
        const headers = rows[headerIndex].map((h) =>
          h?.toString().trim().toLowerCase()
        );

        // Map header indices with better detection
        const headerMap: Record<string, number> = {};
        headers.forEach((header, index) => {
          if (header?.includes("code")) headerMap["codeMassar"] = index;
          if (header?.includes("nom") && !header?.includes("prénom"))
            headerMap["nom"] = index;
          if (header?.includes("prénom") || header?.includes("prenom"))
            headerMap["prenom"] = index;
          if (header?.includes("genre") || header?.includes("sexe"))
            headerMap["genre"] = index;

          // Better detection for date de naissance column - MUST have "date" keyword
          if (
            (header?.includes("date") && header?.includes("naissance")) ||
            (header?.includes("date") && header?.includes("nè")) ||
            (header?.includes("date") && header?.includes("ne")) ||
            header === "date" ||
            header?.includes("dob") ||
            header?.includes("birth")
          ) {
            headerMap["dateNaissance"] = index;
          }

          // Lieu de naissance - MUST have "lieu" keyword
          if (header?.includes("lieu")) {
            headerMap["lieuNaissance"] = index;
          }
        });

        // Parse student rows
        const students: Student[] = [];
        const errors: ParseError[] = [];
        const warnings: ParseError[] = [];

        for (let i = headerIndex + 1; i < rows.length; i++) {
          const row = rows[i];

          // Skip empty rows
          if (!row || row.every((cell) => !cell)) continue;

          const student: Partial<Student> = {
            codeMassar: row[headerMap["codeMassar"]]?.toString().trim(),
            nom: row[headerMap["nom"]]?.toString().trim(),
            prenom: row[headerMap["prenom"]]?.toString().trim(),
            genre: normalizeGenre(row[headerMap["genre"]]?.toString()),
            dateNaissance: formatDate(row[headerMap["dateNaissance"]]),
            lieuNaissance: row[headerMap["lieuNaissance"]]?.toString().trim(),
          };

          // Validate student data
          const rowErrors: ParseError[] = [];
          const rowWarnings: ParseError[] = [];

          // Validate Code Massar (should be 9-10 characters)
          if (!student.codeMassar) {
            rowErrors.push({
              row: i + 1,
              field: "codeMassar",
              value: student.codeMassar,
              message: "Code Massar is required",
            });
          } else if (student.codeMassar.length < 8) {
            rowErrors.push({
              row: i + 1,
              field: "codeMassar",
              value: student.codeMassar,
              message: "Code Massar must be at least 8 characters",
            });
          }

          // Validate Nom
          if (!student.nom || student.nom.length === 0) {
            rowErrors.push({
              row: i + 1,
              field: "nom",
              value: student.nom,
              message: "Nom is required",
            });
          }

          // Validate Prénom
          if (!student.prenom || student.prenom.length === 0) {
            rowWarnings.push({
              row: i + 1,
              field: "prenom",
              value: student.prenom,
              message: "Prénom is missing",
            });
          }

          // Validate Genre
          if (!student.genre) {
            rowWarnings.push({
              row: i + 1,
              field: "genre",
              value: student.genre,
              message: "Genre is missing",
            });
          }

          if (rowErrors.length > 0) {
            errors.push(...rowErrors);
          }
          warnings.push(...rowWarnings);

          // Only add student if no critical errors
          if (rowErrors.length === 0 && student.codeMassar && student.nom) {
            students.push(student as Student);
          }
        }

        // Check for duplicate codes
        const codeCounts = new Map<string, number>();
        students.forEach((s) => {
          codeCounts.set(s.codeMassar, (codeCounts.get(s.codeMassar) || 0) + 1);
        });

        codeCounts.forEach((count, code) => {
          if (count > 1) {
            warnings.push({
              row: 0,
              field: "codeMassar",
              value: code,
              message: `Duplicate Code Massar: ${code} appears ${count} times`,
            });
          }
        });

        resolve({ students, errors, warnings });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Normalize genre value to standard format
 */
function normalizeGenre(value?: string): string {
  if (!value) return "";

  const normalized = value.toLowerCase().trim();

  if (normalized === "m" || normalized === "garçon" || normalized === "boy") {
    return "Garçon";
  }
  if (normalized === "f" || normalized === "fille" || normalized === "girl") {
    return "Fille";
  }

  return value;
}

/**
 * Format date to YYYY-MM-DD
 * Handles multiple Excel date formats including serial numbers and various string formats
 */
function formatDate(value: any): string | undefined {
  if (!value) return undefined;

  let date: Date | null = null;

  // Convert value to string first for inspection
  const stringValue = typeof value === 'string' ? value.trim() : String(value);

  // If it's a number (Excel date serial number)
  if (typeof value === "number") {
    // Excel uses December 30, 1899 as day 0 for Windows, 1904 for Mac
    // Most common: Windows format (1900 date system)
    // Excel serial 1 = January 1, 1900
    // Unix epoch (January 1, 1970) = 25569 in Excel
    if (value > 0 && value < 2958465) { // Valid Excel date range
      // Convert Excel serial to JavaScript Date
      // Excel has a bug where it treats 1900 as a leap year, so we adjust
      const excelEpoch = new Date(1899, 11, 30);
      date = new Date(excelEpoch.getTime() + (value * 24 * 60 * 60 * 1000));

      // Adjust for Excel's 1900 leap year bug (values >= 60)
      if (value >= 60) {
        date = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      }
    }
  }
  // If it's a Date object
  else if (value instanceof Date) {
    date = value;
  }
  // If it's a string
  else if (typeof value === "string") {
    const trimmedValue = value.trim();

    // Format: YYYY/MM/DD or YYYY-MM-DD (e.g., 2010/06/08, 2010-06-08)
    const yyyymmddMatch = trimmedValue.match(/^(\d{4})[/. -](\d{1,2})[/. -](\d{1,2})$/);
    if (yyyymmddMatch) {
      const [, year, month, day] = yyyymmddMatch;
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    // Format: DD/MM/YYYY or DD-MM-YYYY (e.g., 08/06/2010, 08-06-2010)
    else {
      const ddmmyyyyMatch = trimmedValue.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
      if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
    }
    
    // Try parsing with native Date as fallback
    if (!date) {
      const parsedDate = new Date(trimmedValue);
      if (!isNaN(parsedDate.getTime())) {
        date = parsedDate;
      }
    }
  }

  // Validate and format the date
  if (date && !isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // If all parsing fails, return the original value as string
  return stringValue || undefined;
}

/**
 * Validate students before import
 */
export function validateStudents(students: Student[]): ParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseError[] = [];
  const validStudents: Student[] = [];

  const codeSet = new Set<string>();

  students.forEach((student, index) => {
    let isValid = true;

    // Check duplicate
    if (codeSet.has(student.codeMassar)) {
      errors.push({
        row: index + 1,
        field: "codeMassar",
        value: student.codeMassar,
        message: `Duplicate Code Massar: ${student.codeMassar}`,
      });
      isValid = false;
    } else {
      codeSet.add(student.codeMassar);
    }

    // Validate required fields
    if (!student.codeMassar || student.codeMassar.length < 8) {
      errors.push({
        row: index + 1,
        field: "codeMassar",
        value: student.codeMassar,
        message: "Invalid Code Massar (min 8 characters)",
      });
      isValid = false;
    }

    if (!student.nom || student.nom.trim().length === 0) {
      errors.push({
        row: index + 1,
        field: "nom",
        value: student.nom,
        message: "Nom is required",
      });
      isValid = false;
    }

    if (isValid) {
      validStudents.push(student);
    }
  });

  return {
    students: validStudents,
    errors,
    warnings,
  };
}

