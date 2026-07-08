import { z } from "zod"

export const teacherSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  max_hours_per_week: z.coerce.number().min(0).default(0),
  is_vacataire: z.boolean().default(false),
  is_active: z.boolean().default(true),
})

export type Teacher = z.infer<typeof teacherSchema>
