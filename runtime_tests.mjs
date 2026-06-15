/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
import test from 'node:test';
import assert from 'node:assert/strict';

function createTemplate({ name, attributes = [], innerHTML }) {
  const templateAttributes = [
    { name: 'type', value: 'jst' },
    { name: 'name', value: name },
    ...attributes.map(attribute => (
      typeof attribute === 'string' ? { name: attribute, value: '' } : attribute
    )),
  ];

  return {
    attributes: templateAttributes,
    innerHTML,
    getAttribute(attributeName) {
      const attribute = templateAttributes.find(attr => attr.name === attributeName);
      return attribute ? attribute.value : null;
    },
  };
}

function createEnvironment(templateDefinitions) {
  const elementsById = new Map();
  const templates = templateDefinitions.map(createTemplate);

  class MockHTMLElement {
    constructor() {
      this._attributes = new Map();
      this.innerHTML = '';
      this.isConnected = false;
    }

    setAttribute(name, value) {
      const nextValue = String(value);
      const oldValue = this._attributes.has(name) ? this._attributes.get(name) : null;
      this._attributes.set(name, nextValue);

      if (name === 'id') elementsById.set(nextValue, this);

      const observedAttributes = this.constructor.observedAttributes || [];
      if (observedAttributes.includes(name) && typeof this.attributeChangedCallback === 'function') {
        this.attributeChangedCallback(name, oldValue, nextValue);
      }
    }

    getAttribute(name) {
      return this._attributes.has(name) ? this._attributes.get(name) : null;
    }

    removeAttribute(name) {
      const oldValue = this.getAttribute(name);
      this._attributes.delete(name);

      const observedAttributes = this.constructor.observedAttributes || [];
      if (observedAttributes.includes(name) && typeof this.attributeChangedCallback === 'function') {
        this.attributeChangedCallback(name, oldValue, null);
      }
    }
  }

  class MockCustomElementsRegistry {
    constructor() {
      this.registry = new Map();
      this.defineCalls = [];
    }

    define(name, constructor) {
      if (this.registry.has(name)) {
        throw new Error(`Custom element "${name}" already defined`);
      }

      this.registry.set(name, constructor);
      this.defineCalls.push(name);
    }

    get(name) {
      return this.registry.get(name);
    }
  }

  return {
    document: {
      jst: undefined,
      querySelectorAll(selector) {
        return selector === 'script[type="jst"]' ? templates : [];
      },
      getElementById(id) {
        return elementsById.get(id) || null;
      },
    },
    customElements: new MockCustomElementsRegistry(),
    HTMLElement: MockHTMLElement,
    connect(element) {
      element.isConnected = true;
      if (typeof element.connectedCallback === 'function') element.connectedCallback();
      return element;
    },
    disconnect(element) {
      element.isConnected = false;
      if (typeof element.disconnectedCallback === 'function') element.disconnectedCallback();
    },
  };
}

function captureConsole() {
  const calls = {
    log: [],
    warn: [],
    error: [],
  };

  return {
    calls,
    console: {
      log: (...args) => calls.log.push(args),
      warn: (...args) => calls.warn.push(args),
      error: (...args) => calls.error.push(args),
      groupCollapsed: () => {},
      groupEnd: () => {},
    },
  };
}

async function loadRuntime(templateDefinitions) {
  const environment = createEnvironment(templateDefinitions);
  const consoleCapture = captureConsole();

  const previousGlobals = {
    document: globalThis.document,
    customElements: globalThis.customElements,
    HTMLElement: globalThis.HTMLElement,
    window: globalThis.window,
    console: globalThis.console,
  };

  const windowObject = {};
  globalThis.document = environment.document;
  globalThis.customElements = environment.customElements;
  globalThis.HTMLElement = environment.HTMLElement;
  globalThis.window = windowObject;
  globalThis.console = consoleCapture.console;

  const moduleUrl = new URL(`./jst.js?test=${Date.now()}-${Math.random()}`, import.meta.url);
  const module = await import(moduleUrl.href);

  return {
    module,
    windowObject,
    consoleCalls: consoleCapture.calls,
    customElements: environment.customElements,
    connect: environment.connect,
    cleanup() {
      globalThis.document = previousGlobals.document;
      globalThis.customElements = previousGlobals.customElements;
      globalThis.HTMLElement = previousGlobals.HTMLElement;
      globalThis.window = previousGlobals.window;
      globalThis.console = previousGlobals.console;
    },
  };
}

async function flushRenders() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

test('templates auto-register when the runtime loads', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-auto',
      attributes: ['count'],
      innerHTML: '<div>$(count)</div>',
    },
  ]);

  try {
    assert.equal(runtime.customElements.defineCalls.filter(name => name === 'x-auto').length, 1);
    assert.ok(runtime.customElements.get('x-auto'));
  } finally {
    runtime.cleanup();
  }
});

