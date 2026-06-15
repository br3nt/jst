import { parseTemplateScript } from './parser.js'
import { interpretTemplateTokens } from './interpreter.js'

const reservedAttributes = ['id', 'name', 'type']

export function kebabToCamel(name) {
  return name.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase())
}

export class TemplateRenderingFunction {
  #functionParams
  #functionBody
  #paramMap

  constructor(functionParams, functionBody, paramMap) {
    this.#functionParams = functionParams
    this.#functionBody = functionBody
    this.#paramMap = paramMap
  }

  get functionParams() { return this.#functionParams; }
  get functionBody() { return this.#functionBody; }
  get paramMap() { return this.#paramMap; }
}

export function getTemplateRenderingFunctionParams(templateElement) {
  // Each non-reserved attribute on the template declares a component param.
  // HTML attribute names are case-insensitive, so the convention is fixed:
  // kebab-case attributes map to camelCase params (on-toggle -> onToggle).
  const paramMap = {}

  Array.from(templateElement.attributes)
    .filter(attribute => !reservedAttributes.includes(attribute.name))
    .forEach(attribute => {
      const attributeName = attribute.name.toLowerCase()
      paramMap[attributeName] = kebabToCamel(attributeName)
    })

  return {
    functionParams: Array.from(new Set(Object.values(paramMap))),
    paramMap,
  }
}

export function compileTemplateRenderingFunction(templateElement) {
  const program = parseTemplateScript(templateElement.innerHTML)
  const { functionParams, paramMap } = getTemplateRenderingFunctionParams(templateElement)
  const functionBody = interpretTemplateTokens(program.tokens)

  return new TemplateRenderingFunction(functionParams, functionBody, paramMap)
}
