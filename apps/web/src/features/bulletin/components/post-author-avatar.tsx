import { Avatar, ThemeIcon } from '@mantine/core'
import { IconCake, IconConfetti, IconUserPlus, type Icon } from '@tabler/icons-react'
import type { CelebrationKind, PostKind } from '../schema'

const CELEBRATION_ICONS: Record<CelebrationKind, Icon> = {
  birthday: IconCake,
  anniversary: IconConfetti,
  welcome: IconUserPlus,
}

export interface PostAuthorAvatarProps {
  kind: PostKind
  name: string
}

// A celebration is written by the portal, so it wears the occasion rather than a person's initials.
export function PostAuthorAvatar({ kind, name }: PostAuthorAvatarProps) {
  if (kind === 'post') return <Avatar size={44} radius="xl" color="initials" name={name} />

  const OccasionIcon = CELEBRATION_ICONS[kind]
  return (
    <ThemeIcon size={44} radius="xl" variant="light" aria-hidden>
      <OccasionIcon size={22} />
    </ThemeIcon>
  )
}
