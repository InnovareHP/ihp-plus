import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  title?: string
  children?: ReactNode
}

export function Card({ title, children, className, ...props }: CardProps) {
  return (
    <div
      className={[
        'rounded-card border border-black/5 bg-white p-6 shadow-sm dark:bg-white/5',
        className ?? '',
      ].join(' ')}
      {...props}
    >
      {title ? <h3 className="mb-2 text-lg font-semibold">{title}</h3> : null}
      {children}
    </div>
  )
}
