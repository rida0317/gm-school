import { createClient } from '@/lib/supabase/client';
import { Profile, Teacher } from '@/types/database';

export interface ResolvedTeacherScope {
  teacher: Teacher | null;
  allowedClassIds: string[];
  teacherName: string;
}

/**
 * Resolves the Teacher record for the given user profile.
 * Employs multi-factor matching (profile_id -> email -> fuzzy first_name/last_name)
 * and automatically links unlinked teacher rows to the profile.
 */
export async function resolveTeacherScope(profile: Profile | null): Promise<ResolvedTeacherScope> {
  if (!profile || profile.role !== 'TEACHER') {
    return { teacher: null, allowedClassIds: [], teacherName: '' };
  }

  const supabase = createClient();

  // 1. Primary match: by profile_id OR email
  let { data: teacherData } = await supabase
    .from('teachers')
    .select('*')
    .or(`profile_id.eq.${profile.id},email.ilike.${profile.email.trim()}`)
    .maybeSingle();

  // 2. Secondary match: by First Name and Last Name matching
  if (!teacherData && (profile.first_name || profile.last_name)) {
    const fn = (profile.first_name || '').trim();
    const ln = (profile.last_name || '').trim();

    const { data: allTeachers } = await supabase.from('teachers').select('*');
    if (allTeachers && allTeachers.length > 0) {
      const cleanProfileName = `${fn} ${ln}`.toLowerCase().replace(/\s+/g, ' ').trim();
      const cleanProfileInverted = `${ln} ${fn}`.toLowerCase().replace(/\s+/g, ' ').trim();

      const matched = allTeachers.find((t) => {
        const cleanTeacherName = `${t.first_name} ${t.last_name}`.toLowerCase().replace(/\s+/g, ' ').trim();
        const cleanTeacherInverted = `${t.last_name} ${t.first_name}`.toLowerCase().replace(/\s+/g, ' ').trim();
        return (
          cleanTeacherName === cleanProfileName ||
          cleanTeacherInverted === cleanProfileName ||
          cleanTeacherName === cleanProfileInverted ||
          (cleanTeacherName.includes(fn.toLowerCase()) && cleanTeacherName.includes(ln.toLowerCase()))
        );
      });

      if (matched) {
        teacherData = matched;
        // Auto-link profile_id and email in Supabase
        try {
          await supabase
            .from('teachers')
            .update({ profile_id: profile.id, email: profile.email })
            .eq('id', matched.id);
        } catch (err) {
          console.warn('Auto-link teacher profile warning:', err);
        }
      }
    }
  }

  if (!teacherData) {
    return {
      teacher: null,
      allowedClassIds: [],
      teacherName: `${profile.first_name} ${profile.last_name}`.trim(),
    };
  }

  const teacherName = `${teacherData.first_name} ${teacherData.last_name}`.trim();

  // 3. Fetch all classes taught by this teacher in the Timetable and Main Classes
  const [{ data: slots }, { data: mainClasses }] = await Promise.all([
    supabase.from('timetable_slots').select('class_id').eq('teacher_id', teacherData.id),
    supabase.from('classes').select('id').eq('main_teacher_id', teacherData.id),
  ]);

  const classIdSet = new Set<string>();
  (slots || []).forEach((s) => {
    if (s.class_id) classIdSet.add(s.class_id);
  });
  (mainClasses || []).forEach((c) => {
    if (c.id) classIdSet.add(c.id);
  });

  return {
    teacher: teacherData,
    allowedClassIds: Array.from(classIdSet),
    teacherName,
  };
}
