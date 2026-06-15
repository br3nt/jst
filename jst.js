/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
import { compileTemplateRenderingFunction } from './compiler.js'

/**
 * JST Framework Core
 *
 * Templates are declared as <script type="jst" name="tag-name" param other-param>
 * and registered as real custom elements. Data flows in through attributes
 * (JSON-parsed primitives) or properties (rich values: el.items = [...]).
 * Data flows out through bubbling CustomEvents (el.emit('name', detail)).
 *
 * Inside templates:
 *   $(expr)                 escaped interpolation
 *   $(raw(expr))            unescaped interpolation (opt-in)
 *   $(slot())               project the component's original child nodes
 *   $(slot('name', 'fb'))   project nodes marked slot="name", with a fallback
 *   .prop="$(expr)"         assign expr as a JS property on the element
 *   @event="$(fn)"          addEventListener('event', fn) on the element
 */
document.jst = {
  ...document.jst,
  templates: document.jst?.templates || new Map(),
}

let templatesInitialized = false
let templateObserver = null

/** Values wrapped in RawHtml bypass interpolation escaping. */
class RawHtml {
  constructor(html) { this.html = html }
}

export function raw(value) {
  if (value instanceof RawHtml) return value
  return new RawHtml(value == null ? '' : String(value))
}

export function escapeHtml(value) {
  if (value == null) return ''
  if (value instanceof RawHtml) return value.html
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function createSlotPlaceholder(name, fallback) {
  const nameAttribute = name ? ` name="${escapeHtml(name)}"` : ''
  const fallbackHtml = fallback == null ? '' : escapeHtml(fallback)
  return new RawHtml(`<jst-slot${nameAttribute} style="display: contents">${fallbackHtml}</jst-slot>`)
}

function canMorphDom(host) {
  return typeof document?.createElement === 'function' && !!host?.childNodes;
}

function isManagedCustomElement(node) {
  return node?.nodeType === Node.ELEMENT_NODE
    && typeof customElements?.get === 'function'
    && !!customElements.get(node.tagName.toLowerCase());
}

function isSlotElement(node) {
  return node?.nodeType === Node.ELEMENT_NODE && node.tagName === 'JST-SLOT';
}

function nodesAreCompatible(currentNode, nextNode) {
  if (!currentNode || !nextNode) return false;
  if (currentNode.nodeType !== nextNode.nodeType) return false;

  if (currentNode.nodeType === Node.ELEMENT_NODE) {
    return currentNode.tagName === nextNode.tagName;
  }

  return true;
}

function syncAttributes(currentElement, nextElement) {
  Array.from(currentElement.attributes).forEach(attr => {
    if (!nextElement.hasAttribute(attr.name)) currentElement.removeAttribute(attr.name);
  });

  Array.from(nextElement.attributes).forEach(attr => {
    if (currentElement.getAttribute(attr.name) !== attr.value) {
      currentElement.setAttribute(attr.name, attr.value);
    }
  });
}

function morphNode(currentNode, nextNode) {
  if (!nodesAreCompatible(currentNode, nextNode)) {
    currentNode.replaceWith(nextNode.cloneNode(true));
    return;
  }

  if (currentNode.nodeType === Node.TEXT_NODE || currentNode.nodeType === Node.COMMENT_NODE) {
    if (currentNode.nodeValue !== nextNode.nodeValue) currentNode.nodeValue = nextNode.nodeValue;
    return;
  }

  syncAttributes(currentNode, nextNode);
  // Managed elements render their own children; slot elements hold projected
  // author content. Neither should be morphed from the parent's output.
  if (isManagedCustomElement(currentNode) || isSlotElement(currentNode)) return;
  morphChildren(currentNode, nextNode);
}

function morphChildren(host, nextParent) {
  const nextNodes = Array.from(nextParent.childNodes);
  let index = 0;

  while (index < nextNodes.length || index < host.childNodes.length) {
    const currentNode = host.childNodes[index];
    const nextNode = nextNodes[index];

    if (!nextNode) {
      host.removeChild(currentNode);
      continue;
    }

    if (!currentNode) {
      host.appendChild(nextNode.cloneNode(true));
      index++;
      continue;
    }

    if (!nodesAreCompatible(currentNode, nextNode)) {
      host.replaceChild(nextNode.cloneNode(true), currentNode);
      index++;
      continue;
    }

    morphNode(currentNode, nextNode);
    index++;
  }
}

function applyRenderedHtml(host, html) {
  if (!canMorphDom(host)) {
    host.innerHTML = html;
    return;
  }

  const template = document.createElement('template');
  template.innerHTML = html;
  morphChildren(host, template.content);
}

const jsonLikePattern = /^(?:true|false|null|-?\d|\[|\{|")/

/**
 * Attributes arrive as strings. Values that look like JSON (numbers, booleans,
 * arrays, objects, quoted strings) are parsed so count="0" renders as a number.
 * Anything else stays a plain string. No eval involved.
 */
function parseAttributeValue(rawValue) {
  if (rawValue === null) return undefined
  const trimmed = rawValue.trim()
  if (!jsonLikePattern.test(trimmed)) return rawValue
  try { return JSON.parse(trimmed) } catch { return rawValue }
}

const bindingAttributePattern = /^jst-bind-(\d+)$/
const boundListeners = new WeakMap()

function applyBinding(element, { kind, name, value }) {
  if (kind === 'prop') {
    element[name] = value
    return
  }

  const listeners = boundListeners.get(element) || {}
  if (listeners[name]) element.removeEventListener(name, listeners[name])

  if (typeof value === 'function') {
    element.addEventListener(name, value)
    listeners[name] = value
  } else {
    delete listeners[name]
  }

  boundListeners.set(element, listeners)
}

export function registerCustomElementFromTemplate(templateElement) {
  const customElementName = templateElement.getAttribute('name')?.toLowerCase();

  // Custom elements MUST have a hyphen in their name
  if (!customElementName || !customElementName.includes('-')) {
    console.error(`JST Error: "${customElementName}" is not a valid custom element name. It MUST contain a hyphen (e.g. jst-${customElementName}).`);
    return;
  }

  if (document.jst.templates.has(customElementName)) {
    console.warn(`JST: Duplicate template name "${customElementName}" ignored.`);
    return customElements.get(customElementName);
  }

  const renderFunction = compileTemplateRenderingFunction(templateElement);
  document.jst.templates.set(customElementName, renderFunction);

  if (customElements.get(customElementName)) {
    console.warn(`JST: Custom element <${customElementName}> is already registered.`);
    return customElements.get(customElementName);
  }

  const paramNames = renderFunction.functionParams;
  const attributeToParam = renderFunction.paramMap;
  let compiledRender = null;

  const CustomElementClass = class extends HTMLElement {
    #params = {};
    #renderQueued = false;
    #slotContent = null;
    #slotContentDetached = false;

    static get observedAttributes() {
      return Object.keys(attributeToParam);
    }

    connectedCallback() {
      this.#captureSlotContent();
      this.#upgradeProperties();
      this.requestRender();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      this.#params[attributeToParam[name]] = parseAttributeValue(newValue);
      if (this.isConnected) this.requestRender();
    }

    /** Dispatch a bubbling CustomEvent. Data out: parents/pages listen for these. */
    emit(eventName, detail) {
      return this.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true, composed: true }));
    }

    requestRender() {
      if (this.#renderQueued) return;
      this.#renderQueued = true;

      queueMicrotask(() => {
        this.#renderQueued = false;
        if (this.isConnected) this.render();
      });
    }

    render() {
      if (!this.isConnected) return;

      const bindings = [];

      try {
        compiledRender = compiledRender
          || new Function(...paramNames, 'el', 'raw', 'slot', '__esc', '__bind', renderFunction.functionBody);

        const html = compiledRender.call(
          this,
          ...paramNames.map(param => this.#params[param]),
          this,
          raw,
          createSlotPlaceholder,
          escapeHtml,
          (kind, name, value) => ` jst-bound jst-bind-${bindings.push({ kind, name, value }) - 1}=""`,
        );

        this.#detachSlotContent();
        applyRenderedHtml(this, html);
        this.#applyBindings(bindings);
        this.#fillSlots();
      } catch (e) {
        console.error(`JST Render Error in <${customElementName}>:`, e);
        console.groupCollapsed('--- Problematic Generated Code ---');
        console.log(renderFunction.functionBody);
        console.groupEnd();
      }
    }

    _jstGetParam(param) { return this.#params[param]; }

    _jstSetParam(param, value) {
      this.#params[param] = value;
      this.requestRender();
    }

    /**
     * A property assigned before the element upgrades lands as an own property
     * that shadows the prototype accessor. Re-route it through the setter.
     */
    #upgradeProperties() {
      paramNames.forEach(param => {
        if (Object.prototype.hasOwnProperty.call(this, param)) {
          const value = this[param];
          delete this[param];
          this[param] = value;
        }
      });
    }

    /**
     * On first connect the element's children are the author's content.
     * Capture references so the template can project them via $(slot()).
     * The nodes stay in the document until the first render so they remain
     * reachable (getElementById, listeners) in the meantime.
     */
    #captureSlotContent() {
      if (this.#slotContent || !this.childNodes) return;

      const named = new Map();
      const defaultNodes = [];

      Array.from(this.childNodes).forEach(node => {
        const slotName = node.nodeType === Node.ELEMENT_NODE ? node.getAttribute('slot') : null;
        if (slotName) {
          if (!named.has(slotName)) named.set(slotName, []);
          named.get(slotName).push(node);
        } else {
          defaultNodes.push(node);
        }
      });

      this.#slotContent = { defaultNodes, named };
    }

    /**
     * Detach the captured author content right before the first morph, so the
     * morph never mutates author nodes and #fillSlots can re-project them.
     * Runs synchronously inside render(): no observable detached window.
     */
    #detachSlotContent() {
      if (this.#slotContentDetached || !this.#slotContent) return;
      this.#slotContentDetached = true;

      this.#slotContent.defaultNodes.forEach(node => node.remove?.());
      this.#slotContent.named.forEach(nodes => nodes.forEach(node => node.remove?.()));
    }

    #applyBindings(bindings) {
      if (!bindings.length || typeof this.querySelectorAll !== 'function') return;

      // Binding markers are stripped synchronously after every render, so any
      // marker present right now was emitted by this render's binding table —
      // including markers inside a nested component's light DOM.
      this.querySelectorAll('[jst-bound]').forEach(element => {
        Array.from(element.attributes).forEach(attribute => {
          const match = attribute.name.match(bindingAttributePattern);
          if (!match) return;

          element.removeAttribute(attribute.name);
          const binding = bindings[Number(match[1])];
          if (binding) applyBinding(element, binding);
        });

        element.removeAttribute('jst-bound');
      });
    }

    #fillSlots() {
      if (typeof this.querySelectorAll !== 'function') return;

      this.querySelectorAll('jst-slot').forEach(slotElement => {
        if (slotElement.__jstFilled) return;
        slotElement.__jstFilled = true;

        const name = slotElement.getAttribute('name');
        const nodes = (name
          ? this.#slotContent?.named.get(name)
          : this.#slotContent?.defaultNodes) || [];

        if (nodes.length) slotElement.replaceChildren(...nodes);
      });
    }
  };

  // Each declared param becomes a real property: el.items = [...] re-renders.
  paramNames.forEach(param => {
    if (Object.prototype.hasOwnProperty.call(CustomElementClass.prototype, param)) {
      console.warn(`JST: Param "${param}" on <${customElementName}> clashes with a component member and will not get a property accessor.`);
      return;
    }

    Object.defineProperty(CustomElementClass.prototype, param, {
      configurable: true,
      enumerable: true,
      get() { return this._jstGetParam(param); },
      set(value) { this._jstSetParam(param, value); },
    });
  });

  customElements.define(customElementName, CustomElementClass);
  console.log(`JST: Registered <${customElementName}>`);
  return CustomElementClass;
}

export function initializeTemplates() {
  if (templatesInitialized) return document.jst.templates;
  templatesInitialized = true;

  document.querySelectorAll('script[type="jst"]').forEach(registerCustomElementFromTemplate);
  observeNewTemplates();

  return document.jst.templates;
}

/**
 * Templates that arrive after initial load (e.g. inside an htmx/fetch fragment)
 * register automatically, so a server can ship component definitions on demand.
 */
function observeNewTemplates() {
  if (templateObserver || typeof MutationObserver === 'undefined') return;

  templateObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.('script[type="jst"]')) registerCustomElementFromTemplate(node);
        node.querySelectorAll?.('script[type="jst"]').forEach(registerCustomElementFromTemplate);
      });
    });
  });

  templateObserver.observe(document.documentElement, { childList: true, subtree: true });
}

export function resetJstForTests() {
  document.jst?.templates?.clear();
}

initializeTemplates();
