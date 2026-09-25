'use client'

import { useQuery } from '@tanstack/react-query'
import { bulletinKeys } from '../query-keys'
import { listPeople } from '../rpc'

// Who works here changes far less often than what is said on the board.
export function useBulletinPeople() {
  return useQuery({
    queryKey: bulletinKeys.people(),
    queryFn: listPeople,
    staleTime: 5 * 60 * 1000,
  })
}
