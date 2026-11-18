import { describe, expect, it } from 'vitest'
import { nextSendOn, nextTopic, recipientsOf } from './schedule'

describe('nextSendOn', () => {
  it('picks the coming Monday from a Thursday draft', () => {
    expect(nextSendOn('2026-11-19')).toBe('2026-11-23')
  })

  it('skips to the following Monday when drafted on a Monday', () => {
    expect(nextSendOn('2026-11-23')).toBe('2026-11-30')
  })

  it('crosses a month and year end', () => {
    expect(nextSendOn('2026-12-31')).toBe('2027-01-04')
  })
})

describe('nextTopic', () => {
  it('starts with phishing and rotates through every topic', () => {
    expect(nextTopic(undefined)).toBe('phishing')
    expect(nextTopic('phishing')).toBe('passwords')
    expect(nextTopic('devices')).toBe('marketing_accounts')
    expect(nextTopic('cloud_sharing')).toBe('phishing')
  })

  it('skips topics IT switched off and wraps round', () => {
    const marketingOnly = ['marketing_accounts', 'ai_tools'] as const
    expect(nextTopic('phishing', marketingOnly)).toBe('marketing_accounts')
    expect(nextTopic('marketing_accounts', marketingOnly)).toBe('ai_tools')
    expect(nextTopic('ai_tools', marketingOnly)).toBe('marketing_accounts')
  })

  it('restarts the rotation after an unknown topic', () => {
    expect(nextTopic('retired_topic')).toBe('phishing')
  })
})

describe('recipientsOf', () => {
  it('keeps typed addresses first and drops case-insensitive repeats and blanks', () => {
    expect(
      recipientsOf(['me@ihp.test', ' '], ['client@acme.test', 'ME@ihp.test', 'client@acme.test']),
    ).toEqual(['me@ihp.test', 'client@acme.test'])
  })
})
