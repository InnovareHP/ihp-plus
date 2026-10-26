'use client'

import { Button } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconPlus } from '@tabler/icons-react'
import { NewContractModal } from './new-contract-modal'

export function NewContractButton() {
  const [opened, { open, close }] = useDisclosure(false)

  return (
    <>
      <Button leftSection={<IconPlus size={16} aria-hidden />} onClick={open}>
        New contract
      </Button>
      <NewContractModal opened={opened} onClose={close} />
    </>
  )
}
