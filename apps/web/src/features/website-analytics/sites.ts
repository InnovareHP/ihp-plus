// Kept in code, not the database, until version 2 makes the list editable in the portal.

export type ReportSource = 'netlify' | 'ga4'

export interface ReportSite {
  key: string
  name: string
  domain: string
  source: ReportSource
  /** Netlify's site id, or the GA4 property id. */
  sourceId: string
  /** GA4 events counted as calls and emails; empty drops the tile. */
  callEvents: readonly string[]
  /** Search Console is linked in GA4, so the report carries the SEO section. */
  seo: boolean
}

// The clients are in Michigan, so a report day runs midnight to midnight there.
export const REPORT_TIME_ZONE = 'America/Detroit'

export const REPORT_SITES: readonly ReportSite[] = [
  {
    key: 'palm-grove',
    name: 'Palm Grove',
    domain: '',
    source: 'ga4',
    sourceId: '558752520',
    callEvents: ['phone_call', 'email_click'],
    seo: true,
  },
  {
    key: 'magnolia',
    name: 'Magnolia',
    domain: '',
    source: 'ga4',
    sourceId: '557876551',
    callEvents: [],
    seo: true,
  },
  {
    key: 'three-rivers',
    name: 'Three Rivers Health',
    domain: '',
    source: 'ga4',
    sourceId: '557386775',
    callEvents: ['phone_call_click'],
    seo: true,
  },
  {
    key: 'nbphs',
    name: 'NBPHS',
    domain: 'nbphsystem.com',
    source: 'ga4',
    sourceId: '561895739',
    callEvents: [],
    seo: true,
  },
  {
    key: 'ihp-global',
    name: 'IHP Global',
    domain: '',
    source: 'ga4',
    sourceId: '557371083',
    callEvents: [],
    seo: false,
  },
  {
    key: 'harmony-health',
    name: 'Harmony Health',
    domain: '',
    source: 'ga4',
    sourceId: '557415911',
    callEvents: ['phone_call_click'],
    seo: true,
  },
  {
    key: 'cascading-grace',
    name: 'Cascading Grace',
    domain: 'cascadinggrace.com',
    source: 'netlify',
    sourceId: 'f837c2b6-a491-412e-8341-0ec1105d5478',
    callEvents: [],
    seo: false,
  },
  {
    key: 'grace-communities',
    name: 'Grace Communities',
    domain: 'gracecommunities.org',
    source: 'netlify',
    sourceId: 'c5333e44-ff48-446f-b82c-b92fa2defd50',
    callEvents: [],
    seo: false,
  },
  {
    key: 'helping-with-moms-home',
    name: "Helping With Mom's Home",
    domain: 'helpingwithmomshome.com',
    source: 'netlify',
    sourceId: 'e31b961d-42f7-4274-8b4d-e69687f86fa4',
    callEvents: [],
    seo: false,
  },
  {
    key: 'mcf-landscaping',
    name: 'MCF Landscaping',
    domain: 'mcflandscaping.com',
    source: 'netlify',
    sourceId: '2a9c39a6-d4b8-4bad-a572-8cbf785cf927',
    callEvents: [],
    seo: false,
  },
  {
    key: 'mcf-perennials',
    name: 'MCF Perennials',
    domain: 'mcfperennial.com',
    source: 'netlify',
    sourceId: 'd37ba8d4-63c7-4448-be75-05968a9d99f0',
    callEvents: [],
    seo: false,
  },
  {
    key: 'organic-care-mi',
    name: 'OrganicCareMI',
    domain: 'organiccaremi.com',
    source: 'netlify',
    sourceId: '7fb846fc-4633-41aa-97df-78b0e16fbc75',
    callEvents: [],
    seo: false,
  },
  {
    key: 'rivers-residence',
    name: 'Rivers Residence',
    domain: 'riversresidence.com',
    source: 'netlify',
    sourceId: '9b0622b2-49b4-4836-98ad-8f68205211d3',
    callEvents: [],
    seo: false,
  },
  {
    key: 'we-care-you-heal',
    name: 'WeCareYouHeal',
    domain: 'wecareyouheal.com',
    source: 'netlify',
    sourceId: '2fd174ed-def9-4b77-9a8f-942c70df72d0',
    callEvents: [],
    seo: false,
  },
]

export const NETLIFY_SITES = REPORT_SITES.filter((site) => site.source === 'netlify')
