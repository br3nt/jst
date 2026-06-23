/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
// JST language server. Thin transport glue around the tested pure modules in
// diagnostics.mjs / providers.mjs. Not exercised by the headless test suite
// (it needs an LSP client); the logic it delegates to is fully tested.
import {
  createConnection, TextDocuments, ProposedFeatures,
  TextDocumentSyncKind, DiagnosticSeverity, CompletionItemKind, SymbolKind, MarkupKind,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { computeDiagnostics } from './diagnostics.mjs';
import {
  indexComponents, findDefinition, getHover, getCompletions, getDocumentSymbols,
} from './providers.mjs';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const completionKinds = { class: CompletionItemKind.Class, field: CompletionItemKind.Field, property: CompletionItemKind.Property };

let index = new Map();

function rebuildIndex() {
  index = indexComponents(documents.all().map(doc => ({ uri: doc.uri, text: doc.getText() })));
}

function publishDiagnostics(doc) {
  connection.sendDiagnostics({
    uri: doc.uri,
    diagnostics: computeDiagnostics(doc.getText()).map(diagnostic => ({
      ...diagnostic,
      severity: diagnostic.severity === 1 ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    })),
  });
}

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    definitionProvider: true,
    hoverProvider: true,
    documentSymbolProvider: true,
    completionProvider: { triggerCharacters: ['<', ' ', '.'] },
  },
}));

documents.onDidChangeContent(event => {
  rebuildIndex();
  publishDiagnostics(event.document);
});

documents.onDidClose(event => {
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

connection.onDefinition(({ textDocument, position }) => {
  const doc = documents.get(textDocument.uri);
  if (!doc) return null;
  const definition = findDefinition(doc.getText(), position, index);
  return definition ? { uri: definition.uri, range: definition.range } : null;
});

connection.onHover(({ textDocument, position }) => {
  const doc = documents.get(textDocument.uri);
  if (!doc) return null;
  const hover = getHover(doc.getText(), position, index);
  if (!hover) return null;
  return { contents: { kind: MarkupKind.Markdown, value: hover.contents }, range: hover.range };
});

connection.onCompletion(({ textDocument, position }) => {
  const doc = documents.get(textDocument.uri);
  if (!doc) return [];
  return getCompletions(doc.getText(), position, index).map(item => ({
    label: item.label,
    detail: item.detail,
    kind: completionKinds[item.kind] ?? CompletionItemKind.Text,
  }));
});

connection.onDocumentSymbol(({ textDocument }) => {
  const doc = documents.get(textDocument.uri);
  if (!doc) return [];
  return getDocumentSymbols(doc.getText()).map(symbol => ({
    name: symbol.name,
    detail: symbol.detail,
    kind: SymbolKind.Class,
    range: symbol.range,
    selectionRange: symbol.range,
  }));
});

documents.listen(connection);
connection.listen();
