import { z } from "zod"

export const studentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name is required"),
  code_massar: z.string().min(1, "Massar Code is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  gender: z.enum(["Male", "Female"]),
  date_of_birth: z.string().optional(),
  parent_name: z.string().optional(),
  is_active: z.boolean().default(true),
})

export type Student = z.infer<typeof studentSchema>
