import { z } from "zod"

export const bookSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1, "Author is required"),
  isbn: z.string().optional(),
  category: z.string().optional(),
  total_copies: z.coerce.number().min(1).default(1),
  available_copies: z.coerce.number().min(0).default(1),
  location: z.string().optional(),
})

export type Book = z.infer<typeof bookSchema>
