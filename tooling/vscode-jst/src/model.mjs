/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
// A cross-file index of JST components: name -> { params, definition location }.
// Built by scanning every known document's <script type="jst"> blocks, so
// navigation works across files (a <kanban-card> used in one file resolves to
// its definition in another — exactly the feed/kanban "definitions ship
// separately" case).
import { findJstBlocks, positionAt } from './jst-blocks.mjs';

export function offsetAt(text, position) {
  let offset = 0;
  let line = 0;
  while (offset < text.length && line < position.line) {
    if (text[offset] === '\n') line++;
    offset++;
  }
  return offset + position.character;
}

// The identifier/tag-name token under an offset ([\w-], so custom-element names).
export function wordAt(text, offset) {
  const isWordChar = ch => ch && /[\w-]/.test(ch);
  let start = offset;
  let end = offset;
  while (start > 0 && isWordChar(text[start - 1])) start--;
  while (end < text.length && isWordChar(text[end])) end++;
  if (start === end) return null;
  return { word: text.slice(start, end), start, end };
}

// Are we inside an unclosed start tag at this offset? If so, which tag, and is
// the cursor still on the tag name or out in attribute territory?
export function tagContextAt(text, offset) {
  const lastLt = text.lastIndexOf('<', offset - 1);
  const lastGt = text.lastIndexOf('>', offset - 1);
  if (lastLt === -1 || lastLt < lastGt) return null;

  const afterLt = text.slice(lastLt, offset);
  const nameMatch = afterLt.match(/^<\s*([A-Za-z][\w-]*)/);
  if (!nameMatch) return { tagName: null, onName: true, inAttributes: false, openAt: lastLt };

  const tagName = nameMatch[1];
  const nameEnd = lastLt + nameMatch[0].length;
  return {
    tagName,
    onName: offset <= nameEnd,
    inAttributes: offset > nameEnd,
    openAt: lastLt,
  };
}

export function indexComponents(documents) {
  const components = new Map();

  for (const { uri, text } of documents) {
    for (const block of findJstBlocks(text)) {
      if (!block.nameValue) continue;

      // Locate the name value within the open tag for a precise jump target.
      const nameValueOffsetInTag = block.openTag.search(
        new RegExp(`name\\s*=\\s*['"]${block.nameValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
      );
      const openTagStart = block.innerStart - block.openTag.length;
      const targetOffset = nameValueOffsetInTag >= 0
        ? openTagStart + nameValueOffsetInTag
        : openTagStart;

      // last definition wins as the "current" one, but keep them all for dup detection
      const existing = components.get(block.nameValue);
      const entry = {
        name: block.nameValue,
        params: block.params,
        uri,
        position: positionAt(text, targetOffset),
        duplicate: !!existing,
      };
      components.set(block.nameValue, entry);
    }
  }

  return components;
}
