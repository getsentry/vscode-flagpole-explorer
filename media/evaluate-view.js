// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.

(function () {
  const vscode = acquireVsCodeApi();

  function updateState(update) {
    return vscode.setState({
      ...vscode.getState() ?? {},
      ...update,
    });
  }

  const form = document.getElementById('request-eval');
  const flagNameDiv = document.getElementById('flagName');
  const flagDefinitionPre = document.getElementById('flagDefinition');
  const propertyInputGroups = form.querySelectorAll('.vscode-form-group');
  const inputs = form.querySelectorAll('input');

  const handleInput = (event) => {
    if (event.target.name) {
      updateState({[event.target.name]: event.target.value});
    }
  };

  form.addEventListener('input', handleInput);
  form.addEventListener('change', handleInput);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();

    const context = {};
    new FormData(form).forEach((value, key) => {
      switch (document.getElementById(key).type) {
        case 'checkbox':
          context[key] = Boolean(value);
          break;
        default:
          context[key] = value;
          break;
      }
    });
    vscode.postMessage({
      command: 'evaluate-flag',
      flag: flagNameDiv.textContent,
      context,
    });
  });

  function renderFromState(state) {
    flagNameDiv.textContent = state.feature.name;
    flagDefinitionPre.textContent = JSON.stringify(state.feature.definition, null, "  ");

    const properties = new Set();
    for (const segment of state.feature.definition.segments) {
      for (const condition of segment.conditions) {
        properties.add(condition.property);
      }
    }

    inputs.forEach(input => {
      if (input.name && state[input.name]) {
        input.value = state[input.name];
      }
    });

    propertyInputGroups.forEach(inputGroup => {
      if (properties.has(inputGroup.dataset.property)) {
        inputGroup.querySelector('input').setAttribute('name', inputGroup.dataset.property);
        inputGroup.classList.remove('hidden');
      } else {
        // Removing the name will prevent the input from being submitted
        inputGroup.querySelector('input').setAttribute('name', '');
        inputGroup.classList.add('hidden');
      }
    });
  }

  window.addEventListener('message', event => {
    const message = event.data; // The json data that the extension sent
    switch (message.command) {
      case 'select-flag':
        renderFromState(
          updateState({
            feature: message.feature,
          })
        );
        break;
    }
  });

  renderFromState(vscode.getState());
}());
