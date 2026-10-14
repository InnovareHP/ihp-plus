import { z } from 'zod'

// No line breaks in the name: it becomes the email's subject line.
export const contactEnquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[^\r\n]+$/),
  email: z.email().max(320),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9 ()+.-]{7,20}$/),
  message: z.string().trim().min(1).max(5000),
  'cf-turnstile-response': z.string().max(2048).default(''),
})

export type ContactEnquiry = z.infer<typeof contactEnquirySchema>
