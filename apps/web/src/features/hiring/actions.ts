'use server'

import { ConnectError } from '@ihp/rpc'
import { sendOffer as send } from './offer-service'
import type { ActionResult, ApplicationDetail } from './schema'

// A server action rather than RPC, so the offer letter travels as multipart, not base64.
export async function sendOffer(formData: FormData): Promise<ActionResult<ApplicationDetail>> {
  try {
    const detail = await send({
      applicationId: String(formData.get('applicationId') ?? ''),
      message: String(formData.get('message') ?? ''),
      file: formData.get('file'),
    })
    return { ok: true, data: detail }
  } catch (error) {
    if (error instanceof ConnectError) return { ok: false, message: error.rawMessage }
    console.error('[hiring] sending an offer failed', error)
    return { ok: false, message: 'Could not send the offer — try again.' }
  }
}
