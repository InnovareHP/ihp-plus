import { describe, expect, it } from 'vitest'
import { useForm, type FieldValues } from 'react-hook-form'
import { render, screen } from '@/test/render'
import type { FormField } from '@/features/requests/schema'
import { FieldInput } from './field-input'

function field(
  overrides: Partial<FormField> & Pick<FormField, 'id' | 'type' | 'label'>,
): FormField {
  return { help: '', placeholder: '', required: false, options: [], ...overrides }
}

function Harness({ subject }: { subject: FormField }) {
  const { control } = useForm<FieldValues>({ defaultValues: { [subject.id]: '' } })

  return <FieldInput field={subject} control={control} error={undefined} />
}

describe('FieldInput', () => {
  it('falls back to a placeholder written for the answer type', () => {
    render(<Harness subject={field({ id: 'reason', type: 'textarea', label: 'Reason' })} />)

    expect(screen.getByLabelText('Reason')).toHaveAttribute('placeholder', 'Type your answer')
  })

  it('gives a choice question its own default', () => {
    render(
      <Harness
        subject={field({ id: 'size', type: 'select', label: 'Size', options: ['S', 'L'] })}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Size' })).toHaveAttribute(
      'placeholder',
      'Choose an option',
    )
  })

  it('prefers the placeholder the admin wrote', () => {
    render(
      <Harness
        subject={field({ id: 'item', type: 'text', label: 'Item needed', placeholder: 'Laptop' })}
      />,
    )

    expect(screen.getByLabelText('Item needed')).toHaveAttribute('placeholder', 'Laptop')
  })
})
