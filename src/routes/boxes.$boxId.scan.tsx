import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { getBoxByIdFn, getBoxSettingsFn } from '../lib/server/box-actions'
import { listCardsForBoxFn, removeCardFromBoxFn } from '../lib/server/card-actions'

export const Route = createFileRoute('/boxes/$boxId/scan')({
  loader: async ({ params }) => {
    const [box, cards, settings] = await Promise.all([
      getBoxByIdFn({ data: params.boxId }),
      listCardsForBoxFn({ data: params.boxId }),
      getBoxSettingsFn(),
    ])

    if (box.kind === 'project') {
      throw notFound()
    }

    return { box, cards, settings }
  },
  component: BoxScanPage,
})

function BoxScanPage() {
  const { box, cards, settings } = Route.useLoaderData()
  const router = useRouter()
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removingCardId, setRemovingCardId] = useState<string | null>(null)
  const seenCardIdsRef = useRef<Set<string>>(new Set(cards.map((card) => card.id)))

  const nextIndex = useMemo(
    () => (cards.length === 0 ? 1 : Math.max(...cards.map((card) => card.position)) + 1),
    [cards],
  )
  const latestCards = useMemo(() => [...cards].sort((a, b) => b.position - a.position), [cards])
  const pollingActiveForThisBox = Boolean(box.delverPollingActive && settings.delverPollingEnabled)

  useEffect(() => {
    seenCardIdsRef.current = new Set(cards.map((card) => card.id))
  }, [cards])

  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    async function refreshCards(reason?: string) {
      const latestCards = await listCardsForBoxFn({ data: box.id })
      const previousIds = seenCardIdsRef.current
      const nextIds = new Set(latestCards.map((card) => card.id))
      const addedCards = latestCards.filter((card) => !previousIds.has(card.id))

      seenCardIdsRef.current = nextIds

      if (cancelled) return

      if (addedCards.length > 0) {
        const summary = addedCards
          .slice(0, 3)
          .map((card) => `#${card.position} ${card.name}`)
          .join(' · ')
        setStatus(
          `${addedCards.length} new scan${addedCards.length === 1 ? '' : 's'} detected${summary ? ` — ${summary}` : ''}`,
        )
      } else if (reason) {
        setStatus(reason)
      }

      await router.invalidate()
    }

    if (window.tcgIndexDesktop?.isElectron) {
      return window.tcgIndexDesktop.onPollingStatus(async (result) => {
        if (!result.ok) {
          setError(result.message ?? 'Polling failed')
          return
        }

        const targetResult = (result.boxResults ?? []).find((entry) => entry.boxCode === box.code)

        if (targetResult?.type === 'card_scanned') {
          setError(null)
          await refreshCards('Scan stream updated')
          return
        }

        if (result.empty && pollingActiveForThisBox) {
          setStatus('Waiting for scans…')
        }
      })
    }

    async function loop() {
      try {
        const response = await fetch('/api/delver-poll', { method: 'POST' })
        const result = (await response.json()) as {
          ok: boolean
          empty?: boolean
          message?: string
          boxResults?: Array<{ boxCode?: string; type?: string }>
        }

        if (cancelled) return

        if (!response.ok || !result.ok) {
          setError(result.message ?? 'Polling failed')
          timeoutId = setTimeout(loop, 3000)
          return
        }

        const targetResult = (result.boxResults ?? []).find((entry) => entry.boxCode === box.code)

        if (targetResult?.type === 'card_scanned') {
          setError(null)
          await refreshCards('Scan stream updated')
          timeoutId = setTimeout(loop, 600)
          return
        }

        if (result.empty && pollingActiveForThisBox) {
          setStatus('Waiting for scans…')
        }

        timeoutId = setTimeout(loop, result.empty ? 500 : 1200)
      } catch (caughtError) {
        if (cancelled) return
        setError(caughtError instanceof Error ? caughtError.message : 'Polling failed')
        timeoutId = setTimeout(loop, 3000)
      }
    }

    void loop()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [box.code, box.id, pollingActiveForThisBox, router])

  async function handleRemoveCard(cardId: string, cardName: string) {
    const confirmed = window.confirm(`Remove ${cardName} from ${box.code}? Later cards will be reindexed.`)
    if (!confirmed) return

    setError(null)
    setRemovingCardId(cardId)

    try {
      await removeCardFromBoxFn({ data: { boxId: box.id, cardId } })
      setStatus(`Removed ${cardName}. Following cards were reindexed.`)
      await router.invalidate()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to remove card')
    } finally {
      setRemovingCardId(null)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link to="/boxes/$boxId" params={{ boxId: box.id }} className="text-sm text-emerald-700 dark:text-emerald-400">
            ← Back to box
          </Link>
          <p className="mt-3 text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
            Scan into box
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{box.code}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Watch cards appear as they are detected. If a scan is wrong, remove it here and the
            cards after it will shift up automatically.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <span className="font-medium">Box polling:</span>{' '}
            {box.delverPollingActive ? 'Enabled for this box' : 'Disabled for this box'}
          </div>
          <div>
            <span className="font-medium">Global polling:</span>{' '}
            {settings.delverPollingEnabled ? 'Running' : 'Stopped'}
          </div>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/60" />

          <div className="grid gap-3">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Next index
              </p>
              <p className="mt-2 text-2xl font-semibold">{nextIndex}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Latest scan
              </p>
              <p className="mt-2 text-base font-medium">
                {latestCards[0] ? `${latestCards[0].name} (#${latestCards[0].position})` : 'Awaiting detection'}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-950/60">
              <p className="font-medium">Status</p>
              <p className="mt-2 text-slate-600 dark:text-slate-300">
                {error ?? status ?? (pollingActiveForThisBox ? 'Waiting for scans…' : 'Enable polling for this box to start the live stream.')}
              </p>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Live scan stream</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Newest cards first. Remove incorrect entries immediately without leaving the scan page.
            </p>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950/95">
                <tr className="text-left text-sm text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">Index</th>
                  <th className="px-4 py-3 font-medium">Card</th>
                  <th className="px-4 py-3 font-medium">Set</th>
                  <th className="px-4 py-3 font-medium">Finish</th>
                  <th className="px-4 py-3 font-medium">Condition</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {latestCards.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                      No cards scanned into this box yet.
                    </td>
                  </tr>
                ) : (
                  latestCards.map((card) => (
                    <tr key={card.id}>
                      <td className="px-4 py-4 text-sm font-medium">{card.position}</td>
                      <td className="px-4 py-4 text-sm">{card.name}</td>
                      <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{card.edition || '—'}</td>
                      <td className="px-4 py-4 text-sm">{card.finish || '—'}</td>
                      <td className="px-4 py-4 text-sm">{card.condition || '—'}</td>
                      <td className="px-4 py-4 text-sm">
                        <button
                          type="button"
                          onClick={() => handleRemoveCard(card.id, card.name)}
                          disabled={removingCardId === card.id}
                          className="cursor-pointer rounded-xl border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900 dark:text-rose-400"
                        >
                          {removingCardId === card.id ? 'Removing…' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  )
}
