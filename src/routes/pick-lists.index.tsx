import { Link, createFileRoute } from '@tanstack/react-router'
import { listPickListsFn } from '../lib/server/pick-list-actions'

export const Route = createFileRoute('/pick-lists/')({
  loader: () => listPickListsFn(),
  component: PickListsHistoryPage,
})

function PickListsHistoryPage() {
  const pickLists = Route.useLoaderData()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
            Pick lists
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">History</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Previously generated pick lists and their saved results.
          </p>
        </div>
        <Link
          to="/pick-list"
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white"
        >
          New pick list
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950/60">
            <tr className="text-left text-sm text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Requested cards</th>
              <th className="px-4 py-3 font-medium">Missing</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {pickLists.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  No pick lists generated yet.
                </td>
              </tr>
            ) : (
              pickLists.map((pickList) => (
                <tr key={pickList.id}>
                  <td className="px-4 py-4 text-sm">
                    {new Date(pickList.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-sm">{pickList.requestedCards.length}</td>
                  <td className="px-4 py-4 text-sm">{pickList.missingCards.length}</td>
                  <td className="px-4 py-4 text-sm">
                    {pickList.pickedAt ? (
                      <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                        Picked
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Ready to pick
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <div className="flex flex-wrap gap-3">
                      <Link
                        to="/pick-lists/$pickListId"
                        params={{ pickListId: pickList.id }}
                        className="text-emerald-700 dark:text-emerald-400"
                      >
                        Open
                      </Link>
                      {pickList.projectBoxId ? (
                        <Link
                          to="/boxes/$boxId"
                          params={{ boxId: pickList.projectBoxId }}
                          className="text-violet-700 dark:text-violet-400"
                        >
                          Project box
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
