import type { Indexer } from './types';
import { showcaseIndexer } from './showcase';
import { techTipIndexer } from './techtip';
import { buyingGuideIndexer } from './buyingGuide';


const REGISTRY: Record<string, Indexer> = {
  projectShowcase: showcaseIndexer,
  projectShowcases: showcaseIndexer, 
  project_showcase: showcaseIndexer, // alias

  techTip: techTipIndexer,
  techTips: techTipIndexer,          // 
  tech_tip: techTipIndexer,          // alias

  buyingGuide: buyingGuideIndexer,
  buyingGuides: buyingGuideIndexer,
  buying_guide: buyingGuideIndexer,         
   

};

function normalizeId(id?: string) {
  if (!id) return undefined;
  const raw = id.replace(/[\s-_]/g, '').toLowerCase();
  if (raw === 'projectshowcase' || raw === 'projectshowcases') return 'projectShowcase';
  if (raw === 'techtip' || raw === 'techtips') return 'techTip';
  return id; // as-is
}

export function getIndexer(contentTypeId?: string): Indexer | undefined {
  const key = normalizeId(contentTypeId);
  if (key && REGISTRY[key]) return REGISTRY[key];
  return REGISTRY.projectShowcase;
}
