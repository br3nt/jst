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

// Tag-position binding attributes whose value is a single $(…) expression:
//   `.prop="$(expr)"`     assigns the value as a JS property after morphing
//   `onevent="$(fn)"`     attaches the value with addEventListener after morphing
// Event handlers use the native `on<event>` attribute name with an optional
// dotted modifier tail (`onclick.stop`, `onkeydown.enter.prevent`); the `on`
// prefix is stripped to recover the event descriptor. `on*` is reserved for
// handlers: the opener matches any `on…` name (not just valid ones) so an invalid
// handler — an event name that does not start with a letter, e.g. `on3d-ready` —
// fails loud instead of silently degrading to a literal attribute.
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
// Legacy `@event="$(fn)"` syntax (removed): detect and point at the replacement.
const legacyEventTailPattern = /(^|\s)@([a-zA-Z][\w$-]*(?:\.[\w$-]+)*)\s*=\s*["']$/
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

// A valid binding opener sits at the very end of its HTML chunk, because the
// $(…) value token splits the chunk there. For openers in tag-attribute position:
//   - an `on*` name that is not a valid event handler is rejected outright;
//   - a non-empty remainder means the value is not a lone $(…) expression —
//     leading literal text (`onclick="run $(fn)"`) or raw inline JavaScript
//     (`onclick="alert(1)"`).
// Openers in text content are ignored (left as literal text). Fail loud rather
// than silently degrading a binding to a string attribute.
function assertNoInvalidBinding(html, state) {
  bindingOpenerPattern.lastIndex = 0
  let match
  while ((match = bindingOpenerPattern.exec(html))) {
    const [, leading, rawName, quote] = match
    const nameStart = match.index + leading.length
    if (!inOpenTagAt(state, html, nameStart)) continue

    const isEvent = rawName[0] !== '.'
    if (isEvent && !validEventName.test(rawName)) {
      throw new Error(`JST: ${rawName}="…" is not a valid JST event handler — an on<event> name must start with a letter (got event "${rawName.slice(2)}").`)
    }

    const remainder = html.slice(bindingOpenerPattern.lastIndex)
    if (remainder.length === 0) continue

    if (isEvent && remainder.includes(quote)) {
      throw new Error(`JST: ${rawName}="…" must be a single $(…) expression. Raw inline JavaScript in on* handlers is not allowed; wrap the handler in $(…).`)
    }
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
      instructions.push(`lines.push(${JSON.stringify(binding.htmlPrefix)});`)
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
    const instruction = interpretTemplateToken(token)
    if (instruction === undefined) throw new Error(`Unknown token at index ${i}: ${token.constructor.name}`)
    instructions.push(instruction)

    if (token instanceof HtmlToken) advanceTagState(tagState, token.html)
    else if (token instanceof WhitespaceToken) advanceTagState(tagState, token.whitespace)
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
