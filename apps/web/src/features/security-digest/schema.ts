import { z } from 'zod'

export const DIGEST_TOPICS = [
  'phishing',
  'passwords',
  'patient_data',
  'devices',
  'marketing_accounts',
  'brand_spoofing',
  'ai_tools',
  'cloud_sharing',
] as const
export type DigestTopic = (typeof DIGEST_TOPICS)[number]

export const DIGEST_TOPIC_LABELS: Record<DigestTopic, string> = {
  phishing: 'Phishing & scams',
  passwords: 'Passwords & MFA',
  patient_data: 'HIPAA & patient data',
  devices: 'Devices & remote work',
  marketing_accounts: 'Ad & social accounts',
  brand_spoofing: 'Look-alike sites & spoofing',
  ai_tools: 'AI tools & deepfakes',
  cloud_sharing: 'File sharing & cloud',
}

// Grouped on the settings page so IT can switch the marketing set off in one glance.
export const DIGEST_TOPIC_GROUPS: readonly { label: string; topics: readonly DigestTopic[] }[] = [
  { label: 'Security basics', topics: ['phishing', 'passwords', 'patient_data', 'devices'] },
  {
    label: 'Digital marketing & IT',
    topics: ['marketing_accounts', 'brand_spoofing', 'ai_tools', 'cloud_sharing'],
  },
]

// What the model is told each topic covers, so a rotation stays varied inside its lane.
export const DIGEST_TOPIC_BRIEFS: Record<DigestTopic, string> = {
  phishing:
    'phishing emails and texts, fake invoices and payment changes, impersonation of leaders or vendors, QR-code and phone scams',
  passwords:
    'password managers, passphrases, never reusing passwords, passkeys, MFA prompts nobody asked for (MFA fatigue), sharing credentials',
  patient_data:
    'HIPAA basics, protected health information (PHI), the minimum-necessary rule, sending PHI securely, reporting a possible breach quickly',
  devices:
    'software updates, locking screens, public Wi-Fi and VPN, lost or stolen devices, USB drives, working from home and public places',
  marketing_accounts:
    'hijacked Meta, Google Ads, LinkedIn and TikTok business accounts, fake "policy violation" or "page will be disabled" notices, business manager and page admin access, shared logins, removing ex-staff and agencies',
  brand_spoofing:
    'look-alike domains, spoofed sender names, fake websites or social profiles copying the company or a client, checking links before clicking, reporting impersonation',
  ai_tools:
    'what never to paste into AI tools (PHI, client data, passwords, unreleased campaigns), AI voice and video deepfakes used in scams, checking AI-written content before it is published',
  cloud_sharing:
    'OneDrive and SharePoint links, "anyone with the link" versus named people, expiring links, sharing with agencies and clients, cleaning up old shares',
}

export const DIGEST_STATUSES = ['draft', 'approved', 'sent', 'rejected', 'failed'] as const
export type DigestStatus = (typeof DIGEST_STATUSES)[number]

export const DIGEST_STATUS_LABELS: Record<DigestStatus, string> = {
  draft: 'Needs review',
  approved: 'Approved',
  sent: 'Sent',
  rejected: 'Rejected',
  failed: 'Failed',
}

export const DIGEST_STATUS_COLORS: Record<DigestStatus, string> = {
  draft: 'yellow',
  approved: 'blue',
  sent: 'teal',
  rejected: 'gray',
  failed: 'red',
}

export const DELIVERY_STATUSES = ['sent', 'failed', 'not_configured'] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

/** What the model must hand back; checked again here because the tool call is not forced. */
export const generatedIssueSchema = z.object({
  title: z.string().trim().min(5).max(80),
  preheader: z.string().trim().min(10).max(140),
  intro: z.array(z.string().trim().min(1).max(600)).min(1).max(3),
  tips: z.array(z.string().trim().min(1).max(300)).min(3).max(6),
  takeaway: z.string().trim().min(5).max(200),
  // Only kept when it matches an alert the prompt offered; checked in generate.ts.
  source_url: z.string().trim().optional(),
})
export type GeneratedIssue = z.infer<typeof generatedIssueSchema>

export const settingsSchema = z.object({
  enabled: z.boolean(),
  recipients: z
    .array(z.email('Each recipient must be an email address, such as name@company.com.'))
    .max(50, 'Up to 50 addresses; add more later as client contacts instead.'),
  includeClients: z.boolean(),
  reportTo: z.union([
    z.literal(''),
    z.email('Enter the address people should report to, such as it@company.com.'),
  ]),
  topics: z.array(z.enum(DIGEST_TOPICS)).min(1, 'Keep at least one topic switched on.'),
  useAlerts: z.boolean(),
})
export type SettingsValues = z.infer<typeof settingsSchema>

export const issueIdSchema = z.object({ issueId: z.uuid() })
export type IssueIdValues = z.infer<typeof issueIdSchema>

export interface DeliveryRow {
  id: string
  email: string
  status: DeliveryStatus
  at: string
}

export interface IssueRow {
  id: string
  topic: DigestTopic
  title: string
  preheader: string
  intro: string[]
  tips: string[]
  takeaway: string
  /** Set when the issue is about a recent public alert. */
  source: { title: string; url: string } | null
  status: DigestStatus
  /** The local date it goes out, as YYYY-MM-DD. */
  sendOn: string
  error: string
  decidedByName: string
  decidedAt: string | null
  sentAt: string | null
  createdAt: string
  deliveries: DeliveryRow[]
}

export interface DigestOverview {
  settings: SettingsValues
  /** How many client contacts includeClients would add right now. */
  clientContacts: number
  /** Everyone an issue would go to if it were sent now, client contacts included when on. */
  recipientCount: number
  issues: IssueRow[]
  canManage: boolean
  aiConfigured: boolean
  emailConfigured: boolean
}
