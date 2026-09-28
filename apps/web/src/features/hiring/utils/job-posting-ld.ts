import type { EmploymentType, PublicPosting, SalaryPeriod } from '../schema'

// schema.org's own vocabulary, which is what search engines read into their job listings.
const EMPLOYMENT_TYPE: Record<EmploymentType, string> = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  contract: 'CONTRACTOR',
  internship: 'INTERN',
  temporary: 'TEMPORARY',
}

const UNIT_TEXT: Record<SalaryPeriod, string> = { year: 'YEAR', month: 'MONTH', hour: 'HOUR' }

/** JobPosting structured data, so an open role can surface in a search engine's jobs panel. */
export function jobPostingLd(posting: PublicPosting, organizationName: string, url: string) {
  const hasPay = posting.salaryMin !== undefined || posting.salaryMax !== undefined

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: posting.title,
    description: posting.description,
    url,
    datePosted: posting.openedAt,
    validThrough: posting.closesAt,
    employmentType: EMPLOYMENT_TYPE[posting.employmentType],
    hiringOrganization: { '@type': 'Organization', name: organizationName },
    ...(posting.workplace === 'remote' ? { jobLocationType: 'TELECOMMUTE' } : {}),
    ...(posting.location
      ? {
          jobLocation: {
            '@type': 'Place',
            address: { '@type': 'PostalAddress', addressLocality: posting.location },
          },
        }
      : {}),
    ...(hasPay
      ? {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: posting.salaryCurrency,
            value: {
              '@type': 'QuantitativeValue',
              minValue: posting.salaryMin,
              maxValue: posting.salaryMax,
              unitText: UNIT_TEXT[posting.salaryPeriod],
            },
          },
        }
      : {}),
  }
}
