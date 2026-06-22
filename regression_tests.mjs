/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */

/**
 * Regression net for verified silent-failure bugs. Each test pins behaviour
 * that previously miscompiled quietly. The design posture is fail-loud: wrong
 * authoring should produce a thrown error or a visibly different token stream,
 * never plausible-but-wrong output. These run at the compiler layer (no DOM).
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { parseTemplateScript } from './parser.js'
import { interpretTemplateTokens } from './interpreter.js'
import {
  JsIdentifierToken,
  JsExpressionToken,
} from './tokens.js'

const tokensOf = src => parseTemplateScript(src).tokens

test('bare $identifier keeps digits ($item1 is one identifier, not $item + "1")', () => {
  const idents = tokensOf('<p>$item1 done</p>').filter(t => t instanceof JsIdentifierToken)
  assert.equal(idents.length, 1)
  assert.equal(idents[0].identifier, 'item1')
})

// --- JS-token-aware $(...) scanner: a delimiter inside a string / template /
//     regex / comment must not end the expression early, and division must not
//     be mistaken for a regex. The expected string is the exact inner content.
const exprsOf = src => tokensOf(src).filter(t => t instanceof JsExpressionToken).map(t => t.expression)

const balancerCases = [
  ['regex with ) } ] and flags',        'list.filter(x => /[)}\\]]/g.test(x)).length'],
  ['regex char class containing a slash', '/[/]/.test(s)'],
  ['regex after a keyword (return)',     '(s => { return /a\\/b/.test(s) })("x")'],
  ['division is not a regex',            'a / b / c'],
  ['division after a paren',             '(a + b) / 2'],
  ['template text with ) and ${ f() }',  '`hi :) ${ count + 1 } bye`'],
  ['nested template literals',           'tag`a ${ inner(`b ${1}`) } c`'],
  ['string hiding a comment and )',      "'a /* not */ ) ' + x"],
  ['block comment hiding ) and quotes',  'a /* ) \' " / */ + b'],
  ['line comment hiding )',              'count // ) note\n + 1'],
]

for (const [label, inner] of balancerCases) {
  test(`$(...) scanner: ${label}`, () => {
    const exprs = exprsOf(`<p>$(${inner})X</p>`)
    assert.equal(exprs.length, 1, 'expected exactly one expression token')
    assert.equal(exprs[0], inner, 'expression should capture the full inner content')
    // and the literal HTML after the close paren must be intact
    assert.match(tokensOf(`<p>$(${inner})X</p>`).map(t => t.html ?? '').join(''), /X<\/p>/)
  })
}

// --- `$ line` directive scanner: same token-awareness as the balancer ---
const codeOf = src => tokensOf(src).filter(t => t.constructor.name === 'JsCodeToken').map(t => t.code)

test('$ line: a regex containing < and $ does not terminate the directive early', () => {
  assert.match(codeOf('$ const r = /<div>/.test(s)\n')[0], /\/<div>\/\.test\(s\)/)
  assert.match(codeOf('$ const r = /\\$\\d+/.test(s)\n')[0], /\.test\(s\)$/)
})

