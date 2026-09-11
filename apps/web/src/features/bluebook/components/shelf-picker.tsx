import { Select } from '@mantine/core'
import type { ShelfItem } from './shelf-rail'

/** The same choice on a phone, where a rail would push the documents off the screen. */
export function ShelfPicker({
  items,
  value,
  onChange,
}: {
  items: ShelfItem[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Select
      label="Shelf"
      hiddenFrom="md"
      w="100%"
      allowDeselect={false}
      data={items.map((item) => ({ value: item.value, label: `${item.label} (${item.count})` }))}
      value={value}
      onChange={(next) => onChange(next ?? '')}
    />
  )
}
