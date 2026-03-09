import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pick-list')({ component: PickListPage })

function PickListPage() {
  const sampleResults = [
    { requested: 'Sol Ring', status: 'Found', box: 'BOX-001', position: 1 },
    { requested: 'Swords to Plowshares', status: 'Found', box: 'BOX-001', position: 3 },
    { requested: 'Counterspell', status: 'Not found', box: '—', position: '—' },
  ]

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
          Pick list
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Bulk search</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Paste one card name per line to generate a pick list grouped for physical retrieval.
        </p>
        <textarea
          className="mt-4 min-h-72 w-full rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm outline-none ring-0 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950/60"
          placeholder={'Sol Ring\nArcane Signet\nSwords to Plowshares'}
        />
        <button className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white">
          Generate pick list
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Results</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-950/60">
              <tr className="text-left text-sm text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">Requested</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Box</th>
                <th className="px-4 py-3 font-medium">Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {sampleResults.map((result) => (
                <tr key={result.requested}>
                  <td className="px-4 py-4 text-sm">{result.requested}</td>
                  <td className="px-4 py-4 text-sm">{result.status}</td>
                  <td className="px-4 py-4 text-sm">{result.box}</td>
                  <td className="px-4 py-4 text-sm">{result.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
