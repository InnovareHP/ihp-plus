'use client'

import { ActionIcon, Button, Group, Menu, Select } from '@mantine/core'
import {
  IconArchive,
  IconArchiveOff,
  IconDotsVertical,
  IconPencil,
  IconPlus,
} from '@tabler/icons-react'
import type { TaskProjectRow } from '../schema'

export interface ProjectSelectProps {
  projects: readonly TaskProjectRow[]
  value: string
  onChange: (projectId: string) => void
  onCreate: () => void
  onRename: (project: TaskProjectRow) => void
  onArchive: (project: TaskProjectRow, archived: boolean) => void
}

export function ProjectSelect({
  projects,
  value,
  onChange,
  onCreate,
  onRename,
  onArchive,
}: ProjectSelectProps) {
  const current = projects.find((project) => project.id === value)

  return (
    <Group gap="sm" align="flex-end" wrap="wrap">
      <Select
        label="Project"
        placeholder="Choose a project"
        data={projects.map((project) => ({
          value: project.id,
          label: `${project.name} (${project.taskCount})`,
        }))}
        value={value || null}
        onChange={(next) => onChange(next ?? '')}
        allowDeselect={false}
        searchable={projects.length > 8}
        w={{ base: '100%', sm: 280 }}
      />
      <Button variant="default" leftSection={<IconPlus size={16} aria-hidden />} onClick={onCreate}>
        New project
      </Button>

      {current ? (
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon
              variant="default"
              size="lg"
              aria-label={`Actions for ${current.name}`}
              mb={1}
            >
              <IconDotsVertical size={16} aria-hidden />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconPencil size={16} aria-hidden />}
              onClick={() => onRename(current)}
            >
              Rename project
            </Menu.Item>
            <Menu.Item
              leftSection={
                current.isArchived ? (
                  <IconArchiveOff size={16} aria-hidden />
                ) : (
                  <IconArchive size={16} aria-hidden />
                )
              }
              onClick={() => onArchive(current, !current.isArchived)}
            >
              {current.isArchived ? 'Restore project' : 'Archive project'}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ) : null}
    </Group>
  )
}
