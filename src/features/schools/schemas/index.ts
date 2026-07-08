import { z } from "zod"

export const schoolSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "School name is required"),
  address: z.string().optional(),
  contact_number: z.string().optional(),
  principal_name: z.string().optional(),
  is_active: z.boolean().default(true),
})

export type School = z.infer<typeof schoolSchema>
