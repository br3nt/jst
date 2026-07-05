/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
import {
  HtmlToken,
  JsCodeToken,
  JsBlockToken,
  Escaped$Token,
  JsExpressionToken,
  JsIdentifierToken,
  WhitespaceToken,
} from './tokens.js'

/**
 * Consecutive `$ line` code directives (and the whitespace between them) merge
 * into one code block so multi-line statements compile as a unit. Interpolation
 * tokens ($(expr), $identifier) are output instructions and never merge.
 */
function mergeJsTokens(templateTokens) {
  const processedTokens = []

  for (let i = 0; i < templateTokens.length; i++) {
    const token = templateTokens[i]
    const last = processedTokens[processedTokens.length - 1]

    if (token instanceof JsCodeToken && last instanceof JsCodeToken
      && !(token instanceof JsBlockToken) && !(last instanceof JsBlockToken)) {
      last.code += ' ' + token.code
      continue
    }

    const isWhitespaceOnly = token instanceof WhitespaceToken
      || (token instanceof HtmlToken && !/[^\s]/.test(token.html))

    if (isWhitespaceOnly) {
      const next = templateTokens[i + 1]
      const ws = token.whitespace ?? token.html

      if (last instanceof JsCodeToken && next instanceof JsCodeToken
        && !(last instanceof JsBlockToken) && !(next instanceof JsBlockToken)) {
        last.code += ws
        continue
      }

      processedTokens.push(token instanceof WhitespaceToken ? token : new WhitespaceToken(token.html))
      continue
    }

    processedTokens.push(token)
  }

  return processedTokens
}

// Tag-position binding attributes:
//   `.prop="$(expr)"`     the value is a single $(…) expression, assigned as a
//                         JS property after morphing
//   `onevent="body"`      the value is a plain FUNCTION BODY (same contract as
//                         a native inline handler: `event` in scope, `this` is
//                         the element) — compiled in render scope and attached
//                         with addEventListener after morphing. $()/$-forms do
//                         not apply inside handler bodies (v0.6.0).
// Event handlers use the native `on<event>` attribute name with an optional
// dotted REGISTRATION-modifier tail (`onclick.outside`, `onscroll.passive`);
// behaviour is plain JS in the body (statement combinators like debounce/keys).
// `on*` is reserved for handlers: the opener matches any `on…` name (not just
// valid ones) so an invalid handler — an event name that does not start with a
// letter, e.g. `on3d-ready` — fails loud instead of silently degrading to a
// literal attribute.
const bindingNamePattern = '(\\.[a-zA-Z_$][\\w$-]*(?:\\.[\\w$-]+)*|on[\\w$-]+(?:\\.[\\w$-]+)*)'
// At the very end of an HTML chunk: a valid opener, immediately followed by the
// $(…) expression token (which split the chunk here).
const bindingTailPattern = new RegExp(`(^|\\s)${bindingNamePattern}\\s*=\\s*(["'])$`)
// The same opener anywhere in the chunk — used to reject values that are not a
// lone $(…) expression (leading text, or raw inline JavaScript in an on* handler).
const bindingOpenerPattern = new RegExp(`(^|\\s)${bindingNamePattern}\\s*=\\s*(["'])`, 'g')
// A well-formed event handler name: `on` + a letter, then word/$/- chars, then an
// optional dotted modifier tail.
const validEventName = /^on[a-zA-Z][\w$-]*(?:\.[\w$-]+)*$/
// The only surviving modifiers — they configure listener registration
// (addEventListener options / attach point). Behaviour modifiers were removed
// in v0.5.0 in favour of the handler combinators; fail loud with the rewrite.
const allowedModifierTail = new Set(['capture', 'passive', 'once', 'outside'])
const removedModifierRewrites = {
  prevent: 'onclick="event.preventDefault(); …"',
  stop: 'onclick="event.stopPropagation(); …"',
  self: 'onclick="if (event.target !== this) return; …"',
  debounce: 'oninput="debounce(event, 300, () => …)"',
  changed: 'oninput="if (changed(event)) …"',
  enter: 'onkeydown="keys(event, { Enter: () => … })"',
  escape: 'onkeydown="keys(event, { Escape: () => … })"',
  esc: 'onkeydown="keys(event, { Escape: () => … })"',
  tab: 'onkeydown="keys(event, { Tab: () => … })"',
  space: `onkeydown="keys(event, { ' ': () => … })"`,
  up: 'onkeydown="keys(event, { ArrowUp: () => … })"',
  down: 'onkeydown="keys(event, { ArrowDown: () => … })"',
  left: 'onkeydown="keys(event, { ArrowLeft: () => … })"',
  right: 'onkeydown="keys(event, { ArrowRight: () => … })"',
}

