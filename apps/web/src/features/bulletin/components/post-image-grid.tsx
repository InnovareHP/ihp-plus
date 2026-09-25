import { AspectRatio, Box, Image, UnstyledButton } from '@mantine/core'
import type { BulletinImageRow } from '../schema'

export interface PostImageGridProps {
  images: readonly BulletinImageRow[]
  authorName: string
  onOpen: (index: number) => void
}

// One photo runs wide; with three, the first leads across the top and two sit under it.
function spansRow(count: number, index: number) {
  return count === 1 || (count === 3 && index === 0)
}

/** A post's photos as a tight grid; each one opens larger. */
export function PostImageGrid({ images, authorName, onOpen }: PostImageGridProps) {
  const count = images.length

  return (
    <Box
      component="ul"
      p={0}
      m={0}
      style={{
        listStyle: 'none',
        display: 'grid',
        gridTemplateColumns: count === 1 ? '1fr' : 'repeat(2, 1fr)',
        gap: 'var(--mantine-spacing-xs)',
      }}
    >
      {images.map((image, index) => (
        <Box
          component="li"
          key={image.id}
          style={{ gridColumn: spansRow(count, index) ? '1 / -1' : undefined }}
        >
          <UnstyledButton
            w="100%"
            display="block"
            onClick={() => onOpen(index)}
            style={{ borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}
          >
            {/* Fixed ratios reserve the box before the photo loads, so nothing shifts. */}
            <AspectRatio ratio={spansRow(count, index) ? 16 / 9 : 4 / 3}>
              <Image
                src={image.url}
                alt={`Photo ${index + 1} of ${count} from ${authorName}'s post`}
                fit="cover"
                loading="lazy"
              />
            </AspectRatio>
          </UnstyledButton>
        </Box>
      ))}
    </Box>
  )
}
