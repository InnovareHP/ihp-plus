export interface Capability {
  title: string
  body: string
}

export interface Service {
  slug: string
  /** The two-digit index the hero's chip and the home cards share. */
  index: string
  name: string
  seoTitle: string
  seoDescription: string
  /** The h1 in two lines: plain, then painted in the brand gradient. */
  headline: [string, string]
  lede: string
  highlights: string[]
  /** Decorative console lines in the hero, hidden from assistive tech. */
  console: { file: string; lines: string[] }
  tags: string[]
  capabilitiesHeading: { before: string; highlight: string; after: string }
  capabilities: Capability[]
}

export const SERVICES: Service[] = [
  {
    slug: 'marketing-creative',
    index: '01',
    name: 'Marketing & Creative',
    seoTitle: 'Marketing & Creative — IHP+ | Strategy, content and campaigns',
    seoDescription:
      'IHP+ Marketing & Creative: brand strategy, design, content, social, SEO and paid media — one team that helps your brand get seen, get heard, and get chosen.',
    headline: ['Get seen.', 'Get chosen.'],
    lede: 'Strategy, content, and campaigns built to move the numbers that matter — from the first impression to the signed deal.',
    highlights: [
      'Brand strategy and positioning',
      'Content, design, and video',
      'Campaigns that report back',
    ],
    console: {
      file: 'campaign.live',
      lines: [
        "> audience.segment('growth')",
        '✓ creative variants ready',
        '✓ channels synced · search · social · email',
        '→ reach trending up',
      ],
    },
    tags: ['Brand', 'Content', 'Social', 'SEO', 'Paid media'],
    capabilitiesHeading: { before: 'Creative that', highlight: 'performs,', after: 'end to end.' },
    capabilities: [
      {
        title: 'Brand strategy',
        body: 'Positioning, messaging, and identity that make your business easy to understand and hard to forget.',
      },
      {
        title: 'Creative & design',
        body: 'Campaign concepts, visual systems, and assets that stay on brand across every channel.',
      },
      {
        title: 'Content production',
        body: 'Copy, photo, and video made for the platforms your customers actually use.',
      },
      {
        title: 'Social media',
        body: 'Planning, publishing, and community management that keeps your brand in the conversation.',
      },
      {
        title: 'SEO & paid media',
        body: 'Search, social, and display campaigns tuned to reach the right people at the right cost.',
      },
      {
        title: 'Analytics & reporting',
        body: 'Clear reporting on what is working, so every next campaign starts from evidence.',
      },
    ],
  },
  {
    slug: 'it-web-solutions',
    index: '02',
    name: 'IT & Web Solutions',
    seoTitle: 'IT & Web Solutions — IHP+ | Websites, platforms and IT support',
    seoDescription:
      'IHP+ IT & Web Solutions: websites, custom platforms, cloud hosting, integrations, security and IT support — built, shipped, and maintained by one team.',
    headline: ["Build what's", 'next.'],
    lede: 'Websites, platforms, and the infrastructure under them — designed, shipped, and kept running by one accountable team.',
    highlights: [
      'Websites and web apps built to last',
      'Cloud, hosting, and security handled',
      'Support that stays after launch',
    ],
    console: {
      file: 'deploy.log',
      lines: [
        '$ ihp deploy --env production',
        '✓ build passed',
        '✓ checks green · security · performance',
        '→ live and monitored',
      ],
    },
    tags: ['Web apps', 'Cloud', 'APIs', 'Security', 'DevOps'],
    capabilitiesHeading: { before: 'Systems your', highlight: 'business', after: 'runs on.' },
    capabilities: [
      {
        title: 'Web design & development',
        body: 'Fast, accessible websites that look sharp on every screen and are simple to update.',
      },
      {
        title: 'Custom platforms & apps',
        body: 'Portals, dashboards, and internal tools shaped around how your team actually works.',
      },
      {
        title: 'Cloud & hosting',
        body: 'Reliable hosting, backups, and scaling set up properly from day one.',
      },
      {
        title: 'Integrations & APIs',
        body: 'Your tools connected — CRM, payments, email, and more — so data moves without copy and paste.',
      },
      {
        title: 'Security & maintenance',
        body: 'Updates, monitoring, and hardening that keep your systems safe and running.',
      },
      {
        title: 'IT support',
        body: 'A responsive team for devices, accounts, and the everyday issues that slow people down.',
      },
    ],
  },
  {
    slug: 'finance-accounting',
    index: '03',
    name: 'Finance & Accounting',
    seoTitle: 'Finance & Accounting — IHP+ | Bookkeeping, reporting and payroll',
    seoDescription:
      'IHP+ Finance & Accounting: bookkeeping, financial reporting, payroll, payables and receivables, and forecasting — accurate books managed end to end.',
    headline: ['Numbers you', 'can trust.'],
    lede: 'Bookkeeping, reporting, and financial operations managed end to end — so every decision starts from accurate books.',
    highlights: [
      'Monthly books closed on schedule',
      'Reports you can act on',
      'Payroll and payables handled',
    ],
    console: {
      file: 'ledger.sync',
      lines: [
        '> reconcile --period current',
        '✓ accounts reconciled',
        '✓ payroll scheduled · payables queued',
        '→ report ready for review',
      ],
    },
    tags: ['Bookkeeping', 'Payroll', 'Reporting', 'AP / AR', 'Forecasting'],
    capabilitiesHeading: { before: 'Financial', highlight: 'clarity,', after: 'every month.' },
    capabilities: [
      {
        title: 'Bookkeeping',
        body: 'Transactions categorised and accounts reconciled, so your books are always current.',
      },
      {
        title: 'Financial reporting',
        body: 'Profit and loss, balance sheet, and cash flow in a format you can read and act on.',
      },
      {
        title: 'Payroll',
        body: 'Accurate, on-time payroll with the records to back it up.',
      },
      {
        title: 'Payables & receivables',
        body: 'Bills paid on schedule and invoices followed up, keeping cash moving in both directions.',
      },
      {
        title: 'Budgeting & forecasting',
        body: 'Plans and projections that show where the business is heading before it gets there.',
      },
      {
        title: 'Tax-ready records',
        body: 'Clean, organised books that make tax season a hand-off, not a scramble.',
      },
    ],
  },
]

export const servicePath = (slug: string) => `/services/${slug}/`
