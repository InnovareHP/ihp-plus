import { prismaAdapter } from '@better-auth/prisma-adapter'
import { db } from '@ihp/db'
import { betterAuth } from 'better-auth/minimal'
import { nextCookies } from 'better-auth/next-js'
import { sendEmail } from './email'
import { AUTH_BASE_PATH } from './routes'

export const auth = betterAuth({
  appName: 'IHP Plus',
  // The router derives its own base from baseURL at init, so an unset value 404s every route.
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  // Next mounts everything under basePath '/app', so Better Auth's own path carries it too.
  basePath: AUTH_BASE_PATH,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: 'postgresql' }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    // Not awaited: a slow mail provider would leak whether the address exists.
    sendResetPassword: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: 'Reset your IHP Plus password',
        text: `Open this link to choose a new password: ${url}`,
      })
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: 'Verify your IHP Plus email address',
        text: `Confirm this address: ${url}`,
      })
    },
  },

  socialProviders: {
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID ?? '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
      tenantId: process.env.MICROSOFT_TENANT_ID ?? 'common',
      prompt: 'select_account',
      // Entra returns the avatar as a base64 blob that overflows HTTP header limits.
      mapProfileToUser: () => ({ image: undefined }),
    },
  },

  // An Outlook sign-in on an address that already has a password links instead of erroring.
  account: {
    accountLinking: { enabled: true, trustedProviders: ['microsoft'] },
  },

  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  // The generated Prisma schema ships relations, so /get-session can join instead of fanning out.
  advanced: {
    database: { joins: true },
  },

  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session
