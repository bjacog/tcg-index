import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/boxes/$boxId')({ component: BoxDetailPage })

function BoxDetailPage() {
  const { boxId } = Route.useParams()

  const cards = [
    { position: 1, cardName: 'Sol Ring', setName: 'Commander Masters', finish: 'Nonfoil', condition: 'NM' },
    { position: 2, cardName: 'Arcane Signet', setName: 'Commander Masters', finish: 'Nonfoil', condition: 'NM' },
    { position: 3, cardName: 'Swords to Plowshares', setName: 'Strixhaven Mystical Archive', finish: 'Foil', condition: 'LP' },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link to="/boxes" className="text-sm text-emerald-700 dark:text-emerald-400">
            ← Back to boxes
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Box {boxId}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Ordered contents for this box. Adding at a position inserts and shifts. Removing collapses following positions.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium dark:border-slate-700">
            Insert card
          </button>
          <Link
            to="/boxes/$boxId/scan"
            params={{ boxId }}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white"
          >
            Scan cards
          </Link>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950/60">
            <tr className="text-left text-sm text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3 font-medium">Position</th>
              <th className="px-4 py-3 font-medium">Card</th>
              <th className="px-4 py-3 font-medium">Set</th>
              <th className="px-4 py-3 font-medium">Finish</th>
              <th className="px-4 py-3 font-medium">Condition</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {cards.map((card) => (
              <tr key={card.position}>
                <td className="px-4 py-4 text-sm font-medium">{card.position}</td>
                <td className="px-4 py-4 text-sm">{card.cardName}</td>
                <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{card.setName}</td>
                <td className="px-4 py-4 text-sm">{card.finish}</td>
                <td className="px-4 py-4 text-sm">{card.condition}</td>
                <td className="px-4 py-4 text-sm text-rose-600 dark:text-rose-400">Remove</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
