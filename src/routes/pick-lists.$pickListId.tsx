import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { getPickListByIdFn } from '../lib/server/pick-list-actions'

export const Route = createFileRoute('/pick-lists/$pickListId')({
  loader: async ({ params }) => {
    try {
      return await getPickListByIdFn({ data: params.pickListId })
    } catch {
      throw notFound()
    }
  },
  component: PickListDetailPage,
})

function PickListDetailPage() {
  const pickList = Route.useLoaderData()
  const rerunQuery = pickList.requestedCards.join('\n')

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link to="/pick-lists" className="text-sm text-emerald-700 dark:text-emerald-400">
            ← Back to pick lists
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Saved pick list</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Generated {new Date(pickList.createdAt).toLocaleString()}.
          </p>
        </div>
        <Link
          to="/pick-list"
          search={{ q: rerunQuery }}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white"
        >
          Generate new pick list from same cards
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Requested cards</h2>
        <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-950/60">
          {pickList.requestedCards.join('\n')}
        </pre>
      </section>

      {pickList.missingCards.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40">
          <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
            Cards not found
          </h2>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
            {pickList.missingCards.join(', ')}
          </p>
        </section>
      ) : null}

      <section className="space-y-4">
        {pickList.resultSnapshot.map((boxGroup) => (
          <section
            key={boxGroup.box}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="bg-slate-50 px-4 py-4 dark:bg-slate-950/60">
              <h3 className="text-base font-semibold">{boxGroup.box}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {boxGroup.cards.length} requested card{boxGroup.cards.length === 1 ? '' : 's'} in
                this box
              </p>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {boxGroup.cards.map((card) => (
                <div
                  key={`${boxGroup.box}-${card.name}-${card.position}`}
                  className="flex items-center gap-4 px-4 py-4"
                >
                  <div className="min-w-20 text-2xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
                    #{card.position}
                  </div>
                  <div className="text-sm font-medium">{card.name}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </section>
    </div>
  )
}
