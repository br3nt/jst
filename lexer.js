/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
import * as Tokens from './tokens.js'

export class Lexer {
  #input

  constructor(inputReader) {
    this.#input = inputReader;
  }

  get position() { return this.#input.position; }
  get line() { return this.#input.line; }
  get col() { return this.#input.col; }

  croak(msg) { return this.#input.croak(msg); }

  nextToken() {
    if (this.#input.endOfInput()) return new Tokens.EndOfInputToken();

    const peek = this.#input.peek();

    // 1. Check for JST Marker
    if (peek === '$') return this.parseJsToken();

    // 2. Check for Whitespace
    if (Lexer.isWhitespace(peek)) return this.readWhitespaceToken();

    // 3. Otherwise, it's HTML
    return this.readHtmlToken();
  }

  static isWhitespace(ch) {
    return /[ \t\n\r]/.test(ch)
  }

  readWhitespaceToken() {
    const str = this.#input.readWhile(Lexer.isWhitespace);
    return new Tokens.WhitespaceToken(str);
  }

  parseJsToken() {
    this.#input.skipChar('$');
    const peek = this.#input.peek();

    switch (peek) {
      case '$': return this.readEscaped$Token();
      case '(': return this.readJsExpressionToken();
      case '{': return this.readJsBlockToken();
    }

    // Line-based directive ($ const ...) or Identifier ($id)
    if (peek === ' ' || Lexer.isWhitespace(peek)) {
      return this.readJsLineToken();
    }

    if (Lexer.isJsIdentifierStart(peek)) {
      return this.readJsIdentifierToken();
    }

    return this.croak(`Unexpected character after $: ${peek}`);
  }

  readJsIdentifierToken() {
    const str = this.#input.readWhile(Lexer.isJsIdentifier);
    return new Tokens.JsIdentifierToken(str);
  }

  readJsLineToken() {
    // Skip leading space after $ if it exists
    if (this.#input.peek() === ' ') this.#input.next();

    let quote = null;
    let escaped = false;

    const condition = (ch, chNext) => {
      if (escaped) { escaped = false; return true; }

      if (quote) {
        if (ch === '\\') { escaped = true; return true; }
        if (ch === quote) { quote = null; return true; }
        // Strings other than template literals cannot span lines
        if ((ch === '\n' || ch === '\r') && quote !== '`') { quote = null; return false; }
        return true;
      }

      if (ch === "'" || ch === '"' || ch === '`') { quote = ch; return true; }
      if (ch === '\n' || ch === '\r') return false;
      if (ch === '$') return false;
      // Stop if we see an actual HTML tag start
      return !(Lexer.isHtmlTagStart(ch, chNext) || Lexer.isHtmlTagEnd(ch, chNext));
    };

    const str = this.#input.readWhile(condition);
    return new Tokens.JsCodeToken(str);
  }

  readHtmlToken() {
    const str = this.#input.readUntilChar('$');
    return new Tokens.HtmlToken(str);
  }

  readJsExpressionToken() {
    const str = this.#input.readBalancedInner('(', ')');
    return new Tokens.JsExpressionToken(str);
  }

  readJsBlockToken() {
    const str = this.#input.readBalancedInner('{', '}');
    return new Tokens.JsCodeToken(str);
  }

  readEscaped$Token() {
    this.#input.skipChar('$');
    return new Tokens.Escaped$Token();
  }

  static isJsIdentifierStart(ch) {
    return /[$_\p{ID_Start}]/u.test(ch);
  }

  static isJsIdentifier(ch) {
    return /[$_\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*/u.test(ch);
  }

  static isHtmlTagStart(ch, chNext) {
    return ch === '<' && /[a-z]/i.test(chNext);
  }

  static isHtmlTagEnd(ch, chNext) {
    return ch === '<' && chNext === '/';
  }
}
