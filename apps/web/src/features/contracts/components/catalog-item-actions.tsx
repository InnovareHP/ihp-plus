'use client'

import { ActionIcon, Menu } from '@mantine/core'
import { IconArchive, IconArrowBackUp, IconDotsVertical, IconPencil } from '@tabler/icons-react'
import type { CatalogItemRow } from '../schema'

export interface CatalogItemActionsProps {
  item: CatalogItemRow
  onEdit: (item: CatalogItemRow) => void
  onArchive: (item: CatalogItemRow) => void
  onRestore: (item: CatalogItemRow) => void
}

/** A rate card row's actions behind one menu, named for the service so a list of them reads. */
export function CatalogItemActions({
  item,
  onEdit,
  onArchive,
  onRestore,
}: CatalogItemActionsProps) {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${item.name}`}>
          <IconDotsVertical size={16} aria-hidden />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconPencil size={14} aria-hidden />} onClick={() => onEdit(item)}>
          Edit
        </Menu.Item>
        {item.archived ? (
          <Menu.Item
            leftSection={<IconArrowBackUp size={14} aria-hidden />}
            onClick={() => onRestore(item)}
          >
            Restore to the rate card
          </Menu.Item>
        ) : (
          <Menu.Item
            leftSection={<IconArchive size={14} aria-hidden />}
            color="red"
            onClick={() => onArchive(item)}
          >
            Archive
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}
