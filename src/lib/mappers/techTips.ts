import { richTextToPlain } from '../../utils/richText';

type GqlTechTip = {
  title?: string;
  slug?: string;
  description?: { json?: any };
  image?: {
    __typename?: string;
    altText?: string;
    title?: string;
    image?: { url?: string };
  };
  contentfulMetadata?: {
    concepts?: { id?: string }[];
    tags?: { id?: string; name?: string }[];
  };
  __locale?: 'en-US' | 'fr';
};

export function toConstructorItemFromTechTip(it: GqlTechTip) {
  const id =
    it.slug ||
    (it.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const name = it.title || id || 'untitled';
  const desc = richTextToPlain(it.description?.json);
  const image_url = it.image?.image?.url ?? null;
  const image_alt = it.image?.altText || it.image?.title || null;

  const categories = (it.contentfulMetadata?.tags || [])
    .map((t) => t?.name)
    .filter(Boolean) as string[];

  const concepts = (it.contentfulMetadata?.concepts || [])
    .map((c) => c?.id)
    .filter(Boolean) as string[];

  return {
    id,
    name,
    data: {
      contentType: 'techTip',
      description: desc,
      image_url,
      image_alt,
      categories,
      concepts,
      slug: it.slug || null,
      locale: it.__locale || 'en-US',
    },
  };
}
