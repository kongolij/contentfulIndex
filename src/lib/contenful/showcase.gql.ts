// src/lib/contenful/showcase.gql.ts
import { gqlFetch, GqlRes } from './contentfulGql';

type ShowcaseOrder =
  | 'sys_publishedAt_DESC'
  | 'sys_publishedAt_ASC'
  | 'sys_firstPublishedAt_DESC'
  | 'sys_firstPublishedAt_ASC'
  | 'sys_updatedAt_DESC'
  | 'sys_updatedAt_ASC';

export async function getShowcaseLists(opts: {
  spaceId: string;
  environmentId: string;
  accessToken: string;      // CDA token
  limit?: number;
  skip?: number;
  conceptIds?: string[];
  sortOrder?: ShowcaseOrder[];
}) {
  const {
    spaceId,
    environmentId,
    accessToken,
    limit = 20,
    skip = 0,
    conceptIds,
    sortOrder = ['sys_publishedAt_DESC'],
  } = opts;

  const withFilter = Array.isArray(conceptIds) && conceptIds.length > 0;

  const query = `
    query getShowcaseLists(
      $limit: Int = 20
      $skip: Int = 0
      $sortOrder: [ProjectShowcaseOrder] = [sys_publishedAt_DESC]
      $localeEn: String! = "en-US"
      $localeFr: String! = "fr"
      ${withFilter ? '$conceptIds: [String!]' : ''}
    ) {
      projectShowcaseCollection(
        limit: $limit
        skip: $skip
        order: $sortOrder
        ${withFilter ? 'where: { contentfulMetadata: { concepts: { id_contains_some: $conceptIds } } }' : ''}
      ) {
        total
        items {
          sys { id }

          title_en: title(locale: $localeEn)
          title_fr: title(locale: $localeFr)

          slug_en: slug(locale: $localeEn)
          slug_fr: slug(locale: $localeFr)

          description_en: description(locale: $localeEn) { json }
          description_fr: description(locale: $localeFr) { json }

          featuredImage {
            __typename
            altText
            image { url }
            title
          }

          contentfulMetadata {
            concepts { id }
            tags { id name }
          }
        }
      }
    }
  `;

  const variables: Record<string, unknown> = {
    limit,
    skip,
    sortOrder,
    localeEn: 'en-US',
    localeFr: 'fr', // change to 'fr' if that's your space code
  };
  if (withFilter) variables.conceptIds = conceptIds;

  const res: GqlRes = await gqlFetch(spaceId, environmentId, accessToken, query, variables);
  if (!res.ok) {
    const msg = `Showcase query failed: ${res.status ?? ''} ${res.error}`;
    console.log(msg, res.body);
    throw new Error(msg);
  }

  return res.data?.projectShowcaseCollection ?? { total: 0, items: [] };
}
