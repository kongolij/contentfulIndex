export function richTextToPlain(rt: any, max = 400): string {
  const out: string[] = [];
  (function walk(node: any) {
    if (!node) return;
    if (node.nodeType === 'text' && typeof node.value === 'string') out.push(node.value);
    const kids = node.content || [];
    for (const k of kids) walk(k);
  })(rt);
  const s = out.join(' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}