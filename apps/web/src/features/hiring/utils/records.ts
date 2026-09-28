import type { Prisma } from '@ihp/db'
import { z } from 'zod'
import { formFieldSchema, type FormField } from '@/features/requests/schema'
import { DEFAULT_STAGES, stagesSchema, type Stage } from '../schema'

const fieldsSchema = z.array(formFieldSchema)

// Stored JSON is data the app wrote, but a hand-edited row must not crash a whole list.
export function fieldsOf(value: Prisma.JsonValue): FormField[] {
  const parsed = fieldsSchema.safeParse(value)
  return parsed.success ? parsed.data : []
}

export function stagesOf(value: Prisma.JsonValue): Stage[] {
  const parsed = stagesSchema.safeParse(value)
  return parsed.success ? parsed.data : [...DEFAULT_STAGES]
}
