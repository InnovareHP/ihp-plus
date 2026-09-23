'use client'

import { Alert, Card, Group, List, Progress, Stack, Text, Title } from '@mantine/core'
import { LinkButton } from '@/components/link-button'
import { routes } from '@/lib/routes'
import { useMarkTaskDone, useMyChecklist } from '../hooks/use-my-checklist'
import { doneCountOf } from '../progress'
import {
  CHECKLIST_STEPS,
  PROFILE_FIELD_LABELS,
  STEP_TITLES,
  type NewHireChecklistView,
} from '../schema'
import { ChecklistStep } from './checklist-step'
import { FirstDayTaskList } from './first-day-task-list'
import { RequiredReadingList } from './required-reading-list'

function profileDetail(view: NewHireChecklistView) {
  if (view.profile.done) return 'Your phone number and photo are on file.'
  const missing = view.profile.missing.map((field) => PROFILE_FIELD_LABELS[field]).join(' and ')
  return `Add ${missing} so colleagues can reach and recognise you.`
}

function readingDetail(view: NewHireChecklistView) {
  const { documents } = view.reading
  if (documents.length === 0) return 'Nothing is required reading yet.'
  const unread = documents.filter((document) => !document.acknowledged).length
  if (unread === 0) return 'You have read everything on the list.'
  return `Open each one in the bluebook and mark it as read — ${unread} of ${documents.length} to go.`
}

function tasksDetail(view: NewHireChecklistView) {
  const { items } = view.tasks
  if (items.length === 0) return 'There are no first-day tasks yet.'
  const left = items.filter((item) => !item.done).length
  return left === 0 ? 'All ticked off.' : `Tick each one off as you finish it — ${left} left.`
}

/** A new hire's four steps, on their dashboard until every one is done. */
export function FirstDaysChecklist({ initial }: { initial: NewHireChecklistView | null }) {
  const checklist = useMyChecklist(initial)
  const markTask = useMarkTaskDone()
  const view = checklist.data
  if (!view) return null

  if (view.completedAt) {
    return (
      <Alert color="green" variant="light" title="You are all set" role="status">
        Every step of your first days is done. Welcome aboard.
      </Alert>
    )
  }

  const done = doneCountOf(view)

  return (
    <Card padding="lg" component="section" aria-labelledby="first-days-heading">
      <Stack gap="lg">
        <Stack gap="xs">
          <Group justify="space-between" wrap="wrap">
            <Title order={2} size="h4" id="first-days-heading">
              Your first days
            </Title>
            <Text size="sm" c="dimmed">
              {done} of {CHECKLIST_STEPS.length} done
            </Text>
          </Group>
          <Progress
            value={(done / CHECKLIST_STEPS.length) * 100}
            aria-label={`${done} of ${CHECKLIST_STEPS.length} steps done`}
          />
        </Stack>

        <List listStyleType="none" spacing="lg" component="ol">
          <ChecklistStep
            number={1}
            title={STEP_TITLES.profile}
            state={view.profile.done ? 'done' : 'todo'}
            detail={profileDetail(view)}
          >
            {view.profile.done ? null : (
              <LinkButton href={routes.settings} variant="light" w="fit-content">
                Open settings
              </LinkButton>
            )}
          </ChecklistStep>

          <ChecklistStep
            number={2}
            title={STEP_TITLES.reading}
            state={view.reading.done ? 'done' : 'todo'}
            detail={readingDetail(view)}
          >
            {view.reading.documents.length > 0 ? (
              <RequiredReadingList documents={view.reading.documents} />
            ) : null}
            {view.reading.done ? null : (
              <LinkButton href={routes.bluebook} variant="light" w="fit-content">
                Open the bluebook
              </LinkButton>
            )}
          </ChecklistStep>

          <ChecklistStep
            number={3}
            title={STEP_TITLES.shift}
            state={view.shift.done ? 'done' : 'waiting'}
            detail={
              view.shift.shiftName
                ? `You work the ${view.shift.shiftName} shift.`
                : 'People & Culture assigns your shift. There is nothing for you to do yet.'
            }
          />

          <ChecklistStep
            number={4}
            title={STEP_TITLES.tasks}
            state={view.tasks.done ? 'done' : 'todo'}
            detail={tasksDetail(view)}
          >
            {view.tasks.items.length > 0 ? (
              <FirstDayTaskList
                items={view.tasks.items}
                onToggle={(taskId, isDone) => markTask.mutate({ taskId, done: isDone })}
              />
            ) : null}
          </ChecklistStep>
        </List>
      </Stack>
    </Card>
  )
}
