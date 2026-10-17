'use client'

import { ConnectError } from '@ihp/rpc'
import { browserClients } from '@/rpc/browser'
import type { SearchDirectory, SearchTask } from './schema'

export async function getSearchDirectory(): Promise<SearchDirectory> {
  try {
    const response = await browserClients.search.getDirectory({})
    return {
      people: response.people.map((person) => ({
        userId: person.userId,
        name: person.name,
        jobTitle: person.jobTitle,
        department: person.department,
        photoUrl: person.photoUrl,
      })),
      clients: response.clients.map((client) => ({
        clientId: client.clientId,
        name: client.name,
        status: client.status,
      })),
    }
  } catch (error) {
    // The wire code stays on the ConnectError; the palette shows its own sentence instead.
    throw new Error(ConnectError.from(error).rawMessage)
  }
}

export async function searchTasks(query: string, signal?: AbortSignal): Promise<SearchTask[]> {
  try {
    const response = await browserClients.search.searchTasks({ query }, { signal })
    return response.tasks.map((task) => ({
      taskId: task.taskId,
      taskNumber: task.taskNumber,
      name: task.name,
      projectId: task.projectId,
      projectName: task.projectName,
      statusName: task.statusName,
      statusColor: task.statusColor,
    }))
  } catch (error) {
    throw new Error(ConnectError.from(error).rawMessage)
  }
}
