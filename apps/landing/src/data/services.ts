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
  /** The checks the hero demo's Launch stage ticks off. */
  launchLog: string[]
  capabilitiesHeading: { before: string; highlight: string; after: string }
  capabilities: Capability[]
}

export const SERVICES: Service[] = [
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
    launchLog: ['$ deploy --prod', '✓ build passed', '✓ checks green', '✓ live and monitored'],
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
]

export const servicePath = (slug: string) => `/services/${slug}/`
