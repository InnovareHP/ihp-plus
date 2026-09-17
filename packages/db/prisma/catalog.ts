/**
 * The published rate card, transcribed once so `pnpm db:seed` can put it in front of a new
 * organization. Prices are in whole cents; a single price repeats as both bounds.
 *
 * This is seed data, not the source of truth — an organization edits its own catalog in the
 * portal afterwards, and re-seeding never overwrites a row someone has changed.
 */
export interface CatalogSeed {
  category: 'creative' | 'social' | 'bundle' | 'addon'
  name: string
  description: string
  priceMinCents: number
  priceMaxCents: number
  unit: 'project' | 'month' | 'campaign' | 'deck' | 'video' | 'once'
  percentOfSpend?: number
  /** The scope this service commits to, appended to any contract that includes it. */
  defaultTerms?: string
}

const dollars = (amount: number) => amount * 100

export const CATALOG_SEED: readonly CatalogSeed[] = [
  // ---- Creative services ----
  {
    category: 'creative',
    name: 'Brand Identity Design',
    description:
      "Develop or refresh your brand's visual identity, including logos, colors, typography, and brand assets.",
    priceMinCents: dollars(3_000),
    priceMaxCents: dollars(7_000),
    unit: 'project',
  },
  {
    category: 'creative',
    name: 'Graphic Design',
    description:
      'Create professional marketing materials for digital and print, from flyers to brochures and promotional graphics.',
    priceMinCents: dollars(300),
    priceMaxCents: dollars(2_500),
    unit: 'project',
  },
  {
    category: 'creative',
    name: 'Social Media Graphics',
    description: 'Approximately 12–20 static graphics or carousels across agreed platforms.',
    priceMinCents: dollars(600),
    priceMaxCents: dollars(1_500),
    unit: 'month',
  },
  {
    category: 'creative',
    name: 'Ad Creative Design',
    description:
      'Produce high-converting visuals for Meta, Google Display, LinkedIn, and other digital advertising campaigns.',
    priceMinCents: dollars(750),
    priceMaxCents: dollars(2_000),
    unit: 'campaign',
  },
  {
    category: 'creative',
    name: 'Presentation Design',
    description:
      'Design polished pitch decks, sales presentations, company profiles, and proposal presentations.',
    priceMinCents: dollars(1_200),
    priceMaxCents: dollars(2_500),
    unit: 'deck',
  },
  {
    category: 'creative',
    name: 'Video Editing',
    description:
      'Edit promotional videos, testimonials, educational content, reels, and short-form videos for digital platforms.',
    priceMinCents: dollars(500),
    priceMaxCents: dollars(3_000),
    unit: 'video',
  },

  // ---- Social media services ----
  {
    category: 'social',
    name: 'Content Creation',
    description:
      'Produce engaging captions, graphics, carousels, and short-form videos tailored to your audience.',
    priceMinCents: dollars(1_200),
    priceMaxCents: dollars(3_000),
    unit: 'month',
  },
  {
    category: 'social',
    name: 'Social Media Management',
    description:
      'Manage your social media presence through publishing, scheduling, and day-to-day account management.',
    priceMinCents: dollars(1_500),
    priceMaxCents: dollars(4_000),
    unit: 'month',
  },
  {
    category: 'social',
    name: 'Community Management',
    description:
      'Monitor comments and messages, respond to inquiries, and foster audience engagement.',
    priceMinCents: dollars(750),
    priceMaxCents: dollars(2_000),
    unit: 'month',
  },
  {
    category: 'social',
    name: 'Profile Optimization',
    description:
      'Optimize your social media profiles to strengthen branding and improve discoverability.',
    priceMinCents: dollars(500),
    priceMaxCents: dollars(1_250),
    unit: 'once',
  },
  {
    category: 'social',
    name: 'Campaign Management',
    description:
      'Plan and coordinate organic social media campaigns for launches, promotions, and awareness initiatives.',
    priceMinCents: dollars(1_500),
    priceMaxCents: dollars(4_000),
    unit: 'campaign',
  },
  {
    category: 'social',
    name: 'Paid Social Advertising',
    defaultTerms:
      'Paid social advertising is billed either as the agreed monthly fee or as 15% of ad spend, as stated in this contract. Ad spend itself is paid by the client directly and is not included.',
    description:
      'Create, manage, and optimize Meta, LinkedIn, and other social media advertising campaigns. Billed as a monthly fee or as a share of ad spend, whichever the contract states.',
    priceMinCents: dollars(1_000),
    priceMaxCents: dollars(2_500),
    unit: 'month',
    percentOfSpend: 15,
  },
  {
    category: 'social',
    name: 'Performance Reporting',
    description:
      'Deliver regular reports with actionable insights, key metrics, and recommendations for improvement.',
    priceMinCents: dollars(500),
    priceMaxCents: dollars(1_500),
    unit: 'month',
  },

  // ---- Bundles ----
  {
    category: 'bundle',
    name: 'Starter',
    defaultTerms:
      'Starter bundle: one or two platforms; nine static posts or carousels per month; two short-form videos per month; captions and scheduling; basic monthly reporting; limited community management; one strategy call per month.',
    description:
      'For small businesses needing consistent execution. One or two platforms; nine static posts or carousels; two short-form videos; captions and scheduling; basic monthly reporting; limited community management; one monthly strategy call.',
    priceMinCents: dollars(2_500),
    priceMaxCents: dollars(2_500),
    unit: 'month',
  },
  {
    category: 'bundle',
    name: 'Growth',
    defaultTerms:
      'Growth bundle: three platforms; twelve to sixteen posts or carousels per month; three to five short-form videos per month; content calendar and copywriting; community management during business hours; profile optimization; monthly performance reporting; one campaign or promotional push per month.',
    description:
      'For growing businesses needing regular content and active management. Three platforms; twelve to sixteen posts or carousels; three to five short-form videos; content calendar and copywriting; community management in business hours; profile optimization; monthly reporting; one campaign per month.',
    priceMinCents: dollars(4_500),
    priceMaxCents: dollars(4_500),
    unit: 'month',
  },
  {
    category: 'bundle',
    name: 'Growth Plus',
    defaultTerms:
      'Growth Plus bundle: three to four platforms; eighteen to twenty content pieces per month; six to eight short-form videos per month; creative direction and campaign planning; active community management; paid social management for one to two platforms; biweekly reporting; two strategy calls per month.',
    description:
      'For established small and mid-sized companies. Three to four platforms; eighteen to twenty content pieces; six to eight short-form videos; creative direction and campaign planning; active community management; paid social for one to two platforms; biweekly reporting; two strategy calls per month.',
    priceMinCents: dollars(7_500),
    priceMaxCents: dollars(7_500),
    unit: 'month',
  },

  // ---- Add-ons ----
  {
    category: 'addon',
    name: 'Additional Static Graphic',
    description: 'One more static graphic beyond the agreed monthly count.',
    priceMinCents: dollars(125),
    priceMaxCents: dollars(250),
    unit: 'project',
  },
  {
    category: 'addon',
    name: 'Additional Carousel',
    description: 'One more carousel beyond the agreed monthly count.',
    priceMinCents: dollars(200),
    priceMaxCents: dollars(400),
    unit: 'project',
  },
  {
    category: 'addon',
    name: 'Additional Short-Form Video',
    description: 'One more short-form video beyond the agreed monthly count.',
    priceMinCents: dollars(350),
    priceMaxCents: dollars(750),
    unit: 'video',
  },
  {
    category: 'addon',
    name: 'Extra Revision Round',
    description: 'A further round of revisions beyond the number the contract states.',
    priceMinCents: dollars(150),
    priceMaxCents: dollars(300),
    unit: 'project',
  },
  {
    category: 'addon',
    name: 'Additional Social Platform',
    description: 'Extend the agreed work to one more platform.',
    priceMinCents: dollars(400),
    priceMaxCents: dollars(900),
    unit: 'month',
  },
  {
    category: 'addon',
    name: 'Weekend Or After-Hours Community Management',
    description: 'Community management outside the agreed business-hours window.',
    priceMinCents: dollars(500),
    priceMaxCents: dollars(1_500),
    unit: 'month',
  },
  {
    category: 'addon',
    name: 'Additional Strategy Meeting',
    description: 'One more strategy meeting beyond those the contract includes.',
    priceMinCents: dollars(200),
    priceMaxCents: dollars(400),
    unit: 'once',
  },
  {
    category: 'addon',
    // A surcharge, not a fee: the range is the percentage, which is why both bounds are zero.
    name: 'Rush Delivery',
    defaultTerms:
      'Rush delivery is charged as a surcharge of 25%–50% on the work it applies to, agreed in writing before the work starts.',
    description:
      'Compressed turnaround, charged as a surcharge of 25%–50% on the work it applies to rather than as a flat fee.',
    priceMinCents: 0,
    priceMaxCents: 0,
    unit: 'project',
  },
]

