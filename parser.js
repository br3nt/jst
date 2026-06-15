import { InputReader } from './input_reader.js'
import { Lexer } from './lexer.js'
import { EndOfInputToken } from './tokens.js'

export function parseTemplateScript(script) {
  const lexer = new Lexer(new InputReader(script))

  const tokens = []
  let token = lexer.nextToken()

  while (!(token instanceof EndOfInputToken)) {
    tokens.push(token)
    token = lexer.nextToken()
  }

  return new TemplateTokens(tokens)
}

export class TemplateTokens {
  #tokens

  constructor(tokens) {
    this.#tokens = tokens
  }

  get tokens() { return this.#tokens }
}
