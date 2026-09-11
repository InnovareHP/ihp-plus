'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { directoryKeys } from './query-keys'
import { listDepartments, listPeople } from './rpc'
import type { DirectoryQuery } from './schema'

export function useDirectory(query: DirectoryQuery) {
  return useQuery({
    queryKey: directoryKeys.list(query),
    queryFn: () => listPeople(query),
    // Paging or refiltering keeps the previous page on screen instead of blanking the list.
    placeholderData: keepPreviousData,
  })
}

export function useDirectoryDepartments() {
  return useQuery({
    queryKey: directoryKeys.departments(),
    queryFn: listDepartments,
    // Departments change far less often than the people filtered by them.
    staleTime: 5 * 60 * 1000,
  })
}
