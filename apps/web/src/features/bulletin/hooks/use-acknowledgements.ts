'use client'

import { useQuery } from '@tanstack/react-query'
import { bulletinKeys } from '../query-keys'
import { listAcknowledgements } from '../rpc'

/** `enabled` keeps a closed dialog from costing a request. */
export function useAcknowledgements(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: bulletinKeys.acknowledgements(postId),
    queryFn: () => listAcknowledgements(postId),
    enabled,
    staleTime: 30 * 1000,
  })
}
