/**
 * Full Catalog Upload to Constructor (PUT /v1/catalog) with in-memory JSONL.
 * - No filesystem usage (works in Contentful Functions).
 * - Pluggable mapper to transform your source entries -> Constructor items.
 *
 * Manifest tip (Contentful Function):
 *   "allowNetworks": ["ac.cnstrc.com", "*.cnstrc.com"]
 */

import { Buffer } from 'node:buffer'

/* ============================ Public Types ============================ */

export type ConstructorItem = {
  id: string
  name?: string
  suggested_score?: number
  data?: Record<string, unknown>
}

export type FullCatalogUploadOptions = {
  /** Constructor index key (?key=) */
  key: string
  /** Private API token (Basic auth username; password blank) */
  token: string
  /** Section name, e.g. "Content" or "Products" */
  section: string
  /** Set true to allow large invalidations; default false */
  force?: boolean
  /** Client id/version marker, e.g. "contentful-index-app/1.0" */
  c?: string
  /** Email to notify on failure (optional) */
  notification_email?: string
  /** "csv" or "jsonl" (we emit JSONL here) */
  format?: 'jsonl' | 'csv'
}

/**
 * Your source entry type (adjust fields to match your Contentful model).
 * Only the mapper cares about this shape.
 */
export type SourceEntry = {
  sys: { id: string; updatedAt: string; publishedAt?: string | null }
  fields: {
    slug_en?: string
    title_en?: string
    internalName_en?: string
    [k: string]: unknown
  }
  // add more as needed
}

/** Pluggable mapper: convert a SourceEntry -> ConstructorItem */
export type EntryToItemMapper = (entry: SourceEntry) => ConstructorItem | null

/* ============================ Public API ============================ */

/**
 * Build JSONL (one JSON object per line) from entries using the provided mapper.
 * Entries that map to null are skipped.
 */
export function buildItemsJSONL(
  entries: SourceEntry[],
  mapEntryToItem: EntryToItemMapper
): string {
  const lines: string[] = []
  for (const e of entries) {
    const item = mapEntryToItem(e)
    if (!item) continue
    lines.push(JSON.stringify(item))
  }
  return lines.join('\n')
}

/**
 * Upload the full catalog (items only) to Constructor in-memory (multipart/form-data).
 * Returns the API response (should include task_id).
 */
export async function putCatalogInMemory(
  itemsJsonl: string,
  opts: FullCatalogUploadOptions
): Promise<{ task_id?: string; [k: string]: any }> {
  if (!opts?.key) throw new Error('Constructor key is required')
  if (!opts?.token) throw new Error('Constructor token is required')
  if (!opts?.section) throw new Error('Constructor section is required')
  if (!itemsJsonl || itemsJsonl.trim().length === 0) {
    throw new Error('items JSONL must be a non-empty string')
  }

  const format = opts.format ?? 'jsonl'

  // Build query string
  const qs = new URLSearchParams()
  qs.set('key', opts.key)
  qs.set('section', "Content") // e.g., "Content"
  if (typeof opts.force === 'boolean') qs.set('force', String(!!opts.force))
  if (opts.c) qs.set('c', opts.c)
//   if (opts.notification_email) qs.set('notification_email', opts.notification_email)
  if (format) qs.set('format', format) // ensure JSONL if you're sending JSONL

  const url = `https://ac.cnstrc.com/v1/catalog?${qs.toString()}`

  // Build multipart body fully in memory
  const boundary = `----cio-boundary-${Date.now().toString(36)}`
  const chunks: Buffer[] = []

  const appendPart = (field: string, filename: string, contentType: string, data: string | Buffer) => {
    chunks.push(Buffer.from(`--${boundary}\r\n`))
    chunks.push(Buffer.from(`Content-Disposition: form-data; name="${field}"; filename="${filename}"\r\n`))
    chunks.push(Buffer.from(`Content-Type: ${contentType}\r\n\r\n`))
    chunks.push(typeof data === 'string' ? Buffer.from(data) : data)
    chunks.push(Buffer.from(`\r\n`))
  }

  // Only sending items; variations/item_groups can be added similarly if you need them.
  const contentType = format === 'jsonl' ? 'application/jsonl' : 'text/csv'
  const extension = format === 'jsonl' ? 'jsonl' : 'csv'
  appendPart('items', `items.${extension}`, contentType, itemsJsonl)

  chunks.push(Buffer.from(`--${boundary}--\r\n`))
  const body = Buffer.concat(chunks)

  const maskedUrl = url.replace(/([?&]key=)[^&]+/i, '$1***')
  console.log(`[Constructor] PUT ${maskedUrl} (multipart ${body.length} bytes)`)

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Basic ${Buffer.from(`${opts.token}:`).toString('base64')}`,
      Accept: 'application/json',
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body
  })

  const text = await res.text()
  const json = tryJson(text) ?? { raw: text }
  console.log(json)
  if (!res.ok) {
    throw new Error(`Catalog upload failed: ${res.status} ${JSON.stringify(json)}`)
  }
  return json as any
}

/**
 * Poll the background task until it completes or fails.
 * Constructor returns a task id you can query at /v1/tasks/{task_id}.
 */
export async function pollCatalogTask(
  taskId: string,
  token: string,
  intervalMs = 3000
): Promise<any> {
  const url = `https://ac.cnstrc.com/v1/tasks/${encodeURIComponent(taskId)}`
  for (;;) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}`,
        Accept: 'application/json'
      }
    })
    const text = await res.text()
    const json = tryJson(text) ?? { raw: text }

    if (!res.ok) throw new Error(`Task poll failed: ${res.status} ${JSON.stringify(json)}`)

    const status = (json as any).status || (json as any).state
    console.log(`[Constructor] Task ${taskId}: ${status}`)
    if (status === 'completed' || status === 'failed') return json
    await sleep(intervalMs)
  }
}

/* ========================= Default Mapper ========================= */

/**
 * Default example mapper from a Contentful-like entry to a Constructor item.
 * Adjust as needed or pass your own mapper to buildItemsJSONL().
 */
export const defaultEntryToItem: EntryToItemMapper = (entry) => {
  const id = entry.fields.slug_en || entry.sys.id
  if (!id) return null

  return {
    id,
    name: entry.fields.title_en as string | undefined,
    data: {
      contentType: 'projectShowcase',
      sysId: entry.sys.id,
      updatedAt: entry.sys.updatedAt,
      publishedAt: entry.sys.publishedAt ?? null,
      slug_en: entry.fields.slug_en ?? null,
      title_en: entry.fields.title_en ?? null,
      internalName_en: entry.fields.internalName_en ?? null
      // add more fields here if needed
    }
  }
}

/* ============================= Utilities ============================= */

function tryJson(text: string | null) {
  if (!text) return null
  try { return JSON.parse(text) } catch { return null }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
