import type { AxeMatchers } from 'vitest-axe'

// vitest-axe still augments Vitest 1's `Vi` namespace, so the matcher is redeclared here.
declare module 'vitest' {
  interface Matchers<R = void | Promise<void>, T = unknown> extends AxeMatchers {
    _axeMatchers?: [R, T]
  }
}
