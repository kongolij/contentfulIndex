// src/lib/contentful/buyingGuide.gql.ts
import { gqlFetch, GqlRes } from './contentfulGql';

export type BuyingGuideOrder =
  | 'sys_publishedAt_DESC'
  | 'sys_publishedAt_ASC'
  | 'sys_firstPublishedAt_DESC'
  | 'sys_firstPublishedAt_ASC'
  | 'sys_updatedAt_DESC'
  | 'sys_updatedAt_ASC';

export async function getBuyingGuideLists(opts: {
  spaceId: string;
  environmentId: string;
  accessToken: string;      // CDA token
  limit?: number;
  skip?: number;
  sortOrder?: BuyingGuideOrder[];
  conceptIds?: string[];
  localeEn?: string;        // default "en-US"
  localeFr?: string;        // default "fr"
}) {
  const {
    spaceId,
    environmentId,
    accessToken,
    limit = 20,
    skip = 0,
    sortOrder = ['sys_publishedAt_DESC'],
    conceptIds,
    localeEn = 'en-US',
    localeFr = 'fr',
  } = opts;

  const withConcepts = Array.isArray(conceptIds) && conceptIds.length > 0;

  const query = `
    query getBuyingGuideLists(
      $limit: Int = 20
      $skip: Int = 0
      $sortOrder: [BuyingGuideOrder] = [sys_publishedAt_DESC]
      $localeEn: String!
      $localeFr: String!
      ${withConcepts ? '$conceptIds: [String!]' : ''}
    ) {
      buyingGuideCollection(
        limit: $limit
        skip: $skip
        order: $sortOrder
        ${withConcepts ? 'where: { contentfulMetadata: { concepts: { id_contains_some: $conceptIds } } }' : ''}
      ) {
        total
        items {
          sys {id}

          title_en: title(locale: $localeEn)
          title_fr: title(locale: $localeFr)

          # headline_en/headline_fr omitted (GraphQL comments start with '#')

          slug_en: slug(locale: $localeEn)
          slug_fr: slug(locale: $localeFr)

          description_en: description(locale: $localeEn) { json }
          description_fr: description(locale: $localeFr) { json }

          body_en: body(locale: $localeEn) { json }
          body_fr: body(locale: $localeFr) { json }

          image: mainImage {
            __typename
            altText
            title
            image { url }
          }

          showcaseImage {
            __typename
            altText
            title
            image { url }
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
    localeEn,
    localeFr,
  };
  if (withConcepts) variables.conceptIds = conceptIds;

  const res: GqlRes = await gqlFetch(spaceId, environmentId, accessToken, query, variables);
  if (!res.ok) {
    const msg = `BuyingGuide list query failed: ${res.status ?? ''} ${res.error}`;
    console.log(msg, res.body);
    throw new Error(msg);
  }

  return res.data?.buyingGuideCollection ?? { total: 0, items: [] };
}
