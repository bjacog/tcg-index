import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { searchCardsByExactNamesFn } from '../lib/server/card-actions'

export const Route = createFileRoute('/pick-list')({ component: PickListPage })

type PickListBoxGroup = {
  box: string
  positions: Array<string | number>
}

type PickListGroup = {
  requested: string
  status: string
  boxes: PickListBoxGroup[]
}

function PickListPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PickListGroup[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestedNames = useMemo(
    () =>
      query
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    [query],
  )

  async function handleGeneratePickList() {
    setError(null)
    setIsSearching(true)

    try {
      const matches = await searchCardsByExactNamesFn({ data: requestedNames })
      const nextResults = requestedNames.map((requested) => {
        const cardMatches = matches.filter(
          (entry) => entry.name.toLowerCase() === requested.toLowerCase(),
        )

        if (cardMatches.length === 0) {
          return {
            requested,
            status: 'Not found',
            boxes: [],
          }
        }

        const boxesMap = new Map<string, Array<string | number>>()

        for (const match of cardMatches) {
          const box = `${match.boxCode} · ${match.boxName}`
          const currentPositions = boxesMap.get(box) ?? []
          currentPositions.push(match.position)
          boxesMap.set(box, currentPositions)
        }

        const boxGroups = Array.from(boxesMap.entries()).map(([box, positions]) => ({
          box,
          positions: positions.sort((a, b) => Number(a) - Number(b)),
        }))

        return {
          requested,
          status: `Found in ${cardMatches.length} location${cardMatches.length === 1 ? '' : 's'} across ${boxGroups.length} box${boxGroups.length === 1 ? '' : 'es'}`,
          boxes: boxGroups,
        }
      })

      setResults(nextResults)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to search cards')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
          Pick list
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Bulk search</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Paste one exact card name per line to find every indexed match and its box position.
        </p>
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="mt-4 min-h-72 w-full rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm outline-none ring-0 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950/60"
          placeholder={'Sol Ring\nArcane Signet\nSwords to Plowshares'}
        />
        {error ? <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
        <button
          onClick={handleGeneratePickList}
          disabled={isSearching || requestedNames.length === 0}
          className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSearching ? 'Searching…' : 'Generate pick list'}
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Results</h2>
        <div className="mt-4 space-y-4">
          {results.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              No pick list generated yet.
            </div>
          ) : (
            results.map((result) => (
              <section
                key={result.requested}
                className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800"
              >
                <div className="flex flex-col gap-1 bg-slate-50 px-4 py-4 dark:bg-slate-950/60">
                  <h3 className="text-base font-semibold">{result.requested}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{result.status}</p>
                </div>

                {result.boxes.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                    No indexed copies found.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {result.boxes.map((boxGroup) => (
                      <div key={`${result.requested}-${boxGroup.box}`} className="px-4 py-4">
                        <div className="text-sm font-medium">{boxGroup.box}</div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          Positions: {boxGroup.positions.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
