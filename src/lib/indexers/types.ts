// src/lib/indexers/types.ts
export type FetchPageArgs = {
  spaceId: string;
  environmentId: string;
  accessToken: string;
  limit: number;
  skip: number;
};

export type Indexer = {
  /** content type id in Contentful */
  id: string;
  /** One page of data (must return entries containing BOTH locales via aliases) */
  fetchPage: (args: FetchPageArgs) => Promise<{ total: number; items: any[] }>;
  /** Convert the bilingual entry into a single-locale shape for the mapper */
  normalizeForLocale: (entry: any, locale: 'en' | 'fr') => any;
  /** Map a normalized entry to a Constructor item */
  map: (normalized: any) => any;
};
