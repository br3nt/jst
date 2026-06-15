// Scans a document for <script type="jst"> ... </script> blocks and returns
// each block's inner text, declared attributes, and precise source positions
// (0-based line/character, LSP-style) so engine errors can be mapped back.

const blockPattern = /(<script\b[^>]*?\btype\s*=\s*(['"])jst\2[^>]*?>)([\s\S]*?)(<\/script\s*>)/gi;
const attrPattern = /([.@]?[A-Za-z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;

const reservedAttributes = new Set(['type', 'name', 'id']);

// 0-based line/character of an absolute offset in text.
export function positionAt(text, offset) {
  let line = 0;
  let lastNewline = -1;
  for (let i = 0; i < offset; i++) {
    if (text[i] === '\n') { line++; lastNewline = i; }
  }
  return { line, character: offset - lastNewline - 1 };
}

function parseOpenTagAttributes(openTag) {
  // strip the leading "<script" and trailing ">"
  const inner = openTag.replace(/^<script/i, '').replace(/>$/, '');
  const attributes = [];
  let match;
  attrPattern.lastIndex = 0;
  while ((match = attrPattern.exec(inner))) {
    const name = match[1];
    if (name.toLowerCase() === 'type') continue;
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attributes.push({ name, value });
  }
  return attributes;
}

export function findJstBlocks(text) {
  const blocks = [];
  let match;
  blockPattern.lastIndex = 0;

  while ((match = blockPattern.exec(text))) {
    const [, openTag, , innerText, ] = match;
    const innerStart = match.index + openTag.length;
    const attributes = parseOpenTagAttributes(openTag);
    const nameAttr = attributes.find(attr => attr.name.toLowerCase() === 'name');

    blocks.push({
      openTag,
      innerText,
      innerStart,
      innerPosition: positionAt(text, innerStart),
      openTagPosition: positionAt(text, match.index),
      nameValue: nameAttr ? nameAttr.value : null,
      // the component's declared params: every non-reserved attribute name
      params: attributes
        .filter(attr => !reservedAttributes.has(attr.name.toLowerCase()))
        .map(attr => attr.name.toLowerCase()),
      attributes,
    });
  }

  return blocks;
}

// Map a (line, col) reported by the engine RELATIVE to a block's inner text
// (1-based line, 0-based col, per InputReader) to a document position.
export function mapInnerPosition(block, innerLine, innerCol) {
  if (innerLine <= 1) {
    return {
      line: block.innerPosition.line,
      character: block.innerPosition.character + innerCol,
    };
  }
  return {
    line: block.innerPosition.line + (innerLine - 1),
    character: innerCol,
  };
}
