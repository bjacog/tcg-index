export type PickListHistoryRecord = {
  id: string
  createdAt: string
  requestedCards: string[]
  missingCards: string[]
  resultSnapshot: PickListBoxGroup[]
}

export type PickListBoxGroup = {
  boxId: string
  boxCode: string
  boxName: string
  box: string
  cards: PickListCardEntry[]
}

export type PickListCardEntry = {
  cardId: string
  boxId: string
  name: string
  position: number
}

export type PickExecutionResult = {
  projectBoxId: string
  projectBoxCode: string
  projectBoxName: string
  movedCardCount: number
}

export type ReturnCardsInput = {
  sourceBoxId: string
  destinationBoxId: string
  cardIds: string[]
}

export type ReturnCardsResult = {
  sourceBoxId: string
  sourceBoxDeleted: boolean
  destinationBoxId: string
  destinationBoxCode: string
  movedCardCount: number
}

export type PickCardsInput = {
  pickListId: string
  cardIds: string[]
}

export type DashboardStats = {
  boxCount: number
  indexedCardCount: number
  uniqueCardNameCount: number
  pickListCount: number
}
