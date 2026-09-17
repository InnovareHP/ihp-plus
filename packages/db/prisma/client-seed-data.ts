export interface DemoClient {
  name: string
  contactName: string
  email: string
  phone: string
  status: string
  type: string
  serviceLine: string
  source: string
  city: string
  state: string
  tags: string[]
  notes: string
  daysSinceContact: number
}

// Demo rows so the table, its filters and its sorts have something to show on a fresh database.
export const DEMO_CLIENTS: readonly DemoClient[] = [
  {
    name: 'Riverside Care Center',
    contactName: 'Dana Reyes',
    email: 'dana.reyes@riversidecare.example',
    phone: '(609) 555-0134',
    status: 'active',
    type: 'Skilled nursing facility',
    serviceLine: 'Post-acute network',
    source: 'Referral',
    city: 'Trenton',
    state: 'NJ',
    tags: ['Medicare', 'Renewal due'],
    notes: 'Quarterly business review is due in March.',
    daysSinceContact: 4,
  },
  {
    name: 'Garden State Physician Group',
    contactName: 'Alvin Park',
    email: 'apark@gspg.example',
    phone: '(973) 555-0188',
    status: 'active',
    type: 'Physician group',
    serviceLine: 'Care management',
    source: 'Conference',
    city: 'Newark',
    state: 'NJ',
    tags: ['Expansion'],
    notes: 'Wants pricing for two additional panels.',
    daysSinceContact: 11,
  },
  {
    name: 'Keystone Behavioral Health',
    contactName: 'Marta Silva',
    email: 'msilva@keystonebh.example',
    phone: '(215) 555-0110',
    status: 'prospect',
    type: 'Behavioral health provider',
    serviceLine: 'Behavioral health',
    source: 'Inbound website',
    city: 'Philadelphia',
    state: 'PA',
    tags: ['At risk'],
    notes: 'Security review outstanding before contracting.',
    daysSinceContact: 26,
  },
  {
    name: 'Atlantic Home Health',
    contactName: 'Ruth Okafor',
    email: 'rokafor@atlantichh.example',
    phone: '(732) 555-0177',
    status: 'active',
    type: 'Home health agency',
    serviceLine: 'Utilization review',
    source: 'Partner introduction',
    city: 'Jersey City',
    state: 'NJ',
    tags: ['Medicaid'],
    notes: '',
    daysSinceContact: 2,
  },
  {
    name: 'Liberty Health Plan',
    contactName: 'Chen Wu',
    email: 'cwu@libertyplan.example',
    phone: '(212) 555-0145',
    status: 'on_hold',
    type: 'Payer',
    serviceLine: 'Quality reporting',
    source: 'RFP',
    city: 'New York',
    state: 'NY',
    tags: ['Executive sponsor'],
    notes: 'Paused until their fiscal year opens in July.',
    daysSinceContact: 48,
  },
  {
    name: 'Princeton Assisted Living',
    contactName: 'Elena Marsh',
    email: 'emarsh@princetonal.example',
    phone: '(609) 555-0199',
    status: 'prospect',
    type: 'Assisted living',
    serviceLine: 'Staffing',
    source: 'Outbound campaign',
    city: 'Princeton',
    state: 'NJ',
    tags: [],
    notes: 'Asked for references from similar-size facilities.',
    daysSinceContact: 17,
  },
  {
    name: 'Camden Community Clinic',
    contactName: 'Desmond Hale',
    email: 'dhale@camdenclinic.example',
    phone: '(856) 555-0122',
    status: 'active',
    type: 'FQHC',
    serviceLine: 'Population health',
    source: 'Existing client expansion',
    city: 'Camden',
    state: 'NJ',
    tags: ['Medicaid', 'Expansion'],
    notes: '',
    daysSinceContact: 8,
  },
  {
    name: 'Northeast Hospice Partners',
    contactName: 'Iris Donnelly',
    email: 'idonnelly@nehospice.example',
    phone: '(203) 555-0166',
    status: 'inactive',
    type: 'Hospice',
    serviceLine: 'Credentialing',
    source: 'Referral',
    city: 'Trenton',
    state: 'CT',
    tags: [],
    notes: 'Contract ended; revisit next open period.',
    daysSinceContact: 120,
  },
]