test('duplicate template names are warned and ignored', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-duplicate',
      attributes: ['value'],
      innerHTML: '<div>first $(value)</div>',
    },
    {
      name: 'x-duplicate',
      attributes: ['value'],
      innerHTML: '<div>second $(value)</div>',
    },
  ]);

  try {
    assert.equal(runtime.customElements.defineCalls.filter(name => name === 'x-duplicate').length, 1);
    assert.equal(runtime.consoleCalls.warn.length, 1);
    assert.match(String(runtime.consoleCalls.warn[0][0]), /Duplicate template name "x-duplicate"/);
  } finally {
    runtime.cleanup();
  }
});

test('pre-registered custom element names are warned before registration', async () => {
  const runtime = await loadRuntime([]);

  try {
    runtime.customElements.define('x-existing', class {});

    const template = createTemplate({
      name: 'x-existing',
      attributes: ['value'],
      innerHTML: '<div>$(value)</div>',
    });
    runtime.module.registerCustomElementFromTemplate(template);

    assert.equal(runtime.consoleCalls.warn.length, 1);
    assert.match(String(runtime.consoleCalls.warn[0][0]), /<x-existing> is already registered/);
  } finally {
    runtime.cleanup();
  }
});

test('JSON-like attribute values are parsed without eval', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-count',
      attributes: ['count', 'label'],
      innerHTML: '<div>$(label): $(count + 1)</div>',
    },
  ]);

  try {
    const CountClass = runtime.customElements.get('x-count');
    const element = new CountClass();
    element.setAttribute('count', '2');
    element.setAttribute('label', 'Total');
    runtime.connect(element);
    await flushRenders();

    assert.match(element.innerHTML, /Total: 3/);
  } finally {
    runtime.cleanup();
  }
});

test('attribute changes re-render the component', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-attr',
      attributes: ['count'],
      innerHTML: '<div>$(count)</div>',
    },
  ]);

  try {
    const AttrClass = runtime.customElements.get('x-attr');
    const element = new AttrClass();
    element.setAttribute('count', '1');
    runtime.connect(element);
    await flushRenders();

    assert.match(element.innerHTML, />1</);

    element.setAttribute('count', '2');
    await flushRenders();

    assert.match(element.innerHTML, />2</);
  } finally {
    runtime.cleanup();
  }
});

test('property assignment carries rich data and re-renders', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-rich',
      attributes: ['items'],
      innerHTML: '<div>$(items.filter(item => item.done).length) of $(items.length)</div>',
    },
  ]);

  try {
    const RichClass = runtime.customElements.get('x-rich');
    const element = new RichClass();
    element.items = [{ done: true }, { done: false }];
    runtime.connect(element);
    await flushRenders();

    assert.match(element.innerHTML, /1 of 2/);
    assert.equal(element.items.length, 2);

    element.items = [{ done: true }, { done: true }, { done: false }];
    await flushRenders();

    assert.match(element.innerHTML, /2 of 3/);
  } finally {
    runtime.cleanup();
  }
});

test('kebab-case attributes map to camelCase params', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-kebab',
      attributes: ['user-name'],
      innerHTML: '<div>$(userName)</div>',
    },
  ]);

  try {
    const KebabClass = runtime.customElements.get('x-kebab');
    const element = new KebabClass();
    element.setAttribute('user-name', 'Brent');
    runtime.connect(element);
    await flushRenders();

    assert.match(element.innerHTML, /Brent/);

    element.userName = 'Someone Else';
    await flushRenders();

    assert.match(element.innerHTML, /Someone Else/);
  } finally {
    runtime.cleanup();
  }
});

test('interpolated values are HTML-escaped by default', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-escape',
      attributes: ['text'],
      innerHTML: '<div>$(text)</div>',
    },
  ]);

  try {
    const EscapeClass = runtime.customElements.get('x-escape');
    const element = new EscapeClass();
    element.text = '<img src=x onerror=alert(1)>';
    runtime.connect(element);
    await flushRenders();

    assert.ok(!element.innerHTML.includes('<img'));
    assert.match(element.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  } finally {
    runtime.cleanup();
  }
});

test('raw() opts out of escaping', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-raw',
      attributes: ['html'],
      innerHTML: '<div>$(raw(html))</div>',
    },
  ]);

  try {
    const RawClass = runtime.customElements.get('x-raw');
    const element = new RawClass();
    element.html = '<b>bold</b>';
    runtime.connect(element);
    await flushRenders();

    assert.match(element.innerHTML, /<b>bold<\/b>/);
  } finally {
    runtime.cleanup();
  }
});

test('render errors are logged with component context', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-failure',
      attributes: ['items'],
      innerHTML: '<div>$(items.length)</div>',
    },
  ]);

  try {
    const FailureClass = runtime.customElements.get('x-failure');
    const element = new FailureClass();
    runtime.connect(element);
    await flushRenders();

    assert.equal(runtime.consoleCalls.error.length, 1);
    assert.match(String(runtime.consoleCalls.error[0][0]), /<x-failure>/);
  } finally {
    runtime.cleanup();
  }
});
