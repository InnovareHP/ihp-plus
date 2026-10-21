import { Chip, Group } from '@mantine/core'
import touch from '@/components/touch-target.module.css'
import type { TaskAssigneeFilter, TaskDueFilter } from '../schema'

export interface QuickFiltersProps {
  assignee: TaskAssigneeFilter
  due: TaskDueFilter
  /** "Mine" means nothing on a board that only holds your own tasks. */
  showMine: boolean
  onChange: (patch: { assignee?: TaskAssigneeFilter; due?: TaskDueFilter }) => void
}

// The three filters people reach for most, one tap each; the drawer still holds every option.
export function QuickFilters({ assignee, due, showMine, onChange }: QuickFiltersProps) {
  return (
    <Group gap="xs" role="group" aria-label="Quick filters">
      {showMine ? (
        <Chip
          classNames={{ label: touch.target }}
          checked={assignee === 'mine'}
          onChange={(checked) => onChange({ assignee: checked ? 'mine' : 'all' })}
        >
          Mine
        </Chip>
      ) : null}
      <Chip
        classNames={{ label: touch.target }}
        checked={due === 'week'}
        onChange={(checked) => onChange({ due: checked ? 'week' : 'any' })}
      >
        Due this week
      </Chip>
      <Chip
        classNames={{ label: touch.target }}
        checked={due === 'overdue'}
        onChange={(checked) => onChange({ due: checked ? 'overdue' : 'any' })}
      >
        Overdue
      </Chip>
    </Group>
  )
}
