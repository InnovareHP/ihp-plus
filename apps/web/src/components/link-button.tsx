'use client'

import { Button, type ButtonProps } from '@mantine/core'
import Link from 'next/link'
import type { ReactNode } from 'react'

export interface LinkButtonProps extends ButtonProps {
  href: string
  children: ReactNode
}

// A server component cannot hand component={Link} to Mantine, so the leaf lives on the client.
export function LinkButton({ href, children, ...props }: LinkButtonProps) {
  return (
    <Button component={Link} href={href} {...props}>
      {children}
    </Button>
  )
}
