/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  indexComponents, findDefinition, getHover, getCompletions, getDocumentSymbols,
} from '../src/providers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');

// position of the Nth occurrence of substr (line/character)
function posOf(text, substr, occurrence = 1) {
  let index = -1;
  for (let i = 0; i < occurrence; i++) index = text.indexOf(substr, index + 1);
  const before = text.slice(0, index);
  const line = before.split('\n').length - 1;
  const character = index - (before.lastIndexOf('\n') + 1);
  return { line, character };
}

const defDoc = {
  uri: 'file:///cards.html',
  text: '<script type="jst" name="kanban-card" props="card">\n  <div>$(card.title)</div>\n</script>',
};
const useDoc = {
  uri: 'file:///board.html',
  text: '<script type="jst" name="kanban-board" props="cards">\n  <kanban-card .card="$(cards[0])"></kanban-card>\n</script>',
};

test('indexComponents indexes components across files', () => {
  const index = indexComponents([defDoc, useDoc]);
  assert.ok(index.has('kanban-card'));
  assert.ok(index.has('kanban-board'));
  assert.deepEqual(index.get('kanban-card').params, ['card']);
  assert.equal(index.get('kanban-card').uri, 'file:///cards.html');
});

test('go-to-definition jumps from a usage to the definition in another file', () => {
  const index = indexComponents([defDoc, useDoc]);
  const position = posOf(useDoc.text, 'kanban-card', 1); // the usage
  const definition = findDefinition(useDoc.text, position, index);

  assert.ok(definition, 'expected a definition location');
  assert.equal(definition.uri, 'file:///cards.html');
  // lands on the name value in the defining file's open tag (line 0)
  assert.equal(definition.range.start.line, 0);
});

test('go-to-definition returns null for non-component words', () => {
  const index = indexComponents([defDoc, useDoc]);
  const position = posOf(useDoc.text, 'div', 1);
  assert.equal(findDefinition(useDoc.text, position, index), null);
});

test('hover on a component shows its props', () => {
  const index = indexComponents([defDoc, useDoc]);
  const position = posOf(useDoc.text, 'kanban-card', 1);
  const hover = getHover(useDoc.text, position, index);

  assert.ok(hover);
  assert.match(hover.contents, /<kanban-card>/);
  assert.match(hover.contents, /Props: card/);
});

test('completion after "<" lists known component tags', () => {
  const index = indexComponents([defDoc, useDoc]);
  // a fresh document where we start a tag
  const text = '<div><kan';
  const position = posOf(text, 'kan', 1);
  // place cursor at end of "kan"
  position.character += 3;
  const items = getCompletions(text, position, index);
  const labels = items.map(item => item.label);
  assert.ok(labels.includes('kanban-card'));
  assert.ok(labels.includes('kanban-board'));
});

test('completion inside a component tag suggests its props and .prop forms', () => {
  const index = indexComponents([defDoc, useDoc]);
  const text = '<kanban-card ></kanban-card>';
  const position = posOf(text, ' >', 1); // the space inside the open tag
  position.character += 1;
  const items = getCompletions(text, position, index);
  const labels = items.map(item => item.label);

  assert.ok(labels.includes('card'), 'attribute form');
  assert.ok(labels.includes('.card'), 'property-binding form');
});

test('document symbols list each component in a file', () => {
  const symbols = getDocumentSymbols(defDoc.text);
  assert.equal(symbols.length, 1);
  assert.equal(symbols[0].name, 'kanban-card');
});

test('works on the real kanban example file', () => {
  const kanban = fs.readFileSync(path.join(repoRoot, 'examples', 'kanban.html'), 'utf8');
  const index = indexComponents([{ uri: 'file:///kanban.html', text: kanban }]);

  // the real file defines these
  ['kanban-board', 'kanban-column', 'kanban-card', 'card-editor', 'board-toolbar', 'ui-panel']
    .forEach(name => assert.ok(index.has(name), `expected ${name} indexed`));

  // kanban-card declares one prop: card
  assert.deepEqual(index.get('kanban-card').params, ['card']);

  // go-to-definition from the <kanban-card> usage inside kanban-column's template
  const usagePos = posOf(kanban, '<kanban-card', 1);
  usagePos.character += 1; // move onto the name
  const definition = findDefinition(kanban, usagePos, index);
  assert.ok(definition, 'expected to resolve the kanban-card usage');

  const symbols = getDocumentSymbols(kanban);
  assert.ok(symbols.length >= 6, 'expected all components as symbols');
});
