'use client'

import { Button } from '@mantine/core'
import { useSignOut } from '../use-sign-out'

export function SignOutButton() {
  const signOut = useSignOut()

  return (
    <Button
      variant="subtle"
      size="compact-sm"
      disabled={signOut.isPending}
      onClick={() => signOut.mutate()}
    >
      {signOut.isPending ? 'Signing out…' : 'Sign out'}
    </Button>
  )
}
