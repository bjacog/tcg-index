import { useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import {
  createBoxFn,
  getBoxSettingsFn,
  listBoxesFn,
  setPollingEnabledFn,
  stopScanningFn,
  updatePollingSettingsFn,
  updateBoxFn,
} from '../lib/server/box-actions'

export const Route = createFileRoute('/boxes/')({
  loader: async () => {
    const [boxes, settings] = await Promise.all([listBoxesFn(), getBoxSettingsFn()])
    return { boxes, settings }
  },
  component: BoxesPage,
})

function shortenEndpoint(endpoint: string | null, maxLength = 48) {
  if (!endpoint) {
    return '—'
  }

  if (endpoint.length <= maxLength) {
    return endpoint
  }

  const prefixLength = Math.max(20, Math.floor((maxLength - 1) * 0.6))
  const suffixLength = Math.max(10, maxLength - prefixLength - 1)
  return `${endpoint.slice(0, prefixLength)}…${endpoint.slice(-suffixLength)}`
}

function BoxesPage() {
  const { boxes, settings } = Route.useLoaderData()
  const router = useRouter()
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    locationNote: '',
    delverPollingEndpoint: settings.delverPollingEndpoint ?? '',
  })
  const [defaultPollingEndpoint, setDefaultPollingEndpoint] = useState(
    settings.delverPollingEndpoint ?? '',
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingPollingEndpoint, setIsSavingPollingEndpoint] = useState(false)
  const [isStoppingScanning, setIsStoppingScanning] = useState(false)
  const [isStartingScanning, setIsStartingScanning] = useState(false)
  const [isApplyingDefaultToBoxId, setIsApplyingDefaultToBoxId] = useState<string | null>(null)
  const [isTogglingBoxPollingId, setIsTogglingBoxPollingId] = useState<string | null>(null)
  const [pollStatus, setPollStatus] = useState<string | null>(null)

  const storageBoxes = useMemo(() => boxes.filter((box) => box.kind === 'storage'), [boxes])
  const activeScanningBoxes = useMemo(
    () => storageBoxes.filter((box) => box.delverPollingActive && box.delverPollingEndpoint),
    [storageBoxes],
  )

  useEffect(() => {
    setDefaultPollingEndpoint(settings.delverPollingEndpoint ?? '')
    setForm((current) => ({
      ...current,
      delverPollingEndpoint: current.delverPollingEndpoint || settings.delverPollingEndpoint || '',
    }))
  }, [settings.delverPollingEndpoint])

  useEffect(() => {
    if (!settings.delverPollingEnabled || activeScanningBoxes.length === 0) {
      setPollStatus(null)
      return
    }

    if (window.tcgIndexDesktop?.isElectron) {
      return window.tcgIndexDesktop.onPollingStatus(async (result) => {
        if (!result.ok) {
          setPollStatus(result.message ?? 'Polling failed')
          return
        }

        const scannedResults = (result.boxResults ?? []).filter(
          (entry) => entry.type === 'card_scanned',
        )

        if (scannedResults.length > 0) {
          const summary = scannedResults
            .map(
              (entry) =>
                `${entry.boxCode}: ${entry.ingested ?? 0} card${entry.ingested === 1 ? '' : 's'}`,
            )
            .join(' · ')
          setPollStatus(`Received scans — ${summary}`)
          await router.invalidate()
        } else if (result.empty) {
          setPollStatus(
            `Waiting for scans on ${activeScanningBoxes.length} active box${activeScanningBoxes.length === 1 ? '' : 'es'}…`,
          )
        } else {
          setPollStatus('Received scanner event')
          await router.invalidate()
        }
      })
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    async function loop() {
      try {
        const response = await fetch('/api/delver-poll', { method: 'POST' })
        const result = (await response.json()) as {
          ok: boolean
          empty?: boolean
          boxResults?: Array<{
            boxCode?: string
            type?: string
            ingested?: number
          }>
          message?: string
        }

        if (cancelled) return

        if (!response.ok || !result.ok) {
          setPollStatus(result.message ?? 'Polling failed')
          timeoutId = setTimeout(loop, 3000)
          return
        }

        const scannedResults = (result.boxResults ?? []).filter(
          (entry) => entry.type === 'card_scanned',
        )

        if (scannedResults.length > 0) {
          const summary = scannedResults
            .map(
              (entry) =>
                `${entry.boxCode}: ${entry.ingested ?? 0} card${entry.ingested === 1 ? '' : 's'}`,
            )
            .join(' · ')
          setPollStatus(`Received scans — ${summary}`)
          await router.invalidate()
        } else if (result.empty) {
          setPollStatus(
            `Waiting for scans on ${activeScanningBoxes.length} active box${activeScanningBoxes.length === 1 ? '' : 'es'}…`,
          )
        } else {
          setPollStatus('Received scanner event')
          await router.invalidate()
        }

        timeoutId = setTimeout(loop, result.empty ? 250 : 750)
      } catch (caughtError) {
        if (cancelled) return
        setPollStatus(caughtError instanceof Error ? caughtError.message : 'Polling failed')
        timeoutId = setTimeout(loop, 3000)
      }
    }

    void loop()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [router, activeScanningBoxes, settings.delverPollingEnabled])

  async function handleCreateBox(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await createBoxFn({ data: form })
      setForm({
        code: '',
        name: '',
        description: '',
        locationNote: '',
        delverPollingEndpoint: defaultPollingEndpoint,
      })
      await router.invalidate()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create box')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSavePollingEndpoint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSavingPollingEndpoint(true)
    try {
      await updatePollingSettingsFn({ data: { delverPollingEndpoint: defaultPollingEndpoint } })
      await router.invalidate()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Failed to save polling endpoint',
      )
    } finally {
      setIsSavingPollingEndpoint(false)
    }
  }

  async function handleStartScanning() {
    setError(null)
    setIsStartingScanning(true)
    try {
      await setPollingEnabledFn({ data: { enabled: true } })
      await router.invalidate()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to start scanning')
    } finally {
      setIsStartingScanning(false)
    }
  }

  async function handleApplyDefaultEndpoint(boxId: string) {
    setError(null)
    setIsApplyingDefaultToBoxId(boxId)
    try {
      await updateBoxFn({
        data: {
          id: boxId,
          delverPollingEndpoint: defaultPollingEndpoint,
        },
      })
      await router.invalidate()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to update box endpoint')
    } finally {
      setIsApplyingDefaultToBoxId(null)
    }
  }

  async function handleToggleBoxPolling(boxId: string, nextActive: boolean) {
    setError(null)
    setIsTogglingBoxPollingId(boxId)
    try {
      await updateBoxFn({
        data: {
          id: boxId,
          delverPollingActive: nextActive,
        },
      })
      await router.invalidate()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to update box polling')
    } finally {
      setIsTogglingBoxPollingId(null)
    }
  }

  async function handleStopScanning() {
    setError(null)
    setIsStoppingScanning(true)
    try {
      await stopScanningFn()
      setPollStatus(null)
      await router.invalidate()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to stop scanning')
    } finally {
      setIsStoppingScanning(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
            Boxes
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Manage boxes</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Create, inspect, and maintain ordered storage boxes, plus temporary project boxes for
            picked cards.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div>
                <span className="font-medium">Active polling boxes:</span>{' '}
                {activeScanningBoxes.length === 0
                  ? 'None selected'
                  : activeScanningBoxes.map((box) => box.code).join(', ')}
              </div>
              <div>
                <span className="font-medium">Polling:</span>{' '}
                {settings.delverPollingEnabled ? 'Running' : 'Stopped'}
              </div>
              <div>
                <span className="font-medium">Default endpoint:</span>{' '}
                {settings.delverPollingEndpoint || 'Not configured'}
              </div>
              {pollStatus ? (
                <div className="text-slate-600 dark:text-slate-300">
                  <span className="font-medium">Status:</span> {pollStatus}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleStartScanning}
                disabled={
                  settings.delverPollingEnabled ||
                  activeScanningBoxes.length === 0 ||
                  isStartingScanning
                }
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isStartingScanning ? 'Starting…' : 'Start scanning'}
              </button>
              <button
                type="button"
                onClick={handleStopScanning}
                disabled={!settings.delverPollingEnabled || isStoppingScanning}
                className="rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900 dark:text-rose-400"
              >
                {isStoppingScanning ? 'Stopping…' : 'Stop scanning'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="space-y-6">
          <form
            onSubmit={handleCreateBox}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-lg font-semibold">Create box</h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Code</span>
                <input
                  value={form.code}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, code: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                  placeholder="BOX-001"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Name</span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                  placeholder="Commander Staples"
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
                  placeholder="Optional notes"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Location note</span>
                <input
                  value={form.locationNote}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, locationNote: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                  placeholder="Shelf 2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Delver polling endpoint</span>
                <input
                  value={form.delverPollingEndpoint}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, delverPollingEndpoint: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                  placeholder="Uses the saved default when left as-is"
                />
              </label>
            </div>
            {error ? (
              <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Creating…' : 'Create box'}
            </button>
          </form>

          <form
            onSubmit={handleSavePollingEndpoint}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-lg font-semibold">Default Delver polling endpoint</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Save a default endpoint to prefill new boxes. Each box can still override it.
            </p>
            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium">Endpoint URL</span>
              <input
                value={defaultPollingEndpoint}
                onChange={(event) => setDefaultPollingEndpoint(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
                placeholder="https://api.delver.app/webhook/..."
              />
            </label>
            <button
              type="submit"
              disabled={isSavingPollingEndpoint}
              className="mt-4 w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900 dark:text-emerald-400"
            >
              {isSavingPollingEndpoint ? 'Saving…' : 'Save default endpoint'}
            </button>
          </form>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-950/60">
              <tr className="text-left text-sm text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Endpoint</th>
                <th className="px-4 py-3 font-medium">Scanner</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {boxes.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No boxes yet. Create the first one on the left.
                  </td>
                </tr>
              ) : (
                boxes.map((box) => {
                  const isProjectBox = box.kind === 'project'
                  const isConfigured = Boolean(box.delverPollingEndpoint)
                  const isActive = Boolean(box.delverPollingActive && box.delverPollingEndpoint)

                  return (
                    <tr key={box.id}>
                      <td className="px-4 py-4 text-sm font-medium">{box.code}</td>
                      <td className="px-4 py-4 text-sm">{box.name}</td>
                      <td className="px-4 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${isProjectBox ? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
                        >
                          {isProjectBox ? 'Project' : 'Storage'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {box.locationNote || '—'}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-300">
                        {isProjectBox ? (
                          <span className="text-slate-500 dark:text-slate-400">—</span>
                        ) : box.delverPollingEndpoint ? (
                          <code
                            title={box.delverPollingEndpoint}
                            className="inline-block break-all rounded border px-2 py-1 font-medium"
                            style={{
                              backgroundColor: '#e2e8f0',
                              borderColor: '#cbd5e1',
                              color: '#020617',
                            }}
                          >
                            {shortenEndpoint(box.delverPollingEndpoint)}
                          </code>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {isProjectBox ? (
                          <span className="text-slate-500 dark:text-slate-400">Not available</span>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                                  isActive
                                    ? settings.delverPollingEnabled
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {isActive
                                  ? settings.delverPollingEnabled
                                    ? 'Active + polling'
                                    : 'Active'
                                  : isConfigured
                                    ? 'Configured only'
                                    : 'Not configured'}
                              </span>
                              {!isConfigured && defaultPollingEndpoint ? (
                                <button
                                  type="button"
                                  onClick={() => handleApplyDefaultEndpoint(box.id)}
                                  disabled={isApplyingDefaultToBoxId === box.id}
                                  className="rounded-xl border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900 dark:text-emerald-400"
                                >
                                  {isApplyingDefaultToBoxId === box.id
                                    ? 'Applying…'
                                    : 'Use default endpoint'}
                                </button>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleBoxPolling(box.id, !isActive)}
                              disabled={!isConfigured || isTogglingBoxPollingId === box.id}
                              className="w-fit rounded-xl border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900 dark:text-emerald-400"
                            >
                              {isTogglingBoxPollingId === box.id
                                ? 'Updating…'
                                : isActive
                                  ? 'Disable box polling'
                                  : 'Enable box polling'}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <div className="flex flex-wrap gap-3">
                          <Link
                            to="/boxes/$boxId"
                            params={{ boxId: box.id }}
                            className="text-emerald-700 dark:text-emerald-400"
                          >
                            Open
                          </Link>
                          {!isProjectBox ? (
                            <Link
                              to="/boxes/$boxId/scan"
                              params={{ boxId: box.id }}
                              className="text-slate-600 dark:text-slate-300"
                            >
                              Scan
                            </Link>
                          ) : null}
                        </div>
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
