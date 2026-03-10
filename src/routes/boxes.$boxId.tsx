import { useMemo, useState } from 'react'
import { Link, createFileRoute, notFound, useNavigate, useRouter } from '@tanstack/react-router'
import { listCardsForBoxFn } from '../lib/server/card-actions'
import { deleteBoxFn, getBoxByIdFn, getBoxSettingsFn, setActiveScanningBoxFn, updateBoxFn } from '../lib/server/box-actions'

export const Route = createFileRoute('/boxes/$boxId')({
  loader: async ({ params }) => {
    try {
      const [box, cards, settings] = await Promise.all([
        getBoxByIdFn({ data: params.boxId }),
        listCardsForBoxFn({ data: params.boxId }),
        getBoxSettingsFn(),
      ])

      return { box, cards, settings }
    } catch {
      throw notFound()
    }
  },
  component: BoxDetailPage,
})

function BoxDetailPage() {
  const { box, cards, settings } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    code: box.code,
    name: box.name,
    description: box.description,
    locationNote: box.locationNote,
  })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isTogglingActive, setIsTogglingActive] = useState(false)

  const isActiveScanningBox = settings.activeScanningBoxId === box.id
  const webhookUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/api/delver-webhook'
    return `${window.location.origin}/api/delver-webhook`
  }, [])

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    try {
      await updateBoxFn({
        data: {
          id: box.id,
          ...form,
        },
      })
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

  async function handleToggleActiveScanning() {
    setError(null)
    setIsTogglingActive(true)

    try {
      await setActiveScanningBoxFn({
        data: {
          boxId: isActiveScanningBox ? null : box.id,
        },
      })
      await router.invalidate()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to update scanning box')
    } finally {
      setIsTogglingActive(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link to="/boxes" className="text-sm text-emerald-700 dark:text-emerald-400">
            ← Back to boxes
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{box.code}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Ordered contents for this box. Delver scans append to the end when this is the active scanning box.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleToggleActiveScanning}
            disabled={isTogglingActive}
            className="rounded-xl border border-emerald-300 px-4 py-2.5 text-sm font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900 dark:text-emerald-400"
          >
            {isTogglingActive ? 'Updating…' : isActiveScanningBox ? 'Unset active scanner box' : 'Set as active scanner box'}
          </button>
          <Link
            to="/boxes/$boxId/scan"
            params={{ boxId: box.id }}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white"
          >
            Scan cards
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Delver webhook</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Point Delver at this endpoint. New scanned cards will append to this box only while it is active.
            </p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${isActiveScanningBox ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
            {isActiveScanningBox ? 'Active for scanning' : 'Inactive'}
          </span>
        </div>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Webhook endpoint</p>
          <code className="mt-2 block break-all text-sm">{webhookUrl}</code>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Supports POST + OPTIONS for Delver and a simple GET status check in the browser.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 className="text-lg font-semibold">Box settings</h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Code</span>
              <input
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Name</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Location note</span>
              <input
                value={form.locationNote}
                onChange={(event) => setForm((current) => ({ ...current, locationNote: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
          </div>

          {error ? <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900 dark:text-rose-400"
            >
              {isDeleting ? 'Deleting…' : 'Delete box'}
            </button>
          </div>
        </form>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-950/60">
              <tr className="text-left text-sm text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">Position</th>
                <th className="px-4 py-3 font-medium">Card</th>
                <th className="px-4 py-3 font-medium">Set</th>
                <th className="px-4 py-3 font-medium">Finish</th>
                <th className="px-4 py-3 font-medium">Condition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {cards.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    No cards in this box yet.
                  </td>
                </tr>
              ) : (
                cards.map((card) => (
                  <tr key={card.id}>
                    <td className="px-4 py-4 text-sm font-medium">{card.position}</td>
                    <td className="px-4 py-4 text-sm">{card.name}</td>
                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{card.edition || '—'}</td>
                    <td className="px-4 py-4 text-sm">{card.finish || '—'}</td>
                    <td className="px-4 py-4 text-sm">{card.condition || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </section>
    </div>
  )
}
