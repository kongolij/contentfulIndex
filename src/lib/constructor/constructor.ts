/**
 * Constructor.io client — PATCH-only (v2/items)
 * - Updates (merges) existing items.
 * - Returns the API response (often a background task identifier).
 *
 * Usage:
 *   const res = await patchItems(
 *     { items: [{ id: "my-id", name: "Nice name", data: { active: true } }] },
 *     { key, token, section: "Products", force: true }
 *   );
 */

import { Buffer } from 'node:buffer'

export type PatchItemsOptions = {
  /** Required: The Constructor index key (?key=) */
  key: string;

  /** Required: Private API token used for HTTP Basic auth */
  token: string;

  /** Optional: Section of the index (?section=), defaults to "Products" if omitted on server */
  section?: string;

  /** Optional: Force processing even if large invalidations (?force=true|false) */
  force?: boolean;

  /** Optional: Client id/version (?c=cio-js-2.90) */
  c?: string;

  /** Optional: Send failure notifications (?notification_email=) */
  notification_email?: string;

  /**
   * Optional: Strategy for items missing in the index (only valid when using patch delta semantics).
   * Allowed: 'CREATE' | 'IGNORE' | 'FAIL'
   * NOTE: Only effective if you also set patch_delta: true
   */
  on_missing?: 'CREATE' | 'IGNORE' | 'FAIL';

  /**
   * Optional: Enable patch delta semantics (?patch_delta=true)
   * When true, on_missing can be used to control behavior for unknown IDs.
   */
  patch_delta?: boolean;

  /**
   * Optional: If true, request is validated but not executed (if supported by your tenant).
   * Kept here for forward-compat even if not universally available.
   */
  dry_run?: boolean;
};

export type PatchItemsPayload = {
  items: Array<{
    /** Required per item: unique id */
    id: string;
    /** Optional: display name */
    name?: string;
    /** Optional: initial ranking influence */
    suggested_score?: number;
    /** Optional: arbitrary metadata (facets, fields, etc.) */
    data?: Record<string, unknown>;
  }>;
};

export type ConstructorSuccess =
  | { ok: true; status: number; body: unknown };

export type ConstructorFailure =
  | { ok: false; status: number; body: unknown }
  | { ok: false; error: string };

export type ConstructorResponse = ConstructorSuccess | ConstructorFailure;

/* -------------------------------------------------------------------------- */
/*                               Public Function                               */
/* -------------------------------------------------------------------------- */

/** PATCH /v2/items — merge updates into existing items */
export async function patchItems(
  payload: PatchItemsPayload,
  opts: PatchItemsOptions
): Promise<ConstructorResponse> {
  if (!opts?.key) throw new Error('Constructor key is required');
  if (!opts?.token) throw new Error('Constructor token is required');
  if (!payload?.items?.length) throw new Error('payload.items must be a non-empty array');

  
  const force   =  true;

  const qs = new URLSearchParams();
  qs.set('key', opts.key);
  qs.set('section', 'Content');     // always "Content" unless overridden
  qs.set('force', String(!!force));            // always true unless overridden

  if (opts.c) qs.set('c', opts.c);
  if (opts.notification_email) qs.set('notification_email', opts.notification_email);
  if (typeof opts.patch_delta === 'boolean') qs.set('patch_delta', String(!!opts.patch_delta));
  if (opts.on_missing) qs.set('on_missing', opts.on_missing);
  if (typeof opts.dry_run === 'boolean') qs.set('dry_run', String(!!opts.dry_run));

  const url = `https://ac.cnstrc.com/v2/items?${qs.toString()}`;



  return cioRequest('PATCH', url, opts.token, payload);
}

/* -------------------------------------------------------------------------- */
/*                                Internal Core                                */
/* -------------------------------------------------------------------------- */

async function cioRequest(
  method: 'PATCH',
  url: string,
  token: string,
  payload: unknown
): Promise<ConstructorResponse> {
  const headers = {
    Authorization: buildBasicAuth(token),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  } as const;

  // Simple bounded retries for 429/5xx
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const text = await res.text();
      const body = safeJson(text) ?? text;

      if (res.ok) {
        return { ok: true, status: res.status, body };
      }

      // Retry on rate-limit/server errors
      if (res.status === 429 || res.status >= 500) {
        await sleep(backoffMs(attempt));
        continue;
      }

      return { ok: false, status: res.status, body };
    } catch (err: any) {
      // Network/timeout; retry unless last attempt
      if (attempt === 3) {
        return { ok: false, error: String(err?.message || err) };
      }
      await sleep(backoffMs(attempt));
    }
  }

  return { ok: false, error: 'Unknown error' };
}

/* -------------------------------------------------------------------------- */
/*                                   Utils                                     */
/* -------------------------------------------------------------------------- */

function buildBasicAuth(token: string): string {
  // Username is the token, password blank per Constructor docs (token:)
  const base64 = Buffer.from(`${token}:`).toString('base64');
  return `Basic ${base64}`;
}

function safeJson(text: string | null) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  // 300ms, 1200ms, 2700ms (quadratic-ish)
  return 300 * attempt * attempt;
}
