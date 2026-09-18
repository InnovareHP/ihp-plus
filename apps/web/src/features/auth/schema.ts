import { z } from 'zod'

// Mirrors Better Auth's minPasswordLength for UX only; the server stays the trust boundary.
const MIN_PASSWORD = 12

const email = z.email('Enter a valid email address')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean(),
})

// No email and no name: an invitation fixes the address, and the onboarding stepper collects
// the rest, so creating an account asks for the minimum.
export const invitationSignupSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD, `Password must be at least ${MIN_PASSWORD} characters`),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD, `Password must be at least ${MIN_PASSWORD} characters`),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type LoginValues = z.infer<typeof loginSchema>
export type InvitationSignupValues = z.infer<typeof invitationSignupSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
