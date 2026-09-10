'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Group, Stack, Text } from '@mantine/core'
import { useRouter } from 'next/navigation'
import { useForm, type Control, type FieldValues } from 'react-hook-form'
import { FormError } from '@/components/form-error'
import { EmptyState, PageSection } from '@/components/page-shell'
import { announceSuccess } from '@/lib/announce'
import { requestRoute, routes } from '@/lib/routes'
import { answerSchemaOf, defaultAnswersOf, type FormRow, type RequestValues } from '../schema'
import { useSubmitRequest } from '../use-requests'
import { FieldInput } from './field-input'

export function RequestForm({ form }: { form: FormRow }) {
  const router = useRouter()
  const submit = useSubmitRequest()

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FieldValues>({
    resolver: zodResolver(answerSchemaOf(form.fields)),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: defaultAnswersOf(form.fields),
  })

  async function onSubmit(values: FieldValues) {
    try {
      const created = await submit.mutateAsync({
        formId: form.id,
        fields: form.fields,
        values: values as RequestValues,
      })
      announceSuccess(`${form.name} sent for approval.`)
      // The user lands on the thing they made, not back on an empty form.
      router.replace(requestRoute(created.id))
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Could not send that request.',
      })
    }
  }

  if (form.fields.length === 0) {
    return (
      <EmptyState
        title="This form has no questions yet"
        description="An admin still has to add them. Nothing can be sent until they do."
      />
    )
  }

  return (
    <PageSection title={form.name} description={form.description || undefined}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="lg" maw={620}>
          <FormError message={errors.root?.message} title="Could not send that request" />

          <Stack gap="md">
            {form.fields.map((field) => (
              <FieldInput
                key={field.id}
                field={field}
                control={control as Control<FieldValues>}
                error={errors[field.id]?.message as string | undefined}
              />
            ))}
          </Stack>

          <Text size="sm" c="dimmed">
            It goes to the approvers for your department, who decide it from their queue.
          </Text>

          <Group>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send request'}
            </Button>
            <Button variant="subtle" color="gray" onClick={() => router.push(routes.requests)}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </form>
    </PageSection>
  )
}
