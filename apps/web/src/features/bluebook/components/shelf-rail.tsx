import { Badge, Card, Divider, NavLink, Stack, Text } from '@mantine/core'

export interface ShelfItem {
  value: string
  label: string
  count: number
}

/**
 * Shelves read as a place, not a filter: a rail that stays put, names where you are, and takes a
 * dozen departments without wrapping into a wall of pills.
 */
export function ShelfRail({
  items,
  value,
  onChange,
}: {
  items: ShelfItem[]
  value: string
  onChange: (value: string) => void
}) {
  if (items.length === 0) return null

  return (
    <Card component="nav" aria-label="Bluebook shelves" padding="xs" w={240} visibleFrom="md">
      <Text size="xs" fw={600} c="dimmed" tt="uppercase" px="sm" py={4}>
        Shelves
      </Text>
      {items.map((item, index) => (
        <Stack key={item.value} gap={0}>
          {/* The company-wide shelf sits above the departments it applies to. */}
          {index === 2 ? <Divider my={4} /> : null}
          <NavLink
            component="button"
            type="button"
            active={value === item.value}
            aria-current={value === item.value ? 'true' : undefined}
            label={item.label}
            onClick={() => onChange(item.value)}
            rightSection={
              <Badge size="sm" variant={value === item.value ? 'filled' : 'light'} color="gray">
                {item.count}
              </Badge>
            }
          />
        </Stack>
      ))}
    </Card>
  )
}
