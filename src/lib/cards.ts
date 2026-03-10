export type CardRecord = {
  id: string
  boxId: string
  position: number
  name: string
  edition: string
  number: string
  finish: string
  condition: string
  language: string
  quantity: number
  delverCardId: number | null
  delverDataCardId: number | null
  delverEditionId: number | null
  scryfallId: string
  uuid: string
  scannedAt: string
  createdAt: string
  updatedAt: string
}

export type DelverWebhookEvent =
  | { type: 'scanner_started' }
  | { type: 'scanner_paused' }
  | { type: 'card_scanned'; cards?: DelverScannedCard[] }

export type DelverScannedCard = {
  cardId?: number
  quantity?: number
  name?: string
  edition?: string
  number?: string
  condition?: string
  language?: string
  editionId?: number
  dataCardId?: number
  scryfallId?: string
  uuid?: string
  finish?: string
}

export type CardSearchResult = CardRecord & {
  boxCode: string
  boxName: string
}

export class CardError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export function normalizeCardName(name: string) {
  return name.trim().toLowerCase()
}
