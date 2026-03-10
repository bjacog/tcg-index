import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { BoxRecord } from '../boxes'
import type { CardRecord } from '../cards'

export type AppStore = {
  boxes: BoxRecord[]
  cards: CardRecord[]
  settings: {
    activeScanningBoxId: string | null
    lastWebhookEventAt: string | null
    lastWebhookEventType: string | null
  }
}

const dataDirectory = path.resolve(process.cwd(), 'data')
const dataFilePath = path.join(dataDirectory, 'boxes.json')

function normalizeStoreShape(input: unknown): AppStore {
  const parsed = (input ?? {}) as Partial<AppStore> & { boxes?: unknown; cards?: unknown; settings?: unknown }
  const rawSettings = (parsed.settings ?? {}) as Partial<AppStore['settings']>

  return {
    boxes: Array.isArray(parsed.boxes) ? (parsed.boxes as BoxRecord[]) : [],
    cards: Array.isArray(parsed.cards) ? (parsed.cards as CardRecord[]) : [],
    settings: {
      activeScanningBoxId: rawSettings.activeScanningBoxId ?? null,
      lastWebhookEventAt: rawSettings.lastWebhookEventAt ?? null,
      lastWebhookEventType: rawSettings.lastWebhookEventType ?? null,
    },
  }
}

export async function ensureStore(): Promise<AppStore> {
  await mkdir(dataDirectory, { recursive: true })

  try {
    const raw = await readFile(dataFilePath, 'utf8')
    const parsed = JSON.parse(raw)
    const store = normalizeStoreShape(parsed)
    await saveStore(store)
    return store
  } catch {
    const emptyStore = normalizeStoreShape(null)
    await saveStore(emptyStore)
    return emptyStore
  }
}

export async function saveStore(store: AppStore) {
  await writeFile(dataFilePath, JSON.stringify(store, null, 2) + '\n', 'utf8')
}
