import type { FunctionEventHandler } from '@contentful/node-apps-toolkit';
import { FunctionTypeEnum } from '@contentful/node-apps-toolkit';

type Params = {
  contentTypeId?: string;
  pageSize?: number; // ignored — single-entry mode
  latest?: boolean;  // choose latest (true) or earliest (false)
};

export const handler: FunctionEventHandler<FunctionTypeEnum.AppActionCall> = async (
  event,
  context
) => {
  const params = ((event as any)?.body?.parameters ?? (event as any)?.body ?? {}) as Params;
  const contentTypeId = (params.contentTypeId || '').trim();

  // Force latest for now (or use a robust parser if you want to read from params.latest)
  const latest = true;

  console.log('event.type:', (event as any)?.type);
  console.log('params:', JSON.stringify({ contentTypeId, latest }));

  if (!contentTypeId) throw new Error('Missing required parameter: contentTypeId');

  // --- CMA client (prefer injected from context)
  let cma: any = (context as any)?.cma;
  if (!cma) {
    const { createClient } = await import('contentful-management');
    const cmaOpts = (context as any)?.cmaClientOptions;
    if (!cmaOpts) throw new Error('CMA not available in this function context.');
    cma = createClient(cmaOpts, {
      type: 'plain',
      defaults: { spaceId: context.spaceId, environmentId: context.environmentId },
    });
  }

  // --- Build deterministic query (published-only + order + type filter)
  const query: Record<string, string> = {
    // CMA often honors this, but we’ll also add the sys-path filter for safety:
    content_type: contentTypeId,

    // Published only, not archived
    'sys.publishedAt[exists]': 'true',
    'sys.archivedAt[exists]': 'false',

    // Single item
    limit: '1',

    // Deterministic “latest/earliest” by publish timestamp with tie-breakers
    order: latest
      ? '-sys.publishedAt,-sys.updatedAt,-sys.createdAt,sys.id'
      : 'sys.publishedAt,sys.updatedAt,sys.createdAt,sys.id',
  };

  // Add sys-path filter, too (belt & suspenders)
  // Note: using the non-[in] variant is fine for a single ID.
  query['sys.contentType.sys.id'] = contentTypeId;

  // --- Construct raw URL (so we can log exactly what’s sent)
  const search = new URLSearchParams(query).toString();
  const path = `/spaces/${context.spaceId}/environments/${context.environmentId}/entries?${search}`;
  const fullUrl = `https://api.contentful.com${path}`;
  console.log('CMA URL:', fullUrl);

  // --- Try SDK first
  let res: any;
  try {
    res = await cma.entry.getMany({ query });
  } catch (e) {
    console.log('SDK getMany failed, falling back to raw.get():', (e as Error)?.message);
  }

  // --- If SDK failed or seems wrong, try raw GET (bypass SDK param shaping)
  if (!res?.items) {
    try {
      res = await (cma as any).raw.get(path);
    } catch (e) {
      console.log('raw.get() failed:', (e as Error)?.message);
      throw e;
    }
  }

  // --- Defensive: ensure we only keep the exact content type requested
  const items: any[] = Array.isArray(res?.items) ? res.items : [];
  const filtered = items.filter(
    (it) => it?.sys?.contentType?.sys?.id === contentTypeId && !!it?.sys?.publishedAt
  );

  const item = filtered[0] ?? null;

  if (!item) {
    const total = typeof res?.total === 'number' ? res.total : items.length;
    const firstType = items[0]?.sys?.contentType?.sys?.id;
    const msg = `No published entries of type "${contentTypeId}" found. (total=${total}, firstType=${firstType || 'n/a'})`;
    console.log(msg);
    return { ok: true, message: msg, meta: { contentTypeId, latest } };
  }

  console.log('ENTRY SYS:', JSON.stringify(item.sys, null, 2));
  console.log('ENTRY FIELDS:', JSON.stringify(item.fields ?? {}, null, 2));

  return {
    ok: true,
    message: `Fetched 1 ${latest ? 'latest' : 'earliest'} published entry for "${contentTypeId}".`,
    entry: {
      sys: item.sys,
      fields: item.fields,
    },
  };
};