test('$ line: a<b is a comparison, not an HTML tag', () => {
  assert.match(codeOf('$ if (a<b) {\n')[0], /if \(a<b\) \{/)
})

test('$ line: inline HTML after { still starts HTML (feature preserved)', () => {
  const tokens = tokensOf('$ items.forEach(i => { <li>$(i)</li> $ })\n')
  const code = tokens.filter(t => t.constructor.name === 'JsCodeToken').map(t => t.code)
  const html = tokens.filter(t => t.constructor.name === 'HtmlToken').map(t => t.html).join('')
  assert.match(code[0], /forEach\(i => \{/) // code stops at the brace
  assert.match(html, /<li>/)                // <li> is lexed as HTML, not code
})

test('${ } block scanner handles the same hazards', () => {
  // a ${...} code block whose body contains a regex with a brace and a template
  const code = tokensOf('<p>${ const r = /[}]/.test(`a ${x}`) }after</p>')
    .filter(t => t.constructor.name === 'JsCodeToken')
  assert.equal(code.length, 1)
  assert.match(code[0].code, /\.test/)
  assert.match(tokensOf('<p>${ const r = /[}]/.test(`a ${x}`) }after</p>').map(t => t.html ?? '').join(''), /after<\/p>/)
})

test('a regex literal with ) inside does not truncate a $(...) expression', () => {
  const exprs = tokensOf('<p>$(list.filter(x => /)/.test(x)).length)</p>')
    .filter(t => t instanceof JsExpressionToken)
  assert.equal(exprs.length, 1)
  assert.equal(exprs[0].expression, 'list.filter(x => /)/.test(x)).length')
})

test('a // line comment with ) inside does not truncate a $(...) expression', () => {
  const exprs = tokensOf('<p>$(count // a ) note\n + 1)</p>')
    .filter(t => t instanceof JsExpressionToken)
  assert.equal(exprs.length, 1)
  assert.match(exprs[0].expression, /\+ 1/)
})

test('$ inside an HTML comment is inert (not interpolated)', () => {
  const tokens = tokensOf('<!-- $price is hidden --><p>$(price)</p>')
  // the comment must not produce any JS token
  assert.equal(tokens.filter(t => t instanceof JsIdentifierToken).length, 0)
  // the real interpolation outside the comment still works
  assert.equal(tokens.filter(t => t instanceof JsExpressionToken).length, 1)
})

test('a malformed .prop binding throws at compile time instead of degrading to a string', () => {
  assert.throws(
    () => interpretTemplateTokens(tokensOf('<x .items="$(a)$(b)"></x>')),
    /items=.*exactly one/,
  )
})

test('a malformed on* event binding (text around the expression) throws at compile time', () => {
  assert.throws(
    () => interpretTemplateTokens(tokensOf('<button onclick="run $(fn)">x</button>')),
    /onclick=.*exactly one/,
  )
})

test('raw inline JavaScript in an on* handler is rejected at compile time', () => {
  assert.throws(
    () => interpretTemplateTokens(tokensOf('<button onclick="alert(1)">x</button>')),
    /Raw inline JavaScript/,
  )
})

test('the removed @event syntax throws a migration error pointing at on<event>', () => {
  assert.throws(
    () => interpretTemplateTokens(tokensOf('<button @click="$(fn)">x</button>')),
    /@click=.*was removed.*onclick=/s,
  )
})

test('on<event> compiles to an event binding with the on prefix stripped', () => {
  const body = interpretTemplateTokens(tokensOf('<button onclick="$(handler)">x</button>'))
  assert.match(body, /__bind\("event", "click", \(handler\)\)/)
})

test('on<event> modifiers are preserved on the event descriptor', () => {
  const body = interpretTemplateTokens(tokensOf('<form onsubmit.prevent="$(save)"></form>'))
  assert.match(body, /__bind\("event", "submit\.prevent", \(save\)\)/)
})

test('a well-formed .prop binding still compiles cleanly', () => {
  assert.doesNotThrow(() => interpretTemplateTokens(tokensOf('<x .items="$(rows)"></x>')))
})

test('an on* handler whose event name does not start with a letter is rejected', () => {
  assert.throws(
    () => interpretTemplateTokens(tokensOf('<x on3d-ready="$(fn)"></x>')),
    /on3d-ready=.*not a valid JST event handler.*must start with a letter/s,
  )
  assert.throws(
    () => interpretTemplateTokens(tokensOf('<x on-foo="$(fn)"></x>')),
    /on-foo=.*must start with a letter/s,
  )
})

test('a hyphenated custom event whose name starts with a letter still binds', () => {
  const body = interpretTemplateTokens(tokensOf('<x-c onitem-selected="$(fn)"></x-c>'))
  assert.match(body, /__bind\("event", "item-selected", \(fn\)\)/)
})

test('on* / .prop sequences in template text are not misread as bindings', () => {
  // `online="$(x)"` in body text must not bind an `line` event, and must not throw.
  const a = interpretTemplateTokens(tokensOf('<p>plan: online="$(x)" today</p>'))
  assert.doesNotMatch(a, /__bind\("event"/)
  // bare `online="x"` prose must not be rejected as a raw on* handler.
  assert.doesNotThrow(() => interpretTemplateTokens(tokensOf('<p>status online="active" now</p>')))
  // `.foo="$(x)"` in text must not bind a prop.
  const b = interpretTemplateTokens(tokensOf('<p>ratio .foo="$(x)" end</p>'))
  assert.doesNotMatch(b, /__bind\("prop"/)
})

test('an on* attribute in tag position is reserved for handlers (binds even for on-words)', () => {
  const body = interpretTemplateTokens(tokensOf('<el online="$(handler)"></el>'))
  assert.match(body, /__bind\("event", "line", \(handler\)\)/)
})

test('a > inside an earlier quoted attribute value does not defeat a later binding', () => {
  const body = interpretTemplateTokens(tokensOf('<a title="x>y" onclick="$(fn)">z</a>'))
  assert.match(body, /__bind\("event", "click", \(fn\)\)/)
})

test('every binding on one element is captured (tag state crosses chunks)', () => {
  // The opening `<` of the 2nd/3rd binding lives in an earlier chunk (split by the
  // preceding $(…) value), so tag-position must be tracked across chunks.
  const body = interpretTemplateTokens(tokensOf('<input .value="$(v)" oninput="$(a)" onblur="$(b)">'))
  assert.match(body, /__bind\("prop", "value", \(v\)\)/)
  assert.match(body, /__bind\("event", "input", \(a\)\)/)
  assert.match(body, /__bind\("event", "blur", \(b\)\)/)
})

test('a binding after an interpolated attribute value is still captured', () => {
  const body = interpretTemplateTokens(tokensOf('<div class="$(c)" onclick="$(fn)">x</div>'))
  assert.match(body, /__bind\("event", "click", \(fn\)\)/)
})
