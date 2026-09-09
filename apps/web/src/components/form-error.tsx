'use client'

import { Alert } from '@mantine/core'
import { useEffect, useRef } from 'react'

export interface FormErrorProps {
  message: string | undefined
  title?: string
}

// Server-side failures render here so they land in the same place as client validation.
export function FormError({ message, title = 'Sign-in failed' }: FormErrorProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Focus is an imperative DOM call and the alert only exists after React commits it.
  useEffect(() => {
    if (message) ref.current?.focus()
  }, [message])

  if (!message) return null

  return (
    <Alert ref={ref} role="alert" tabIndex={-1} color="red" title={title} variant="light">
      {message}
    </Alert>
  )
}
