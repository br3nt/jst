/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
// Loads the JST injection grammar through the real vscode-textmate engine and
// asserts the scopes it assigns to JST constructs. This verifies the regexes
// and captures (the error-prone part). The grammar's HTML-injection *wiring*
// (does it activate inside <script type="jst"> in a real .html file) relies on
// VS Code's own html grammar and is checked manually in the editor — it cannot
// be reproduced headlessly without bundling VS Code's grammars.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const oniguruma = require('vscode-oniguruma');
const textmate = require('vscode-textmate');
const syntaxesDir = path.join(__dirname, '..', 'syntaxes');

const grammarFiles = {
  'jst.injection': path.join(syntaxesDir, 'jst.injection.tmLanguage.json'),
  'jst.islands': path.join(syntaxesDir, 'jst.islands.tmLanguage.json'),
};

// Tokenize through the same injection composition VS Code uses: a base HTML
// grammar with BOTH JST grammars injected. jst.injection marks the block;
// jst.islands injects into the block scope, so islands reach inside HTML tags
// and attribute strings. (source.js / text.html.basic ship with VS Code;
// stubbed empty here, so we assert only on JST's own scopes.)
async function makeGrammar() {
  await oniguruma.loadWASM(fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer);

  const registry = new textmate.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: patterns => new oniguruma.OnigScanner(patterns),
      createOnigString: s => new oniguruma.OnigString(s),
    }),
    getInjections: scopeName =>
      scopeName === 'text.html.basic' ? ['jst.injection', 'jst.islands'] : undefined,
    loadGrammar: async scopeName => {
      if (grammarFiles[scopeName]) {
        return textmate.parseRawGrammar(fs.readFileSync(grammarFiles[scopeName], 'utf8'), grammarFiles[scopeName]);
      }
      return textmate.parseRawGrammar(JSON.stringify({ scopeName, patterns: [] }), `${scopeName}.json`);
    },
  });

  // tokenize as an HTML document; the JST grammars are injected into it
  return registry.loadGrammar('text.html.basic');
}

// Tokenize every line and return flat [{text, scopes}] for non-whitespace runs.
function tokenize(grammar, source) {
  const tokensByText = [];
  let ruleStack = textmate.INITIAL;

  source.split('\n').forEach(line => {
    const result = grammar.tokenizeLine(line, ruleStack);
    result.tokens.forEach(token => {
      const text = line.slice(token.startIndex, token.endIndex);
      if (text.trim()) tokensByText.push({ text, scopes: token.scopes });
    });
    ruleStack = result.ruleStack;
  });

  return tokensByText;
}

const hasScope = (token, scope) => token.scopes.some(s => s === scope || s.startsWith(scope));
const find = (tokens, text) => tokens.find(token => token.text === text);
const findContaining = (tokens, scope) => tokens.find(token => hasScope(token, scope));

test('both grammar files are valid JSON with the expected scope names', () => {
  const injection = JSON.parse(fs.readFileSync(grammarFiles['jst.injection'], 'utf8'));
  assert.equal(injection.scopeName, 'jst.injection');
  assert.equal(injection.injectionSelector.includes('text.html'), true);
  assert.ok(injection.repository['jst-block']);

  const islands = JSON.parse(fs.readFileSync(grammarFiles['jst.islands'], 'utf8'));
  assert.equal(islands.scopeName, 'jst.islands');
  assert.equal(islands.injectionSelector, 'L:meta.embedded.block.jst');
  assert.ok(islands.repository['jst-expression']);
});

test('$(expr) is scoped as an embedded JST expression', async () => {
  const grammar = await makeGrammar();
  const tokens = tokenize(grammar, '<script type="jst" name="x-thing" props="count">\n  <div>$(count)</div>\n</script>');

  const open = find(tokens, '(');
  assert.ok(open && hasScope(open, 'punctuation.section.parens.begin.jst'), 'opening paren scoped');

  const inner = find(tokens, 'count');
  assert.ok(inner, 'expression body present');
  assert.ok(hasScope(inner, 'meta.embedded.jst.expression'), 'expression body marked embedded');
});

