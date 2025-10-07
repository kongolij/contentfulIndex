import { Indexer, FetchPageArgs } from './types';
import { getTechTipLists } from '../contenful/techTips.gql';
import { toConstructorItemFromTechTip } from '../mappers/techTips';

async function fetchPage(args: FetchPageArgs) {
  const { spaceId, environmentId, accessToken, limit, skip } = args;
  const res = await getTechTipLists({
    spaceId,
    environmentId,
    accessToken,
    limit,
    skip,
    sortOrder: ['sys_publishedAt_DESC'],
  });
  return { total: res?.total ?? 0, items: Array.isArray(res?.items) ? res.items : [] };
}

function normalizeForLocale(entry: any, locale: 'en' | 'fr') {
  const isFr = locale === 'fr';
  return {
    ...entry,
    title: isFr ? (entry.title_fr ?? entry.title) : (entry.title_en ?? entry.title),
    slug:  isFr ? (entry.slug_fr  ?? entry.slug)  : (entry.slug_en ?? entry.slug ?? entry.slug_en),
    description: isFr
      ? (entry.description_fr ?? entry.description)
      : (entry.description_en ?? entry.description),
    __locale: isFr ? 'fr' : 'en-US',
  };
}

export const techTipIndexer: Indexer = {
  id: 'techTips',
  fetchPage,
  normalizeForLocale,
  map: toConstructorItemFromTechTip,
};
