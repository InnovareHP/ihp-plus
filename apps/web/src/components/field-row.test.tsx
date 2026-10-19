import { TextInput } from '@mantine/core'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@/test/render'
import { FieldRow } from './field-row'

function columnRules() {
  return [...document.querySelectorAll('style')].map((tag) => tag.textContent).join('\n')
}

describe('FieldRow', () => {
  it('puts one field per row on a phone and all of them side by side from 36em', () => {
    render(
      <FieldRow>
        <TextInput label="Priority" />
        <TextInput label="Start date" />
        <TextInput label="Due date" />
      </FieldRow>,
    )

    expect(screen.getByLabelText('Due date')).toBeInTheDocument()
    // Mantine writes the responsive column counts into a style tag for the grid.
    expect(columnRules()).toMatch(/--sg-cols:\s*1/)
    expect(columnRules()).toMatch(/--sg-cols:\s*3/)
  })

  it('counts only the fields actually shown', () => {
    render(
      <FieldRow>
        <TextInput label="Name" />
        {null}
        <TextInput label="Email" />
      </FieldRow>,
    )

    expect(columnRules()).toMatch(/--sg-cols:\s*2/)
  })
})
