import { useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute, notFound, useNavigate, useRouter } from '@tanstack/react-router'
import { listBoxesFn } from '../lib/server/box-actions'
import {
  listCardsForBoxFn,
  removeCardFromBoxFn,
  removeIndexGapsForBoxFn,
  returnCardsFromProjectFn,
} from '../lib/server/card-actions'
import { deleteBoxFn, getBoxByIdFn, updateBoxFn } from '../lib/server/box-actions'

export const Route = createFileRoute('/boxes/$boxId')({
  loader: async ({ params }) => {
    try {
      const [box, cards, boxes] = await Promise.all([
        getBoxByIdFn({ data: params.boxId }),
        listCardsForBoxFn({ data: params.boxId }),
        listBoxesFn(),
      ])

      return { box, cards, boxes }
    } catch {
      throw notFound()
    }
  },
  component: BoxDetailPage,
})

function scryfallImageUrl(scryfallId: string) {
  if (!scryfallId) {
    return null
  }

  return `https://cards.scryfall.io/normal/front/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`
}

function BoxDetailPage() {
  const { box, boxes, cards } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    code: box.code,
    name: box.name,
    description: box.description,
    locationNote: box.locationNote,
    delverPollingEndpoint: box.delverPollingEndpoint ?? '',
    delverPollingActive: box.delverPollingActive,
  })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedReturnCardIds, setSelectedReturnCardIds] = useState<string[]>(cards.map((card) => card.id))
  const [returnDestinationBoxId, setReturnDestinationBoxId] = useState('')
  const [isReturningCards, setIsReturningCards] = useState(false)
  const [removingCardId, setRemovingCardId] = useState<string | null>(null)
  const [isCompactingIndexes, setIsCompactingIndexes] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isProjectBox = box.kind === 'project'
  const storageBoxes = useMemo(() => boxes.filter((candidate) => candidate.kind === 'storage'), [boxes])
  const allProjectCardIds = useMemo(() => cards.map((card) => card.id), [cards])
  const areAllProjectCardsSelected =
    cards.length > 0 && selectedReturnCardIds.length === cards.length && cards.every((card) => selectedReturnCardIds.includes(card.id))
  const webhookUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/api/delver-webhook'
    return `${window.location.origin}/api/delver-webhook`
  }, [])
  const displayedCards = useMemo(() => [...cards].sort((a, b) => b.position - a.position), [cards])

  useEffect(() => {
    setForm({
      code: box.code,
      name: box.name,
      description: box.description,
      locationNote: box.locationNote,
      delverPollingEndpoint: box.delverPollingEndpoint ?? '',
      delverPollingActive: box.delverPollingActive,
    })
  }, [box.code, box.delverPollingActive, box.delverPollingEndpoint, box.description, box.locationNote, box.name])

  useEffect(() => {
    setSelectedReturnCardIds(cards.map((card) => card.id))
  }, [cards])

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setIsSaving(true)

    try {
      await updateBoxFn({
        data: {
          id: box.id,
          ...form,
        },
      })
      setSuccessMessage('Box settings saved.')
      await router.invalidate()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to update box')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(`Delete ${box.code}? This also removes its indexed cards.`)
    if (!confirmed) return

    setError(null)
    setSuccessMessage(null)
    setIsDeleting(true)

    try {
      await deleteBoxFn({ data: box.id })
      await router.invalidate()
      await navigate({ to: '/boxes' })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to delete box')
      setIsDeleting(false)
    }
  }

  function toggleReturnCard(cardId: string, checked: boolean) {
    setSelectedReturnCardIds((current) => {
      if (checked) {
        return current.includes(cardId) ? current : [...current, cardId]
      }

      return current.filter((id) => id !== cardId)
    })
  }

  async function handleReturnCards(cardIds = selectedReturnCardIds) {
    setError(null)
    setSuccessMessage(null)
    setIsReturningCards(true)

    try {
      const result = await returnCardsFromProjectFn({
        data: {
          sourceBoxId: box.id,
          destinationBoxId: returnDestinationBoxId,
          cardIds,
        },
      })

      await router.invalidate()

      if (result.sourceBoxDeleted) {
        await navigate({ to: '/boxes/$boxId', params: { boxId: result.destinationBoxId } })
        return
      }

      setSuccessMessage(`Returned ${result.movedCardCount} card${result.movedCardCount === 1 ? '' : 's'} to ${result.destinationBoxCode}.`)
      await navigate({ to: '/boxes/$boxId', params: { boxId: box.id } })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to return cards')
    } finally {
      setIsReturningCards(false)
    }
  }

  async function handleRemoveCard(cardId: string, cardName: string) {
    const confirmed = window.confirm(`Remove ${cardName} from ${box.code}? Cards after it will be reindexed.`)
    if (!confirmed) return

    setError(null)
    setSuccessMessage(null)
    setRemovingCardId(cardId)

    try {
      await removeCardFromBoxFn({ data: { boxId: box.id, cardId } })
      setSuccessMessage(`Removed ${cardName}. Following cards were reindexed.`)
      await router.invalidate()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to remove card')
    } finally {
      setRemovingCardId(null)
    }
  }

  async function handleRemoveIndexGaps() {
    setError(null)
    setSuccessMessage(null)
    setIsCompactingIndexes(true)

    try {
      const result = await removeIndexGapsForBoxFn({ data: box.id })
      setSuccessMessage(
        result.movedCount > 0
          ? `Removed index gaps for ${result.movedCount} card${result.movedCount === 1 ? '' : 's'}.`
          : 'No index gaps found in this box.',
      )
      await router.invalidate()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to remove index gaps')
    } finally {
      setIsCompactingIndexes(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link to="/boxes" className="cursor-pointer text-sm text-emerald-700 dark:text-emerald-400">
            ← Back to boxes
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{box.code}</h1>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${isProjectBox ? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
            >
              {isProjectBox ? 'Project box' : 'Storage box'}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {isProjectBox
              ? 'Temporary working box for cards picked out of storage. Return them to a storage box when you are done; empty project boxes clean themselves up.'
              : 'Ordered contents for this box. Hover a card name to preview its image when a Scryfall ID is available.'}
          </p>
        </div>

        {!isProjectBox ? (
          <div className="flex flex-wrap gap-3">
            <Link
              to="/boxes/$boxId/scan"
              params={{ boxId: box.id }}
              className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white"
            >
              Scan cards
            </Link>
            <button
              type="button"
              onClick={handleRemoveIndexGaps}
              disabled={isCompactingIndexes}
              className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium dark:border-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCompactingIndexes ? 'Removing gaps…' : 'Remove index gaps'}
            </button>
          </div>
        ) : null}
      </div>

      {!isProjectBox ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Delver webhook</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Point Delver at this endpoint. New scanned cards will append to this box through its configured polling endpoint.
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                box.delverPollingActive && box.delverPollingEndpoint
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : box.delverPollingEndpoint
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {box.delverPollingActive && box.delverPollingEndpoint
                ? 'Box polling active'
                : box.delverPollingEndpoint
                  ? 'Endpoint configured only'
                  : 'No polling endpoint configured'}
            </span>
          </div>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Webhook endpoint
            </p>
            <code className="mt-2 block break-all rounded-lg border border-slate-300 bg-slate-200 px-3 py-2 text-sm font-medium !text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:!text-slate-100">
              {webhookUrl}
            </code>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Supports POST + OPTIONS for Delver and a simple GET status check in the browser.
            </p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="space-y-6">
          <form
            onSubmit={handleSave}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-lg font-semibold">{isProjectBox ? 'Project box details' : 'Box settings'}</h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Code</span>
                <input
                  value={form.code}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, code: event.target.value }))
                  }
                  disabled={isProjectBox}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                />
                {isProjectBox ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Project box codes are generated automatically and stay locked.
                  </p>
                ) : null}
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Name</span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Location note</span>
                <input
                  value={form.locationNote}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, locationNote: event.target.value }))
                  }
                  disabled={isProjectBox}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                />
                {isProjectBox ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Project boxes do not keep a separate storage location.
                  </p>
                ) : null}
              </label>
              {!isProjectBox ? (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Delver polling endpoint</span>
                  <input
                    value={form.delverPollingEndpoint}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, delverPollingEndpoint: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                    placeholder="Set the box-specific polling endpoint"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Set the endpoint here, then enable box polling below or from the boxes list.
                  </p>
                </label>
              ) : null}

              {!isProjectBox ? (
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.delverPollingActive}
                    disabled={!form.delverPollingEndpoint}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, delverPollingActive: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    Enable polling for this box
                    {!form.delverPollingEndpoint ? ' (set endpoint first)' : ''}
                  </span>
                </label>
              ) : null}
            </div>

            {error ? <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
            {!error && successMessage ? (
              <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">{successMessage}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="cursor-pointer rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900 dark:text-rose-400"
              >
                {isDeleting ? 'Deleting…' : 'Delete box'}
              </button>
            </div>
          </form>

          {isProjectBox ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Return cards</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Send checked cards back into a normal storage box. They will be appended to the
                    end of that box in project-box order.
                  </p>
                </div>
                {cards.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSelectedReturnCardIds(areAllProjectCardsSelected ? [] : allProjectCardIds)}
                    className="cursor-pointer text-sm text-violet-700 dark:text-violet-400"
                  >
                    {areAllProjectCardsSelected ? 'Clear selection' : 'Select all'}
                  </button>
                ) : null}
              </div>

              <label className="mt-4 block text-sm">
                <span className="mb-1 block font-medium">Destination storage box</span>
                <select
                  value={returnDestinationBoxId}
                  onChange={(event) => setReturnDestinationBoxId(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">Choose a storage box…</option>
                  {storageBoxes.map((storageBox) => (
                    <option key={storageBox.id} value={storageBox.id}>
                      {storageBox.code} · {storageBox.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleReturnCards()}
                  disabled={
                    isReturningCards || !returnDestinationBoxId || selectedReturnCardIds.length === 0
                  }
                  className="cursor-pointer rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isReturningCards
                    ? 'Returning…'
                    : `Return ${selectedReturnCardIds.length} selected card${selectedReturnCardIds.length === 1 ? '' : 's'}`}
                </button>
                <button
                  type="button"
                  onClick={() => handleReturnCards(allProjectCardIds)}
                  disabled={isReturningCards || !returnDestinationBoxId || cards.length === 0}
                  className="cursor-pointer rounded-xl border border-violet-300 px-4 py-3 text-sm font-medium text-violet-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-violet-900 dark:text-violet-400"
                >
                  Return all and close project box
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <section className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Cards in this box</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {cards.length} {cards.length === 1 ? 'card' : 'cards'} shown highest index first.
            </p>
          </div>

          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-950/60">
              <tr className="text-left text-sm text-slate-500 dark:text-slate-400">
                {isProjectBox ? <th className="px-4 py-3 font-medium">Return</th> : null}
                <th className="px-4 py-3 font-medium">Position</th>
                <th className="px-4 py-3 font-medium">Card</th>
                <th className="px-4 py-3 font-medium">Set</th>
                <th className="px-4 py-3 font-medium">Finish</th>
                <th className="px-4 py-3 font-medium">Condition</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {displayedCards.length === 0 ? (
                <tr>
                  <td
                    colSpan={isProjectBox ? 7 : 6}
                    className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No cards in this box yet.
                  </td>
                </tr>
              ) : (
                displayedCards.map((card) => {
                  const imageUrl = scryfallImageUrl(card.scryfallId)
                  const checked = selectedReturnCardIds.includes(card.id)

                  return (
                    <tr key={card.id}>
                      {isProjectBox ? (
                        <td className="px-4 py-4 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => toggleReturnCard(card.id, event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                          />
                        </td>
                      ) : null}
                      <td className="px-4 py-4 text-sm font-medium">{card.position}</td>
                      <td className="px-4 py-4 text-sm">
                        <div className="group relative inline-flex items-center">
                          <span className="cursor-default underline decoration-dotted underline-offset-4">
                            {card.name}
                          </span>

                          {imageUrl ? (
                            <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-4 hidden -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl group-hover:block dark:border-slate-800 dark:bg-slate-900">
                              <img
                                src={imageUrl}
                                alt={card.name}
                                className="h-auto w-64 max-w-none rounded-xl"
                                loading="lazy"
                              />
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {card.edition || '—'}
                      </td>
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
                  )
                })
              )}
            </tbody>
          </table>
        </section>
      </section>
    </div>
  )
}
