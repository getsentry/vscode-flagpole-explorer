import * as vscode from 'vscode';

export default class EvaluateView {
  public static readonly viewType = 'flagpole.evaluate';

  public static currentPanel: EvaluateView | undefined;

  public static createOrShow(extensionUri: vscode.Uri, flag: string) {
    const column = vscode.ViewColumn.Beside;

    // If we already have a panel, show it.
    if (EvaluateView.currentPanel) {
      EvaluateView.currentPanel._panel.reveal(column);
      EvaluateView.currentPanel.selectFlag(flag);
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
    EvaluateView.currentPanel.selectFlag(flag);
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
    			case 'eval-flag': {
            const { exec, execFile } = require('node:child_process');
            const cwd = '/Users/ryan953/code/sentry';
            // const binpath = 'bin/flagpole';
            const cmd = [
              '/Users/ryan953/code/sentry/bin/flagpole',
              '--flagpole-file=/Users/ryan953/code/sentry-options-automator/options/default/flagpole.yaml',
              '--flag-name=feature.organizations:use-case-insensitive-codeowners',
              '--context=\'{"organization_slug": "sentry"}\''
            ].join(' ');

            console.log('Did get eval-flag', {cwd, cmd});
            
            const flagEval = exec(cmd, { cwd, });

            console.log({flagEval});

            flagEval.stdout.on('data', (data: Uint8Array) => {
              console.log(`stdout: ${data}`);
            });
            flagEval.stderr.on('data', (data: Uint8Array) => {
              console.error(`stderr: ${data}`);
            });
            flagEval.on('close', (code: number) => {
              console.log(`close: ${code}`);
            });

    				// vscode.window.showErrorMessage(message.text);
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
    // this._panel.title = catName;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  public selectFlag(flag: string) {
    console.log('selectFlag', flag);
    this._panel.webview.postMessage({ command: 'select-flag', flag });
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
    // Local path to main script run in the webview
    const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');

    // And the uri we use to load this script in the webview
    const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

    // Local path to css styles
    const styleResetPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css');
    const stylesPathMainPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css');

    // Uri to load styles into webview
    const stylesResetUri = webview.asWebviewUri(styleResetPath);
    const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

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

        <link href="${stylesResetUri}" rel="stylesheet">
        <link href="${stylesMainUri}" rel="stylesheet">
      </head>
      <body>
        <h1>Hello world!</h1>
        <h1 id="current-flag"></h1>

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
