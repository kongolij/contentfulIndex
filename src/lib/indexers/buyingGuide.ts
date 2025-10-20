// src/lib/indexers/showcase.ts
import { Indexer, FetchPageArgs } from './types';
import { getBuyingGuideLists  } from '../contenful/buyingGuide.gq'; 
import { toConstructorItemFromBuyingGuide } from '../mappers/buyingGuide';


// single page fetch
async function fetchPage(args: FetchPageArgs) {
  const { spaceId, environmentId, accessToken, limit, skip } = args;
  const res = await getBuyingGuideLists({
    spaceId,
    environmentId,
    accessToken,
    limit,
    skip,
    sortOrder: ['sys_publishedAt_DESC'],
  });
  return { total: res?.total ?? 0, items: Array.isArray(res?.items) ? res.items : [] };
}

// normalize to one locale using the aliases you fetch
function normalizeForLocale(entry: any, locale: 'en' | 'fr') {
  const isFr = locale === 'fr';
  return {
    ...entry,
    title: isFr ? (entry.title_fr ?? entry.title) : (entry.title_en ?? entry.title),
    slug:  isFr ? (entry.slug_fr  ?? entry.slug)  : (entry.slug_en ?? entry.slug ?? entry.slug_en),
    description: isFr ? (entry.description_fr ?? entry.description)
                      : (entry.description_en ?? entry.description),
    // keep featuredImage/contentfulMetadata as-is
  };
}

export const buyingGuideIndexer: Indexer = {
  id: 'buyingGuide',
  fetchPage,
  normalizeForLocale,
  map: toConstructorItemFromBuyingGuide,
};
