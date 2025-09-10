import * as vscode from 'vscode';
import { PROPERTIES } from '../types';

export default class EvaluateView {
  public static readonly viewType = 'flagpole.evaluate';

  public static currentPanel: EvaluateView | undefined;

  public static createOrShow(extensionUri: vscode.Uri, flagName: string, flagDefinition: unknown) {
    const column = vscode.ViewColumn.Beside;

    // If we already have a panel, show it.
    if (EvaluateView.currentPanel) {
      EvaluateView.currentPanel._panel.reveal(column);
      EvaluateView.currentPanel.selectFlag(flagName, flagDefinition);
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
    EvaluateView.currentPanel.selectFlag(flagName, flagDefinition);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    EvaluateView.currentPanel = new EvaluateView(panel, extensionUri);
  }

  public static viewOptions(extensionUri: vscode.Uri) {
    return {
      // Enable javascript in the webview
      enableScripts: true,
      // And restrict the webview to only loading content from our extension's `media` directory.
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

    // this._panel.onDidChangeViewState(
    //   () => {
    //     console.log('view state changed!');
    //     if (this._panel.visible) {
    //       this._update();
    //     }
    //   },
    //   null,
    //   this._disposables
    // );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
    	message => {
    		switch (message.command) {
    			case 'evaluate-flag': {
            console.log('got evaluate-flag from the web view... forwarding it.', message);
            vscode.commands.executeCommand('flagpole-explorer.evaluate-flag', message.flag);
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

  public selectFlag(flagName: string, flagDefinition: unknown) {
    this._panel.webview.postMessage({ command: 'select-flag', flagName, flagDefinition });
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
    

    const styles = [
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css')),
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css')),
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode-elements-lite', 'button.css')),
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode-elements-lite', 'checkbox.css')),
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode-elements-lite', 'collapsible.css')),
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode-elements-lite', 'divider.css')),
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode-elements-lite', 'form-container.css')),
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode-elements-lite', 'form-group.css')),
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode-elements-lite', 'form-helpers.css')),
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode-elements-lite', 'label.css')),
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode-elements-lite', 'select.css')),
      webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode-elements-lite', 'textfield.css')),
    ];

    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'evaluate-view.js'));

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    const propertyInputs = Object.entries(PROPERTIES).map(([name, type]) => {
      switch (type) {
        case 'number':
        case 'string':
          return `
          <div class="vscode-form-helper">
            <div class="vscode-textfield">
              <label for="${name}" class="vscode-label">
                ${name}
              </label>
              <br/>
              <input type="text" name="${name}" id="${name}" />
            </div>
          </div>
          `;
        case 'boolean':
          return `
          <div class="vscode-form-helper">
            <div class="vscode-checkbox">
              <label for="${name}" class="vscode-label">
                ${name}
              </label>
              <br/>
              <input type="checkbox" name="${name}" id="${name}" />
            </div>
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
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        ${styles.map(uri => `<link href="${uri}" rel="stylesheet">`).join('')}
      </head>
      <body>
        <h1>Evaluate: <span id="current-flag"></span></h1>

        <div class="vscode-form-container">
          <form id="request-eval">
            <input type="hidden" id="flagName" name="flagName" value="" />

            <div class="vscode-form-group vertical">
              ${propertyInputs.join('')}
            </div>

            <button type="submit" class="vscode-action-button">
              <i class="codicon codicon-plus" aria-hidden="true"></i>
              <span class="label">Evaluate Nowwn</span>
            </button>
          </form>
        </div>

        <script nonce="${nonce}" src="${scriptUri}"></script>
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
