// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
  const vscode = acquireVsCodeApi();

  const oldState = /** @type {{ count: number} | undefined} */ (vscode.getState());
  console.log('Initial state', oldState);

  const currentFlagDiv = /** @type {HTMLElement} */ (document.getElementById('current-flag'));

  // let currentCount = (oldState && oldState.count) || 0;
  // counter.textContent = `${currentCount}`;

  // setInterval(() => {
  //     counter.textContent = `${currentCount++} `;

  //     // Update state
  //     vscode.setState({ count: currentCount });

  //     // Alert the extension when the cat introduces a bug
  //     // if (Math.random() < Math.min(0.001 * currentCount, 0.05)) {
  //     //     // Send a message back to the extension
  //     //     vscode.postMessage({
  //     //         command: 'alert',
  //     //         text: '🐛  on line ' + currentCount
  //     //     });
  //     // }
  // }, 100);

  setTimeout(() => {
    vscode.postMessage({
      command: 'eval-flag',
    });
  }, 2_000);

  // Handle messages sent from the extension to the webview
  window.addEventListener('message', event => {
    const message = event.data; // The json data that the extension sent
    console.log('addEventListener', message);
    switch (message.command) {
      case 'select-flag':
        console.log('message', message, currentFlagDiv);
        currentFlagDiv.textContent = message.flag;
        // currentCount = Math.ceil(currentCount * 0.5);
        // counter.textContent = `${currentCount}`;
        break;
    }
  });
}());
