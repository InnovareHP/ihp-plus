'use client'

import { Button } from '@mantine/core'
import { IconPrinter } from '@tabler/icons-react'

// The browser's print dialog saves the contract as a PDF, so no PDF library is needed.
export function PrintContractButton() {
  return (
    <Button
      variant="default"
      leftSection={<IconPrinter size={16} aria-hidden />}
      onClick={() => window.print()}
    >
      Print or save as PDF
    </Button>
  )
}
