import { Link, createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

function DefaultNotFoundComponent() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-16 text-center sm:px-6 sm:py-24">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
        Not found
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        That page does not exist.
      </h1>
      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
        The route might be wrong, outdated, or no longer available.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white no-underline"
        >
          Go home
        </Link>
        <Link
          to="/boxes"
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 no-underline dark:border-slate-700 dark:text-slate-200"
        >
          Browse boxes
        </Link>
        <Link
          to="/pick-lists"
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 no-underline dark:border-slate-700 dark:text-slate-200"
        >
          View pick lists
        </Link>
      </div>
    </div>
  )
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    defaultNotFoundComponent: DefaultNotFoundComponent,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
