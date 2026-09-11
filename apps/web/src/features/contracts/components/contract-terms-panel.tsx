'use client'

import { Alert, Button, Skeleton, Stack, Text } from '@mantine/core'
import { PageSection } from '@/components/page-section'
import { useContractTemplate } from '../use-contracts'
import { ContractTermsForm } from './contract-terms-form'

/** The boilerplate every new contract starts from, edited once for the whole company. */
export function ContractTermsPanel() {
  const template = useContractTemplate()

  if (template.isPending) {
    return (
      <PageSection title="Contract terms">
        <Stack gap="md" aria-busy="true">
          <Skeleton height={120} />
          <Skeleton height={160} />
        </Stack>
      </PageSection>
    )
  }

  if (template.isError) {
    return (
      <PageSection title="Contract terms">
        <Stack gap="md">
          <Alert role="alert" color="red" variant="light" title="Could not load the terms">
            <Text size="sm">{template.error.message}</Text>
          </Alert>
          <Button onClick={() => template.refetch()} w="fit-content">
            Try again
          </Button>
        </Stack>
      </PageSection>
    )
  }

  // key remounts the form when the saved template changes, so the fields hold the server's copy
  // rather than a stale default.
  return <ContractTermsForm key={template.data.scopeTemplate} defaultValues={template.data} />
}
