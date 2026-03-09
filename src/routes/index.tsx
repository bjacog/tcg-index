import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: DashboardPage })

const quickActions = [
  {
    title: 'Boxes',
    description: 'Create and manage storage boxes.',
    to: '/boxes',
  },
  {
    title: 'Pick List',
    description: 'Paste a list of cards and find their box + position.',
    to: '/pick-list',
  },
]

function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
          Dashboard
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          TCG Index
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Local-first trading card indexing for ordered boxes, mobile scanning,
          and pick-list generation.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Boxes', '0', 'Storage containers'],
          ['Indexed cards', '0', 'Single-card entries'],
          ['Pick lists', '—', 'Bulk search workflow'],
          ['Scan sessions', '—', 'Box-context mobile flow'],
        ].map(([label, value, hint]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{hint}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {quickActions.map((action) => (
          <Link
            key={action.title}
            to={action.to}
            className="rounded-2xl border border-slate-200 bg-white p-5 no-underline shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {action.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {action.description}
            </p>
          </Link>
        ))}
      </section>
    </div>
  )
}
