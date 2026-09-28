export type TextPart = { text: string; href?: string };

export function linkParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const matches = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  let end = 0;
  for (const match of text.matchAll(matches)) {
    const start = match.index;
    if (start > 0 && /[\w@/]/.test(text[start - 1])) continue;
    let candidate = match[0].replace(/[.,!?;:]+$/, '');
    while (candidate.endsWith(')') && (candidate.match(/\)/g)?.length ?? 0) > (candidate.match(/\(/g)?.length ?? 0)) candidate = candidate.slice(0, -1);
    try {
      const href = candidate.startsWith('www.') ? `https://${candidate}` : candidate;
      const url = new URL(href);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || !candidate) continue;
      if (start > end) parts.push({ text: text.slice(end, start) });
      parts.push({ text: candidate, href });
      end = start + candidate.length;
    } catch { /* Leave malformed URLs as text. */ }
  }
  if (end < text.length) parts.push({ text: text.slice(end) });
  return parts;
}
