import { gqlFetch, GqlRes } from './contentfulGql';

type TechTipsOrder =
  | 'sys_publishedAt_DESC'
  | 'sys_publishedAt_ASC'
  | 'sys_firstPublishedAt_DESC'
  | 'sys_firstPublishedAt_ASC'
  | 'sys_updatedAt_DESC'
  | 'sys_updatedAt_ASC';

export async function getTechTipLists(opts: {
  spaceId: string;
  environmentId: string;
  accessToken: string;
  limit?: number;
  skip?: number;
  conceptIds?: string[];
  sortOrder?: TechTipsOrder[];
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
    query getTechTipLists(
      $limit: Int = 20
      $skip: Int = 0
      $sortOrder: [TechTipsOrder] = [sys_publishedAt_DESC]
      ${withFilter ? '$conceptIds: [String!]' : ''}
    ) {
      techTipsCollection(
        limit: $limit
        skip: $skip
        order: $sortOrder
        ${withFilter ? 'where: { contentfulMetadata: { concepts: { id_contains_some: $conceptIds } } }' : ''}
      ) {
        total
        items {
          sys { id }

          title_en: title(locale: "en-US")
          title_fr: title(locale: "fr")

          slug_en: slug(locale: "en-US")
          slug_fr: slug(locale: "fr")

          description_en: description(locale: "en-US") { json }
          description_fr: description(locale: "fr") { json }

          image: mainImage {
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

  const variables: Record<string, unknown> = { limit, skip, sortOrder, ...(withFilter && { conceptIds }) };

  const res: GqlRes = await gqlFetch(spaceId, environmentId, accessToken, query, variables);
  if (!res.ok) {
    const msg = `TechTips query failed: ${res.status ?? ''} ${res.error}`;
    console.log(msg, res.body);
    throw new Error(msg);
  }
  return res.data?.techTipsCollection ?? { total: 0, items: [] };
}
