// src/lib/contentfulGql.ts
type GqlOk = { ok: true; data: any };
type GqlErr = { ok: false; status?: number; error: string; body?: any };
export type GqlRes = GqlOk | GqlErr;

function endpoint(spaceId: string, environmentId: string) {
  return `https://graphql.contentful.com/content/v1/spaces/${spaceId}/environments/${environmentId}`;
}


export async function gqlFetch(
  spaceId: string,
  environmentId: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<GqlRes> {

  const url = endpoint(spaceId, environmentId);


  const res = await fetch(endpoint(spaceId, environmentId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const bodyText = await res.text();
  const body = safeJson(bodyText) ?? bodyText;

  if (!res.ok) return { ok: false, status: res.status, error: 'HTTP error', body };
  if ((body as any)?.errors?.length) return { ok: false, error: 'GraphQL error', body };

  return { ok: true, data: (body as any).data };
}

function safeJson(t?: string) {
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}

export async function fetchLatestEntryByContentType(opts: {
  spaceId: string;
  environmentId: string;
  accessToken: string;
  contentTypeId: string;
  locale?: string;
  extraFields?: string;
}): Promise<any | null> {
  const { spaceId, environmentId, accessToken, contentTypeId, locale, extraFields } = opts;
  const coll = `${contentTypeId}Collection`;

  const query = `
    query Latest($locale: String) {
      ${coll}(limit: 1, order: sys_publishedAt_DESC, locale: $locale) {
        items {
          sys { id publishedAt updatedAt firstPublishedAt }
          __typename
          ${extraFields ? extraFields : ''}
        }
      }
    }
  `;

  const variables = { locale: locale ?? null };
  const res = await gqlFetch(spaceId, environmentId, accessToken, query, variables);
  if (!res.ok) {
    console.log('GraphQL fetch failed:', res.status, res.error, res.body);
    throw new Error('GraphQL fetch failed');
  }

  const items = res.data?.[coll]?.items ?? [];
  return items[0] || null;
}

//  force explicit module exports (helps TS avoid “not a module”)
export type { GqlOk, GqlErr };
export { endpoint };
