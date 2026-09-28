'use server'

import { headers } from 'next/headers'
import { clientIpOf } from '@/lib/rate-limit'
import type { UploadedFile } from '@/features/requests/schema'
import {
  storeApplicationFile,
  submitApplication as submit,
  withdrawApplication as withdraw,
} from './public-service'
import { answerOffer as answer } from './offer-service'
import { bookInterviewSlot, requestNewTimes } from './public-interview-service'
import type { ActionResult } from './schema'

// Server actions rather than RPC: there is no session for the transport's auth to carry, and a
// file travels as multipart instead of base64 through the nginx body limit.

export async function uploadApplicationFile(
  formData: FormData,
): Promise<ActionResult<UploadedFile>> {
  return storeApplicationFile(
    {
      slug: String(formData.get('slug') ?? ''),
      fieldId: String(formData.get('fieldId') ?? ''),
      file: formData.get('file'),
    },
    { ip: clientIpOf(await headers()) },
  )
}

export async function submitApplication(
  input: unknown,
): Promise<ActionResult<{ statusPath: string }>> {
  return submit(input, { ip: clientIpOf(await headers()) })
}

export async function withdrawApplication(input: unknown): Promise<ActionResult> {
  return withdraw(input)
}

export async function bookInterview(input: unknown): Promise<ActionResult> {
  return bookInterviewSlot(input)
}

export async function askForOtherTimes(input: unknown): Promise<ActionResult> {
  return requestNewTimes(input)
}

export async function answerOffer(input: unknown): Promise<ActionResult> {
  return answer(input)
}
