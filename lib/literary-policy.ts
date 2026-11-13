import { plainText } from "./study-policy";
export { plainText };
export type AnnotationPart = { text: string; note?: string };
/** Malformed syntax stays literal. No HTML, scripts, markdown or URLs are interpreted. */
export function annotationParts(source: string): AnnotationPart[] {
  const parts: AnnotationPart[] = [];
  const re = /\[\[([^\[\]|\n]{1,60})\|([^\[\]\n]{1,500})\]\]/g;
  let start = 0;
  for (const m of source.matchAll(re)) {
    if (m.index! > start) parts.push({ text: source.slice(start, m.index) });
    parts.push({ text: m[1], note: m[2] });
    start = m.index! + m[0].length;
  }
  if (start < source.length) parts.push({ text: source.slice(start) });
  return parts;
}

/** Preserve poem indentation and annotation source exactly, while validating the full size. */
export function workBody(value:unknown) {
  const text=String(value??'');
  plainText(text,10000,1);
  if(Array.from(text).length>10000)throw new Error('正文最多一万字');
  return text;
}
