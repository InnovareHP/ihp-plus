export interface IhpClient {
  name: string
  /** Matched against a User's name at seed time; an unknown name leaves the client unowned. */
  ownerName?: string
  type?: string
  serviceLine?: string
  tags?: string[]
  notes?: string
}

// The dropdown values this roster needs on top of LOOKUP_OPTION_SEED, so a client's type and
// service line are pickable instead of orphaned text.
export const IHP_CLIENT_LOOKUPS: Record<string, readonly string[]> = {
  clientType: ['Residential care home', 'Health center', 'Agriculture', 'Landscaping'],
  clientServiceLine: ['Business development'],
  clientTag: ['Website maintenance'],
}

// The real book of business. Type is set only where the account name states it; contact, city,
// state and source are left empty rather than guessed, and are filled in the portal.
export const IHP_CLIENTS: readonly IhpClient[] = [
  {
    name: 'Ada Grace',
    ownerName: 'Dewayne Long',
    serviceLine: 'Business development',
  },
  {
    name: 'Cascading Grace',
    ownerName: 'Dewayne Long',
    serviceLine: 'Business development',
  },
  {
    name: 'Grace of Wyoming',
    ownerName: 'Dewayne Long',
    serviceLine: 'Business development',
  },
  {
    name: 'Organic Care',
    ownerName: 'Dewayne Long',
    serviceLine: 'Business development',
  },
  {
    name: "Helping with Mom's Home",
    ownerName: 'Dewayne Long',
    type: 'Residential care home',
    serviceLine: 'Business development',
  },
  {
    name: 'Three Rivers Behavioral Health',
    ownerName: 'Dewayne Long',
    type: 'Behavioral health provider',
    serviceLine: 'Business development',
  },
  {
    name: 'Harmony Health',
    ownerName: 'Dewayne Long',
    serviceLine: 'Business development',
  },
  {
    name: 'Mission Behavioral Health',
    ownerName: 'Dewayne Long',
    type: 'Behavioral health provider',
    serviceLine: 'Business development',
  },
  {
    name: 'Magnolia Health Center - Pasadena',
    ownerName: 'Dewayne Long',
    type: 'Health center',
    serviceLine: 'Business development',
  },
  {
    name: 'Palm Grove Health Center',
    ownerName: 'Dewayne Long',
    type: 'Health center',
    serviceLine: 'Business development',
  },
  {
    name: 'Horminy',
    ownerName: 'Dewayne Long',
    serviceLine: 'Business development',
  },
  {
    name: 'Obedi Home',
    ownerName: 'Dewayne Long',
    type: 'Residential care home',
    serviceLine: 'Business development',
  },
  {
    name: 'River Residence',
    ownerName: 'Dewayne Long',
    type: 'Residential care home',
    serviceLine: 'Business development',
    tags: ['Website maintenance'],
    notes: 'Two further websites are maintained for this account.',
  },
  {
    name: 'Brightwell Behavioral Health - Clarksville',
    ownerName: 'Dewayne Long',
    type: 'Behavioral health provider',
    serviceLine: 'Business development',
  },
  {
    name: 'Mill Creek Farm',
    type: 'Agriculture',
    notes: 'Non-healthcare account; owner not assigned.',
  },
  {
    name: 'MCF Landscaping',
    type: 'Landscaping',
    notes: 'Non-healthcare account; owner not assigned.',
  },
]
