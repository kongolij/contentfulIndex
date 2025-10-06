// Reusable CMA helperss.

export async function getCmaClient(context: any): Promise<any> {
  // Prefer injected client from the function context
  if ((context as any)?.cma) return (context as any).cma;

  // Otherwise create one
  const { createClient } = await import('contentful-management');
  const cmaOpts = (context as any)?.cmaClientOptions;
  if (!cmaOpts) throw new Error('CMA not available in this function context.');
  return createClient(cmaOpts, {
    type: 'plain',
    defaults: { spaceId: context.spaceId, environmentId: context.environmentId },
  });
}

/**
 * Fetch ONE published entry for a content type.
 * - latest=true → newest; latest=false → earliest
 * Mirrors your working handler logic 1:1.
 */
export async function fetchOnePublishedEntry(
  cma: any,
  context: { spaceId: string; environmentId: string },
  contentTypeId: string,
  latest = true
) {
  if (!contentTypeId?.trim()) throw new Error('Missing required parameter: contentTypeId');

  const query: Record<string, string> = {
    content_type: contentTypeId,
    'sys.publishedAt[exists]': 'true',
    'sys.archivedAt[exists]': 'false',
    limit: '1',
    order: latest
      ? '-sys.publishedAt,-sys.updatedAt,-sys.createdAt,sys.id'
      : 'sys.publishedAt,sys.updatedAt,sys.createdAt,sys.id',
    // belt & suspenders:
    'sys.contentType.sys.id': contentTypeId,
  };

  const search = new URLSearchParams(query).toString();
  const path = `/spaces/${context.spaceId}/environments/${context.environmentId}/entries?${search}`;
  const fullUrl = `https://api.contentful.com${path}`;
  console.log('CMA URL:', fullUrl);

  // Try SDK first
  let res: any;
  try {
    res = await cma.entry.getMany({ query });
  } catch (e) {
    console.log('SDK getMany failed, falling back to raw.get():', (e as Error)?.message);
  }

  // Fallback to raw
  if (!res?.items) {
    try {
      res = await (cma as any).raw.get(path);
    } catch (e) {
      console.log('raw.get() failed:', (e as Error)?.message);
      throw e;
    }
  }

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
    return null;
  }

  // For parity with your handler’s logs:
  console.log('ENTRY SYS:', JSON.stringify(item.sys, null, 2));
  console.log('ENTRY FIELDS:', JSON.stringify(item.fields ?? {}, null, 2));
  return item;
}

/**
 * Iterate ALL published entries for a content type (paginated).
 * Uses the same filters/order to stay deterministic.
 */
export async function* iteratePublishedEntries(
  cma: any,
  context: { spaceId: string; environmentId: string },
  contentTypeId: string,
  cap?: number
) {
  let skip = 0;
  const limit = 200; // safe batch size
  let fetched = 0;

  for (;;) {
    const query: Record<string, string> = {
      content_type: contentTypeId,
      'sys.contentType.sys.id': contentTypeId,
      'sys.publishedAt[exists]': 'true',
      'sys.archivedAt[exists]': 'false',
      limit: String(limit),
      skip: String(skip),
      order: 'sys.publishedAt,sys.updatedAt,sys.createdAt,sys.id', // stable ascending
    };

    let page: any;
    try {
      page = await cma.entry.getMany({ query });
    } catch {
      const search = new URLSearchParams(query).toString();
      const path = `/spaces/${context.spaceId}/environments/${context.environmentId}/entries?${search}`;
      page = await (cma as any).raw.get(path);
    }

    const items: any[] = Array.isArray(page?.items) ? page.items : [];
    if (!items.length) break;

    for (const it of items) {
      if (cap && fetched >= cap) return;
      if (it?.sys?.contentType?.sys?.id === contentTypeId && it?.sys?.publishedAt) {
        fetched++;
        yield it;
      }
    }

    const total = page?.total ?? skip + items.length;
    skip += items.length;
    if (skip >= total) break;
  }
}
