'use client'

import { Menu } from '@mantine/core'
import { IconArrowBackUp, IconArrowRight, IconMail, IconX } from '@tabler/icons-react'
import Link from 'next/link'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { applicationRoute } from '@/lib/routes'
import type { ApplicationSummary, Stage } from '../schema'

export interface ApplicationActionsMenuProps {
  application: ApplicationSummary
  /** The posting's stages; without them the menu offers no moves, only the decision. */
  stages?: readonly Stage[]
  onMove: (stage: Stage) => void
  onReject: () => void
  onReopen: () => void
}

export function ApplicationActionsMenu({
  application,
  stages = [],
  onMove,
  onReject,
  onReopen,
}: ApplicationActionsMenuProps) {
  const isActive = application.status === 'active'
  const targets = stages.filter((stage) => stage.id !== application.stageId)

  return (
    <RowActionsMenu name={application.fullName}>
      <Menu.Item component={Link} href={applicationRoute(application.id)}>
        Open application
      </Menu.Item>
      {isActive && targets.length > 0 ? (
        <>
          <Menu.Divider />
          <Menu.Label>Move to</Menu.Label>
          {targets.map((stage) => (
            <Menu.Item
              key={stage.id}
              leftSection={
                stage.message ? (
                  <IconMail size={14} aria-label="Emails the applicant" />
                ) : (
                  <IconArrowRight size={14} aria-hidden />
                )
              }
              onClick={() => onMove(stage)}
            >
              {stage.name}
            </Menu.Item>
          ))}
        </>
      ) : null}
      {isActive ? (
        <>
          <Menu.Divider />
          <Menu.Item color="red" leftSection={<IconX size={14} aria-hidden />} onClick={onReject}>
            Not moving forward
          </Menu.Item>
        </>
      ) : null}
      {application.status === 'rejected' ? (
        <Menu.Item leftSection={<IconArrowBackUp size={14} aria-hidden />} onClick={onReopen}>
          Reopen
        </Menu.Item>
      ) : null}
    </RowActionsMenu>
  )
}
