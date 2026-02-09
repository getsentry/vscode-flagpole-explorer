import * as vscode from 'vscode';
import { Feature, PROPERTIES } from '../types';

export default class EvaluateView {
  public static readonly viewType = 'flagpole.evaluate';

  public static currentPanel: EvaluateView | undefined;

  public static createOrShow(extensionUri: vscode.Uri, feature: null | Feature) {
    const column = vscode.ViewColumn.Beside;

    // If we already have a panel, show it.
    if (EvaluateView.currentPanel) {
      EvaluateView.currentPanel._panel.reveal(column);
      EvaluateView.currentPanel.selectFlag(feature);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      EvaluateView.viewType,
      'Flagpole Evaluator',
      column,
      EvaluateView.viewOptions(extensionUri),
    );

    EvaluateView.currentPanel = new EvaluateView(panel, extensionUri);
    EvaluateView.currentPanel.selectFlag(feature);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    EvaluateView.currentPanel = new EvaluateView(panel, extensionUri);
  }

  public static viewOptions(extensionUri: vscode.Uri) {
    return {
      enableFindWidget: true,
      enableScripts: true,
      enableCommandUris: ['flagpole-explorer.evaluate-flag'],
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
    };
  }

  private _disposables: vscode.Disposable[] = [];

  private constructor(
    private _panel: vscode.WebviewPanel,
    private _extensionUri: vscode.Uri
  ) {
    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
    	message => {
    		switch (message.command) {
    			case 'evaluate-flag': {
            vscode.commands.executeCommand('flagpole-explorer.evaluate-flag', message.flag, message.context);
    				return;
          }
    		}
    	},
    	null,
    	this._disposables
    );
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  public selectFlag(feature: null | Feature) {
    if (feature) {
      this._panel.webview.postMessage({ command: 'select-flag', feature });
    }
  }

  public dispose() {
    EvaluateView.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const staticToUri = (suffix: string[]) => webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', ...suffix));

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

    const propertyInputs = Object.entries(PROPERTIES).map(([name, type]) => {
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

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
