import { AspectRatio, Box, Skeleton } from '@mantine/core'

/** Holds a square for a photo still uploading, so the grid does not jump when it lands. */
export function ImageTileSkeleton() {
  return (
    <Box component="li" style={{ listStyle: 'none' }} aria-busy="true" aria-label="Uploading photo">
      <AspectRatio ratio={1}>
        <Skeleton radius="md" />
      </AspectRatio>
    </Box>
  )
}
