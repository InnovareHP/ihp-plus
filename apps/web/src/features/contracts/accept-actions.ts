'use server'

import { headers } from 'next/headers'
import { acceptSharedContract, type AcceptContractResult } from './shared-contract'

// Client-facing and session-free on purpose: the signed link is the credential.
export async function acceptContract(input: unknown): Promise<AcceptContractResult> {
  const requestHeaders = await headers()

  return acceptSharedContract(input, {
    // The nginx proxy is the first hop, so the client's own address is the left-most entry.
    ip: requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    userAgent: requestHeaders.get('user-agent'),
  })
}
