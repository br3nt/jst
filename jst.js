/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
import { compileTemplateRenderingFunction } from './compiler.js'

/**
 * JST Framework Core
 *
 * Templates are declared as <script type="jst" name="tag-name" props="prop otherProp">
 * and registered as real custom elements. Data flows in through attributes
 * (JSON-parsed primitives) or properties (rich values: el.items = [...]).
 * Data flows out through bubbling CustomEvents (el.emit('name', detail)).
 *
 * Inside templates:
 *   $(expr)                 escaped interpolation
 *   $(raw(expr))            unescaped interpolation (opt-in trusted HTML)
 *   $(unsafeHTML(expr))     alias for raw(expr)
 *   $(url(expr))            URL helper for href/src values
 *   $(slot())               project the component's original child nodes
 *   $(slot('name', 'fb'))   project nodes marked slot="name", with a fallback
 *   .prop="$(expr)"         assign expr as a JS property on the element
 *   @event.mod="$(fn)"      addEventListener('event', fn) with optional modifiers
 *   jst-model="prop"        shorthand for .value/checked + emitting prop changes
 *   once('key', setup)      run setup once per connection, cleanup on disconnect
 *   jst-key="$(id)"         preserve keyed node identity while morphing
 */
document.jst = {
  ...document.jst,
  templates: document.jst?.templates || new Map(),
  config: {
    dev: false,
    autoRegister: true,
    autoRegisterRoot: null,
    resolveTemplate: null,
    ...document.jst?.config,
  },
}

let templatesInitialized = false
let templateObserver = null
const pendingTemplateResolutions = new Map()

/** Values wrapped in RawHtml bypass interpolation escaping. */
class RawHtml {
  constructor(html) { this.html = html }
}

export function raw(value) {
  if (value instanceof RawHtml) return value
  return new RawHtml(value == null ? '' : String(value))
}

export const unsafeHTML = raw

export function url(value) {
  const string = value == null ? '' : String(value).trim()
  const scheme = string.match(/^([a-z][a-z0-9+.-]*):/i)
  if (scheme && !['http', 'https', 'mailto', 'tel', 'ftp'].includes(scheme[1].toLowerCase())) {
    console.warn(`JST: blocked unsafe URL scheme in "${string}".`)
    return '#'
  }
  return string
}

export function configure(options = {}) {
  document.jst.config = {
    ...document.jst.config,
    ...options,
  }

  if ((Object.prototype.hasOwnProperty.call(options, 'autoRegister')
    || Object.prototype.hasOwnProperty.call(options, 'autoRegisterRoot')) && templateObserver) {
    templateObserver.disconnect();
    templateObserver = null;
  }

  observeNewTemplates();

  return document.jst.config
}

function isCustomElementName(name) {
  return typeof name === 'string' && name.includes('-');
}

function templateSource(templateElement) {
  return templateElement.dataset?.jstSource || templateElement.ownerDocument?.baseURI || '';
}

function insertTemplateHtml(html, source) {
  const container = document.createElement('div');
  container.hidden = true;
  container.setAttribute('data-jst-resolved-from', source);
  container.innerHTML = html;
  container.querySelectorAll('script[type="jst"]').forEach(script => {
    script.dataset.jstSource = source;
  });

  (document.body || document.head || document.documentElement).appendChild(container);
  container.querySelectorAll('script[type="jst"]').forEach(registerCustomElementFromTemplate);
  return container;
}

async function resolveTemplateForName(name) {
  const resolver = document.jst.config.resolveTemplate;
  if (typeof resolver !== 'function') return null;
  if (!isCustomElementName(name) || customElements.get(name) || document.jst.templates.has(name)) return null;
  if (pendingTemplateResolutions.has(name)) return pendingTemplateResolutions.get(name);

  const resolution = Promise.resolve()
    .then(() => resolver(name))
    .then(async url => {
      if (!url) return null;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
      const html = await response.text();
      return insertTemplateHtml(html, String(url));
    })
    .catch(error => {
      console.error(`JST: Failed to resolve template for <${name}>:`, error);
      return null;
    })
    .finally(() => {
      pendingTemplateResolutions.delete(name);
    });

  pendingTemplateResolutions.set(name, resolution);
  return resolution;
}

