export type BoxRecord = {
  id: string
  code: string
  name: string
  description: string
  locationNote: string
  createdAt: string
  updatedAt: string
}

export type BoxSettings = {
  activeScanningBoxId: string | null
  lastWebhookEventAt: string | null
  lastWebhookEventType: string | null
}

export type CreateBoxInput = {
  code: string
  name: string
  description?: string
  locationNote?: string
}

export type UpdateBoxInput = {
  id: string
  code?: string
  name?: string
  description?: string
  locationNote?: string
}

export type SetActiveScanningBoxInput = {
  boxId: string | null
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

  if (!code) {
    throw new BoxError('VALIDATION_ERROR', 'Box code is required')
  }

  if (!name) {
    throw new BoxError('VALIDATION_ERROR', 'Box name is required')
  }

  return { code, name, description, locationNote }
}
