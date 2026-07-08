import { z } from "zod"

export const paymentSchema = z.object({
  id: z.string().optional(),
  student_id: z.string().min(1, "Student ID is required"),
  school_id: z.string().optional(),
  academic_year: z.string().min(4, "Academic year is required"),
  month: z.coerce.number().min(1).max(12),
  base_amount: z.coerce.number().min(0),
  transport_amount: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  paid_amount: z.coerce.number().min(0),
  status: z.enum(["Pending", "Paid", "Overdue"]),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
})

export type Payment = z.infer<typeof paymentSchema>
