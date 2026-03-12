import { useMemo, useState } from 'react'
import { Link, createFileRoute, notFound, useNavigate, useRouter } from '@tanstack/react-router'
import { pickCardsIntoProjectFn } from '../lib/server/card-actions'
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
  const navigate = useNavigate()
  const router = useRouter()
  const rerunQuery = pickList.requestedCards.join('\n')
  const selectableCardIds = useMemo(
    () => pickList.resultSnapshot.flatMap((boxGroup) => boxGroup.cards.map((card) => card.cardId)),
    [pickList.resultSnapshot],
  )
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>(selectableCardIds)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPicking, setIsPicking] = useState(false)
  const isPicked = Boolean(pickList.pickedAt)

  function toggleCard(cardId: string, checked: boolean) {
    setSelectedCardIds((current) => {
      if (checked) {
        return current.includes(cardId) ? current : [...current, cardId]
      }

      return current.filter((id) => id !== cardId)
    })
  }

  async function handlePickSelectedCards() {
    if (isPicked) {
      return
    }

    setError(null)
    setSuccessMessage(null)
    setIsPicking(true)

    try {
      const result = await pickCardsIntoProjectFn({
        data: {
          pickListId: pickList.id,
          cardIds: selectedCardIds,
        },
      })

      setSuccessMessage(
        `Moved ${result.movedCardCount} card${result.movedCardCount === 1 ? '' : 's'} into ${result.projectBoxCode}.`,
      )
      await router.invalidate()
      await navigate({ to: '/boxes/$boxId', params: { boxId: result.projectBoxId } })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to pick cards')
    } finally {
      setIsPicking(false)
    }
  }

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
          {isPicked ? (
            <p className="mt-2 text-sm text-violet-700 dark:text-violet-400">
              Already picked {pickList.pickedAt ? new Date(pickList.pickedAt).toLocaleString() : ''}.
            </p>
          ) : null}
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pick into new project box</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {isPicked
                ? 'This pick list has already been used. You can still open the project box and return cards from there.'
                : 'Select the cards you want to move out of storage and into a fresh project box.'}
            </p>
          </div>
          {isPicked && pickList.projectBoxId ? (
            <Link
              to="/boxes/$boxId"
              params={{ boxId: pickList.projectBoxId }}
              className="rounded-xl border border-violet-300 px-4 py-2.5 text-sm font-medium text-violet-700 dark:border-violet-900 dark:text-violet-400"
            >
              Open project box
            </Link>
          ) : (
            <button
              type="button"
              onClick={handlePickSelectedCards}
              disabled={isPicked || isPicking || selectedCardIds.length === 0}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPicking
                ? 'Picking…'
                : `Pick ${selectedCardIds.length} selected card${selectedCardIds.length === 1 ? '' : 's'}`}
            </button>
          )}
        </div>

        {error ? <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
        {successMessage ? (
          <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">{successMessage}</p>
        ) : null}
      </section>

      <section className="space-y-4">
        {pickList.resultSnapshot.map((boxGroup) => (
          <section
            key={boxGroup.boxId}
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
              {boxGroup.cards.map((card) => {
                const checked = selectedCardIds.includes(card.cardId)

                return (
                  <label
                    key={card.cardId}
                    className={`flex items-center gap-4 px-4 py-4 ${
                      isPicked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isPicked}
                      onChange={(event) => toggleCard(card.cardId, event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="min-w-20 text-2xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
                      #{card.position}
                    </div>
                    <div className="text-sm font-medium">{card.name}</div>
                  </label>
                )
              })}
            </div>
          </section>
        ))}
      </section>
    </div>
  )
}
