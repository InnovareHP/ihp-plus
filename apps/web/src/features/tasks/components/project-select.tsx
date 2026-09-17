'use client'

import { Button, Group, Select } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import type { TaskProjectRow } from '../schema'

export interface ProjectSelectProps {
  projects: readonly TaskProjectRow[]
  value: string
  onChange: (projectId: string) => void
  onCreate: () => void
}

export function ProjectSelect({ projects, value, onChange, onCreate }: ProjectSelectProps) {
  return (
    <Group gap="sm" align="flex-end" wrap="wrap">
      <Select
        label="Project"
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
    </Group>
  )
}
