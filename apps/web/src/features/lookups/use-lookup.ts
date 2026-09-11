'use client'

import { ConnectError } from '@ihp/rpc'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { browserClients } from '@/rpc/browser'
import type { LookupKind, LookupOptionRow } from './schema'

export const lookupKeys = {
  all: ['lookups'] as const,
  kind: (kind: LookupKind) => [...lookupKeys.all, kind] as const,
}

async function listOptions(kind: LookupKind): Promise<LookupOptionRow[]> {
  try {
    const response = await browserClients.lookups.listOptions({ kind })
    return response.options.map((option) => ({
      value: option.value,
      sortOrder: option.sortOrder,
    }))
  } catch (error) {
    throw new Error(ConnectError.from(error).rawMessage)
  }
}

// The lists change rarely, so once a dropdown has paid for one it stays warm for the session.
const STALE_TIME = 10 * 60 * 1000

function optionsQuery(kind: LookupKind) {
  return {
    queryKey: lookupKeys.kind(kind),
    queryFn: () => listOptions(kind),
    staleTime: STALE_TIME,
  }
}

/**
 * Options are not fetched when the page renders. The first hover or keyboard focus on the
 * control warms the cache, and opening the dropdown is the backstop for anyone who reaches it
 * without either — a touch user, or a keyboard user who types straight into it.
 */
export function useLookup(kind: LookupKind) {
  const queryClient = useQueryClient()
  // Ephemeral, local, and set from an event handler: exactly what useState is still for.
  const [wanted, setWanted] = useState(false)

  const query = useQuery({ ...optionsQuery(kind), enabled: wanted })

  return {
    options: query.data ?? [],
    isPending: wanted && query.isPending,
    isError: query.isError,
    error: query.error,
    /** Hover or focus: fetch into the cache without waiting for a render that needs it. */
    warm: () => {
      if (wanted) return
      void queryClient.prefetchQuery(optionsQuery(kind))
      setWanted(true)
    },
    /** Open: the same fetch, for anyone who never hovered. */
    open: () => setWanted(true),
  }
}
