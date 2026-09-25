import { ActionIcon, AspectRatio, Box, Image } from '@mantine/core'
import { IconX } from '@tabler/icons-react'

export interface ComposerImageTileProps {
  url: string
  /** "Photo 2", so the remove button says which one it takes out. */
  label: string
  onRemove: () => void
}

/** A photo waiting in the composer, with the one control it needs. */
export function ComposerImageTile({ url, label, onRemove }: ComposerImageTileProps) {
  return (
    <Box component="li" pos="relative" style={{ listStyle: 'none' }}>
      <AspectRatio ratio={1}>
        <Image src={url} alt={label} radius="md" fit="cover" />
      </AspectRatio>
      <ActionIcon
        pos="absolute"
        top={6}
        right={6}
        radius="xl"
        variant="filled"
        color="dark"
        aria-label={`Remove ${label.toLowerCase()}`}
        onClick={onRemove}
      >
        <IconX size={16} aria-hidden />
      </ActionIcon>
    </Box>
  )
}
