'use client'

import { ActionIcon } from '@mantine/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconGripVertical } from '@tabler/icons-react'
import type { DOMAttributes } from 'react'
import touch from '@/components/touch-target.module.css'
import { TaskCard, type TaskCardProps } from './task-card'

export interface SortableTaskCardProps extends Omit<TaskCardProps, 'drag'> {
  statusId: string
  reduceMotion: boolean
}

export function SortableTaskCard({ statusId, reduceMotion, ...card }: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.task.id,
    data: { statusId },
    // Cards still make room for a drop, without the slide, when motion is reduced.
    transition: reduceMotion ? null : undefined,
  })
  // dnd-kit types its listeners loosely as Function; they are the sensors' DOM event handlers.
  const { onKeyDown, ...pointer } = (listeners ?? {}) as DOMAttributes<HTMLElement>

  return (
    <TaskCard
      {...card}
      drag={{
        ref: setNodeRef,
        style: {
          transform: CSS.Translate.toString(transform),
          transition,
          // A press-and-hold drag on a phone must not also scroll the page under the finger.
          touchAction: 'manipulation',
        },
        handlers: pointer,
        isDragging: isDragging,
        handle: (
          <ActionIcon
            ref={setActivatorNodeRef}
            {...attributes}
            onKeyDown={onKeyDown}
            variant="subtle"
            color="gray"
            className={touch.target}
            aria-label={`Drag ${card.task.name}`}
            style={{ cursor: 'grab' }}
          >
            <IconGripVertical size={16} aria-hidden />
          </ActionIcon>
        ),
      }}
    />
  )
}
