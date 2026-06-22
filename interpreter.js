/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
import {
  HtmlToken,
  JsCodeToken,
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

    if (token instanceof JsCodeToken && last instanceof JsCodeToken) {
      last.code += ' ' + token.code
      continue
    }

    const isWhitespaceOnly = token instanceof WhitespaceToken
      || (token instanceof HtmlToken && !/[^\s]/.test(token.html))

    if (isWhitespaceOnly) {
      const next = templateTokens[i + 1]
      const ws = token.whitespace ?? token.html

      if (last instanceof JsCodeToken && next instanceof JsCodeToken) {
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
// prefix is stripped to recover the event descriptor.
const bindingName = '(\\.[a-zA-Z_$][\\w$-]*(?:\\.[\\w$-]+)*|on[a-zA-Z][\\w$-]*(?:\\.[\\w$-]+)*)'
// At the very end of an HTML chunk: a valid opener, immediately followed by the
// $(…) expression token (which split the chunk here).
const bindingTailPattern = new RegExp(`(^|\\s)${bindingName}\\s*=\\s*(["'])$`)
// The same opener anywhere in the chunk — used to reject values that are not a
// lone $(…) expression (leading text, or raw inline JavaScript in an on* handler).
const bindingOpenerPattern = new RegExp(`(^|\\s)${bindingName}\\s*=\\s*(["'])`, 'g')
// Legacy `@event="$(fn)"` syntax (removed): detect and point at the replacement.
const legacyEventTailPattern = /(^|\s)@([a-zA-Z][\w$-]*(?:\.[\w$-]+)*)\s*=\s*["']$/

function classifyBindingName(rawName) {
  if (rawName[0] === '.') return { kind: 'prop', name: rawName.slice(1) }
  return { kind: 'event', name: rawName.slice(2) }
}

// A valid binding opener sits at the very end of its HTML chunk, because the
// $(…) value token splits the chunk there. Any opener with trailing content in
// the same chunk means the value is not a lone $(…) expression — leading literal
// text (`onclick="run $(fn)"`) or raw inline JavaScript (`onclick="alert(1)"`).
// Fail loud rather than silently degrading the binding to a string attribute.
function assertNoInvalidBinding(html) {
  bindingOpenerPattern.lastIndex = 0
  let match
  while ((match = bindingOpenerPattern.exec(html))) {
    const [, , rawName, quote] = match
    const remainder = html.slice(bindingOpenerPattern.lastIndex)
    if (remainder.length === 0) continue

    const isEvent = rawName[0] !== '.'
    if (isEvent && remainder.includes(quote)) {
      throw new Error(`JST: ${rawName}="…" must be a single $(…) expression. Raw inline JavaScript in on* handlers is not allowed; wrap the handler in $(…).`)
    }
    throw new Error(`JST: ${rawName}="…" must contain exactly one $(…) expression and nothing else inside the quotes.`)
  }
}

function assertNoLegacyEventBinding(token, expressionToken) {
  const match = token.html.match(legacyEventTailPattern)
  if (match && expressionToken instanceof JsExpressionToken) {
    throw new Error(`JST: the @${match[2]}="…" event syntax was removed. Use on${match[2]}="…" instead.`)
  }
}

function matchBinding(tokens, i) {
  const token = tokens[i]
  const expressionToken = tokens[i + 1]
  const closingToken = tokens[i + 2]

  if (!(token instanceof HtmlToken)) return null

  assertNoInvalidBinding(token.html)
  assertNoLegacyEventBinding(token, expressionToken)

  const match = token.html.match(bindingTailPattern)
  if (!match) return null

  const [fullMatch, leading, rawName, quote] = match
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

  for (let i = 0; i < processedTokens.length; i++) {
    const binding = matchBinding(processedTokens, i)

    if (binding) {
      instructions.push(`lines.push(${JSON.stringify(binding.htmlPrefix)});`)
      instructions.push(`lines.push(__bind(${JSON.stringify(binding.kind)}, ${JSON.stringify(binding.name)}, (${binding.expression})));`)
      processedTokens[i + 2] = new HtmlToken(binding.htmlSuffix)
      i += 1 // the expression token was consumed by the binding
      continue
    }

    const token = processedTokens[i]
    const instruction = interpretTemplateToken(token)
    if (instruction === undefined) throw new Error(`Unknown token at index ${i}: ${token.constructor.name}`)
    instructions.push(instruction)
  }

  return ['const lines = [];', ...instructions, 'return lines.join("");'].join('\n')
}

// Generated push statements end with ';' so a following user code line that
// starts with '(' or '[' cannot be swallowed by automatic semicolon insertion.
function interpretTemplateToken(token) {
  if (token instanceof HtmlToken) return `lines.push(${JSON.stringify(token.html)});`
  if (token instanceof JsCodeToken) return token.code
  if (token instanceof Escaped$Token) return `lines.push('$');`
  if (token instanceof JsExpressionToken) return `lines.push(__esc(${token.expression}));`
  if (token instanceof JsIdentifierToken) return `lines.push(__esc(${token.identifier}));`
  if (token instanceof WhitespaceToken) return `lines.push(${JSON.stringify(token.whitespace)});`
}
