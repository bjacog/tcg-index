import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { searchCardsByExactNamesFn } from '../lib/server/card-actions'

export const Route = createFileRoute('/pick-list')({ component: PickListPage })

type PickListCardEntry = {
  name: string
  positions: Array<string | number>
}

type PickListBoxGroup = {
  box: string
  cards: PickListCardEntry[]
}

function PickListPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PickListBoxGroup[]>([])
  const [missingCards, setMissingCards] = useState<string[]>([])
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
      const lowerRequested = requestedNames.map((name) => name.toLowerCase())
      const foundNames = new Set(matches.map((entry) => entry.name.toLowerCase()))

      const nextMissingCards = requestedNames.filter((requested, index) => {
        const lowered = lowerRequested[index]
        return !foundNames.has(lowered)
      })

      const boxesMap = new Map<string, Map<string, Array<string | number>>>()

      for (const match of matches) {
        const box = `${match.boxCode} · ${match.boxName}`
        const existingBoxGroup = boxesMap.get(box) ?? new Map<string, Array<string | number>>()
        const existingPositions = existingBoxGroup.get(match.name) ?? []
        existingPositions.push(match.position)
        existingBoxGroup.set(match.name, existingPositions)
        boxesMap.set(box, existingBoxGroup)
      }

      const nextResults = Array.from(boxesMap.entries())
        .map(([box, cardMap]) => ({
          box,
          cards: Array.from(cardMap.entries())
            .map(([name, positions]) => ({
              name,
              positions: positions.sort((a, b) => Number(a) - Number(b)),
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => a.box.localeCompare(b.box))

      setResults(nextResults)
      setMissingCards(nextMissingCards)
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
          Paste one exact card name per line to group the requested cards by the boxes that contain
          them.
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
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Results by box</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {results.length === 0
              ? 'No pick list generated yet.'
              : `${results.length} matching box${results.length === 1 ? '' : 'es'} found.`}
          </p>
        </div>

        {missingCards.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/60 dark:bg-amber-950/40">
            <p className="font-medium text-amber-900 dark:text-amber-200">Not found</p>
            <p className="mt-1 text-amber-800 dark:text-amber-300">{missingCards.join(', ')}</p>
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          {results.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              No matching boxes yet.
            </div>
          ) : (
            results.map((result) => (
              <section
                key={result.box}
                className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800"
              >
                <div className="bg-slate-50 px-4 py-4 dark:bg-slate-950/60">
                  <h3 className="text-base font-semibold">{result.box}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {result.cards.length} requested card{result.cards.length === 1 ? '' : 's'} in
                    this box
                  </p>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {result.cards.map((card) => (
                    <div key={`${result.box}-${card.name}`} className="px-4 py-4">
                      <div className="text-sm font-medium">{card.name}</div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Positions: {card.positions.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
