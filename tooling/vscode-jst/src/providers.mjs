/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
// Tier 3 language features as pure functions over (text, position, index).
// The LSP server (server.js) is thin glue around these; everything testable
// lives here.
import { findJstBlocks, positionAt } from './jst-blocks.mjs';
import { offsetAt, wordAt, tagContextAt, indexComponents } from './model.mjs';

export { indexComponents };

// Go-to-definition: cursor on a custom-element tag (or its closing tag) -> its
// <script type="jst" name="..."> definition.
export function findDefinition(text, position, components) {
  const offset = offsetAt(text, position);
  const token = wordAt(text, offset);
  if (!token || !token.word.includes('-')) return null;

  const component = components.get(token.word);
  if (!component) return null;

  return {
    uri: component.uri,
    range: {
      start: component.position,
      end: { line: component.position.line, character: component.position.character + component.name.length },
    },
  };
}

// Hover: cursor on a known component tag -> its name and declared attributes.
export function getHover(text, position, components) {
  const offset = offsetAt(text, position);
  const token = wordAt(text, offset);
  if (!token || !token.word.includes('-')) return null;

  const component = components.get(token.word);
  if (!component) return null;

  const params = component.params.length ? component.params.join(', ') : '(none)';
  return {
    contents: `**<${component.name}>** — JST component\n\nAttributes: ${params}`,
    range: {
      start: positionAt(text, token.start),
      end: positionAt(text, token.end),
    },
  };
}

// Completion: suggest component tags after "<", and a component's attributes when
// inside its open tag.
export function getCompletions(text, position, components) {
  const offset = offsetAt(text, position);
  const context = tagContextAt(text, offset);

  // typing a tag name -> known components
  if (context && context.onName) {
    return [...components.values()].map(component => ({
      label: component.name,
      kind: 'class',
      detail: component.params.length ? `attributes: ${component.params.join(', ')}` : 'no attributes',
    }));
  }

  // inside a known component's attributes -> its attributes (attribute and .prop forms)
  if (context && context.inAttributes) {
    const component = components.get(context.tagName);
    if (!component) return [];

    return component.params.flatMap(param => {
      const camel = param.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
      const items = [{ label: param, kind: 'field', detail: `${context.tagName} attribute` }];
      items.push({ label: `.${camel}`, kind: 'property', detail: `${context.tagName} property binding` });
      return items;
    });
  }

  return [];
}

// Document symbols: one per <script type="jst" name="...">.
export function getDocumentSymbols(text) {
  return findJstBlocks(text)
    .filter(block => block.nameValue)
    .map(block => ({
      name: block.nameValue,
      kind: 'class',
      detail: block.params.length ? block.params.join(', ') : '',
      range: {
        start: block.openTagPosition,
        end: positionAt(text, block.innerStart),
      },
    }));
}