test('$ line directives are scoped as embedded code', async () => {
  const grammar = await makeGrammar();
  const tokens = tokenize(grammar, '<script type="jst" name="x-list" props="items">\n  $ items.forEach(item => {\n    <li>$(item)</li>\n  $ })\n</script>');

  const directive = findContaining(tokens, 'meta.embedded.jst.code');
  assert.ok(directive, 'line directive produced embedded code scope');

  // the <li> after the directive returns to markup, not code
  const li = find(tokens, 'li');
  if (li) assert.ok(!hasScope(li, 'meta.embedded.jst.code'), 'html after directive is not code');
});

test('${ ... } code blocks are scoped as embedded code', async () => {
  const grammar = await makeGrammar();
  const tokens = tokenize(grammar, '<script type="jst" name="x-b">\n  ${ const a = 1; }\n</script>');

  const brace = find(tokens, '{');
  assert.ok(brace && hasScope(brace, 'punctuation.section.braces.begin.jst'), 'opening brace scoped');
});

test('$$ is an escape, not an interpolation', async () => {
  const grammar = await makeGrammar();
  const tokens = tokenize(grammar, '<script type="jst" name="x-e">\n  price: $$5\n</script>');

  const escape = find(tokens, '$$');
  assert.ok(escape && hasScope(escape, 'constant.character.escape.dollar.jst'), '$$ scoped as escape');
});

test('$identifier interpolation is scoped as a variable', async () => {
  const grammar = await makeGrammar();
  const tokens = tokenize(grammar, '<script type="jst" name="x-i" props="name">\n  Hi $name\n</script>');

  const variable = findContaining(tokens, 'variable.other.jst');
  assert.ok(variable, 'identifier interpolation scoped as variable');
});

test('.prop and on<event> binding attributes are scoped distinctly', async () => {
  const grammar = await makeGrammar();
  const tokens = tokenize(grammar, '<script type="jst" name="x-bind" props="item">\n  <input .checked="$(item.done)" onchange="$(() => el.emit(\'t\'))">\n</script>');

  const attrNames = tokens.filter(token => hasScope(token, 'entity.other.attribute-name.jst')).map(token => token.text);
  assert.ok(attrNames.includes('checked'), 'prop binding name scoped');
  assert.ok(attrNames.includes('onchange'), 'event binding name scoped');

  const sigils = tokens.filter(token => hasScope(token, 'punctuation.definition.jst.binding')).map(token => token.text);
  assert.ok(sigils.includes('.'), 'prop sigil scoped');
});

test('a dotted on<event> modifier tail is part of the event attribute name', async () => {
  const grammar = await makeGrammar();
  const tokens = tokenize(grammar, '<script type="jst" name="x-mod">\n  <form onsubmit.prevent="$(() => el.emit(\'go\'))"></form>\n</script>');

  const attrNames = tokens.filter(token => hasScope(token, 'entity.other.attribute-name.jst')).map(token => token.text);
  assert.ok(attrNames.includes('onsubmit.prevent'), 'modifier tail scoped with the event name');

  const embedded = findContaining(tokens, 'meta.embedded.jst.expression');
  assert.ok(embedded, 'expression inside the modified handler is marked embedded JST');
});

test('islands fire inside an attribute binding, not just text content', async () => {
  // the regression that motivated the two-grammar split: $(...) inside
  // on<event>="..." must still tokenize as embedded JST, not flat string.
  const grammar = await makeGrammar();
  const tokens = tokenize(grammar, '<script type="jst" name="x-a" props="count">\n  <button onclick="$(() => el.emit(\'go\', count))">x</button>\n</script>');

  const attrNames = tokens.filter(token => hasScope(token, 'entity.other.attribute-name.jst')).map(token => token.text);
  assert.ok(attrNames.includes('onclick'), 'event attribute name scoped inside the tag');

  const embedded = findContaining(tokens, 'meta.embedded.jst.expression');
  assert.ok(embedded, 'expression inside the attribute value is marked embedded JST');
});

test('the <script> open and close tags are recognized', async () => {
  const grammar = await makeGrammar();
  const tokens = tokenize(grammar, '<script type="jst" name="x-s">\n  hello\n</script>');

  const tagNames = tokens.filter(token => hasScope(token, 'entity.name.tag')).map(token => token.text);
  assert.ok(tagNames.includes('script'), 'script tag name scoped');
});
