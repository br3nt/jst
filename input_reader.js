/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
export class InputReader {
  #input;
  #position = 0;
  #line = 1;
  #col = 0;

  get position() { return this.#position; }
  get line() { return this.#line; }
  get col() { return this.#col; }

  constructor(input) {
    this.#input = input
  }

  next() {
    const ch = this.#input.charAt(this.#position++);
    if (ch == "\n") { this.#line++; this.#col = 0; } else this.#col++;
    return ch
  }

  peek() { return this.#input.charAt(this.position); }

  peekNext() { return this.#input.charAt(this.position + 1); }

  peekAt(offset) { return this.#input.charAt(this.position + offset); }

  startsWith(str) { return this.#input.startsWith(str, this.position); }

  endOfInput() { return this.peek() === ''; }

  croak(msg) { throw new Error(`${msg} (${this.line}:${this.col})`); }

  readWhile(predicate) {
    const startPosition = this.position;
    while (predicate(this.peek(), this.peekNext()) && !this.endOfInput()) this.next();
    return this.#input.substring(startPosition, this.position);
  }

  readUntilChar(ch) {
    const str = this.readWhile(chPeek => chPeek !== ch)
    return str;
  }

  skipChar(ch) {
    if (this.peek() !== ch) this.croak(`expected current char to be ${ch} but got ${this.peek()}`);
    this.next();
  }

  readBalanced(chOpen, chClose) {
    const startPosition = this.position;
    this.skipChar(chOpen);
    let depth = 1;
    const prev = { char: '', word: '' };

    while (!this.endOfInput() && depth > 0) {
      if (this.#skipJsAtom(prev)) continue;

      const ch = this.peek();

      if (ch === chOpen) depth += 1;
      else if (ch === chClose) depth -= 1;

      this.next();
      this.#advancePrev(prev, ch);
    }

    if (depth !== 0) this.croak(`Unbalanced ${chOpen}${chClose}`);

    const str = this.#input.substring(startPosition, this.position);
    return str;
  }

  #resetPrev(prev) {
    prev.char = '';
    prev.word = '';
  }

  #markValue(prev) {
    prev.char = ')';
    prev.word = '';
  }

  #advancePrev(prev, ch) {
    if (/\s/.test(ch)) return;
    prev.char = ch;
    prev.word = /[\w$]/.test(ch) ? prev.word + ch : '';
  }

  static #regexKeywords = new Set([
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
  ]);

  static #regexAllowedAfter({ char, word }) {
    if (char === '') return true;
    if (/[)\]'"`]/.test(char)) return false;
    if (/[\w$.]/.test(char)) return InputReader.#regexKeywords.has(word);
    return true;
  }

  #skipString(quote) {
    this.next();
    while (!this.endOfInput()) {
      const ch = this.peek();
      if (ch === '\\') {
        this.next();
        this.next();
        continue;
      }
      if (ch === quote) {
        this.next();
        return;
      }
      if (ch === '\n' || ch === '\r') return;
      this.next();
    }
  }

  #skipTemplateLiteral() {
    this.next();
    while (!this.endOfInput()) {
      const ch = this.peek();
      if (ch === '\\') {
        this.next();
        this.next();
        continue;
      }
      if (ch === '`') {
        this.next();
        return;
      }
      if (ch === '$' && this.peekNext() === '{') {
        this.next();
        this.next();
        this.#skipTemplateInterpolation();
        continue;
      }
      this.next();
    }
  }

  #skipTemplateInterpolation() {
    let depth = 1;
    const prev = { char: '', word: '' };

    while (!this.endOfInput() && depth > 0) {
      if (this.#skipJsAtom(prev)) continue;

      const ch = this.peek();
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;

      this.next();
      this.#advancePrev(prev, ch);
    }
  }

  #skipLineComment() {
    while (!this.endOfInput() && this.peek() !== '\n' && this.peek() !== '\r') this.next();
  }

  #skipBlockComment() {
    this.next();
    this.next();
    while (!this.endOfInput()) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        this.next();
        this.next();
        return;
      }
      this.next();
    }
  }

  #skipRegexLiteral() {
    this.next();
    let inCharClass = false;

    while (!this.endOfInput()) {
      const ch = this.peek();
      if (ch === '\\') {
        this.next();
        this.next();
        continue;
      }
      if (ch === '\n' || ch === '\r') return;
      if (ch === '[') inCharClass = true;
      else if (ch === ']') inCharClass = false;
      else if (ch === '/' && !inCharClass) {
        this.next();
        break;
      }
      this.next();
    }

    while (!this.endOfInput() && /[a-z]/i.test(this.peek())) this.next();
  }

  #skipJsAtom(prev) {
    const ch = this.peek();
    const next = this.peekNext();

    if (ch === '/' && next === '/') {
      this.#skipLineComment();
      this.#resetPrev(prev);
      return true;
    }
    if (ch === '/' && next === '*') {
      this.#skipBlockComment();
      this.#resetPrev(prev);
      return true;
    }
    if (ch === '/' && InputReader.#regexAllowedAfter(prev)) {
      this.#skipRegexLiteral();
      this.#markValue(prev);
      return true;
    }
    if (ch === "'" || ch === '"') {
      this.#skipString(ch);
      this.#markValue(prev);
      return true;
    }
    if (ch === '`') {
      this.#skipTemplateLiteral();
      this.#markValue(prev);
      return true;
    }

    return false;
  }

  readJsLine(isHtmlBoundary) {
    const startPosition = this.position;
    const prev = { char: '', word: '' };

    while (!this.endOfInput()) {
      if (this.#skipJsAtom(prev)) continue;

      const ch = this.peek();
      const next = this.peekNext();

      if (ch === '\n' || ch === '\r') break;
      if (ch === '$') break;
      if (isHtmlBoundary(ch, next)) {
        const isCloseTag = ch === '<' && next === '/';
        if (isCloseTag || !this.#prevIsValue(prev)) break;
      }

      this.next();
      this.#advancePrev(prev, ch);
    }

    return this.#input.substring(startPosition, this.position);
  }

  #prevIsValue(prev) {
    return /[)\]'"`\w$]/.test(prev.char);
  }

  readBalancedInner(chOpen, chClose) {
    const str = this.readBalanced(chOpen, chClose);
    const strippedStr = str.substr(1, str.length - 2);
    return strippedStr;
  }
}