function scanForMissingTemplates(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;

  const visit = element => {
    if (element.nodeType !== Node.ELEMENT_NODE) return;
    const name = element.tagName.toLowerCase();
    if (isCustomElementName(name) && !customElements.get(name)) resolveTemplateForName(name);
  };

  visit(root);
  root.querySelectorAll('*').forEach(visit);
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

function getNodeKey(node) {
  if (node?.nodeType !== Node.ELEMENT_NODE) return null;
  if (node.hasAttribute('data-jst-leaving')) return null;
  return node.getAttribute('jst-key');
}

function findKeyedChild(host, nextNode, startIndex) {
  const key = getNodeKey(nextNode);
  if (key == null) return null;

  for (let i = startIndex; i < host.childNodes.length; i++) {
    const candidate = host.childNodes[i];
    if (getNodeKey(candidate) === key && nodesAreCompatible(candidate, nextNode)) {
      return candidate;
    }
  }

  return null;
}

function transitionName(node) {
  return node?.nodeType === Node.ELEMENT_NODE ? node.getAttribute('jst-transition') : null;
}

function parseCssTimeList(value) {
  return String(value || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => part.endsWith('ms') ? Number.parseFloat(part) : Number.parseFloat(part) * 1000)
    .filter(Number.isFinite);
}

function transitionTimeoutMs(element) {
  if (typeof getComputedStyle !== 'function') return 0;
  const style = getComputedStyle(element);
  const transitionDurations = parseCssTimeList(style.transitionDuration);
  const transitionDelays = parseCssTimeList(style.transitionDelay);
  const animationDurations = parseCssTimeList(style.animationDuration);
  const animationDelays = parseCssTimeList(style.animationDelay);
  const maxFor = (durations, delays) => durations.reduce((max, duration, index) => {
    const delay = delays[index] ?? delays[0] ?? 0;
    return Math.max(max, duration + delay);
  }, 0);

  return Math.max(
    maxFor(transitionDurations, transitionDelays),
    maxFor(animationDurations, animationDelays),
  );
}

function nextFrame(callback) {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(callback));
    return;
  }
  setTimeout(callback, 0);
}

function afterTransition(element, callback) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    element.removeEventListener('transitionend', finish);
    element.removeEventListener('animationend', finish);
    callback();
  };
  const timeout = transitionTimeoutMs(element);

  element.addEventListener('transitionend', finish);
  element.addEventListener('animationend', finish);
  setTimeout(finish, timeout > 0 ? timeout + 50 : 0);
}

function removeTransitionClasses(element, name, phase) {
  element.classList.remove(
    `${name}-${phase}-from`,
    `${name}-${phase}-active`,
    `${name}-${phase}-to`,
  );
}

function runEnterTransition(node) {
  const name = transitionName(node);
  if (!name || node.nodeType !== Node.ELEMENT_NODE) return;

  node.classList.add(`${name}-enter-from`, `${name}-enter-active`);
  nextFrame(() => {
    node.classList.remove(`${name}-enter-from`);
    node.classList.add(`${name}-enter-to`);
    afterTransition(node, () => removeTransitionClasses(node, name, 'enter'));
  });
}

function runLeaveTransition(node, remove) {
  const name = transitionName(node);
  if (!name || node.nodeType !== Node.ELEMENT_NODE) {
    remove();
    return;
  }

  node.setAttribute('data-jst-leaving', '');
  node.removeAttribute('jst-key');
  node.classList.add(`${name}-leave-from`, `${name}-leave-active`);
  nextFrame(() => {
    node.classList.remove(`${name}-leave-from`);
    node.classList.add(`${name}-leave-to`);
    afterTransition(node, () => {
      removeTransitionClasses(node, name, 'leave');
      remove();
    });
  });
}

