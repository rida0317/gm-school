/**
 * WhatsApp Integration Utilities for GM School
 * Provides Moroccan phone normalization, template variable replacements,
 * and direct WhatsApp Web/App wa.me link generation.
 */

export interface AbsenceMessageParams {
  studentName: string;
  guardianName?: string;
  className: string;
  date: string;
  schoolName: string;
  isLate?: boolean;
  lateMinutes?: number;
  customTemplate?: string;
  locale?: 'fr' | 'ar';
}

export const DEFAULT_WHATSAPP_TEMPLATES = {
  ar_absence: `*مجموعة مدارس الأجيال الصاعدة*
----------------------------------------
السلام عليكم ورحمة الله وبركاته،
السيد(ة) ولي أمر التلميذ(ة) *{student_name}* (القسم: *{class_name}*)،

نحيطكم علماً بأنه قد تم تسجيل *غياب* ابنكم/ابنتكم عن المدرسة بتاريخ *{date}*.
المرجو التواصل مع إدارة المؤسسة لتبرير هذا الغياب.

— *إدارة المؤسسة*`,

  ar_late: `*مجموعة مدارس الأجيال الصاعدة*
----------------------------------------
السلام عليكم ورحمة الله وبركاته،
السيد(ة) ولي أمر التلميذ(ة) *{student_name}* (القسم: *{class_name}*)،

نخبركم بتسجيل *تأخر* ابنكم/ابنتكم عن موعد الدخول المدرسي بتاريخ *{date}* (مدة التأخر: *{late_minutes} دقيقة*).
المرجو الحرص على احترام التوقيت المدرسي.

— *إدارة المؤسسة*`,

  fr_absence: `*GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES*
----------------------------------------
Bonjour,
Cher parent de l'élève *{student_name}* (Classe : *{class_name}*),

Nous vous informons que votre enfant a été enregistré(e) *ABSENT(E)* le *{date}*.
Merci de bien vouloir prendre contact avec l'administration pour justifier cette absence.

— *Direction Pédagogique*`,

  fr_late: `*GROUPE SCOLAIRE DES GÉNÉRATIONS MONTANTES*
----------------------------------------
Bonjour,
Cher parent de l'élève *{student_name}* (Classe : *{class_name}*),

Nous vous signalons un *RETARD* de votre enfant à l'école le *{date}* (Durée : *{late_minutes} min*).
Merci de veiller au respect des horaires d'entrée.

— *Direction Pédagogique*`,
};

/**
 * Normalizes phone numbers into international format suitable for wa.me.
 * Special support for Moroccan mobile & landline numbers:
 * 06XXXXXXXX -> 2126XXXXXXXX
 * 07XXXXXXXX -> 2127XXXXXXXX
 * +2126... -> 2126...
 */
export function normalizeMoroccanPhone(rawPhone?: string | null): string | null {
  if (!rawPhone) return null;

  // Remove all non-digits except +
  let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Remove leading 00
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  // Moroccan local numbers: 06..., 07..., 05...
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '212' + cleaned.substring(1);
  }

  // Moroccan without leading 0 (e.g. 612345678 or 712345678 - 9 digits)
  if ((cleaned.startsWith('6') || cleaned.startsWith('7') || cleaned.startsWith('5')) && cleaned.length === 9) {
    cleaned = '212' + cleaned;
  }

  // Validate length: Moroccan international numbers are 12 digits (212 + 9 digits)
  if (cleaned.length < 8 || cleaned.length > 15) {
    return null;
  }

  return cleaned;
}

/**
 * Formats date to a clean readable localized format (e.g. 24/08/2026)
 */
export function formatWhatsAppDate(dateStr: string, locale: 'fr' | 'ar' = 'ar'): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR');
    }
  } catch {
    // fallback
  }
  return dateStr;
}

/**
 * Compiles a WhatsApp message by replacing placeholders with actual values
 */
export function buildAbsenceMessage(params: AbsenceMessageParams): string {
  const {
    studentName,
    guardianName = '',
    className,
    date,
    schoolName,
    isLate = false,
    lateMinutes = 15,
    customTemplate,
    locale = 'ar',
  } = params;

  let template = customTemplate;

  if (!template || template.trim() === '') {
    if (isLate) {
      template = locale === 'ar' ? DEFAULT_WHATSAPP_TEMPLATES.ar_late : DEFAULT_WHATSAPP_TEMPLATES.fr_late;
    } else {
      template = locale === 'ar' ? DEFAULT_WHATSAPP_TEMPLATES.ar_absence : DEFAULT_WHATSAPP_TEMPLATES.fr_absence;
    }
  }

  const formattedDate = formatWhatsAppDate(date, locale);

  const replacements: Record<string, string> = {
    '{student_name}': studentName || '',
    '{nom_eleve}': studentName || '',
    '{guardian_name}': guardianName || '',
    '{nom_tuteur}': guardianName || '',
    '{class_name}': className || '',
    '{classe}': className || '',
    '{date}': formattedDate,
    '{school_name}': schoolName || 'GM School',
    '{ecole}': schoolName || 'GM School',
    '{late_minutes}': String(lateMinutes || 0),
    '{retard_minutes}': String(lateMinutes || 0),
  };

  let compiled = template;
  for (const [key, value] of Object.entries(replacements)) {
    compiled = compiled.split(key).join(value);
  }

  return compiled;
}

/**
 * Generates the full wa.me link
 */
export function getWhatsAppLink(phone: string, message: string): string {
  const normalized = normalizeMoroccanPhone(phone);
  if (!normalized) return '';
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

/**
 * Opens WhatsApp directly in a new window/tab
 */
export function openWhatsAppChat(phone: string, message: string): boolean {
  const link = getWhatsAppLink(phone, message);
  if (!link) return false;
  if (typeof window !== 'undefined') {
    window.open(link, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
}
