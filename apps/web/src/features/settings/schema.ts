import { z } from 'zod'
import { personalStepSchema } from '@/features/onboarding/schema'

// The same rules onboarding applied, so an edit cannot store what setup would have refused.
export const contactDetailsSchema = personalStepSchema
  .pick({ preferredName: true, phone: true })
  .extend({
    photoKey: z.string().min(1, 'Add a photo; it is printed on your company ID'),
  })

export type ContactDetailsValues = z.infer<typeof contactDetailsSchema>

export type ContactDetailsField = keyof ContactDetailsValues
