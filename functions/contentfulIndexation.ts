// functions/contentfulIndexation.ts
import type { FunctionEventHandler } from '@contentful/node-apps-toolkit';
import { FunctionTypeEnum } from '@contentful/node-apps-toolkit';

// GraphQL page fetcher for projectShowcase
import { getShowcaseLists } from '../src/lib/contenful/showcase.gql';
import { toConstructorItemFromShowcase } from '../src/lib/mappers/showcase';
import { putCatalogInMemory } from '../src/lib/constructor/constructorCatalog';

type Params = {
  // optional: you can still pass this from Page UI, but we hardcode showcases below
  contentTypeId?: string;

  // optional overrides
  section?: string;            // Constructor section override
  constructorKey?: string;     // dev override
  constructorToken?: string;   // dev override
};

type ConstructorCreds = { key: string; token: string; section?: string };

const redact = (s?: string) => (s ? `${s.slice(0, 2)}••••${s.slice(-2)}` : '(none)');

/* ----------------------- Installation parameters helpers ----------------------- */

function loadContentfulGqlCreds(context: any): { token: string } {
  const cfg =
    (context as any)?.appInstallationParameters?.contentful ??
    (context as any)?.parameters?.installation?.contentful ??
    {};

  // We only use CDA (delivery) per your request
  const token = cfg?.deliveryToken;

  // Presence logs only (no secrets)
  console.log('contentful cfg present:', !!cfg, '| token present:', !!token);

  if (!token) throw new Error('Contentful GraphQL token missing (delivery).');
  return { token };
}

function loadConstructorCredsFromContextOrEnv(
  context: any,
  params?: { section?: string; constructorKey?: string; constructorToken?: string }
): ConstructorCreds {
  const ctorFromContext =
    (context as any)?.appInstallationParameters?.constructor ??
    (context as any)?.parameters?.installation?.constructor ??
    {};

  const key =
    process.env.CONSTRUCTOR_API_KEY ||
    params?.constructorKey ||
    ctorFromContext?.key;

  const token =
    process.env.CONSTRUCTOR_API_TOKEN ||
    params?.constructorToken ||
    ctorFromContext?.token;

  const section =
    process.env.CONSTRUCTOR_SECTION ||
    params?.section ||
    ctorFromContext?.section;

  // Presence logs only
  console.log(
    'ctx.appInstallationParameters present:',
    !!(context as any)?.appInstallationParameters,
    '| ctx.parameters.installation present:',
    !!(context as any)?.parameters?.installation
  );

  if (!key)   throw new Error('Constructor key missing (context/env)');
  if (!token) throw new Error('Constructor token missing (context/env)');
  return { key, token, section };
}

/* ---------------------------------- Handler ---------------------------------- */

export const handler: FunctionEventHandler<FunctionTypeEnum.AppActionCall> = async (event, context) => {
  const params = ((event as any)?.body?.parameters ?? (event as any)?.body ?? {}) as Params;

  // 1) Load credentials (no secrets logged)
  const { key, token, section } = loadConstructorCredsFromContextOrEnv(context, params);
  const { token: gqlToken } = loadContentfulGqlCreds(context);
  console.log(
    'Constructor key (redacted):',
    redact(key),
    '| section override:',
    params.section || section || 'Contents'
  );

  // 2) Page through ALL showcases
  const PAGE_SIZE = 50;
  let skip = 0;
  let total = 0;
  const allShowcases: any[] = [];

  while (true) {
    const page = await getShowcaseLists({
      spaceId: context.spaceId,
      environmentId: context.environmentId,
      accessToken: gqlToken,
      locale: 'en-US',
      limit: PAGE_SIZE,
      skip,
      // NOTE: leave conceptIds undefined to fetch ALL showcases
      sortOrder: ['sys_publishedAt_DESC'],
    });

    const items = Array.isArray(page?.items) ? page.items : [];
    if (skip === 0) total = page?.total ?? items.length;

    allShowcases.push(...items);

    if (allShowcases.length >= total || items.length === 0) break;
    skip += PAGE_SIZE;
  }

  if (allShowcases.length === 0) {
    return {
      ok: true,
      message: 'No Project Showcase items found from GraphQL.',
      meta: { contentTypeId: 'projectShowcase', total: 0 },
    };
  }

  // 3) Map → Constructor items
  const constructorItems = allShowcases.map(toConstructorItemFromShowcase);

  // 4) Build JSONL (one JSON object per line)
  const itemsJsonl = constructorItems.map((it) => JSON.stringify(it)).join('\n');

  // 5) Full catalog upload (JSONL, in-memory)
  const upload = await putCatalogInMemory(itemsJsonl, {
    key,
    token,
    section: params.section || section || 'Contents',
    format: 'jsonl',
    force: true,
    c: 'contentful-index-app/1.0',
  });

  console.log( " ----  indexed" )

  // Keep response small (avoid serializing big arrays)
  return {
    ok: true,
    message: `Uploaded ${constructorItems.length} showcases to Constructor (section: ${params.section || section || 'Contents'}).`,
    meta: {
      totalQueried: total,
      spaceId: context.spaceId,
      environmentId: context.environmentId,
      pageSize: PAGE_SIZE,
    },
    result: {
      mode: 'catalog-upload-jsonl',
      taskId: (upload as any)?.task_id || (upload as any)?.id || undefined,
      lines: constructorItems.length,
    },
  };
};