function assertModifierTail(rawName) {
  const [, ...modifiers] = rawName.split('.')
  for (const modifier of modifiers) {
    if (allowedModifierTail.has(modifier)) continue
    if (/^\d+$/.test(modifier)) continue   // numeric tail of a removed .debounce.N
    const hint = removedModifierRewrites[modifier]
    throw new Error(hint
      ? `JST: ${rawName}="…" — the .${modifier} event modifier was removed. Write it in the handler body instead: ${hint}. Modifiers now only configure listener registration (.capture .passive .once .outside).`
      : `JST: ${rawName}="…" — ".${modifier}" is not an event modifier. Modifiers configure listener registration only (.capture .passive .once .outside); everything else is plain JS in the handler body.`)
  }
}

// The v0.5 expression-handler syntax (`onclick="$(fn)"`) was replaced by native
// function-body semantics in v0.6.0 — same contract as a browser inline handler.
function eventBodyMigrationError(rawName) {
  return new Error(`JST: ${rawName}="…" — on<event> values are plain function bodies now ($()/$-forms do not apply inside them). Write ${rawName}="fn(event)" or inline statements (event.preventDefault(); …) — run tools/codemod.mjs to migrate, and see the v0.6.0 CHANGELOG migration table.`)
}
// Legacy `@event="$(fn)"` syntax (removed): detect and point at the replacement.
const legacyEventTailPattern = /(^|\s)@([a-zA-Z][\w$-]*(?:\.[\w$-]+)*)\s*=\s*["']$/
// Tag-position on<event> attribute opener (value = a plain function body).
const eventAttributePattern = /(^|\s)(on[a-zA-Z][\w$-]*(?:\.[\w$]+)*)\s*=\s*(["'])/g
const htmlTagInCodePattern = /<\/?[A-Za-z][\w:-]*(?:\s|>|\/)/g
const regexKeywords = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'do',
  'else',
  'yield',
  'await',
  'case',
  'throw',
])

function skipQuoted(source, index, quote) {
  index++
  while (index < source.length) {
    const ch = source[index]
    if (ch === '\\') {
      index += 2
      continue
    }
    if (ch === quote) return index + 1
    if (ch === '\n' || ch === '\r') return index
    index++
  }
  return index
}

function skipLineComment(source, index) {
  while (index < source.length && source[index] !== '\n' && source[index] !== '\r') index++
  return index
}

function skipBlockComment(source, index) {
  index += 2
  while (index < source.length) {
    if (source[index] === '*' && source[index + 1] === '/') return index + 2
    index++
  }
  return index
}

function skipRegexLiteral(source, index) {
  index++
  let inCharClass = false

  while (index < source.length) {
    const ch = source[index]
    if (ch === '\\') {
      index += 2
      continue
    }
    if (ch === '\n' || ch === '\r') return index
    if (ch === '[') inCharClass = true
    else if (ch === ']') inCharClass = false
    else if (ch === '/' && !inCharClass) {
      index++
      break
    }
    index++
  }

  while (/[a-z]/i.test(source[index] || '')) index++
  return index
}

function skipTemplateInterpolation(source, index) {
  let depth = 1
  const prev = { char: '', word: '' }

  while (index < source.length && depth > 0) {
    const ch = source[index]
    const next = source[index + 1]

    if (ch === '/' && next === '/') {
      index = skipLineComment(source, index)
      prev.char = ''
      prev.word = ''
      continue
    }
    if (ch === '/' && next === '*') {
      index = skipBlockComment(source, index)
      prev.char = ''
      prev.word = ''
      continue
    }
    if (ch === '/' && regexAllowedAfter(prev)) {
      index = skipRegexLiteral(source, index)
      prev.char = ')'
      prev.word = ''
      continue
    }
    if (ch === "'" || ch === '"') {
      index = skipQuoted(source, index, ch)
      prev.char = ')'
      prev.word = ''
      continue
    }
    if (ch === '`') {
      index = skipTemplateLiteral(source, index)
      prev.char = ')'
      prev.word = ''
      continue
    }

    if (ch === '{') depth++
    else if (ch === '}') depth--

    index++
    advancePrev(prev, ch)
  }

  return index
}

function skipTemplateLiteral(source, index) {
  index++
  while (index < source.length) {
    const ch = source[index]
    if (ch === '\\') {
      index += 2
      continue
    }
    if (ch === '`') return index + 1
    if (ch === '$' && source[index + 1] === '{') {
      index += 2
      index = skipTemplateInterpolation(source, index)
      continue
    }
    index++
  }
  return index
}

function regexAllowedAfter(prev) {
  if (prev.char === '') return true
  if (/[)\]'"`]/.test(prev.char)) return false
  if (/[\w$.]/.test(prev.char)) return regexKeywords.has(prev.word)
  return true
}

function advancePrev(prev, ch) {
  if (/\s/.test(ch)) return
  prev.char = ch
  prev.word = /[\w$]/.test(ch) ? prev.word + ch : ''
}

function htmlTagInCode(code) {
  const prev = { char: '', word: '' }
  for (let i = 0; i < code.length;) {
    const ch = code[i]
    const next = code[i + 1]

    if (ch === '/' && next === '/') {
      i = skipLineComment(code, i)
      prev.char = ''
      prev.word = ''
      continue
    }
    if (ch === '/' && next === '*') {
      i = skipBlockComment(code, i)
      prev.char = ''
      prev.word = ''
      continue
    }
    if (ch === '/' && regexAllowedAfter(prev)) {
      i = skipRegexLiteral(code, i)
      prev.char = ')'
      prev.word = ''
      continue
    }
    if (ch === "'" || ch === '"') {
      i = skipQuoted(code, i, ch)
      prev.char = ')'
      prev.word = ''
      continue
    }
    if (ch === '`') {
      i = skipTemplateLiteral(code, i)
      prev.char = ')'
      prev.word = ''
      continue
    }

    htmlTagInCodePattern.lastIndex = i
    const match = htmlTagInCodePattern.exec(code)
    if (match && match.index === i) return match[0]

    i++
    advancePrev(prev, ch)
  }

  return null
}

function assertNoHtmlWrappedByJsBlock(token) {
  if (!(token instanceof JsBlockToken)) return
  const tag = htmlTagInCode(token.code)
  if (!tag) return
  throw new Error(`JST: control flow wrapping HTML must use the \`$ if (...) {\` / \`$ }\` line form, not \`\${ ... }\`. The \`\${ ... }\` block form is only for JavaScript with no template HTML (found "${tag.trim()}").`)
}

function classifyBindingName(rawName) {
  if (rawName[0] === '.') return { kind: 'prop', name: rawName.slice(1) }
  return { kind: 'event', name: rawName.slice(2) }
}

// Binding openers are only meaningful in tag-attribute position. Tag/quote state
// is tracked ACROSS chunks (a `$(…)` value splits one element's start tag into
// several HtmlTokens, so the opening `<` of a later binding lives in an earlier
// chunk), and a `>` inside a quoted attribute value does not close the tag. This
// lets an `on…="…"` / `.x="…"` sequence sitting in template *text* be left as
// literal text rather than misread as a binding, while still recognising the 2nd,
// 3rd, … binding on the same element.
function advanceTagState(state, html) {
  for (let i = 0; i < html.length; i++) {
    const ch = html[i]
    if (state.quote) {
      if (ch === state.quote) state.quote = null
    } else if (!state.inTag) {
      if (ch === '<') state.inTag = true
    } else if (ch === '"' || ch === "'") {
      state.quote = ch
    } else if (ch === '>') {
      state.inTag = false
    }
  }
  return state
}

// Are we inside an open tag at `nameStart`, given the state entering this chunk?
function inOpenTagAt(state, html, nameStart) {
  return advanceTagState({ inTag: state.inTag, quote: state.quote }, html.slice(0, nameStart)).inTag
}

// Validate binding openers in tag-attribute position. For `.prop` bindings a
// valid opener sits at the very end of its HTML chunk (the $(…) value token
// splits the chunk there); a non-empty remainder means the value is not a lone
// $(…) expression. For `on*` handlers the value is a plain function body that
// must CLOSE within this chunk — a value split by a $-form is the removed v0.5
// expression syntax and fails loud with the migration hint. Openers in text
// content are ignored (left as literal text).
function assertNoInvalidBinding(html, state) {
  bindingOpenerPattern.lastIndex = 0
  let match
  while ((match = bindingOpenerPattern.exec(html))) {
    const [, leading, rawName, quote] = match
    const nameStart = match.index + leading.length
    if (!inOpenTagAt(state, html, nameStart)) continue

    const isEvent = rawName[0] !== '.'
    if (isEvent) {
      if (!validEventName.test(rawName)) {
        throw new Error(`JST: ${rawName}="…" is not a valid JST event handler — an on<event> name must start with a letter (got event "${rawName.slice(2)}").`)
      }
      assertModifierTail(rawName)
      const remainder = html.slice(bindingOpenerPattern.lastIndex)
      if (!remainder.includes(quote)) throw eventBodyMigrationError(rawName)
      continue
    }

    const remainder = html.slice(bindingOpenerPattern.lastIndex)
    if (remainder.length === 0) continue
    throw new Error(`JST: ${rawName}="…" must contain exactly one $(…) expression and nothing else inside the quotes.`)
  }
}

function assertNoLegacyEventBinding(token, expressionToken, state) {
  const match = token.html.match(legacyEventTailPattern)
  if (!match || !(expressionToken instanceof JsExpressionToken)) return
  const nameStart = token.html.length - match[0].length + match[1].length
  if (!inOpenTagAt(state, token.html, nameStart)) return
  throw new Error(`JST: the @${match[2]}="…" event syntax was removed. Use on${match[2]}="…" instead.`)
}

function matchBinding(tokens, i, state) {
  const token = tokens[i]
  const expressionToken = tokens[i + 1]
  const closingToken = tokens[i + 2]

  if (!(token instanceof HtmlToken)) return null

  assertNoInvalidBinding(token.html, state)
  assertNoLegacyEventBinding(token, expressionToken, state)

  const match = token.html.match(bindingTailPattern)
  if (!match) return null

  const [fullMatch, leading, rawName, quote] = match
  const nameStart = token.html.length - fullMatch.length + leading.length
  if (!inOpenTagAt(state, token.html, nameStart)) return null

  const { kind, name } = classifyBindingName(rawName)
  // Defensive: on* openers whose value hits a $-form are rejected by
  // assertNoInvalidBinding above; only .prop bindings take the expression path.
  if (kind === 'event') throw eventBodyMigrationError(rawName)

  if (!(expressionToken instanceof JsExpressionToken)
    || !(closingToken instanceof HtmlToken)
    || !closingToken.html.startsWith(quote)) {
    throw new Error(`JST: ${rawName}="…" must contain exactly one $(…) expression and nothing else inside the quotes.`)
  }

  return {
    kind,
    name,
    expression: expressionToken.expression,
    htmlPrefix: token.html.slice(0, token.html.length - fullMatch.length + leading.length),
    htmlSuffix: closingToken.html.slice(1),
  }
}

// Emit an HTML chunk, lifting tag-position `on<event>="body"` attributes into
// event bindings. The body text is spliced verbatim into the compiled render
// function as `function (event) { body }` — evaluated in render scope (so
// template params close over live values), attached with addEventListener (so
// `this` is the element), exactly the native inline-handler contract.
function emitHtmlChunk(html, state, instructions) {
  eventAttributePattern.lastIndex = 0
  let emitted = 0
  let match
  while ((match = eventAttributePattern.exec(html))) {
    const nameStart = match.index + match[1].length
    if (!inOpenTagAt(state, html, nameStart)) continue
    const rawName = match[2]
    if (!validEventName.test(rawName)) continue   // assertNoInvalidBinding already threw for tag position
    const quote = match[3]
    const valueStart = eventAttributePattern.lastIndex
    const valueEnd = html.indexOf(quote, valueStart)
    if (valueEnd === -1) break                    // split by a $-form — assertNoInvalidBinding threw
    const body = html.slice(valueStart, valueEnd)
    if (body.trim()) {
      assertModifierTail(rawName)
      instructions.push(`lines.push(${JSON.stringify(html.slice(emitted, nameStart))});`)
      instructions.push(`lines.push(__bind("event", ${JSON.stringify(rawName.slice(2))}, function (event) { ${body} }));`)
      emitted = valueEnd + 1
    }
    eventAttributePattern.lastIndex = valueEnd + 1
  }
  const tail = html.slice(emitted)
  if (tail) instructions.push(`lines.push(${JSON.stringify(tail)});`)
}

export function interpretTemplateTokens(templateTokens) {
  const processedTokens = mergeJsTokens(templateTokens)
  const instructions = []
  // Running HTML tag/quote state, so binding detection knows tag-attribute
  // position across chunks. Interpolation tokens ($(expr)/$identifier) emit
  // escaped text (no structural < or >) and sit inside the current quote, so
  // they do not advance the state; only literal HTML/whitespace/`$` does.
  const tagState = { inTag: false, quote: null }

  for (let i = 0; i < processedTokens.length; i++) {
    const binding = matchBinding(processedTokens, i, tagState)

    if (binding) {
      emitHtmlChunk(binding.htmlPrefix, tagState, instructions)
      instructions.push(`lines.push(__bind(${JSON.stringify(binding.kind)}, ${JSON.stringify(binding.name)}, (${binding.expression})));`)
      // The binding contributes htmlPrefix + `name="<value>"`: advance through
      // the prefix, then the attribute's value quote opens and closes (the
      // closing quote was sliced off the suffix), leaving us still in the tag.
      advanceTagState(tagState, binding.htmlPrefix)
      tagState.quote = null
      processedTokens[i + 2] = new HtmlToken(binding.htmlSuffix)
      i += 1 // the expression token was consumed by the binding
      continue
    }

    const token = processedTokens[i]

    if (token instanceof HtmlToken) {
      emitHtmlChunk(token.html, tagState, instructions)
      advanceTagState(tagState, token.html)
      continue
    }

    const instruction = interpretTemplateToken(token)
    if (instruction === undefined) throw new Error(`Unknown token at index ${i}: ${token.constructor.name}`)
    instructions.push(instruction)

    if (token instanceof WhitespaceToken) advanceTagState(tagState, token.whitespace)
    else if (token instanceof Escaped$Token) advanceTagState(tagState, '$')
  }

  return ['const lines = [];', ...instructions, 'return lines.join("");'].join('\n')
}

// Generated push statements end with ';' so a following user code line that
// starts with '(' or '[' cannot be swallowed by automatic semicolon insertion.
function interpretTemplateToken(token) {
  if (token instanceof HtmlToken) return `lines.push(${JSON.stringify(token.html)});`
  if (token instanceof JsCodeToken) {
    assertNoHtmlWrappedByJsBlock(token)
    return token.code
  }
  if (token instanceof Escaped$Token) return `lines.push('$');`
  if (token instanceof JsExpressionToken) return `lines.push(__esc(${token.expression}));`
  if (token instanceof JsIdentifierToken) return `lines.push(__esc(${token.identifier}));`
  if (token instanceof WhitespaceToken) return `lines.push(${JSON.stringify(token.whitespace)});`
}
