// src/lib/showcase.gql.ts
import { gqlFetch, GqlRes } from "./contentfulGql";

type ShowcaseOrder =
  | "sys_publishedAt_DESC"
  | "sys_publishedAt_ASC"
  | "sys_firstPublishedAt_DESC"
  | "sys_firstPublishedAt_ASC"
  | "sys_updatedAt_DESC"
  | "sys_updatedAt_ASC";

/**
 * Fetch a paged list of ProjectShowcase entries (published) with optional concept filters.
 * If you pass no conceptIds, the where-clause is omitted so everything matches.
 */
export async function getShowcaseLists(opts: {
  spaceId: string;
  environmentId: string;
  accessToken: string; // CDA token (or preview token if you want preview)
  locale: string;
  limit?: number;
  skip?: number;
  conceptIds?: string[];       // optional Contentful concept IDs
  sortOrder?: ShowcaseOrder[]; // defaults to ['sys_publishedAt_DESC']
}) {
  const {
    spaceId,
    environmentId,
    accessToken,
    locale,
    limit = 20,
    skip = 0,
    conceptIds,
    sortOrder = ["sys_publishedAt_DESC"],
  } = opts;

  const withFilter = Array.isArray(conceptIds) && conceptIds.length > 0;

  const query = `
    query getShowcaseLists(
      $limit: Int = 1
      $skip: Int = 0
      $sortOrder: [ProjectShowcaseOrder] = [sys_publishedAt_DESC]
    ) {
      projectShowcaseCollection(
        limit: $limit
        skip: $skip
        order: $sortOrder
      ) {
        ...ProjectShowcaseCollection
      }
    }

    fragment ProjectShowcaseCollection on ProjectShowcaseCollection {
      total
      items { ...ProjectShowcaseListItem }
    }

    fragment ProjectShowcaseListItem on ProjectShowcase {
      title
      slug
      description { json }
      featuredImage { ...ShowcaseFeaturedImage }   # typed as Image in your model
      contentfulMetadata { ...ShowcaseCategoriesMetadata }
    }

    # Keep this minimal and self-contained: no external ...Image fragment.
    fragment ShowcaseFeaturedImage on Image {
      __typename
      altText
      image{
        url
      }
      title
    }

    # Stay safe on concepts; tags.name is typically valid.
    fragment ShowcaseCategoriesMetadata on ContentfulMetadata {
      concepts { id }
      tags { id name }
    }
  `;

  const variables: Record<string, unknown> = { locale, limit, skip, sortOrder };
  if (withFilter) variables.conceptIds = conceptIds;

  const res: GqlRes = await gqlFetch(spaceId, environmentId, accessToken, query, variables);
  if (!res.ok) {
    const msg = `Showcase query failed: ${res.status ?? ""} ${res.error}`;
    console.log(msg, res.body);
    throw new Error(msg);
  }

  return res.data?.projectShowcaseCollection ?? { total: 0, items: [] };
}
