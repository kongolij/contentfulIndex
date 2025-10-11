import {richTextToPlain} from "../../utils/richText";
type GqlShowcase = {
  title?: string;
  slug?: string;
  description?: { json?: any };
  featuredImage?: {
    __typename?: string;
    altText?: string;
    title?: string;
    image?: { url?: string };
  };
  contentfulMetadata?: {
    concepts?: { id?: string }[];
    tags?: { id?: string; name?: string }[];
  };
};

export function toConstructorItemFromShowcase(it: GqlShowcase) {
  const id = it.slug || (it.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const name_en = it.title || id || 'untitled';

  const desc = richTextToPlain(it.description?.json);
  const image_url = it.featuredImage?.image?.url ?? null;
  const image_alt = it.featuredImage?.altText || it.featuredImage?.title || null;

  const categories = (it.contentfulMetadata?.tags || [])
    .map(t => t?.name)
    .filter(Boolean) as string[];

  const concepts = (it.contentfulMetadata?.concepts || [])
    .map(c => c?.id)
    .filter(Boolean) as string[];

  return {
    id,                  // unique in your index; using slug for now
    name: name_en,       // “name in en”
    data: {
      contentType: 'showcase',
      description: desc,
      image_url,
      image_alt,
      categories,        // list of names from metadata tags
      concepts,          // raw concept ids (optional but handy)
      slug: it.slug || null
    }
  };
   //https://www-dev.princessauto.com/en/project-showcases/1923-Austin-7-Cyclekart
}