function runMoveTransition(node) {
  const name = transitionName(node);
  if (!name || node.nodeType !== Node.ELEMENT_NODE) return;

  node.classList.add(`${name}-move`);
  afterTransition(node, () => node.classList.remove(`${name}-move`));
}

function insertRenderedNode(host, nextNode, beforeNode = null) {
  const inserted = cloneRenderedNode(nextNode);
  host.insertBefore(inserted, beforeNode);
  runEnterTransition(inserted);
  return inserted;
}

function removeRenderedNode(host, node) {
  runLeaveTransition(node, () => {
    if (node.parentNode === host) host.removeChild(node);
  });
  return node.parentNode !== host;
}

function escapeCssIdentifier(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return String(value).replace(/["\\]/g, '\\$&');
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

const booleanPropertyAttributes = {
  readOnly: 'readonly',
}

function booleanPropertyValue(element, name) {
  const attrName = booleanPropertyAttributes[name] || name.toLowerCase();
  if (!element.hasAttribute(attrName)) return false;
  const value = element.getAttribute(attrName);
  return value !== 'false' && value !== '0';
}

function syncBooleanProperty(currentElement, nextElement, name) {
  if (!(name in currentElement)) return;
  const value = booleanPropertyValue(nextElement, name);
  if (currentElement[name] !== value) currentElement[name] = value;
}

function syncBooleanPropertyIfDeclared(currentElement, nextElement, name) {
  const attrName = booleanPropertyAttributes[name] || name.toLowerCase();
  if (!nextElement.hasAttribute(attrName)) return;
  syncBooleanProperty(currentElement, nextElement, name);
}

function setLiveValue(element, value) {
  if (element.value !== value) element.value = value;
}

function syncFormProperties(currentElement, nextElement) {
  if (currentElement.nodeType !== Node.ELEMENT_NODE) return;

  const tagName = currentElement.tagName;

  if (tagName === 'INPUT') {
    if (nextElement.hasAttribute('value')) setLiveValue(currentElement, nextElement.getAttribute('value'));
    syncBooleanPropertyIfDeclared(currentElement, nextElement, 'checked');
  } else if (tagName === 'TEXTAREA') {
    if (currentElement.defaultValue !== nextElement.defaultValue) setLiveValue(currentElement, nextElement.value);
  } else if (tagName === 'SELECT') {
    if (nextElement.hasAttribute('value')) setLiveValue(currentElement, nextElement.getAttribute('value'));
  } else if (tagName === 'OPTION') {
    syncBooleanPropertyIfDeclared(currentElement, nextElement, 'selected');
  }

  ['disabled', 'required', 'readOnly', 'multiple'].forEach(prop => {
    syncBooleanProperty(currentElement, nextElement, prop);
  });
}

function cloneRenderedNode(nextNode) {
  const clone = nextNode.cloneNode(true);

  const syncTree = (current, next) => {
    if (current.nodeType !== Node.ELEMENT_NODE || next.nodeType !== Node.ELEMENT_NODE) return;
    syncFormProperties(current, next);

    const currentChildren = Array.from(current.childNodes);
    const nextChildren = Array.from(next.childNodes);
    nextChildren.forEach((nextChild, index) => {
      if (currentChildren[index]) syncTree(currentChildren[index], nextChild);
    });
  };

  syncTree(clone, nextNode);
  return clone;
}

function morphNode(currentNode, nextNode) {
  if (!nodesAreCompatible(currentNode, nextNode)) {
    const replacement = cloneRenderedNode(nextNode);
    currentNode.replaceWith(replacement);
    runEnterTransition(replacement);
    return;
  }

  if (currentNode.nodeType === Node.TEXT_NODE || currentNode.nodeType === Node.COMMENT_NODE) {
    if (currentNode.nodeValue !== nextNode.nodeValue) currentNode.nodeValue = nextNode.nodeValue;
    return;
  }

  syncAttributes(currentNode, nextNode);
  syncFormProperties(currentNode, nextNode);
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
      if (!removeRenderedNode(host, currentNode)) index++;
      continue;
    }

    if (!currentNode) {
      insertRenderedNode(host, nextNode);
      index++;
      continue;
    }

    const nextKey = getNodeKey(nextNode);
    if (nextKey != null && getNodeKey(currentNode) !== nextKey) {
      const keyedMatch = findKeyedChild(host, nextNode, index + 1);
      if (keyedMatch) {
        host.insertBefore(keyedMatch, currentNode);
        morphNode(keyedMatch, nextNode);
        runMoveTransition(keyedMatch);
      } else {
        insertRenderedNode(host, nextNode, currentNode);
      }
      index++;
      continue;
    }

    if (getNodeKey(currentNode) != null && nextKey == null && !nodesAreCompatible(currentNode, nextNode)) {
      insertRenderedNode(host, nextNode, currentNode);
      index++;
      continue;
    }

    if (!nodesAreCompatible(currentNode, nextNode)) {
      const replacement = cloneRenderedNode(nextNode);
      host.replaceChild(replacement, currentNode);
      runEnterTransition(replacement);
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
const modelListeners = new WeakMap()

const keyModifiers = {
  enter: 'Enter',
  escape: 'Escape',
  esc: 'Escape',
  tab: 'Tab',
  space: ' ',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
}

function parseEventDescriptor(descriptor) {
  const [eventName, ...modifiers] = descriptor.split('.');
  return { eventName, modifiers };
}

function valueFromModelControl(element, currentValue) {
  if (element instanceof HTMLInputElement && element.type === 'checkbox') {
    if (Array.isArray(currentValue)) {
      const next = currentValue.filter(value => String(value) !== element.value);
      if (element.checked) next.push(element.value);
      return next;
    }
    return element.checked;
  }

  if (element instanceof HTMLInputElement && element.type === 'radio') {
    return element.checked ? element.value : currentValue;
  }

  if (element instanceof HTMLSelectElement && element.multiple) {
    return Array.from(element.selectedOptions).map(option => option.value);
  }

  return element.value;
}

function syncModelControl(element, value) {
  if (element instanceof HTMLInputElement && element.type === 'checkbox') {
    const checked = Array.isArray(value)
      ? value.map(String).includes(element.value)
      : Boolean(value);
    if (element.checked !== checked) element.checked = checked;
    return;
  }

  if (element instanceof HTMLInputElement && element.type === 'radio') {
    const checked = value != null && String(value) === element.value;
    if (element.checked !== checked) element.checked = checked;
    return;
  }

  if (element instanceof HTMLSelectElement && element.multiple) {
    const selected = Array.isArray(value) ? value.map(String) : [];
    Array.from(element.options).forEach(option => {
      option.selected = selected.includes(option.value);
    });
    return;
  }

  if ('value' in element && element.value !== (value == null ? '' : String(value))) {
    element.value = value == null ? '' : String(value);
  }
}

function buildEventListener(element, descriptor, handler) {
  const { eventName, modifiers } = parseEventDescriptor(descriptor);
  const modifierSet = new Set(modifiers);
  const options = {
    capture: modifierSet.has('capture'),
    passive: modifierSet.has('passive'),
    once: modifierSet.has('once'),
  };
  const keyChecks = modifiers
    .filter(modifier => keyModifiers[modifier])
    .map(modifier => keyModifiers[modifier]);

  let listener = event => {
    if (keyChecks.length && !keyChecks.includes(event.key)) return;
    if (modifierSet.has('self') && event.target !== element) return;
    if (modifierSet.has('prevent')) event.preventDefault();
    if (modifierSet.has('stop')) event.stopPropagation();
    return handler(event);
  };

  const debounceIndex = modifiers.indexOf('debounce');
  if (debounceIndex !== -1) {
    const delay = Number(modifiers[debounceIndex + 1]) || 250;
    const original = listener;
    let timeout = null;
    listener = event => {
      clearTimeout(timeout);
      timeout = setTimeout(() => original(event), delay);
    };
  }

  return {
    eventName,
    target: modifierSet.has('outside') ? document : element,
    options,
    listener: modifierSet.has('outside')
      ? event => {
          if (!element.contains(event.target)) listener(event);
        }
      : listener,
  };
}

function applyBinding(element, { kind, name, value }) {
  if (kind === 'prop') {
    if (!Object.is(element[name], value)) element[name] = value
    return
  }

  const listeners = boundListeners.get(element) || {}
  if (listeners[name]) {
    listeners[name].target.removeEventListener(listeners[name].eventName, listeners[name].listener, listeners[name].options)
  }

  if (typeof value === 'function') {
    const binding = buildEventListener(element, name, value)
    binding.target.addEventListener(binding.eventName, binding.listener, binding.options)
    listeners[name] = binding
    boundListeners.set(element, listeners)
    return binding
  } else {
    delete listeners[name]
  }

  boundListeners.set(element, listeners)
  return null
}

function applyModelBinding(host, element, propName, paramNames) {
  const previous = modelListeners.get(element);
  if (previous) element.removeEventListener(previous.eventName, previous.listener);

  if (!paramNames.includes(propName)) {
    console.warn(`JST: jst-model="${propName}" does not match a declared prop on <${host.tagName.toLowerCase()}>.`);
  }

  syncModelControl(element, host._jstGetParam(propName));

  const eventName = element instanceof HTMLSelectElement
    || (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio'))
    ? 'change'
    : 'input';
  const listener = () => {
    host[propName] = valueFromModelControl(element, host._jstGetParam(propName));
  };
  element.addEventListener(eventName, listener);
  element.removeAttribute('jst-model');
  modelListeners.set(element, { eventName, listener });
}

export function registerCustomElementFromTemplate(templateElement) {
  const customElementName = templateElement.getAttribute('name')?.toLowerCase();
  const source = templateSource(templateElement);

  // Custom elements MUST have a hyphen in their name
  if (!customElementName || !customElementName.includes('-')) {
    console.error(`JST Error: "${customElementName}" is not a valid custom element name. It MUST contain a hyphen (e.g. jst-${customElementName}).`, source);
    return;
  }

  if (templateElement.__jstRegisteredName === customElementName) {
    return customElements.get(customElementName);
  }

  const renderFunction = compileTemplateRenderingFunction(templateElement);

  const elementClass = defineCustomElementFromRender({
    customElementName,
    paramNames: renderFunction.functionParams,
    attributeToParam: renderFunction.paramMap,
    renderFunctionBody: renderFunction.functionBody,
    source,
    createRenderFunction: () => new Function(
      ...renderFunction.functionParams,
      'el',
      'raw',
      'unsafeHTML',
      'slot',
      'onDisconnect',
      '__esc',
      '__bind',
      'url',
      'once',
      renderFunction.functionBody,
    ),
  });

  if (elementClass) templateElement.__jstRegisteredName = customElementName;
  return elementClass;
}

export function registerPrecompiledTemplate(customElementName, paramNames, attributeToParam, renderFunction, source = 'precompiled') {
  if (!customElementName || !customElementName.includes('-')) {
    console.error(`JST Error: "${customElementName}" is not a valid custom element name. It MUST contain a hyphen (e.g. jst-${customElementName}).`, source);
    return;
  }

  return defineCustomElementFromRender({
    customElementName: customElementName.toLowerCase(),
    paramNames,
    attributeToParam,
    renderFunctionBody: renderFunction.toString(),
    source,
    createRenderFunction: () => renderFunction,
  });
}

function defineCustomElementFromRender({
  customElementName,
  paramNames,
  attributeToParam,
  renderFunctionBody,
  source,
  createRenderFunction,
}) {
  if (document.jst.templates.has(customElementName)) {
    console.warn(`JST: Duplicate template name "${customElementName}" ignored.`, source);
    return customElements.get(customElementName);
  }

  document.jst.templates.set(customElementName, {
    functionParams: paramNames,
    paramMap: attributeToParam,
    source,
  });

  if (customElements.get(customElementName)) {
    console.warn(`JST: Custom element <${customElementName}> is already registered.`, source);
    return customElements.get(customElementName);
  }

  let compiledRender = null;

  const CustomElementClass = class extends HTMLElement {
    #params = {};
    #renderQueued = false;
    #slotContent = null;
    #slotContentDetached = false;
    #rendering = false;
    #slotObserver = null;
    #disconnectCleanups = new Set();
    #onceKeys = new Set();
    #outsideTracked = new WeakSet();

    static get observedAttributes() {
      return Object.keys(attributeToParam);
    }

    connectedCallback() {
      this.#captureSlotContent();
      this.#observeSlotMutations();
      this.#upgradeProperties();
      this.requestRender();
    }

    disconnectedCallback() {
      this.#slotObserver?.disconnect();
      this.#slotObserver = null;

      this.#disconnectCleanups.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.error(`JST disconnect cleanup error in <${customElementName}>:`, error);
        }
      });
      this.#disconnectCleanups.clear();
      this.#onceKeys.clear();
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
        compiledRender = compiledRender || createRenderFunction();

        const html = compiledRender.call(
          this,
          ...paramNames.map(param => this.#params[param]),
          this,
          raw,
          unsafeHTML,
          createSlotPlaceholder,
          cleanup => this.#registerDisconnectCleanup(cleanup),
          escapeHtml,
          (kind, name, value) => ` jst-bound jst-bind-${bindings.push({ kind, name, value }) - 1}=""`,
          url,
          (key, setupFn) => this.#runOnce(key, setupFn),
        );

        this.#slotObserver?.disconnect();
        this.#slotObserver = null;
        this.#rendering = true;
        try {
          this.#detachSlotContent();
          applyRenderedHtml(this, html);
          this.#applyBindings(bindings);
          this.#applyModelBindings();
          this.#fillSlots();
        } finally {
          this.#rendering = false;
          this.#observeSlotMutations();
        }
      } catch (e) {
        console.error(`JST Render Error in <${customElementName}>:`, e);
        console.groupCollapsed('--- Problematic Generated Code ---');
        console.log(renderFunctionBody);
        console.groupEnd();
        if (document.jst.config.dev) this.#showDevError(e);
      }
    }

    _jstGetParam(param) { return this.#params[param]; }

    _jstSetParam(param, value) {
      const previous = this.#params[param];
      this.#params[param] = value;
      const isMutableReference = value !== null && (typeof value === 'object' || typeof value === 'function');
      if (Object.is(previous, value) && !isMutableReference) return;
      this.requestRender();
    }

    #registerDisconnectCleanup(cleanup) {
      if (typeof cleanup !== 'function') return cleanup;
      this.#disconnectCleanups.add(cleanup);
      return cleanup;
    }

    #runOnce(key, setupFn) {
      if (this.#onceKeys.has(key)) return undefined;
      if (typeof setupFn !== 'function') return undefined;

      this.#onceKeys.add(key);
      try {
        const cleanup = setupFn();
        if (typeof cleanup === 'function') this.#registerDisconnectCleanup(cleanup);
        return cleanup;
      } catch (error) {
        this.#onceKeys.delete(key);
        throw error;
      }
    }

    #showDevError(error) {
      this.innerHTML = `<pre class="jst-error" role="alert">JST Render Error in &lt;${escapeHtml(customElementName)}&gt;\n${escapeHtml(error?.stack || error?.message || error)}</pre>`;
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

    #observeSlotMutations() {
      if (this.#slotObserver || typeof MutationObserver === 'undefined') return;

      this.#slotObserver = new MutationObserver(mutations => {
        if (this.#rendering) return;

        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) return;
            if (!this.#slotContent) this.#captureSlotContent();

            const slotName = node.nodeType === Node.ELEMENT_NODE ? node.getAttribute('slot') : null;
            if (slotName) {
              if (!this.#slotContent.named.has(slotName)) this.#slotContent.named.set(slotName, []);
              const nodes = this.#slotContent.named.get(slotName);
              if (!nodes.includes(node)) nodes.push(node);
            } else if (!this.#slotContent.defaultNodes.includes(node)) {
              this.#slotContent.defaultNodes.push(node);
            }

            this.#rendering = true;
            try {
              this.#placeSlotContent(slotName);
            } finally {
              this.#rendering = false;
            }
          });
        });
      });

      this.#slotObserver.observe(this, { childList: true });
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
          if (!binding) return;
          const applied = applyBinding(element, binding);
          // `.outside` listeners live on `document`, so they outlive the host
          // unless explicitly removed. Element-targeted listeners die with their
          // element; document-targeted ones leak and fire after disconnect.
          // Register one cleanup per element that strips its document listeners.
          if (applied && applied.target === document && !this.#outsideTracked.has(element)) {
            this.#outsideTracked.add(element);
            this.#registerDisconnectCleanup(() => {
              const current = boundListeners.get(element);
              if (!current) return;
              Object.values(current).forEach(b => {
                if (b.target === document) {
                  b.target.removeEventListener(b.eventName, b.listener, b.options);
                }
              });
            });
          }
        });

        element.removeAttribute('jst-bound');
      });
    }

    #applyModelBindings() {
      if (typeof this.querySelectorAll !== 'function') return;

      this.querySelectorAll('[jst-model]').forEach(element => {
        applyModelBinding(this, element, element.getAttribute('jst-model'), paramNames);
      });
    }

    #fillSlots() {
      if (typeof this.querySelectorAll !== 'function') return;

      this.querySelectorAll('jst-slot').forEach(slotElement => {
        if (slotElement.__jstFilled) return;
        slotElement.__jstFilled = true;

        this.#placeSlotContent(slotElement.getAttribute('name'));
      });
    }

    #placeSlotContent(name) {
      if (typeof this.querySelector !== 'function') return;
      const selector = name ? `jst-slot[name="${escapeCssIdentifier(name)}"]` : 'jst-slot:not([name])';
      const slotElement = this.querySelector(selector);
      if (!slotElement) return;

      const nodes = (name
        ? this.#slotContent?.named.get(name)
        : this.#slotContent?.defaultNodes) || [];

      if (nodes.length) slotElement.replaceChildren(...nodes);
    }
  };

  // Each declared prop becomes a real property: el.items = [...] re-renders.
  paramNames.forEach(param => {
    if (Object.prototype.hasOwnProperty.call(CustomElementClass.prototype, param)) {
      console.warn(`JST: Prop "${param}" on <${customElementName}> clashes with a component member and will not get a property accessor.`);
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
  if (document.jst.config.dev) console.log(`JST: Registered <${customElementName}>`, source);
  return CustomElementClass;
}

export function initializeTemplates() {
  if (templatesInitialized) return document.jst.templates;
  templatesInitialized = true;

  document.querySelectorAll('script[type="jst"]').forEach(registerCustomElementFromTemplate);
  observeNewTemplates();
  scanForMissingTemplates(document.documentElement);

  return document.jst.templates;
}

/**
 * Templates that arrive after initial load (e.g. inside an htmx/fetch fragment)
 * register automatically, so a server can ship component definitions on demand.
 */
function observeNewTemplates() {
  if (templateObserver || typeof MutationObserver === 'undefined') return;
  if (document.jst.config.autoRegister === false) return;

  templateObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.('script[type="jst"]')) registerCustomElementFromTemplate(node);
        node.querySelectorAll?.('script[type="jst"]').forEach(registerCustomElementFromTemplate);
        scanForMissingTemplates(node);
      });
    });
  });

  const root = document.jst.config.autoRegisterRoot || document.documentElement;
  templateObserver.observe(root, { childList: true, subtree: true });
}

export function resetJstForTests() {
  document.jst?.templates?.clear();
}

initializeTemplates();
