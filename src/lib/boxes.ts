export type BoxRecord = {
  id: string
  code: string
  name: string
  description: string
  locationNote: string
  delverPollingEndpoint: string | null
  createdAt: string
  updatedAt: string
  kind: 'storage' | 'project'
  projectNumber: number | null
}

export type BoxSettings = {
  lastWebhookEventAt: string | null
  lastWebhookEventType: string | null
  delverPollingEndpoint: string | null
  delverPollingEnabled: boolean
}

export type CreateBoxInput = {
  code: string
  name: string
  description?: string
  locationNote?: string
  delverPollingEndpoint?: string
}

export type UpdateBoxInput = {
  id: string
  code?: string
  name?: string
  description?: string
  locationNote?: string
  delverPollingEndpoint?: string
}

export type UpdatePollingSettingsInput = {
  delverPollingEndpoint: string
}

export type SetPollingEnabledInput = {
  enabled: boolean
}

export class BoxError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export function normalizeBoxInput(input: CreateBoxInput) {
  const code = input.code.trim()
  const name = input.name.trim()
  const description = input.description?.trim() ?? ''
  const locationNote = input.locationNote?.trim() ?? ''
  const delverPollingEndpoint = input.delverPollingEndpoint?.trim() || null

  if (!code) {
    throw new BoxError('VALIDATION_ERROR', 'Box code is required')
  }

  if (!name) {
    throw new BoxError('VALIDATION_ERROR', 'Box name is required')
  }

  return { code, name, description, locationNote, delverPollingEndpoint }
}