/**
 * The scope terms every proposal states, seeded into a contract's terms so nobody has to
 * remember the list. They are prose because they are read by a client, not branched on.
 */
export const DEFAULT_CONTRACT_TERMS = `Scope
- Platforms covered:
- Deliverables and quantities:
- Revision rounds included:
- Turnaround time:
- Client approval deadline:
- Strategy and meetings included:
- Support window (business hours):
- Community-management response limits:
- Video length and complexity:
- Source files included:
- Rush work permitted:
- Unused monthly capacity expires:

Excluded and billed separately
Paid media spend, photography, videography, stock assets, printing, software subscriptions requested by the client, and third-party production costs.`

/**
 * The standard terms every contract carries, appended after the scope. Seeded once and edited
 * per organization in the portal — it is boilerplate a company owns, not something the code
 * decides, which is why nothing here branches on it.
 */
export const DEFAULT_STANDARD_TERMS = `Fees and payment
Fees are as stated above. Monthly work is invoiced in advance; project work is invoiced on the
schedule this contract states. Invoices are due within 15 days.

Excluded costs
Paid media spend, photography, videography, stock assets, printing, software subscriptions
requested by the client, and third-party production costs are billed separately at cost.

Approvals and turnaround
Work begins once the brief is approved. Turnaround runs from the date all required material and
approvals are received; a missed client approval deadline moves delivery by the same period.

Revisions
Revision rounds are as stated in the scope above. Further rounds are billed at the add-on rate
on the current rate card.

Capacity
Unused monthly capacity does not carry into the following month unless this contract says so.

Ownership
On payment in full, ownership of the final approved deliverables passes to the client. Working
files and source assets remain ours unless this contract states otherwise.

Cancellation
Either party may cancel with 30 days' written notice. Work completed or committed up to the end
of the notice period is payable.`
