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
    let braceCount = 1;
    let quote = null;

    this.skipChar(chOpen);

    while (!this.endOfInput() && braceCount > 0) {
      const peek = this.peek();

      if (quote) {
        if (peek === '\\') { this.next(); this.next(); continue; }
        if (peek === quote) quote = null;
      } else if (peek === "'" || peek === '"' || peek === '`') {
        quote = peek;
      } else if (peek === chOpen) {
        braceCount += 1;
      } else if (peek === chClose) {
        braceCount -= 1;
      }

      this.next();
    }

    const str = this.#input.substring(startPosition, this.position);
    return str;
  }

  readBalancedInner(chOpen, chClose) {
    const str = this.readBalanced(chOpen, chClose);
    const strippedStr = str.substr(1, str.length - 2);
    return strippedStr;
  }
}
