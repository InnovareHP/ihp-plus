import { Group, Text } from '@mantine/core'

export interface AppLogoProps {
  size?: number
  withWordmark?: boolean
}

// The glyph is painted in the body colour so it stays legible on both brand shades.
export function AppLogo({ size = 32, withWordmark = true }: AppLogoProps) {
  return (
    <Group gap="sm" wrap="nowrap">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        role={withWordmark ? undefined : 'img'}
        aria-hidden={withWordmark ? 'true' : undefined}
        aria-label={withWordmark ? undefined : 'IHP Plus'}
        focusable="false"
      >
        <rect width="32" height="32" rx="9" fill="var(--mantine-primary-color-filled)" />
        <rect x="13.5" y="7" width="5" height="18" rx="2.5" fill="var(--mantine-color-body)" />
        <rect x="7" y="13.5" width="18" height="5" rx="2.5" fill="var(--mantine-color-body)" />
      </svg>
      {withWordmark ? (
        <Text fw={700} size="lg" lh={1}>
          IHP Plus
        </Text>
      ) : null}
    </Group>
  )
}
