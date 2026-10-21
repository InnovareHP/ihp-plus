import { IconClockHour4, IconCoffee } from '@tabler/icons-react'
import classes from './clock-status-icon.module.css'

// The icon's shape, not only its colour, tells working from a break.
export function ClockStatusIcon({ onBreak, size = 16 }: { onBreak: boolean; size?: number }) {
  const Icon = onBreak ? IconCoffee : IconClockHour4
  return <Icon size={size} aria-hidden className={onBreak ? classes.onBreak : classes.working} />
}
