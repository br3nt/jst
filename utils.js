/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
import { InputReader } from './input_reader.js'
import { Lexer } from './lexer.js'

import {
  isEqual,
} from './test_suite.js'

import {
  HtmlToken,
  JsCodeToken,
  JsExpressionToken,
  JsIdentifierToken,
  WhitespaceToken,
} from './tokens.js'

export function stripIndentation(str) {
  const lines = str.split('\n')
  const filteredLines = lines.filter(line => line.trim().length > 0)
  const minIndent = filteredLines.reduce((min, line) => {
    const leadingSpaces = line.match(/^(\s*)/)[0].length
    return Math.min(min, leadingSpaces)
  }, Infinity)

  if (minIndent === Infinity) return str

  const strippedLines = lines.map(line => line.slice(minIndent))
  return strippedLines.join('\n').trim()
}

export function createLexer(input) {
  return new Lexer(new InputReader(input))
}

export function parseToken(input) {
  const p = createLexer(input)
  const token = p.nextToken()
  return token
}

export function assertToken(token, expectedTokenType, expectedValue, actualValueFn) {
  isEqual(true, token instanceof expectedTokenType, `expect instance of ${expectedTokenType.name} for input: ${token}`)

  var actualValue = actualValueFn(token)
  isEqual(expectedValue, actualValue, `expect token value to equal input: ${expectedValue}`)
}

export function assertHtmlToken(token, expectedValue) {
  assertToken(token, HtmlToken, expectedValue, t => t.html)
}

export function assertJsCodeToken(token, expectedValue) {
  assertToken(token, JsCodeToken, expectedValue, t => t.code)
}

export function assertJsExpressionToken(token, expectedValue) {
  assertToken(token, JsExpressionToken, expectedValue, t => t.expression)
}

export function assertJsIdentifierToken(token, expectedValue) {
  assertToken(token, JsIdentifierToken, expectedValue, t => t.identifier)
}

export function assertWhitespaceToken(token, expectedValue) {
  assertToken(token, WhitespaceToken, expectedValue, t => t.whitespace)
}
