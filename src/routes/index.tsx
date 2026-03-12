import { Link, createFileRoute } from '@tanstack/react-router'
import { getRuntimeStatusFn } from '../lib/server/box-actions'
import { getDashboardStatsFn } from '../lib/server/pick-list-actions'

export const Route = createFileRoute('/')({
  loader: async () => {
    const [stats, runtimeStatus] = await Promise.all([getDashboardStatsFn(), getRuntimeStatusFn()])
    return { stats, runtimeStatus }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const { stats, runtimeStatus } = Route.useLoaderData()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
          Dashboard
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">TCG Index</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Local-first trading card indexing for ordered boxes, mobile scanning, and pick-list
          generation.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Link
          to="/boxes"
          className="rounded-2xl border border-slate-200 bg-white p-5 no-underline shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800"
        >
          <p className="text-sm text-slate-500 dark:text-slate-400">Boxes</p>
          <p className="mt-3 text-3xl font-semibold">{stats.boxCount}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Storage containers</p>
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Indexed cards</p>
          <p className="mt-3 text-3xl font-semibold">{stats.indexedCardCount}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {stats.uniqueCardNameCount} unique by name
          </p>
        </div>

        <Link
          to="/pick-lists"
          className="rounded-2xl border border-slate-200 bg-white p-5 no-underline shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800"
        >
          <p className="text-sm text-slate-500 dark:text-slate-400">Pick lists</p>
          <p className="mt-3 text-3xl font-semibold">{stats.pickListCount}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Saved pick-list history</p>
        </Link>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Runtime status</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Current storage paths for this app instance.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Data directory
            </p>
            <code className="mt-2 block break-all rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-900 dark:bg-slate-950 dark:text-slate-100">
              {runtimeStatus.dataDirectory}
            </code>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              SQLite database
            </p>
            <code className="mt-2 block break-all rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-900 dark:bg-slate-950 dark:text-slate-100">
              {runtimeStatus.databaseFilePath}
            </code>
          </div>
        </div>
      </section>
    </div>
  )
}
