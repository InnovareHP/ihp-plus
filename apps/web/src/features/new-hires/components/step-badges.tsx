import { Badge, Group, VisuallyHidden } from '@mantine/core'
import { IconCheck, IconCircleDashed } from '@tabler/icons-react'
import { CHECKLIST_STEPS, STEP_LABELS, type ChecklistProgress, type ChecklistStep } from '../schema'

/** "Reading 1/3" rather than a bare tick, so an admin sees how far along a step is. */
function countOf(step: ChecklistStep, progress: ChecklistProgress) {
  if (step === 'reading') {
    const { documents } = progress.reading
    if (documents.length === 0) return ''
    return ` ${documents.filter((document) => document.acknowledged).length}/${documents.length}`
  }
  if (step === 'tasks') {
    const { items } = progress.tasks
    if (items.length === 0) return ''
    return ` ${items.filter((item) => item.done).length}/${items.length}`
  }
  return ''
}

export function StepBadges({ progress }: { progress: ChecklistProgress }) {
  return (
    <Group gap={4} wrap="wrap">
      {CHECKLIST_STEPS.map((step) => {
        const done = progress[step].done
        return (
          <Badge
            key={step}
            variant={done ? 'light' : 'outline'}
            color={done ? 'green' : 'gray'}
            leftSection={
              done ? (
                <IconCheck size={12} aria-hidden />
              ) : (
                <IconCircleDashed size={12} aria-hidden />
              )
            }
          >
            {STEP_LABELS[step]}
            {countOf(step, progress)}
            <VisuallyHidden>{done ? ', done' : ', not done'}</VisuallyHidden>
          </Badge>
        )
      })}
    </Group>
  )
}
