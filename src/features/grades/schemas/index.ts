import { z } from "zod"

export const gradeSchema = z.object({
  id: z.string().optional(),
  student_id: z.string().min(1, "Student ID is required"),
  subject_name: z.string().min(1, "Subject is required"),
  exam_name: z.string().min(1, "Exam name is required"),
  score: z.coerce.number().min(0),
  max_score: z.coerce.number().min(1).default(20),
  comments: z.string().optional(),
  exam_date: z.string().optional(),
})

export type Grade = z.infer<typeof gradeSchema>
