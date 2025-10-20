import {richTextToPlain} from "../../utils/richText";
type GqlShowcase = {
  sys?: { id?: string };
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

  const fallbackSlug =
    (it.title ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
      
  const id = it.sys?.id ?? it.slug ?? fallbackSlug;

  
  const name = it.title || id || 'untitled';

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
    name: name,         // “name ”
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
   
}