"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = __importStar(require("vscode"));
const types_1 = require("../types");
class EvaluateView {
    _panel;
    _extensionUri;
    static viewType = 'flagpole.evaluate';
    static currentPanel;
    static createOrShow(extensionUri, feature) {
        const column = vscode.ViewColumn.Beside;
        // If we already have a panel, show it.
        if (EvaluateView.currentPanel) {
            EvaluateView.currentPanel._panel.reveal(column);
            EvaluateView.currentPanel.selectFlag(feature);
            return;
        }
        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(EvaluateView.viewType, 'Flagpole Evaluator', column, EvaluateView.viewOptions(extensionUri));
        EvaluateView.currentPanel = new EvaluateView(panel, extensionUri);
        EvaluateView.currentPanel.selectFlag(feature);
    }
    static revive(panel, extensionUri) {
        EvaluateView.currentPanel = new EvaluateView(panel, extensionUri);
    }
    static viewOptions(extensionUri) {
        return {
            enableFindWidget: true,
            enableScripts: true,
            enableCommandUris: ['flagpole-explorer.evaluate-flag'],
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
        };
    }
    _disposables = [];
    constructor(_panel, _extensionUri) {
        this._panel = _panel;
        this._extensionUri = _extensionUri;
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'evaluate-flag': {
                    vscode.commands.executeCommand('flagpole-explorer.evaluate-flag', message.flag, message.context);
                    return;
                }
            }
        }, null, this._disposables);
    }
    _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }
    selectFlag(feature) {
        this._panel.webview.postMessage({ command: 'select-flag', feature });
    }
    dispose() {
        EvaluateView.currentPanel = undefined;
        // Clean up our resources
        this._panel.dispose();
        while (this._disposables.length) {
            this._disposables.pop()?.dispose();
        }
    }
    _getHtmlForWebview(webview) {
        const staticToUri = (suffix) => webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', ...suffix));
        const styles = [
            ['reset.css'],
            ['vscode.css'],
            ['vscode-elements-lite', 'button.css'],
            ['vscode-elements-lite', 'checkbox.css'],
            ['vscode-elements-lite', 'collapsible.css'],
            ['vscode-elements-lite', 'divider.css'],
            ['vscode-elements-lite', 'form-container.css'],
            ['vscode-elements-lite', 'form-group.css'],
            ['vscode-elements-lite', 'form-helpers.css'],
            ['vscode-elements-lite', 'label.css'],
            ['vscode-elements-lite', 'select.css'],
            ['vscode-elements-lite', 'textfield.css'],
        ].map(staticToUri);
        const scripts = [
            ['evaluate-view.js'],
        ].map(staticToUri);
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();
        const propertyInputs = Object.entries(types_1.PROPERTIES).map(([name, type]) => {
            switch (type) {
                case 'number':
                case 'string':
                    const htmlType = type === 'string' ? 'text' : type;
                    return `
            <div class="vscode-form-group" data-property="${name}">
              <label for="${name}" class="vscode-label">
                ${name}
              </label>
              <div class="vscode-textfield">
                <input type="${htmlType}" name="${name}" id="${name}" />
              </div>
            </div>
          `;
                case 'boolean':
                    // TODO: it'd be better to have a switch or something where we get a
                    // value even if it's `false`
                    return `
            <div class="vscode-form-group" data-property="${name}">
              <label for="${name}" class="vscode-label">
                ${name}
              </label>
              <input type="checkbox" name="${name}" id="${name}" value="1" />
            </div>
          `;
            }
        });
        return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">

        <!--
          Use a content security policy to only allow loading images from https or from our extension directory,
          and only allow scripts that have a specific nonce.
        -->
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}' ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        ${styles.map(uri => `<link href="${uri}" rel="stylesheet">`).join('')}
        <style nonce="${nonce}">
          .hidden {
            display: none;
          }
          summary h1 {
            display: inline;
          }
        </style>
      </head>
      <body>
        <div>
          <details>
            <summary>
              <h1 id="flagName"></h1>
            </summary>
            <pre id="flagDefinition"></pre>
          </details>

          <form id="request-eval">
            ${propertyInputs.join('')}

            <button type="submit" class="vscode-action-button">
              <h3 class="label">Evaluate</h3>
            </button>
          </form>
        </div>

        ${scripts.map(uri => `<script nonce="${nonce}" src="${uri}"></script>`).join('')}
      </body>
      </html>`;
    }
}
exports.default = EvaluateView;
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=evaluateView.js.map