import { Button, Card } from '@ihp/ui'

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold tracking-tight">IHP Plus — app</h1>
      <p className="text-sm opacity-70">
        Next.js app, served under <code className="font-mono">/app</code>. Landing page is Astro at{' '}
        <code className="font-mono">/</code>.
      </p>
      <Card title="Shared UI">
        <p className="mb-4 text-sm opacity-70">
          This card and button come from <code className="font-mono">@ihp/ui</code>, rendered by both
          apps.
        </p>
        <div className="flex gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </Card>
    </main>
  )
}
