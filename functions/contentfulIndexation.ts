// functions/contentfulIndexation.ts
import type { FunctionEventHandler } from '@contentful/node-apps-toolkit';
import { FunctionTypeEnum } from '@contentful/node-apps-toolkit';

import { putCatalogInMemory } from '../src/lib/constructor/constructorCatalog';
import { loadContentfulGqlCreds, loadConstructorCredsFromContextOrEnv } from '../src/utils/creds';
import { getIndexer } from '../src/lib/indexers/registry';

type Params = {
  contentTypeId?: string;    // which content type to index (e.g. 'projectShowcase')
  section?: string;          // optional Constructor section override
  constructorToken?: string; // optional dev override (if your creds loader supports it)
};

type ConstructorCreds = { key: string; token: string; section?: string };

export const handler: FunctionEventHandler<FunctionTypeEnum.AppActionCall> = async (event, context) => {
  const params = ((event as any)?.body?.parameters ?? (event as any)?.body ?? {}) as Params;

  console.log('[contentfulIndexation] raw params:', JSON.stringify(params));
  // Pick indexer by content type (default to projectShowcase)
  const indexer = getIndexer(params.contentTypeId);
  if (!indexer) {
    return {
      ok: false,
      message: `Unsupported contentTypeId: ${params.contentTypeId ?? '(none)'}`
    };
  }

  // creds (EN + FR) + Contentful GQL
  const { en, fr } = loadConstructorCredsFromContextOrEnv(context, {
    section: params.section,
    constructorToken: params.constructorToken,
  });
  const { token: gqlToken } = loadContentfulGqlCreds(context);

  const PAGE_SIZE = 50;

  // ---------- page ALL entries (single pass) ----------
  let skip = 0;
  let total = 0;
  const allEntries: any[] = [];

  while (true) {
    const page = await indexer.fetchPage({
      spaceId: context.spaceId,
      environmentId: context.environmentId,
      accessToken: gqlToken,
      limit: PAGE_SIZE,
      skip,
    });

    const items = Array.isArray(page?.items) ? page.items : [];
    if (skip === 0) total = page?.total ?? items.length;

    allEntries.push(...items);
    if (allEntries.length >= total || items.length === 0) break;
    skip += PAGE_SIZE;
  }

  if (allEntries.length === 0) {
    return {
      ok: true,
      message: `No ${indexer.id} items found from GraphQL.`,
      meta: { contentTypeId: indexer.id, total: 0 },
    };
  }

  // ---------- build per-locale JSONL ----------
  const enItems = allEntries.map((e) => indexer.map(indexer.normalizeForLocale(e, 'en')));
  const frItems = allEntries.map((e) => indexer.map(indexer.normalizeForLocale(e, 'fr')));

  const enJsonl = enItems.map((it) => JSON.stringify(it)).join('\n');
  const frJsonl = frItems.map((it) => JSON.stringify(it)).join('\n');

  const sectionEn = params.section || en.section || 'Content';
  const sectionFr = params.section || fr.section || 'Content';

  const enUpload = enItems.length
    ? await putCatalogInMemory(enJsonl, {
        key: en.key,
        token: en.token,
        section: sectionEn,
        format: 'jsonl',
        force: true,
        c: 'contentful-index-app/1.0',
      })
    : undefined;

  const frUpload = frItems.length
    ? await putCatalogInMemory(frJsonl, {
        key: fr.key,
        token: fr.token,
        section: sectionFr,
        format: 'jsonl',
        force: true,
        c: 'contentful-index-app/1.0',
      })
    : undefined;

  return {
    ok: true,
    message: `Indexed ${enItems.length} EN and ${frItems.length} FR ${indexer.id} items to Constructor.`,
    meta: {
      spaceId: context.spaceId,
      environmentId: context.environmentId,
      pageSize: PAGE_SIZE,
      totalQueried: total,
      contentTypeId: indexer.id,
    },
    result: {
      en: { uploaded: enItems.length, section: sectionEn, taskId: (enUpload as any)?.task_id || (enUpload as any)?.id },
      fr: { uploaded: frItems.length, section: sectionFr, taskId: (frUpload as any)?.task_id || (frUpload as any)?.id },
    },
  };
};
