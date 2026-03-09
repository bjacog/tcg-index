import { useState } from 'react'
import { Link, createFileRoute, notFound, useNavigate, useRouter } from '@tanstack/react-router'
import { deleteBoxFn, getBoxByIdFn, updateBoxFn } from '../lib/server/box-actions'

export const Route = createFileRoute('/boxes/$boxId')({
  loader: async ({ params }) => {
    try {
      return await getBoxByIdFn({ data: params.boxId })
    } catch {
      throw notFound()
    }
  },
  component: BoxDetailPage,
})

function BoxDetailPage() {
  const box = Route.useLoaderData()
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
    const confirmed = window.confirm(`Delete ${box.code}?`)
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

  const cards: Array<{ position: number; cardName: string; setName: string; finish: string; condition: string }> = []

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link to="/boxes" className="text-sm text-emerald-700 dark:text-emerald-400">
            ← Back to boxes
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{box.code}</h1>
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
            params={{ boxId: box.id }}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white"
          >
            Scan cards
          </Link>
        </div>
      </div>

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
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {cards.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    No cards in this box yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </section>
    </div>
  )
}
