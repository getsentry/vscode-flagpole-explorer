// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
import "@vscode-elements/elements-lite/components/button/button.css";

(function () {
  const vscode = acquireVsCodeApi();

  const oldState = /** @type {{ count: number} | undefined} */ (vscode.getState());
  console.log('Initial state', oldState);

  const currentFlagDiv = /** @type {HTMLElement} */ (document.getElementById('current-flag'));

  const form = document.getElementById('request-eval');
  if (form) {
    form.addEventListener('submit', (event) => {
      const formData = new FormData(/** @type {HTMLFormElement} */ (form));
      const context = /** @type {Record<string, unknown>} */ ({});
      formData.forEach((value, key) => {
        context[key] = value;
      });
      vscode.postMessage({
        command: 'evaluate-flag',
        flag: currentFlagDiv.textContent,
        context,
      });
    });
  }

  // Handle messages sent from the extension to the webview
  window.addEventListener('message', event => {
    const message = event.data; // The json data that the extension sent
    console.log('addEventListener', message);
    switch (message.command) {
      case 'select-flag':
        currentFlagDiv.textContent = message.flagName;
        break;
    }
  });
}());
