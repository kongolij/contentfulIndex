// functions/contentfulIndexation.ts
import type { FunctionEventHandler } from '@contentful/node-apps-toolkit';
import { FunctionTypeEnum } from '@contentful/node-apps-toolkit';

// ⬇️ make sure this import matches your updated path
import { getShowcaseLists } from '../src/lib/contenful/showcase.gql';
import { toConstructorItemFromShowcase } from '../src/lib/mappers/showcase';
import { putCatalogInMemory } from '../src/lib/constructor/constructorCatalog';

import {
  loadContentfulGqlCreds,
  loadConstructorCredsFromContextOrEnv,
} from '../src/utils/creds';

type Params = {
  contentTypeId?: string;      // kept for future filters if needed
  section?: string;            // optional Constructor section override
  constructorToken?: string;   // optional dev override, if supported in creds loader
};

type ConstructorCreds = { key: string; token: string; section?: string };

export const handler: FunctionEventHandler<FunctionTypeEnum.AppActionCall> = async (event, context) => {
  const params = ((event as any)?.body?.parameters ?? (event as any)?.body ?? {}) as Params;

  // 1) Load creds (EN + FR) and Contentful GraphQL token
  const { en, fr } = loadConstructorCredsFromContextOrEnv(context, {
    section: params.section,
    constructorToken: params.constructorToken,
  });
  const { token: gqlToken } = loadContentfulGqlCreds(context);

  const PAGE_SIZE = 50;

  // 2) Single pagination over Contentful — query must alias fields like title_en/title_fr, slug_en/slug_fr, description_en/description_fr
  let skip = 0;
  let total = 0;
  const allEntries: any[] = [];

  while (true) {
    const page = await getShowcaseLists({
      spaceId: context.spaceId,
      environmentId: context.environmentId,
      accessToken: gqlToken,
      limit: PAGE_SIZE,
      skip,
      sortOrder: ['sys_publishedAt_DESC'],
      // conceptIds?: []   // optional: add if you want to filter
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
      message: 'No Project Showcase items found from GraphQL.',
      meta: { contentTypeId: 'projectShowcase', total: 0 },
    };
  }

  // 3) Normalize each entry to the shape your mapper expects, for EN and FR separately
  //    Assumes your query provides title_en/title_fr, slug_en/slug_fr, description_en/description_fr
  const normalizeForLocale = (e: any, locale: 'en' | 'fr') => {
  const isFr = locale === 'fr';
  return {
    ...e,
    // titles
    title: isFr ? (e.title_fr ?? e.title) : (e.title_en ?? e.title),

    // slugs: your fragment has default `slug` (EN) and `slug_fr` (FR)
    slug: isFr ? (e.slug_fr ?? e.slug) : e.slug,

    // descriptions: you already fetch description_en/description_fr and default description
    description: isFr
      ? (e.description_fr ?? e.description)
      : (e.description_en ?? e.description),

    // keep featuredImage & contentfulMetadata as-is
  };
};


  const enItems = allEntries.map((e) => toConstructorItemFromShowcase(normalizeForLocale(e, 'en')));
  const frItems = allEntries.map((e) => toConstructorItemFromShowcase(normalizeForLocale(e, 'fr')));

  const enJsonl = enItems.map((it) => JSON.stringify(it)).join('\n');
  const frJsonl = frItems.map((it) => JSON.stringify(it)).join('\n');

  // 4) Upload to Constructor twice — EN then FR (sequential keeps logs cleaner)
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

  // 5) Compact response
  return {
    ok: true,
    message: `Indexed ${enItems.length} EN and ${frItems.length} FR showcases to Constructor.`,
    meta: {
      spaceId: context.spaceId,
      environmentId: context.environmentId,
      pageSize: PAGE_SIZE,
      totalQueried: total,
    },
    result: {
      en: {
        uploaded: enItems.length,
        section: sectionEn,
        taskId: (enUpload as any)?.task_id || (enUpload as any)?.id || undefined,
      },
      fr: {
        uploaded: frItems.length,
        section: sectionFr,
        taskId: (frUpload as any)?.task_id || (frUpload as any)?.id || undefined,
      },
    },
  };
};
