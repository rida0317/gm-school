import { z } from "zod"

export const classSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Class Name is required"),
  level: z.string().optional(),
  room_id: z.string().optional(),
  teacher_id: z.string().optional(),
  max_students: z.coerce.number().min(1).default(30),
  is_active: z.boolean().default(true),
})

export type Class = z.infer<typeof classSchema>
