import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/boxes')({ component: BoxesPage })

function BoxesPage() {
  const boxes = [
    { id: 'box-001', code: 'BOX-001', name: 'Commander Staples', location: 'Shelf 2', cards: 0 },
    { id: 'box-002', code: 'BOX-002', name: 'Removal Box', location: 'Desk drawer', cards: 0 },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
            Boxes
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Manage boxes</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Create, inspect, and maintain the ordered contents of your storage boxes.
          </p>
        </div>

        <button className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500">
          New box
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950/60">
            <tr className="text-left text-sm text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Cards</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {boxes.map((box) => (
              <tr key={box.id}>
                <td className="px-4 py-4 text-sm font-medium">{box.code}</td>
                <td className="px-4 py-4 text-sm">{box.name}</td>
                <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{box.location}</td>
                <td className="px-4 py-4 text-sm">{box.cards}</td>
                <td className="px-4 py-4 text-sm">
                  <div className="flex flex-wrap gap-3">
                    <Link to="/boxes/$boxId" params={{ boxId: box.id }} className="text-emerald-700 dark:text-emerald-400">
                      Open
                    </Link>
                    <Link to="/boxes/$boxId/scan" params={{ boxId: box.id }} className="text-slate-600 dark:text-slate-300">
                      Scan
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
