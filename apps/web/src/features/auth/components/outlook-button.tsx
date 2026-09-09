'use client'

import { Button } from '@mantine/core'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { withBasePath } from '@/lib/routes'
import { authErrorMessage } from '../messages'

export interface OutlookButtonProps {
  callbackPath: string
  onFailure: (message: string) => void
}

export function OutlookButton({ callbackPath, onFailure }: OutlookButtonProps) {
  // A full-page redirect leaves no form state to hang this on, so the flag is local.
  const [redirecting, setRedirecting] = useState(false)

  async function handleClick() {
    setRedirecting(true)
    const { error } = await authClient.signIn.social({
      provider: 'microsoft',
      callbackURL: withBasePath(callbackPath),
    })
    if (error) {
      setRedirecting(false)
      onFailure(authErrorMessage(error))
    }
  }

  return (
    <Button
      type="button"
      variant="default"
      fullWidth
      loading={redirecting}
      onClick={handleClick}
      leftSection={<OutlookMark />}
    >
      Continue with Outlook
    </Button>
  )
}

function OutlookMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true" focusable="false">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
  )
}
