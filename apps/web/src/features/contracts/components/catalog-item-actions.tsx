'use client'

import { Menu } from '@mantine/core'
import { IconArchive, IconArrowBackUp, IconPencil } from '@tabler/icons-react'
import { RowActionsMenu } from '@/components/row-actions-menu'
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
    <RowActionsMenu name={item.name}>
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
    </RowActionsMenu>
  )
}
