// VS Code extension entry point. Launches the JST language server and points
// it at HTML documents. Thin client glue — not headless-tested.
const path = require('path');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

function activate(context) {
  const serverModule = context.asAbsolutePath(path.join('src', 'server.mjs'));

  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: { execArgv: ['--nolazy'] } },
  };

  const clientOptions = {
    // JST templates live inside .html documents
    documentSelector: [{ scheme: 'file', language: 'html' }],
  };

  client = new LanguageClient('jst', 'JST Language Server', serverOptions, clientOptions);
  client.start();
}

function deactivate() {
  return client ? client.stop() : undefined;
}

module.exports = { activate, deactivate };
