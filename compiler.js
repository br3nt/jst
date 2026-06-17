/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
import { parseTemplateScript } from './parser.js'
import { interpretTemplateTokens } from './interpreter.js'

export function kebabToCamel(name) {
  return name.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase())
}

export function camelToKebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

const jsIdentifierPattern = /^[$_\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*$/u
const reservedPropNames = new Set([
  'arguments',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'eval',
  'export',
  'extends',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'el',
  'trustedHTML',
  'raw',
  'unsafeHTML',
  'slot',
  'url',
  'once',
  'onDisconnect',
  'emit',
  '__esc',
  '__bind',
])

function parsePropsAttribute(value) {
  if (!value || !value.trim()) return []

  return value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(prop => {
      if (!jsIdentifierPattern.test(prop)) {
        throw new Error(`Invalid JST prop "${prop}". Props must be valid JavaScript identifiers.`)
      }
      if (reservedPropNames.has(prop)) {
        throw new Error(`Invalid JST prop "${prop}". Props cannot use JavaScript keywords or JST helper names.`)
      }
      return prop
    })
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
  // Props are declared in one case-preserving attribute value:
  //   <script type="jst" name="todo-item" props="item onToggle">
  // HTML lowercases attribute names, but not quoted attribute values, so this
  // keeps internal JS identifiers greppable and supports expected names like
  // `name` without conflicting with the template's own `name` attribute.
  const paramMap = {}
  const props = parsePropsAttribute(templateElement.getAttribute('props') || '')

  props.forEach(prop => {
    paramMap[camelToKebab(prop)] = prop
  })

  return {
    functionParams: Array.from(new Set(props)),
    paramMap,
  }
}

export function compileTemplateRenderingFunction(templateElement) {
  const program = parseTemplateScript(templateElement.innerHTML)
  const { functionParams, paramMap } = getTemplateRenderingFunctionParams(templateElement)
  const functionBody = interpretTemplateTokens(program.tokens)

  return new TemplateRenderingFunction(functionParams, functionBody, paramMap)
}
