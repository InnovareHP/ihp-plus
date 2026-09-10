'use client'

import { Anchor, type AnchorProps } from '@mantine/core'
import Link from 'next/link'
import type { ReactNode } from 'react'

export interface LinkAnchorProps extends AnchorProps {
  href: string
  children: ReactNode
}

// A server component cannot hand component={Link} to Mantine, so the leaf lives on the client.
export function LinkAnchor({ href, children, ...props }: LinkAnchorProps) {
  return (
    <Anchor component={Link} href={href} {...props}>
      {children}
    </Anchor>
  )
}
