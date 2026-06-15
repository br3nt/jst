/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
// Tier 2 diagnostics. Runs the REAL JST compiler over each template block, so
// what the editor flags is exactly what the runtime would reject — no second
// implementation of "valid JST" to drift out of sync. JS-level syntax errors
// in expressions are caught by handing the compiled function body to V8
// itself (new Function), i.e. the existing JS parser does the validating.
import { compileTemplateRenderingFunction } from '../../../compiler.js';
import { findJstBlocks, mapInnerPosition } from './jst-blocks.mjs';

const ERROR = 1;
const WARNING = 2;

const point = (line, character) => ({ line, character });
const range = (start, end) => ({ start, end });
const lineRange = position => range(position, point(position.line, position.character + 1));

// Pull a trailing "(line:col)" off an InputReader croak message.
function extractInnerPosition(message) {
  const match = message.match(/\((\d+):(\d+)\)\s*$/);
  if (!match) return null;
  return { line: Number(match[1]), col: Number(match[2]), clean: message.slice(0, match.index).trim() };
}

function fakeTemplateElement(block) {
  const attributes = block.attributes.map(attr => ({ name: attr.name, value: attr.value }));
  return {
    innerHTML: block.innerText,
    attributes,
    getAttribute(name) {
      const found = attributes.find(attr => attr.name === name);
      return found ? found.value : null;
    },
  };
}

export function computeDiagnostics(text) {
  const diagnostics = [];
  const blocks = findJstBlocks(text);
  const seenNames = new Map();

  for (const block of blocks) {
    // JST-specific lints on the component declaration ------------------
    if (block.nameValue === null) {
      diagnostics.push({
        severity: ERROR, source: 'jst',
        range: lineRange(block.openTagPosition),
        message: 'JST template is missing a name attribute; it cannot be registered as a custom element.',
      });
    } else if (!block.nameValue.includes('-')) {
      diagnostics.push({
        severity: ERROR, source: 'jst',
        range: lineRange(block.openTagPosition),
        message: `"${block.nameValue}" is not a valid custom element name — it must contain a hyphen (e.g. jst-${block.nameValue}).`,
      });
    } else if (seenNames.has(block.nameValue)) {
      diagnostics.push({
        severity: WARNING, source: 'jst',
        range: lineRange(block.openTagPosition),
        message: `Duplicate template name "${block.nameValue}" — later definitions are ignored at runtime.`,
      });
    }
    if (block.nameValue) seenNames.set(block.nameValue, true);

    // Compile through the real engine ----------------------------------
    let compiled = null;
    try {
      compiled = compileTemplateRenderingFunction(fakeTemplateElement(block));
    } catch (error) {
      const message = String(error?.message ?? error);
      const located = extractInnerPosition(message);

      if (located) {
        const start = mapInnerPosition(block, located.line, located.col);
        diagnostics.push({
          severity: ERROR, source: 'jst',
          range: lineRange(start),
          message: located.clean || message,
        });
      } else {
        diagnostics.push({
          severity: ERROR, source: 'jst',
          range: lineRange(block.innerPosition),
          message,
        });
      }
      continue;
    }

    // Validate the embedded JavaScript using V8 itself -----------------
    try {
      const args = [...compiled.functionParams, 'el', 'raw', 'slot', '__esc', '__bind', compiled.functionBody];
      // eslint-disable-next-line no-new-func
      new Function(...args);
    } catch (error) {
      diagnostics.push({
        severity: ERROR, source: 'jst',
        range: lineRange(block.openTagPosition),
        message: `JavaScript error in template: ${String(error?.message ?? error)}`,
      });
    }
  }

  return diagnostics;
}
