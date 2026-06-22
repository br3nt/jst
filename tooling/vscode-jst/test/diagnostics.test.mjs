/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDiagnostics } from '../src/diagnostics.mjs';
import { findJstBlocks, positionAt } from '../src/jst-blocks.mjs';

const wrap = (attrs, body) => `<!DOCTYPE html>\n<body>\n<script type="jst" ${attrs}>${body}</script>\n</body>`;

test('a well-formed template produces no diagnostics', () => {
  const text = wrap('name="x-ok" props="count"', '<div>$(count + 1)</div>');
  assert.deepEqual(computeDiagnostics(text), []);
});

test('a name without a hyphen is flagged', () => {
  const text = wrap('name="counter"', '<div>hi</div>');
  const diagnostics = computeDiagnostics(text);
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0].message, /must contain a hyphen/);
  assert.equal(diagnostics[0].severity, 1);
});

test('a missing name is flagged', () => {
  const text = '<script type="jst">\n<div>hi</div>\n</script>';
  const diagnostics = computeDiagnostics(text);
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0].message, /missing a name/);
});

test('duplicate template names warn on the second definition', () => {
  const text = [
    '<script type="jst" name="x-dup"><div>one</div></script>',
    '<script type="jst" name="x-dup"><div>two</div></script>',
  ].join('\n');
  const diagnostics = computeDiagnostics(text);
  const dup = diagnostics.filter(d => /Duplicate template name/.test(d.message));
  assert.equal(dup.length, 1);
  assert.equal(dup[0].severity, 2);
});

test('an unbalanced $( is reported with a position inside the block', () => {
  // body spans two lines; the error is on the second inner line
  const body = '\n  <div>$(count</div>\n';
  const text = wrap('name="x-bad" props="count"', body);
  const diagnostics = computeDiagnostics(text);

  const parseError = diagnostics.find(d => d.severity === 1 && !/hyphen|name/.test(d.message));
  assert.ok(parseError, 'expected a parse/compile error');
  // the <script> open tag is on document line 2 (0-based), body starts after it;
  // the error line should be at or beyond the block, never at line 0.
  assert.ok(parseError.range.start.line >= 2, 'error mapped into the document, not the origin');
});

test('a JavaScript syntax error in an expression is surfaced', () => {
  const text = wrap('name="x-js"', '<div>$(1 +)</div>');
  const diagnostics = computeDiagnostics(text);
  const jsError = diagnostics.find(d => /JavaScript error|Unexpected|token/i.test(d.message));
  assert.ok(jsError, 'expected a JS-level error from V8');
});

test('single-line block: a positioned error stays on the block line', () => {
  // "$%" makes the lexer croak ("Unexpected character after $") with a position
  const text = 'line0\nline1\n<script type="jst" name="x-pos">$%</script>';
  const blocks = findJstBlocks(text);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].openTagPosition.line, 2);
  assert.equal(blocks[0].innerPosition.line, 2);

  const error = computeDiagnostics(text).find(d => d.severity === 1);
  assert.ok(error, 'expected a positioned lexer error');
  assert.equal(error.range.start.line, 2, 'error mapped onto the block line');
});

test('multi-line block: a positioned error maps to the right inner line', () => {
  // open tag on doc line 2; the "$%" sits on the third document line (inner line 2)
  const text = 'line0\nline1\n<script type="jst" name="x-pos">\n  bad $% here\n</script>';
  const error = computeDiagnostics(text).find(d => d.severity === 1);
  assert.ok(error, 'expected a positioned lexer error');
  assert.equal(error.range.start.line, 3, 'error mapped to the inner line, offset from the block');
});

test('declared props are extracted from the open tag', () => {
  const text = wrap('name="todo-item" props="item onToggle"', '<div>$(item)</div>');
  const block = findJstBlocks(text)[0];
  assert.deepEqual(block.params.sort(), ['item', 'onToggle'].sort());
});

test('reserved prop names are diagnostics', () => {
  const text = wrap('name="x-bad" props="item emit"', '<div>$(item)</div>');
  const diagnostics = computeDiagnostics(text);
  assert.ok(diagnostics.some(d => /Invalid JST prop "emit"/.test(d.message)));
});

test('malformed property bindings are diagnostics', () => {
  const text = wrap('name="x-bad" props="a b"', '<x-child .items="$(a)$(b)"></x-child>');
  const diagnostics = computeDiagnostics(text);
  assert.ok(diagnostics.some(d => /exactly one/.test(d.message)));
});

test('raw inline JavaScript in an on* handler is flagged', () => {
  // the runtime rejects on*="..." values that are not a single $(…) expression
  const text = wrap('name="x-on"', '<button onclick="alert(1)">x</button>');
  const diagnostics = computeDiagnostics(text);
  const error = diagnostics.find(d => d.severity === 1);
  assert.ok(error, 'expected a compile error for raw inline JS in an on* handler');
  assert.match(error.message, /\$\(/);
});

test('an on* handler wrapping a single $(…) expression is accepted', () => {
  const text = wrap('name="x-on" props="handler"', '<button onclick="$(handler)">x</button>');
  assert.deepEqual(computeDiagnostics(text), []);
});

test('positionAt computes line and character', () => {
  const text = 'ab\ncde\nf';
  assert.deepEqual(positionAt(text, 0), { line: 0, character: 0 });
  assert.deepEqual(positionAt(text, 4), { line: 1, character: 1 });
  assert.deepEqual(positionAt(text, 7), { line: 2, character: 0 });
});
