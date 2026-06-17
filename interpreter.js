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

// Matches a tag-position binding prefix at the end of an HTML chunk:
//   `.prop="` assigns the expression value as a JS property after morphing
//   `@event="` attaches the expression value with addEventListener after morphing
const bindingTailPattern = /(^|\s)([.@])([a-zA-Z_$][\w$-]*(?:\.[\w$-]+)*)\s*=\s*(["'])$/
// Same opener, but anywhere in the chunk — used to detect a binding whose value
// has leading literal text (`@click="run $(fn)"`) before the expression.
const bindingOpenerPattern = /(^|\s)([.@])([a-zA-Z_$][\w$-]*(?:\.[\w$-]+)*)\s*=\s*(["'])/g

// A binding opener with trailing literal text and no closing quote in the same
// chunk means the value is text + expression (e.g. `@click="run $(fn)"`). A valid
// binding has the opener at the very end of the chunk (empty remainder). Fail loud
// rather than silently degrading the binding to a plain string attribute.
function assertNoLeadingTextBinding(html) {
  bindingOpenerPattern.lastIndex = 0
  let match
  while ((match = bindingOpenerPattern.exec(html))) {
    const remainder = html.slice(bindingOpenerPattern.lastIndex)
    if (remainder.length > 0 && !remainder.includes(match[4])) {
      throw new Error(`JST: ${match[2]}${match[3]}="…" must contain exactly one $(…) expression and nothing else inside the quotes.`)
    }
  }
}

function matchBinding(tokens, i) {
  const token = tokens[i]
  const expressionToken = tokens[i + 1]
  const closingToken = tokens[i + 2]

  if (!(token instanceof HtmlToken)) return null

  assertNoLeadingTextBinding(token.html)

  const match = token.html.match(bindingTailPattern)
  if (!match) return null

  const [fullMatch, leading, sigil, name, quote] = match

  if (!(expressionToken instanceof JsExpressionToken)
    || !(closingToken instanceof HtmlToken)
    || !closingToken.html.startsWith(quote)) {
    throw new Error(`JST: ${sigil}${name}="…" must contain exactly one $(…) expression and nothing else inside the quotes.`)
  }

  return {
    kind: sigil === '.' ? 'prop' : 'event',
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
