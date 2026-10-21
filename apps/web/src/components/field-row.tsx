import { SimpleGrid, type SimpleGridProps } from '@mantine/core'
import { Children } from 'react'

export type FieldRowProps = Omit<SimpleGridProps, 'cols'>

/**
 * Fields side by side where there is room and one under another on a phone; a grown Group never
 * wraps, so three fields shared a phone's width and a date read "mm/dd/".
 */
export function FieldRow({ children, ...props }: FieldRowProps) {
  const fields = Children.toArray(children).length
  return (
    <SimpleGrid
      cols={{ base: 1, xs: Math.max(fields, 1) }}
      spacing="md"
      verticalSpacing="sm"
      {...props}
    >
      {children}
    </SimpleGrid>
  )
}
