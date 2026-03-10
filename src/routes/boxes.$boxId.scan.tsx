import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/boxes/$boxId/scan')({
  component: BoxScanPage,
})

function BoxScanPage() {
  const { boxId } = Route.useParams()

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
          Scan into box
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Box {boxId}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Detect card → request Scryfall info → confirm or retry → add at current index.
        </p>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/60" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Current index
            </p>
            <p className="mt-2 text-2xl font-semibold">12</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Scryfall result
            </p>
            <p className="mt-2 text-base font-medium">Awaiting detection</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap gap-3">
          <button className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white">
            Confirm add
          </button>
          <button className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium dark:border-slate-700">
            Retry detection
          </button>
          <button className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium dark:border-slate-700">
            Adjust index
          </button>
        </div>
      </section>
    </div>
  )
}
