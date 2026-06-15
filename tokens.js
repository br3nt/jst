/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
export class Token { }

export class Escaped$Token extends Token {
  toString() { return `${Escaped$Token.name} {}` }
}

export class WhitespaceToken extends Token {
  whitespace

  constructor(whitespace) {
    super()
    this.whitespace = whitespace
  }

  toString() { return `${WhitespaceToken.name} {}` }
}

export class JsIdentifierToken extends Token {
  identifier

  constructor(identifier) {
    super()
    this.identifier = identifier
  }

  toString() { return `${JsIdentifierToken.name} { identifier=${this.identifier} }` }
}

export class JsExpressionToken extends Token {
  expression

  constructor(expression) {
    super()
    this.expression = expression
  }

  toString() { return `${JsExpressionToken.name} { expression=${this.expression} }` }
}

export class JsCodeToken extends Token {
  code

  constructor(code) {
    super()
    this.code = code
  }

  toString() { return `${JsCodeToken.name} { code=${this.code} }` }
}

export class HtmlToken extends Token {
  html

  constructor(html) {
    super()
    this.html = html
  }

  toString() { return `${HtmlToken.name} { html=${this.html} }` }
}

export class EndOfInputToken extends Token {


  toString() { return `${EndOfInputToken.name} {}` }

}
