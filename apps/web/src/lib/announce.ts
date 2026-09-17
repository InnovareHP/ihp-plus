'use client'

import { notifications } from '@mantine/notifications'

// A rollback the user cannot see reads as the click never landing, so it is announced.
export function announceFailure(message: string) {
  notifications.show({ color: 'red', autoClose: false, message })
}

export function announceSuccess(message: string) {
  notifications.show({ color: 'green', message })
}
