import { Group, type GroupProps } from '@mantine/core'
import classes from './dialog-actions.module.css'

export type DialogActionsProps = GroupProps

/** A dialog form's buttons: right-aligned, and pinned to the bottom of the screen on a phone. */
export function DialogActions({ className, ...props }: DialogActionsProps) {
  return (
    <Group justify="flex-end" className={[classes.actions, className ?? ''].join(' ')} {...props} />
  )
}
