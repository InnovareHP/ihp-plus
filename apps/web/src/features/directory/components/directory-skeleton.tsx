import { SimpleGrid, Skeleton } from '@mantine/core'
import { DIRECTORY_COLS } from '../grid'

// The same card shape as the loaded grid, so nothing shifts when the people land.
export function DirectorySkeleton() {
  return (
    <SimpleGrid cols={DIRECTORY_COLS} spacing="md" aria-busy="true">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((card) => (
        <Skeleton key={card} height={196} radius="md" />
      ))}
    </SimpleGrid>
  )
}
